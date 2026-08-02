let activeTags = [];
let currentMaterials = [];
let allCategories = [];

// 获取所有分类和标签
async function loadFilters() {
  const res = await fetch('/api/tags');
  allCategories = await res.json();
  renderFilters();
  loadMaterials();
}

function renderFilters() {
  const bar = document.getElementById('filterBar');
  bar.innerHTML = '';
  allCategories.forEach(cat => {
    const group = document.createElement('div');
    group.className = 'filter-group';
    const title = document.createElement('span');
    title.className = 'filter-title';
    title.textContent = cat.name;
    group.appendChild(title);

    cat.tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.dataset.id = tag.id;
      btn.textContent = tag.name;
      btn.style.setProperty('--tag-color', tag.color || '#6c757d');
      btn.onclick = () => toggleTag(btn, tag.id);
      group.appendChild(btn);
    });
    bar.appendChild(group);
  });
}

function toggleTag(btn, tagId) {
  btn.classList.toggle('active');
  const idx = activeTags.indexOf(tagId);
  if (idx > -1) activeTags.splice(idx, 1);
  else activeTags.push(tagId);
  loadMaterials();
}

// 加载素材
async function loadMaterials(uncategorized = false) {
  let url = '/api/materials?';
  if (uncategorized) url += 'uncategorized=true';
  else if (activeTags.length > 0) url += `tags=${activeTags.join(',')}`;
  
  const res = await fetch(url);
  const data = await res.json();
  currentMaterials = data;
  renderGrid(data);
}

function renderGrid(materials) {
  const grid = document.getElementById('grid');
  if (!materials.length) {
    grid.innerHTML = '<p class="empty">没有找到匹配的素材</p>';
    return;
  }
  grid.innerHTML = materials.map(m => {
    const tagNames = m.tag_names ? m.tag_names.split(',') : [];
    const tagColors = m.tag_colors ? m.tag_colors.split(',') : [];
    const tagsHtml = tagNames.map((name, i) => 
      `<span class="tag-badge" style="background:${tagColors[i] || '#6c757d'}">${name}</span>`
    ).join('');

    const thumbPath = `/uploads/thumb_${m.filename}`;
    return `
      <div class="grid-item" onclick="openLightbox('/uploads/${m.filename}', '${m.original_name}')">
        <img src="${thumbPath}" alt="${m.original_name}" loading="lazy">
        <div class="item-info">
          <span class="item-name">${m.original_name}</span>
          <div class="item-tags">${tagsHtml}</div>
        </div>
      </div>
    `;
  }).join('');
}

// 灯箱
function openLightbox(src, name) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lbImage').src = src;
  document.getElementById('lbDownload').href = src;
  document.getElementById('lbDownload').download = name || 'download';
  lb.style.display = 'flex';
}
document.getElementById('lbClose').onclick = () => document.getElementById('lightbox').style.display = 'none';
document.getElementById('lightbox').onclick = (e) => { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; };

// 未分类按钮
document.getElementById('btnUncategorized').onclick = () => {
  activeTags = [];
  document.querySelectorAll('#filterBar button').forEach(b => b.classList.remove('active'));
  loadMaterials(true);
};

// 重置未分类状态（点击标签时取消未分类）
const origLoad = loadMaterials;
loadMaterials = function(uncategorized) {
  if (!uncategorized) {
    document.getElementById('btnUncategorized').classList.remove('active');
  } else {
    document.getElementById('btnUncategorized').classList.add('active');
  }
  origLoad(uncategorized);
};

loadFilters();