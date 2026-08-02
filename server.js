const express = require("express");
const path = require("path");
const webpush = require("web-push");
const { readDB, writeDB } = require("./data/store");
const { REGIONS, withPricingAndShipping } = require("./data/foods");

const app = express();
const PORT = process.env.PORT || 3000;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:example@example.com";

const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (pushConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn("VAPID keys not configured - run: npm run generate-vapid-keys");
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (req, res) => {
  res.json({ pushConfigured, vapidPublicKey: VAPID_PUBLIC_KEY || null, regions: REGIONS });
});

app.get("/api/food", (req, res) => {
  const weight = Number(req.query.weight) || 20;
  const region = req.query.region || "מרכז";
  res.json(withPricingAndShipping(weight, region));
});

app.get("/api/favorites", (req, res) => {
  const db = readDB();
  res.json(db.favorites);
});

app.post("/api/favorites/toggle", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "missing id" });
  const db = readDB();
  db.favorites = db.favorites.includes(id) ? db.favorites.filter((f) => f !== id) : [...db.favorites, id];
  writeDB(db);
  res.json(db.favorites);
});

app.post("/api/settings", (req, res) => {
  const { dogWeight, region } = req.body;
  const db = readDB();
  if (dogWeight) db.settings.dogWeight = Number(dogWeight);
  if (region) db.settings.region = region;
  writeDB(db);
  res.json(db.settings);
});

app.get("/api/settings", (req, res) => {
  const db = readDB();
  res.json(db.settings);
});

app.get("/api/journal", (req, res) => {
  const db = readDB();
  res.json(db.journal.sort((a, b) => (a.date < b.date ? 1 : -1)));
});

app.post("/api/journal", (req, res) => {
  const { type, note, date, reminderDate } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: "note is required" });
  const db = readDB();
  const entry = { id: Date.now().toString(), type: type || "walk", note: note.trim(), date: date || new Date().toISOString().slice(0, 10), reminderDate: reminderDate || null };
  db.journal.push(entry);
  writeDB(db);
  res.json(entry);
});

app.post("/api/subscribe", (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: "invalid subscription" });
  const db = readDB();
  const exists = db.subscriptions.some((s) => s.endpoint === subscription.endpoint);
  if (!exists) { db.subscriptions.push(subscription); writeDB(db); }
  res.json({ ok: true });
});

app.post("/api/unsubscribe", (req, res) => {
  const { endpoint } = req.body;
  const db = readDB();
  db.subscriptions = db.subscriptions.filter((s) => s.endpoint !== endpoint);
  writeDB(db);
  res.json({ ok: true });
});

app.post("/api/test-push", async (req, res) => {
  if (!pushConfigured) return res.status(400).json({ error: "VAPID keys not configured" });
  const db = readDB();
  const payload = JSON.stringify({ title: "דוג.האב", body: "זו התראת בדיקה" });
  const results = await Promise.allSettled(db.subscriptions.map((sub) => webpush.sendNotification(sub, payload)));
  res.json({ sent: results.filter((r) => r.status === "fulfilled").length, total: results.length });
});

async function checkReminders() {
  if (!pushConfigured) return;
  const db = readDB();
  const today = new Date().toISOString().slice(0, 10);
  const due = db.journal.filter((e) => e.reminderDate === today && !db.notified.includes(e.id));
  if (!due.length || !db.subscriptions.length) return;
  for (const entry of due) {
    const payload = JSON.stringify({ title: "תזכורת מדוג.האב", body: entry.note });
    await Promise.allSettled(db.subscriptions.map(async (sub) => {
      try { await webpush.sendNotification(sub, payload); } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.subscriptions = db.subscriptions.filter((s) => s.endpoint !== sub.endpoint);
        }
      }
    }));
    db.notified.push(entry.id);
  }
  writeDB(db);
}

setInterval(checkReminders, 5 * 60 * 1000);
checkReminders();

app.listen(PORT, () => {
  console.log("דוג.האב server running on port " + PORT);
});
