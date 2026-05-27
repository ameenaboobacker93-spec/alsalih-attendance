import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { getCurrentDate } from '../utils/helpers';

export default function Terminal({ branch, staffList, api, selectedStaff, setSelectedStaff }) {
  const { showToast, showLoading, hideLoading, isManager } = useApp();
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  const [processing, setProcessing] = useState(false);
  const [showSplitDuty, setShowSplitDuty] = useState(false);
  const [processing2, setProcessing2] = useState(false);

  async function handlePunch(type, segment = 1) {
    if (!selectedStaff) return showToast('Select Staff Name!', true);
    if (!selectedDate) return showToast('Select Date!', true);

    const isSeg2 = segment === 2;
    setProcessing(!isSeg2);
    setProcessing2(isSeg2);

    const label = isSeg2 ? 'Segment 2' : '';
    showLoading(`Processing ${label}...`);

    try {
      await api.processAttendance(selectedStaff.id, selectedStaff.name, type, selectedDate, segment);
      const prefix = isSeg2 ? 'Seg 2 ' : '';
      showToast(`✅ ${prefix}${type === 'START SHIFT' ? 'CHECK IN' : 'CHECK OUT'} — ${selectedStaff.name}`);
    } catch (err) {
      showToast('Error: ' + err.message, true);
    } finally {
      setProcessing(false);
      setProcessing2(false);
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

        {/* Segment 1 — Main Shift */}
        <div style={{ marginTop: 'clamp(16px, 3vw, 20px)' }}>
          <small style={{ fontSize: '0.55rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, display: 'block' }}>
            Shift 1
          </small>
          <div className="grid-2" style={{ gap: 'clamp(8px, 2vw, 12px)' }}>
            <button
              className="btn-primary green terminal-punch-btn"
              onClick={() => handlePunch('START SHIFT', 1)}
              disabled={processing || processing2}
            >
              {processing && !processing2 ? '⏳' : '▶'} {processing && !processing2 ? '...' : 'LOGIN 1'}
            </button>
            <button
              className="btn-primary red terminal-punch-btn"
              onClick={() => handlePunch('END SHIFT', 1)}
              disabled={processing || processing2}
            >
              {processing && !processing2 ? '⏳' : '■'} {processing && !processing2 ? '...' : 'LOGOUT 1'}
            </button>
          </div>
        </div>

        {/* Split Duty Toggle */}
        <button
          onClick={() => setShowSplitDuty(!showSplitDuty)}
          style={{
            marginTop: 'clamp(12px, 2vw, 16px)',
            width: '100%',
            padding: 'clamp(10px, 2vw, 14px)',
            borderRadius: 'var(--radius-md)',
            background: showSplitDuty ? 'var(--accent-dim)' : 'transparent',
            border: `1px dashed ${showSplitDuty ? 'var(--accent)' : 'var(--border-color)'}`,
            color: 'var(--accent)',
            fontFamily: 'inherit',
            fontWeight: 700,
            fontSize: 'clamp(0.65rem, 1.3vw, 0.75rem)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: '1rem' }}>{showSplitDuty ? '⊟' : '⊞'}</span>
          {showSplitDuty ? 'HIDE SPLIT DUTY' : 'ADD SPLIT DUTY'}
        </button>

        {/* Segment 2 — Split Duty */}
        {showSplitDuty && (
          <div style={{
            marginTop: 'clamp(12px, 2vw, 16px)',
            padding: 'clamp(14px, 2vw, 18px)',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            animation: 'slideUp 0.2s ease',
          }}>
            <small style={{ fontSize: '0.55rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, display: 'block' }}>
              Shift 2 <span style={{ color: 'var(--accent)', fontWeight: 800 }}>(Split Duty)</span>
            </small>
            <div className="grid-2" style={{ gap: 'clamp(8px, 2vw, 12px)' }}>
              <button
                className="btn-primary green terminal-punch-btn"
                onClick={() => handlePunch('START SHIFT', 2)}
                disabled={processing || processing2}
                style={{ fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)' }}
              >
                {processing2 ? '⏳' : '▶'} {processing2 ? '...' : 'LOGIN 2'}
              </button>
              <button
                className="btn-primary red terminal-punch-btn"
                onClick={() => handlePunch('END SHIFT', 2)}
                disabled={processing || processing2}
                style={{ fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)' }}
              >
                {processing2 ? '⏳' : '■'} {processing2 ? '...' : 'LOGOUT 2'}
              </button>
            </div>
            <p style={{ fontSize: '0.5rem', opacity: 0.4, marginTop: 8, textAlign: 'center' }}>
              Use for split shifts (e.g., morning + evening). Both segments calculate independently with midnight-crossing support.
            </p>
          </div>
        )}
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
