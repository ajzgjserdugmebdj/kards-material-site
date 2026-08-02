let activeTags = [];
let currentMaterials = [];
let allCategories = [];
let searchKeyword = '';

async function loadFilters() {
  const res = await fetch('/api/tags');
  allCategories = await res.json();
  renderFilters();
  loadMaterials();
}

function renderFilters() {
  const bar = document.getElementById('filterBar');
  if (!bar) return;
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
  if (!grid) return;
  let filtered = materials;
  if (searchKeyword) {
    filtered = materials.filter(m => {
      const nameMatch = (m.original_name || '').toLowerCase().includes(searchKeyword);
      const tagMatch = (m.tag_names || '').toLowerCase().includes(searchKeyword);
      return nameMatch || tagMatch;
    });
  }
  if (!filtered.length) {
    grid.innerHTML = '<p class="empty">没有找到匹配的素材</p>';
    return;
  }
  grid.innerHTML = filtered.map(m => {
    const tagNames = m.tag_names ? m.tag_names.split(',') : [];
    const tagColors = m.tag_colors ? m.tag_colors.split(',') : [];
    const tagIcons = m.tag_icons ? m.tag_icons.split(',') : [];
    const tagsHtml = tagNames.map((name, i) => {
      const icon = tagIcons[i] || null;
      const bgColor = tagColors[i] || '#6c757d';
      if (icon) {
        return `<span class="tag-badge" style="background:${bgColor};display:inline-flex;align-items:center;gap:4px;">
                  <img src="${icon}" alt="${name}" style="width:16px;height:16px;object-fit:contain;">
                  ${name}
                </span>`;
      } else {
        return `<span class="tag-badge" style="background:${bgColor}">${name}</span>`;
      }
    }).join('');

    const thumbPath = `/uploads/thumb_${m.filename}`;
    return `
      <div class="grid-item" onclick="openLightbox('/uploads/${m.filename}', '${m.original_name}')">
        <img src="${thumbPath}" alt="${m.original_name}" loading="lazy">
        <div class="item-info">
          <span class="item-name">${m.original_name}</span>
          <div class="item-tags">${tagsHtml}</div>
          <button class="proposal-btn" onclick="event.stopPropagation(); openProposalModal(${m.id})" style="margin-top:6px;padding:4px 10px;font-size:12px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;cursor:pointer;">✏️ 提议修改</button>
        </div>
      </div>
    `;
  }).join('');
}

function openLightbox(src, name) {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  document.getElementById('lbImage').src = src;
  document.getElementById('lbDownload').href = src;
  document.getElementById('lbDownload').download = name || 'download';
  lb.style.display = 'flex';
}
document.getElementById('lbClose')?.addEventListener('click', () => {
  document.getElementById('lightbox').style.display = 'none';
});
document.getElementById('lightbox')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

document.getElementById('btnUncategorized')?.addEventListener('click', () => {
  activeTags = [];
  document.querySelectorAll('#filterBar button').forEach(b => b.classList.remove('active'));
  loadMaterials(true);
});

document.getElementById('searchInput')?.addEventListener('input', function() {
  searchKeyword = this.value.trim().toLowerCase();
  loadMaterials();
});

// ---------- 提议模态框 ----------
function openProposalModal(materialId) {
  document.getElementById('proposalMaterialId').value = materialId;
  document.getElementById('proposalModal').style.display = 'block';
  const allTags = window._allTags || [];
  const tagSelect = document.getElementById('proposalTagSelect');
  tagSelect.innerHTML = allTags.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  updateProposalForm();
  document.getElementById('proposalResult').innerHTML = '';
}

function closeProposalModal() {
  document.getElementById('proposalModal').style.display = 'none';
}
document.getElementById('proposalModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeProposalModal();
});

document.getElementById('proposalType')?.addEventListener('change', updateProposalForm);
function updateProposalForm() {
  const type = document.getElementById('proposalType').value;
  const tagSelect = document.getElementById('proposalTagSelect');
  const newNameInput = document.getElementById('proposalNewName');
  const label = document.getElementById('proposalDataLabel');
  if (type === 'add_tag') {
    tagSelect.style.display = 'inline-block';
    newNameInput.style.display = 'none';
    label.textContent = '选择标签：';
  } else {
    tagSelect.style.display = 'none';
    newNameInput.style.display = 'inline-block';
    label.textContent = '新名称：';
  }
}

document.getElementById('submitProposalBtn')?.addEventListener('click', async function() {
  const materialId = document.getElementById('proposalMaterialId').value;
  const type = document.getElementById('proposalType').value;
  let data;
  if (type === 'add_tag') {
    data = document.getElementById('proposalTagSelect').value;
  } else {
    data = document.getElementById('proposalNewName').value.trim();
    if (!data) { alert('请输入新名称'); return; }
  }
  try {
    const res = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_id: materialId, type, data })
    });
    const result = await res.json();
    if (result.success) {
      document.getElementById('proposalResult').innerHTML = '<p style="color:green;">✅ 提议已提交，等待管理员审核。</p>';
      setTimeout(closeProposalModal, 2000);
    } else {
      document.getElementById('proposalResult').innerHTML = `<p style="color:red;">❌ ${result.error}</p>`;
    }
  } catch (err) {
    document.getElementById('proposalResult').innerHTML = '<p style="color:red;">网络错误，请重试</p>';
  }
});

if (document.getElementById('filterBar')) {
  loadFilters();
}
