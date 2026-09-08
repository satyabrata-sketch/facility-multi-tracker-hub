import ExcelJS from 'exceljs/dist/exceljs.min.js';
import * as XLSX from 'xlsx';
import {
  COLUMNS_SCHEMA,
  detectTicketYear,
  isInvalidPivotOrSummaryRow,
  sanitizeSiteValue,
  VALID_REQUEST_CATEGORIES,
  VALID_FACILITY_SITES,
  getTicketUniqueKey,
  deduplicateTickets,
  compareMonthsChronologically,
  normalizeTicketFields,
} from './schema';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Converts any date or raw month to Short Month format (e.g. "Jan-26", "Sep-25")
 */
export function formatShortMonth(raw, fallbackYear = '26') {
  if (!raw) return '';
  if (typeof raw === 'number') {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      const m = MONTH_NAMES[parsed.m - 1] || 'Jan';
      const y = String(parsed.y).slice(-2);
      return `${m}-${y}`;
    }
  }
  if (raw instanceof Date) {
    const m = MONTH_NAMES[raw.getMonth()] || 'Jan';
    const y = String(raw.getFullYear()).slice(-2);
    return `${m}-${y}`;
  }
  const str = String(raw).trim();
  // If string matches YYYY-MM-DD
  const match = str.match(/^(\d{4})-(\d{2})/);
  if (match) {
    const monthNum = parseInt(match[2], 10);
    const m = MONTH_NAMES[monthNum - 1] || 'Jan';
    const y = match[1].slice(-2);
    return `${m}-${y}`;
  }
  // Check if already short month format e.g. "Jan-26"
  if (/^[A-Za-z]{3}-\d{2}$/.test(str)) {
    return str;
  }
  return str;
}

/**
 * Converts Excel serial date or date string to YYYY-MM-DD without timezone shifts
 */
export function formatExcelDate(raw, fallbackYear = '2026') {
  if (!raw) return '';
  if (typeof raw === 'number') {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(raw).trim();
  if (!str) return '';

  // Already YYYY-MM-DD
  const mIso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mIso) {
    return `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
  }

  // M/D/YY or M/D/YYYY (e.g. "1/2/26", "4/30/26", "9/29/25")
  const mSlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (mSlash) {
    let y = parseInt(mSlash[3], 10);
    if (y < 100) y += 2000;
    const m = String(mSlash[1]).padStart(2, '0');
    const d = String(mSlash[2]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // D-MMM or D-MMM-YY (e.g. "2-Jan", "30-Apr", "29-Sep-25")
  const mDMMM = str.match(/^(\d{1,2})-([A-Za-z]{3})(?:-(\d{2,4}))?$/);
  if (mDMMM) {
    const d = String(mDMMM[1]).padStart(2, '0');
    const mIdx = MONTH_NAMES.findIndex(
      (name) => name.toLowerCase() === mDMMM[2].toLowerCase()
    );
    if (mIdx !== -1) {
      const m = String(mIdx + 1).padStart(2, '0');
      let y = mDMMM[3] ? parseInt(mDMMM[3], 10) : parseInt(fallbackYear, 10);
      if (y < 100) y += 2000;
      return `${y}-${m}-${d}`;
    }
  }

  // DD/MM/YYYY
  const mDot = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (mDot) {
    const d = String(mDot[1]).padStart(2, '0');
    const m = String(mDot[2]).padStart(2, '0');
    const y = mDot[3];
    return `${y}-${m}-${d}`;
  }

  return str;
}

/**
 * Normalizes TAT to "Yes" or "No"
 */
export function formatTatValue(raw) {
  if (raw === undefined || raw === null || raw === '') return 'Yes';
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'yes' || v === 'y' || v === 'true') return 'Yes';
  if (v === '0' || v === 'no' || v === 'n' || v === 'false' || v === 'breached') return 'No';
  return 'Yes';
}

/**
 * Converts Excel serial time fraction or string time to clean 12-hour AM/PM format (e.g. "08:24 AM")
 */
export function formatExcelTime(raw) {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw === 'number') {
    const totalSecs = Math.round(raw * 86400);
    const hrs24 = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const ampm = hrs24 >= 12 ? 'PM' : 'AM';
    const hrs12 = hrs24 % 12 || 12;
    return `${String(hrs12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
  }
  const str = String(raw).trim();
  if (!str) return '';

  // Matches "8:48AM", "08:24 AM", "1:42PM", "13:36"
  const mAmPm = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (mAmPm) {
    let h = parseInt(mAmPm[1], 10);
    const m = mAmPm[2];
    const ap = mAmPm[3] ? mAmPm[3].toUpperCase() : (h >= 12 ? 'PM' : 'AM');
    if (!mAmPm[3] && h > 12) {
      h = h - 12;
    }
    return `${String(h).padStart(2, '0')}:${m} ${ap}`;
  }
  return str;
}

/**
 * Robustly extracts field value from ticket regardless of casing or space differences
 */
export function getTicketFieldValue(ticket, key) {
  if (!ticket) return '';
  if (ticket[key] !== undefined && ticket[key] !== null && String(ticket[key]).trim() !== '') {
    return ticket[key];
  }
  if (key === 'Action Taken ') {
    return (
      ticket['Action Taken '] ||
      ticket['Action taken '] ||
      ticket['Action Taken'] ||
      ticket['Action taken'] ||
      ticket['action_taken'] ||
      ticket['Action'] ||
      ticket['action'] ||
      ''
    );
  }
  if (key === 'Discription ') {
    return (
      ticket['Discription '] ||
      ticket['Description '] ||
      ticket['Discription'] ||
      ticket['Description'] ||
      ticket['description'] ||
      ticket['Details'] ||
      ''
    );
  }
  if (key === 'Date close ') {
    return (
      ticket['Date close '] ||
      ticket['Date Close '] ||
      ticket['Date close'] ||
      ticket['Date Close'] ||
      ticket['date_close'] ||
      ticket['Close Date'] ||
      ''
    );
  }
  if (key === 'Resolved time') {
    return (
      ticket['Resolved time'] ||
      ticket['Resolved time '] ||
      ticket['Resolved Time'] ||
      ticket['Resolved Time '] ||
      ticket['resolved_time'] ||
      ticket['Close Time'] ||
      ticket['close_time'] ||
      ''
    );
  }
  if (key === 'Report Time') {
    return (
      ticket['Report Time'] ||
      ticket['Report time'] ||
      ticket['Report Time '] ||
      ticket['Report time '] ||
      ticket['report_time'] ||
      ticket['Call In time'] ||
      ticket['Call in time'] ||
      ''
    );
  }
  if (key === 'Employee Name ') {
    return (
      ticket['Employee Name '] ||
      ticket['Employee Name'] ||
      ticket['Employee name '] ||
      ticket['Employee name'] ||
      ticket['employee_name'] ||
      ticket['Requestor'] ||
      ''
    );
  }
  if (key === 'Request Via ') {
    return (
      ticket['Request Via '] ||
      ticket['Request Via'] ||
      ticket['Request via '] ||
      ticket['Request via'] ||
      ticket['request_via'] ||
      ''
    );
  }
  if (key === 'is On TAT') {
    return (
      ticket['is On TAT'] ||
      ticket['is on tat'] ||
      ticket['is on TAT'] ||
      ticket['Is On TAT'] ||
      ticket['on_tat'] ||
      'Yes'
    );
  }

  // Fallback case-insensitive search
  const cleanTarget = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const k of Object.keys(ticket)) {
    if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) {
      if (ticket[k] !== undefined && ticket[k] !== null && String(ticket[k]).trim() !== '') {
        return ticket[k];
      }
    }
  }
  return ticket[key] !== undefined && ticket[key] !== null ? ticket[key] : '';
}

const COLUMN_WIDTHS = {
  'Sr no.': 10,
  'Site ': 12,
  'Zone': 12,
  'Location': 18,
  'Month ': 12,
  'Date ': 14,
  'Report Time': 13,
  'Request category': 20,
  'Employee Name ': 22,
  'Request Via ': 15,
  'Discription ': 38,
  'Action Taken ': 38,
  'Date close ': 14,
  'Resolved time': 14,
  'Status ': 15,
  'Request from ': 22,
  'Call type': 14,
  'Remark': 20,
  'is On TAT': 12,
  'Priority': 12,
};

/**
 * Build a styled worksheet inside an ExcelJS Workbook
 */
function buildWorksheet(workbook, sheetTitle, ticketsList) {
  const ws = workbook.addWorksheet(sheetTitle, {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1, activePane: 'bottomRight' }]
  });

  // Columns definition
  ws.columns = COLUMNS_SCHEMA.map((col) => ({
    header: col.key,
    key: col.key,
    width: COLUMN_WIDTHS[col.key] || 16,
  }));

  // Style Header Row
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.border = {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF334155' } },
    right: { style: 'thin', color: { argb: 'FF334155' } },
  };

  // 1. PURGE any pivot / summary calculation noise rows (Grand Total, Row Labels, etc.)
  const cleanTickets = ticketsList.filter((t) => !isInvalidPivotOrSummaryRow(t));

  // 2. SORT ASCENDING: Sr no 1 must show from the beginning!
  const sortedTickets = [...cleanTickets].sort((a, b) => {
    const srA = parseInt(a['Sr no.'], 10) || 0;
    const srB = parseInt(b['Sr no.'], 10) || 0;
    if (srA !== srB) {
      if (!srA) return 1;
      if (!srB) return -1;
      return srA - srB;
    }
    return 0;
  });

  // Add Data Rows
  sortedTickets.forEach((t, idx) => {
    const rowValues = {};

    // Sanitize Site: guarantee Site is strictly one of the valid 5 facility locations
    let rawSite = String(t['Site '] || t['Site'] || '').trim();
    let rawCategory = String(t['Request category'] || '').trim();

    if (VALID_REQUEST_CATEGORIES.includes(rawSite)) {
      if (!rawCategory) {
        rawCategory = rawSite;
      }
      rawSite = 'DT3';
    } else {
      rawSite = sanitizeSiteValue(rawSite);
    }

    COLUMNS_SCHEMA.forEach((c) => {
      let val = getTicketFieldValue(t, c.key);

      if (c.key === 'Sr no.') {
        // Numeric Sr no. starting from 1 in order
        const numSr = parseInt(val, 10);
        val = isNaN(numSr) ? (idx + 1) : numSr;
      } else if (c.key === 'Site ') {
        val = rawSite;
      } else if (c.key === 'Request category') {
        val = rawCategory || val || 'Housekeeping';
      } else if (c.key === 'Month ') {
        val = formatShortMonth(val, sheetTitle.includes('2025') ? '25' : '26');
      } else if (c.key === 'Date ' || c.key === 'Date close ') {
        val = formatExcelDate(val, sheetTitle.includes('2025') ? '2025' : '2026');
      } else if (c.key === 'Report Time' || c.key === 'Resolved time') {
        val = formatExcelTime(val);
      } else if (c.key === 'is On TAT') {
        val = formatTatValue(val);
      }
      rowValues[c.key] = val !== undefined && val !== null ? val : '';
    });

    const row = ws.addRow(rowValues);
    row.height = 20;

    const isEven = idx % 2 === 0;
    const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colKey = COLUMNS_SCHEMA[colNumber - 1]?.key;
      let cellFont = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
      let cellFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };

      if (colKey === 'Status ') {
        const s = String(cell.value || '').toLowerCase().trim();
        if (s === 'resolved' || s === 'closed') {
          cellFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
          cellFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF065F46' } };
        } else if (s === 'not resolved') {
          cellFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
          cellFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } };
        } else if (s === 'in-progress') {
          cellFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
          cellFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
        } else if (s === 'open') {
          cellFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
          cellFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB45309' } };
        }
      } else if (colKey === 'is On TAT') {
        const tat = String(cell.value || '').trim();
        if (tat === 'No') {
          cellFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
          cellFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } };
        }
      }

      cell.font = cellFont;
      cell.fill = cellFill;
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber <= 2 ? 'center' : 'left',
        wrapText: colKey === 'Discription ' || colKey === 'Action Taken ',
      };

      // Native Excel in-cell dropdowns!
      if (colKey === 'Site ') {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"DT3,DT4 L1,DT4 L4,DT4 L5,DT4 L6"'],
        };
      } else if (colKey === 'Status ') {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Resolved,Not Resolved,In-Progress,Open"'],
        };
      } else if (colKey === 'Priority') {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"High,Medium,Low"'],
        };
      } else if (colKey === 'is On TAT') {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Yes,No"'],
        };
      } else if (colKey === 'Call type') {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Proactive,Reactive"'],
        };
      } else if (colKey === 'Request category') {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${VALID_REQUEST_CATEGORIES.join(',')}"`],
        };
      } else if (colKey === 'Request Via ') {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"In person,Phone,Mail,Feedback Form"'],
        };
      }
    });
  });

  // Enable AutoFilter dropdowns
  const lastColLetter = String.fromCharCode(64 + COLUMNS_SCHEMA.length);
  ws.autoFilter = {
    from: 'A1',
    to: `${lastColLetter}${sortedTickets.length + 1}`,
  };
}

/**
 * Builds the executive "Dashboard" worksheet inside the Excel export
 * Matching the exact look, metrics, breakdowns, and CBRE theme of the app
 */
export function buildDashboardSheet(workbook, allTickets, selectedYear = 'all') {
  const targetYear = selectedYear === '2025' ? '2025' : selectedYear === 'all' ? 'all' : '2026';
  const cleanTickets = deduplicateTickets(allTickets);
  const dataset = targetYear === 'all'
    ? cleanTickets
    : cleanTickets.filter((t) => detectTicketYear(t) === targetYear);

  const ws = workbook.addWorksheet('Dashboard', {
    views: [{ showGridLines: true }],
  });

  // Define column widths for optimal viewing
  ws.columns = [
    { width: 3 },  // A (Left Margin)
    { width: 28 }, // B (Category / Site / Month)
    { width: 16 }, // C
    { width: 16 }, // D
    { width: 16 }, // E
    { width: 16 }, // F
    { width: 16 }, // G
    { width: 16 }, // H
    { width: 20 }, // I
  ];

  // Colors (CBRE Corporate Forest Green & High-Priority Alert Theme)
  const CBRE_DARK_GREEN = 'FF003F2D';
  const CBRE_EMERALD = 'FF059669';
  const CBRE_LIGHT_BG = 'FFE8F5E9';
  const ALERT_RED = 'FFD40026';
  const ALERT_LIGHT_BG = 'FFFFEBEE';
  const WHITE = 'FFFFFFFF';
  const SLATE_DARK = 'FF1E293B';
  const SLATE_BG = 'FFF8FAFC';
  const BORDER_LIGHT = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const total = dataset.length;
  let resolved = 0;
  let open = 0;
  let inProgress = 0;
  let notResolved = 0;
  let tatBreached = 0;
  let proactive = 0;
  let reactive = 0;

  const siteMap = {};
  VALID_FACILITY_SITES.forEach((s) => {
    siteMap[s] = { site: s, proactive: 0, reactive: 0, total: 0, resolved: 0, breached: 0 };
  });

  const catMap = {};
  VALID_REQUEST_CATEGORIES.forEach((c) => {
    catMap[c] = { category: c, total: 0, resolved: 0, pending: 0, breached: 0 };
  });

  const monthMap = {};
  const channelMap = {
    'In person': 0,
    Mail: 0,
    Phone: 0,
    'Feedback Form': 0,
  };
  const issueCounts = {};
  const raiserCounts = {};

  dataset.forEach((t) => {
    const s = String(t['Status '] || 'Open').trim().toLowerCase();
    const tat = String(t['is On TAT'] || 'Yes').trim().toLowerCase();
    const call = String(t['Call type'] || '').trim().toLowerCase();
    const site = sanitizeSiteValue(t['Site '] || t['Site']);
    const cat = String(t['Request category'] || 'Housekeeping').trim();
    const month = String(t['Month '] || '').trim();
    const via = String(t['Request Via '] || 'In person').trim();
    const desc = String(t['Discription '] || t['Description'] || '').trim();
    const emp = String(t['Employee Name '] || t['Employee Name'] || '').trim();

    const isResolved = s === 'resolved' || s === 'closed';
    const isPending = !isResolved;
    const isBreached = tat === 'no' || tat === '0';

    if (isResolved) resolved++;
    else if (s === 'in-progress') inProgress++;
    else if (s === 'not resolved') notResolved++;
    else open++;

    if (isBreached) tatBreached++;
    if (call === 'proactive') proactive++;
    else if (call === 'reactive') reactive++;

    if (!siteMap[site]) {
      siteMap[site] = { site, proactive: 0, reactive: 0, total: 0, resolved: 0, breached: 0 };
    }
    siteMap[site].total++;
    if (call === 'proactive') siteMap[site].proactive++;
    else if (call === 'reactive') siteMap[site].reactive++;
    if (isResolved) siteMap[site].resolved++;
    if (isBreached) siteMap[site].breached++;

    if (!catMap[cat]) {
      catMap[cat] = { category: cat, total: 0, resolved: 0, pending: 0, breached: 0 };
    }
    catMap[cat].total++;
    if (isResolved) catMap[cat].resolved++;
    if (isPending) catMap[cat].pending++;
    if (isBreached) catMap[cat].breached++;

    if (month) {
      if (!monthMap[month]) {
        monthMap[month] = { month, total: 0, reactive: 0, proactive: 0, resolved: 0, breached: 0 };
      }
      monthMap[month].total++;
      if (call === 'reactive') monthMap[month].reactive++;
      else if (call === 'proactive') monthMap[month].proactive++;
      if (isResolved) monthMap[month].resolved++;
      if (isBreached) monthMap[month].breached++;
    }

    const matchedVia = Object.keys(channelMap).find((k) => k.toLowerCase() === via.toLowerCase()) || 'In person';
    channelMap[matchedVia] = (channelMap[matchedVia] || 0) + 1;

    if (call === 'reactive' && desc && desc.length > 3) {
      const cleanDesc = desc.slice(0, 50).trim();
      issueCounts[cleanDesc] = (issueCounts[cleanDesc] || 0) + 1;
    }

    if (emp && emp.length > 2) {
      const cleanEmp = emp.replace(/CBRE|Infra/gi, '').trim() || emp;
      raiserCounts[cleanEmp] = (raiserCounts[cleanEmp] || 0) + 1;
    }
  });

  const pendingTotal = open + inProgress + notResolved;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const tatCompliance = total > 0 ? Math.round(((total - tatBreached) / total) * 100) : 100;
  const reactiveRate = total > 0 ? Math.round((reactive / total) * 100) : 0;
  const proactiveRate = total > 0 ? Math.round((proactive / total) * 100) : 0;
  const periodLabel = targetYear === 'all' ? 'All Multi-Year Records' : `FY ${targetYear === '2025' ? '2024-25 (2025)' : '2025-26 (2026)'}`;

  // 1. Title Banner
  ws.mergeCells('B2:I2');
  const titleCell = ws.getCell('B2');
  titleCell.value = 'CBRE FACILITY MANAGEMENT — OPERATIONS & REACTIVE ANALYTICS DASHBOARD';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: WHITE } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CBRE_DARK_GREEN } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 34;

  // Subtitle
  ws.mergeCells('B3:I3');
  const subCell = ws.getCell('B3');
  subCell.value = `Reporting Period: ${periodLabel}  •  Total Volume: ${total.toLocaleString()} Tickets  •  Generated: ${new Date().toLocaleDateString('en-GB')}`;
  subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFE2E8F0' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2E23' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(3).height = 20;

  // Helper for applying borders to merged cells
  const borderRange = (fromCol, fromRow, toCol, toRow) => {
    for (let r = fromRow; r <= toRow; r++) {
      for (let c = fromCol.charCodeAt(0); c <= toCol.charCodeAt(0); c++) {
        ws.getCell(`${String.fromCharCode(c)}${r}`).border = BORDER_LIGHT;
      }
    }
  };

  // Helper for KPI Card
  const createCard = (col1, col2, rowTop, label, bigVal, subVal, bgArgb, valColorArgb) => {
    ws.mergeCells(`${col1}${rowTop}:${col2}${rowTop}`);
    const lCell = ws.getCell(`${col1}${rowTop}`);
    lCell.value = label;
    lCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF64748B' } };
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    lCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.mergeCells(`${col1}${rowTop + 1}:${col2}${rowTop + 1}`);
    const vCell = ws.getCell(`${col1}${rowTop + 1}`);
    vCell.value = bigVal;
    vCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: valColorArgb } };
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    vCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.mergeCells(`${col1}${rowTop + 2}:${col2}${rowTop + 2}`);
    const sCell = ws.getCell(`${col1}${rowTop + 2}`);
    sCell.value = subVal;
    sCell.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF475569' } };
    sCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    sCell.alignment = { vertical: 'middle', horizontal: 'center' };

    borderRange(col1, rowTop, col2, rowTop + 2);
    ws.getRow(rowTop).height = 18;
    ws.getRow(rowTop + 1).height = 26;
    ws.getRow(rowTop + 2).height = 18;
  };

  // 2. Executive KPI Cards
  ws.getCell('B5').value = 'EXECUTIVE OPERATIONS KPIS';
  ws.getCell('B5').font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: CBRE_DARK_GREEN } };
  ws.getRow(5).height = 20;

  // Row 1 of KPI Cards (Rows 6-8)
  createCard('B', 'C', 6, 'TOTAL VOLUME', total.toLocaleString(), 'Total Tracked Tickets', CBRE_LIGHT_BG, CBRE_DARK_GREEN);
  createCard('D', 'E', 6, 'PENDING BACKLOG (URGENT ALERT)', `${pendingTotal} (${total > 0 ? Math.round((pendingTotal / total) * 100) : 0}%)`, `Open: ${open} | In-Prog: ${inProgress}`, ALERT_LIGHT_BG, ALERT_RED);
  createCard('F', 'G', 6, 'RESOLVED VOLUME', `${resolved.toLocaleString()} (${resolutionRate}%)`, 'Completed Operations', CBRE_LIGHT_BG, CBRE_EMERALD);
  createCard('H', 'I', 6, 'SLA TAT COMPLIANCE', `${tatCompliance}%`, `${(total - tatBreached).toLocaleString()} On-Time SLA`, CBRE_LIGHT_BG, CBRE_EMERALD);

  // Row 2 of KPI Cards (Rows 10-12)
  createCard('B', 'C', 10, 'REACTIVE COMPLAINTS', `${reactive.toLocaleString()} (${reactiveRate}%)`, 'Unscheduled Issues', 'FFFFFBEB', 'FFB45309');
  createCard('D', 'E', 10, 'PROACTIVE WALKTHROUGHS', `${proactive.toLocaleString()} (${proactiveRate}%)`, 'Scheduled Audits', CBRE_LIGHT_BG, CBRE_DARK_GREEN);
  createCard('F', 'G', 10, 'TAT SLA BREACHES', `${tatBreached.toLocaleString()}`, `${100 - tatCompliance}% SLA Overdue`, ALERT_LIGHT_BG, ALERT_RED);
  createCard('H', 'I', 10, 'FACILITY SITES', `${VALID_FACILITY_SITES.length} Locations`, 'DT3, DT4 Floors L1/L4/L5/L6', SLATE_BG, SLATE_DARK);

  let curRow = 14;

  // Helper for Section Headers
  const renderSectionHeader = (text) => {
    ws.mergeCells(`B${curRow}:I${curRow}`);
    const cell = ws.getCell(`B${curRow}`);
    cell.value = text;
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: CBRE_DARK_GREEN } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CBRE_LIGHT_BG } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    borderRange('B', curRow, 'I', curRow);
    ws.getRow(curRow).height = 24;
    curRow++;
  };

  // Helper for Table Headers
  const renderTableHeader = (cols) => {
    const row = ws.getRow(curRow);
    row.height = 22;
    cols.forEach((col, idx) => {
      const colLetter = String.fromCharCode('B'.charCodeAt(0) + idx);
      const cell = ws.getCell(`${colLetter}${curRow}`);
      cell.value = col.title;
      cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CBRE_DARK_GREEN } };
      cell.alignment = { vertical: 'middle', horizontal: col.align || 'center' };
      cell.border = BORDER_LIGHT;
    });
    curRow++;
  };

  // 3. TABLE 1: Facility Site Operations Breakdown
  renderSectionHeader('1. FACILITY SITE OPERATIONS BREAKDOWN (DT3 & DT4 FLOORS)');
  renderTableHeader([
    { title: 'Facility Location', align: 'left' },
    { title: 'Proactive Calls', align: 'right' },
    { title: 'Reactive Complaints', align: 'right' },
    { title: 'Total Volume', align: 'right' },
    { title: 'Volume Share %', align: 'right' },
    { title: 'Resolved', align: 'right' },
    { title: 'TAT Breached', align: 'right' },
    { title: 'SLA Compliant %', align: 'right' },
  ]);

  VALID_FACILITY_SITES.forEach((siteKey, idx) => {
    const s = siteMap[siteKey] || { proactive: 0, reactive: 0, total: 0, resolved: 0, breached: 0 };
    const share = total > 0 ? (s.total / total) * 100 : 0;
    const sla = s.total > 0 ? Math.round(((s.total - s.breached) / s.total) * 100) : 100;
    const bg = idx % 2 === 0 ? WHITE : SLATE_BG;

    const r = ws.getRow(curRow);
    r.height = 20;
    const vals = [
      { v: siteKey, a: 'left', b: true },
      { v: s.proactive, a: 'right' },
      { v: s.reactive, a: 'right' },
      { v: s.total, a: 'right', b: true },
      { v: `${share.toFixed(1)}%`, a: 'right' },
      { v: s.resolved, a: 'right' },
      { v: s.breached, a: 'right', color: s.breached > 0 ? ALERT_RED : 'FF64748B' },
      { v: `${sla}%`, a: 'right', color: sla >= 90 ? CBRE_EMERALD : ALERT_RED },
    ];
    vals.forEach((item, cIdx) => {
      const colLetter = String.fromCharCode('B'.charCodeAt(0) + cIdx);
      const cell = ws.getCell(`${colLetter}${curRow}`);
      cell.value = item.v;
      cell.font = { name: 'Segoe UI', size: 9.5, bold: item.b || false, color: { argb: item.color || SLATE_DARK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle', horizontal: item.a };
      cell.border = BORDER_LIGHT;
    });
    curRow++;
  });

  // Table 1 Grand Total
  const t1Row = ws.getRow(curRow);
  t1Row.height = 22;
  const t1Vals = [
    { v: 'Grand Total', a: 'left' },
    { v: proactive, a: 'right' },
    { v: reactive, a: 'right' },
    { v: total, a: 'right' },
    { v: '100.0%', a: 'right' },
    { v: resolved, a: 'right' },
    { v: tatBreached, a: 'right' },
    { v: `${tatCompliance}%`, a: 'right' },
  ];
  t1Vals.forEach((item, cIdx) => {
    const colLetter = String.fromCharCode('B'.charCodeAt(0) + cIdx);
    const cell = ws.getCell(`${colLetter}${curRow}`);
    cell.value = item.v;
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: CBRE_DARK_GREEN } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
    cell.alignment = { vertical: 'middle', horizontal: item.a };
    cell.border = BORDER_LIGHT;
  });
  curRow += 2;

  // 4. TABLE 2: Request Category Breakdown
  renderSectionHeader('2. REQUEST CATEGORY BREAKDOWN');
  renderTableHeader([
    { title: 'Request Category', align: 'left' },
    { title: 'Total Volume', align: 'right' },
    { title: 'Category Share %', align: 'right' },
    { title: 'Resolved Requests', align: 'right' },
    { title: 'Pending Requests', align: 'right' },
    { title: 'TAT Breached', align: 'right' },
    { title: 'SLA Compliance %', align: 'right' },
    { title: 'Operational Status', align: 'center' },
  ]);

  const sortedCats = Object.values(catMap).sort((a, b) => b.total - a.total);
  sortedCats.forEach((c, idx) => {
    const share = total > 0 ? (c.total / total) * 100 : 0;
    const sla = c.total > 0 ? Math.round(((c.total - c.breached) / c.total) * 100) : 100;
    const bg = idx % 2 === 0 ? WHITE : SLATE_BG;

    const r = ws.getRow(curRow);
    r.height = 20;
    const vals = [
      { v: c.category, a: 'left', b: true },
      { v: c.total, a: 'right', b: true },
      { v: `${share.toFixed(1)}%`, a: 'right' },
      { v: c.resolved, a: 'right' },
      { v: c.pending, a: 'right', color: c.pending > 0 ? ALERT_RED : 'FF64748B' },
      { v: c.breached, a: 'right', color: c.breached > 0 ? ALERT_RED : 'FF64748B' },
      { v: `${sla}%`, a: 'right', color: sla >= 90 ? CBRE_EMERALD : ALERT_RED },
      { v: sla >= 95 ? 'Compliant' : sla >= 80 ? 'Within SLA' : 'Needs Review', a: 'center' },
    ];
    vals.forEach((item, cIdx) => {
      const colLetter = String.fromCharCode('B'.charCodeAt(0) + cIdx);
      const cell = ws.getCell(`${colLetter}${curRow}`);
      cell.value = item.v;
      cell.font = { name: 'Segoe UI', size: 9.5, bold: item.b || false, color: { argb: item.color || SLATE_DARK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle', horizontal: item.a };
      cell.border = BORDER_LIGHT;
    });
    curRow++;
  });

  // Table 2 Grand Total
  const t2Row = ws.getRow(curRow);
  t2Row.height = 22;
  const t2Vals = [
    { v: 'Grand Total', a: 'left' },
    { v: total, a: 'right' },
    { v: '100.0%', a: 'right' },
    { v: resolved, a: 'right' },
    { v: pendingTotal, a: 'right' },
    { v: tatBreached, a: 'right' },
    { v: `${tatCompliance}%`, a: 'right' },
    { v: 'Active', a: 'center' },
  ];
  t2Vals.forEach((item, cIdx) => {
    const colLetter = String.fromCharCode('B'.charCodeAt(0) + cIdx);
    const cell = ws.getCell(`${colLetter}${curRow}`);
    cell.value = item.v;
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: CBRE_DARK_GREEN } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
    cell.alignment = { vertical: 'middle', horizontal: item.a };
    cell.border = BORDER_LIGHT;
  });
  curRow += 2;

  // 5. TABLE 3: Chronological Monthly Trend
  renderSectionHeader('3. CHRONOLOGICAL MONTHLY OPERATIONS TREND');
  renderTableHeader([
    { title: 'Operational Month', align: 'left' },
    { title: 'Total Tickets', align: 'right' },
    { title: 'Reactive Complaints', align: 'right' },
    { title: 'Proactive Calls', align: 'right' },
    { title: 'Resolved', align: 'right' },
    { title: 'TAT Breached', align: 'right' },
    { title: 'Monthly Resolution %', align: 'right' },
    { title: 'TAT Compliance %', align: 'right' },
  ]);

  const sortedMonths = Object.keys(monthMap).sort(compareMonthsChronologically);
  sortedMonths.forEach((mKey, idx) => {
    const m = monthMap[mKey];
    const mRes = m.total > 0 ? Math.round((m.resolved / m.total) * 100) : 0;
    const mTat = m.total > 0 ? Math.round(((m.total - m.breached) / m.total) * 100) : 100;
    const bg = idx % 2 === 0 ? WHITE : SLATE_BG;

    const r = ws.getRow(curRow);
    r.height = 20;
    const vals = [
      { v: mKey, a: 'left', b: true },
      { v: m.total, a: 'right', b: true },
      { v: m.reactive, a: 'right' },
      { v: m.proactive, a: 'right' },
      { v: m.resolved, a: 'right' },
      { v: m.breached, a: 'right', color: m.breached > 0 ? ALERT_RED : 'FF64748B' },
      { v: `${mRes}%`, a: 'right' },
      { v: `${mTat}%`, a: 'right', color: mTat >= 90 ? CBRE_EMERALD : ALERT_RED },
    ];
    vals.forEach((item, cIdx) => {
      const colLetter = String.fromCharCode('B'.charCodeAt(0) + cIdx);
      const cell = ws.getCell(`${colLetter}${curRow}`);
      cell.value = item.v;
      cell.font = { name: 'Segoe UI', size: 9.5, bold: item.b || false, color: { argb: item.color || SLATE_DARK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle', horizontal: item.a };
      cell.border = BORDER_LIGHT;
    });
    curRow++;
  });
  curRow += 2;

  // 6. TABLE 4: Request Channel Distribution (Request Via)
  renderSectionHeader('4. REQUEST CHANNEL DISTRIBUTION (REQUEST VIA)');
  renderTableHeader([
    { title: 'Intake Channel', align: 'left' },
    { title: 'Volume Received', align: 'right' },
    { title: 'Channel Share %', align: 'right' },
    { title: 'Intake Mode', align: 'center' },
  ]);

  Object.entries(channelMap).forEach(([channelName, count], idx) => {
    const share = total > 0 ? (count / total) * 100 : 0;
    const bg = idx % 2 === 0 ? WHITE : SLATE_BG;
    const r = ws.getRow(curRow);
    r.height = 20;
    const vals = [
      { v: channelName, a: 'left', b: true },
      { v: count, a: 'right' },
      { v: `${share.toFixed(1)}%`, a: 'right' },
      { v: channelName.toLowerCase().includes('phone') ? 'Immediate Voice' : channelName.toLowerCase().includes('person') ? 'Direct Walk-in' : 'Digital / Portal', a: 'center' },
    ];
    vals.forEach((item, cIdx) => {
      const colLetter = String.fromCharCode('B'.charCodeAt(0) + cIdx);
      const cell = ws.getCell(`${colLetter}${curRow}`);
      cell.value = item.v;
      cell.font = { name: 'Segoe UI', size: 9.5, bold: item.b || false, color: { argb: SLATE_DARK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle', horizontal: item.a };
      cell.border = BORDER_LIGHT;
    });
    curRow++;
  });
  curRow += 2;

  // 7. TABLE 5: Top 8 Recurring Reactive Complaints
  renderSectionHeader('5. TOP 8 RECURRING REACTIVE COMPLAINTS / ISSUES');
  renderTableHeader([
    { title: 'Rank', align: 'center' },
    { title: 'Complaint / Issue Description', align: 'left' },
    { title: 'Frequency', align: 'right' },
    { title: 'Priority Attention', align: 'center' },
  ]);

  const topIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (topIssues.length === 0) {
    ws.mergeCells(`B${curRow}:E${curRow}`);
    const cell = ws.getCell(`B${curRow}`);
    cell.value = 'No reactive complaint data recorded for this period';
    cell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    curRow++;
  } else {
    topIssues.forEach(([desc, cnt], idx) => {
      const bg = idx % 2 === 0 ? WHITE : SLATE_BG;
      const r = ws.getRow(curRow);
      r.height = 20;
      const vals = [
        { v: `#${idx + 1}`, a: 'center', b: true },
        { v: desc, a: 'left' },
        { v: cnt, a: 'right', b: true },
        { v: idx < 3 ? 'High Priority' : 'Standard', a: 'center', color: idx < 3 ? ALERT_RED : 'FF64748B' },
      ];
      vals.forEach((item, cIdx) => {
        const colLetter = String.fromCharCode('B'.charCodeAt(0) + cIdx);
        const cell = ws.getCell(`${colLetter}${curRow}`);
        cell.value = item.v;
        cell.font = { name: 'Segoe UI', size: 9.5, bold: item.b || false, color: { argb: item.color || SLATE_DARK } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { vertical: 'middle', horizontal: item.a };
        cell.border = BORDER_LIGHT;
      });
      curRow++;
    });
  }
}

/**
 * Export tickets into separate sheets for 2026 and 2025 with an Executive Dashboard sheet as first tab
 */
export async function exportTicketsToExcel(tickets, filename = 'Helpdesk_Tracker_Export.xlsx', selectedYear = 'all') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CBRE Facility Management Operations Hub';
  workbook.created = new Date();

  // 1. FIRST WORKSHEET: Dedicated Executive Dashboard matching the in-app analytics
  buildDashboardSheet(workbook, tickets, selectedYear);

  // 2. DATA SHEETS: Split tickets by year
  const tickets2026 = tickets.filter((t) => detectTicketYear(t) === '2026');
  const tickets2025 = tickets.filter((t) => detectTicketYear(t) === '2025');

  if (selectedYear === '2026') {
    // Only 2026 sheet
    buildWorksheet(workbook, 'Helpdesk -2026', tickets2026.length > 0 ? tickets2026 : tickets);
  } else if (selectedYear === '2025') {
    // Only 2025 sheet
    buildWorksheet(workbook, 'Helpdesk-2025', tickets2025.length > 0 ? tickets2025 : tickets);
  } else {
    // Both sheets in same workbook!
    if (tickets2026.length > 0) {
      buildWorksheet(workbook, 'Helpdesk -2026', tickets2026);
    }
    if (tickets2025.length > 0) {
      buildWorksheet(workbook, 'Helpdesk-2025', tickets2025);
    }
    if (tickets2026.length === 0 && tickets2025.length === 0) {
      buildWorksheet(workbook, 'Helpdesk -2026', tickets);
    }
  }

  // Trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Inspect uploaded workbook and return sheet names
 */
export async function getExcelSheets(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        resolve({ workbook, sheetNames: workbook.SheetNames });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse an Excel sheet into Firestore ticket objects with DEDUPLICATION
 */
export function parseSheetToTickets(workbook, selectedSheetName, existingTickets = [], options = {}) {
  const sheetName = selectedSheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found in workbook.`);
  }

  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: true,
  });

  const tickets = [];
  const seenKeys = new Set();
  const skipExisting = options?.skipExisting === true;

  // Only populate seenKeys from existing database tickets if skipExisting is explicitly requested!
  if (skipExisting && Array.isArray(existingTickets)) {
    existingTickets.forEach((t) => {
      const key = getTicketUniqueKey(t);
      if (key) seenKeys.add(key);
    });
  }

  let duplicatesFiltered = 0;

  rawRows.forEach((row, index) => {
    const nonBlankCount = Object.values(row).filter((v) => v !== '' && v !== null).length;
    if (nonBlankCount === 0) return;

    const ticket = {};

    COLUMNS_SCHEMA.forEach((col) => {
      let rawVal = getTicketFieldValue(row, col.key);

      if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
        const def = typeof col.defaultValue === 'function' ? col.defaultValue() : col.defaultValue;
        rawVal = def !== undefined && def !== null ? def : '';
      }

      if (col.key === 'Month ') {
        ticket[col.key] = formatShortMonth(rawVal, sheetName.includes('2025') ? '25' : '26');
      } else if (col.key === 'is On TAT') {
        ticket[col.key] = formatTatValue(rawVal);
      } else if (col.type === 'date') {
        ticket[col.key] = formatExcelDate(rawVal, sheetName.includes('2025') ? '2025' : '2026');
      } else if (col.type === 'time') {
        ticket[col.key] = formatExcelTime(rawVal);
      } else if (rawVal !== undefined && rawVal !== null) {
        ticket[col.key] = String(rawVal).trim();
      } else {
        ticket[col.key] = '';
      }
    });

    // Normalize field variations (Action Taken / Action taken, Description, Times, etc.)
    const normalized = normalizeTicketFields(ticket);
    Object.assign(ticket, normalized);

    // Detect and skip pivot table / summary rows (e.g. from Helpdesk Summary or calculation sheets)
    if (isInvalidPivotOrSummaryRow(ticket)) {
      return; // Skip summary/pivot/total noise row
    }

    // Sanitize Site vs Request Category
    const siteRaw = String(ticket['Site '] || '').trim();
    if (VALID_REQUEST_CATEGORIES.includes(siteRaw)) {
      if (!ticket['Request category'] || !ticket['Request category'].trim()) {
        ticket['Request category'] = siteRaw;
      }
      ticket['Site '] = 'DT3';
    } else {
      ticket['Site '] = sanitizeSiteValue(siteRaw);
    }

    // Must have either a valid description, category, or Sr no to be considered a real ticket
    if (!ticket['Discription '] && !ticket['Request category'] && !ticket['Employee Name ']) {
      return; // Skip empty/noise row
    }

    // Detect Year
    if (!ticket['year']) {
      if (sheetName.includes('2025') || (ticket['Date '] && ticket['Date '].startsWith('2025'))) {
        ticket['year'] = '2025';
      } else {
        ticket['year'] = '2026';
      }
    }

    if (!ticket['Priority']) {
      const cat = (ticket['Request category'] || '').toLowerCase();
      if (cat.includes('hvac') || cat.includes('access')) {
        ticket['Priority'] = 'High';
      } else if (cat.includes('e&m') || cat.includes('event')) {
        ticket['Priority'] = 'Medium';
      } else {
        ticket['Priority'] = 'Low';
      }
    }

    if (!ticket['Sr no.']) {
      ticket['Sr no.'] = String(index + 1);
    }
    ticket.id = ticket.id || `import-${ticket.year || '2026'}-${Date.now().toString(36)}-${index + 1}`;

    // Deduplication check: deterministic unique signature
    const dedupKey = getTicketUniqueKey(ticket);
    if (dedupKey && seenKeys.has(dedupKey)) {
      duplicatesFiltered++;
      return; // Skip duplicate!
    }
    if (dedupKey) seenKeys.add(dedupKey);

    tickets.push(ticket);
  });

  return { tickets, duplicatesFiltered };
}
