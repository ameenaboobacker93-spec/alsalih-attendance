import React, { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import {
  getCurrentMonth,
  getStatusClass,
  getStatusLabel,
  formatMonthDisplay,
  downloadCSV,
} from '../utils/helpers';
import ConfirmModal from '../components/ConfirmModal';

export default function Dashboard({ branch, staffList, api, isManager, refreshKey }) {
  const { showToast, showLoading, hideLoading } = useApp();
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fix modal state — track which entries need fixing (both segments)
  const [fixModal, setFixModal] = useState({ visible: false, date: '', staffId: null, staffName: '', currentIn: '', currentOut: '', currentIn2: '', currentOut2: '' });
  const [fixIn, setFixIn] = useState('');
  const [fixOut, setFixOut] = useState('');
  const [fixIn2, setFixIn2] = useState('');
  const [fixOut2, setFixOut2] = useState('');

  // Summary modal
  const [showSummary, setShowSummary] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, id: null, date: '', staffName: '' });

  // Load dashboard when staff or month changes
  useEffect(() => {
    if (selectedStaff && selectedMonth) {
      loadDashboard();
    }
  }, [selectedStaff?.id, selectedMonth, refreshKey]);

  async function loadDashboard() {
    if (!selectedStaff) return;
    setLoading(true);
    try {
      const data = await api.getStaffDashboard(selectedStaff.id, selectedMonth);
      setDashboardData(data);
    } catch (err) {
      showToast('Failed to load dashboard: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  }

  function openFix(log) {
    const currentIn = log.checkIn ? new Date(log.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    const currentOut = log.checkOut ? new Date(log.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    const currentIn2 = log.checkIn2 ? new Date(log.checkIn2).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    const currentOut2 = log.checkOut2 ? new Date(log.checkOut2).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    setFixModal({ visible: true, date: log.date, staffId: selectedStaff.id, staffName: selectedStaff.name, currentIn, currentOut, currentIn2, currentOut2 });
    setFixIn('');
    setFixOut('');
    setFixIn2('');
    setFixOut2('');
  }

  async function saveFix() {
    try {
      await api.managerFixEntry(
        fixModal.staffId,
        fixModal.staffName,
        fixModal.date,
        fixIn || null,
        fixOut || null,
        fixIn2 || null,
        fixOut2 || null
      );
      showToast('Entry fixed successfully');
      setFixModal({ ...fixModal, visible: false });
      loadDashboard();
    } catch (err) {
      showToast('Fix error: ' + err.message, true);
    }
  }

  // Helper: calc hours for one segment with midnight crossing support
  function calcSegHours(inTime, outTime) {
    if (!inTime || !outTime) return 0;
    const diff = (new Date(outTime) - new Date(inTime)) / (1000 * 60 * 60);
    return ((diff % 24) + 24) % 24 || 0;
  }

  // ── Approve OT ──
  async function handleApproveOT(log) {
    showLoading('Approving OT...');
    try {
      const seg1 = calcSegHours(log.checkIn, log.checkOut);
      const seg2 = calcSegHours(log.checkIn2, log.checkOut2);
      const actualHours = seg1 + seg2;
      const dutyHrs = selectedStaff?.duty_hours || 9;
      const otHours = Math.max(0, actualHours - dutyHrs);

      await api.approveOT(selectedStaff.id, selectedStaff.name, log.date, otHours.toFixed(2), actualHours.toFixed(2));
      showToast(`✅ OT approved: ${otHours.toFixed(2)}h`);
      loadDashboard();
    } catch (err) {
      showToast('Approve error: ' + err.message, true);
    } finally {
      hideLoading();
    }
  }

  // ── Reject OT ──
  async function handleRejectOT(log) {
    showLoading('Rejecting OT...');
    try {
      const seg1 = calcSegHours(log.checkIn, log.checkOut);
      const seg2 = calcSegHours(log.checkIn2, log.checkOut2);
      const actualHours = seg1 + seg2;

      await api.rejectOT(selectedStaff.id, selectedStaff.name, log.date, actualHours.toFixed(2));
      showToast('✗ OT rejected');
      loadDashboard();
    } catch (err) {
      showToast('Reject error: ' + err.message, true);
    } finally {
      hideLoading();
    }
  }



  // ── Delete Attendance ──
  function handleDeleteClick(log) {
    setDeleteConfirm({ visible: true, id: log.id, date: log.date, staffName: selectedStaff.name });
  }

  async function confirmDelete() {
    try {
      await api.deleteAttendance(deleteConfirm.id, deleteConfirm.staffName);
      showToast('🗑 Attendance entry deleted');
      setDeleteConfirm({ ...deleteConfirm, visible: false });
      loadDashboard();
    } catch (err) {
      showToast('Delete error: ' + err.message, true);
    }
  }

  async function handleExport() {
    if (!selectedStaff) return showToast('Select staff first', true);
    showLoading('Generating CSV...');
    try {
      const csv = await api.exportStaffReport(selectedStaff.id, selectedStaff.name, selectedMonth);
      downloadCSV(csv, `${selectedStaff.name}_${selectedMonth}_attendance.csv`);
      showToast('📥 CSV downloaded');
    } catch (err) {
      showToast('Export error: ' + err.message, true);
    } finally {
      hideLoading();
    }
  }

  // Show all entries including OFF_DAY and MISSING, but filter for display purposes
  const activeLogs = dashboardData?.logs?.filter(l => l.status !== 'OFF_DAY' && l.status !== 'MISSING') || [];

  return (
    <div>
      {/* Controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid-2">
          <div>
            <label>STAFF</label>
            <select
              value={selectedStaff?.id || ''}
              onChange={e => {
                const staff = staffList.find(s => s.id === parseInt(e.target.value));
                setSelectedStaff(staff || null);
              }}
            >
              <option value="" disabled>--- Select ---</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>MONTH</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 'clamp(10px, 2vw, 14px)', flexWrap: 'wrap' }}>
          <button className="btn-sm" style={{ background: 'var(--accent)' }} onClick={handleExport}>
            📥 Export CSV
          </button>
          <button className="btn-sm" style={{ background: '#3b82f6' }} onClick={async () => {
            if (!selectedStaff) return showToast('Select staff first', true);
            showLoading('Generating full history...');
            try {
              const csv = await api.exportIndividualHistory(selectedStaff.id, selectedStaff.name);
              downloadCSV(csv, `${selectedStaff.name}_full_history.csv`);
              showToast('📥 Full history downloaded');
            } catch (err) {
              showToast('Export error: ' + err.message, true);
            } finally {
              hideLoading();
            }
          }}>
            📥 Full History
          </button>
        </div>
      </div>

      {/* Summary Card */}
      {dashboardData && (
        <>
          <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: 'clamp(16px, 3vw, 24px)' }}>
            <small style={{ color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', fontSize: 'clamp(0.55rem, 1.5vw, 0.65rem)' }}>
              {formatMonthDisplay(selectedMonth)} ({dashboardData.summary.status})
            </small>
            <div style={{
              fontSize: 'clamp(1.8rem, 5vw, 2.2rem)',
              fontWeight: 800,
              marginTop: 4,
            }}>
              {dashboardData.summary.netOt} h
            </div>
            <button
              className="btn-sm"
              style={{ background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', marginTop: 8 }}
              onClick={() => setShowSummary(true)}
            >
              VIEW SUMMARY
            </button>
          </div>

          {/* Stats Grid — compact cards */}
          <div className="grid-3 dashboard-stats" style={{ marginBottom: 16 }}>
            <div className="stat-card compact">
              <div className="num" style={{ color: 'var(--accent)' }}>{dashboardData.summary.totalOt}</div>
              <div className="lbl">Total OT</div>
            </div>
            <div className="stat-card compact">
              <div className="num" style={{ color: '#a78bfa' }}>{dashboardData.summary.offDays}</div>
              <div className="lbl">Off Days</div>
            </div>
            <div className="stat-card compact">
              <div className="num" style={{ color: '#f59e0b' }}>{dashboardData.summary.netOt}</div>
              <div className="lbl">Net Payable</div>
            </div>
          </div>

          {/* Table — only shows days with actual attendance entries */}
          {activeLogs.length > 0 && (
            <div className="card dashboard-table-card">
              <div className="responsive-table dashboard-table">
                <table>
                  <thead>
                    <tr>
                      <th className="th-date">DATE</th>
                      <th className="th-shift">SHIFT</th>
                      <th className="th-hrs">HRS</th>
                      <th className="th-ot">OT</th>
                      <th className="th-status">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLogs.map(log => (
                      <tr key={log.date}>
                        <td className="td-date">
                          {log.displayDate}
                          {log.isSplit && <span className="split-badge">⤵</span>}
                        </td>
                        <td className="td-shift">
                          <span className="shift-text">{log.shift}</span>
                        </td>
                        <td className="td-hrs">
                          {log.totalHours || '---'}
                        </td>
                        <td className="td-ot">
                          {log.otValue}
                        </td>
                        <td className="td-status">
                          <span className={`status-pill ${getStatusClass(log.status)}`}>
                            {getStatusLabel(log.status)}
                          </span>
                          {/* Manager actions */}
                          {isManager && (
                            <div className="mgr-actions">
                              {/* PENDING_APPROVAL → Approve / Reject */}
                              {log.status === 'PENDING_APPROVAL' && (
                                <>
                                  <button
                                    onClick={() => handleApproveOT(log)}
                                    className="mgr-btn approve"
                                    title="Approve OT"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => handleRejectOT(log)}
                                    className="mgr-btn reject"
                                    title="Reject OT"
                                  >
                                    ✗
                                  </button>
                                </>
                              )}
                              {/* INCOMPLETE → Fix times */}
                              {log.status === 'INCOMPLETE' && (
                                <button
                                  onClick={() => openFix(log)}
                                  className="mgr-btn fix"
                                >
                                  FIX
                                </button>
                              )}
                              {/* Delete button for entries with a log */}
                              {log.id && (
                                <button
                                  onClick={() => handleDeleteClick(log)}
                                  className="mgr-btn delete"
                                  title="Delete entry"
                                >
                                  🗑
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Message when no active entries */}
          {activeLogs.length === 0 && dashboardData && (
            <div className="card" style={{ textAlign: 'center', padding: 'clamp(20px, 4vw, 30px)', opacity: 0.5 }}>
              <p style={{ fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)' }}>
                No attendance entries for this month
              </p>
              <small style={{ fontSize: 'clamp(0.55rem, 1.2vw, 0.65rem)' }}>
                All days are off days
              </small>
            </div>
          )}
        </>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 'clamp(30px, 8vw, 50px)' }}>
          <div className="loader" style={{ width: 24, height: 24, borderWidth: 3, borderColor: 'var(--accent)', borderBottomColor: 'transparent' }} />
          <p style={{ color: 'var(--accent)', fontSize: '0.7rem', marginTop: 12 }}>LOADING...</p>
        </div>
      )}

      {!selectedStaff && !loading && (
        <div className="card" style={{ textAlign: 'center', opacity: 0.5, padding: 'clamp(30px, 8vw, 50px)' }}>
          <p style={{ fontSize: '0.85rem' }}>Select a staff member and month to view dashboard</p>
        </div>
      )}          {/* Summary Modal */}
          <div className={`modal-overlay ${showSummary ? 'show' : ''}`} onClick={() => setShowSummary(false)}>
            <div className="modal-body" onClick={e => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, color: 'var(--accent)', marginBottom: 16, fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)' }}>
                {formatMonthDisplay(selectedMonth)} Summary
              </h3>
              <div style={{ lineHeight: 2.2 }}>
                <div className="grid-2" style={{ gap: 12 }}><span>Total OT:</span><b style={{ textAlign: 'right' }}>{dashboardData?.summary.totalOt} hrs</b></div>
                <div className="grid-2" style={{ gap: 12 }}><span>Off Days:</span><b style={{ textAlign: 'right' }}>{dashboardData?.summary.offDays}</b></div>
                <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />
                <div className="grid-2" style={{ gap: 12 }}><span>Net Payable:</span><b style={{ textAlign: 'right', color: '#10b981', fontSize: 'clamp(1.1rem, 2.5vw, 1.2rem)' }}>{dashboardData?.summary.netOt} hrs</b></div>
                <div className="grid-2" style={{ gap: 12 }}><span>Status:</span><b style={{ textAlign: 'right' }}>{dashboardData?.summary.status}</b></div>
              </div>
              <button className="btn-primary slate" style={{ marginTop: 20, padding: 12 }} onClick={() => setShowSummary(false)}>
                CLOSE
              </button>
            </div>
          </div>

      {/* Fix Modal — edit entries for both segments */}
      <div className={`modal-overlay ${fixModal.visible ? 'show' : ''}`} onClick={() => setFixModal({ ...fixModal, visible: false })}>
        <div className="modal-body" onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0, color: 'var(--accent)', fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)' }}>Fix Entry — {fixModal.date}</h3>
          <p style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: 16 }}>
            Fill in any fields you want to set. Empty fields will remain unchanged.
          </p>

          {/* Segment 1 */}
          <small style={{ fontSize: '0.5rem', opacity: 0.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6, display: 'block' }}>
            Shift 1
          </small>
          <label>Check In <span style={{ opacity: 0.6, fontWeight: 400, textTransform: 'none' }}>(current: {fixModal.currentIn || '—'})</span></label>
          <input
            type="time"
            value={fixIn}
            onChange={e => setFixIn(e.target.value)}
          />
          <label style={{ marginTop: 8 }}>Check Out <span style={{ opacity: 0.6, fontWeight: 400, textTransform: 'none' }}>(current: {fixModal.currentOut || '—'})</span></label>
          <input
            type="time"
            value={fixOut}
            onChange={e => setFixOut(e.target.value)}
          />

          {/* Segment 2 */}
          <div style={{
            marginTop: 16,
            padding: '12px 14px',
            background: 'var(--accent-dim)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-accent)',
          }}>
            <small style={{ fontSize: '0.5rem', opacity: 0.7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, display: 'block', color: 'var(--accent)' }}>
              Shift 2 (Split Duty)
            </small>
            <label>Check In 2 <span style={{ opacity: 0.6, fontWeight: 400, textTransform: 'none' }}>(current: {fixModal.currentIn2 || '—'})</span></label>
            <input
              type="time"
              value={fixIn2}
              onChange={e => setFixIn2(e.target.value)}
            />
            <label style={{ marginTop: 8 }}>Check Out 2 <span style={{ opacity: 0.6, fontWeight: 400, textTransform: 'none' }}>(current: {fixModal.currentOut2 || '—'})</span></label>
            <input
              type="time"
              value={fixOut2}
              onChange={e => setFixOut2(e.target.value)}
            />
          </div>

          <div className="grid-2" style={{ marginTop: 16, gap: 8 }}>
            <button className="btn-primary slate" style={{ padding: 12 }} onClick={() => setFixModal({ ...fixModal, visible: false })}>
              CANCEL
            </button>
            <button className="btn-primary green" style={{ padding: 12 }} onClick={saveFix}>
              SUBMIT
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal
        visible={deleteConfirm.visible}
        title="DELETE ATTENDANCE ENTRY"
        message={`Delete the attendance entry for <b>${deleteConfirm.date}</b>? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ ...deleteConfirm, visible: false })}
      />
    </div>
  );
}
