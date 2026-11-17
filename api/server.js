import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Заполни SUPABASE_URL и SUPABASE_ANON_KEY в api/.env");
  process.exit(1);
}
const app = express();
const port = Number(process.env.PORT || 3000);
const origin = process.env.WEB_ORIGIN || true;
app.use(cors({ origin }));
app.use(express.json({ limit: "32kb" }));

const base = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "../web")));

async function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Требуется вход в аккаунт" });
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Сессия недействительна" });
  const { data: profile, error: profileError } = await db
    .from("profiles").select("id,username,role,level,xp").eq("id", user.id).single();
  if (profileError || !profile) return res.status(403).json({ error: "Профиль не найден" });
  req.db = db;
  req.user = user;
  req.profile = profile;
  next();
}
const admin = (req, res, next) => {
  if (!["admin", "owner"].includes(req.profile.role))
    return res.status(403).json({ error: "Недостаточно прав" });
  next();
};

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "Frost Visuals", version: "1.0.0" }));

app.get("/api/me", auth, (req, res) => res.json({ user: req.user, profile: req.profile }));

// Mod sync endpoint: a signed-in player can read only their own latest profile.
app.get("/api/mod/config", auth, async (req, res) => {
  const { data, error } = await req.db.from("visual_profiles")
    .select("settings,updated_at").eq("user_id", req.user.id)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ username: req.profile.username, role: req.profile.role, settings: data?.settings || {} });
});

app.get("/api/profiles", auth, async (req, res) => {
  const { data, error } = await req.db.from("visual_profiles")
    .select("id,name,settings,created_at,updated_at").eq("user_id", req.user.id)
    .order("updated_at", { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ profiles: data || [] });
});
app.post("/api/profiles", auth, async (req, res) => {
  const name = String(req.body.name || "Мой профиль").trim().slice(0, 40);
  const settings = req.body.settings && typeof req.body.settings === "object" ? req.body.settings : {};
  const { data, error } = await req.db.from("visual_profiles")
    .insert({ user_id: req.user.id, name, settings }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ profile: data });
});
app.delete("/api/profiles/:id", auth, async (req, res) => {
  const { error } = await req.db.from("visual_profiles").delete()
    .eq("id", req.params.id).eq("user_id", req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

app.get("/api/news", async (_req, res) => {
  const { data, error } = await base.from("news").select("id,title,body,created_at")
    .eq("published", true).order("created_at", { ascending: false }).limit(20);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ news: data || [] });
});
app.get("/api/cosmetics", async (_req, res) => {
  const { data, error } = await base.from("cosmetics")
    .select("id,name,description,rarity,price_points,preview_emoji")
    .eq("active", true).order("price_points");
  if (error) return res.status(400).json({ error: error.message });
  res.json({ cosmetics: data || [] });
});

app.get("/api/admin/users", auth, admin, async (req, res) => {
  const { data, error } = await req.db.from("profiles")
    .select("id,username,role,level,xp,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ users: data || [] });
});
app.patch("/api/admin/users/:id/role", auth, admin, async (req, res) => {
  const role = String(req.body.role || "");
  if (!["player", "admin"].includes(role))
    return res.status(400).json({ error: "Разрешены роли player и admin. Owner назначается вручную." });
  if (req.params.id === req.user.id && req.profile.role === "owner")
    return res.status(400).json({ error: "Нельзя менять собственную роль Owner через этот маршрут." });
  const { data, error } = await req.db.from("profiles").update({ role })
    .eq("id", req.params.id).select("id,username,role").single();
  if (error) return res.status(400).json({ error: error.message });
  await req.db.from("audit_logs").insert({
    actor_id: req.user.id, action: "role_changed", target_id: req.params.id, details: { role }
  });
  res.json({ user: data });
});
app.post("/api/admin/news", auth, admin, async (req, res) => {
  const title = String(req.body.title || "").trim().slice(0, 100);
  const body = String(req.body.body || "").trim().slice(0, 5000);
  if (!title || !body) return res.status(400).json({ error: "Заполни заголовок и текст" });
  const { data, error } = await req.db.from("news")
    .insert({ title, body, author_id: req.user.id, published: true }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ news: data });
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../web/index.html")));
app.listen(port, "0.0.0.0", () => console.log(`Frost Visuals запущен: http://127.0.0.1:${port}`));
