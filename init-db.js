const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'kards.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'").get();
if (!tableCheck) {
  console.log('📦 创建数据库表...');
  db.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, sort_order INTEGER DEFAULT 0);
    CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, name TEXT NOT NULL, color TEXT DEFAULT '#6c757d', icon TEXT, FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE, UNIQUE(category_id, name));
    CREATE TABLE materials (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, file_size INTEGER, uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE material_tags (material_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (material_id, tag_id), FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE);
    CREATE TABLE proposals (id INTEGER PRIMARY KEY AUTOINCREMENT, material_id INTEGER NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, status TEXT DEFAULT 'pending', visitor_ip TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE);
  `);

  const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)");
  const insertTag = db.prepare("INSERT OR IGNORE INTO tags (category_id, name, color, icon) VALUES (?, ?, ?, ?)");
  const getCat = (n) => { const r = db.prepare("SELECT id FROM categories WHERE name = ?").get(n); return r ? r.id : null; };

  insertCategory.run('阵营', 1);
  insertCategory.run('卡牌类型', 2);
  insertCategory.run('费用/属性', 3);
  insertCategory.run('稀有度', 4);

  const fid = getCat('阵营');
  if (fid) {
    insertTag.run(fid, '苏联', '#d32f2f', '/images/flags/苏联.png');
    insertTag.run(fid, '德国', '#1976d2', '/images/flags/德国.png');
    insertTag.run(fid, '美国', '#388e3c', '/images/flags/美国.png');
    insertTag.run(fid, '英国', '#f57c00', '/images/flags/英国.png');
    insertTag.run(fid, '日本', '#c2185b', '/images/flags/日本.png');
    insertTag.run(fid, '意大利', '#7b1fa2', '/images/flags/意大利.png');
  }

  const tid = getCat('卡牌类型');
  if (tid) {
    insertTag.run(tid, '指令', '#0288d1', null);
    insertTag.run(tid, '步兵', '#00796b', null);
    insertTag.run(tid, '坦克', '#e64a19', null);
    insertTag.run(tid, '战斗机', '#fbc02d', null);
    insertTag.run(tid, '轰炸机', '#5d4037', null);
    insertTag.run(tid, '炮', '#5d4037', null);
  }

  const cid = getCat('费用/属性');
  if (cid) {
    insertTag.run(cid, '0k', '#cc00ff', null);
    insertTag.run(cid, '1k', '#fffb00', null);
    insertTag.run(cid, '2k', '#ffffff', null);
    insertTag.run(cid, '3k', '#d600d6', null);
    insertTag.run(cid, '4k', '#c7ff86', null);
    insertTag.run(cid, '5k', '#0099ff', null);
    insertTag.run(cid, '6k', '#ff2f00', null);
    insertTag.run(cid, '7k+', '#000000', null);
  }

  const rid = getCat('稀有度');
  if (rid) {
    insertTag.run(rid, '普通', '#d6d4d4', null);
    insertTag.run(rid, '限定', '#bd9a0070', null);
    insertTag.run(rid, '特殊', '#d3d1d8', null);
    insertTag.run(rid, '精英', '#ffa600', null);
  }

  console.log('✅ 数据库初始化完成');
}
db.close();