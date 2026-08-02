console.log("🚀 server.js starting...");
console.log("🚀 server.js starting...");
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./controllers/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- 目录准备 ----------
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// ---------- 中间件 ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

app.use(session({
  secret: process.env.SESSION_SECRET || 'kards_dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('view cache', false);

// ---------- 路由 ----------
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// 前台首页
app.get('/', (req, res) => {
  const db = getDb();
  const allTags = db.prepare(`
    SELECT t.*, c.name as category_name 
    FROM tags t 
    JOIN categories c ON t.category_id = c.id 
    ORDER BY c.sort_order, t.name
  `).all();
  res.render('front/index', { 
    user: req.session.admin || null,
    allTags: allTags 
  });
});

// ---------- 启动服务器（监听 0.0.0.0） ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 KARDS 素材站运行中: http://0.0.0.0:${PORT}`);
  console.log(`🔐 后台管理: http://0.0.0.0:${PORT}/admin`);
});
