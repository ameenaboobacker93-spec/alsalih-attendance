import React, { useState, useEffect, useCallback } from 'react';
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

  // Fix modal state
  const [fixModal, setFixModal] = useState({ visible: false, date: '', status: '', staffId: null, staffName: '' });
  const [fixIn, setFixIn] = useState('');
  const [fixOut, setFixOut] = useState('');
  const [fixOT, setFixOT] = useState('');

  // Summary modal
  const [showSummary, setShowSummary] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, id: null, date: '', staffName: '' });

  // Today's summary state (branch-wide stats)
  const [todaySummary, setTodaySummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Load dashboard when staff or month changes
  useEffect(() => {
    if (selectedStaff && selectedMonth) {
      loadDashboard();
    }
  }, [selectedStaff?.id, selectedMonth, refreshKey]);

  // Load today's branch-wide summary
  useEffect(() => {
    loadTodaySummary();
  }, [refreshKey, staffList.length]);

  async function loadTodaySummary() {
    setSummaryLoading(true);
    try {
      const statusList = await api.getOnDutyStatus();
      const total = staffList.length;
      const onDuty = statusList.filter(s => s.status === 'ON DUTY').length;
      const checkedOut = statusList.filter(s => s.status === 'OFF').length;
      const absent = Math.max(0, total - statusList.length);
      setTodaySummary({ total, onDuty, checkedOut, absent });
    } catch {
      // Silent fail
    } finally {
      setSummaryLoading(false);
    }
  }

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

  function openFix(date, status) {
    setFixModal({ visible: true, date, status, staffId: selectedStaff.id, staffName: selectedStaff.name });
    setFixIn('');
    setFixOut('');
    setFixOT('');
  }

  async function saveFix() {
    try {
      await api.managerFixEntry(
        fixModal.staffId,
        fixModal.staffName,
        fixModal.date,
        fixIn,
        fixOut,
        fixOT
      );
      showToast('Entry fixed successfully');
      setFixModal({ ...fixModal, visible: false });
      loadDashboard();
    } catch (err) {
      showToast('Fix error: ' + err.message, true);
    }
  }

  // ── Approve OT ──
  async function handleApproveOT(log) {
    showLoading('Approving OT...');
    try {
      // Calculate actual hours from check-in/check-out
      const checkIn = new Date(log.checkIn);
      const checkOut = new Date(log.checkOut);
      const diff = (checkOut - checkIn) / (1000 * 60 * 60);
      const actualHours = diff < 0 ? diff + 24 : diff;
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
      const checkIn = new Date(log.checkIn);
      const checkOut = new Date(log.checkOut);
      const diff = (checkOut - checkIn) / (1000 * 60 * 60);
      const actualHours = diff < 0 ? diff + 24 : diff;

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

  // Filter out OFF_DAY and MISSING entries — show only actual attendance days
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
          <button className="btn-sm" style={{ background: '#06b6d4' }} onClick={handleExport}>
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

      {/* Today's Summary — Branch-wide stats */}
      <div className="card today-summary-card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>
          Today at a Glance
        </div>
        {summaryLoading && todaySummary === null ? (
          <div className="today-summary-loading">Loading...</div>
        ) : todaySummary ? (
          <div className="today-summary-grid">
            <div className="today-stat">
              <div className="today-stat-num">{todaySummary.total}</div>
              <div className="today-stat-lbl">Total Staff</div>
            </div>
            <div className="today-stat today-stat-on-duty">
              <div className="today-stat-num">{todaySummary.onDuty}</div>
              <div className="today-stat-lbl">🟢 On Duty</div>
            </div>
            <div className="today-stat today-stat-out">
              <div className="today-stat-num">{todaySummary.checkedOut}</div>
              <div className="today-stat-lbl">🔵 Checked Out</div>
            </div>
            <div className="today-stat today-stat-absent">
              <div className="today-stat-num">{todaySummary.absent}</div>
              <div className="today-stat-lbl">⚪ Absent</div>
            </div>
          </div>
        ) : (
          <div className="today-summary-loading">No data available</div>
        )}
      </div>

      {/* Summary Card */}
      {dashboardData && (
        <>
          <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: 'clamp(16px, 3vw, 24px)' }}>
            <small style={{ color: '#06b6d4', fontWeight: 800, textTransform: 'uppercase', fontSize: 'clamp(0.55rem, 1.5vw, 0.65rem)' }}>
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
              style={{ background: 'none', border: '1px solid #06b6d4', color: '#06b6d4', marginTop: 8 }}
              onClick={() => setShowSummary(true)}
            >
              VIEW SUMMARY
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="num" style={{ color: '#06b6d4' }}>{dashboardData.summary.totalOt}</div>
              <div className="lbl">Total OT</div>
            </div>
            <div className="stat-card">
              <div className="num" style={{ color: '#f59e0b' }}>{dashboardData.summary.totalComp}</div>
              <div className="lbl">Compensated</div>
            </div>
            <div className="stat-card">
              <div className="num" style={{ color: '#a78bfa' }}>{dashboardData.summary.offDays}</div>
              <div className="lbl">Off Days</div>
            </div>
          </div>

          {/* Table — only shows days with actual attendance entries */}
          {activeLogs.length > 0 && (
            <div className="card dashboard-table-card" style={{ padding: 'clamp(8px, 1.5vw, 20px)' }}>
              <div className="responsive-table dashboard-table">
                <table>
                  <thead>
                    <tr>
                      <th className="th-date">DATE</th>
                      <th className="th-shift">SHIFT</th>
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
                                    ✓ OT
                                  </button>
                                  <button
                                    onClick={() => handleRejectOT(log)}
                                    className="mgr-btn reject"
                                    title="Reject OT"
                                  >
                                    ✗ No
                                  </button>
                                </>
                              )}
                              {/* INCOMPLETE → Fix times */}
                              {log.status === 'INCOMPLETE' && (
                                <button
                                  onClick={() => openFix(log.date, log.status)}
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
          <div className="loader" style={{ width: 24, height: 24, borderWidth: 3, borderColor: '#06b6d4', borderBottomColor: 'transparent' }} />
          <p style={{ color: '#06b6d4', fontSize: '0.7rem', marginTop: 12 }}>LOADING...</p>
        </div>
      )}

      {!selectedStaff && !loading && (
        <div className="card" style={{ textAlign: 'center', opacity: 0.5, padding: 'clamp(30px, 8vw, 50px)' }}>
          <p style={{ fontSize: '0.85rem' }}>Select a staff member and month to view dashboard</p>
        </div>
      )}

      {/* Summary Modal */}
      <div className={`modal-overlay ${showSummary ? 'show' : ''}`} onClick={() => setShowSummary(false)}>
        <div className="modal-body" onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0, color: '#06b6d4', marginBottom: 16, fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)' }}>
            {formatMonthDisplay(selectedMonth)} Summary
          </h3>
          <div style={{ lineHeight: 2.2 }}>
            <div className="grid-2" style={{ gap: 12 }}><span>Total OT:</span><b style={{ textAlign: 'right' }}>{dashboardData?.summary.totalOt} hrs</b></div>
            <div className="grid-2" style={{ gap: 12 }}><span>Compensated:</span><b style={{ textAlign: 'right', color: '#ef4444' }}>{dashboardData?.summary.totalComp} hrs</b></div>
            <div className="grid-2" style={{ gap: 12 }}><span>Off Days:</span><b style={{ textAlign: 'right' }}>{dashboardData?.summary.offDays}</b></div>
            <hr style={{ border: 0, borderTop: '1px solid #333', margin: '8px 0' }} />
            <div className="grid-2" style={{ gap: 12 }}><span>Net Payable:</span><b style={{ textAlign: 'right', color: '#10b981', fontSize: 'clamp(1.1rem, 2.5vw, 1.2rem)' }}>{dashboardData?.summary.netOt} hrs</b></div>
            <div className="grid-2" style={{ gap: 12 }}><span>Status:</span><b style={{ textAlign: 'right' }}>{dashboardData?.summary.status}</b></div>
          </div>
          <button className="btn-primary slate" style={{ marginTop: 20, padding: 12 }} onClick={() => setShowSummary(false)}>
            CLOSE
          </button>
        </div>
      </div>

      {/* Fix Modal (for INCOMPLETE entries — fix check-in/check-out times) */}
      <div className={`modal-overlay ${fixModal.visible ? 'show' : ''}`} onClick={() => setFixModal({ ...fixModal, visible: false })}>
        <div className="modal-body" onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0, fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)' }}>Fix Entry — {fixModal.date}</h3>
          <input type="time" value={fixIn} onChange={e => setFixIn(e.target.value)} placeholder="Check In" />
          <input type="time" value={fixOut} onChange={e => setFixOut(e.target.value)} placeholder="Check Out" style={{ marginTop: 8 }} />
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
