const Database = require('better-sqlite3');
const path = require('path');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    const dbPath = path.join(__dirname, '..', 'database', 'kards.db');
    dbInstance = new Database(dbPath);
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

module.exports = { getDb };