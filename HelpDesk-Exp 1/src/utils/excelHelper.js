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
 * Converts Excel serial date to YYYY-MM-DD
 */
export function formatExcelDate(raw) {
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
    return raw.toISOString().split('T')[0];
  }
  if (typeof raw === 'string') {
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  return String(raw);
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
 * Converts Excel serial time or fraction of day to HH:MM:SS
 */
export function formatExcelTime(raw) {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw === 'number' && raw < 1) {
    const totalSecs = Math.round(raw * 86400);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return String(raw);
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
      let val = t[c.key];

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
 * Export tickets into separate sheets for 2026 and 2025
 */
export async function exportTicketsToExcel(tickets, filename = 'Helpdesk_Tracker_Export.xlsx', selectedYear = 'all') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CBRE Facility Tracker Hub';
  workbook.created = new Date();

  // Split tickets by year
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
      let rawVal = row[col.key];

      if (rawVal === undefined) {
        const trimmedKey = col.key.trim();
        const foundKey = Object.keys(row).find((k) => k.trim() === trimmedKey);
        if (foundKey) {
          rawVal = row[foundKey];
        }
      }

      if (col.key === 'Month ') {
        ticket[col.key] = formatShortMonth(rawVal, sheetName.includes('2025') ? '25' : '26');
      } else if (col.key === 'is On TAT') {
        ticket[col.key] = formatTatValue(rawVal);
      } else if (col.type === 'date') {
        ticket[col.key] = formatExcelDate(rawVal);
      } else if (col.type === 'time') {
        ticket[col.key] = formatExcelTime(rawVal);
      } else if (rawVal !== undefined && rawVal !== null) {
        ticket[col.key] = String(rawVal).trim();
      } else {
        ticket[col.key] = typeof col.defaultValue === 'function' ? col.defaultValue() : col.defaultValue;
      }
    });

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
