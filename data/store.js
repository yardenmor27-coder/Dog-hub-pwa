// Simple JSON-file persistence — no native modules, so it deploys anywhere.
// Data is now namespaced per device (per browser/phone), so different
// people using the app don't see or overwrite each other's dog, journal,
// or favorites.

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "db.json");

const DEFAULT_DB = { profiles: {} };

function emptyProfile() {
  return {
    dog: null, // { name, breed, age }
    journal: [],
    favorites: [],
    settings: { dogWeight: 20, region: "מרכז" },
    subscriptions: [],
    notified: [],
  };
}

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    if (!db.profiles) db.profiles = {};
    return db;
  } catch (e) {
    return { profiles: {} };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getProfile(db, deviceId) {
  if (!db.profiles[deviceId]) db.profiles[deviceId] = emptyProfile();
  return db.profiles[deviceId];
}

module.exports = { readDB, writeDB, getProfile };
