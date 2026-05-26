import React, { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { getCurrentDate } from '../utils/helpers';

export default function Terminal({ branch, staffList, api, selectedStaff, setSelectedStaff, refreshKey }) {
  const { showToast, showLoading, hideLoading, isManager } = useApp();
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  const [processing, setProcessing] = useState(false);
  const [todayStatus, setTodayStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Quick date helpers
  const today = getCurrentDate();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');

  // Fetch today's status when staff changes or refreshKey increments
  useEffect(() => {
    if (selectedStaff) {
      fetchTodayStatus();
    } else {
      setTodayStatus(null);
    }
  }, [selectedStaff, refreshKey]);

  async function fetchTodayStatus() {
    if (!selectedStaff) return;
    setCheckingStatus(true);
    try {
      const statusList = await api.getOnDutyStatus();
      const myStatus = statusList.find(s => s.staffId === selectedStaff.id);
      setTodayStatus(myStatus || null);
    } catch {
      // Silently ignore
    } finally {
      setCheckingStatus(false);
    }
  }

  function setQuickDate(dateStr) {
    setSelectedDate(dateStr);
  }

  async function handlePunch(type) {
    if (!selectedStaff) return showToast('Select Staff Name!', true);
    if (!selectedDate) return showToast('Select Date!', true);

    setProcessing(true);
    showLoading('Processing...');

    try {
      await api.processAttendance(selectedStaff.id, selectedStaff.name, type, selectedDate);
      showToast(`${type === 'START SHIFT' ? 'CHECK IN' : 'CHECK OUT'} recorded for ${selectedStaff.name}`);
      // Refresh status after punch
      fetchTodayStatus();
    } catch (err) {
      showToast('Error: ' + err.message, true);
    } finally {
      setProcessing(false);
      hideLoading();
    }
  }

  // Determine the status display for selected staff
  const hasStaff = !!selectedStaff;

  return (
    <div>
      {/* Main Card */}
      <div className="card terminal-card">
        {/* Header */}
        <div className="section-title" style={{ marginBottom: 16 }}>
          Attendance Terminal
        </div>

        {/* Staff Select */}
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

        {/* Staff Info Card — appears when staff selected */}
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
            {/* Today's status indicator */}
            {checkingStatus ? (
              <div className="terminal-status-badge off-duty">
                ⏳ Checking...
              </div>
            ) : todayStatus?.status === 'ON DUTY' ? (
              <div className="terminal-status-badge on-duty">
                🟢 On duty since {todayStatus.since}
              </div>
            ) : todayStatus?.status === 'OFF' ? (
              <div className="terminal-status-badge checked-out">
                🔵 Checked out today
              </div>
            ) : (
              <div className="terminal-status-badge off-duty">
                ⚪ Not punched yet
              </div>
            )}
          </div>
        )}

        {/* Date Selection */}
        <label style={{ marginTop: hasStaff ? 'clamp(16px, 3vw, 24px)' : 'clamp(12px, 2vw, 16px)', display: 'block' }}>
          📅 Select Date
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        />

        {/* Quick Date Presets */}
        <div className="terminal-quick-dates">
          <button
            className={`terminal-quick-date-btn ${selectedDate === today ? 'active' : ''}`}
            onClick={() => setQuickDate(today)}
          >
            Today
          </button>
          <button
            className={`terminal-quick-date-btn ${selectedDate === yesterdayStr ? 'active' : ''}`}
            onClick={() => setQuickDate(yesterdayStr)}
          >
            Yesterday
          </button>
        </div>

        {/* Punch Buttons */}
        <div className="grid-2" style={{ marginTop: 'clamp(16px, 3vw, 20px)', gap: 'clamp(8px, 2vw, 12px)' }}>
          <button
            className="btn-primary green terminal-punch-btn"
            onClick={() => handlePunch('START SHIFT')}
            disabled={processing}
          >
            {processing ? '⏳' : '▶'} {processing ? 'PROCESSING...' : 'START SHIFT'}
          </button>
          <button
            className="btn-primary red terminal-punch-btn"
            onClick={() => handlePunch('END SHIFT')}
            disabled={processing}
          >
            {processing ? '⏳' : '■'} {processing ? 'PROCESSING...' : 'END SHIFT'}
          </button>
        </div>
      </div>

      {/* Branch info */}
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
