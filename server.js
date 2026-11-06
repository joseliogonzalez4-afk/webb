const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { admins: [], emulators: [], steam: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
let db = loadDB();

async function seedAdmin() {
  if (db.admins.length === 0) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      console.warn("No ADMIN_PASSWORD set. Set it in environment variables to create the first admin.");
      return;
    }
    db.admins.push({
      id: Date.now().toString(),
      username,
      passwordHash: await bcrypt.hash(password, 12),
      createdAt: new Date().toISOString()
    });
    saveDB(db);
    console.log(`Initial admin created: ${username}`);
  }
}
seedAdmin();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "cloudzone.sid",
  secret: process.env.SESSION_SECRET || "dev-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));
app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: "يجب تسجيل الدخول أولاً." });
  const admin = db.admins.find(a => a.id === req.session.adminId);
  if (!admin) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "جلسة غير صالحة." });
  }
  req.admin = admin;
  next();
}
function clean(value, max=500) {
  return String(value || "").trim().slice(0, max);
}
function publicAdmin(a) {
  return { id: a.id, username: a.username, createdAt: a.createdAt };
}

app.get("/api/public", (req, res) => {
  res.json({
    emulators: db.emulators,
    steam: db.steam
  });
});
app.get("/api/session", (req, res) => {
  const a = db.admins.find(x => x.id === req.session.adminId);
  res.json({ loggedIn: !!a, admin: a ? publicAdmin(a) : null });
});
app.post("/api/login", async (req, res) => {
  const username = clean(req.body.username, 80);
  const password = String(req.body.password || "");
  const admin = db.admins.find(a => a.username.toLowerCase() === username.toLowerCase());
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "تعذر بدء الجلسة." });
    req.session.adminId = admin.id;
    res.json({ ok: true, admin: publicAdmin(admin) });
  });
});
app.post("/api/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/data", requireAdmin, (req, res) => {
  res.json({
    emulators: db.emulators,
    steam: db.steam,
    admins: db.admins.map(publicAdmin),
    currentAdmin: publicAdmin(req.admin)
  });
});

app.post("/api/admin/emulators", requireAdmin, (req, res) => {
  const item = {
    id: Date.now().toString(),
    name: clean(req.body.name, 100),
    description: clean(req.body.description, 500),
    version: clean(req.body.version, 40),
    image: clean(req.body.image, 1000),
    downloadUrl: clean(req.body.downloadUrl, 1000),
    createdAt: new Date().toISOString()
  };
  if (!item.name) return res.status(400).json({ error: "اسم المحاكي مطلوب." });
  db.emulators.unshift(item); saveDB(db); res.json(item);
});
app.put("/api/admin/emulators/:id", requireAdmin, (req, res) => {
  const item = db.emulators.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: "المحاكي غير موجود." });
  for (const key of ["name","description","version","image","downloadUrl"]) {
    item[key] = clean(req.body[key], key === "description" ? 500 : 1000);
  }
  if (!item.name) return res.status(400).json({ error: "اسم المحاكي مطلوب." });
  saveDB(db); res.json(item);
});
app.delete("/api/admin/emulators/:id", requireAdmin, (req, res) => {
  db.emulators = db.emulators.filter(x => x.id !== req.params.id);
  saveDB(db); res.json({ ok: true });
});

app.post("/api/admin/steam", requireAdmin, (req, res) => {
  const item = {
    id: Date.now().toString(),
    title: clean(req.body.title, 100),
    games: clean(req.body.games, 500),
    description: clean(req.body.description, 500),
    image: clean(req.body.image, 1000),
    profileUrl: clean(req.body.profileUrl, 1000),
    status: clean(req.body.status, 30) || "متاح",
    createdAt: new Date().toISOString()
  };
  if (!item.title) return res.status(400).json({ error: "عنوان الحساب مطلوب." });
  db.steam.unshift(item); saveDB(db); res.json(item);
});
app.put("/api/admin/steam/:id", requireAdmin, (req, res) => {
  const item = db.steam.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: "العنصر غير موجود." });
  for (const key of ["title","games","description","image","profileUrl","status"]) {
    item[key] = clean(req.body[key], 1000);
  }
  if (!item.title) return res.status(400).json({ error: "عنوان الحساب مطلوب." });
  saveDB(db); res.json(item);
});
app.delete("/api/admin/steam/:id", requireAdmin, (req, res) => {
  db.steam = db.steam.filter(x => x.id !== req.params.id);
  saveDB(db); res.json({ ok: true });
});

// Multi-admin: only an authenticated admin can add/remove another admin.
app.post("/api/admin/admins", requireAdmin, async (req, res) => {
  const username = clean(req.body.username, 80);
  const password = String(req.body.password || "");
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: "اسم المستخدم: 3 إلى 32 حرفًا/رقمًا أو . _ -" });
  }
  if (password.length < 10) return res.status(400).json({ error: "كلمة المرور يجب أن تكون 10 أحرف على الأقل." });
  if (db.admins.some(a => a.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل." });
  }
  const admin = { id: Date.now().toString(), username, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() };
  db.admins.push(admin); saveDB(db); res.json(publicAdmin(admin));
});
app.delete("/api/admin/admins/:id", requireAdmin, (req, res) => {
  if (req.params.id === req.session.adminId) return res.status(400).json({ error: "لا يمكنك حذف حسابك الحالي." });
  if (db.admins.length <= 1) return res.status(400).json({ error: "يجب أن يبقى Admin واحد على الأقل." });
  db.admins = db.admins.filter(a => a.id !== req.params.id);
  saveDB(db); res.json({ ok: true });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`Cloud Zone running on port ${PORT}`));
