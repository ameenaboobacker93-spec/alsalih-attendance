import { useState } from 'react';
import { supabase } from '../utils/supabase';

// ── PIN Helper (simple hash for PIN comparison) ──
// In production, use bcrypt. For simplicity, we use btoa as a basic hash.
function hashPin(pin) {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'hash_' + Math.abs(hash).toString(36);
}

export function useStaffApi(branchId) {
  const [loading, setLoading] = useState(false);

  // ── Staff CRUD ──
  async function getStaffList() {
    const { data, error } = await supabase
      .from('staff')
      .select('id, name, staff_code, duty_hours, shift_start, shift_end, is_active')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async function getStaffFullList() {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async function registerStaff(name, dutyHours, shiftStart, shiftEnd) {
    const { data, error } = await supabase
      .from('staff')
      .insert({
        branch_id: branchId,
        name: name.trim().toUpperCase(),
        duty_hours: parseFloat(dutyHours) || 9,
        shift_start: shiftStart || '09:00',
        shift_end: shiftEnd || '18:00',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('Staff already exists');
      throw error;
    }
    return data;
  }

  async function updateStaff(id, name, dutyHours, shiftStart, shiftEnd) {
    const { error } = await supabase
      .from('staff')
      .update({
        name: name.trim().toUpperCase(),
        duty_hours: parseFloat(dutyHours) || 9,
        shift_start: shiftStart,
        shift_end: shiftEnd,
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async function deleteStaff(id) {
    const { error } = await supabase
      .from('staff')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  // ── Attendance (upsert — checks for existing entry on same date) ──
  async function processAttendance(staffId, staffName, type, dateStr) {
    const now = new Date();
    const dateKey = dateStr;

    // Check if entry exists for this staff + date
    const { data: existing, error: queryErr } = await supabase
      .from('attendance_logs')
      .select('id, check_in, check_out, status')
      .eq('staff_id', staffId)
      .eq('date', dateKey)
      .order('created_at', { ascending: false })
      .limit(1);

    if (queryErr) throw queryErr;

    const hasExisting = existing && existing.length > 0;

    if (type === 'START SHIFT') {
      if (hasExisting) {
        // Lock first check-in — don't overwrite if already set
        if (existing[0].check_in) {
          throw new Error('Already checked in today');
        }
        const { error: updErr } = await supabase
          .from('attendance_logs')
          .update({ check_in: now, status: 'INCOMPLETE' })
          .eq('id', existing[0].id);
        if (updErr) throw updErr;
      } else {
        // Create new entry
        const { error: insErr } = await supabase
          .from('attendance_logs')
          .insert({
            staff_id: staffId,
            branch_id: branchId,
            date: dateKey,
            check_in: now,
            status: 'INCOMPLETE',
          });
        if (insErr) throw insErr;
      }
    } else {
      // END SHIFT
      if (hasExisting) {
        // Lock first check-out — don't overwrite if already set
        if (existing[0].check_out) {
          throw new Error('Already checked out today');
        }
        const { error: updErr } = await supabase
          .from('attendance_logs')
          .update({ check_out: now })
          .eq('id', existing[0].id);
        if (updErr) throw updErr;
      } else {
        // Create new entry with check-out only
        const { error: insErr } = await supabase
          .from('attendance_logs')
          .insert({
            staff_id: staffId,
            branch_id: branchId,
            date: dateKey,
            check_out: now,
            status: 'INCOMPLETE',
          });
        if (insErr) throw insErr;
      }
    }

    // Log audit
    await logAudit(staffName, 'ATTENDANCE', `${type} recorded for ${staffName}`);

    return type === 'START SHIFT' ? 'CHECK IN' : 'CHECK OUT';
  }

  // ── Delete Attendance Entry ──
  async function deleteAttendance(attendanceId, staffName) {
    const { error } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('id', attendanceId);

    if (error) throw error;
    await logAudit(staffName || 'Admin', 'DELETE ATTENDANCE', `Attendance entry ${attendanceId} deleted`);
    return true;
  }

  // ── Approve OT (creates ot_payments entry) ──
  async function approveOT(staffId, staffName, date, otHours, actualHours) {
    const monthLabel = new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const { error } = await supabase
      .from('ot_payments')
      .insert({
        staff_id: staffId,
        branch_id: branchId,
        month: monthLabel,
        ot_value: parseFloat(otHours) || 0,
        date,
        type: 'MANUAL_FIX',
        status: 'Verified',
      });

    if (error) throw error;
    await logAudit(staffName || 'Admin', 'OT APPROVED', `${staffName} — ${date} OT ${otHours}h approved (actual: ${actualHours}h)`);
    return true;
  }

  // ── Reject OT (marks as reviewed with 0 OT) ──
  async function rejectOT(staffId, staffName, date, actualHours) {
    const monthLabel = new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const { error } = await supabase
      .from('ot_payments')
      .insert({
        staff_id: staffId,
        branch_id: branchId,
        month: monthLabel,
        ot_value: 0,
        date,
        type: 'MANUAL_FIX',
        status: 'Rejected',
      });

    if (error) throw error;
    await logAudit(staffName || 'Admin', 'OT REJECTED', `${staffName} — ${date} OT rejected (actual: ${actualHours}h)`);
    return true;
  }

  // ── Dashboard ──
  async function getStaffDashboard(staffId, selectedMonth) {
    const [year, month] = selectedMonth.split('-').map(Number);

    // Get staff details
    const { data: staffData, error: staffErr } = await supabase
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .single();

    if (staffErr) throw staffErr;

    const dutyHrs = parseFloat(staffData.duty_hours) || 9;

    // Generate all dates in month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const startDateStr = startDate.toLocaleDateString('en-CA');
    const endDateStr = endDate.toLocaleDateString('en-CA');

    // Cutoff: don't show future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const loopEnd = today < endDate && today >= startDate ? today : endDate;
    const loopEndStr = loopEnd.toLocaleDateString('en-CA');

    // Get attendance logs for this staff/month
    const { data: logs, error: logsErr } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('staff_id', staffId)
      .gte('date', startDateStr)
      .lte('date', loopEndStr);

    if (logsErr) throw logsErr;

    // Get OT adjustments — query by date range (month label format mismatch fix)
    const { data: otAdjustments, error: otErr } = await supabase
      .from('ot_payments')
      .select('*')
      .eq('staff_id', staffId)
      .gte('date', startDateStr)
      .lte('date', loopEndStr);

    if (otErr) throw otErr;

    // Get roster
    const { data: roster, error: rosterErr } = await supabase
      .from('duty_roster')
      .select('*')
      .eq('staff_id', staffId)
      .gte('date', startDateStr)
      .lte('date', loopEndStr);

    if (rosterErr) throw rosterErr;

    // Get settlement
    const { data: settlements, error: settleErr } = await supabase
      .from('settlements')
      .select('*')
      .eq('staff_id', staffId)
      .eq('month', selectedMonth);

    if (settleErr) throw settleErr;

    // Map logs by date (date field from Supabase DATE type is already 'YYYY-MM-DD')
    const logMap = {};
    (logs || []).forEach(log => {
      logMap[log.date] = log;
    });

    // Map OT adjustments by date (date field from Supabase DATE type is already 'YYYY-MM-DD')
    const otMap = {};
    (otAdjustments || []).forEach(ot => {
      if (ot.date) {
        otMap[ot.date] = ot;
      }
    });

    // Map roster by date (date field from Supabase DATE type is already 'YYYY-MM-DD')
    const rosterMap = {};
    (roster || []).forEach(r => {
      rosterMap[r.date] = r;
    });

    // Build daily log array
    let calcOt = 0, offCount = 0;
    const dailyLogs = [];

    for (let d = new Date(startDate); d <= loopEnd; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toLocaleDateString('en-CA');
      const displayDate = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', weekday: 'short' });

      const log = logMap[dateKey];
      const otAdj = otMap[dateKey];
      const rosterEntry = rosterMap[dateKey];

      const checkIn = log?.check_in ? new Date(log.check_in) : null;
      const checkOut = log?.check_out ? new Date(log.check_out) : null;
      let otVal = 0;
      let status = '';
      let totalHours = '';

      // Off day: only when roster explicitly marks as off day AND no entries exist
      if (rosterEntry?.is_off_day && !checkIn && !checkOut) {
        status = 'OFF_DAY';
        offCount++;
      } else if (!checkIn && !checkOut) {
        status = 'MISSING';
      } else if (!checkIn || !checkOut) {
        status = 'INCOMPLETE';
      } else {
        const diff = (checkOut - checkIn) / (1000 * 60 * 60);
        const actualHours = diff < 0 ? diff + 24 : diff;

        if (otAdj && otAdj.ot_value != null) {
          otVal = parseFloat(otAdj.ot_value);
          // Check the status field for approved vs rejected
          if (otAdj.status === 'Rejected') {
            status = 'OT_REJECTED';
          } else if (otVal > 0) {
            status = 'OT_APPROVED';
            calcOt += otVal;
          } else {
            // Verified but ot_value is 0 — treat as normal/compensated
            status = actualHours < dutyHrs ? 'COMPENSATED' : 'NORMAL';
          }
        } else if (actualHours > dutyHrs) {
          // OT: when staff works more than their duty hours
          otVal = actualHours - dutyHrs;
          status = 'PENDING_APPROVAL';
        } else if (actualHours < dutyHrs) {
          // Reduced hours — show as compensated
          status = 'COMPENSATED';
        } else {
          // Exactly duty hours — normal
          status = 'NORMAL';
        }

        // Format total hours for display
        totalHours = actualHours.toFixed(2).replace(/\.?0+$/, '');
      }

      dailyLogs.push({
        id: log?.id || null,
        date: dateKey,
        displayDate,
        checkIn: checkIn ? checkIn.toISOString() : null,
        checkOut: checkOut ? checkOut.toISOString() : null,
        shift: (checkIn ? checkIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '---') +
               ' - ' +
               (checkOut ? checkOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '---'),
        totalHours,
        otValue: otVal.toFixed(2),
        status,
        hasRoster: !!rosterEntry,
        isSplit: rosterEntry?.is_split || false,
      });
    }

    // Settlement info
    const settlement = settlements?.[0] || null;

    return {
      logs: dailyLogs,
      summary: {
        totalOt: calcOt.toFixed(2),
        offDays: offCount,
        netOt: settlement ? parseFloat(settlement.net_ot).toFixed(2) : '---',
        status: settlement ? settlement.status : 'PENDING',
      },
    };
  }

  // ── Settlements ──
  async function saveSettlement(staffId, staffName, month, netOt, status) {
    const { error } = await supabase
      .from('settlements')
      .insert({
        staff_id: staffId,
        branch_id: branchId,
        month,
        net_ot: parseFloat(netOt) || 0,
        status,
      });

    if (error) throw error;
    await logAudit(staffName, 'SETTLEMENT', `${staffName} — ${month} (OT: ${netOt}, ${status})`);
    return true;
  }

  // ── Manager Fix Entry (updates attendance_logs directly) ──
  async function managerFixEntry(staffId, staffName, date, mIn, mOut) {
    const dateKey = date;

    // Build update object with only the fields that are provided
    const updates = {};
    if (mIn) {
      const [h, min] = mIn.split(':').map(Number);
      updates.check_in = new Date(dateKey + 'T' + mIn + ':00').toISOString();
    }
    if (mOut) {
      const [h, min] = mOut.split(':').map(Number);
      // If check-out time is before check-in time, it means the shift crosses midnight
      // e.g., check-in at 15:00 and check-out at 03:00 means checkout is on the next day
      if (mIn) {
        const [inH, inMin] = mIn.split(':').map(Number);
        const inTotal = inH * 60 + inMin;
        const outTotal = h * 60 + min;
        if (outTotal < inTotal) {
          // Check-out is on the next day
          const checkOutDate = new Date(dateKey + 'T' + mOut + ':00');
          checkOutDate.setDate(checkOutDate.getDate() + 1);
          updates.check_out = checkOutDate.toISOString();
        } else {
          updates.check_out = new Date(dateKey + 'T' + mOut + ':00').toISOString();
        }
      } else {
        updates.check_out = new Date(dateKey + 'T' + mOut + ':00').toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new Error('No changes provided');
    }
    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('staff_id', staffId)
      .eq('date', dateKey)
      .limit(1);

    const hasExisting = existing && existing.length > 0;

    if (hasExisting) {
      // Update the existing entry with only the provided fields
      const { error } = await supabase
        .from('attendance_logs')
        .update(updates)
        .eq('id', existing[0].id);
      if (error) throw error;
    } else {
      // Create a new entry with the provided fields
      const { error } = await supabase
        .from('attendance_logs')
        .insert({
          staff_id: staffId,
          branch_id: branchId,
          date: dateKey,
          status: 'INCOMPLETE',
          ...updates,
        });
      if (error) throw error;
    }

    await logAudit(staffName, 'ENTRY FIX', `${staffName} — ${date} fixed (${Object.keys(updates).join(', ')})`);
    return true;
  }

  // ── Duty Roster ──
  async function setDutyRoster(staffId, date, startTime, endTime, isSplit = false, splitStart = null, splitEnd = null, isOffDay = false) {
    const { data, error } = await supabase
      .from('duty_roster')
      .upsert({
        staff_id: staffId,
        date,
        start_time: startTime,
        end_time: endTime,
        is_split: isSplit,
        split_start: splitStart,
        split_end: splitEnd,
        is_off_day: isOffDay,
      }, { onConflict: 'staff_id,date' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function getDutyRoster(staffId, month) {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1).toLocaleDateString('en-CA');
    const endDate = new Date(year, monthNum, 0).toLocaleDateString('en-CA');

    const { data, error } = await supabase
      .from('duty_roster')
      .select('*')
      .eq('staff_id', staffId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    if (error) throw error;
    return data || [];
  }

  // ── On Duty Status ──
  async function getOnDutyStatus() {
    const today = new Date().toLocaleDateString('en-CA');

    const { data, error } = await supabase
      .from('attendance_logs')
      .select(`
        id, staff_id, check_in, check_out, status,
        staff:staff_id (name)
      `)
      .eq('branch_id', branchId)
      .eq('date', today)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Deduplicate by staff_id
    const seen = new Set();
    const unique = (data || []).filter(log => {
      if (seen.has(log.staff_id)) return false;
      seen.add(log.staff_id);
      return true;
    });

    return unique.map(log => ({
      id: log.id,
      staffId: log.staff_id,
      name: log.staff?.name || 'Unknown',
      status: log.check_in && !log.check_out ? 'ON DUTY' : log.check_out ? 'OFF' : 'NO LOGS',
      since: log.check_in
        ? new Date(log.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '---',
    }));
  }

  // ── Admin PIN ──
  async function verifyPin(pin) {
    const { data, error } = await supabase
      .from('branch_settings')
      .select('admin_pin_hash')
      .eq('branch_id', branchId)
      .single();

    if (error) throw error;
    return hashPin(pin) === data.admin_pin_hash;
  }

  async function changePin(currentPin, newPin) {
    const valid = await verifyPin(currentPin);
    if (!valid) throw new Error('Current PIN is incorrect');

    const { error } = await supabase
      .from('branch_settings')
      .update({ admin_pin_hash: hashPin(newPin) })
      .eq('branch_id', branchId);

    if (error) throw error;
    return true;
  }

  // ── Audit Log ──
  async function logAudit(adminName, action, detail) {
    try {
      await supabase.from('audit_logs').insert({
        branch_id: branchId,
        admin_name: adminName || 'System',
        action,
        detail: detail || '',
      });
    } catch (e) {
      // Silent fail
    }
  }

  async function getAuditLogs(limit = 50) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(log => ({
      time: new Date(log.created_at).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      action: log.action,
      detail: log.detail,
      staff: log.admin_name,
    }));
  }

  // ── Export ──
  async function exportStaffReport(staffId, staffName, month) {
    const data = await getStaffDashboard(staffId, month);
    let csv = 'Date,Shift,OT Hrs,Status\n';
    data.logs.forEach(l => {
      csv += `${l.displayDate},"${l.shift}",${l.otValue},${l.status}\n`;
    });
    csv += '\nSummary\n';
    csv += `Total OT Hrs,${data.summary.totalOt}\n`;

    csv += `Off Days,${data.summary.offDays}\n`;
    csv += `Net Payable OT,${data.summary.netOt}\n`;
    csv += `Status,${data.summary.status}\n`;
    return csv;
  }

  async function exportIndividualHistory(staffId, staffName) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('staff_id', staffId)
      .eq('branch_id', branchId)
      .order('date', { ascending: false })
      .limit(365);

    if (error) throw error;

    let csv = 'Date,Check In,Check Out,Hours,OT,Status\n';
    (data || []).forEach(log => {
      const d = log.date;
      const tIn = log.check_in ? new Date(log.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
      const tOut = log.check_out ? new Date(log.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
      csv += `${d},${tIn},${tOut},${log.total_hours || ''},${log.ot_value || ''},${log.status}\n`;
    });

    return csv;
  }

  async function exportAllStaffReport(month) {
    const staffList = await getStaffList();
    let csv = 'Staff,Date,Shift,OT Hrs,Status\n';

    // Process staff in parallel for speed
    const results = await Promise.allSettled(
      staffList.map(async (staff) => {
        const data = await getStaffDashboard(staff.id, month);
        let block = '';
        data.logs.forEach(l => {
          block += `"${staff.name}",${l.displayDate},"${l.shift}",${l.otValue},${l.status}\n`;
        });
        block += `"${staff.name} NET","OT: ${data.summary.totalOt} | Off: ${data.summary.offDays} | Payable: ${data.summary.netOt} (${data.summary.status})",,,\n\n`;
        return block;
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled') {
        csv += r.value;
      } else {
        csv += `"ERROR","${r.reason?.message || 'Unknown error'}",,,\n`;
      }
    });

    return csv;
  }

  return {
    loading,
    setLoading,
    getStaffList,
    getStaffFullList,
    registerStaff,
    updateStaff,
    deleteStaff,
    processAttendance,
    getStaffDashboard,
    saveSettlement,
    managerFixEntry,
    deleteAttendance,
    approveOT,
    rejectOT,
    setDutyRoster,
    getDutyRoster,
    getOnDutyStatus,
    verifyPin,
    changePin,
    getAuditLogs,
    logAudit,
    exportStaffReport,
    exportIndividualHistory,
    exportAllStaffReport,
  };
}
