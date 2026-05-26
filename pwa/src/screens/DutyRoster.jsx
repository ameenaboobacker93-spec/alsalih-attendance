import React, { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { getCurrentMonth } from '../utils/helpers';

export default function DutyRoster({ branch, staffList, api, isManager }) {
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
  }, [selectedStaff?.id, selectedMonth]);

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
    <div className="card-accent" style={{ marginBottom: 16, padding: 'clamp(12px, 2.5vw, 16px)' }}>
      <div style={{ fontSize: 'clamp(0.6rem, 1.5vw, 0.7rem)', color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        📅 About Duty Roster
      </div>
      <div style={{ fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)', opacity: 0.8, lineHeight: 1.6 }}>
        Set scheduled shifts for each staff member. The roster enables:
        <ul style={{ marginTop: 6, paddingLeft: 16, opacity: 0.7 }}>
          <li><b>Split Shifts</b> — e.g., 9-1pm + 4-9pm (useful for split duty)</li>
          <li><b>Scheduled Off Days</b> — mark days off in advance</li>
          <li><b>Missed Punch Detection</b> — see when staff didn't clock in on a scheduled day</li>
          <li><b>Accurate OT</b> — OT calculated against scheduled hours, not duty hours</li>
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
              <div className="loader" style={{ width: 24, height: 24, borderWidth: 3, borderColor: '#06b6d4', borderBottomColor: 'transparent' }} />
            </div>
          ) : (
            <div className="card" style={{ padding: 'clamp(12px, 2vw, 16px)' }}>
              <div className="section-title" style={{ marginBottom: 12, fontSize: 'clamp(0.55rem, 1.5vw, 0.65rem)' }}>
                {selectedStaff.name} — Schedule
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {calendarDays.length === 0 ? (
                  <div style={{ opacity: 0.5, textAlign: 'center', padding: 20, fontSize: '0.75rem' }}>
                    No days in this month
                  </div>
                ) : (
                  calendarDays.map(day => (
                    <div
                      key={day.date}
                      onClick={() => isManager && openEditor(day)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'clamp(8px, 2vw, 12px)',
                        padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px)',
                        borderRadius: 10,
                        background: day.roster?.is_off_day
                          ? 'rgba(239,68,68,0.08)'
                          : day.roster
                            ? 'rgba(6,182,212,0.06)'
                            : 'rgba(255,255,255,0.02)',
                        border: day.isToday ? '1px solid var(--accent)' : '1px solid transparent',
                        cursor: isManager ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                        minHeight: 'var(--touch-min)',
                        flexWrap: 'wrap',
                      }}
                      onMouseEnter={e => {
                        if (isManager) e.currentTarget.style.borderColor = 'var(--accent)';
                      }}
                      onMouseLeave={e => {
                        if (!day.isToday) e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <div style={{
                        fontWeight: 600,
                        fontSize: 'clamp(0.65rem, 1.5vw, 0.75rem)',
                        minWidth: 0,
                        flex: '0 1 auto',
                      }}>
                        {day.display}
                      </div>
                      <div style={{
                        fontSize: 'clamp(0.6rem, 1.4vw, 0.7rem)',
                        opacity: 0.8,
                        flex: '1 1 auto',
                        textAlign: 'right',
                      }}>
                        {day.roster?.is_off_day ? (
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>OFF DAY</span>
                        ) : day.roster ? (
                          <>
                            <span>{day.roster.start_time?.slice(0, 5)} – {day.roster.end_time?.slice(0, 5)}</span>
                            {day.roster.is_split && (
                              <span style={{ color: '#a78bfa', marginLeft: 6, fontSize: 'clamp(0.5rem, 1.2vw, 0.6rem)' }}>
                                ⤵ {day.roster.split_start?.slice(0, 5)}–{day.roster.split_end?.slice(0, 5)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ opacity: 0.4 }}>Not set</span>
                        )}
                      </div>
                      {day.isToday && <span style={{
                        fontSize: 'clamp(0.45rem, 1vw, 0.5rem)',
                        color: '#06b6d4',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}>TODAY</span>}
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
          <h3 style={{ marginTop: 0, color: '#06b6d4', fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)' }}>
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
                }}>
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
