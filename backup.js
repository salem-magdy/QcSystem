/* ============================================================
   backup.js — Backup & Restore (Admin only)
   ============================================================ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('exportBackupBtn')?.addEventListener('click', exportBackup);

  const importBtn   = document.getElementById('importBackupBtn');
  const fileInput   = document.getElementById('restoreFileInput');
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) handleRestoreFile(file);
      e.target.value = '';
    });
  }
});

function exportBackup() {
  if (!isAdmin()) { showToast(t('Access denied.','غير مصرح.'), 'error'); return; }
  try {
    const data     = DB.exportAll();
    const json     = JSON.stringify(data, null, 2);
    const filename = `TC_QC_Backup_${todayISO()}.json`;
    downloadFile(json, filename, 'application/json');
    showToast(t('Backup exported successfully.','تم تصدير النسخة الاحتياطية.'), 'success');
  } catch(err) {
    console.error(err);
    showToast(t('Export failed.','فشل التصدير.'), 'error');
  }
}

function handleRestoreFile(file) {
  if (!isAdmin()) { showToast(t('Access denied.','غير مصرح.'), 'error'); return; }
  if (!file.name.endsWith('.json')) {
    showToast(t('Please select a valid .json file.','يرجى اختيار ملف .json صالح.'), 'error');
    return;
  }
  confirmDelete(
    t('This will overwrite ALL current data. Are you sure?',
      'سيؤدي هذا إلى استبدال جميع البيانات الحالية. هل أنت متأكد؟'),
    () => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          DB.importAll(data);
          showToast(t('Backup restored. Reloading...','تمت الاستعادة. جاري إعادة التحميل...'), 'success', 5000);
          setTimeout(() => window.location.reload(), 2000);
        } catch(err) {
          showToast(t('Invalid backup file.','ملف النسخة الاحتياطية غير صالح.'), 'error');
        }
      };
      reader.onerror = () => showToast(t('Could not read file.','تعذر قراءة الملف.'), 'error');
      reader.readAsText(file);
    }
  );
}
