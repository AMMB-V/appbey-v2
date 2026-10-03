import type { Router } from "express";
import { requireAuth, requireRoles, type AuthRequest } from "../auth.js";
import type { BeybladePart, BladerDeck, MetaSyncState, User } from "../models.js";

export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end--;
  return value.slice(0, end);
}

const BEYBLADE_X_API_BASE_URL = trimTrailingSlashes(
  process.env.BEYBLADE_X_API_BASE_URL || "https://beyblade-x-api.onrender.com/beybladex"
);

interface CatalogRouteDependencies {
  parts: BeybladePart[];
  decks: BladerDeck[];
  readonly users: User[];
  metaSyncState: MetaSyncState;
  nextId: (records: readonly { id: number }[]) => number;
  publicUser: (user?: User | null) => object | null;
  persistState: () => Promise<void>;
}

export function catalogNameKey(name: string): string {
  const trimmedName = name.trimEnd();
  const closingParenthesis = trimmedName.length - 1;
  if (trimmedName[closingParenthesis] !== ")") return name.trim().toLocaleLowerCase();

  const previousClosingParenthesis = trimmedName.lastIndexOf(")", closingParenthesis - 1);
  const segmentStart = previousClosingParenthesis + 1;
  const openingParenthesis = trimmedName.indexOf("(", segmentStart);
  if (openingParenthesis < 0) return name.trim().toLocaleLowerCase();
  return trimmedName.slice(0, openingParenthesis).trim().toLocaleLowerCase();
}

export function registerCatalogRoutes(api: Router, state: CatalogRouteDependencies): void {
  let catalogSyncInProgress = false;
function getMetaSyncSummary(): MetaSyncState {
  const interruptedSync = state.metaSyncState.status === "syncing" && !catalogSyncInProgress;
  const normalizedStatus = interruptedSync
    ? "error"
    : state.metaSyncState.status === "demo"
      ? "not_configured"
      : state.metaSyncState.status;
  return {
    ...state.metaSyncState,
    source_name: "Beyblade X API (comunitaria)",
    source_url: `${BEYBLADE_X_API_BASE_URL.replace(/\/beybladex$/, "")}/swagger-ui.html`,
    official_url: "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/",
    secondary_url: "https://worldbeyblade.org",
    meta_version: "Catálogo comunitario",
    last_synced_at: state.metaSyncState.status === "demo" ? "" : state.metaSyncState.last_synced_at,
    status: normalizedStatus,
    last_error: interruptedSync
      ? "La actualización anterior se interrumpió. Puedes volver a intentarlo."
      : state.metaSyncState.last_error,
    patch_notes: [...state.metaSyncState.patch_notes]
  };
}

type CatalogSourcePart = Record<string, unknown>;

function catalogString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function catalogNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function catalogSourceNumber(record: CatalogSourcePart, key: string, fallback: number): number {
  return Object.hasOwn(record, key) ? catalogNumber(record[key], 0) : fallback;
}

function catalogType(record: CatalogSourcePart, existing?: BeybladePart): string {
  const suppliedType = catalogString(record.bladeType) ||
    catalogString(record.type) ||
    catalogString(record.category) ||
    catalogString(record.type_attr);
  const normalizedType = suppliedType?.toLowerCase();
  if (normalizedType === "attack") return "Attack";
  if (normalizedType === "stamina") return "Stamina";
  if (normalizedType === "defense") return "Defense";
  if (normalizedType === "balance") return "Balance";
  return suppliedType || existing?.type_attr || "Sin datos";
}

function mergeExternalParts(
  existingParts: BeybladePart[],
  collections: Array<{ category: "blade" | "ratchet" | "bit"; endpoint: string; records: CatalogSourcePart[] }>,
  syncedAt: string
): BeybladePart[] {
  const merged = [...existingParts];
  let nextPartId = state.nextId(merged);

  for (const collection of collections) {
    const seenNames = new Set<string>();
    for (const record of collection.records) {
      const name = catalogString(record.name);
      if (!name) throw new Error(`La fuente devolvió una pieza sin nombre en /${collection.endpoint}.`);
      const nameKey = catalogNameKey(name);
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);

      const existingIndex = merged.findIndex((part) =>
        part.category === collection.category && catalogNameKey(part.name) === nameKey
      );
      const existing = existingIndex >= 0 ? merged[existingIndex] : undefined;
      const line = (catalogString(record.line) || "").toUpperCase();
      const system = line.includes("UNIQUE") || line.includes("UX")
        ? "UX"
        : line.includes("BASIC") || line.includes("BX")
          ? "BX"
          : line.includes("CUSTOM")
            ? "Custom"
            : existing?.system || "BX";
      const rawCode = catalogString(record.code) || existing?.code || name;
      const attack = Math.max(0, Math.min(100, catalogSourceNumber(record, "attack", existing?.attack_stat ?? 0)));
      const defense = Math.max(0, Math.min(100, catalogSourceNumber(record, "defense", existing?.defense_stat ?? 0)));
      const stamina = Math.max(0, Math.min(100, catalogSourceNumber(record, "stamina", existing?.stamina_stat ?? 0)));
      const dash = Math.max(0, Math.min(100, catalogSourceNumber(record, "dash", existing?.dash_stat ?? 0)));
      const weight = Math.max(0, catalogSourceNumber(record, "weight", existing?.weight_grams ?? 0));
      const detail = catalogString(record.description);
      const sourceDetails = [
        detail,
        catalogString(record.hasbroName) && `Nombre Hasbro: ${catalogString(record.hasbroName)}`,
        catalogString(record.spinDirection) && `Giro: ${catalogString(record.spinDirection)}`,
        catalogString(record.releaseDate) && `Lanzamiento: ${catalogString(record.releaseDate)}`,
        catalogString(record.collaboration) && `Colaboración: ${catalogString(record.collaboration)}`,
        catalogString(record.compatibility) && `Compatibilidad: ${catalogString(record.compatibility)}`,
        catalogString(record.tipShape) && `Forma: ${catalogString(record.tipShape)}`,
        catalogString(record.material) && `Material: ${catalogString(record.material)}`
      ].filter(Boolean).join(" · ");
      const part: BeybladePart = {
        ...(existing || {}),
        id: existing?.id ?? nextPartId++,
        code: rawCode,
        name,
        category: collection.category,
        system,
        type_attr: catalogType(record, existing),
        weight_grams: weight,
        attack_stat: attack,
        defense_stat: defense,
        stamina_stat: stamina,
        dash_stat: dash,
        tier: existing?.tier || "N",
        description: sourceDetails || existing?.description || "Pieza de Beyblade X.",
        last_updated: syncedAt,
        source_reference: `${BEYBLADE_X_API_BASE_URL}/${collection.endpoint}`
      };

      if (existingIndex >= 0) merged[existingIndex] = part;
      else merged.push(part);
    }
  }
  return merged;
}

async function fetchCatalogCollection(endpoint: string): Promise<CatalogSourcePart[]> {
  let response: globalThis.Response;
  try {
    response = await fetch(`${BEYBLADE_X_API_BASE_URL}/${endpoint}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(70_000)
    });
  } catch (error) {
    const detail = error instanceof Error && error.name === "TimeoutError"
      ? "La fuente tardó demasiado en responder."
      : "No se pudo conectar con la fuente de datos.";
    throw new Error(`${detail} (${endpoint})`);
  }

  if (!response.ok) throw new Error(`La fuente respondió HTTP ${response.status} (${endpoint}).`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`La fuente devolvió JSON inválido (${endpoint}).`);
  }
  if (!Array.isArray(payload) || payload.length === 0 || payload.length > 5000) {
    throw new Error(`La fuente devolvió una lista vacía o inválida (${endpoint}).`);
  }
  if (payload.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error(`La fuente devolvió piezas inválidas (${endpoint}).`);
  }
  return payload as CatalogSourcePart[];
}

api.get("/beyblades/meta-tierlist", (req, res) => {
  const sTiers = state.parts.filter((p) => p.tier === "S");
  const aTiers = state.parts.filter((p) => p.tier === "A");
  const bTiers = state.parts.filter((p) => p.tier === "B");
  const cTiers = state.parts.filter((p) => p.tier === "C");
  const unranked = state.parts.filter((p) => p.tier === "N");

  res.json({
    meta: getMetaSyncSummary(),
    parts: state.parts,
    counts: {
      total: state.parts.length,
      blades: state.parts.filter((p) => p.category === "blade").length,
      ratchets: state.parts.filter((p) => p.category === "ratchet").length,
      bits: state.parts.filter((p) => p.category === "bit").length,
      s_tier: sTiers.length,
      a_tier: aTiers.length,
      b_tier: bTiers.length,
      c_tier: cTiers.length,
      unranked: unranked.length
    },
    top_picks: state.parts.slice().sort((a, b) => (b.pick_rate_pct || 0) - (a.pick_rate_pct || 0)).slice(0, 5)
  });
});

api.post("/beyblades/meta-tierlist/sync", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  if (!catalogSyncInProgress) {
    catalogSyncInProgress = true;
    state.metaSyncState = { ...state.metaSyncState, status: "syncing", last_error: undefined };
    void state.persistState().catch(() => undefined);

    void (async () => {
      try {
        const endpoints = [
          { category: "blade" as const, endpoint: "blades" },
          { category: "ratchet" as const, endpoint: "ratchets" },
          { category: "bit" as const, endpoint: "bits" }
        ];
        const collections = await Promise.all(endpoints.map(async ({ category, endpoint }) => ({
          category,
          endpoint,
          records: await fetchCatalogCollection(endpoint)
        })));
        const syncedAt = new Date().toISOString();
        const previousParts = state.parts;
        const previousMeta = state.metaSyncState;
        state.parts = mergeExternalParts(previousParts, collections, syncedAt);
        state.metaSyncState = {
          ...state.metaSyncState,
          source_name: "Beyblade X API (comunitaria)",
          last_synced_at: syncedAt,
          meta_version: "Catálogo comunitario",
          status: "synced",
          last_error: undefined,
          patch_notes: [`Catálogo actualizado: ${collections.reduce((total, item) => total + item.records.length, 0)} piezas importadas.`]
        };
        try {
          await state.persistState();
        } catch (error) {
          state.parts = previousParts;
          state.metaSyncState = previousMeta;
          throw error;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido al actualizar el catálogo.";
        state.metaSyncState = {
          ...state.metaSyncState,
          status: "error",
          last_error: message.slice(0, 240)
        };
        console.error("Beyblade X catalog synchronization failed:", message);
        await state.persistState().catch(() => undefined);
      } finally {
        catalogSyncInProgress = false;
      }
    })();
  }
  res.status(202).json({
    success: true,
    message: "Actualización del catálogo iniciada.",
    meta: getMetaSyncSummary()
  });
});

api.put("/beyblades/parts/:id/tier", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const { tier, trend, trend_label, best_combo } = req.body;
  const p = state.parts.find((part) => part.id === id);
  if (!p) {
    res.status(404).json({ detail: "Pieza no encontrada" });
    return;
  }
  if (tier && ["S", "A", "B", "C", "N"].includes(tier)) {
    p.tier = tier;
  }
  if (trend) p.trend = trend;
  if (trend_label) p.trend_label = trend_label;
  if (best_combo) p.best_combo = best_combo;
  p.last_updated = new Date().toISOString();

  res.json({ success: true, part: p });
});

api.get("/beyblades/parts", (req, res) => {
  const category = req.query.category as string;
  const system = req.query.system as string;
  const tier = req.query.tier as string;

  let list = [...state.parts];
  if (category) list = list.filter((p) => p.category === category);
  if (system) list = list.filter((p) => p.system === system);
  if (tier) list = list.filter((p) => p.tier === tier);
  res.json(list);
});

api.get("/beyblades/parts/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const p = state.parts.find((part) => part.id === id);
  if (!p) {
    res.status(404).json({ detail: "Pieza no encontrada" });
    return;
  }
  res.json(p);
});

api.get("/beyblades/decks", (req, res) => {
  const userId = req.query.user_id ? parseInt(req.query.user_id as string, 10) : null;
  let list = [...state.decks];
  if (userId) {
    list = list.filter((d) => d.user_id === userId);
  } else {
    list = list.filter((d) => d.is_public);
  }
  res.json(
    list.map((d) => ({
      ...d,
      user: state.publicUser(state.users.find((u) => u.id === d.user_id)),
      slot1_blade: state.parts.find((p) => p.id === d.slot1_blade_id),
      slot1_ratchet: state.parts.find((p) => p.id === d.slot1_ratchet_id),
      slot1_bit: state.parts.find((p) => p.id === d.slot1_bit_id),
      slot2_blade: state.parts.find((p) => p.id === d.slot2_blade_id),
      slot2_ratchet: state.parts.find((p) => p.id === d.slot2_ratchet_id),
      slot2_bit: state.parts.find((p) => p.id === d.slot2_bit_id),
      slot3_blade: state.parts.find((p) => p.id === d.slot3_blade_id),
      slot3_ratchet: state.parts.find((p) => p.id === d.slot3_ratchet_id),
      slot3_bit: state.parts.find((p) => p.id === d.slot3_bit_id)
    }))
  );
});

api.post("/beyblades/decks", requireAuth, (req: AuthRequest, res) => {
  const u = req.user!;
  const data = req.body;

  if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
    res.status(400).json({ detail: "El nombre del deck es obligatorio (mínimo 2 caracteres)" });
    return;
  }
  const deckName = String(data.name).trim().slice(0, 60);

  // Validate blade parts.
  const bladeIds = [data.slot1_blade_id, data.slot2_blade_id, data.slot3_blade_id].filter(Boolean);
  const ratchetIds = [data.slot1_ratchet_id, data.slot2_ratchet_id, data.slot3_ratchet_id].filter(Boolean);
  const bitIds = [data.slot1_bit_id, data.slot2_bit_id, data.slot3_bit_id].filter(Boolean);

  // WBO / Takara Tomy 3on3 Rule: No Duplicate Parts Allowed across slots
  if (new Set(bladeIds).size !== bladeIds.length) {
    res.status(400).json({ detail: "Reglamento oficial WBO / Takara Tomy: No se permiten Blades repetidos en un Deck 3on3." });
    return;
  }
  if (new Set(ratchetIds).size !== ratchetIds.length) {
    res.status(400).json({ detail: "Reglamento oficial WBO / Takara Tomy: No se permiten Ratchets repetidos en un Deck 3on3." });
    return;
  }
  if (new Set(bitIds).size !== bitIds.length) {
    res.status(400).json({ detail: "Reglamento oficial WBO / Takara Tomy: No se permiten Bits repetidos en un Deck 3on3." });
    return;
  }

  // Ensure all provided part IDs exist in catalog and belong to correct categories
  const allProvidedPartIds = [...bladeIds, ...ratchetIds, ...bitIds];
  for (const pid of allProvidedPartIds) {
    const part = state.parts.find((p) => p.id === pid);
    if (!part) {
      res.status(400).json({ detail: `La pieza con ID #${pid} no existe en el catálogo de piezas oficial.` });
      return;
    }
  }

  const selectedParts = state.parts.filter((p) => allProvidedPartIds.includes(p.id));
  const totalW = selectedParts.reduce((sum, p) => sum + (p.weight_grams || 0), 0);

  const newDeck: BladerDeck = {
    id: state.nextId(state.decks),
    user_id: u.id,
    name: deckName,
    description: data.description ? String(data.description).trim().slice(0, 300) : "",
    is_public: data.is_public !== false,
    slot1_name: data.slot1_name ? String(data.slot1_name).trim().slice(0, 100) : undefined,
    slot1_blade_id: data.slot1_blade_id || undefined,
    slot1_ratchet_id: data.slot1_ratchet_id || undefined,
    slot1_bit_id: data.slot1_bit_id || undefined,
    slot2_name: data.slot2_name ? String(data.slot2_name).trim().slice(0, 100) : undefined,
    slot2_blade_id: data.slot2_blade_id || undefined,
    slot2_ratchet_id: data.slot2_ratchet_id || undefined,
    slot2_bit_id: data.slot2_bit_id || undefined,
    slot3_name: data.slot3_name ? String(data.slot3_name).trim().slice(0, 100) : undefined,
    slot3_blade_id: data.slot3_blade_id || undefined,
    slot3_ratchet_id: data.slot3_ratchet_id || undefined,
    slot3_bit_id: data.slot3_bit_id || undefined,
    total_weight: Math.round(totalW * 10) / 10,
    created_at: new Date().toISOString()
  };
  state.decks.unshift(newDeck);
  res.json({
    ...newDeck,
    user: u,
    slot1_blade: state.parts.find((p) => p.id === newDeck.slot1_blade_id),
    slot1_ratchet: state.parts.find((p) => p.id === newDeck.slot1_ratchet_id),
    slot1_bit: state.parts.find((p) => p.id === newDeck.slot1_bit_id),
    slot2_blade: state.parts.find((p) => p.id === newDeck.slot2_blade_id),
    slot2_ratchet: state.parts.find((p) => p.id === newDeck.slot2_ratchet_id),
    slot2_bit: state.parts.find((p) => p.id === newDeck.slot2_bit_id),
    slot3_blade: state.parts.find((p) => p.id === newDeck.slot3_blade_id),
    slot3_ratchet: state.parts.find((p) => p.id === newDeck.slot3_ratchet_id),
    slot3_bit: state.parts.find((p) => p.id === newDeck.slot3_bit_id)
  });
});

api.delete("/beyblades/decks/:id", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const deckIndex = state.decks.findIndex((d) => d.id === id);
  if (deckIndex === -1) {
    res.status(404).json({ detail: "Deck no encontrado" });
    return;
  }
  const deck = state.decks[deckIndex];
  if (deck.user_id !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ detail: "No tienes permisos para eliminar este deck" });
    return;
  }
  state.decks.splice(deckIndex, 1);
  res.json({ message: "Deck eliminado exitosamente" });
});

}
