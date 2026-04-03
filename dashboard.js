/* ============================================================
   dashboard.js — Dashboard
   ============================================================ */
'use strict';

let dashDateFrom  = '';
let dashDateTo    = '';
let dashLineFilter  = '';
let dashStyleFilter = '';

function renderDashboard() {
  const greeting = document.getElementById('dash-greeting');
  if (greeting) greeting.textContent = getDashGreeting();
  setDefaultDates();
  populateDashLineFilter();
  renderStats();
  renderRecentTable();
  bindDashEvents();
  updateStorageBar();
}

function populateDashLineFilter() {
  const sel = document.getElementById('dashLineFilter');
  if (!sel) return;
  const cur   = sel.value;
  const lines = DB.getLines();
  sel.innerHTML = `<option value="">${t('All Lines','كل الخطوط')}</option>` +
    lines.map(l => `<option value="${escapeHtml(l)}" ${l===cur?'selected':''}>${escapeHtml(l)}</option>`).join('');
}

function setDefaultDates() {
  const fromEl = document.getElementById('dashDateFrom');
  const toEl   = document.getElementById('dashDateTo');
  if (!fromEl || !toEl) return;
  if (!fromEl.value && !toEl.value) {
    const today  = todayISO();
    fromEl.value = today;
    toEl.value   = today;
    dashDateFrom = today;
    dashDateTo   = today;
  } else {
    dashDateFrom = fromEl.value;
    dashDateTo   = toEl.value;
  }
}

/* ── Stats ── */
function renderStats() {
  const list  = getDashFiltered();
  const total = list.length;
  const pass  = list.filter(i => i.result === 'pass').length;
  const fail  = list.filter(i => i.result === 'fail').length;
  const hold  = list.filter(i => i.result === 'hold').length;

  setText('statTotal', total);
  setText('statPass',  pass);
  setText('statFail',  fail);
  setText('statHold',  hold);

  // Stat bars
  setBar('bar-pass', total ? (pass / total) * 100 : 0);
  setBar('bar-fail', total ? (fail / total) * 100 : 0);
  setBar('bar-hold', total ? (hold / total) * 100 : 0);

  // Make cards clickable
  bindStatCards();

  // Fail alert
  const alertEl   = document.getElementById('dash-fail-alert');
  const alertText = document.getElementById('dash-fail-alert-text');
  if (alertEl && alertText) {
    if (fail > 0) {
      alertEl.style.display = '';
      alertText.textContent = t(
        `${fail} failed inspection${fail > 1 ? 's' : ''} in the selected period.`,
        `${fail} فحص${fail > 1 ? 'ات' : ''} فاشل في الفترة المحددة.`
      );
    } else {
      alertEl.style.display = 'none';
    }
  }
}

function bindStatCards() {
  const cardMap = [
    { cardClass: 'stat-total',  result: ''     },
    { cardClass: 'stat-passed', result: 'pass' },
    { cardClass: 'stat-failed', result: 'fail' },
    { cardClass: 'stat-hold',   result: 'hold' },
  ];

  cardMap.forEach(({ cardClass, result }) => {
    const card = document.querySelector(`.stat-card.${cardClass}`);
    if (!card) return;

    // Style as clickable
    card.style.cursor = 'pointer';
    card.title = result
      ? t(`View ${result} inspections`, `عرض الفحوصات ${result === 'pass' ? 'الناجحة' : result === 'fail' ? 'الفاشلة' : 'المعلقة'}`)
      : t('View all inspections', 'عرض كل الفحوصات');

    // Remove old listener to avoid duplicates
    card.onclick = null;
    card.onclick = () => {
      // Pass current dashboard filters to inspections page
      navigateToInspectionsFiltered(result);
    };
  });
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.round(pct) + '%';
}

/* ── Recent table ── */
function renderRecentTable() {
  const tbody   = document.getElementById('dash-recent-body');
  const emptyEl = document.getElementById('dash-empty');
  if (!tbody) return;

  const list = getDashFiltered().slice(0, 10);

  if (list.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = list.map(insp => `
    <tr class="${insp.result === 'fail' ? 'row-fail' : ''}" onclick="navigate('detail',{id:'${insp.id}'})">
      <td>${escapeHtml(insp.style)}</td>
      <td>${escapeHtml(insp.po)}</td>
      <td>${escapeHtml(insp.washing)}</td>
      <td>${escapeHtml(insp.line)}</td>
      <td>${escapeHtml(insp.inspector)}</td>
      <td>${formatDate(insp.date)}</td>
      <td>${resultBadge(insp.result)}</td>
    </tr>
  `).join('');
}

/* ── Filter ── */
function getDashFiltered() {
  const all = DB.getInspections();
  return all.filter(i => {
    const d = i.date || '';
    if (dashDateFrom   && d < dashDateFrom) return false;
    if (dashDateTo     && d > dashDateTo)   return false;
    if (dashLineFilter && i.line !== dashLineFilter) return false;
    if (dashStyleFilter && !i.style.toLowerCase().includes(dashStyleFilter.toLowerCase())) return false;
    return true;
  });
}

function bindDashEvents() {
  const filterBtn = document.getElementById('dashFilterBtn');
  const clearBtn  = document.getElementById('dashClearBtn');
  if (filterBtn) filterBtn.onclick = applyDashFilter;
  if (clearBtn)  clearBtn.onclick  = clearDashFilter;
}

function applyDashFilter() {
  dashDateFrom   = document.getElementById('dashDateFrom')?.value    || '';
  dashDateTo     = document.getElementById('dashDateTo')?.value      || '';
  dashLineFilter  = document.getElementById('dashLineFilter')?.value  || '';
  dashStyleFilter = document.getElementById('dashStyleFilter')?.value || '';
  renderStats();
  renderRecentTable();
}

function clearDashFilter() {
  ['dashDateFrom','dashDateTo','dashStyleFilter'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const lineSel = document.getElementById('dashLineFilter');
  if (lineSel) lineSel.value = '';
  dashDateFrom = ''; dashDateTo = '';
  dashLineFilter = ''; dashStyleFilter = '';
  renderStats();
  renderRecentTable();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function navigateToInspectionsFiltered(result) {
  // Store the filters to apply on inspections page
  window._dashFiltersForInsp = {
    dateFrom:   dashDateFrom,
    dateTo:     dashDateTo,
    line:       dashLineFilter,
    style:      dashStyleFilter,
    result:     result,
  };
  navigate('inspections');
}
