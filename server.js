const express = require("express");
const path = require("path");
const webpush = require("web-push");
const { readDB, writeDB, getProfile } = require("./data/store");
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

function requireDevice(req, res, next) {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId || typeof deviceId !== "string") {
    return res.status(400).json({ error: "missing X-Device-Id header" });
  }
  req.deviceId = deviceId;
  next();
}

app.get("/api/config", (req, res) => {
  res.json({ pushConfigured, vapidPublicKey: VAPID_PUBLIC_KEY || null, regions: REGIONS });
});

app.get("/api/profile", requireDevice, (req, res) => {
  const db = readDB();
  const profile = getProfile(db, req.deviceId);
  res.json(profile.dog);
});

app.post("/api/profile", requireDevice, (req, res) => {
  const { name, breed, age } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });
  const db = readDB();
  const profile = getProfile(db, req.deviceId);
  profile.dog = { name: name.trim(), breed: (breed || "").trim(), age: (age || "").trim() };
  writeDB(db);
  res.json(profile.dog);
});

app.get("/api/food", (req, res) => {
  const weight = Number(req.query.weight) || 20;
  const region = req.query.region || "מרכז";
  res.json(withPricingAndShipping(weight, region));
});

app.get("/api/favorites", requireDevice, (req, res) => {
  const db = readDB();
  res.json(getProfile(db, req.deviceId).favorites);
});

app.post("/api/favorites/toggle", requireDevice, (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "missing id" });
  const db = readDB();
  const profile = getProfile(db, req.deviceId);
  profile.favorites = profile.favorites.includes(id)
    ? profile.favorites.filter((f) => f !== id)
    : [...profile.favorites, id];
  writeDB(db);
  res.json(profile.favorites);
});

app.post("/api/settings", requireDevice, (req, res) => {
  const { dogWeight, region } = req.body;
  const db = readDB();
  const profile = getProfile(db, req.deviceId);
  if (dogWeight) profile.settings.dogWeight = Number(dogWeight);
  if (region) profile.settings.region = region;
  writeDB(db);
  res.json(profile.settings);
});

app.get("/api/settings", requireDevice, (req, res) => {
  const db = readDB();
  res.json(getProfile(db, req.deviceId).settings);
});

app.post("/api/ai-recommend", requireDevice, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "אין מפתח API מוגדר בשרת. יש להוסיף ANTHROPIC_API_KEY במשתני הסביבה." });
  }
  const { weight, dogSize, priorities } = req.body;
  const foods = withPricingAndShipping(Number(weight) || 20, "מרכז");
  const foodList = foods
    .map((f) => "- " + f.id + " | " + f.brand + " " + f.line + " | גודל: " + f.size + " | דרג: " + f.tier + " | ₪" + f.pricePerKg + '/ק"ג | ' + f.fact)
    .join("\n");
  const systemPrompt =
    "אתה עוזר תזונה לכלבים בתוך אפליקציה ישראלית. תפקידך להמליץ על 2-3 מוצרי אוכל *רק* מתוך הרשימה שתקבל. ענה בעברית, קצר וברור (עד כ-120 מילים).";
  const userPrompt =
    'פרופיל הכלב: משקל ' +
    (weight || "לא צויין") +
    ' ק"ג, גודל גזע: ' +
    (dogSize || "לא צויין") +
    ".\nמה חשוב לבעל הכלב: " +
    (priorities && priorities.trim() ? priorities.trim() : "איזון בין מחיר לאיכות") +
    ".\n\nרשימת המוצרים:\n" +
    foodList;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 500, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
    });
    if (!response.ok) {
      return res.status(502).json({ error: "קריאה ל-API של Anthropic נכשלה." });
    }
    const data = await response.json();
    const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
    res.json({ recommendation: text || "לא התקבלה תשובה." });
  } catch (err) {
    res.status(500).json({ error: "שגיאה בשרת בעת קריאה ל-AI." });
  }
});

app.get("/api/journal", requireDevice, (req, res) => {
  const db = readDB();
  const profile = getProfile(db, req.deviceId);
  res.json(profile.journal.sort((a, b) => (a.date < b.date ? 1 : -1)));
});

app.post("/api/journal", requireDevice, (req, res) => {
  const { type, note, date, reminderDate } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: "note is required" });
  const db = readDB();
  const profile = getProfile(db, req.deviceId);
  const entry = {
    id: Date.now().toString(),
    type: type || "walk",
    note: note.trim(),
    date: date || new Date().toISOString().slice(0, 10),
    reminderDate: reminderDate || null,
  };
  profile.journal.push(entry);
  writeDB(db);
  res.json(entry);
});

app.post("/api/subscribe", requireDevice, (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: "invalid subscription" });
  const db = readDB();
  const profile = getProfile(db, req.deviceId);
  const exists = profile.subscriptions.some((s) => s.endpoint === subscription.endpoint);
  if (!exists) {
    profile.subscriptions.push(subscription);
    writeDB(db);
  }
  res.json({ ok: true });
});

app.post("/api/unsubscribe", requireDevice, (req, res) => {
  const { endpoint } = req.body;
  const db = readDB();
  const profile = getProfile(db, req.deviceId);
  profile.subscriptions = profile.subscriptions.filter((s) => s.endpoint !== endpoint);
  writeDB(db);
  res.json({ ok: true });
});

app.post("/api/test-push", requireDevice, async (req, res) => {
  if (!pushConfigured) return res.status(400).json({ error: "VAPID keys not configured" });
  const db = readDB();
  const profile = getProfile(db, req.deviceId);
  const payload = JSON.stringify({ title: "דוג.האב", body: "זו התראת בדיקה" });
  const results = await Promise.allSettled(profile.subscriptions.map((sub) => webpush.sendNotification(sub, payload)));
  res.json({ sent: results.filter((r) => r.status === "fulfilled").length, total: results.length });
});

async function checkReminders() {
  if (!pushConfigured) return;
  const db = readDB();
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;

  for (const deviceId of Object.keys(db.profiles)) {
    const profile = db.profiles[deviceId];
    const due = profile.journal.filter((e) => e.reminderDate === today && !profile.notified.includes(e.id));
    if (!due.length || !profile.subscriptions.length) continue;

    for (const entry of due) {
      const payload = JSON.stringify({ title: "תזכורת מדוג.האב", body: entry.note });
      await Promise.allSettled(
        profile.subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(sub, payload);
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              profile.subscriptions = profile.subscriptions.filter((s) => s.endpoint !== sub.endpoint);
            }
          }
        })
      );
      profile.notified.push(entry.id);
      changed = true;
    }
  }
  if (changed) writeDB(db);
}

setInterval(checkReminders, 5 * 60 * 1000);
checkReminders();

app.listen(PORT, () => {
  console.log("דוג.האב server running on port " + PORT);
});
