import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  ActivityLog,
  Attachment,
  ListItem,
  ListVersion,
  MoodLayout,
  OwnerProfile,
  OwnerSettings,
  PetalList,
  QuickCapture,
  ShareLink,
  Tag,
} from "./types";
import { ACCENT } from "./palette";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "petals.db");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const STARTER_WORKSPACE_RESET = "starter-workspace-v1";

let db: DatabaseSync | null = null;

export function id() {
  return crypto.randomUUID();
}

export function token() {
  return crypto.randomBytes(24).toString("base64url");
}

export function now() {
  return new Date().toISOString();
}

export function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

function migrate(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      settings TEXT NOT NULL,
      seeded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      owner_device_id TEXT NOT NULL,
      title TEXT NOT NULL,
      emoji TEXT NOT NULL,
      color TEXT NOT NULL,
      cover_image TEXT,
      cover_style TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      font_style TEXT NOT NULL DEFAULT 'sans',
      budget_target REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    );
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      title TEXT NOT NULL,
      emoji TEXT,
      notes TEXT,
      private_notes TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      target_date TEXT,
      target_month TEXT,
      season TEXT,
      priority TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      price REAL,
      currency TEXT,
      store TEXT,
      product_url TEXT,
      purchased INTEGER NOT NULL DEFAULT 0,
      hidden_from_mood INTEGER NOT NULL DEFAULT 0,
      mood_order INTEGER NOT NULL DEFAULT 0,
      imported_metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      thumbnail_url TEXT,
      filename TEXT,
      alt_text TEXT,
      is_shared INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL DEFAULT 0,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      owner_device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS item_tags (
      item_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (item_id, tag_id)
    );
    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      owner_device_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      attachment_url TEXT,
      imported_metadata TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS share_links (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      permission TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      guest_name TEXT,
      action TEXT NOT NULL,
      entity_id TEXT,
      detail TEXT,
      timestamp TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      label TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS general_item_order (
      general_list_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (general_list_id, item_id),
      FOREIGN KEY (general_list_id) REFERENCES lists(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS auth_sessions_owner_idx ON auth_sessions(owner_id);
    CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
  `);
  ensureColumn(d, "items", "mood_layout", "TEXT");
  ensureColumn(d, "owners", "name", "TEXT");
  ensureColumn(d, "owners", "email", "TEXT");
  ensureColumn(d, "owners", "avatar_url", "TEXT");
  ensureColumn(d, "owners", "google_sub", "TEXT");
  ensureColumn(d, "owners", "auth_provider", "TEXT");
  d.exec("CREATE UNIQUE INDEX IF NOT EXISTS owners_google_sub_unique ON owners(google_sub) WHERE google_sub IS NOT NULL;");
  applyStarterWorkspaceReset(d);
}

/**
 * A deliberate, one-time clean slate for the first public Petals workspace.
 * Profiles and their preferences stay intact; every piece of workspace content
 * is removed and each owner is marked for the new, single-list starter guide.
 */
function applyStarterWorkspaceReset(d: DatabaseSync) {
  let didReset = false;
  d.exec("BEGIN EXCLUSIVE;");
  try {
    const alreadyApplied = d.prepare("SELECT 1 FROM app_state WHERE key = ?").get(STARTER_WORKSPACE_RESET);
    if (!alreadyApplied) {
      d.exec(`
        DELETE FROM item_tags;
        DELETE FROM general_item_order;
        DELETE FROM attachments;
        DELETE FROM items;
        DELETE FROM share_links;
        DELETE FROM activity;
        DELETE FROM versions;
        DELETE FROM captures;
        DELETE FROM tags;
        DELETE FROM lists;
      `);
      d.prepare("UPDATE owners SET seeded = 0").run();
      d.prepare("INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)").run(
        STARTER_WORKSPACE_RESET,
        "applied",
        now(),
      );
      didReset = true;
    }
    d.exec("COMMIT;");
  } catch (error) {
    d.exec("ROLLBACK;");
    throw error;
  }

  if (didReset) {
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function ensureColumn(d: DatabaseSync, table: string, column: string, definition: string) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return;
  d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export const defaultSettings = (): OwnerSettings => ({
  theme: "light",
  largerText: false,
  highContrast: false,
  reducedMotion: false,
  milestonesEnabled: true,
  defaultFont: "sans",
  accentColor: ACCENT.hex,
});

export function ensureOwner(ownerId: string) {
  const d = getDb();
  const row = d.prepare("SELECT * FROM owners WHERE id = ?").get(ownerId);
  if (!row) {
    d.prepare("INSERT INTO owners (id, settings, seeded, created_at) VALUES (?, ?, 0, ?)").run(
      ownerId,
      JSON.stringify(defaultSettings()),
      now(),
    );
  }
  return getOwner(ownerId);
}

export function getOwner(ownerId: string) {
  const row = getDb().prepare("SELECT * FROM owners WHERE id = ?").get(ownerId);
  if (!row) return null;
  const stored = JSON.parse(String(row.settings)) as Partial<OwnerSettings>;
  return {
    id: String(row.id),
    settings: { ...defaultSettings(), ...stored } as OwnerSettings,
    createdAt: String(row.created_at),
    seeded: Boolean(row.seeded),
    profile: ownerProfileFromRow(row),
  };
}

function ownerProfileFromRow(row: Record<string, unknown>): OwnerProfile {
  const provider = row.auth_provider === "google" ? "google" : "device";
  return {
    id: String(row.id),
    name: row.name ? String(row.name) : null,
    email: row.email ? String(row.email) : null,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    provider,
    createdAt: String(row.created_at),
  };
}

export function getOwnerProfile(ownerId: string) {
  const row = getDb().prepare("SELECT * FROM owners WHERE id = ?").get(ownerId) as Record<string, unknown> | undefined;
  return row ? ownerProfileFromRow(row) : null;
}

export function getOwnerByGoogleSub(googleSub: string) {
  const row = getDb().prepare("SELECT id FROM owners WHERE google_sub = ?").get(googleSub) as { id?: string } | undefined;
  return row?.id ? getOwner(row.id) : null;
}

export function updateOwnerProfile(ownerId: string, patch: Partial<Pick<OwnerProfile, "name" | "avatarUrl">>) {
  const owner = getOwner(ownerId);
  if (!owner) return null;
  const name = patch.name == null ? owner.profile.name : patch.name.trim().slice(0, 80) || null;
  const avatarUrl = patch.avatarUrl == null ? owner.profile.avatarUrl : patch.avatarUrl || null;
  getDb().prepare("UPDATE owners SET name = ?, avatar_url = ? WHERE id = ?").run(name, avatarUrl, ownerId);
  return getOwnerProfile(ownerId);
}

export function attachGoogleIdentity(
  ownerId: string,
  profile: { googleSub: string; email: string | null; name: string | null; avatarUrl: string | null },
) {
  ensureOwner(ownerId);
  getDb()
    .prepare("UPDATE owners SET google_sub = ?, email = ?, name = ?, avatar_url = ?, auth_provider = 'google' WHERE id = ?")
    .run(profile.googleSub, profile.email, profile.name, profile.avatarUrl, ownerId);
  return getOwner(ownerId);
}

export function createAuthSession(ownerId: string, lifetimeDays = 30) {
  const sessionToken = token();
  const expiresAt = new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000).toISOString();
  const d = getDb();
  d.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(now());
  d.prepare("INSERT INTO auth_sessions (token, owner_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    sessionToken,
    ownerId,
    expiresAt,
    now(),
  );
  return { token: sessionToken, expiresAt };
}

export function ownerForAuthSession(sessionToken: string) {
  const row = getDb()
    .prepare("SELECT owner_id FROM auth_sessions WHERE token = ? AND expires_at > ?")
    .get(sessionToken, now()) as { owner_id?: string } | undefined;
  return row?.owner_id ? getOwner(row.owner_id) : null;
}

export function deleteAuthSession(sessionToken: string) {
  getDb().prepare("DELETE FROM auth_sessions WHERE token = ?").run(sessionToken);
}

export function markSeeded(ownerId: string) {
  getDb().prepare("UPDATE owners SET seeded = 1 WHERE id = ?").run(ownerId);
}

export function updateSettings(ownerId: string, patch: Partial<OwnerSettings>) {
  const owner = getOwner(ownerId);
  if (!owner) return null;
  const settings = { ...owner.settings, ...patch };
  getDb().prepare("UPDATE owners SET settings = ? WHERE id = ?").run(JSON.stringify(settings), ownerId);
  return settings;
}

function parseJson<T>(v: unknown, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
}

function parseMoodLayout(raw: unknown): MoodLayout | null {
  const parsed = parseJson<Record<string, unknown> | null>(raw, null);
  if (!parsed || typeof parsed !== "object") return null;
  const x = Number(parsed.x);
  const y = Number(parsed.y);
  const w = Number(parsed.w);
  const h = Number(parsed.h);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
}

export function listTags(ownerId: string): Tag[] {
  return getDb()
    .prepare("SELECT * FROM tags WHERE owner_device_id = ? ORDER BY name")
    .all(ownerId)
    .map(mapTag);
}

function mapTag(row: Record<string, unknown>): Tag {
  return {
    id: String(row.id),
    ownerDeviceId: String(row.owner_device_id),
    name: String(row.name),
    color: String(row.color),
  };
}

function shareForList(listId: string): ShareLink | null {
  const row = getDb().prepare("SELECT * FROM share_links WHERE list_id = ?").get(listId);
  if (!row) return null;
  return {
    id: String(row.id),
    listId: String(row.list_id),
    token: String(row.token),
    permission: row.permission as ShareLink["permission"],
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  };
}

function mapList(row: Record<string, unknown>): PetalList {
  return {
    id: String(row.id),
    ownerDeviceId: String(row.owner_device_id),
    title: String(row.title),
    emoji: String(row.emoji),
    color: String(row.color),
    coverImage: row.cover_image ? String(row.cover_image) : null,
    coverStyle: row.cover_style as PetalList["coverStyle"],
    type: row.type as PetalList["type"],
    description: row.description ? String(row.description) : null,
    isPinned: Boolean(row.is_pinned),
    fontStyle: (row.font_style as PetalList["fontStyle"]) || "sans",
    budgetTarget: row.budget_target == null ? null : Number(row.budget_target),
    currency: String(row.currency || "USD"),
    position: Number(row.position),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    share: shareForList(String(row.id)),
  };
}

export function listSummaries(ownerId: string): PetalList[] {
  return getDb()
    .prepare(
      "SELECT * FROM lists WHERE owner_device_id = ? ORDER BY is_pinned DESC, position ASC, updated_at DESC",
    )
    .all(ownerId)
    .map(mapList);
}

function itemTags(itemId: string): Tag[] {
  return getDb()
    .prepare(
      `SELECT t.* FROM tags t JOIN item_tags it ON it.tag_id = t.id WHERE it.item_id = ? ORDER BY t.name`,
    )
    .all(itemId)
    .map(mapTag);
}

function itemAttachments(itemId: string, sharedOnly = false): Attachment[] {
  const sql = sharedOnly
    ? "SELECT * FROM attachments WHERE item_id = ? AND is_shared = 1 ORDER BY position, uploaded_at"
    : "SELECT * FROM attachments WHERE item_id = ? ORDER BY position, uploaded_at";
  return getDb()
    .prepare(sql)
    .all(itemId)
    .map((row) => ({
      id: String(row.id),
      itemId: String(row.item_id),
      type: row.type as Attachment["type"],
      fileUrl: String(row.file_url),
      thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
      filename: row.filename ? String(row.filename) : null,
      altText: row.alt_text ? String(row.alt_text) : null,
      isShared: Boolean(row.is_shared),
      position: Number(row.position),
      uploadedAt: String(row.uploaded_at),
    }));
}

function mapItem(row: Record<string, unknown>, opts?: { hidePrivate?: boolean; sharedOnly?: boolean }): ListItem {
  return {
    id: String(row.id),
    listId: String(row.list_id),
    title: String(row.title),
    emoji: row.emoji ? String(row.emoji) : null,
    notes: row.notes ? String(row.notes) : null,
    privateNotes: opts?.hidePrivate ? null : row.private_notes ? String(row.private_notes) : null,
    completed: Boolean(row.completed),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    targetDate: row.target_date ? String(row.target_date) : null,
    targetMonth: row.target_month ? String(row.target_month) : null,
    season: row.season ? String(row.season) : null,
    priority: (row.priority as ListItem["priority"]) || null,
    tags: itemTags(String(row.id)),
    position: Number(row.position),
    price: row.price == null ? null : Number(row.price),
    currency: row.currency ? String(row.currency) : null,
    store: row.store ? String(row.store) : null,
    productUrl: row.product_url ? String(row.product_url) : null,
    purchased: Boolean(row.purchased),
    hiddenFromMoodBoard: Boolean(row.hidden_from_mood),
    moodOrder: Number(row.mood_order),
    moodLayout: parseMoodLayout(row.mood_layout),
    importedMetadata: parseJson(row.imported_metadata, null),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    attachments: itemAttachments(String(row.id), opts?.sharedOnly),
  };
}

export function getList(listId: string, opts?: { hidePrivate?: boolean; sharedOnly?: boolean }) {
  const row = getDb().prepare("SELECT * FROM lists WHERE id = ?").get(listId);
  if (!row) return null;
  const list = mapList(row);
  list.items = getDb()
    .prepare("SELECT * FROM items WHERE list_id = ? ORDER BY position ASC, created_at ASC")
    .all(listId)
    .map((r) => mapItem(r, opts));
  list.generalItemOrder = getDb()
    .prepare("SELECT item_id FROM general_item_order WHERE general_list_id = ? ORDER BY position ASC")
    .all(listId)
    .map((row) => String(row.item_id));
  return list;
}

export function searchOwner(ownerId: string, q: string) {
  const like = `%${q.toLowerCase()}%`;
  const lists = getDb()
    .prepare(
      `SELECT DISTINCT l.id FROM lists l
       LEFT JOIN items i ON i.list_id = l.id
       LEFT JOIN item_tags it ON it.item_id = i.id
       LEFT JOIN tags t ON t.id = it.tag_id
       WHERE l.owner_device_id = ? AND (
         lower(l.title) LIKE ? OR lower(coalesce(l.description,'')) LIKE ?
         OR lower(i.title) LIKE ? OR lower(coalesce(i.notes,'')) LIKE ?
         OR lower(coalesce(i.store,'')) LIKE ? OR lower(coalesce(i.product_url,'')) LIKE ?
         OR lower(coalesce(t.name,'')) LIKE ?
       )`,
    )
    .all(ownerId, like, like, like, like, like, like, like)
    .map((r) => String(r.id));
  return lists;
}

export function createList(
  ownerId: string,
  input: Partial<PetalList> & { title: string },
) {
  const d = getDb();
  const listId = id();
  const ts = now();
  const pos = Number(d.prepare("SELECT COALESCE(MAX(position),0)+1 AS p FROM lists WHERE owner_device_id = ?").get(ownerId)?.p || 1);
  d.prepare(
    `INSERT INTO lists (id, owner_device_id, title, emoji, color, cover_image, cover_style, type, description, is_pinned, font_style, budget_target, currency, position, created_at, updated_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    listId,
    ownerId,
    input.title,
    input.emoji || "🌸",
    input.color || "#FFD6E0",
    input.coverImage || null,
    input.coverStyle || "solid",
    input.type || "custom",
    input.description || null,
    input.isPinned ? 1 : 0,
    input.fontStyle || "sans",
    input.budgetTarget ?? null,
    input.currency || "USD",
    pos,
    ts,
    ts,
  );
  log(listId, "owner", null, "list_created", listId, input.title);
  snapshot(listId, "Created");
  return getList(listId);
}

export function updateList(listId: string, patch: Record<string, unknown>) {
  const current = getDb().prepare("SELECT * FROM lists WHERE id = ?").get(listId);
  if (!current) return null;
  const map: Record<string, string> = {
    title: "title",
    emoji: "emoji",
    color: "color",
    coverImage: "cover_image",
    coverStyle: "cover_style",
    type: "type",
    description: "description",
    isPinned: "is_pinned",
    fontStyle: "font_style",
    budgetTarget: "budget_target",
    currency: "currency",
    position: "position",
    archivedAt: "archived_at",
  };
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [now()];
  for (const [k, col] of Object.entries(map)) {
    if (k in patch) {
      sets.push(`${col} = ?`);
      const v = patch[k];
      vals.push(typeof v === "boolean" ? (v ? 1 : 0) : v);
    }
  }
  vals.push(listId);
  getDb().prepare(`UPDATE lists SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getList(listId);
}

export function deleteList(listId: string) {
  snapshot(listId, "Before delete");
  getDb().prepare("DELETE FROM lists WHERE id = ?").run(listId);
}

export function duplicateList(listId: string, ownerId: string, title?: string) {
  const src = getList(listId);
  if (!src) return null;
  const copy = createList(ownerId, {
    ...src,
    title: title || `${src.title} (again)`,
    isPinned: false,
    archivedAt: null,
  });
  if (!copy) return null;
  for (const item of src.items || []) {
    const created = createItem(copy.id, { ...item, completed: false, completedAt: null, purchased: false }, "owner", null);
    if (created) {
      for (const a of item.attachments) {
        addAttachment(created.id, { ...a, id: undefined });
      }
    }
  }
  return getList(copy.id);
}

export function reorderLists(ownerId: string, ids: string[]) {
  ids.forEach((listId, i) => {
    getDb().prepare("UPDATE lists SET position = ? WHERE id = ? AND owner_device_id = ?").run(i, listId, ownerId);
  });
}

export function createItem(
  listId: string,
  input: Partial<ListItem> & { title: string },
  actor: "owner" | "guest" = "owner",
  guestName: string | null = null,
) {
  const d = getDb();
  const itemId = id();
  const ts = now();
  // New items land at the top of the list unless a position is explicitly provided (e.g. undo).
  let pos = input.position;
  if (pos == null) {
    d.prepare("UPDATE items SET position = position + 1 WHERE list_id = ?").run(listId);
    pos = 0;
  }
  const mood = Number(d.prepare("SELECT COALESCE(MAX(mood_order),0)+1 AS p FROM items WHERE list_id = ?").get(listId)?.p || 1);
  d.prepare(
    `INSERT INTO items (id, list_id, title, emoji, notes, private_notes, completed, completed_at, target_date, target_month, season, priority, position, price, currency, store, product_url, purchased, hidden_from_mood, mood_order, mood_layout, imported_metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemId,
    listId,
    input.title,
    input.emoji || null,
    input.notes || null,
    input.privateNotes || null,
    input.completed ? 1 : 0,
    input.completedAt || null,
    input.targetDate || null,
    input.targetMonth || null,
    input.season || null,
    input.priority || null,
    pos,
    input.price ?? null,
    input.currency || null,
    input.store || null,
    input.productUrl || null,
    input.purchased ? 1 : 0,
    input.hiddenFromMoodBoard ? 1 : 0,
    input.moodOrder ?? mood,
    input.moodLayout ? JSON.stringify(input.moodLayout) : null,
    input.importedMetadata ? JSON.stringify(input.importedMetadata) : null,
    ts,
    ts,
  );
  if (input.tags?.length) {
    for (const t of input.tags) setItemTag(itemId, t.id, true);
  }
  const image = input.importedMetadata && typeof input.importedMetadata.image === "string" ? input.importedMetadata.image : "";
  if (image && !(input.attachments && input.attachments.length)) {
    addAttachment(itemId, { type: "image", fileUrl: image, filename: input.title, altText: input.title });
  }
  log(listId, actor, guestName, "item_added", itemId, input.title);
  snapshot(listId, "Item added");
  touchList(listId);
  return getItem(itemId);
}

export function getItem(itemId: string, opts?: { hidePrivate?: boolean; sharedOnly?: boolean }) {
  const row = getDb().prepare("SELECT * FROM items WHERE id = ?").get(itemId);
  if (!row) return null;
  return mapItem(row, opts);
}

export function updateItem(
  itemId: string,
  patch: Record<string, unknown>,
  actor: "owner" | "guest" = "owner",
  guestName: string | null = null,
) {
  const current = getDb().prepare("SELECT * FROM items WHERE id = ?").get(itemId);
  if (!current) return null;
  const map: Record<string, string> = {
    title: "title",
    emoji: "emoji",
    notes: "notes",
    privateNotes: "private_notes",
    completed: "completed",
    completedAt: "completed_at",
    targetDate: "target_date",
    targetMonth: "target_month",
    season: "season",
    priority: "priority",
    position: "position",
    price: "price",
    currency: "currency",
    store: "store",
    productUrl: "product_url",
    purchased: "purchased",
    hiddenFromMoodBoard: "hidden_from_mood",
    moodOrder: "mood_order",
    moodLayout: "mood_layout",
    importedMetadata: "imported_metadata",
  };
  if (patch.completed === true && !current.completed) {
    patch.completedAt = now();
  }
  if (patch.completed === false) {
    patch.completedAt = null;
  }
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [now()];
  const oldListId = String(current.list_id);
  let nextListId = oldListId;
  if (typeof patch.listId === "string" && patch.listId && patch.listId !== oldListId) {
    nextListId = patch.listId;
    const pos = Number(getDb().prepare("SELECT COALESCE(MAX(position),0)+1 AS p FROM items WHERE list_id = ?").get(nextListId)?.p || 1);
    const mood = Number(getDb().prepare("SELECT COALESCE(MAX(mood_order),0)+1 AS p FROM items WHERE list_id = ?").get(nextListId)?.p || 1);
    sets.push("list_id = ?", "position = ?", "mood_order = ?");
    vals.push(nextListId, pos, mood);
  }
  for (const [k, col] of Object.entries(map)) {
    if (k in patch) {
      sets.push(`${col} = ?`);
      let v = patch[k];
      if (k === "importedMetadata" || k === "moodLayout") v = v ? JSON.stringify(v) : null;
      if (typeof v === "boolean") v = v ? 1 : 0;
      vals.push(v);
    }
  }
  vals.push(itemId);
  getDb().prepare(`UPDATE items SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  if (Array.isArray(patch.tagIds)) {
    getDb().prepare("DELETE FROM item_tags WHERE item_id = ?").run(itemId);
    for (const tagId of patch.tagIds as string[]) setItemTag(itemId, tagId, true);
  }
  const action = patch.completed === true ? "item_completed" : "item_edited";
  log(oldListId, actor, guestName, action, itemId, String(patch.title || current.title));
  snapshot(oldListId, "Item updated");
  touchList(oldListId);
  if (nextListId !== oldListId) touchList(nextListId);
  return getItem(itemId);
}

export function deleteItem(itemId: string, actor: "owner" | "guest" = "owner", guestName: string | null = null) {
  const current = getDb().prepare("SELECT * FROM items WHERE id = ?").get(itemId);
  if (!current) return;
  snapshot(String(current.list_id), "Before item removed");
  getDb().prepare("DELETE FROM item_tags WHERE item_id = ?").run(itemId);
  getDb().prepare("DELETE FROM attachments WHERE item_id = ?").run(itemId);
  getDb().prepare("DELETE FROM items WHERE id = ?").run(itemId);
  log(String(current.list_id), actor, guestName, "item_removed", itemId, String(current.title));
  touchList(String(current.list_id));
}

export function reorderItems(listId: string, ids: string[], actor: "owner" | "guest" = "owner", guestName: string | null = null) {
  ids.forEach((itemId, i) => {
    getDb().prepare("UPDATE items SET position = ? WHERE id = ? AND list_id = ?").run(i, itemId, listId);
  });
  log(listId, actor, guestName, "item_reordered", null, null);
  touchList(listId);
}

export function reorderGeneralItems(generalListId: string, ownerId: string, ids: string[]) {
  const d = getDb();
  const ownedItemIds = new Set(
    d
      .prepare("SELECT i.id FROM items i JOIN lists l ON l.id = i.list_id WHERE l.owner_device_id = ?")
      .all(ownerId)
      .map((row) => String(row.id)),
  );
  if (ids.some((itemId) => !ownedItemIds.has(itemId))) throw new Error("We couldn’t save that order.");

  d.prepare("DELETE FROM general_item_order WHERE general_list_id = ?").run(generalListId);
  const insert = d.prepare("INSERT INTO general_item_order (general_list_id, item_id, position) VALUES (?, ?, ?)");
  ids.forEach((itemId, position) => insert.run(generalListId, itemId, position));
  log(generalListId, "owner", null, "bucket_items_reordered", null, null);
  touchList(generalListId);
}

export function reorderMood(listId: string, ids: string[]) {
  ids.forEach((itemId, i) => {
    getDb().prepare("UPDATE items SET mood_order = ? WHERE id = ? AND list_id = ?").run(i, itemId, listId);
  });
  touchList(listId);
}

export function setItemTag(itemId: string, tagId: string, on: boolean) {
  if (on) {
    getDb().prepare("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)").run(itemId, tagId);
  } else {
    getDb().prepare("DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?").run(itemId, tagId);
  }
}

export function createTag(ownerId: string, name: string, color: string) {
  const tagId = id();
  getDb().prepare("INSERT INTO tags (id, owner_device_id, name, color) VALUES (?, ?, ?, ?)").run(tagId, ownerId, name, color);
  return listTags(ownerId).find((t) => t.id === tagId)!;
}

export function updateTag(tagId: string, patch: { name?: string; color?: string }) {
  const row = getDb().prepare("SELECT * FROM tags WHERE id = ?").get(tagId);
  if (!row) return;
  getDb()
    .prepare("UPDATE tags SET name = ?, color = ? WHERE id = ?")
    .run(patch.name ?? row.name, patch.color ?? row.color, tagId);
}

export function deleteTag(tagId: string) {
  getDb().prepare("DELETE FROM item_tags WHERE tag_id = ?").run(tagId);
  getDb().prepare("DELETE FROM tags WHERE id = ?").run(tagId);
}

export function addAttachment(itemId: string, input: Partial<Attachment> & { fileUrl: string; type: Attachment["type"] }) {
  const attId = id();
  getDb()
    .prepare(
      `INSERT INTO attachments (id, item_id, type, file_url, thumbnail_url, filename, alt_text, is_shared, position, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      attId,
      itemId,
      input.type,
      input.fileUrl,
      input.thumbnailUrl || null,
      input.filename || null,
      input.altText || null,
      input.isShared === false ? 0 : 1,
      input.position ?? 0,
      now(),
    );
  const item = getDb().prepare("SELECT list_id FROM items WHERE id = ?").get(itemId);
  if (item) log(String(item.list_id), "owner", null, "attachment_added", itemId, input.filename || input.fileUrl);
  return itemAttachments(itemId);
}

export function updateAttachment(idVal: string, patch: { isShared?: boolean; altText?: string }) {
  const row = getDb().prepare("SELECT * FROM attachments WHERE id = ?").get(idVal);
  if (!row) return;
  getDb()
    .prepare("UPDATE attachments SET is_shared = ?, alt_text = ? WHERE id = ?")
    .run(patch.isShared == null ? row.is_shared : patch.isShared ? 1 : 0, patch.altText ?? row.alt_text, idVal);
}

export function deleteAttachment(idVal: string) {
  getDb().prepare("DELETE FROM attachments WHERE id = ?").run(idVal);
}

export function listCaptures(ownerId: string): QuickCapture[] {
  return getDb()
    .prepare("SELECT * FROM captures WHERE owner_device_id = ? ORDER BY created_at DESC")
    .all(ownerId)
    .map((row) => ({
      id: String(row.id),
      ownerDeviceId: String(row.owner_device_id),
      type: row.type as QuickCapture["type"],
      content: String(row.content),
      attachmentUrl: row.attachment_url ? String(row.attachment_url) : null,
      importedMetadata: parseJson(row.imported_metadata, null),
      createdAt: String(row.created_at),
    }));
}

export function createCapture(ownerId: string, input: Omit<QuickCapture, "id" | "ownerDeviceId" | "createdAt">) {
  const capId = id();
  getDb()
    .prepare(
      `INSERT INTO captures (id, owner_device_id, type, content, attachment_url, imported_metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(capId, ownerId, input.type, input.content, input.attachmentUrl, input.importedMetadata ? JSON.stringify(input.importedMetadata) : null, now());
  return listCaptures(ownerId).find((c) => c.id === capId)!;
}

export function updateCapture(captureId: string, patch: Pick<QuickCapture, "content" | "importedMetadata">) {
  const current = getDb().prepare("SELECT * FROM captures WHERE id = ?").get(captureId) as Record<string, unknown> | undefined;
  if (!current) return;
  getDb()
    .prepare("UPDATE captures SET content = ?, imported_metadata = ? WHERE id = ?")
    .run(patch.content, patch.importedMetadata ? JSON.stringify(patch.importedMetadata) : null, captureId);
  return listCaptures(String(current.owner_device_id)).find((capture) => capture.id === captureId);
}

export function deleteCapture(idVal: string) {
  getDb().prepare("DELETE FROM captures WHERE id = ?").run(idVal);
}

export function upsertShare(listId: string, permission: ShareLink["permission"], regenerate = false) {
  const existing = shareForList(listId);
  if (existing && !regenerate) {
    getDb().prepare("UPDATE share_links SET permission = ?, active = 1 WHERE id = ?").run(permission, existing.id);
  } else {
    if (existing) getDb().prepare("DELETE FROM share_links WHERE id = ?").run(existing.id);
    getDb()
      .prepare("INSERT INTO share_links (id, list_id, token, permission, active, created_at) VALUES (?, ?, ?, ?, 1, ?)")
      .run(id(), listId, token(), permission, now());
  }
  touchList(listId);
  return shareForList(listId);
}

export function disableShare(listId: string) {
  getDb().prepare("UPDATE share_links SET active = 0 WHERE list_id = ?").run(listId);
  return shareForList(listId);
}

export function shareByToken(tok: string) {
  const row = getDb().prepare("SELECT * FROM share_links WHERE token = ? AND active = 1").get(tok);
  if (!row) return null;
  return {
    id: String(row.id),
    listId: String(row.list_id),
    token: String(row.token),
    permission: row.permission as ShareLink["permission"],
    active: true,
    createdAt: String(row.created_at),
  };
}

export function activityFor(listId: string): ActivityLog[] {
  return getDb()
    .prepare("SELECT * FROM activity WHERE list_id = ? ORDER BY timestamp DESC LIMIT 80")
    .all(listId)
    .map((row) => ({
      id: String(row.id),
      listId: String(row.list_id),
      actorType: row.actor_type as ActivityLog["actorType"],
      guestName: row.guest_name ? String(row.guest_name) : null,
      action: String(row.action),
      entityId: row.entity_id ? String(row.entity_id) : null,
      detail: row.detail ? String(row.detail) : null,
      timestamp: String(row.timestamp),
    }));
}

export function versionsFor(listId: string): ListVersion[] {
  return getDb()
    .prepare("SELECT id, list_id, label, created_at FROM versions WHERE list_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(listId)
    .map((row) => ({
      id: String(row.id),
      listId: String(row.list_id),
      label: String(row.label),
      createdAt: String(row.created_at),
    }));
}

export function restoreVersion(versionId: string) {
  const row = getDb().prepare("SELECT * FROM versions WHERE id = ?").get(versionId);
  if (!row) return null;
  const listId = String(row.list_id);
  const snap = parseJson<{ items: ListItem[] }>(row.snapshot, { items: [] });
  snapshot(listId, "Before restore");
  const items = getDb().prepare("SELECT id FROM items WHERE list_id = ?").all(listId);
  for (const it of items) {
    getDb().prepare("DELETE FROM item_tags WHERE item_id = ?").run(it.id);
    getDb().prepare("DELETE FROM attachments WHERE item_id = ?").run(it.id);
  }
  getDb().prepare("DELETE FROM items WHERE list_id = ?").run(listId);
  for (const item of snap.items || []) {
    const created = createItem(listId, { ...item, tags: [] }, "owner", null);
    if (!created) continue;
    if (item.tags) {
      for (const t of item.tags) setItemTag(created.id, t.id, true);
    }
    for (const a of item.attachments || []) addAttachment(created.id, a);
  }
  log(listId, "owner", null, "version_restored", versionId, String(row.label));
  return getList(listId);
}

export function exportList(listId: string) {
  return getList(listId);
}

function touchList(listId: string) {
  getDb().prepare("UPDATE lists SET updated_at = ? WHERE id = ?").run(now(), listId);
}

function log(
  listId: string,
  actorType: "owner" | "guest",
  guestName: string | null,
  action: string,
  entityId: string | null,
  detail: string | null,
) {
  getDb()
    .prepare(
      "INSERT INTO activity (id, list_id, actor_type, guest_name, action, entity_id, detail, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id(), listId, actorType, guestName, action, entityId, detail, now());
}

function snapshot(listId: string, label: string) {
  const list = getList(listId);
  if (!list) return;
  getDb()
    .prepare("INSERT INTO versions (id, list_id, label, snapshot, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id(), listId, label, JSON.stringify({ items: list.items || [] }), now());
  const extra = getDb()
    .prepare("SELECT id FROM versions WHERE list_id = ? ORDER BY created_at DESC")
    .all(listId)
    .slice(20);
  for (const v of extra) getDb().prepare("DELETE FROM versions WHERE id = ?").run(v.id);
}
