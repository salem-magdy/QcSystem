/* ============================================================
   users.js — User Management (Admin only)
   ============================================================ */
'use strict';

let roleTargetUser = null;

function renderUsers() {
  if (!isAdmin()) { showToast(t('Access denied.','غير مصرح.'), 'error'); navigate('dashboard'); return; }

  filterAndRenderUsers();
  bindUsersEvents();
}

function filterAndRenderUsers() {
  const search     = (document.getElementById('usersSearch')?.value || '').toLowerCase().trim();
  const roleFilter = document.getElementById('usersRoleFilter')?.value || '';
  const tbody      = document.getElementById('usersBody');
  const emptyEl    = document.getElementById('usersEmpty');
  if (!tbody) return;

  let users = DB.getUsers();
  if (search)     users = users.filter(u => u.username.toLowerCase().includes(search));
  if (roleFilter) users = users.filter(u => u.role === roleFilter);

  if (users.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = users.map(user => {
    const isSelf   = user.username === currentUser.username;
    const initials = user.username.charAt(0).toUpperCase();
    const regDate  = user.registeredAt ? formatDate(user.registeredAt.slice(0,10)) : '—';

    const roleCell = isSelf
      ? `${roleBadge(user.role)} <span class="self-badge">${t('you','أنت')}</span>`
      : `<select class="role-select role-${user.role}" onchange="quickChangeRole('${escapeHtml(user.username)}', this.value)">
          <option value="inspector"  ${user.role==='inspector' ?'selected':''} data-en="Inspector"  data-ar="مفتش">${t('Inspector','مفتش')}</option>
          <option value="supervisor" ${user.role==='supervisor'?'selected':''} data-en="Supervisor" data-ar="مشرف">${t('Supervisor','مشرف')}</option>
          <option value="admin"      ${user.role==='admin'     ?'selected':''} data-en="Admin"      data-ar="مسؤول">${t('Admin','مسؤول')}</option>
        </select>`;

    const delCell = isSelf
      ? ''
      : `<button class="action-btn danger" onclick="deleteUserConfirm('${escapeHtml(user.username)}')">${t('Delete','حذف')}</button>`;

    return `
      <tr>
        <td><div class="user-avatar" style="width:34px;height:34px;font-size:13px">${initials}</div></td>
        <td><strong>${escapeHtml(user.username)}</strong></td>
        <td>${roleCell}</td>
        <td style="color:var(--text-muted);font-size:13px">${regDate}</td>
        <td>
          <div class="row-actions">${delCell}</div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindUsersEvents() {
  const searchEl = document.getElementById('usersSearch');
  if (searchEl) searchEl.oninput = debounce(filterAndRenderUsers, 250);

  const roleFilter = document.getElementById('usersRoleFilter');
  if (roleFilter) roleFilter.onchange = filterAndRenderUsers;

  document.getElementById('save-role-btn')?.addEventListener('click', saveRole);
}

/* ── Quick role change via dropdown ── */
function quickChangeRole(username, newRole) {
  DB.updateUser(username, { role: newRole });
  showToast(t(`Role updated for ${username}.`, `تم تحديث دور ${username}.`), 'success');
  filterAndRenderUsers();
}

/* ── Role modal (kept for compatibility) ── */
function openRoleModal(username) {
  roleTargetUser = username;
  const user = DB.getUserByUsername(username);
  if (!user) return;
  const label = document.getElementById('role-modal-user-label');
  const sel   = document.getElementById('role-modal-select');
  if (label) label.textContent = t(`Change role for: ${username}`, `تغيير دور: ${username}`);
  if (sel)   sel.value = user.role;
  openModal('role-modal');
}

function saveRole() {
  if (!roleTargetUser) return;
  const newRole = document.getElementById('role-modal-select')?.value || 'inspector';
  DB.updateUser(roleTargetUser, { role: newRole });
  showToast(t(`Role updated for ${roleTargetUser}.`, `تم تحديث دور ${roleTargetUser}.`), 'success');
  closeModal('role-modal');
  roleTargetUser = null;
  filterAndRenderUsers();
}

/* ── Delete ── */
function deleteUserConfirm(username) {
  if (username === currentUser.username) {
    showToast(t('Cannot delete your own account.','لا يمكنك حذف حسابك.'), 'error'); return;
  }
  confirmDelete(
    t(`Delete user "${username}"? Their inspections will remain.`,
      `حذف المستخدم "${username}"؟ ستبقى فحوصاته.`),
    () => {
      DB.deleteUser(username);
      showToast(t(`User "${username}" deleted.`, `تم حذف المستخدم "${username}".`), 'success');
      filterAndRenderUsers();
    }
  );
}
