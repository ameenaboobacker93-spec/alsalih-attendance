// ── Date & Time Helpers ──

export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-CA'); // Returns yyyy-mm-dd
}

export function formatDisplayDate(date) {
  if (!date) return '---';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    weekday: 'short',
  });
}

export function formatTime(date) {
  if (!date) return '---';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatMonthDisplay(yearMonth) {
  if (!yearMonth) return '';
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getCurrentDate() {
  return new Date().toLocaleDateString('en-CA');
}

export function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const diff = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60);
  // Normalize to [0, 24) range for single-shift calculations
  return ((diff % 24) + 24) % 24 || 0;
}

export function generateCSV(rows, headers) {
  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    const escaped = row.map(val => {
      const s = String(val || '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    });
    csv += escaped.join(',') + '\n';
  });
  return csv;
}

export function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function getStatusClass(status) {
  switch (status) {
    case 'OT_APPROVED': return 'status-ot';
    case 'OT_REJECTED': return 'status-rejected';
    case 'OFF_DAY': return 'status-off';
    case 'PENDING_APPROVAL': return 'status-pending';
    case 'INCOMPLETE': return 'status-incomplete';
    case 'MISSING': return 'status-missing';
    case 'COMPENSATED': return 'status-comp';
    case 'NORMAL': return 'status-normal';
    default: return '';
  }
}

export function getStatusLabel(status) {
  switch (status) {
    case 'OT_APPROVED': return 'OT APPROVED';
    case 'OT_REJECTED': return 'OT REJECTED';
    case 'OFF_DAY': return 'OFF DAY';
    case 'PENDING_APPROVAL': return 'PENDING APPROVAL';
    case 'INCOMPLETE': return 'INCOMPLETE';
    case 'MISSING': return 'MISSING';
    case 'COMPENSATED': return 'COMPENSATED';
    case 'NORMAL': return 'NORMAL';
    default: return status || '---';
  }
}
