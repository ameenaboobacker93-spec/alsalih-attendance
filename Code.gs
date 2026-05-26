/** * AL SALIH AJMAN - V13.0 (PRO)
 * Features: Auto-Sync, Staff Management (Edit/Delete), On-Duty Tracking, Server-Side Security
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Al Salih Ajman')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ── Admin Password (Config Sheet) ──

function getAdminPassword() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let cfg = ss.getSheetByName("Config");
  if (!cfg) {
    cfg = ss.insertSheet("Config");
    cfg.appendRow(["Key", "Value"]);
    cfg.appendRow(["admin_password", "1206"]);
    cfg.appendRow(["last_updated", new Date().toString()]);
    cfg.hideSheet();
    return "1206";
  }
  const data = cfg.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "admin_password") return data[i][1].toString();
  }
  return "1206";
}

function verifyPin(pin) {
  return pin === getAdminPassword();
}

function setAdminPassword(currentPin, newPin) {
  if (!verifyPin(currentPin)) return "ERROR: Current password is incorrect";
  if (!newPin || newPin.length < 4) return "ERROR: Password must be at least 4 characters";
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let cfg = ss.getSheetByName("Config");
  if (!cfg) {
    cfg = ss.insertSheet("Config");
    cfg.appendRow(["Key", "Value"]);
    cfg.hideSheet();
  }
  const data = cfg.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "admin_password") {
      cfg.getRange(i + 1, 2).setValue(newPin);
      found = true;
      break;
    }
  }
  if (!found) cfg.appendRow(["admin_password", newPin]);
  
  // Update timestamp
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "last_updated") {
      cfg.getRange(i + 1, 2).setValue(new Date().toString());
      logAuditAction("PASSWORD CHANGED", "Admin password updated", "");
      return "SUCCESS: Password updated";
    }
  }
  cfg.appendRow(["last_updated", new Date().toString()]);
  logAuditAction("PASSWORD CHANGED", "Admin password updated (new row)", "");
  return "SUCCESS: Password updated";
}

// ── Audit Log ──

function initAuditSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Audit Log");
  if (!sheet) {
    sheet = ss.insertSheet("Audit Log");
    sheet.appendRow(["Timestamp", "Action", "Detail", "Staff"]);
    sheet.hideSheet();
  }
  return sheet;
}

function logAuditAction(action, detail, staff) {
  try {
    const sheet = initAuditSheet();
    sheet.appendRow([new Date(), action, detail, staff || ""]);
  } catch (e) {
    // Silently fail - audit should never block the main action
  }
}

function getAuditLogs(limit) {
  limit = limit || 50;
  const sheet = initAuditSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  // Return most recent first
  const rows = data.slice(1).reverse();
  return rows.slice(0, limit).map(r => ({
    time: Utilities.formatDate(new Date(r[0]), "GMT+4", "dd MMM hh:mm a"),
    action: String(r[1] || ""),
    detail: String(r[2] || ""),
    staff: String(r[3] || "")
  }));
}

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const required = ["Staff", "Form Responses 1", "OT_Payments", "Settlements"];
  required.forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    // Check if header exists
    if (sheet.getLastRow() === 0) {
      if (name === "Staff") sheet.appendRow(["Name", "Duty Hours", "Shift Start", "Shift End"]);
      if (name === "Form Responses 1") sheet.appendRow(["Timestamp", "Date", "Name", "Type"]);
      if (name === "OT_Payments") sheet.appendRow(["Name", "Month", "OT", "Amount", "Date", "Type", "Status", "In", "Out"]);
      if (name === "Settlements") sheet.appendRow(["Name", "Month", "Net OT", "Status", "Timestamp"]);
    }
  });
}

function getStaffList() {
  initSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Staff");
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => row[0]);
}

function getStaffFullList() {
  initSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Staff");
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1); // Returns array of [Name, DutyHrs, Start, End]
}

function registerStaff(name, dutyHrs, shiftStart, shiftEnd) {
  try {
    initSheets();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Staff");
    const staffName = name.trim().toUpperCase();
    const data = sheet.getDataRange().getValues();
    
    const exists = data.some(row => row[0].toString().toUpperCase() === staffName);
    if (exists) return "ERROR: Staff already exists";
    
    sheet.appendRow([staffName, dutyHrs, shiftStart, shiftEnd]);
    if (!ss.getSheetByName(staffName)) {
      const sSheet = ss.insertSheet(staffName);
      sSheet.appendRow(["DATE", "IN", "OUT", "HOURS", "OT", "STATUS"]);
    }
    logAuditAction("STAFF REGISTERED", staffName + " (" + dutyHrs + "h, " + shiftStart + "-" + shiftEnd + ")", staffName);
    return "SUCCESS: Staff registered";
  } catch (e) {
    return "ERROR: " + e.toString();
  }
}

function updateStaff(oldName, name, dutyHrs, shiftStart, shiftEnd) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Staff");
  const data = sheet.getDataRange().getValues();
  const newName = name.trim().toUpperCase();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === oldName) {
      sheet.getRange(i + 1, 1, 1, 4).setValues([[newName, dutyHrs, shiftStart, shiftEnd]]);
      if (oldName !== newName) {
        const oldSheet = ss.getSheetByName(oldName);
        if (oldSheet) oldSheet.setName(newName);
      }
      logAuditAction("STAFF UPDATED", oldName + " → " + newName + " (" + dutyHrs + "h)", newName);
      return "SUCCESS: Staff updated";
    }
  }
  return "ERROR: Staff not found";
}

function deleteStaff(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Staff");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === name) {
      sheet.deleteRow(i + 1);
      // We don't delete the individual sheet to preserve history, just rename it
      const sSheet = ss.getSheetByName(name);
      if (sSheet) sSheet.setName("DELETED_" + name + "_" + new Date().getTime());
      logAuditAction("STAFF DELETED", name + " (sheet archived)", name);
      return "SUCCESS: Staff deleted";
    }
  }
  return "ERROR: Staff not found";
}

function getOnDutyStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const staff = getStaffList();
  const logSheet = ss.getSheetByName("Form Responses 1");
  if (!logSheet) return [];
  
  const logs = logSheet.getDataRange().getValues();
  const statusMap = {};
  
  // Get latest entry for each staff
  for (let i = logs.length - 1; i >= 1; i--) {
    const sName = logs[i][2];
    if (!statusMap[sName]) {
      statusMap[sName] = {
        type: logs[i][3],
        time: Utilities.formatDate(new Date(logs[i][0]), "GMT+4", "hh:mm a")
      };
    }
  }
  
  return staff.map(name => ({
    name: name,
    status: statusMap[name] ? (statusMap[name].type === "CHECK IN" ? "ON DUTY" : "OFF") : "NO LOGS",
    since: statusMap[name] ? statusMap[name].time : "---"
  }));
}

function processAttendance(name, type, manualDate) {
  initSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const staffName = name.trim().toUpperCase();
  const now = new Date();
  // Build date in local timezone (Asia/Dubai) so it stores as midnight local time,
  // avoiding the UTC midnight -> 4AM GMT+4 display issue in sheets
  const [yr, mo, dy] = manualDate.split('-').map(Number);
  const mDate = new Date(yr, mo - 1, dy);
  
  // 1. Record raw log
  const logSheet = ss.getSheetByName("Form Responses 1");
  const punchType = (type === "START SHIFT" ? "CHECK IN" : "CHECK OUT");
  logSheet.appendRow([now, mDate, staffName, punchType]);
  
  // 2. Auto-Sync to Staff Individual Sheet
  let sSheet = ss.getSheetByName(staffName);
  if (!sSheet) {
    sSheet = ss.insertSheet(staffName);
    sSheet.appendRow(["DATE", "IN", "OUT", "HOURS", "OT", "STATUS"]);
  }
  
  const sData = sSheet.getDataRange().getValues();
  const dateStr = Utilities.formatDate(mDate, "GMT+4", "yyyy-MM-dd");
  let rowIndex = -1;
  
  for (let i = 1; i < sData.length; i++) {
    if (sData[i][0] instanceof Date) {
      if (Utilities.formatDate(sData[i][0], "GMT+4", "yyyy-MM-dd") === dateStr) {
        rowIndex = i + 1;
        break;
      }
    }
  }
  
  const punchTime = now;
  if (type === "START SHIFT") {
    if (rowIndex === -1) {
      sSheet.appendRow([mDate, punchTime, "", "", "", "INCOMPLETE"]);
    } else {
      sSheet.getRange(rowIndex, 2).setValue(punchTime);
      sSheet.getRange(rowIndex, 6).setValue("INCOMPLETE");
    }
  } else {
    if (rowIndex === -1) {
      sSheet.appendRow([mDate, "", punchTime, "", "", "INCOMPLETE"]);
    } else {
      sSheet.getRange(rowIndex, 3).setValue(punchTime);
    }
  }
  
  return "SUCCESS: " + punchType;
}

function getDutyHours(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const staffSheet = ss.getSheetByName("Staff");
  if (!staffSheet) return 9;
  const data = staffSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === name) return parseFloat(data[i][1]) || 9;
  }
  return 9;
}

function getStaffDashboardData(name, selectedMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const staffSheet = ss.getSheetByName(name);
  const otSheet = ss.getSheetByName("OT_Payments") || ss.insertSheet("OT_Payments");
  const settleSheet = ss.getSheetByName("Settlements") || ss.insertSheet("Settlements");
  
  const [year, month] = selectedMonth.split('-').map(Number);
  const dutyHrs = getDutyHours(name);

  // 1. Generate Calendar Boundaries
  let startDay = (year === 2026 && month === 2) ? 3 : 1;
  let startDate = new Date(year, month - 1, startDay);
  let endDate = new Date(year, month, 0);
  let today = new Date();
  today.setHours(0,0,0,0);

  // 2. Load Data for Mapping
  const rawData = staffSheet ? staffSheet.getDataRange().getValues() : [];
  const approvedData = otSheet.getDataRange().getValues();
  const settleData = settleSheet.getDataRange().getValues();

  // 3. Map Settlements
  let summary = { netOt: "---", status: "PENDING", totalOt: 0, totalComp: 0, offDays: 0 };
  for (let i = settleData.length - 1; i >= 0; i--) {
    let rowMonth = (settleData[i][1] instanceof Date) ? Utilities.formatDate(settleData[i][1], "GMT+4", "yyyy-MM") : String(settleData[i][1]);
    if (String(settleData[i][0]).trim() === name && rowMonth === selectedMonth) {
      summary.netOt = parseFloat(settleData[i][2] || 0).toFixed(2);
      summary.status = String(settleData[i][3]).toUpperCase();
      break; 
    }
  }

  // 4. Map Manual Adjustments
  const manualMap = new Map();
  approvedData.forEach(row => {
    if (row[0] === name) {
      const dKey = Utilities.formatDate(new Date(row[4]), "GMT+4", "yyyy-MM-dd");
      manualMap.set(dKey, { ot: row[2], in: row[7], out: row[8] });
    }
  });

  // 5. Map Existing Sheet Logs
  const sheetLogs = new Map();
  for (let i = 1; i < rawData.length; i++) {
    if (rawData[i][0] instanceof Date) {
      const dKey = Utilities.formatDate(rawData[i][0], "GMT+4", "yyyy-MM-dd");
      sheetLogs.set(dKey, { in: rawData[i][1], out: rawData[i][2], status: rawData[i][5] });
    }
  }

  // 6. Loop Calendar & Fill Gaps (ASCENDING)
  let logs = [];
  let calcOt = 0, calcComp = 0, offCount = 0;
  let loopEnd = (today < endDate && today >= startDate) ? today : endDate;

  for (let d = new Date(startDate); d <= loopEnd; d.setDate(d.getDate() + 1)) {
    let dateKey = Utilities.formatDate(d, "GMT+4", "yyyy-MM-dd");
    let displayDate = Utilities.formatDate(d, "GMT+4", "dd MMM (E)");
    
    let log = sheetLogs.get(dateKey);
    let manual = manualMap.get(dateKey);
    
    let timeIn = (manual && manual.in) ? new Date(manual.in) : (log && log.in instanceof Date ? log.in : null);
    let timeOut = (manual && manual.out) ? new Date(manual.out) : (log && log.out instanceof Date ? log.out : null);
    
    let otVal = 0, status = "";

    if (!timeIn && !timeOut) {
      status = "OFF DAY";
      offCount++;
    } else if (!timeIn || !timeOut) {
      status = "INCOMPLETE";
    } else {
      let diff = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;
      
      if (manual && manual.ot !== "" && manual.ot !== null) {
        otVal = parseFloat(manual.ot);
        status = (otVal > 0) ? "OT APPROVED" : "NORMAL";
        if(otVal > 0) calcOt += otVal;
      } else if (diff >= (dutyHrs + 0.5)) {
        status = "PENDING FOR APPROVAL";
      } else if (diff < dutyHrs) {
        otVal = diff - dutyHrs;
        status = "COMPENSATED";
        calcComp += Math.abs(otVal);
      } else {
        status = "NORMAL";
      }
    }

    logs.push({ 
      date: dateKey, 
      displayDate: displayDate, 
      shift: (timeIn ? Utilities.formatDate(timeIn, "GMT+4", "hh:mm a") : "---") + " - " + (timeOut ? Utilities.formatDate(timeOut, "GMT+4", "hh:mm a") : "---"), 
      otValue: otVal.toFixed(2), 
      status: status, 
      isManaged: !!manual 
    });
  }

  summary.totalOt = calcOt.toFixed(2);
  summary.totalComp = calcComp.toFixed(2);
  summary.offDays = offCount;
  
  // FIXED: Removed .reverse() to maintain Ascending Order
  return { logs: logs, summary: summary }; 
}

function saveFinalSettlement(name, month, netOt, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Settlements") || ss.insertSheet("Settlements");
  sheet.appendRow([String(name).trim(), String(month).trim(), netOt, status, new Date()]);
  logAuditAction("SETTLEMENT", name + " — " + month + " (OT: " + netOt + ", " + status + ")", name);
  return "PORTAL UPDATED ✓";
}

// ── Export Reports ──

function exportReportCSV(name, selectedMonth) {
  try {
    const data = getStaffDashboardData(name, selectedMonth);
    if (!data || !data.logs || data.logs.length === 0) return "ERROR: No data for " + name;
    
    let csv = "Date,Shift,OT Hrs,Status\n";
    data.logs.forEach(l => {
      const datePart = l.displayDate.replace(/,/g, "");
      const shiftPart = '"' + l.shift.replace(/"/g, '""') + '"';
      csv += datePart + "," + shiftPart + "," + l.otValue + "," + l.status + "\n";
    });
    // Append summary
    csv += "\n,,,,,\n";
    csv += "Summary,,,\n";
    csv += "Total OT Hrs," + data.summary.totalOt + ",,\n";
    csv += "Compensated Hrs," + data.summary.totalComp + ",,\n";
    csv += "Off Days," + data.summary.offDays + ",,\n";
    csv += "Net Payable OT," + data.summary.netOt + ",,\n";
    csv += "Status," + data.summary.status + ",,\n";
    
    logAuditAction("EXPORT CSV", name + " — " + selectedMonth, name);
    return csv;
  } catch (e) {
    return "ERROR: " + e.toString();
  }
}

function exportAllStaffReportCSV(selectedMonth) {
  try {
    const staffList = getStaffList();
    if (!staffList || staffList.length === 0) return "ERROR: No staff";
    
    let csv = "Staff,Date,Shift,OT Hrs,Status\n";
    
    staffList.forEach(name => {
      try {
        const data = getStaffDashboardData(name, selectedMonth);
        if (data && data.logs) {
          data.logs.forEach(l => {
            const datePart = l.displayDate.replace(/,/g, "");
            const shiftPart = '"' + l.shift.replace(/"/g, '""') + '"';
            csv += '"' + name + '",' + datePart + "," + shiftPart + "," + l.otValue + "," + l.status + "\n";
          });
          // Per-staff summary line
          csv += '"' + name + ' NET","OT: ' + data.summary.totalOt + ' | Comp: ' + data.summary.totalComp + ' | Off: ' + data.summary.offDays + ' | Payable: ' + data.summary.netOt + ' (' + data.summary.status + ')",,,\n';
          csv += "\n";
        }
      } catch (e) {
        csv += '"' + name + '","ERROR: ' + e.toString().replace(/"/g, '""') + '",,,\n';
      }
    });
    
    logAuditAction("EXPORT ALL CSV", "All staff — " + selectedMonth, "");
    return csv;
  } catch (e) {
    return "ERROR: " + e.toString();
  }
}

function exportIndividualCSV(name) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const staffSheet = ss.getSheetByName(name);
    if (!staffSheet) return "ERROR: No sheet for " + name;
    
    const data = staffSheet.getDataRange().getValues();
    if (data.length <= 1) return "ERROR: No data for " + name;
    
    let csv = "Date,IN,OUT,Hours,OT,Status\n";
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const d = row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT+4", "yyyy-MM-dd") : String(row[0]);
      const tIn = row[1] instanceof Date ? Utilities.formatDate(row[1], "GMT+4", "HH:mm") : "";
      const tOut = row[2] instanceof Date ? Utilities.formatDate(row[2], "GMT+4", "HH:mm") : "";
      csv += d + "," + tIn + "," + tOut + "," + String(row[3]||"") + "," + String(row[4]||"") + "," + String(row[5]||"") + "\n";
    }
    
    logAuditAction("EXPORT FULL CSV", name + " — full history", name);
    return csv;
  } catch (e) {
    return "ERROR: " + e.toString();
  }
}

function managerFixEntry(name, date, mIn, mOut, mOT) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const otSheet = ss.getSheetByName("OT_Payments");
  const monthLabel = Utilities.formatDate(new Date(date), "GMT+4", "MMMM yyyy");
  // Build date safely using explicit components (avoids ambiguous string parsing)
  let fIn = "";
  let fOut = "";
  if (mIn) {
    const [y, M, d] = date.split('-').map(Number);
    const [h, min] = mIn.split(':').map(Number);
    fIn = new Date(y, M - 1, d, h, min);
  }
  if (mOut) {
    const [y, M, d] = date.split('-').map(Number);
    const [h, min] = mOut.split(':').map(Number);
    fOut = new Date(y, M - 1, d, h, min);
  }
  otSheet.appendRow([name, monthLabel, mOT, 0, date, "MANUAL_FIX", "Verified", fIn, fOut]);
  logAuditAction("ENTRY FIX", name + " — " + date + " (IN: " + (mIn||"-") + ", OUT: " + (mOut||"-") + ", OT: " + (mOT||"0") + ")", name);
  return "ENTRY FIXED";
}