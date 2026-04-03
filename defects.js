/* ============================================================
   defects.js — Defects List Management
   ============================================================ */
'use strict';

let defectEditTarget = null;

function renderDefectsList() {
  if (!canManage()) { showToast(t('Access denied.','غير مصرح.'), 'error'); navigate('dashboard'); return; }

  const defects  = DB.getDefectsList();
  const tbody    = document.getElementById('defectsListBody');
  const emptyEl  = document.getElementById('defectsEmpty');
  if (!tbody) return;

  if (defects.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = defects.map((name, idx) => `
      <tr>
        <td style="color:var(--text-muted);font-size:13px">${idx + 1}</td>
        <td><strong>${escapeHtml(name)}</strong></td>
        <td>
          <div class="row-actions">
            <button class="action-btn" onclick="openEditDefect('${escapeHtml(name)}')">${t('Edit','تعديل')}</button>
            <button class="action-btn danger" onclick="deleteDefectItem('${escapeHtml(name)}')">${t('Delete','حذف')}</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  bindDefectsEvents();
}

function bindDefectsEvents() {
  document.getElementById('addDefectListBtn')?.addEventListener('click', openAddDefect);
  document.getElementById('save-defect-btn')?.addEventListener('click', saveDefect);
  document.getElementById('defect-modal-input')?.addEventListener('keydown', e => { if(e.key==='Enter') saveDefect(); });
}

function openAddDefect() {
  defectEditTarget = null;
  const title = document.getElementById('defect-modal-title');
  const input = document.getElementById('defect-modal-input');
  const err   = document.getElementById('defect-modal-err');
  const btn   = document.getElementById('save-defect-btn');
  if (title) title.textContent = t('Add Defect','إضافة عيب');
  if (input) input.value = '';
  if (err)   err.textContent = '';
  if (btn)   btn.textContent = t('Add','إضافة');
  openModal('defect-modal');
}

function openEditDefect(name) {
  defectEditTarget = name;
  const title = document.getElementById('defect-modal-title');
  const input = document.getElementById('defect-modal-input');
  const err   = document.getElementById('defect-modal-err');
  const btn   = document.getElementById('save-defect-btn');
  if (title) title.textContent = t('Edit Defect','تعديل العيب');
  if (input) input.value = name;
  if (err)   err.textContent = '';
  if (btn)   btn.textContent = t('Save','حفظ');
  openModal('defect-modal');
}

function saveDefect() {
  const input   = document.getElementById('defect-modal-input');
  const errEl   = document.getElementById('defect-modal-err');
  const newName = input?.value.trim() || '';

  if (!newName) { if(errEl) errEl.textContent = t('Defect name is required.','اسم العيب مطلوب.'); return; }

  const existing = DB.getDefectsList();

  if (defectEditTarget === null) {
    if (existing.map(d=>d.toLowerCase()).includes(newName.toLowerCase())) {
      if (errEl) errEl.textContent = t('This defect already exists.','هذا العيب موجود بالفعل.'); return;
    }
    DB.addDefectToList(newName);
    showToast(t('Defect added.','تم إضافة العيب.'), 'success');
  } else {
    if (newName.toLowerCase() !== defectEditTarget.toLowerCase() &&
        existing.map(d=>d.toLowerCase()).includes(newName.toLowerCase())) {
      if (errEl) errEl.textContent = t('This defect already exists.','هذا العيب موجود بالفعل.'); return;
    }
    DB.updateDefectInList(defectEditTarget, newName);
    showToast(t('Defect updated.','تم تحديث العيب.'), 'success');
  }

  closeModal('defect-modal');
  renderDefectsList();
}

function deleteDefectItem(name) {
  confirmDelete(
    t(`Remove "${name}" from the defects list?`, `إزالة "${name}" من قائمة العيوب؟`),
    () => {
      DB.removeDefectFromList(name);
      showToast(t('Defect removed.','تم إزالة العيب.'), 'success');
      renderDefectsList();
    }
  );
}
