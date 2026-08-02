// Simple JSON-file persistence — no native modules, so it deploys anywhere.
// NOTE: on most free hosting tiers the filesystem is ephemeral and resets on
// redeploy/restart. This is fine for a prototype; swap in a real database
// (e.g. a free Postgres from Render/Neon) once you're ready to go further.

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "db.json");

const DEFAULT_DB = {
  journal: [],
  favorites: [],
  subscriptions: [],
  notified: [],
  settings: { dogWeight: 20, region: "מרכז" },
};

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (e) {
    return { ...DEFAULT_DB };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDB, writeDB };
