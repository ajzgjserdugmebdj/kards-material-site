const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname);
const DB_PATH = path.join(DB_DIR, 'kards.db');

// 确保 database 目录存在
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// 开启外键约束
db.pragma('foreign_keys = ON');

// ---------- 创建表 ----------
db.exec(`
  -- 标签分类表
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0
  );

  -- 标签表（含 icon 字段）
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6c757d',
    icon TEXT,          -- 图标路径或 URL
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, name)
  );

  -- 素材表
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    file_size INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 素材-标签关联表
  CREATE TABLE IF NOT EXISTS material_tags (
    material_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (material_id, tag_id),
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );
`);

// ---------- 迁移：为已有表添加 icon 列（如果不存在） ----------
const tableInfo = db.prepare("PRAGMA table_info(tags)").all();
const hasIcon = tableInfo.some(col => col.name === 'icon');
if (!hasIcon) {
  db.exec("ALTER TABLE tags ADD COLUMN icon TEXT;");
  console.log('✅ 已为 tags 表添加 icon 列');
}

// ---------- 预置数据 ----------
// 辅助函数：获取分类 ID
const getCategoryId = (name) => {
  const row = db.prepare(`SELECT id FROM categories WHERE name = ?`).get(name);
  return row ? row.id : null;
};

// 插入分类（忽略已存在）
const insertCategory = db.prepare(`INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)`);
const insertTag = db.prepare(`
  INSERT OR IGNORE INTO tags (category_id, name, color, icon) VALUES (?, ?, ?, ?)
`);

// 1. 插入分类
insertCategory.run('阵营', 1);
insertCategory.run('卡牌类型', 2);
insertCategory.run('费用/属性', 3);
insertCategory.run('稀有度', 4);

// 2. 获取各分类 ID
const factionId = getCategoryId('阵营');
const typeId = getCategoryId('卡牌类型');
const costId = getCategoryId('费用/属性');
const rarityId = getCategoryId('稀有度');

// 3. 插入标签（阵营带图标，其他分类无图标）
if (factionId) {
  insertTag.run(factionId, '苏联', '#d32f2f', '/images/flags/苏联.png');
  insertTag.run(factionId, '德国', '#1976d2', '/images/flags/德国.png');
  insertTag.run(factionId, '美国', '#388e3c', '/images/flags/美国.png');
  insertTag.run(factionId, '英国', '#f57c00', '/images/flags/英国.png');
  insertTag.run(factionId, '日本', '#c2185b', '/images/flags/日本.png');
  insertTag.run(factionId, '意大利', '#7b1fa2', '/images/flags/意大利.png');
  insertTag.run(factionId, '法国', '#0288d1', '/images/flags/法国.png');
  insertTag.run(factionId, '芬兰', '#388e3c', '/images/flags/芬兰.png');
  insertTag.run(factionId, '波兰', '#fbc02d', '/images/flags/波兰.png');
  
}

if (typeId) {
  insertTag.run(typeId, '指令', '#0288d1', '/images/类型/指令.png');
  insertTag.run(typeId, '步兵', '#00796b', '/images/类型/步兵.png');
  insertTag.run(typeId, '坦克', '#e64a19', '/images/类型/坦克.png');
  insertTag.run(typeId, '战斗机', '#fbc02d', '/images/类型/战斗机.png');
  insertTag.run(typeId, '轰炸机 ', '#5d4037', '/images/类型/轰炸机.png');
  insertTag.run(typeId, '炮', '#5d4037', '/images/类型/火炮.png');
}

if (costId) {
  insertTag.run(costId, '0k', '#cc00ff', '/images/费用/0.png');
  insertTag.run(costId, '1k', '#fffb00', '/images/费用/1.png');
  insertTag.run(costId, '2k', '#ffffff', '/images/费用/2.png');
  insertTag.run(costId, '3k', '#d600d6', '/images/费用/3.png');
  insertTag.run(costId, '4k', '#c7ff86', '/images/费用/4.png');
  insertTag.run(costId, '5k', '#0099ff', '/images/费用/5.png');
  insertTag.run(costId, '6k', '#ff2f00', '/images/费用/6.png');
  insertTag.run(costId, '7k+', '#000000', '/images/费用/7+.png');
}

if (rarityId) {
  insertTag.run(rarityId, '普通', '#d6d4d4', null);
  insertTag.run(rarityId, '限定', '#bd9a0070', null);
  insertTag.run(rarityId, '特殊', '#d3d1d8', null);
  insertTag.run(rarityId, '精英', '#ffa600', null);
}

console.log('✅ 数据库初始化完成，预置数据已插入！');
console.log(`📂 数据库位置: ${DB_PATH}`);
db.close();