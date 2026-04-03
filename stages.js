/* ============================================================
   stages.js — Stages List Management
   Admin + Supervisor: Add, Edit, Delete defect stages
   ============================================================ */
'use strict';

let stageEditTarget = null;

function renderStagesList() {
  if (!canManage()) { showToast(t('Access denied.','غير مصرح.'), 'error'); navigate('dashboard'); return; }

  const stages  = DB.getStagesList();
  const tbody   = document.getElementById('stagesListBody');
  const emptyEl = document.getElementById('stagesEmpty');
  if (!tbody) return;

  if (stages.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = stages.map((name, idx) => `
      <tr>
        <td style="color:var(--text-muted);font-size:13px">${idx + 1}</td>
        <td><strong>📍 ${escapeHtml(name)}</strong></td>
        <td>
          <div class="row-actions">
            <button class="action-btn" onclick="openEditStage('${escapeHtml(name)}')">${t('Edit','تعديل')}</button>
            <button class="action-btn danger" onclick="deleteStageItem('${escapeHtml(name)}')">${t('Delete','حذف')}</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  bindStagesEvents();
}

function bindStagesEvents() {
  document.getElementById('addStageBtn')?.addEventListener('click', openAddStage);
  document.getElementById('save-stage-btn')?.addEventListener('click', saveStage);
  document.getElementById('cancel-stage-btn')?.addEventListener('click', () => closeModal('stage-modal'));
  document.getElementById('stage-modal-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveStage();
  });
}

function openAddStage() {
  stageEditTarget = null;
  const title = document.getElementById('stage-modal-title');
  const input = document.getElementById('stage-modal-input');
  const err   = document.getElementById('stage-modal-err');
  const btn   = document.getElementById('save-stage-btn');
  if (title) title.textContent = t('Add Stage','إضافة مرحلة');
  if (input) input.value = '';
  if (err)   err.textContent = '';
  if (btn)   btn.textContent = t('Add','إضافة');
  openModal('stage-modal');
}

function openEditStage(name) {
  stageEditTarget = name;
  const title = document.getElementById('stage-modal-title');
  const input = document.getElementById('stage-modal-input');
  const err   = document.getElementById('stage-modal-err');
  const btn   = document.getElementById('save-stage-btn');
  if (title) title.textContent = t('Edit Stage','تعديل المرحلة');
  if (input) input.value = name;
  if (err)   err.textContent = '';
  if (btn)   btn.textContent = t('Save','حفظ');
  openModal('stage-modal');
}

function saveStage() {
  const input   = document.getElementById('stage-modal-input');
  const errEl   = document.getElementById('stage-modal-err');
  const newName = input?.value.trim() || '';

  if (!newName) {
    if (errEl) errEl.textContent = t('Stage name is required.','اسم المرحلة مطلوب.');
    return;
  }

  const existing = DB.getStagesList();

  if (stageEditTarget === null) {
    if (existing.map(s => s.toLowerCase()).includes(newName.toLowerCase())) {
      if (errEl) errEl.textContent = t('This stage already exists.','هذه المرحلة موجودة بالفعل.');
      return;
    }
    DB.addStageToList(newName);
    showToast(t('Stage added.','تم إضافة المرحلة.'), 'success');
  } else {
    if (
      newName.toLowerCase() !== stageEditTarget.toLowerCase() &&
      existing.map(s => s.toLowerCase()).includes(newName.toLowerCase())
    ) {
      if (errEl) errEl.textContent = t('This stage already exists.','هذه المرحلة موجودة بالفعل.');
      return;
    }
    DB.updateStageInList(stageEditTarget, newName);
    showToast(t('Stage updated.','تم تحديث المرحلة.'), 'success');
  }

  closeModal('stage-modal');
  renderStagesList();
}

function deleteStageItem(name) {
  confirmDelete(
    t(`Remove stage "${name}"?`, `إزالة المرحلة "${name}"؟`),
    () => {
      DB.removeStageFromList(name);
      showToast(t('Stage removed.','تم إزالة المرحلة.'), 'success');
      renderStagesList();
    }
  );
}
