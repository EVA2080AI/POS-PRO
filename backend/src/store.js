const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'store.json');

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function withDb(fn) {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

module.exports = { readDb, writeDb, withDb };
