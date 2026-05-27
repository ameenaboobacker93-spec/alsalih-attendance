import React, { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { getCurrentMonth } from '../utils/helpers';

export default function DutyRoster({ branch, staffList, api, isManager, refreshKey }) {
  const { showToast, showLoading, hideLoading } = useApp();
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [rosterData, setRosterData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editDate, setEditDate] = useState(null);
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('18:00');
  const [editIsSplit, setEditIsSplit] = useState(false);
  const [editSplitStart, setEditSplitStart] = useState('');
  const [editSplitEnd, setEditSplitEnd] = useState('');
  const [editIsOff, setEditIsOff] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // Load roster
  useEffect(() => {
    if (selectedStaff && selectedMonth) {
      loadRoster();
    }
  }, [selectedStaff?.id, selectedMonth, refreshKey]);

  async function loadRoster() {
    if (!selectedStaff) return;
    setLoading(true);
    try {
      const roster = await api.getDutyRoster(selectedStaff.id, selectedMonth);
      setRosterData(roster);
    } catch (err) {
      showToast('Failed to load roster: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  }

  // Generate calendar days for the month
  function getCalendarDays() {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];
    const today = new Date();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (date > today) break;
      const dateKey = date.toLocaleDateString('en-CA');
      const rosterEntry = rosterData.find(r => {
        const rDate = new Date(r.date).toLocaleDateString('en-CA');
        return rDate === dateKey;
      });

      days.push({
        date: dateKey,
        display: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', weekday: 'short' }),
        roster: rosterEntry || null,
        isToday: date.toLocaleDateString('en-CA') === today.toLocaleDateString('en-CA'),
      });
    }
    return days;
  }

  function openEditor(day) {
    if (!isManager) return;
    if (day.roster) {
      setEditStart(day.roster.start_time?.slice(0, 5) || '09:00');
      setEditEnd(day.roster.end_time?.slice(0, 5) || '18:00');
      setEditIsSplit(day.roster.is_split || false);
      setEditSplitStart(day.roster.split_start?.slice(0, 5) || '');
      setEditSplitEnd(day.roster.split_end?.slice(0, 5) || '');
      setEditIsOff(day.roster.is_off_day || false);
    } else {
      setEditStart('09:00');
      setEditEnd('18:00');
      setEditIsSplit(false);
      setEditSplitStart('');
      setEditSplitEnd('');
      setEditIsOff(false);
    }
    setEditDate(day.date);
    setShowEditor(true);
  }

  async function saveRosterEntry() {
    if (!editDate || !selectedStaff) return;
    try {
      await api.setDutyRoster(
        selectedStaff.id,
        editDate,
        editStart,
        editEnd,
        editIsSplit,
        editIsSplit ? editSplitStart : null,
        editIsSplit ? editSplitEnd : null,
        editIsOff
      );
      showToast(`Roster saved for ${editDate}`);
      setShowEditor(false);
      loadRoster();
    } catch (err) {
      showToast('Error: ' + err.message, true);
    }
  }

  const calendarDays = getCalendarDays();

  // ── Info Card (why roster is useful) ──
  const RosterInfo = () => (
    <div className="roster-info-card">
      <div className="roster-info-title">📅 About Duty Roster</div>
      <div className="roster-info-text">
        Set scheduled shifts for each staff member. The roster enables:
        <ul>
          <li><b>Split Shifts</b> — e.g., 9-1pm + 4-9pm</li>
          <li><b>Off Days</b> — mark days off in advance</li>
          <li><b>Missed Punch Detection</b> — see when staff didn't clock in</li>
          <li><b>Accurate OT</b> — calculated against scheduled hours</li>
        </ul>
      </div>
    </div>
  );

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
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          </div>
        </div>
      </div>

      {!selectedStaff && (
        <div className="card" style={{ textAlign: 'center', opacity: 0.5, padding: 'clamp(30px, 8vw, 50px)' }}>
          <p style={{ fontSize: '0.85rem' }}>Select a staff member to view/set their duty roster</p>
        </div>
      )}

      {selectedStaff && (
        <>
          {isManager && <RosterInfo />}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 'clamp(30px, 8vw, 50px)' }}>
              <div className="loader" style={{ width: 24, height: 24, borderWidth: 3, borderColor: 'var(--accent)', borderBottomColor: 'transparent' }} />
            </div>
          ) : (
            <div className="card" style={{ padding: 'clamp(10px, 1.5vw, 16px)' }}>
              <div className="section-title" style={{ marginBottom: 10 }}>
                {selectedStaff.name} — Schedule
              </div>
              <div className="roster-list">
                {calendarDays.length === 0 ? (
                  <div className="roster-empty">No days in this month</div>
                ) : (
                  calendarDays.map(day => (
                    <div
                      key={day.date}
                      onClick={() => isManager && openEditor(day)}
                      className={`roster-row ${day.roster?.is_off_day ? 'off' : day.roster ? 'set' : ''} ${day.isToday ? 'today' : ''}`}
                    >
                      <div className="roster-date">
                        {day.display}
                      </div>
                      <div className="roster-info">
                        {day.roster?.is_off_day ? (
                          <span className="roster-off-label">OFF DAY</span>
                        ) : day.roster ? (
                          <>
                            <span className="roster-time">{day.roster.start_time?.slice(0, 5)}–{day.roster.end_time?.slice(0, 5)}</span>
                            {day.roster.is_split && (
                              <span className="roster-split">
                                ⤵ {day.roster.split_start?.slice(0, 5)}–{day.roster.split_end?.slice(0, 5)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="roster-unset">Not set</span>
                        )}
                      </div>
                      {day.isToday && <span className="roster-today">TODAY</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Roster Editor Modal */}
      <div className={`modal-overlay ${showEditor ? 'show' : ''}`} onClick={() => setShowEditor(false)}>
        <div className="modal-body" onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0, color: 'var(--accent)', fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)' }}>
            Roster — {editDate}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.7rem' }}>
              <input
                type="checkbox"
                checked={editIsOff}
                onChange={e => setEditIsOff(e.target.checked)}
                style={{ width: 'auto', minHeight: 20, minWidth: 20 }}
              />
              OFF DAY
            </label>
          </div>

          {!editIsOff && (
            <>
              <div>
                <label>SHIFT START</label>
                <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} />
              </div>
              <div style={{ marginTop: 8 }}>
                <label>SHIFT END</label>
                <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
              </div>

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.7rem' }}>
                  <input
                    type="checkbox"
                    checked={editIsSplit}
                    onChange={e => setEditIsSplit(e.target.checked)}
                    style={{ width: 'auto', minHeight: 20, minWidth: 20 }}
                  />
                  SPLIT SHIFT
                </label>
              </div>

              {editIsSplit && (
                <div className="grid-2" style={{ marginTop: 8, gap: 8 }}>
                  <div>
                    <label>SPLIT START</label>
                    <input type="time" value={editSplitStart} onChange={e => setEditSplitStart(e.target.value)} />
                  </div>
                  <div>
                    <label>SPLIT END</label>
                    <input type="time" value={editSplitEnd} onChange={e => setEditSplitEnd(e.target.value)} />
                  </div>
                </div>
              )}

              {editIsSplit && (
                <div style={{
                  marginTop: 12,
                  background: 'rgba(167, 139, 250, 0.1)',
                  border: '1px solid rgba(167, 139, 250, 0.2)',
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 'clamp(0.6rem, 1.4vw, 0.7rem)',
                  color: '#a78bfa',
                }} className="roster-split-info">
                  💡 Split shift example: Staff works 9:00-13:00 and 16:00-21:00.
                  The system will calculate total hours across both segments.
                </div>
              )}
            </>
          )}

          <div className="grid-2" style={{ marginTop: 16, gap: 8 }}>
            <button className="btn-primary slate" style={{ padding: 12 }} onClick={() => setShowEditor(false)}>
              CANCEL
            </button>
            <button className="btn-primary green" style={{ padding: 12 }} onClick={saveRosterEntry}>
              SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
