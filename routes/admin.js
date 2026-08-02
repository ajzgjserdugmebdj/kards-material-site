const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { isAuthenticated } = require('../middleware/auth');
const { getDb } = require('../controllers/db');

// ---------- 登录页面 ----------
router.get('/login', (req, res) => {
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.admin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin/login', { error: '密码错误，请重试' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ---------- 以下所有路由需登录 ----------
router.use(isAuthenticated);

router.get('/', (req, res) => {
  if (req.session && req.session.admin) {
    res.redirect('/admin/dashboard');
  } else {
    res.redirect('/admin/login');
  }
});

// ---------- 仪表盘 ----------
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const totalMaterials = db.prepare('SELECT COUNT(*) as count FROM materials').get().count;
  const uncategorized = db.prepare(`
    SELECT COUNT(*) as count FROM materials m 
    WHERE NOT EXISTS (SELECT 1 FROM material_tags WHERE material_id = m.id)
  `).get().count;
  const totalTags = db.prepare('SELECT COUNT(*) as count FROM tags').get().count;
  const pendingProposals = db.prepare('SELECT COUNT(*) as count FROM proposals WHERE status = ?').get('pending').count;

  const categoryStats = db.prepare(`
    SELECT c.name, COUNT(t.id) as tag_count 
    FROM categories c 
    LEFT JOIN tags t ON c.id = t.category_id 
    GROUP BY c.id
  `).all();

  res.render('admin/dashboard', { 
    totalMaterials, 
    uncategorized, 
    totalTags,
    pendingProposals,
    categoryStats 
  });
});

// ---------- 标签管理 ----------
router.get('/tags', (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*, 
           (SELECT COUNT(*) FROM tags WHERE category_id = c.id) as tag_count 
    FROM categories c 
    ORDER BY c.sort_order
  `).all();

  const tags = db.prepare(`
    SELECT t.*, c.name as category_name 
    FROM tags t 
    JOIN categories c ON t.category_id = c.id 
    ORDER BY c.sort_order, t.name
  `).all();

  res.render('admin/tags', { categories, tags });
});

// API：获取所有标签
router.get('/api/tags', (req, res) => {
  const db = getDb();
  const tags = db.prepare(`
    SELECT t.*, c.name as category_name 
    FROM tags t 
    JOIN categories c ON t.category_id = c.id 
    ORDER BY c.sort_order, t.name
  `).all();
  res.json(tags);
});

// API：新增分类
router.post('/api/categories', (req, res) => {
  const db = getDb();
  const { name } = req.body;
  try {
    db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: '分类名称已存在或无效' });
  }
});

// API：删除分类
router.delete('/api/categories/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// API：新增标签（支持 icon）
router.post('/api/tags', (req, res) => {
  const db = getDb();
  const { category_id, name, color, icon } = req.body;
  try {
    db.prepare('INSERT INTO tags (category_id, name, color, icon) VALUES (?, ?, ?, ?)')
      .run(category_id, name, color || '#6c757d', icon || null);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: '标签已存在或分类无效' });
  }
});

// API：删除标签
router.delete('/api/tags/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---------- 批量更新 ----------
router.put('/api/tags/bulk', (req, res) => {
  const db = getDb();
  const { categories } = req.body;
  if (!categories || !Array.isArray(categories)) {
    return res.status(400).json({ error: '无效数据格式' });
  }

  const updateCategory = db.prepare(`UPDATE categories SET name = ?, sort_order = ? WHERE id = ?`);
  const insertCategory = db.prepare(`INSERT INTO categories (name, sort_order) VALUES (?, ?)`);
  const deleteCategory = db.prepare(`DELETE FROM categories WHERE id = ?`);
  const updateTag = db.prepare(`UPDATE tags SET name = ?, color = ?, icon = ? WHERE id = ? AND category_id = ?`);
  const insertTag = db.prepare(`INSERT INTO tags (category_id, name, color, icon) VALUES (?, ?, ?, ?)`);
  const deleteTag = db.prepare(`DELETE FROM tags WHERE id = ?`);

  const transaction = db.transaction((catData) => {
    for (const cat of catData) {
      if (cat._deleted) {
        if (cat.id) deleteCategory.run(cat.id);
        continue;
      }
      let catId = cat.id;
      if (catId) {
        updateCategory.run(cat.name, cat.sort_order || 0, catId);
      } else {
        const info = insertCategory.run(cat.name, cat.sort_order || 0);
        catId = info.lastInsertRowid;
      }
      if (cat.tags) {
        for (const tag of cat.tags) {
          if (tag._deleted) {
            if (tag.id) deleteTag.run(tag.id);
            continue;
          }
          if (tag.id) {
            updateTag.run(tag.name, tag.color || '#6c757d', tag.icon || null, tag.id, catId);
          } else {
            insertTag.run(catId, tag.name, tag.color || '#6c757d', tag.icon || null);
          }
        }
      }
    }
  });

  try {
    transaction(categories);
    res.json({ success: true, message: '批量更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新失败：' + err.message });
  }
});

// ---------- 导出导入 ----------
router.get('/api/tags/export', (req, res) => {
  const db = getDb();
  const categories = db.prepare(`SELECT id, name, sort_order FROM categories ORDER BY sort_order`).all();
  const result = categories.map(c => {
    const tags = db.prepare(`SELECT name, color, icon FROM tags WHERE category_id = ? ORDER BY name`).all(c.id);
    return { category: c.name, sort_order: c.sort_order, tags: tags.map(t => ({ name: t.name, color: t.color, icon: t.icon })) };
  });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="tags_export.json"');
  res.json(result);
});

const uploadJson = multer({ storage: multer.memoryStorage() }).single('jsonFile');
router.post('/api/tags/import', uploadJson, (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传 JSON 文件' });
    const data = JSON.parse(req.file.buffer.toString('utf-8'));
    if (!Array.isArray(data)) return res.status(400).json({ error: 'JSON 格式错误，应为数组' });
    const db = getDb();
    const insertCategory = db.prepare(`INSERT OR REPLACE INTO categories (name, sort_order) VALUES (?, ?)`);
    const getCategoryId = db.prepare(`SELECT id FROM categories WHERE name = ?`);
    const insertTag = db.prepare(`INSERT OR REPLACE INTO tags (category_id, name, color, icon) VALUES (?, ?, ?, ?)`);
    const transaction = db.transaction((items) => {
      for (const item of items) {
        const { category, sort_order = 0, tags = [] } = item;
        if (!category) continue;
        insertCategory.run(category, sort_order);
        const catRow = getCategoryId.get(category);
        if (!catRow) continue;
        const catId = catRow.id;
        for (const tag of tags) {
          if (!tag.name) continue;
          insertTag.run(catId, tag.name, tag.color || '#6c757d', tag.icon || null);
        }
      }
    });
    transaction(data);
    res.json({ success: true, message: `成功导入 ${data.length} 个分类` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '导入失败：' + err.message });
  }
});

// ---------- 素材管理 ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uuid = crypto.randomUUID();
    cb(null, `${uuid}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/materials', (req, res) => {
  const db = getDb();
  const materials = db.prepare(`
    SELECT m.*, 
           GROUP_CONCAT(t.name) as tag_names,
           GROUP_CONCAT(t.color) as tag_colors,
           GROUP_CONCAT(t.id) as tag_ids,
           GROUP_CONCAT(t.icon) as tag_icons
    FROM materials m
    LEFT JOIN material_tags mt ON m.id = mt.material_id
    LEFT JOIN tags t ON mt.tag_id = t.id
    GROUP BY m.id
    ORDER BY m.uploaded_at DESC
  `).all();

  const allTags = db.prepare(`
    SELECT t.*, c.name as category_name 
    FROM tags t 
    JOIN categories c ON t.category_id = c.id 
    ORDER BY c.sort_order
  `).all();

  const uncategorizedCount = db.prepare(`
    SELECT COUNT(*) as count FROM materials m 
    WHERE NOT EXISTS (SELECT 1 FROM material_tags WHERE material_id = m.id)
  `).get().count;

  res.render('admin/materials', { materials, allTags, uncategorizedCount });
});

router.post('/api/upload', upload.any(), async (req, res) => {
  const db = getDb();
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: '请至少选择一个文件' });
  }
  const uploaded = [];
  const errors = [];
  for (const file of files) {
    try {
      const thumbName = `thumb_${file.filename}`;
      const thumbPath = path.join(path.dirname(file.path), thumbName);
      await sharp(file.path).resize(300, 300, { fit: 'cover' }).toFile(thumbPath);
      const stmt = db.prepare(`INSERT INTO materials (filename, original_name, file_size) VALUES (?, ?, ?)`);
      const info = stmt.run(file.filename, file.originalname, file.size);
      uploaded.push({ id: info.lastInsertRowid, filename: file.filename, original_name: file.originalname, thumb: `/uploads/${thumbName}` });
    } catch (err) {
      console.error('处理文件失败:', file.originalname, err.message);
      errors.push({ file: file.originalname, error: err.message });
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
  }
  if (uploaded.length === 0) {
    return res.status(500).json({ error: '所有文件处理失败', details: errors });
  }
  res.json({ success: true, uploaded, errors: errors.length > 0 ? errors : undefined, message: `成功上传 ${uploaded.length} 个文件` });
});

router.post('/api/materials/tags', (req, res) => {
  const db = getDb();
  const { material_ids, tag_ids } = req.body;
  if (!material_ids || !material_ids.length || !tag_ids || !tag_ids.length) {
    return res.status(400).json({ error: '参数错误' });
  }
  const insert = db.prepare(`INSERT OR IGNORE INTO material_tags (material_id, tag_id) VALUES (?, ?)`);
  const transaction = db.transaction((ids) => {
    for (const mid of material_ids) {
      for (const tid of tag_ids) {
        insert.run(mid, tid);
      }
    }
  });
  transaction(material_ids);
  res.json({ success: true });
});

router.put('/api/materials/:id/tags', (req, res) => {
  const db = getDb();
  const { tag_ids } = req.body;
  const materialId = req.params.id;
  db.prepare('DELETE FROM material_tags WHERE material_id = ?').run(materialId);
  if (tag_ids && tag_ids.length) {
    const insert = db.prepare('INSERT INTO material_tags (material_id, tag_id) VALUES (?, ?)');
    const transaction = db.transaction((ids) => {
      for (const tid of ids) insert.run(materialId, tid);
    });
    transaction(tag_ids);
  }
  res.json({ success: true });
});

router.delete('/api/materials/:id', (req, res) => {
  const db = getDb();
  const material = db.prepare('SELECT filename FROM materials WHERE id = ?').get(req.params.id);
  if (material) {
    const filePath = path.join(__dirname, '..', 'uploads', material.filename);
    const thumbPath = path.join(__dirname, '..', 'uploads', `thumb_${material.filename}`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});

// ---------- 审核提议 ----------
router.get('/proposals', (req, res) => {
  const db = getDb();
  const proposals = db.prepare(`
    SELECT p.*, m.original_name as material_name
    FROM proposals p
    JOIN materials m ON p.material_id = m.id
    WHERE p.status = 'pending'
    ORDER BY p.created_at DESC
  `).all();
  const allTags = db.prepare('SELECT * FROM tags').all();
  res.render('admin/proposals', { proposals, allTags });
});

router.post('/api/proposals/:id/approve', (req, res) => {
  const db = getDb();
  const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
  if (!proposal) return res.status(404).json({ error: '提议不存在' });
  if (proposal.status !== 'pending') return res.status(400).json({ error: '已处理' });
  if (proposal.type === 'add_tag') {
    db.prepare(`INSERT OR IGNORE INTO material_tags (material_id, tag_id) VALUES (?, ?)`).run(proposal.material_id, proposal.data);
  } else if (proposal.type === 'rename') {
    db.prepare(`UPDATE materials SET original_name = ? WHERE id = ?`).run(proposal.data, proposal.material_id);
  }
  db.prepare('UPDATE proposals SET status = ? WHERE id = ?').run('approved', req.params.id);
  res.json({ success: true });
});

router.post('/api/proposals/:id/reject', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE proposals SET status = ? WHERE id = ?').run('rejected', req.params.id);
  res.json({ success: true });
});

module.exports = router;

// ========== 🆕 管理员修改素材名称 ==========
router.put('/api/materials/:id/name', (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '名称不能为空' });
  }
  const id = req.params.id;
  const stmt = db.prepare('UPDATE materials SET original_name = ? WHERE id = ?');
  const result = stmt.run(name.trim(), id);
  if (result.changes === 0) {
    return res.status(404).json({ error: '素材不存在' });
  }
  res.json({ success: true });
});

// ========== 🆕 管理员修改素材名称 ==========
router.put('/api/materials/:id/name', (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '名称不能为空' });
  }
  const id = req.params.id;
  const stmt = db.prepare('UPDATE materials SET original_name = ? WHERE id = ?');
  const result = stmt.run(name.trim(), id);
  if (result.changes === 0) {
    return res.status(404).json({ error: '素材不存在' });
  }
  res.json({ success: true });
});

// ========== 🆕 管理员修改素材名称 ==========
router.put('/api/materials/:id/name', (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '名称不能为空' });
  }
  const id = req.params.id;
  const stmt = db.prepare('UPDATE materials SET original_name = ? WHERE id = ?');
  const result = stmt.run(name.trim(), id);
  if (result.changes === 0) {
    return res.status(404).json({ error: '素材不存在' });
  }
  res.json({ success: true });
});
