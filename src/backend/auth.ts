import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { User } from "./models.js";

export interface AuthRequest extends Request<Record<string, string>> {
  user?: User;
}

export class AuthService {
  constructor(
    private readonly secret: string,
    private readonly findUserById: (id: number) => User | undefined
  ) {}

  generateToken(user: User): string {
    return jwt.sign(
      { sub: String(user.id), username: user.username, role: user.role },
      this.secret,
      { expiresIn: "7d" }
    );
  }

  readonly middleware = (req: AuthRequest, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.substring(7), this.secret) as jwt.JwtPayload;
        if (decoded.sub) {
          const user = this.findUserById(Number(decoded.sub));
          if (user) req.user = user;
        }
      } catch (_error) {
        // Invalid or expired tokens remain unauthenticated.
      }
    }
    next();
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ detail: "No autenticado" });
    return;
  }
  next();
}

export function requireRoles(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ detail: "Tu sesión expiró. Inicia sesión nuevamente." });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ detail: "Permisos insuficientes" });
      return;
    }
    next();
  };
}
