// ========== 工具函数：获取选中的素材 ID ==========
function getSelectedMaterialIds() {
  const checks = document.querySelectorAll('.material-checkbox:checked');
  return Array.from(checks).map(cb => parseInt(cb.dataset.id));
}

// ========== 上传文件 ==========
document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('fileInput');
  if (fileInput.files.length === 0) {
    alert('请至少选择一个文件');
    return;
  }

  const formData = new FormData();
  for (let i = 0; i < fileInput.files.length; i++) {
    formData.append('files', fileInput.files[i]);
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '上传中...';

  try {
    const res = await fetch('/admin/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      const ids = data.uploaded.map(f => f.id);
      showTagModal(ids, () => {
        window.location.reload();
      });
    } else {
      alert('上传失败：' + (data.error || '未知错误'));
    }
  } catch (err) {
    alert('网络错误，请重试');
  } finally {
    btn.disabled = false;
    btn.textContent = '上传并打标签';
  }
});

// ========== 显示打标签模态框 ==========
function showTagModal(materialIds, onSuccess) {
  fetch('/admin/api/tags')
    .then(res => res.json())
    .then(tags => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'tagModal';
      
      const groups = {};
      tags.forEach(t => {
        if (!groups[t.category_name]) groups[t.category_name] = [];
        groups[t.category_name].push(t);
      });

      let html = `<div class="modal-box">
        <h3>🏷️ 为 ${materialIds.length} 个素材添加标签</h3>
        <p style="color:#666;font-size:14px;">勾选通用标签，点击保存即可批量应用</p>`;
      
      for (const [catName, tagList] of Object.entries(groups)) {
        html += `<div class="tag-group"><strong>${catName}</strong><br>`;
        tagList.forEach(t => {
          html += `<label><input type="checkbox" value="${t.id}" class="tag-checkbox"> 
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${t.color || '#6c757d'};vertical-align:middle;margin-right:4px;"></span>
            ${t.name}
          </label>`;
        });
        html += `</div>`;
      }

      html += `<div class="modal-actions">
        <button onclick="closeModal()" style="background:#e0e0e0;padding:8px 20px;border:none;border-radius:6px;cursor:pointer;">取消</button>
        <button id="saveTagsBtn" style="background:#1a1a2e;color:white;padding:8px 20px;border:none;border-radius:6px;cursor:pointer;">✅ 确认保存</button>
      </div></div>`;
      modal.innerHTML = html;
      document.body.appendChild(modal);

      document.getElementById('saveTagsBtn').onclick = async () => {
        const checked = document.querySelectorAll('.tag-checkbox:checked');
        const tagIds = Array.from(checked).map(cb => parseInt(cb.value));
        if (tagIds.length === 0) {
          if (!confirm('未选择任何标签，确定要继续吗？（素材将保持未分类状态）')) return;
        }

        const res = await fetch('/admin/api/materials/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ material_ids: materialIds, tag_ids: tagIds })
        });
        const data = await res.json();
        if (data.success) {
          closeModal();
          if (onSuccess) onSuccess();
        } else {
          alert('保存失败：' + (data.error || '未知错误'));
        }
      };
    });
}

function closeModal() {
  const modal = document.getElementById('tagModal');
  if (modal) modal.remove();
}

// ========== 编辑标签 ==========
async function editTags(materialId) {
  const allTags = window._allTags || [];
  if (allTags.length === 0) {
    alert('请先刷新页面加载标签数据');
    return;
  }

  const card = document.querySelector(`[data-material-id="${materialId}"]`);
  const currentTagIds = card ? card.dataset.tagIds.split(',').map(Number).filter(id => id) : [];

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'editModal';

  const groups = {};
  allTags.forEach(t => {
    if (!groups[t.category_name]) groups[t.category_name] = [];
    groups[t.category_name].push(t);
  });

  let html = `<div class="modal-box">
    <h3>✏️ 编辑素材标签</h3>
    <p style="color:#666;font-size:14px;">重新勾选该素材的标签</p>`;
  
  for (const [catName, tagList] of Object.entries(groups)) {
    html += `<div class="tag-group"><strong>${catName}</strong><br>`;
    tagList.forEach(t => {
      const checked = currentTagIds.includes(t.id) ? 'checked' : '';
      html += `<label><input type="checkbox" value="${t.id}" class="edit-tag-checkbox" ${checked}> 
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${t.color || '#6c757d'};vertical-align:middle;margin-right:4px;"></span>
        ${t.name}
      </label>`;
    });
    html += `</div>`;
  }

  html += `<div class="modal-actions">
    <button onclick="closeModal()" style="background:#e0e0e0;padding:8px 20px;border:none;border-radius:6px;cursor:pointer;">取消</button>
    <button id="updateTagsBtn" style="background:#1a1a2e;color:white;padding:8px 20px;border:none;border-radius:6px;cursor:pointer;">💾 更新</button>
  </div></div>`;
  modal.innerHTML = html;
  document.body.appendChild(modal);

  document.getElementById('updateTagsBtn').onclick = async () => {
    const checked = document.querySelectorAll('.edit-tag-checkbox:checked');
    const tagIds = Array.from(checked).map(cb => parseInt(cb.value));
    
    const res = await fetch(`/admin/api/materials/${materialId}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_ids: tagIds })
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      window.location.reload();
    } else {
      alert('更新失败');
    }
  };
}

// ========== 删除素材 ==========
async function deleteMaterial(id, filename) {
  if (!confirm(`确定要删除 "${filename}" 吗？此操作不可恢复！`)) return;
  const res = await fetch(`/admin/api/materials/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) {
    window.location.reload();
  } else {
    alert('删除失败');
  }
}

// ========== 🆕 管理员修改名称 ==========
async function editName(materialId) {
  const newName = prompt('请输入新的素材名称：');
  if (newName === null) return; // 用户取消
  if (newName.trim() === '') {
    alert('名称不能为空');
    return;
  }
  try {
    const res = await fetch(`/admin/api/materials/${materialId}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() })
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ 名称已更新');
      window.location.reload();
    } else {
      alert('❌ 更新失败：' + (data.error || '未知错误'));
    }
  } catch (err) {
    alert('网络错误，请重试');
  }
}
