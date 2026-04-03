/* ============================================================
   auth.js — Authentication (index.html)
   ============================================================ */
'use strict';

const i18n = {
  en: {
    usernameRequired:   'Username is required.',
    usernameMinLength:  'Username must be at least 3 characters.',
    usernameInvalid:    'Only letters, numbers, and underscores allowed.',
    usernameTaken:      'This username is already taken.',
    passwordRequired:   'Password is required.',
    passwordMinLength:  'Password must be at least 6 characters.',
    confirmRequired:    'Please confirm your password.',
    passwordMismatch:   'Passwords do not match.',
    invalidCredentials: 'Incorrect username or password.',
    accountCreated:     'Account created! You can now sign in.',
  },
  ar: {
    usernameRequired:   'اسم المستخدم مطلوب.',
    usernameMinLength:  'يجب أن يكون اسم المستخدم 3 أحرف على الأقل.',
    usernameInvalid:    'يُسمح فقط بالأحرف والأرقام والشرطة السفلية.',
    usernameTaken:      'اسم المستخدم هذا مأخوذ بالفعل.',
    passwordRequired:   'كلمة المرور مطلوبة.',
    passwordMinLength:  'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.',
    confirmRequired:    'يرجى تأكيد كلمة المرور.',
    passwordMismatch:   'كلمتا المرور غير متطابقتين.',
    invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    accountCreated:     'تم إنشاء الحساب! يمكنك تسجيل الدخول الآن.',
  },
};

let currentLang  = 'en';
let currentTheme = 'dark';

/* ── Init ── */
function initAuth() {
  loadPreferences();
  checkExistingSession();
  bindEvents();
}

function loadPreferences() {
  const s = DB.getSettings();
  currentLang  = s.lang  || 'en';
  currentTheme = s.theme || 'dark';
  applyTheme(currentTheme);
  applyLang(currentLang);
}

function checkExistingSession() {
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem('tc_qc_active_session')); } catch {}
  if (!session) session = DB.getSession();
  if (session?.username && DB.getUserByUsername(session.username)) {
    window.location.href = 'dashboard.html';
  }
}

/* ── Events ── */
function bindEvents() {
  // Form switching
  document.getElementById('show-register-link').onclick = () => showForm('register');
  document.getElementById('show-login-link').onclick    = () => showForm('login');

  // Submit
  document.getElementById('login-btn').onclick    = handleLogin;
  document.getElementById('register-btn').onclick = handleRegister;

  // Enter key
  document.querySelectorAll('#login-form .form-input').forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); })
  );
  document.querySelectorAll('#register-form .form-input').forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(); })
  );

  // Theme
  document.getElementById('themeToggle').onclick = toggleTheme;

  // Lang
  document.getElementById('langToggle').onclick = toggleLang;

  // Password toggles
  document.querySelectorAll('.toggle-pass-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Clear errors on input
  document.querySelectorAll('.form-input').forEach(el =>
    el.addEventListener('input', clearErrors)
  );
}

function showForm(which) {
  document.getElementById('login-form').style.display    = which === 'login'    ? '' : 'none';
  document.getElementById('register-form').style.display = which === 'register' ? '' : 'none';
  clearErrors();
}

/* ── Login ── */
async function handleLogin() {
  clearErrors();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('rememberMe').checked;
  const t = i18n[currentLang];

  if (!username) { showAuthError('login-error', t.usernameRequired); return; }
  if (!password) { showAuthError('login-error', t.passwordRequired); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;

  try {
    const user = DB.getUserByUsername(username);
    if (!user) { showAuthError('login-error', t.invalidCredentials); return; }

    const hash = await hashPassword(password);
    if (hash !== user.password) { showAuthError('login-error', t.invalidCredentials); return; }

    const sessionData = { username: user.username, role: user.role, loginAt: new Date().toISOString() };
    sessionStorage.setItem('tc_qc_active_session', JSON.stringify(sessionData));
    if (remember) DB.setSession(sessionData); else DB.clearSession();

    window.location.href = 'dashboard.html';
  } catch(e) {
    showAuthError('login-error', 'An error occurred. Please try again.');
  } finally {
    btn.disabled = false;
  }
}

/* ── Register ── */
async function handleRegister() {
  clearErrors();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const t = i18n[currentLang];

  if (!username)                         { showAuthError('register-error', t.usernameRequired);   return; }
  if (username.length < 3)               { showAuthError('register-error', t.usernameMinLength);  return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { showAuthError('register-error', t.usernameInvalid);   return; }
  if (DB.getUserByUsername(username))    { showAuthError('register-error', t.usernameTaken);      return; }
  if (!password)                         { showAuthError('register-error', t.passwordRequired);   return; }
  if (password.length < 6)              { showAuthError('register-error', t.passwordMinLength);  return; }
  if (!confirm)                          { showAuthError('register-error', t.confirmRequired);    return; }
  if (confirm !== password)              { showAuthError('register-error', t.passwordMismatch);   return; }

  const btn = document.getElementById('register-btn');
  btn.disabled = true;

  try {
    const hash = await hashPassword(password);
    DB.addUser({ username, password: hash, role: 'inspector', registeredAt: new Date().toISOString() });

    const successEl = document.getElementById('register-success');
    successEl.textContent = t.accountCreated;
    successEl.classList.add('show');

    document.getElementById('reg-username').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-confirm').value  = '';

    setTimeout(() => {
      showForm('login');
      document.getElementById('login-username').value = username;
    }, 1600);
  } catch(e) {
    showAuthError('register-error', 'An error occurred. Please try again.');
  } finally {
    btn.disabled = false;
  }
}

/* ── Theme ── */
function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme);
  DB.setSettings({ theme: currentTheme });
}
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const input = document.getElementById('theme-toggle-input');
  if (input) input.checked = (theme === 'light');
}

/* ── Language ── */
function toggleLang() {
  currentLang = currentLang === 'en' ? 'ar' : 'en';
  applyLang(currentLang);
  DB.setSettings({ lang: currentLang });
}
function applyLang(lang) {
  currentLang = lang;
  const isAr = lang === 'ar';
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', isAr ? 'rtl' : 'ltr');
  const label = document.getElementById('langLabel');
  if (label) label.textContent = isAr ? 'AR' : 'EN';

  document.querySelectorAll('[data-en]').forEach(el => {
    const val = isAr ? (el.dataset.ar || el.dataset.en) : el.dataset.en;
    if (val === undefined) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
    el.textContent = val;
  });
  document.querySelectorAll('[data-placeholder-en]').forEach(el => {
    el.placeholder = isAr
      ? (el.dataset.placeholderAr || el.dataset.placeholderEn)
      : el.dataset.placeholderEn;
  });
}

/* ── Helpers ── */
function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
function clearErrors() {
  document.querySelectorAll('.auth-error, .auth-success').forEach(el => {
    el.textContent = '';
    el.classList.remove('show');
  });
  document.querySelectorAll('.form-input').forEach(el => el.classList.remove('invalid'));
}

document.addEventListener('DOMContentLoaded', initAuth);
