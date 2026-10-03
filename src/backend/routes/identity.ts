import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { Router } from "express";
import { requireAuth, requireRoles, type AuthRequest } from "../auth.js";
import type { User } from "../models.js";

interface IdentityRouteDependencies {
  readonly users: User[];
  nextId: (records: readonly { id: number }[]) => number;
  generateToken: (user: User) => string;
  publicUser: (user?: User | null) => object | null;
}

export function registerIdentityRoutes(api: Router, state: IdentityRouteDependencies): void {
api.post("/auth/register", (req, res) => {
  const { username, email, password, display_name, country, avatar_url } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ detail: "Todos los campos obligatorios deben ser completados" });
    return;
  }

  const cleanUsername = String(username).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password);

  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    res.status(400).json({ detail: "El nombre de usuario debe tener entre 3 y 20 caracteres" });
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    res.status(400).json({ detail: "El nombre de usuario solo puede contener letras, números y guiones bajos" });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ detail: "El formato de correo electrónico no es válido" });
    return;
  }
  if (cleanPassword.length < 6) {
    res.status(400).json({ detail: "La contraseña debe tener al menos 6 caracteres" });
    return;
  }

  if (state.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    res.status(400).json({ detail: "El nombre de usuario ya está en uso" });
    return;
  }
  if (state.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    res.status(400).json({ detail: "El correo electrónico ya está registrado" });
    return;
  }

  const chosenAvatar = avatar_url && (String(avatar_url).startsWith("http") || String(avatar_url).startsWith("data:image/"))
    ? String(avatar_url).trim()
    : "";

  const newUser: User = {
    id: state.nextId(state.users),
    username: cleanUsername,
    email: cleanEmail,
    password_hash: bcrypt.hashSync(cleanPassword, 10),
    display_name: (display_name ? String(display_name).trim() : cleanUsername).slice(0, 50),
    role: "blader",
    country: (country ? String(country).trim().toUpperCase() : "PA").slice(0, 5),
    avatar_url: chosenAvatar,
    elo_rating: 1200,
    is_active: true,
    is_verified: false,
    created_at: new Date().toISOString()
  };
  state.users.push(newUser);

  const token = state.generateToken(newUser);
  res.json({
    access_token: token,
    token_type: "bearer",
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      display_name: newUser.display_name,
      role: newUser.role,
      country: newUser.country,
      avatar_url: newUser.avatar_url,
      elo_rating: newUser.elo_rating
    }
  });
});

api.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ detail: "Debes ingresar tu correo/usuario y contraseña" });
    return;
  }
  const query = String(email).trim().toLowerCase();
  const user = state.users.find((u) => u.email.toLowerCase() === query || u.username.toLowerCase() === query);
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    res.status(400).json({ detail: "Credenciales incorrectas" });
    return;
  }

  const token = state.generateToken(user);
  res.json({
    access_token: token,
    token_type: "bearer",
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      country: user.country,
      avatar_url: user.avatar_url,
      elo_rating: user.elo_rating
    }
  });
});

api.post("/auth/google", async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const credential = typeof req.body?.credential === "string" ? req.body.credential.trim() : "";
  if (!clientId) {
    res.status(503).json({ detail: "El acceso con Google aún no está configurado" });
    return;
  }
  if (!credential) {
    res.status(400).json({ detail: "Falta la credencial de Google" });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const googleResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { headers: { Accept: "application/json" }, signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!googleResponse.ok) {
      res.status(401).json({ detail: "La credencial de Google no es válida" });
      return;
    }
    const claims = await googleResponse.json() as {
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: string;
      name?: string;
      picture?: string;
    };
    if (claims.aud !== clientId || !claims.sub || !claims.email || claims.email_verified !== "true") {
      res.status(401).json({ detail: "No se pudo verificar la cuenta de Google" });
      return;
    }

    let user = state.users.find((candidate) => candidate.email.toLowerCase() === claims.email!.toLowerCase());
    if (!user) {
      const baseUsername = claims.email.split("@")[0].replace(/[^a-z0-9_]+/gi, "_").slice(0, 24) || "blader";
      let username = baseUsername;
      let suffix = 1;
      while (state.users.some((candidate) => candidate.username.toLowerCase() === username.toLowerCase())) {
        username = `${baseUsername}_${suffix++}`;
      }
      user = {
        id: state.nextId(state.users),
        username,
        email: claims.email.toLowerCase(),
        password_hash: bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10),
        display_name: (claims.name || username).slice(0, 50),
        role: "blader",
        country: "PA",
        avatar_url: claims.picture || "",
        elo_rating: 1200,
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString()
      };
      state.users.push(user);
    } else if (claims.picture && !user.avatar_url) {
      user.avatar_url = claims.picture;
    }

    res.json({
      access_token: state.generateToken(user),
      token_type: "bearer",
      user: state.publicUser(user)
    });
  } catch (error) {
    console.error("Google authentication failed:", error);
    res.status(502).json({ detail: "No se pudo verificar Google en este momento" });
  }
});

api.get("/auth/me", requireAuth, (req: AuthRequest, res) => {
  const u = req.user!;
  res.json({
    id: u.id,
    username: u.username,
    email: u.email,
    display_name: u.display_name,
    role: u.role,
    country: u.country,
    avatar_url: u.avatar_url,
    bio: u.bio,
    favorite_combo: u.favorite_combo,
    elo_rating: u.elo_rating,
    is_active: u.is_active,
    is_verified: u.is_verified,
    created_at: u.created_at
  });
});

// --- Users ---
api.get("/users", (req, res) => {
  const role = req.query.role as string;
  const limit = parseInt((req.query.limit as string) || "50", 10);
  let list = state.users.filter((u) => u.is_active);
  if (role) list = list.filter((u) => u.role === role);
  list.sort((a, b) => b.elo_rating - a.elo_rating);
  res.json(
    list.slice(0, Math.min(100, Math.max(1, limit))).map((u) => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      email: u.email,
      role: u.role,
      country: u.country,
      avatar_url: u.avatar_url,
      elo_rating: u.elo_rating,
      is_active: u.is_active,
      is_verified: u.is_verified,
      created_at: u.created_at
    }))
  );
});

api.get("/users/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ detail: "ID de usuario inválido" });
    return;
  }
  const u = state.users.find((user) => user.id === id);
  if (!u) {
    res.status(404).json({ detail: "Usuario no encontrado" });
    return;
  }
  res.json(state.publicUser(u));
});

api.put("/users/me", requireAuth, (req: AuthRequest, res) => {
  const u = req.user!;
  const { display_name, country, avatar_url, bio, favorite_combo } = req.body;
  if (display_name !== undefined) {
    const cleanName = String(display_name).trim();
    if (cleanName.length < 2 || cleanName.length > 50) {
      res.status(400).json({ detail: "El nombre visible debe tener entre 2 y 50 caracteres" });
      return;
    }
    u.display_name = cleanName;
  }
  if (country !== undefined) {
    u.country = String(country).trim().toUpperCase().slice(0, 5);
  }
  if (avatar_url !== undefined) {
    const cleanAvatar = String(avatar_url).trim();
    const isDataImage = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(cleanAvatar);
    const isRemoteImage = /^https?:\/\/[^\s"'<>]+$/i.test(cleanAvatar);
    if (cleanAvatar && cleanAvatar.length > 600_000) {
      res.status(400).json({ detail: "La imagen de perfil es demasiado grande" });
      return;
    }
    if (cleanAvatar && !isDataImage && !isRemoteImage) {
      res.status(400).json({ detail: "La foto de perfil debe ser una URL https o una imagen válida" });
      return;
    }
    u.avatar_url = cleanAvatar;
  }
  if (bio !== undefined) {
    const cleanBio = String(bio).trim();
    if (cleanBio.length > 300) {
      res.status(400).json({ detail: "La biografía no puede superar 300 caracteres" });
      return;
    }
    u.bio = cleanBio;
  }
  if (favorite_combo !== undefined) {
    u.favorite_combo = String(favorite_combo).trim().slice(0, 100);
  }

  res.json(state.publicUser(u));
});

api.put("/auth/password", requireAuth, (req: AuthRequest, res) => {
  const u = req.user!;
  const currentPassword = String(req.body?.current_password || "");
  const newPassword = String(req.body?.new_password || "");
  if (!bcrypt.compareSync(currentPassword, u.password_hash)) {
    res.status(400).json({ detail: "La contraseña actual no es correcta" });
    return;
  }
  if (newPassword.length < 12) {
    res.status(400).json({ detail: "La nueva contraseña debe tener al menos 12 caracteres" });
    return;
  }
  u.password_hash = bcrypt.hashSync(newPassword, 10);
  res.json({ success: true });
});

api.post("/users/admin-create", requireRoles(["admin"]), (req: AuthRequest, res) => {
  const { username, email, password, display_name, role, country, avatar_url } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ detail: "Username, email y password son obligatorios" });
    return;
  }
  if (String(password).length < 12) {
    res.status(400).json({ detail: "La contraseña debe tener al menos 12 caracteres" });
    return;
  }
  const cleanUsername = String(username).trim();
  const cleanEmail = String(email).trim().toLowerCase();

  if (state.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    res.status(400).json({ detail: "El nombre de usuario ya está en uso" });
    return;
  }
  if (state.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    res.status(400).json({ detail: "El correo electrónico ya está registrado" });
    return;
  }

  const validRoles = ["blader", "referee", "organizer", "admin"];
  const chosenRole = validRoles.includes(role) ? role : "blader";

  const chosenAvatar = avatar_url && (String(avatar_url).startsWith("http") || String(avatar_url).startsWith("data:image/"))
    ? String(avatar_url).trim()
    : "";

  const newUser: User = {
    id: state.nextId(state.users),
    username: cleanUsername,
    email: cleanEmail,
    password_hash: bcrypt.hashSync(String(password), 10),
    display_name: (display_name ? String(display_name).trim() : cleanUsername).slice(0, 50),
    role: chosenRole,
    country: (country ? String(country).trim().toUpperCase() : "PA").slice(0, 5),
    avatar_url: chosenAvatar,
    elo_rating: 1200,
    is_active: true,
    is_verified: true,
    created_at: new Date().toISOString()
  };
  state.users.push(newUser);
  res.json(state.publicUser(newUser));


});

api.put("/users/:id", requireRoles(["admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const target = state.users.find((u) => u.id === id);
  if (!target) {
    res.status(404).json({ detail: "Usuario no encontrado" });
    return;
  }
  const { display_name, country, avatar_url, bio, favorite_combo, role, elo_rating } = req.body;
  if (display_name !== undefined) target.display_name = String(display_name).trim().slice(0, 50);
  if (country !== undefined) target.country = String(country).trim().toUpperCase().slice(0, 5);
  if (avatar_url !== undefined) target.avatar_url = String(avatar_url).trim();
  if (bio !== undefined) target.bio = String(bio).trim().slice(0, 300);
  if (favorite_combo !== undefined) target.favorite_combo = String(favorite_combo).trim().slice(0, 100);
  if (role !== undefined) {
    const validRoles = ["blader", "referee", "organizer", "admin"];
    if (validRoles.includes(role)) target.role = role;
  }
  if (elo_rating !== undefined && Number.isFinite(Number(elo_rating))) {
    target.elo_rating = Math.max(100, Math.min(3500, Math.round(Number(elo_rating))));
  }

  res.json(state.publicUser(target));


});

api.put("/users/:id/role", requireRoles(["admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const target = state.users.find((u) => u.id === id);
  if (!target) {
    res.status(404).json({ detail: "Usuario no encontrado" });
    return;
  }
  const { role } = req.body;
  const validRoles = ["blader", "referee", "organizer", "admin"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ detail: "Rol no válido. Opciones permitidas: blader, referee, organizer, admin" });
    return;
  }
  target.role = role;
  res.json(state.publicUser(target));


});

}
