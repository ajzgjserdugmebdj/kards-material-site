const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'kards.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// 检查 proposals 表是否存在
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='proposals'").get();
if (!tableCheck) {
  db.exec(`
    CREATE TABLE proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      visitor_ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    );
  `);
  console.log('✅ 已创建 proposals 表');
} else {
  console.log('ℹ️ proposals 表已存在，跳过迁移');
}
db.close();
