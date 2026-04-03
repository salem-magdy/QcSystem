/* ============================================================
   lines.js — Lines Management
   ============================================================ */
'use strict';

function renderLinesList() {
  if (!canManage()) { showToast(t('Access denied.','غير مصرح.'), 'error'); navigate('dashboard'); return; }

  const lines   = DB.getLines();
  const tbody   = document.getElementById('linesBody');
  const emptyEl = document.getElementById('linesEmpty');
  if (!tbody) return;

  if (lines.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = lines.map((line, idx) => `
      <tr>
        <td style="color:var(--text-muted);font-size:13px">${idx + 1}</td>
        <td><strong>${t('Line','خط')} ${escapeHtml(line)}</strong></td>
        <td>
          <button class="action-btn danger" onclick="deleteLineItem('${escapeHtml(line)}')">${t('Delete','حذف')}</button>
        </td>
      </tr>
    `).join('');
  }

  bindLinesEvents();
}

function bindLinesEvents() {
  document.getElementById('addLineBtn')?.addEventListener('click', openAddLine);
  document.getElementById('save-line-btn')?.addEventListener('click', saveLine);
  document.getElementById('line-modal-input')?.addEventListener('keydown', e => { if(e.key==='Enter') saveLine(); });
}

function openAddLine() {
  const input = document.getElementById('line-modal-input');
  const err   = document.getElementById('line-modal-err');
  if (input) input.value = '';
  if (err)   err.textContent = '';
  openModal('line-modal');
}

function saveLine() {
  const input = document.getElementById('line-modal-input');
  const errEl = document.getElementById('line-modal-err');
  const value = input?.value.trim() || '';

  if (!value) { if(errEl) errEl.textContent = t('Line name is required.','اسم الخط مطلوب.'); return; }

  if (!DB.addLine(value)) {
    if (errEl) errEl.textContent = t('This line already exists.','هذا الخط موجود بالفعل.');
    return;
  }

  showToast(t(`Line ${value} added.`, `تم إضافة الخط ${value}.`), 'success');
  closeModal('line-modal');
  renderLinesList();
}

function deleteLineItem(line) {
  confirmDelete(
    t(`Remove Line ${line}? Existing inspections will not be affected.`,
      `إزالة الخط ${line}؟ لن تتأثر الفحوصات الموجودة.`),
    () => {
      DB.removeLine(line);
      showToast(t(`Line ${line} removed.`, `تم إزالة الخط ${line}.`), 'success');
      renderLinesList();
    }
  );
}
