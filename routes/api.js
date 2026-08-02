const express = require('express');
const router = express.Router();
const { getDb } = require('../controllers/db');

// 获取所有分类及标签
router.get('/tags', (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*, 
           (SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color)) 
            FROM tags t WHERE t.category_id = c.id) as tags
    FROM categories c 
    ORDER BY c.sort_order
  `).all();

  categories.forEach(c => {
    c.tags = c.tags ? JSON.parse(c.tags) : [];
  });
  res.json(categories);
});

// 获取素材列表（支持多标签组合筛选 & 未分类）
router.get('/materials', (req, res) => {
  const db = getDb();
  const { tags, uncategorized } = req.query;

  let sql = `
    SELECT m.*, 
           GROUP_CONCAT(t.id) as tag_ids,
           GROUP_CONCAT(t.name) as tag_names,
           GROUP_CONCAT(t.color) as tag_colors,
           GROUP_CONCAT(t.icon) as tag_icons
    FROM materials m
    LEFT JOIN material_tags mt ON m.id = mt.material_id
    LEFT JOIN tags t ON mt.tag_id = t.id
  `;

  const params = [];
  const conditions = [];

  if (uncategorized === 'true') {
    conditions.push(`NOT EXISTS (SELECT 1 FROM material_tags WHERE material_id = m.id)`);
  } else if (tags) {
    const tagIds = tags.split(',').map(Number).filter(id => !isNaN(id) && id > 0);
    if (tagIds.length > 0) {
      const placeholders = tagIds.map(() => '?').join(',');
      sql = `
        SELECT m.*, 
               GROUP_CONCAT(t.id) as tag_ids,
               GROUP_CONCAT(t.name) as tag_names,
               GROUP_CONCAT(t.color) as tag_colors,
               GROUP_CONCAT(t.icon) as tag_icons
        FROM materials m
        LEFT JOIN material_tags mt ON m.id = mt.material_id
        LEFT JOIN tags t ON mt.tag_id = t.id
        WHERE m.id IN (
          SELECT material_id 
          FROM material_tags 
          WHERE tag_id IN (${placeholders})
          GROUP BY material_id 
          HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}
        )
        GROUP BY m.id
        ORDER BY m.uploaded_at DESC
      `;
      params.push(...tagIds);
      const results = db.prepare(sql).all(...params);
      return res.json(results);
    }
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ` GROUP BY m.id ORDER BY m.uploaded_at DESC`;

  const results = db.prepare(sql).all(...params);
  res.json(results);
});

// ---------- 访客提议 ----------
router.post('/proposals', (req, res) => {
  const db = getDb();
  const { material_id, type, data } = req.body;
  if (!material_id || !type || !data) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  const material = db.prepare('SELECT id FROM materials WHERE id = ?').get(material_id);
  if (!material) {
    return res.status(404).json({ error: '素材不存在' });
  }
  if (type === 'add_tag') {
    const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(data);
    if (!tag) {
      return res.status(400).json({ error: '标签不存在' });
    }
  }
  const ip = req.ip || req.connection.remoteAddress;
  const stmt = db.prepare(`
    INSERT INTO proposals (material_id, type, data, visitor_ip)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(material_id, type, data, ip);
  res.json({ success: true, id: info.lastInsertRowid });
});

module.exports = router;
