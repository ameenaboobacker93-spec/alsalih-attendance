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

export default function Dashboard({ branch, staffList, api, isManager }) {
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

  // Load dashboard when staff or month changes
  useEffect(() => {
    if (selectedStaff && selectedMonth) {
      loadDashboard();
    }
  }, [selectedStaff?.id, selectedMonth]);

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

          {/* Table */}
          <div className="card" style={{ padding: 'clamp(12px, 2vw, 20px)' }}>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th style={{ color: '#06b6d4', fontSize: 'clamp(0.5rem, 1.2vw, 0.6rem)', textAlign: 'left', padding: '0 8px 8px', textTransform: 'uppercase', fontWeight: 800, whiteSpace: 'nowrap' }}>DATE</th>
                    <th style={{ color: '#06b6d4', fontSize: 'clamp(0.5rem, 1.2vw, 0.6rem)', textAlign: 'left', padding: '0 8px 8px', textTransform: 'uppercase', fontWeight: 800, whiteSpace: 'nowrap' }}>SHIFT</th>
                    <th style={{ color: '#06b6d4', fontSize: 'clamp(0.5rem, 1.2vw, 0.6rem)', textAlign: 'center', padding: '0 8px 8px', textTransform: 'uppercase', fontWeight: 800, whiteSpace: 'nowrap' }}>OT</th>
                    <th style={{ color: '#06b6d4', fontSize: 'clamp(0.5rem, 1.2vw, 0.6rem)', textAlign: 'right', padding: '0 8px 8px', textTransform: 'uppercase', fontWeight: 800, whiteSpace: 'nowrap' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.logs.map(log => (
                    <tr key={log.date}>
                      <td style={{ padding: '10px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px 0 0 8px', fontWeight: 600, fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)', whiteSpace: 'nowrap' }}>
                        {log.displayDate}
                        {log.isSplit && <span style={{ marginLeft: 4, fontSize: '0.55rem', color: '#a78bfa' }}>⤵</span>}
                      </td>
                      <td style={{ padding: '10px 8px', background: 'rgba(255,255,255,0.02)', fontSize: 'clamp(0.65rem, 1.4vw, 0.75rem)' }}>
                        <small style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>{log.shift}</small>
                      </td>
                      <td style={{ padding: '10px 8px', background: 'rgba(255,255,255,0.02)', textAlign: 'center', fontWeight: 700, fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)', whiteSpace: 'nowrap' }}>
                        {log.otValue}
                      </td>
                      <td style={{ padding: '10px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '0 8px 8px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span className={`status-pill ${getStatusClass(log.status)}`}
                          style={{ fontSize: 'clamp(0.5rem, 1.2vw, 0.6rem)' }}>
                          {getStatusLabel(log.status)}
                        </span>
                        {/* Manager actions */}
                        {isManager && (
                          <div style={{ display: 'inline-flex', gap: 4, marginLeft: 6, flexWrap: 'nowrap', alignItems: 'center' }}>
                            {/* PENDING_APPROVAL → Approve / Reject */}
                            {log.status === 'PENDING_APPROVAL' && (
                              <>
                                <button
                                  onClick={() => handleApproveOT(log)}
                                  style={{
                                    background: '#10b981',
                                    border: 'none',
                                    borderRadius: 5,
                                    fontSize: 'clamp(0.45rem, 1vw, 0.5rem)',
                                    padding: '4px 6px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    whiteSpace: 'nowrap',
                                    minHeight: 24,
                                  }}
                                  title="Approve OT"
                                >
                                  ✓ OT
                                </button>
                                <button
                                  onClick={() => handleRejectOT(log)}
                                  style={{
                                    background: '#6b7280',
                                    border: 'none',
                                    borderRadius: 5,
                                    fontSize: 'clamp(0.45rem, 1vw, 0.5rem)',
                                    padding: '4px 6px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    whiteSpace: 'nowrap',
                                    minHeight: 24,
                                  }}
                                  title="Reject OT"
                                >
                                  ✗ No OT
                                </button>
                              </>
                            )}
                            {/* INCOMPLETE → Fix times */}
                            {log.status === 'INCOMPLETE' && (
                              <button
                                onClick={() => openFix(log.date, log.status)}
                                style={{
                                  background: '#06b6d4',
                                  border: 'none',
                                  borderRadius: 5,
                                  fontSize: 'clamp(0.45rem, 1vw, 0.5rem)',
                                  padding: '4px 8px',
                                  color: 'white',
                                  cursor: 'pointer',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  minHeight: 24,
                                }}
                              >
                                FIX
                              </button>
                            )}
                            {/* Delete button for entries with a log */}
                            {log.id && (
                              <button
                                onClick={() => handleDeleteClick(log)}
                                style={{
                                  background: '#ef4444',
                                  border: 'none',
                                  borderRadius: 5,
                                  fontSize: 'clamp(0.45rem, 1vw, 0.5rem)',
                                  padding: '4px 6px',
                                  color: 'white',
                                  cursor: 'pointer',
                                  fontWeight: 800,
                                  opacity: 0.7,
                                  minHeight: 24,
                                }}
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
