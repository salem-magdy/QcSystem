/* ============================================================
   inspections.js — Inspections CRUD
   List, filters, search, pagination, form, images, detail
   ============================================================ */
'use strict';

let inspPage     = 1;
let inspPerPage  = 10;
let inspFiltered = [];
let inspEditId   = null;
let inspReOrigId = null;
let inspImages   = [];      // [{id, base64}] inspection-level
let defectImages = {};      // { rowIndex: [{id, base64}] }
let defectRowCount = 0;

/* ============================================================
   LIST
   ============================================================ */

function renderInspections() {
  // Check if we came from a dashboard stat card click
  if (window._dashFiltersForInsp) {
    const f = window._dashFiltersForInsp;
    window._dashFiltersForInsp = null; // clear after use

    // Pre-fill filter inputs
    const setInput = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setInput('inspDateFrom',    f.dateFrom);
    setInput('inspDateTo',      f.dateTo);
    setInput('inspStyleFilter', f.style);

    // Populate line filter first, then set value
    populateLineFilter();
    setInput('inspLineFilter',  f.line);

    // Set result filter
    const resEl = document.getElementById('inspResultFilter');
    if (resEl) resEl.value = f.result || '';

    // Set search to style if provided
    const searchEl = document.getElementById('inspSearch');
    if (searchEl) searchEl.value = '';

    applyInspFilters();
    bindInspListEvents();
    return;
  }

  populateLineFilter();
  applyInspFilters();
  bindInspListEvents();
}

function populateLineFilter() {
  const sel = document.getElementById('inspLineFilter');
  if (!sel) return;
  const cur   = sel.value;
  const lines = DB.getLines();
  sel.innerHTML = `<option value="">${t('All Lines','كل الخطوط')}</option>` +
    lines.map(l => `<option value="${escapeHtml(l)}" ${l===cur?'selected':''}>${escapeHtml(l)}</option>`).join('');
}

function applyInspFilters() {
  const search   = (document.getElementById('inspSearch')?.value     || '').toLowerCase().trim();
  const dateFrom = document.getElementById('inspDateFrom')?.value    || '';
  const dateTo   = document.getElementById('inspDateTo')?.value      || '';
  const line     = document.getElementById('inspLineFilter')?.value  || '';
  const result   = document.getElementById('inspResultFilter')?.value|| '';

  inspFiltered = DB.getInspections().filter(insp => {
    if (dateFrom && insp.date < dateFrom) return false;
    if (dateTo   && insp.date > dateTo)   return false;
    if (line     && insp.line !== line)   return false;
    if (result   && insp.result !== result) return false;
    if (search) {
      const hay = [insp.style, insp.po, insp.washing, insp.line,
        insp.inspector, insp.notes, insp.result,
        ...(insp.defects||[]).map(d=>d.name)].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  inspPage = 1;
  renderInspTable();
  renderPagination();
  updateInspMeta();
}

function updateInspMeta() {
  const el = document.getElementById('inspMeta');
  if (!el) return;
  const total = DB.getInspections().length;
  const shown = inspFiltered.length;
  el.textContent = total === shown
    ? t(`${total} inspection${total!==1?'s':''}`, `${total} فحص`)
    : t(`Showing ${shown} of ${total} inspections`, `عرض ${shown} من ${total} فحص`);
}

function renderInspTable() {
  const tbody   = document.getElementById('inspBody');
  const emptyEl = document.getElementById('inspEmpty');
  if (!tbody) return;

  const start = (inspPage - 1) * inspPerPage;
  const paged = inspFiltered.slice(start, start + inspPerPage);

  if (paged.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = paged.map(insp => {
    const defects     = insp.defects || [];
    const defectNames = defects.length
      ? defects.map(d => escapeHtml(d.name)).join(', ')
      : `<span style="color:var(--text-muted)">—</span>`;
    const defectTotal = defects.length
      ? defects.reduce((sum, d) => sum + (parseInt(d.quantity) || 0), 0)
      : `<span style="color:var(--text-muted)">—</span>`;

    return `
    <tr class="${insp.result==='fail'?'row-fail':''}" onclick="navigate('detail',{id:'${insp.id}'})">
      <td>${escapeHtml(insp.style)}</td>
      <td>${escapeHtml(insp.po)}</td>
      <td>${escapeHtml(insp.washing)}</td>
      <td>${escapeHtml(insp.line)}</td>
      <td>${insp.quantity ? escapeHtml(insp.quantity) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${escapeHtml(insp.inspector)}</td>
      <td>${formatDate(insp.date)}</td>
      <td style="max-width:160px;white-space:normal;font-size:12px;color:var(--text-muted)">${defectNames}</td>
      <td style="text-align:center;font-weight:600">${defectTotal}</td>
      <td>${resultBadge(insp.result)}</td>
      <td onclick="event.stopPropagation()">
        <div class="row-actions">
          ${viewBtn(insp.id)}
          ${editBtn(insp.id)}
          ${deleteBtn(insp.id)}
          ${insp.reInspOrigId ? `<span class="reinsp-tag">${t('RE-INSP','إعادة')}</span>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderPagination() {
  const container = document.getElementById('inspPagination');
  if (!container) return;

  const total      = inspFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / inspPerPage));

  let html = '';
  html += `<button class="page-btn" onclick="goToInspPage(${inspPage-1})" ${inspPage<=1?'disabled':''}>‹</button>`;

  getPageNums(inspPage, totalPages).forEach(p => {
    if (p === '...') html += `<span class="page-btn" style="cursor:default;border:none">…</span>`;
    else html += `<button class="page-btn ${p===inspPage?'active':''}" onclick="goToInspPage(${p})">${p}</button>`;
  });

  html += `<button class="page-btn" onclick="goToInspPage(${inspPage+1})" ${inspPage>=totalPages?'disabled':''}>›</button>`;
  container.innerHTML = html;
}

function getPageNums(cur, total) {
  if (total <= 7) return Array.from({length:total}, (_,i) => i+1);
  if (cur <= 4)   return [1,2,3,4,5,'...',total];
  if (cur >= total-3) return [1,'...',total-4,total-3,total-2,total-1,total];
  return [1,'...',cur-1,cur,cur+1,'...',total];
}

function goToInspPage(page) {
  const tp = Math.ceil(inspFiltered.length / inspPerPage);
  if (page < 1 || page > tp) return;
  inspPage = page;
  renderInspTable();
  renderPagination();
}

function bindInspListEvents() {
  const searchEl = document.getElementById('inspSearch');
  if (searchEl) searchEl.oninput = debounce(applyInspFilters, 300);

  ['inspDateFrom','inspDateTo','inspLineFilter','inspResultFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onchange = applyInspFilters;
  });

  const clearBtn = document.getElementById('inspClearFilters');
  if (clearBtn) clearBtn.onclick = () => {
    ['inspSearch','inspDateFrom','inspDateTo'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    ['inspLineFilter','inspResultFilter'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    applyInspFilters();
  };

  const perPage = document.getElementById('inspPerPage');
  if (perPage) {
    perPage.value = inspPerPage;
    perPage.onchange = () => { inspPerPage = parseInt(perPage.value)||10; inspPage=1; renderInspTable(); renderPagination(); };
  }

  const csvBtn = document.getElementById('exportCsvBtn');
  if (csvBtn) csvBtn.onclick = exportCSV;
  const pdfBtn = document.getElementById('exportPdfBtn');
  if (pdfBtn) pdfBtn.onclick = exportPDF;
}

/* ============================================================
   FORM — NEW / EDIT INSPECTION
   ============================================================ */

function openNewInspectionForm(params = {}) {
  inspEditId   = null;
  inspReOrigId = null;
  inspImages   = [];
  defectImages = {};
  defectRowCount = 0;

  resetInspForm();
  populateFormLineSelect();

  // Default date + inspector
  const dateEl = document.getElementById('fDate');
  if (dateEl) dateEl.value = todayISO();
  const inspEl = document.getElementById('fInspector');
  if (inspEl && currentUser) inspEl.value = currentUser.username;

  // Titles
  setFormTitles(t('New Inspection','فحص جديد'), t('Fill in the details below','أدخل التفاصيل أدناه'));

  // Re-inspection prefill
  if (params.reInspect && params.origId) setupReInspection(params.origId);

  // Edit prefill
  if (params.editId) loadForEdit(params.editId);

  updateDefectEmpty();
  bindFormEvents();
}

function resetInspForm() {
  ['fStyle','fPO','fWashing','fQty','fInspector','fNotes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['fLine','fDate'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('fResult').value = '';
  document.getElementById('editInspId').value = '';
  document.getElementById('reInspOrigId').value = '';

  // Clear result selector
  document.querySelectorAll('.status-opt').forEach(b => {
    b.classList.remove('active-pass','active-fail','active-hold');
  });

  // Clear defects
  const container = document.getElementById('defectRowsContainer');
  if (container) container.innerHTML = '';

  // Clear notice
  const notice = document.getElementById('reInspNotice');
  if (notice) notice.style.display = 'none';

  // Clear images
  const thumbs = document.getElementById('inspImageThumbs');
  if (thumbs) thumbs.innerHTML = '';

  // Clear field errors
  document.querySelectorAll('#page-new-inspection .field-error').forEach(el => el.textContent='');
  document.querySelectorAll('#page-new-inspection .form-input').forEach(el => el.classList.remove('invalid'));
}

function setFormTitles(title, subtitle) {
  const t1 = document.getElementById('insp-form-title');
  const t2 = document.getElementById('insp-form-subtitle');
  if (t1) t1.textContent = title;
  if (t2) t2.textContent = subtitle;
}

function populateFormLineSelect() {
  const sel = document.getElementById('fLine');
  if (!sel) return;
  sel.innerHTML = `<option value="">${t('Select line...','اختر الخط...')}</option>` +
    DB.getLines().map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
}

/* ── Re-inspection ── */
function setupReInspection(origId) {
  const orig = DB.getInspectionById(origId);
  if (!orig) return;
  inspReOrigId = origId;
  document.getElementById('reInspOrigId').value = origId;
  setVal('fStyle', orig.style); setVal('fPO', orig.po);
  setVal('fWashing', orig.washing); setVal('fLine', orig.line);
  setVal('fInspector', orig.inspector); setVal('fDate', todayISO());

  const notice = document.getElementById('reInspNotice');
  if (notice) {
    notice.style.display = '';
    notice.textContent = t(
      `Re-inspection linked to: ${orig.style} / ${orig.po} (${formatDate(orig.date)})`,
      `إعادة فحص مرتبطة بـ: ${orig.style} / ${orig.po} (${formatDate(orig.date)})`
    );
  }
  setFormTitles(t('Re-Inspection','إعادة فحص'), t('Based on original failed inspection','بناءً على الفحص الفاشل الأصلي'));
}

/* ── Edit ── */
function loadForEdit(id) {
  const insp = DB.getInspectionById(id);
  if (!insp) return;
  inspEditId = id;
  document.getElementById('editInspId').value = id;
  setVal('fStyle',insp.style); setVal('fPO',insp.po);
  setVal('fWashing',insp.washing); setVal('fLine',insp.line);
  setVal('fQty',insp.quantity); setVal('fInspector',insp.inspector);
  setVal('fDate',insp.date); setVal('fNotes',insp.notes||'');
  setResult(insp.result);
  (insp.defects||[]).forEach((d,idx) => addDefectRow(d, idx));
  if (insp.imageIds?.length) loadExistingInspImages(insp.imageIds);
  setFormTitles(t('Edit Inspection','تعديل الفحص'), t('Update the inspection details','قم بتحديث تفاصيل الفحص'));
}

function setResult(result) {
  document.getElementById('fResult').value = result;
  document.querySelectorAll('.status-opt').forEach(b => {
    b.classList.remove('active-pass','active-fail','active-hold');
    if (b.dataset.result === result) b.classList.add(`active-${result}`);
  });
}

async function loadExistingInspImages(ids) {
  for (const id of ids) {
    const base64 = await ImageDB.getImage(id);
    if (base64) {
      inspImages.push({id, base64});
      appendPhotoThumb('inspImageThumbs', id, base64, inspImages);
    }
  }
}

/* ── Bind form events ── */
function bindFormEvents() {
  // Result selector
  document.querySelectorAll('.status-opt').forEach(btn => {
    btn.onclick = () => setResult(btn.dataset.result);
  });

  // Add defect row
  const addBtn = document.getElementById('addDefectRowBtn');
  if (addBtn) addBtn.onclick = () => addDefectRow();

  // Save buttons (both top and bottom)
  ['saveInspBtn','saveInspBtn2'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = saveInspection;
  });

  // Inspection photo button
  const photoBtn = document.getElementById('inspPhotoAddBtn');
  const photoInput = document.getElementById('inspImageInput');
  if (photoBtn && photoInput) {
    photoBtn.onclick = () => photoInput.click();
    photoInput.onchange = (e) => handleInspImageUpload(e);
  }

  updateDefectEmpty();
}

/* ============================================================
   DEFECT ROWS
   ============================================================ */

function addDefectRow(data = {}, rowIndex = null) {
  const container = document.getElementById('defectRowsContainer');
  if (!container) return;

  const idx = rowIndex !== null ? rowIndex : defectRowCount;
  defectRowCount++;

  const defectsList = DB.getDefectsList();
  const stagesList  = DB.getStagesList();
  const isOther = data.name && !defectsList.includes(data.name);

  const optionsHtml = defectsList.map(d =>
    `<option value="${escapeHtml(d)}" ${d===data.name?'selected':''}>${escapeHtml(d)}</option>`
  ).join('');

  const stageOptionsHtml = stagesList.map(s =>
    `<option value="${escapeHtml(s)}" ${s===data.stage?'selected':''}>${escapeHtml(s)}</option>`
  ).join('');

  const row = document.createElement('div');
  row.className = 'defect-row';
  row.dataset.rowIdx = idx;

  row.innerHTML = `
    <div class="defect-row-top">
      <div class="defect-name-wrap">
        <label class="form-label" data-en="Defect Name" data-ar="اسم العيب">${t('Defect Name','اسم العيب')}</label>
        <select class="form-input defect-name-sel">
          <option value="">${t('Select defect...','اختر العيب...')}</option>
          ${optionsHtml}
          <option value="__other__" ${isOther?'selected':''}>${t('Other...','أخرى...')}</option>
        </select>
        <input type="text" class="form-input defect-name-input" style="margin-top:6px;${isOther?'':'display:none'}"
               placeholder="${t('Type defect name','اكتب اسم العيب')}"
               value="${isOther?escapeHtml(data.name):''}" />
      </div>
      <div class="defect-qty-wrap">
        <label class="form-label" data-en="Stage" data-ar="المرحلة">${t('Stage','المرحلة')}</label>
        <select class="form-input defect-stage-sel">
          <option value="">${t('Select stage...','اختر المرحلة...')}</option>
          ${stageOptionsHtml}
        </select>
      </div>
      <div class="defect-qty-wrap">
        <label class="form-label" data-en="Quantity" data-ar="الكمية">${t('Quantity','الكمية')}</label>
        <input type="number" class="form-input defect-qty" min="1"
               placeholder="${t('Qty','الكمية')}" value="${data.quantity||''}" />
      </div>
      <button type="button" class="defect-remove" title="${t('Remove','إزالة')}">✕</button>
    </div>
    <div class="defect-row-bottom">
      <div>
        <div class="form-label" style="margin-bottom:6px" data-en="Severity" data-ar="الخطورة">${t('Severity','الخطورة')}</div>
        <div class="severity-selector">
          <button type="button" class="sev-btn ${data.severity==='critical'?'active-critical':''}" data-sev="critical">${t('Critical','حرج')}</button>
          <button type="button" class="sev-btn ${data.severity==='major'?'active-major':''}"    data-sev="major">${t('Major','رئيسي')}</button>
          <button type="button" class="sev-btn ${data.severity==='minor'?'active-minor':''}"    data-sev="minor">${t('Minor','ثانوي')}</button>
        </div>
        <input type="hidden" class="defect-severity-val" value="${data.severity||''}" />
      </div>
      <div>
        <div class="form-label" style="margin-bottom:6px" data-en="Photos (max 5)" data-ar="صور (حد 5)">${t('Photos (max 5)','صور (حد 5)')}</div>
        <div class="photo-section">
          <div class="photo-upload-area">
            <button type="button" class="photo-add-btn defect-photo-btn">
              📷 <span>${t('Add','إضافة')}</span>
            </button>
            <input type="file" class="defect-img-input" accept="image/*" multiple hidden />
          </div>
          <div class="photo-previews defect-thumbs" id="defectThumbs_${idx}"></div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(row);

  // Toggle Other input
  const nameSel   = row.querySelector('.defect-name-sel');
  const nameInput = row.querySelector('.defect-name-input');
  nameSel.addEventListener('change', () => {
    nameInput.style.display = nameSel.value === '__other__' ? '' : 'none';
    if (nameSel.value !== '__other__') nameInput.value = '';
  });

  // Severity buttons
  const sevVal = row.querySelector('.defect-severity-val');
  row.querySelectorAll('.sev-btn').forEach(btn => {
    btn.onclick = () => {
      row.querySelectorAll('.sev-btn').forEach(b => b.className='sev-btn');
      btn.classList.add(`active-${btn.dataset.sev}`);
      sevVal.value = btn.dataset.sev;
    };
  });

  // Remove row
  row.querySelector('.defect-remove').onclick = () => {
    delete defectImages[idx];
    row.remove();
    updateDefectEmpty();
  };

  // Photo upload
  const photoBtn   = row.querySelector('.defect-photo-btn');
  const photoInput = row.querySelector('.defect-img-input');
  photoBtn.onclick  = () => photoInput.click();
  photoInput.onchange = (e) => handleDefectImageUpload(e, idx);

  // Load existing defect images if editing
  if (data.imageIds?.length) loadExistingDefectImages(data.imageIds, idx);

  updateDefectEmpty();
}

function updateDefectEmpty() {
  const container = document.getElementById('defectRowsContainer');
  const emptyEl   = document.getElementById('defectEmpty');
  if (!container || !emptyEl) return;
  emptyEl.style.display = container.children.length > 0 ? 'none' : '';
}

async function loadExistingDefectImages(ids, rowIdx) {
  if (!defectImages[rowIdx]) defectImages[rowIdx] = [];
  for (const id of ids) {
    const base64 = await ImageDB.getImage(id);
    if (base64) {
      defectImages[rowIdx].push({id, base64});
      appendPhotoThumb(`defectThumbs_${rowIdx}`, id, base64, defectImages[rowIdx]);
    }
  }
}

/* ============================================================
   IMAGE HANDLING
   ============================================================ */

async function handleInspImageUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  const remaining = 5 - inspImages.length;
  if (remaining <= 0) { showToast(t('Max 5 photos per inspection.','الحد الأقصى 5 صور للفحص.'), 'warning'); return; }
  for (const file of files.slice(0, remaining)) {
    const base64 = await ImageUtil.compress(file);
    const id     = ImageUtil.newId();
    inspImages.push({id, base64});
    appendPhotoThumb('inspImageThumbs', id, base64, inspImages);
  }
  e.target.value = '';
}

async function handleDefectImageUpload(e, rowIdx) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  if (!defectImages[rowIdx]) defectImages[rowIdx] = [];
  const remaining = 5 - defectImages[rowIdx].length;
  if (remaining <= 0) { showToast(t('Max 5 photos per defect.','الحد الأقصى 5 صور للعيب.'), 'warning'); return; }
  for (const file of files.slice(0, remaining)) {
    const base64 = await ImageUtil.compress(file);
    const id     = ImageUtil.newId();
    defectImages[rowIdx].push({id, base64});
    appendPhotoThumb(`defectThumbs_${rowIdx}`, id, base64, defectImages[rowIdx]);
  }
  e.target.value = '';
}

function appendPhotoThumb(containerId, id, base64, arr) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const thumb = document.createElement('div');
  thumb.className = 'photo-thumb';
  thumb.id = `thumb_${id}`;
  thumb.innerHTML = `<img src="${base64}" alt="" /><button class="photo-thumb-remove" title="${t('Remove','إزالة')}">✕</button>`;
  thumb.querySelector('img').onclick = () => openLightbox(base64);
  thumb.querySelector('.photo-thumb-remove').onclick = (e) => {
    e.stopPropagation();
    const idx2 = arr.findIndex(img => img.id === id);
    if (idx2 > -1) arr.splice(idx2, 1);
    thumb.remove();
  };
  container.appendChild(thumb);
}

/* ============================================================
   SAVE INSPECTION
   ============================================================ */

async function saveInspection() {
  if (!validateInspForm()) return;

  const saveBtn  = document.getElementById('saveInspBtn');
  const saveBtn2 = document.getElementById('saveInspBtn2');
  if (saveBtn)  saveBtn.disabled  = true;
  if (saveBtn2) saveBtn2.disabled = true;

  try {
    // Collect defect rows
    const defects = collectDefects();

    // Save all images to IndexedDB
    for (const img of inspImages) await ImageDB.saveImage(img.id, img.base64);
    for (const rowIdx of Object.keys(defectImages)) {
      for (const img of defectImages[rowIdx]) await ImageDB.saveImage(img.id, img.base64);
    }

    // Attach defect image IDs
    defects.forEach(d => {
      const rowIdx = d._rowIdx;
      d.imageIds = (defectImages[rowIdx]||[]).map(img => img.id);
      delete d._rowIdx;
    });

    const now  = new Date().toISOString();
    const user = currentUser.username;

    if (inspEditId) {
      DB.updateInspection(inspEditId, {
        style:    getVal('fStyle'), po: getVal('fPO'), washing: getVal('fWashing'),
        line:     getVal('fLine'), quantity: parseInt(getVal('fQty'))||0,
        inspector:getVal('fInspector'), date: getVal('fDate'), result: getVal('fResult'),
        notes:    getVal('fNotes'), defects, imageIds: inspImages.map(i=>i.id),
        lastEditedBy: user, lastEditedAt: now,
      });
      showToast(t('Inspection updated.','تم تحديث الفحص.'), 'success');
    } else {
      DB.addInspection({
        id:          generateId(),
        style:       getVal('fStyle'), po: getVal('fPO'), washing: getVal('fWashing'),
        line:        getVal('fLine'), quantity: parseInt(getVal('fQty'))||0,
        inspector:   getVal('fInspector'), date: getVal('fDate'), result: getVal('fResult'),
        notes:       getVal('fNotes'), defects, imageIds: inspImages.map(i=>i.id),
        createdBy:   user, createdAt: now, lastEditedBy: user, lastEditedAt: now,
        reInspOrigId: inspReOrigId || null,
      });
      showToast(t('Inspection saved.','تم حفظ الفحص.'), 'success');
    }

    updateStorageBar();
    navigate('inspections');
  } catch(err) {
    console.error(err);
    showToast(t('Error saving. Please try again.','خطأ في الحفظ. حاول مرة أخرى.'), 'error');
  } finally {
    if (saveBtn)  saveBtn.disabled  = false;
    if (saveBtn2) saveBtn2.disabled = false;
  }
}

function collectDefects() {
  const rows = [];
  document.querySelectorAll('#defectRowsContainer .defect-row').forEach(row => {
    const idx       = parseInt(row.dataset.rowIdx);
    const nameSel   = row.querySelector('.defect-name-sel');
    const nameInput = row.querySelector('.defect-name-input');
    const stageSel  = row.querySelector('.defect-stage-sel');
    const severity  = row.querySelector('.defect-severity-val')?.value || '';
    const qty       = parseInt(row.querySelector('.defect-qty')?.value) || 0;
    const name      = nameSel?.value === '__other__'
      ? (nameInput?.value.trim() || '')
      : (nameSel?.value || '');
    const stage     = stageSel?.value || '';
    if (name) rows.push({name, stage, severity, quantity: qty, _rowIdx: idx, imageIds:[]});
  });
  return rows;
}

function validateInspForm() {
  let valid = true;
  const required = [
    ['fStyle',     t('Style is required.',        'الستايل مطلوب.')],
    ['fPO',        t('PO is required.',            'رقم أمر الشراء مطلوب.')],
    ['fWashing',   t('Washing name is required.', 'اسم الغسيل مطلوب.')],
    ['fLine',      t('Line is required.',          'الخط مطلوب.')],
    ['fInspector', t('Inspector is required.',     'اسم المفتش مطلوب.')],
    ['fDate',      t('Date is required.',          'التاريخ مطلوب.')],
    ['fResult',    t('Result is required.',        'النتيجة مطلوبة.')],
  ];
  required.forEach(([id, msg]) => {
    const el = document.getElementById(id);
    const er = document.getElementById(id+'Err');
    if (!el?.value?.trim()) {
      el?.classList.add('invalid');
      if (er) er.textContent = msg;
      valid = false;
    } else {
      el?.classList.remove('invalid');
      if (er) er.textContent = '';
    }
  });
  return valid;
}

/* ── Edit shortcut ── */
function openEditInspection(id) {
  navigate('new-inspection', {editId: id});
}

/* ============================================================
   DELETE
   ============================================================ */

function deleteInspectionConfirm(id) {
  if (!canDelete()) { showToast(t('Permission denied.','غير مصرح.'), 'error'); return; }
  const insp = DB.getInspectionById(id);
  if (!insp) return;
  confirmDelete(
    t(`Delete inspection "${insp.style} / ${insp.po}"? This cannot be undone.`,
      `حذف فحص "${insp.style} / ${insp.po}"؟ لا يمكن التراجع.`),
    async () => {
      const ids = [...(insp.imageIds||[]), ...(insp.defects||[]).flatMap(d=>d.imageIds||[])];
      await ImageDB.deleteImages(ids);
      DB.deleteInspection(id);
      updateStorageBar();
      showToast(t('Inspection deleted.','تم حذف الفحص.'), 'success');
      if (currentSection === 'detail') navigate('inspections');
      else renderInspections();
    }
  );
}

/* ============================================================
   DETAIL VIEW
   ============================================================ */

async function renderDetail(id) {
  const insp      = DB.getInspectionById(id);
  const contentEl = document.getElementById('detailContent');
  const actionsEl = document.getElementById('detailActions');
  if (!insp || !contentEl) { showToast(t('Not found.','غير موجود.'), 'error'); navigate('inspections'); return; }

  // Back button
  const backBtn = document.getElementById('detailBackBtn');
  if (backBtn) backBtn.onclick = () => navigate('inspections');

  // Action buttons
  if (actionsEl) {
    let btns = `
      <button class="btn btn-ghost btn-sm" onclick="printInspectionRecord('${insp.id}')">
        🖨️ ${t('Export PDF','تصدير PDF')}
      </button>
      ${editBtn(insp.id)}
      ${deleteBtn(insp.id)}`;
    if (insp.result === 'fail') {
      btns += `<button class="btn btn-ghost btn-sm" onclick="navigate('new-inspection',{reInspect:true,origId:'${insp.id}'})">
        🔄 ${t('Re-Inspect','إعادة فحص')}
      </button>`;
    }
    actionsEl.innerHTML = btns;
  }

  // Re-inspection link notice
  let reInspHtml = '';
  if (insp.reInspOrigId) {
    const orig = DB.getInspectionById(insp.reInspOrigId);
    if (orig) {
      reInspHtml = `<div class="reinsp-notice">
        🔄 ${t(`Re-inspection of: ${orig.style} / ${orig.po} (${formatDate(orig.date)})`,
                `إعادة فحص: ${orig.style} / ${orig.po} (${formatDate(orig.date)})`)}
      </div>`;
    }
  }

  // Inspection-level images
  let inspPhotosHtml = '';
  if (insp.imageIds?.length) {
    const thumbs = await buildPhotoThumbs(insp.imageIds);
    inspPhotosHtml = `
      <div class="detail-card">
        <div class="detail-section-title">${t('Inspection Photos','صور الفحص')}</div>
        <div class="defect-photos-grid">${thumbs}</div>
      </div>`;
  }

  // Defects
  let defectsHtml = '';
  if (insp.defects?.length) {
    const sevChips = severitySummaryChips(insp.defects);
    const rows = await Promise.all(insp.defects.map(async d => {
      let photos = '';
      if (d.imageIds?.length) photos = await buildPhotoThumbs(d.imageIds);
      return `
        <div class="defect-detail-card">
          <div class="defect-detail-header">
            <span class="defect-detail-desc">${escapeHtml(d.name)}</span>
            <div class="defect-detail-meta">
              ${d.stage ? `<span class="detail-meta-chip">📍 ${escapeHtml(d.stage)}</span>` : ''}
              ${severityBadge(d.severity)}
              <span class="defect-qty-chip">${t('Qty','الكمية')}: ${escapeHtml(d.quantity)}</span>
            </div>
          </div>
          ${photos ? `
          <div class="defect-photos-grid" style="padding:12px 16px;border-top:1px solid var(--border)">
            ${photos}
          </div>` : ''}
        </div>`;
    }));
    defectsHtml = `
      <div class="detail-card">
        <div class="detail-section-title">${t('Defects','العيوب')}</div>
        <div class="defect-summary">${sevChips}</div>
        ${rows.join('')}
      </div>`;
  } else {
    defectsHtml = `
      <div class="detail-card">
        <div class="detail-section-title">${t('Defects','العيوب')}</div>
        <div class="empty-state" style="padding:20px 0">
          <div class="empty-text">${t('No defects recorded.','لم يتم تسجيل أي عيوب.')}</div>
        </div>
      </div>`;
  }

  // Re-inspect CTA
  const reInspCta = insp.result === 'fail' ? `
    <div class="reinsp-cta">
      <div class="reinsp-cta-text">
        <strong>${t('This inspection failed.','فشل هذا الفحص.')}</strong>
        ${t(' Would you like to create a re-inspection?',' هل تريد إنشاء إعادة فحص؟')}
      </div>
      <button class="btn btn-new" onclick="navigate('new-inspection',{reInspect:true,origId:'${insp.id}'})">
        ${t('Create Re-inspection','إنشاء إعادة فحص')}
      </button>
    </div>` : '';

  contentEl.innerHTML = `
    ${reInspHtml}

    <!-- Hero -->
    <div class="detail-hero">
      <div>
        <div class="detail-po">${escapeHtml(insp.style)} / ${escapeHtml(insp.po)}</div>
        <div class="detail-meta-row">
          <span class="detail-meta-chip">📅 ${formatDate(insp.date)}</span>
          <span class="detail-meta-chip">🏭 ${t('Line','خط')} ${escapeHtml(insp.line)}</span>
          <span class="detail-meta-chip">👤 ${escapeHtml(insp.inspector)}</span>
        </div>
      </div>
      <div class="detail-hero-right">
        ${resultBadge(insp.result)}
        ${insp.reInspOrigId ? `<span class="detail-reinsp-tag">${t('RE-INSPECTION','إعادة فحص')}</span>` : ''}
      </div>
    </div>

    <!-- Info cards -->
    <div class="detail-grid">
      <div class="detail-info-card">
        <div class="detail-section-title">${t('Order Info','معلومات الطلب')}</div>
        <div class="detail-fields">
          <div class="detail-field">
            <span class="detail-field-label">${t('Style','الستايل')}</span>
            <span class="detail-field-val">${escapeHtml(insp.style)}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">${t('PO Number','رقم الطلب')}</span>
            <span class="detail-field-val">${escapeHtml(insp.po)}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">${t('Washing','الغسيل')}</span>
            <span class="detail-field-val">${escapeHtml(insp.washing)}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">${t('Line','الخط')}</span>
            <span class="detail-field-val">${escapeHtml(insp.line)}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">${t('Quantity','الكمية')}</span>
            <span class="detail-field-val">${escapeHtml(insp.quantity)}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">${t('Inspector','المفتش')}</span>
            <span class="detail-field-val">${escapeHtml(insp.inspector)}</span>
          </div>
        </div>
      </div>
      <div class="detail-info-card">
        <div class="detail-section-title">${t('Record Info','معلومات السجل')}</div>
        <div class="detail-fields">
          <div class="detail-field">
            <span class="detail-field-label">${t('Result','النتيجة')}</span>
            <span class="detail-field-val">${resultBadge(insp.result)}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">${t('Date','التاريخ')}</span>
            <span class="detail-field-val">${formatDate(insp.date)}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">${t('Created By','أنشئ بواسطة')}</span>
            <span class="detail-field-val">${escapeHtml(insp.createdBy||'—')}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">${t('Created At','تاريخ الإنشاء')}</span>
            <span class="detail-field-val">${formatDateTime(insp.createdAt)}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">${t('Last Edited By','آخر تعديل')}</span>
            <span class="detail-field-val">${escapeHtml(insp.lastEditedBy||'—')}</span>
          </div>
          <div class="detail-field">
            <span class="detail-field-label">${t('Updated At','تاريخ التحديث')}</span>
            <span class="detail-field-val">${formatDateTime(insp.lastEditedAt)}</span>
          </div>
        </div>
      </div>
    </div>

    ${insp.notes ? `
    <div class="detail-card">
      <div class="detail-section-title">${t('Notes','ملاحظات')}</div>
      <div class="detail-notes">${escapeHtml(insp.notes)}</div>
    </div>` : ''}

    ${defectsHtml}
    ${inspPhotosHtml}
    ${reInspCta}
  `;

  // Bind lightbox to all photo thumbs
  contentEl.querySelectorAll('.defect-photo-thumb').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
}

async function buildPhotoThumbs(ids) {
  const thumbs = [];
  for (const id of ids) {
    const base64 = await ImageDB.getImage(id);
    if (base64) thumbs.push(`<img class="defect-photo-thumb" src="${base64}" alt="" />`);
  }
  return thumbs.join('');
}

/* ============================================================
   EXPORT
   ============================================================ */

function exportCSV() {
  const headers = ['Style','PO','Washing','Line','Qty','Inspector','Date','Defects','Defect Total Qty','Result','Notes','Created By'];
  const rows = inspFiltered.map(i => {
    const defects     = i.defects || [];
    const defectNames = defects.map(d => d.name).join('; ');
    const defectTotal = defects.reduce((sum, d) => sum + (parseInt(d.quantity)||0), 0);
    return [
      i.style, i.po, i.washing, i.line, i.quantity||'',
      i.inspector, i.date, defectNames, defectTotal,
      i.result, i.notes||'', i.createdBy||'',
    ];
  });
  const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile(csv, `TC_QC_${todayISO()}.csv`, 'text/csv;charset=utf-8;');
  showToast(t('CSV exported.','تم تصدير CSV.'), 'success');
}

function exportPDF() {
  const dir  = currentLang === 'ar' ? 'rtl' : 'ltr';
  const lang = currentLang;

  const resultColors = { pass:'#34d399', fail:'#f87171', hold:'#fbbf24' };
  const resultLabels = {
    en: { pass:'Pass', fail:'Fail', hold:'Hold' },
    ar: { pass:'ناجح', fail:'راسب', hold:'معلق' },
  };

  const tableRows = inspFiltered.map((insp, idx) => {
    const defects     = insp.defects || [];
    const defectNames = defects.length
      ? defects.map(d => `${escapeHtml(d.name)}${d.stage ? ` <span style="color:#a0aec0">(${escapeHtml(d.stage)})</span>` : ''}`)
               .join('<br/>')
      : '<span style="color:#a0aec0">—</span>';
    const defectTotal = defects.reduce((s,d) => s + (parseInt(d.quantity)||0), 0);
    const resColor    = resultColors[insp.result] || '#a0aec0';
    const resLabel    = (resultLabels[lang]||resultLabels.en)[insp.result] || insp.result;
    const rowBg       = insp.result === 'fail' ? 'background:#fff5f5' : (idx%2===0 ? '' : 'background:#f7fafc');

    return `<tr style="${rowBg}">
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(insp.style)}</strong></td>
      <td>${escapeHtml(insp.po)}</td>
      <td>${escapeHtml(insp.washing)}</td>
      <td style="text-align:center">${escapeHtml(insp.line)}</td>
      <td style="text-align:center">${insp.quantity || '—'}</td>
      <td>${escapeHtml(insp.inspector)}</td>
      <td style="white-space:nowrap">${formatDate(insp.date)}</td>
      <td style="font-size:11px;line-height:1.6">${defectNames}</td>
      <td style="text-align:center;font-weight:700">${defects.length ? defectTotal : '—'}</td>
      <td style="text-align:center">
        <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:${resColor};background:${resColor}20;border:1.5px solid ${resColor}">${resLabel}</span>
      </td>
    </tr>`;
  }).join('');

  // Summary counts
  const total = inspFiltered.length;
  const pass  = inspFiltered.filter(i=>i.result==='pass').length;
  const fail  = inspFiltered.filter(i=>i.result==='fail').length;
  const hold  = inspFiltered.filter(i=>i.result==='hold').length;

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>T&amp;C — QC Inspection Export</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #1a202c;
      background: #fff;
      direction: ${dir};
      padding: 20px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #6c63ff;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #6c63ff, #ff6b35);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }
    .brand-name { font-size: 18px; font-weight: 900; color: #1a202c; }
    .brand-name span { color: #6c63ff; }
    .brand-sub { font-size: 10px; color: #a0aec0; margin-top: 1px; }
    .export-meta { font-size: 11px; color: #4a5568; text-align: ${dir==='rtl'?'left':'right'}; }
    .export-meta strong { color: #1a202c; }

    .summary {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .summary-chip {
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      border: 1.5px solid;
    }
    .chip-total  { color:#6c63ff; background:#6c63ff15; border-color:#6c63ff; }
    .chip-pass   { color:#34d399; background:#34d39915; border-color:#34d399; }
    .chip-fail   { color:#f87171; background:#f8717115; border-color:#f87171; }
    .chip-hold   { color:#fbbf24; background:#fbbf2415; border-color:#fbbf24; }

    .table-wrap { overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      min-width: 700px;
    }
    thead { position: sticky; top: 0; }
    th {
      background: #1a202c;
      color: #f7fafc;
      padding: 9px 10px;
      text-align: ${dir==='rtl'?'right':'left'};
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    td {
      padding: 9px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      color: #1a202c;
    }
    tr:last-child td { border-bottom: none; }

    .footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #a0aec0;
    }

    @media print {
      body { padding: 10px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .table-wrap { overflow: visible; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="brand">
      <div class="brand-icon">✅</div>
      <div>
        <div class="brand-name">T&amp;<span>C</span></div>
        <div class="brand-sub">QC Inspection Export</div>
      </div>
    </div>
    <div class="export-meta">
      <div>${t('Exported:','تصدير:')} ${new Date().toLocaleString(lang==='ar'?'ar-EG':'en-GB')}</div>
      <div><strong>${total}</strong> ${t('record(s)','سجل')}</div>
    </div>
  </div>

  <div class="summary">
    <span class="summary-chip chip-total">📋 ${t('Total','الإجمالي')}: ${total}</span>
    <span class="summary-chip chip-pass">✅ ${t('Pass','ناجح')}: ${pass}</span>
    <span class="summary-chip chip-fail">❌ ${t('Fail','راسب')}: ${fail}</span>
    <span class="summary-chip chip-hold">⏸️ ${t('Hold','معلق')}: ${hold}</span>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>${t('Style','الستايل')}</th>
          <th>${t('PO','الطلب')}</th>
          <th>${t('Washing','الغسيل')}</th>
          <th>${t('Line','الخط')}</th>
          <th>${t('Qty','الكمية')}</th>
          <th>${t('Inspector','المفتش')}</th>
          <th>${t('Date','التاريخ')}</th>
          <th>${t('Defects','العيوب')}</th>
          <th>${t('Def. Qty','كمية العيوب')}</th>
          <th>${t('Result','النتيجة')}</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <div class="footer">
    <span>T&amp;C ${t('Garment Factory — QC Inspection System','مصنع الملابس — نظام فحص الجودة')}</span>
    <span>${t('Confidential','سري')}</span>
  </div>

</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    showToast(t('Please allow popups to export PDF.','يرجى السماح بالنوافذ المنبثقة.'), 'warning');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

/* ── Helpers ── */
function getVal(id) { return document.getElementById(id)?.value?.trim() || ''; }
function setVal(id, val) { const el=document.getElementById(id); if(el) el.value=val||''; }

/* ============================================================
   PRINT / EXPORT PDF — Single Inspection Record
   ============================================================ */

async function printInspectionRecord(id) {
  const insp = DB.getInspectionById(id);
  if (!insp) { showToast(t('Inspection not found.','الفحص غير موجود.'), 'error'); return; }

  // Build defect rows HTML
  let defectsHTML = '';
  if (insp.defects && insp.defects.length > 0) {
    const sevLabel = { critical: t('Critical','حرج'), major: t('Major','رئيسي'), minor: t('Minor','ثانوي') };
    const sevColor = { critical: '#f87171', major: '#fbbf24', minor: '#60a5fa' };

    const rows = await Promise.all(insp.defects.map(async (d, idx) => {
      // Load defect photos
      let photosHTML = '';
      if (d.imageIds && d.imageIds.length > 0) {
        const photoImgs = [];
        for (const imgId of d.imageIds) {
          const base64 = await ImageDB.getImage(imgId);
          if (base64) photoImgs.push(`<img src="${base64}" class="print-photo" />`);
        }
        if (photoImgs.length) {
          photosHTML = `<div class="print-photos">${photoImgs.join('')}</div>`;
        }
      }

      return `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${escapeHtml(d.name)}</strong></td>
          <td>${d.stage ? escapeHtml(d.stage) : '—'}</td>
          <td><span class="print-sev" style="color:${sevColor[d.severity]||'#a8b4cc'};border-color:${sevColor[d.severity]||'#a8b4cc'}">${sevLabel[d.severity] || d.severity || '—'}</span></td>
          <td>${escapeHtml(d.quantity)}</td>
        </tr>
        ${photosHTML ? `
        <tr>
          <td colspan="5" style="padding:10px 12px;background:#f7fafc;border-bottom:1px solid #e2e8f0">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#a0aec0;margin-bottom:8px">${t('Photos','الصور')}</div>
            <div class="print-photos" style="margin-top:0">${photosHTML}</div>
          </td>
        </tr>` : ''}`;
    }));
    defectsHTML = rows.join('');
  }

  // Load inspection-level photos
  let inspPhotosHTML = '';
  if (insp.imageIds && insp.imageIds.length > 0) {
    const imgs = [];
    for (const imgId of insp.imageIds) {
      const base64 = await ImageDB.getImage(imgId);
      if (base64) imgs.push(`<img src="${base64}" class="print-photo" />`);
    }
    if (imgs.length) {
      inspPhotosHTML = `
        <div class="print-section">
          <div class="print-section-title">${t('Inspection Photos','صور الفحص')}</div>
          <div class="print-photos">${imgs.join('')}</div>
        </div>`;
    }
  }

  // Result badge style
  const resultColors = { pass: '#34d399', fail: '#f87171', hold: '#fbbf24' };
  const resultLabels = {
    en: { pass:'Pass', fail:'Fail', hold:'Hold' },
    ar: { pass:'ناجح', fail:'راسب', hold:'معلق' },
  };
  const resultColor = resultColors[insp.result] || '#a8b4cc';
  const resultLabel = (resultLabels[currentLang]||resultLabels.en)[insp.result] || insp.result;

  // Re-inspection note
  let reInspNote = '';
  if (insp.reInspOrigId) {
    const orig = DB.getInspectionById(insp.reInspOrigId);
    if (orig) {
      reInspNote = `<div class="print-reinsp-note">
        🔄 ${t('Re-inspection of:','إعادة فحص:') } ${escapeHtml(orig.style)} / ${escapeHtml(orig.po)} (${formatDate(orig.date)})
      </div>`;
    }
  }

  const dir  = currentLang === 'ar' ? 'rtl' : 'ltr';
  const lang = currentLang;

  const printHTML = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>T&amp;C QC — ${escapeHtml(insp.style)} / ${escapeHtml(insp.po)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 12px;
      color: #1a202c;
      background: #fff;
      direction: ${dir};
    }

    .print-page {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 20px;
    }

    /* ── Header ── */
    .print-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 3px solid #6c63ff;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .print-brand { display: flex; align-items: center; gap: 10px; }
    .print-brand-icon {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, #6c63ff, #ff6b35);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    .print-brand-name { font-size: 18px; font-weight: 900; color: #1a202c; }
    .print-brand-name span { color: #6c63ff; }
    .print-brand-sub { font-size: 10px; color: #a0aec0; margin-top: 1px; }
    .print-header-right { text-align: ${dir === 'rtl' ? 'left' : 'right'}; flex-shrink: 0; }
    .print-header-date { font-size: 10px; color: #a0aec0; margin-bottom: 5px; }
    .print-result-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      color: ${resultColor};
      background: ${resultColor}20;
      border: 1.5px solid ${resultColor};
    }

    /* ── Re-inspection note ── */
    .print-reinsp-note {
      background: #fff7ed;
      border: 1px solid #ff6b3540;
      border-radius: 7px;
      padding: 8px 12px;
      font-size: 11px;
      color: #ff6b35;
      margin-bottom: 14px;
    }

    /* ── Hero ── */
    .print-hero {
      background: #f7f8ff;
      border-radius: 9px;
      padding: 14px 16px;
      margin-bottom: 16px;
      border-left: 4px solid #6c63ff;
    }
    [dir="rtl"] .print-hero { border-left: none; border-right: 4px solid #6c63ff; }
    .print-hero-title {
      font-size: 16px;
      font-weight: 800;
      color: #1a202c;
      margin-bottom: 8px;
      word-break: break-all;
    }
    .print-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .print-chip {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 2px 10px;
      font-size: 11px;
      color: #4a5568;
      font-weight: 500;
      white-space: nowrap;
    }

    /* ── Section wrapper ── */
    .print-section {
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      padding: 14px 16px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .print-section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #a0aec0;
      margin-bottom: 10px;
      padding-bottom: 7px;
      border-bottom: 1px solid #f1f5f9;
    }

    /* ── Field rows — single column, label left / value right ── */
    .print-fields { width: 100%; }
    .print-field {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      padding: 5px 0;
      border-bottom: 1px solid #f7fafc;
    }
    .print-field:last-child { border-bottom: none; }
    .print-field-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #a0aec0;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .print-field-val {
      font-size: 12px;
      font-weight: 600;
      color: #1a202c;
      text-align: ${dir === 'rtl' ? 'left' : 'right'};
      word-break: break-word;
    }

    /* Two-column only on wider screens */
    .print-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    @media (max-width: 500px) {
      .print-grid { grid-template-columns: 1fr; }
    }

    /* ── Notes ── */
    .print-notes {
      background: #f7fafc;
      border-radius: 7px;
      padding: 10px 12px;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
      color: #4a5568;
    }

    /* ── Defects table ── */
    .print-table-wrap { overflow-x: auto; }
    .print-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      min-width: 400px;
    }
    .print-table th {
      background: #2d3748;
      color: #f7fafc;
      padding: 8px 10px;
      text-align: ${dir === 'rtl' ? 'right' : 'left'};
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .print-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
      color: #1a202c;
    }
    .print-table tr:last-child td { border-bottom: none; }
    .print-table tr:nth-child(even) td { background: #f7fafc; }
    .print-sev {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
      border: 1.5px solid;
      white-space: nowrap;
    }

    /* ── Photos ── */
    .print-photos {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .print-photo {
      width: 90px;
      height: 90px;
      object-fit: cover;
      border-radius: 7px;
      border: 1px solid #e2e8f0;
    }

    /* ── Audit ── */
    .print-audit-row {
      display: flex;
      gap: 8px;
      font-size: 11px;
      color: #4a5568;
      padding: 4px 0;
      align-items: flex-start;
    }
    .print-audit-row strong { color: #1a202c; }

    /* ── Signatures ── */
    .print-signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 10px;
    }
    .print-signature-box {
      border-top: 1.5px solid #1a202c;
      padding-top: 6px;
      font-size: 10px;
      color: #4a5568;
      text-align: center;
    }

    /* ── Footer ── */
    .print-footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #a0aec0;
    }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .print-page { padding: 10px; max-width: 100%; }
      .print-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="print-page">

  <!-- Header -->
  <div class="print-header">
    <div class="print-brand">
      <div class="print-brand-icon">✅</div>
      <div>
        <div class="print-brand-name">T&amp;<span>C</span></div>
        <div class="print-brand-sub">${t('Quality Control Inspection Report','تقرير فحص مراقبة الجودة')}</div>
      </div>
    </div>
    <div class="print-header-right">
      <div class="print-header-date">${t('Printed:','طُبع في:') } ${new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</div>
      <div class="print-result-badge">${resultLabel}</div>
    </div>
  </div>

  ${reInspNote}

  <!-- Hero -->
  <div class="print-hero">
    <div class="print-hero-title">${escapeHtml(insp.style)} / ${escapeHtml(insp.po)}</div>
    <div class="print-chips">
      <span class="print-chip">📅 ${formatDate(insp.date)}</span>
      <span class="print-chip">🏭 ${t('Line','خط')} ${escapeHtml(insp.line)}</span>
      <span class="print-chip">👤 ${escapeHtml(insp.inspector)}</span>
      ${insp.quantity ? `<span class="print-chip">📦 ${t('Qty','الكمية')}: ${escapeHtml(insp.quantity)}</span>` : ''}
    </div>
  </div>

  <!-- Info — two columns on wide, single on narrow -->
  <div class="print-grid">
    <div class="print-section" style="margin-bottom:0">
      <div class="print-section-title">${t('Order Info','معلومات الطلب')}</div>
      <div class="print-fields">
        <div class="print-field">
          <span class="print-field-label">${t('Style','الستايل')}</span>
          <span class="print-field-val">${escapeHtml(insp.style)}</span>
        </div>
        <div class="print-field">
          <span class="print-field-label">${t('PO','الطلب')}</span>
          <span class="print-field-val">${escapeHtml(insp.po)}</span>
        </div>
        <div class="print-field">
          <span class="print-field-label">${t('Washing','الغسيل')}</span>
          <span class="print-field-val">${escapeHtml(insp.washing)}</span>
        </div>
        <div class="print-field">
          <span class="print-field-label">${t('Line','الخط')}</span>
          <span class="print-field-val">${escapeHtml(insp.line)}</span>
        </div>
        ${insp.quantity ? `
        <div class="print-field">
          <span class="print-field-label">${t('Qty','الكمية')}</span>
          <span class="print-field-val">${escapeHtml(insp.quantity)}</span>
        </div>` : ''}
        <div class="print-field">
          <span class="print-field-label">${t('Date','التاريخ')}</span>
          <span class="print-field-val">${formatDate(insp.date)}</span>
        </div>
      </div>
    </div>
    <div class="print-section" style="margin-bottom:0">
      <div class="print-section-title">${t('Record Info','معلومات السجل')}</div>
      <div class="print-fields">
        <div class="print-field">
          <span class="print-field-label">${t('Inspector','المفتش')}</span>
          <span class="print-field-val">${escapeHtml(insp.inspector)}</span>
        </div>
        <div class="print-field">
          <span class="print-field-label">${t('Result','النتيجة')}</span>
          <span class="print-field-val" style="color:${resultColor};font-weight:700">${resultLabel}</span>
        </div>
        <div class="print-field">
          <span class="print-field-label">${t('Created By','بواسطة')}</span>
          <span class="print-field-val">${escapeHtml(insp.createdBy||'—')}</span>
        </div>
        <div class="print-field">
          <span class="print-field-label">${t('Created At','الإنشاء')}</span>
          <span class="print-field-val">${formatDate(insp.createdAt?.slice(0,10)||'')}</span>
        </div>
        <div class="print-field">
          <span class="print-field-label">${t('Edited By','تعديل')}</span>
          <span class="print-field-val">${escapeHtml(insp.lastEditedBy||'—')}</span>
        </div>
        <div class="print-field">
          <span class="print-field-label">${t('Updated At','التحديث')}</span>
          <span class="print-field-val">${formatDate(insp.lastEditedAt?.slice(0,10)||'')}</span>
        </div>
      </div>
    </div>
  </div>

  ${insp.notes ? `
  <div class="print-section">
    <div class="print-section-title">${t('Notes','ملاحظات')}</div>
    <div class="print-notes">${escapeHtml(insp.notes)}</div>
  </div>` : ''}

  <!-- Defects -->
  <div class="print-section">
    <div class="print-section-title">${t('Defects','العيوب')} (${(insp.defects||[]).length})</div>
    ${(insp.defects||[]).length === 0
      ? `<p style="color:#a0aec0;font-size:12px">${t('No defects recorded.','لم يتم تسجيل أي عيوب.')}</p>`
      : `<div class="print-table-wrap">
          <table class="print-table">
            <thead>
              <tr>
                <th>#</th>
                <th>${t('Defect','العيب')}</th>
                <th>${t('Stage','المرحلة')}</th>
                <th>${t('Severity','الخطورة')}</th>
                <th>${t('Qty','الكمية')}</th>
              </tr>
            </thead>
            <tbody>${defectsHTML}</tbody>
          </table>
        </div>`
    }
  </div>

  ${inspPhotosHTML}

  <!-- Audit Log -->
  <div class="print-section">
    <div class="print-section-title">${t('Audit Log','سجل التعديلات')}</div>
    <div class="print-audit-row">
      <span>📝</span>
      <span>${t('Created by','أنشئ بواسطة')} <strong>${escapeHtml(insp.createdBy||'—')}</strong>
        ${t('on','في')} ${formatDateTime(insp.createdAt)}</span>
    </div>
    <div class="print-audit-row" style="margin-top:4px">
      <span>✏️</span>
      <span>${t('Last edited by','آخر تعديل بواسطة')} <strong>${escapeHtml(insp.lastEditedBy||'—')}</strong>
        ${t('on','في')} ${formatDateTime(insp.lastEditedAt)}</span>
    </div>
  </div>

  <!-- Signatures -->
  <div class="print-section">
    <div class="print-section-title">${t('Signatures','التوقيعات')}</div>
    <div class="print-signature-grid">
      <div class="print-signature-box">${t('Inspector Signature','توقيع المفتش')}</div>
      <div class="print-signature-box">${t('Supervisor Signature','توقيع المشرف')}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="print-footer">
    <span>T&amp;C ${t('Garment Factory — QC System','مصنع الملابس — نظام الجودة')}</span>
    <span>${t('Confidential','سري')}</span>
  </div>

</div>
<script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  // Open in new window and print
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    showToast(t('Please allow popups to export PDF.','يرجى السماح بالنوافذ المنبثقة لتصدير PDF.'), 'warning');
    return;
  }
  win.document.write(printHTML);
  win.document.close();
}
