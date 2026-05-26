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

  const hasStaff = !!selectedStaff;

  return (
    <div>
      <div className="card terminal-card">
        <div className="section-title" style={{ marginBottom: 16 }}>
          Attendance Terminal
        </div>

        <label>👤 Select Staff</label>
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

        {hasStaff && (
          <div className="terminal-staff-card">
            <div className="terminal-staff-name">
              {selectedStaff.name}
            </div>
            <div className="terminal-staff-meta">
              <div className="terminal-staff-meta-item">
                🕐 <span>{selectedStaff.duty_hours}h</span> duty
              </div>
              <div className="terminal-staff-meta-item">
                ▶ <span>{selectedStaff.shift_start}</span> – <span>{selectedStaff.shift_end}</span>
              </div>
              <div className="terminal-staff-meta-item">
                🏢 {branch?.name || '—'}
              </div>
            </div>
          </div>
        )}

        <label style={{ marginTop: hasStaff ? 'clamp(16px, 3vw, 24px)' : 'clamp(12px, 2vw, 16px)', display: 'block' }}>
          📅 Select Date
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        />

        <div className="grid-2" style={{ marginTop: 'clamp(16px, 3vw, 20px)', gap: 'clamp(8px, 2vw, 12px)' }}>
          <button
            className="btn-primary green terminal-punch-btn"
            onClick={() => handlePunch('START SHIFT')}
            disabled={processing}
          >
            {processing ? '⏳' : '▶'} {processing ? 'PROCESSING...' : 'CHECK IN'}
          </button>
          <button
            className="btn-primary red terminal-punch-btn"
            onClick={() => handlePunch('END SHIFT')}
            disabled={processing}
          >
            {processing ? '⏳' : '■'} {processing ? 'PROCESSING...' : 'CHECK OUT'}
          </button>
        </div>
      </div>

      {!isManager && hasStaff && (
        <p style={{
          textAlign: 'center',
          fontSize: '0.55rem',
          opacity: 0.35,
          marginTop: 12,
        }}>
          {branch?.name || ''} · {branch?.code || ''}
        </p>
      )}
    </div>
  );
}
