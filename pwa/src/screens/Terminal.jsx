import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { getCurrentDate } from '../utils/helpers';

export default function Terminal({ branch, staffList, api, selectedStaff, setSelectedStaff }) {
  const { showToast, showLoading, hideLoading, isManager } = useApp();
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  const [processing, setProcessing] = useState(false);

  async function handlePunch(type) {
    if (!selectedStaff) return showToast('Select Staff Name!', true);
    if (!selectedDate) return showToast('Select Date!', true);

    setProcessing(true);
    showLoading('Processing...');

    try {
      await api.processAttendance(selectedStaff.id, selectedStaff.name, type, selectedDate);
      showToast(`${type === 'START SHIFT' ? 'CHECK IN' : 'CHECK OUT'} recorded for ${selectedStaff.name}`);
    } catch (err) {
      showToast('Error: ' + err.message, true);
    } finally {
      setProcessing(false);
      hideLoading();
    }
  }

  return (
    <div className="card">
      <label>SELECT STAFF</label>
      <select
        value={selectedStaff?.id || ''}
        onChange={e => {
          const staff = staffList.find(s => s.id === parseInt(e.target.value));
          setSelectedStaff(staff || null);
        }}
      >
        <option value="" disabled>--- Select Staff ---</option>
        {staffList.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      <label style={{ marginTop: 'clamp(8px, 2vw, 12px)' }}>SELECT SHIFT DATE</label>
      <input
        type="date"
        value={selectedDate}
        onChange={e => setSelectedDate(e.target.value)}
      />

      <div className="grid-2" style={{ marginTop: 'clamp(12px, 2.5vw, 16px)', gap: 'clamp(8px, 2vw, 12px)' }}>
        <button
          className="btn-primary green"
          onClick={() => handlePunch('START SHIFT')}
          disabled={processing}
          style={{
            padding: 'clamp(14px, 3vw, 18px)',
            fontSize: 'clamp(0.8rem, 2vw, 0.85rem)',
            minHeight: 'var(--touch-min)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {processing ? '⏳ PROCESSING...' : '▶ START SHIFT'}
        </button>
        <button
          className="btn-primary red"
          onClick={() => handlePunch('END SHIFT')}
          disabled={processing}
          style={{
            padding: 'clamp(14px, 3vw, 18px)',
            fontSize: 'clamp(0.8rem, 2vw, 0.85rem)',
            minHeight: 'var(--touch-min)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {processing ? '⏳ PROCESSING...' : '■ END SHIFT'}
        </button>
      </div>

      {!isManager && (
        <p style={{
          textAlign: 'center',
          fontSize: '0.6rem',
          opacity: 0.4,
          marginTop: 16,
        }}>
          {branch.name} · {branch.code}
        </p>
      )}
    </div>
  );
}
