import React, { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { getCurrentMonth, downloadCSV } from '../utils/helpers';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminPanel({ branch, staffList, setStaffList, api, refreshKey }) {
  const { showToast, showLoading, hideLoading, resetSessionTimer } = useApp();

  // Staff management
  const [staffData, setStaffData] = useState([]);
  const [regModal, setRegModal] = useState({ visible: false, editId: null });
  const [regName, setRegName] = useState('');
  const [regHrs, setRegHrs] = useState(9);
  const [regStart, setRegStart] = useState('09:00');
  const [regEnd, setRegEnd] = useState('18:00');

  // Settlements
  const [settleMonth, setSettleMonth] = useState(getCurrentMonth());
  const [settleStaff, setSettleStaff] = useState('');
  const [settleOT, setSettleOT] = useState('');
  const [settleStatus, setSettleStatus] = useState('PENDING');

  // PIN change
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');

  // Audit log
  const [auditLogs, setAuditLogs] = useState([]);

  // Confirm modal
  const [confirm, setConfirm] = useState({ visible: false, message: '', onConfirm: null });

  // Stats
  const [stats, setStats] = useState({ staff: 0, onDuty: 0 });
  const [onDutyList, setOnDutyList] = useState([]);

  useEffect(() => {
    if (branch) {
      loadAdminData();
      loadAuditLogs();
    }
  }, [branch, refreshKey]);

  async function loadAdminData() {
    resetSessionTimer();
    try {
      const [fullList, dutyStatus] = await Promise.all([
        api.getStaffFullList(),
        api.getOnDutyStatus(),
      ]);
      setStaffData(fullList);
      setStats({
        staff: fullList.length,
        onDuty: dutyStatus.filter(s => s.status === 'ON DUTY').length,
      });
      setOnDutyList(dutyStatus);
    } catch (err) {
      showToast('Failed to load admin data: ' + err.message, true);
    }
  }

  async function loadAuditLogs() {
    try {
      const logs = await api.getAuditLogs(50);
      setAuditLogs(logs);
    } catch (err) {
      // Silent fail
    }
  }

  // ── Staff CRUD ──
  function openRegModal(staff = null) {
    if (staff) {
      setRegName(staff.name);
      setRegHrs(staff.duty_hours);
      setRegStart(staff.shift_start);
      setRegEnd(staff.shift_end);
      setRegModal({ visible: true, editId: staff.id });
    } else {
      setRegName('');
      setRegHrs(9);
      setRegStart('09:00');
      setRegEnd('18:00');
      setRegModal({ visible: true, editId: null });
    }
  }

  async function saveStaff() {
    if (!regName || !regHrs) return showToast('Enter Name and Duty Hours', true);
    try {
      if (regModal.editId) {
        await api.updateStaff(regModal.editId, regName, regHrs, regStart, regEnd);
        showToast('Staff updated');
      } else {
        await api.registerStaff(regName, regHrs, regStart, regEnd);
        showToast('Staff registered');
      }
      setRegModal({ visible: false, editId: null });
      loadAdminData();
      // Refresh parent staff list
      const newList = await api.getStaffList();
      setStaffList(newList);
    } catch (err) {
      showToast('Error: ' + err.message, true);
    }
  }

  function handleDelete(staff) {
    setConfirm({
      visible: true,
      message: `Delete <b>${staff.name}</b>? Their attendance history will be preserved.`,
      onConfirm: async () => {
        try {
          await api.deleteStaff(staff.id);
          showToast('Staff deleted');
          loadAdminData();
          const newList = await api.getStaffList();
          setStaffList(newList);
        } catch (err) {
          showToast('Delete error: ' + err.message, true);
        }
      },
    });
  }

  // ── Settlement ──
  async function saveSettlement() {
    if (!settleStaff || !settleOT) return showToast('Select Staff and Enter OT', true);
    resetSessionTimer();
    try {
      const staff = staffData.find(s => s.id === parseInt(settleStaff));
      await api.saveSettlement(parseInt(settleStaff), staff?.name || '', settleMonth, settleOT, settleStatus);
      showToast('Settlement saved');
      setSettleOT('');
      await api.logAudit('Admin', 'SETTLEMENT', `${staff?.name} — ${settleMonth} (OT: ${settleOT}, ${settleStatus})`);
    } catch (err) {
      showToast('Settlement error: ' + err.message, true);
    }
  }

  // ── Export ──
  async function exportAll() {
    const month = settleMonth || getCurrentMonth();
    showLoading('Generating all-staff report...');
    try {
      const csv = await api.exportAllStaffReport(month);
      downloadCSV(csv, `ALL_STAFF_${month}_attendance.csv`);
      showToast('📥 All-staff report downloaded');
    } catch (err) {
      showToast('Export error: ' + err.message, true);
    } finally {
      hideLoading();
    }
  }

  // ── PIN Change ──
  async function handleChangePin() {
    if (!currentPin || !newPin) return showToast('Enter current and new PIN', true);
    if (newPin.length < 4) return showToast('PIN must be at least 4 digits', true);
    try {
      await api.changePin(currentPin, newPin);
      showToast('✅ PIN updated');
      setCurrentPin('');
      setNewPin('');
    } catch (err) {
      showToast(err.message, true);
    }
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid-2" style={{ marginBottom: 16, gap: 'clamp(8px, 2vw, 12px)' }}>
        <div className="stat-card">
          <div className="num">{stats.staff}</div>
          <div className="lbl">Total Staff</div>
        </div>
        <div className="stat-card">
          <div className="num" style={{ color: '#10b981' }}>{stats.onDuty}</div>
          <div className="lbl">On Duty Now</div>
        </div>
      </div>

      {/* Staff Management */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 16, fontSize: 'clamp(0.55rem, 1.5vw, 0.65rem)' }}>
          Staff Management
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className="btn-sm" style={{ background: '#10b981', minHeight: 'var(--touch-min)' }} onClick={() => openRegModal()}>
            + Register
          </button>
          <button className="btn-sm" style={{ background: 'var(--accent)', minHeight: 'var(--touch-min)' }} onClick={loadAdminData}>
            ↻ Refresh
          </button>
        </div>
        <div style={{ fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)' }}>
          {staffData.length === 0 ? (
            <div style={{ opacity: 0.5, textAlign: 'center', padding: 20 }}>
              No staff registered
            </div>
          ) : (
            <div className="responsive-table">
              <table>
                <tbody>
                  {staffData.map(s => (
                    <tr key={s.id} className="admin-staff-row">
                      <td className="admin-staff-info">
                        <div className="admin-staff-name">{s.name}</div>
                        <div className="admin-staff-detail">
                          {s.duty_hours}h · {s.shift_start}–{s.shift_end}
                        </div>
                      </td>
                      <td className="admin-staff-actions">
                        <button
                          className="btn-sm"
                          style={{ background: 'var(--accent)', padding: '6px 12px', marginRight: 4, minHeight: 'var(--touch-min)' }}
                          onClick={() => openRegModal(s)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-sm"
                          style={{ background: '#ef4444', padding: '6px 12px', minHeight: 'var(--touch-min)' }}
                          onClick={() => handleDelete(s)}
                        >
                          Del
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* On Duty Status */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ fontSize: 'clamp(0.55rem, 1.5vw, 0.65rem)' }}>
          On-Duty Status
        </div>
        <div className="grid-2" style={{ gap: 'clamp(6px, 1.5vw, 10px)' }}>
          {onDutyList.length === 0 ? (
            <div style={{ opacity: 0.5, fontSize: '0.7rem', gridColumn: '1 / -1', textAlign: 'center', padding: 20 }}>
              No logs found
            </div>
          ) : (
            onDutyList.map(s => (
              <div key={s.staffId} className="admin-on-duty-card">
                <div className="admin-on-duty-name">
                  {s.status === 'ON DUTY' ? '🟢' : '⚪'} {s.name}
                </div>
                <div className="admin-on-duty-since">{s.status} since {s.since}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Settlements */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">
          Settlements
        </div>
        <div className="card-accent admin-section-inner">
          <div className="grid-2" style={{ marginBottom: 8, gap: 'clamp(8px, 2vw, 12px)' }}>
            <div>
              <label>Target Month</label>
              <input type="month" value={settleMonth} onChange={e => setSettleMonth(e.target.value)} />
            </div>
            <div>
              <label>Staff</label>
              <select value={settleStaff} onChange={e => setSettleStaff(e.target.value)}>
                <option value="" disabled>--- Select ---</option>
                {staffData.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 8, gap: 'clamp(8px, 2vw, 12px)' }}>
            <div>
              <label>Net OT</label>
              <input type="number" step="0.01" value={settleOT} onChange={e => setSettleOT(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label>Status</label>
              <select value={settleStatus} onChange={e => setSettleStatus(e.target.value)}>
                <option>PENDING</option>
                <option>CLEARED</option>
              </select>
            </div>
          </div>
          <button className="btn-primary green" style={{ marginTop: 4, minHeight: 'var(--touch-min)' }} onClick={saveSettlement}>
            LOCK & PUBLISH
          </button>
        </div>
      </div>

      {/* Export */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">
          Export Reports
        </div>
        <button className="btn-sm" style={{ background: '#3b82f6', minHeight: 'var(--touch-min)' }} onClick={exportAll}>
          📥 All Staff CSV
        </button>
        <small style={{ display: 'block', marginTop: 6, opacity: 0.4, fontSize: 'clamp(0.5rem, 1.2vw, 0.55rem)' }}>
          Exports attendance for all staff for the selected month
        </small>
      </div>

      {/* PIN Change */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">
          Settings
        </div>
        <div className="card-accent admin-section-inner">
          <div className="admin-pin-title">
            Change Admin PIN
          </div>
          <div className="admin-pin-layout">
            <div>
              <label>Current</label>
              <input type="password" value={currentPin} onChange={e => setCurrentPin(e.target.value)} placeholder="••••" />
            </div>
            <div>
              <label>New</label>
              <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="••••" />
            </div>
            <button
              className="btn-primary cyan"
              style={{ padding: '14px', fontSize: 'clamp(0.55rem, 1.3vw, 0.65rem)', minHeight: 'var(--touch-min)' }}
              onClick={handleChangePin}
            >
              UPDATE
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">
          Audit Log
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
          <small style={{ opacity: 0.5, fontSize: 'clamp(0.5rem, 1.2vw, 0.6rem)' }}>Track of all admin actions</small>
          <button className="btn-sm" style={{ background: 'var(--accent)', padding: '6px 12px', minHeight: 'var(--touch-min)' }} onClick={loadAuditLogs}>
            ↻ Refresh
          </button>
        </div>
        <div className="admin-audit-box">
          {auditLogs.length === 0 ? (
            <div style={{ opacity: 0.5, textAlign: 'center', padding: 10 }}>No audit entries yet</div>
          ) : (
            auditLogs.map((log, i) => (
              <div key={i} className="admin-audit-entry">
                <span className="admin-audit-time">{log.time}</span>
                <span className="admin-audit-action">{log.action}</span>
                <span className="admin-audit-detail">
                  {log.detail}{log.staff ? ` · ${log.staff}` : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Staff Registration Modal */}
      <div className={`modal-overlay ${regModal.visible ? 'show' : ''}`} onClick={() => setRegModal({ ...regModal, visible: false })}>
        <div className="modal-body" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0, color: 'var(--accent)', fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)' }}>
            {regModal.editId ? 'EDIT STAFF' : 'STAFF REGISTRATION'}
          </h3>
          <label>STAFF NAME</label>
          <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="FULL NAME" />
          <label style={{ marginTop: 8 }}>DUTY HOURS (FOR OT)</label>
          <input type="number" value={regHrs} onChange={e => setRegHrs(e.target.value)} placeholder="9" />
          <div className="grid-2" style={{ marginTop: 8, gap: 8 }}>
            <div>
              <label>SHIFT START</label>
              <input type="time" value={regStart} onChange={e => setRegStart(e.target.value)} />
            </div>
            <div>
              <label>SHIFT END</label>
              <input type="time" value={regEnd} onChange={e => setRegEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: 16, gap: 8 }}>
            <button className="btn-primary slate" style={{ padding: 12 }} onClick={() => setRegModal({ ...regModal, visible: false })}>
              CANCEL
            </button>
            <button className="btn-primary green" style={{ padding: 12 }} onClick={saveStaff}>
              {regModal.editId ? 'UPDATE' : 'REGISTER'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        visible={confirm.visible}
        title="CONFIRM ACTION"
        message={confirm.message}
        onConfirm={() => { confirm.onConfirm?.(); setConfirm({ ...confirm, visible: false }); }}
        onCancel={() => setConfirm({ ...confirm, visible: false })}
      />
    </div>
  );
}
