/* ============================================================
   db.js — Storage Layer
   LocalStorage: users, inspections, defects, lines, settings
   IndexedDB: images
   ============================================================ */

'use strict';

/* ── LocalStorage Keys ── */
const LS = {
  USERS:       'tc_qc_users',
  INSPECTIONS: 'tc_qc_inspections',
  DEFECTS:     'tc_qc_defects',
  STAGES:      'tc_qc_stages',
  LINES:       'tc_qc_lines',
  SETTINGS:    'tc_qc_settings',
  SESSION:     'tc_qc_session',
};

/* ── IndexedDB Config ── */
const IDB_NAME    = 'tc_qc_images';
const IDB_VERSION = 1;
const IDB_STORE   = 'images';

/* ============================================================
   LOCAL STORAGE HELPERS
   ============================================================ */

const DB = {

  /* ── Generic ── */
  _get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; }
    catch { return null; }
  },
  _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) {
      console.error('LocalStorage write error:', e);
      return false;
    }
  },

  /* ── Users ── */
  getUsers() { return this._get(LS.USERS) || []; },
  setUsers(users) { return this._set(LS.USERS, users); },

  getUserByUsername(username) {
    return this.getUsers().find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  },

  addUser(user) {
    const users = this.getUsers();
    users.push(user);
    return this.setUsers(users);
  },

  updateUser(username, updates) {
    const users = this.getUsers().map(u =>
      u.username.toLowerCase() === username.toLowerCase() ? { ...u, ...updates } : u
    );
    return this.setUsers(users);
  },

  deleteUser(username) {
    const users = this.getUsers().filter(u => u.username.toLowerCase() !== username.toLowerCase());
    return this.setUsers(users);
  },

  /* ── Inspections ── */
  getInspections() { return this._get(LS.INSPECTIONS) || []; },
  setInspections(data) { return this._set(LS.INSPECTIONS, data); },

  getInspectionById(id) {
    return this.getInspections().find(i => i.id === id) || null;
  },

  addInspection(inspection) {
    const list = this.getInspections();
    list.unshift(inspection); // newest first
    return this.setInspections(list);
  },

  updateInspection(id, updates) {
    const list = this.getInspections().map(i =>
      i.id === id ? { ...i, ...updates } : i
    );
    return this.setInspections(list);
  },

  deleteInspection(id) {
    const list = this.getInspections().filter(i => i.id !== id);
    return this.setInspections(list);
  },

  /* ── Defects List ── */
  getDefectsList() { return this._get(LS.DEFECTS) || []; },
  setDefectsList(data) { return this._set(LS.DEFECTS, data); },

  addDefectToList(name) {
    const list = this.getDefectsList();
    if (list.includes(name)) return false;
    list.push(name);
    list.sort();
    return this.setDefectsList(list);
  },

  removeDefectFromList(name) {
    const list = this.getDefectsList().filter(d => d !== name);
    return this.setDefectsList(list);
  },

  updateDefectInList(oldName, newName) {
    const list = this.getDefectsList().map(d => d === oldName ? newName : d);
    list.sort();
    return this.setDefectsList(list);
  },

  /* ── Stages List ── */
  getStagesList() {
    const stored = this._get(LS.STAGES);
    if (stored) return stored;
    // Default stages
    const defaults = [
      'Waistband', 'Yoke', 'Bottom Hem', 'Side Seam',
      'Inseam', 'Button Hole', 'Belt Loops', 'Zipper',
      'Pocket', 'Fly', 'Back Rise', 'Front Rise',
      'Leg Opening', 'Finishing', 'Packing',
    ];
    this.setStagesList(defaults);
    return defaults;
  },
  setStagesList(data) { return this._set(LS.STAGES, data); },

  addStageToList(name) {
    const list = this.getStagesList();
    if (list.map(s => s.toLowerCase()).includes(name.toLowerCase())) return false;
    list.push(name);
    list.sort();
    return this.setStagesList(list);
  },

  removeStageFromList(name) {
    const list = this.getStagesList().filter(s => s !== name);
    return this.setStagesList(list);
  },

  updateStageInList(oldName, newName) {
    const list = this.getStagesList().map(s => s === oldName ? newName : s);
    list.sort();
    return this.setStagesList(list);
  },

  /* ── Lines ── */
  getLines() {
    const stored = this._get(LS.LINES);
    if (stored) return stored;
    // Default lines 16-29
    const defaults = [];
    for (let i = 16; i <= 29; i++) defaults.push(String(i));
    this.setLines(defaults);
    return defaults;
  },
  setLines(data) { return this._set(LS.LINES, data); },

  addLine(line) {
    const lines = this.getLines();
    if (lines.includes(line)) return false;
    lines.push(line);
    return this.setLines(lines);
  },

  removeLine(line) {
    const lines = this.getLines().filter(l => l !== line);
    return this.setLines(lines);
  },

  /* ── Settings ── */
  getSettings() {
    return this._get(LS.SETTINGS) || { theme: 'light', lang: 'en' };
  },
  setSettings(updates) {
    const current = this.getSettings();
    return this._set(LS.SETTINGS, { ...current, ...updates });
  },

  /* ── Session ── */
  getSession() { return this._get(LS.SESSION); },
  setSession(user) { return this._set(LS.SESSION, user); },
  clearSession() { localStorage.removeItem(LS.SESSION); },

  /* ── Backup / Restore ── */
  exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      users: this.getUsers(),
      inspections: this.getInspections(),
      defects: this.getDefectsList(),
      stages: this.getStagesList(),
      lines: this.getLines(),
      settings: this.getSettings(),
    };
  },

  importAll(data) {
    if (!data || data.version !== 1) throw new Error('Invalid backup file');
    if (data.users)       this.setUsers(data.users);
    if (data.inspections) this.setInspections(data.inspections);
    if (data.defects)     this.setDefectsList(data.defects);
    if (data.stages)      this.setStagesList(data.stages);
    if (data.lines)       this.setLines(data.lines);
    if (data.settings)    this.setSettings(data.settings);
    return true;
  },
};

/* ============================================================
   INDEXEDDB — IMAGE STORAGE
   ============================================================ */

const ImageDB = {
  _db: null,

  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror   = (e) => reject(e.target.error);
    });
  },

  async saveImage(id, base64) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ id, base64 });
      tx.oncomplete = () => resolve(true);
      tx.onerror    = (e) => reject(e.target.error);
    });
  },

  async getImage(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result ? req.result.base64 : null);
      req.onerror   = (e) => reject(e.target.error);
    });
  },

  async deleteImage(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = (e) => reject(e.target.error);
    });
  },

  async deleteImages(ids) {
    for (const id of ids) await this.deleteImage(id);
  },

  async getAllImageIds() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  },
};

/* ============================================================
   IMAGE COMPRESSION UTILITY
   ============================================================ */

const ImageUtil = {
  /**
   * Compress an image file to base64
   * @param {File} file
   * @param {number} maxWidth  default 1200
   * @param {number} quality   default 0.78
   * @returns {Promise<string>} base64 string
   */
  compress(file, maxWidth = 1200, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /** Generate a unique image ID */
  newId() {
    return 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  },
};

/* ============================================================
   INITIALIZATION — Default admin + seed data
   ============================================================ */

async function initDB() {
  const users = DB.getUsers();

  // Create default admin if no users exist
  if (users.length === 0) {
    const adminHash = await hashPassword('admin123');
    DB.addUser({
      username:   'admin',
      password:   adminHash,
      role:       'admin',
      registeredAt: new Date().toISOString(),
    });
  }

  // Seed default defects list if empty
  if (DB.getDefectsList().length === 0) {
    DB.setDefectsList([
      'Broken Stitch',
      'Color Shading',
      'Dirty Marks',
      'Fabric Defect',
      'Missing Button',
      'Open Seam',
      'Pilling',
      'Size Mismatch',
      'Skip Stitch',
      'Stain',
      'Uneven Hem',
      'Wrong Label',
    ]);
  }

  // Ensure lines are initialized
  DB.getLines();

  // Ensure stages are initialized
  DB.getStagesList();

  console.log('[DB] Initialized ✓');
}

/* ============================================================
   SHA-256 HASHING (Web Crypto API)
   ============================================================ */

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data     = encoder.encode(password);
  const hashBuf  = await crypto.subtle.digest('SHA-256', data);
  const hashArr  = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Auto-init
initDB().catch(console.error);
