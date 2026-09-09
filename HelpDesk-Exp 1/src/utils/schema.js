// Exact Column definitions from HELP DESK TRACKER
// Database schema matches the exact Excel column names.

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Helper to get current short month: e.g. "Jan-26"
export function getCurrentShortMonth() {
  const now = new Date();
  const monthName = MONTH_NAMES[now.getMonth()];
  const yr = String(now.getFullYear()).slice(-2);
  return `${monthName}-${yr}`;
}

/**
 * Standardized ticket year detector: returns '2025' or '2026'
 */
export function detectTicketYear(ticket) {
  if (!ticket) return '2026';
  if (ticket.year === '2025' || ticket.year === '2026') return ticket.year;
  const d = String(ticket['Date '] || ticket['Date'] || '').trim();
  const m = String(ticket['Month '] || ticket['Month'] || '').trim().toLowerCase();
  if (
    d.startsWith('2025') ||
    d.startsWith('2024') ||
    d.endsWith('-2025') ||
    d.endsWith('/2025') ||
    d.endsWith('-25') ||
    d.endsWith('/25') ||
    m.includes('25') ||
    m.includes('24') ||
    m.endsWith('-25')
  ) {
    return '2025';
  }
  return '2026';
}

/**
 * Converts any date or raw month to Short Month format (e.g. "Jan-26", "Sep-25")
 */
export function formatShortMonth(raw, fallbackYear = '26') {
  if (!raw) return '';
  if (typeof raw === 'number') {
    const totalDays = Math.floor(raw);
    if (totalDays > 30000 && totalDays < 70000) {
      const utcDays = totalDays - 25569;
      const dObj = new Date(utcDays * 86400 * 1000);
      const m = MONTH_NAMES[dObj.getUTCMonth()] || 'Jan';
      const y = String(dObj.getUTCFullYear()).slice(-2);
      return `${m}-${y}`;
    }
  }
  if (raw instanceof Date) {
    const m = MONTH_NAMES[raw.getMonth()] || 'Jan';
    const y = String(raw.getFullYear()).slice(-2);
    return `${m}-${y}`;
  }
  const str = String(raw).trim();
  const match = str.match(/^(\d{4})-(\d{2})/);
  if (match) {
    const monthNum = parseInt(match[2], 10);
    const m = MONTH_NAMES[monthNum - 1] || 'Jan';
    const y = match[1].slice(-2);
    return `${m}-${y}`;
  }
  if (/^[A-Za-z]{3}-\d{2}$/.test(str)) {
    return str;
  }
  const dMatch = str.match(/^[A-Za-z]{3}/);
  if (dMatch) {
    return `${dMatch[0]}-${fallbackYear}`;
  }
  return str;
}

/**
 * Robust date normalizer: converts Excel serial codes, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, D-MMM to YYYY-MM-DD
 */
export function normalizeDate(raw, fallbackYear = '2026') {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw === 'number') {
    const totalDays = Math.floor(raw);
    if (totalDays > 30000 && totalDays < 70000) {
      const utcDays = totalDays - 25569;
      const date = new Date(utcDays * 86400 * 1000);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(raw).trim();
  if (!str) return '';

  // Excel serial number as string
  if (/^\d{4,5}$/.test(str)) {
    const totalDays = parseInt(str, 10);
    if (totalDays > 30000 && totalDays < 70000) {
      const utcDays = totalDays - 25569;
      const date = new Date(utcDays * 86400 * 1000);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Already YYYY-MM-DD
  const mIso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mIso) {
    return `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const mDmy = str.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
  if (mDmy) {
    return `${mDmy[3]}-${mDmy[2].padStart(2, '0')}-${mDmy[1].padStart(2, '0')}`;
  }

  // M/D/YY or M/D/YYYY
  const mSlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (mSlash) {
    let y = parseInt(mSlash[3], 10);
    if (y < 100) y += 2000;
    return `${y}-${String(mSlash[1]).padStart(2, '0')}-${String(mSlash[2]).padStart(2, '0')}`;
  }

  // D-MMM or D-MMM-YY (e.g. 05-Jan, 5-Jan-26)
  const mDMMM = str.match(/^(\d{1,2})-([A-Za-z]{3})(?:-(\d{2,4}))?$/);
  if (mDMMM) {
    const d = String(mDMMM[1]).padStart(2, '0');
    const mIdx = MONTH_NAMES.findIndex((n) => n.toLowerCase() === mDMMM[2].toLowerCase());
    if (mIdx !== -1) {
      let y = mDMMM[3] ? parseInt(mDMMM[3], 10) : parseInt(fallbackYear, 10);
      if (y < 100) y += 2000;
      return `${y}-${String(mIdx + 1).padStart(2, '0')}-${d}`;
    }
  }

  return str;
}

/**
 * Chronological month comparator: sorts Jan -> Feb -> Mar -> Apr ... Dec
 */
const MONTH_SEQUENCE = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export function compareMonthsChronologically(monthA, monthB) {
  const parseMonth = (str) => {
    if (!str) return 0;
    const s = String(str).trim();
    const match = s.match(/^([A-Za-z]{3})(?:[-\s/]?(\d{2,4}))?/);
    if (match) {
      const monthStr = match[1].toLowerCase();
      const monthNum = MONTH_SEQUENCE[monthStr] || 99;
      let yr = match[2] ? parseInt(match[2], 10) : 0;
      if (yr > 0 && yr < 100) yr += 2000;
      return yr * 100 + monthNum;
    }
    return 999999;
  };

  const valA = parseMonth(monthA);
  const valB = parseMonth(monthB);
  if (valA !== valB) return valA - valB;
  return String(monthA).localeCompare(String(monthB));
}

export const VALID_FACILITY_SITES = ['DT3', 'DT4 L1', 'DT4 L4', 'DT4 L5', 'DT4 L6'];

export const VALID_REQUEST_CATEGORIES = [
  'Housekeeping',
  'HVAC',
  'E&M',
  'EMPLOYEE ACCESS',
  'Event',
  'F&B',
  'Locker request',
];

/**
 * Validates whether a row is an accidental pivot table / summary calculation row
 * (from sheets like Helpdesk Summary, calculation, Sheet3, etc.) and should be deleted
 */
export function isInvalidPivotOrSummaryRow(ticket) {
  if (!ticket || typeof ticket !== 'object') return true;

  const site = String(ticket['Site '] || ticket['Site'] || '').trim();
  const siteLower = site.toLowerCase();
  const sr = String(ticket['Sr no.'] || ticket['Sr no'] || '').trim().toLowerCase();
  const cat = String(ticket['Request category'] || '').trim().toLowerCase();
  const desc = String(ticket['Discription '] || ticket['Description'] || '').trim();
  const emp = String(ticket['Employee Name '] || ticket['Employee Name'] || '').trim();
  const action = String(ticket['Action taken '] || ticket['Action Taken '] || '').trim();

  // Excel pivot / summary noise row labels
  if (
    siteLower.includes('grand total') ||
    siteLower.includes('total request') ||
    siteLower.includes('row label') ||
    siteLower.includes('column label') ||
    siteLower.includes('ticket status') ||
    siteLower.includes('count of') ||
    siteLower === '(multiple items)' ||
    siteLower === '(all)' ||
    siteLower === '(blank)' ||
    siteLower === 'zone' ||
    siteLower === 'month'
  ) {
    return true;
  }

  // Serial date numbers as Site (e.g. 46023, 46032, 46266)
  if (/^\d{4,5}$/.test(site)) {
    return true;
  }

  // Sr no having grand or total
  if (sr.includes('grand') || sr.includes('total') || sr.includes('label')) {
    return true;
  }

  // Category containing total or labels
  if (
    cat.includes('grand total') ||
    cat.includes('total request') ||
    cat === 'row labels' ||
    cat === 'column labels'
  ) {
    return true;
  }

  // True tickets must have either a description, employee name, action taken, or a valid numeric Sr no.
  if (!desc && !emp && !action && !/^\d+$/.test(sr)) {
    return true;
  }

  return false;
}

/**
 * Normalizes Site to strictly one of the 5 valid facility site codes
 */
export function sanitizeSiteValue(siteRaw) {
  const s = String(siteRaw || '').trim();
  const sUpper = s.toUpperCase().replace(/\s+/g, ' ');

  if (VALID_FACILITY_SITES.includes(s)) return s;

  if (sUpper === 'DT3') return 'DT3';
  if (sUpper === 'DT4 L1' || sUpper === 'DT4L1') return 'DT4 L1';
  if (sUpper === 'DT4 L4' || sUpper === 'DT4L4') return 'DT4 L4';
  if (sUpper === 'DT4 L5' || sUpper === 'DT4L5') return 'DT4 L5';
  if (sUpper === 'DT4 L6' || sUpper === 'DT4L6') return 'DT4 L6';

  return 'DT3';
}

/**
 * Generates a stable, deterministic unique signature for a ticket
 */
export function getTicketUniqueKey(ticket) {
  if (!ticket || typeof ticket !== 'object') return '';
  const yr = detectTicketYear(ticket);
  const site = sanitizeSiteValue(ticket['Site '] || ticket['Site'] || 'DT3').toUpperCase().replace(/\s+/g, ' ');
  const date = normalizeDate(ticket['Date '] || ticket['Month '], yr);
  const cat = String(ticket['Request category'] || '').trim().toLowerCase();
  const emp = String(ticket['Employee Name '] || ticket['Employee Name'] || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);
  const desc = String(ticket['Discription '] || ticket['Description'] || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 45);

  if (desc && date) {
    return `${yr}_${site}_${date}_${cat}_${emp}_${desc}`;
  }

  const sr = String(ticket['Sr no.'] || '').trim();
  return `${yr}_${site}_sr_${sr}_${date}_${desc.slice(0, 30)}`;
}

/**
 * Normalizes all ticket fields across potential key casing, whitespace, and alias variants
 */
export function normalizeTicketFields(ticket) {
  if (!ticket || typeof ticket !== 'object') return ticket;
  const t = { ...ticket };

  // Action Taken normalization (synchronize both 'Action taken ' and 'Action Taken ')
  const actionVal = String(
    t['Action taken '] ||
    t['Action Taken '] ||
    t['Action taken'] ||
    t['Action Taken'] ||
    t.action_taken ||
    t.Action ||
    t.action ||
    ''
  ).trim();
  t['Action taken '] = actionVal;
  t['Action Taken '] = actionVal;
  t['Action taken'] = actionVal;
  t['Action Taken'] = actionVal;

  // Description normalization (synchronize 'Discription ' and 'Description')
  const descVal = String(
    t['Discription '] ||
    t['Description '] ||
    t['Discription'] ||
    t['Description'] ||
    t.description ||
    ''
  ).trim();
  t['Discription '] = descVal;
  t['Description'] = descVal;

  // Date Close normalization (synchronize 'Date close ' and 'Date close')
  const dateCloseVal = String(
    t['Date close '] ||
    t['Date Close '] ||
    t['Date close'] ||
    t['Date Close'] ||
    t.date_close ||
    t['Close Date'] ||
    ''
  ).trim();
  t['Date close '] = dateCloseVal;
  t['Date close'] = dateCloseVal;

  // Resolved Time normalization (synchronize 'Resolved time' and 'Resolved time ')
  const resolvedTimeVal = String(
    t['Resolved time'] ||
    t['Resolved time '] ||
    t['Resolved Time'] ||
    t['Resolved Time '] ||
    t.resolved_time ||
    t['Close Time'] ||
    ''
  ).trim();
  t['Resolved time'] = resolvedTimeVal;
  t['Resolved time '] = resolvedTimeVal;

  // Report Time normalization (synchronize 'Report Time' and 'Report time')
  const reportTimeVal = String(
    t['Report Time'] ||
    t['Report time'] ||
    t['Report Time '] ||
    t['Report time '] ||
    t.report_time ||
    ''
  ).trim();
  t['Report Time'] = reportTimeVal;
  t['Report time'] = reportTimeVal;

  // Employee Name normalization
  const empVal = String(
    t['Employee Name '] ||
    t['Employee Name'] ||
    t['Employee name '] ||
    t['Employee name'] ||
    t.employee_name ||
    ''
  ).trim();
  t['Employee Name '] = empVal;
  t['Employee Name'] = empVal;

  // Request Via normalization
  const reqViaVal = String(
    t['Request Via '] ||
    t['Request Via'] ||
    t['Request via '] ||
    t['Request via'] ||
    t.request_via ||
    'In person'
  ).trim();
  t['Request Via '] = reqViaVal;

  // Site normalization
  t['Site '] = sanitizeSiteValue(t['Site '] || t['Site']);

  // Year normalization
  t.year = String(t.year || detectTicketYear(t));

  // Month normalization to short month (e.g. Jan-26)
  if (t['Month ']) {
    t['Month '] = formatShortMonth(t['Month '], t.year === '2025' ? '25' : '26');
  }

  // Date normalization: if date string exists, normalize if needed
  if (t['Date ']) {
    t['Date '] = normalizeDate(t['Date '], t.year);
  }

  return t;
}

/**
 * Deduplicates an array of tickets, merging updates and keeping only strictly unique records.
 * Uses both normalized content signature and Sr no + Site signature.
 */
export function deduplicateTickets(ticketList) {
  if (!Array.isArray(ticketList) || ticketList.length === 0) return [];

  const keyMap = new Map();
  const srSiteMap = new Map();

  ticketList.forEach((rawT, idx) => {
    if (!rawT || isInvalidPivotOrSummaryRow(rawT)) return;
    const t = normalizeTicketFields(rawT);
    const primaryKey = getTicketUniqueKey(t);
    if (!primaryKey) return;

    const yr = detectTicketYear(t);
    const site = sanitizeSiteValue(t['Site '] || t['Site'] || 'DT3');
    const srNum = parseInt(t['Sr no.'], 10);
    const srSiteKey = (!isNaN(srNum) && srNum > 0) ? `${yr}_${site}_${srNum}` : null;

    let matchedExisting = null;
    let matchKey = primaryKey;

    if (keyMap.has(primaryKey)) {
      matchedExisting = keyMap.get(primaryKey);
      matchKey = primaryKey;
    } else if (srSiteKey && srSiteMap.has(srSiteKey)) {
      const candidate = srSiteMap.get(srSiteKey);
      const descA = String(candidate['Discription '] || candidate['Description'] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const descB = String(t['Discription '] || t['Description'] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const dateA = normalizeDate(candidate['Date '] || candidate['Month '], yr);
      const dateB = normalizeDate(t['Date '] || t['Month '], yr);

      if (dateA === dateB || (descA && descB && (descA.includes(descB.slice(0, 20)) || descB.includes(descA.slice(0, 20))))) {
        matchedExisting = candidate;
        matchKey = getTicketUniqueKey(candidate);
      }
    }

    if (!matchedExisting) {
      const stableId = t.id || `sr-${yr}-${idx + 1}`;
      const record = { ...t, id: stableId, year: yr };
      keyMap.set(primaryKey, record);
      if (srSiteKey) srSiteMap.set(srSiteKey, record);
    } else {
      // Duplicate found! Keep the most complete / updated record
      const isExistingClosed =
        matchedExisting['Status '] === 'Closed' || matchedExisting['Status '] === 'Resolved';
      const isNewClosed = t['Status '] === 'Closed' || t['Status '] === 'Resolved';

      const existingAction = matchedExisting['Action taken '] || matchedExisting['Action Taken '] || '';
      const newAction = t['Action taken '] || t['Action Taken '] || '';

      const existingScore = (isExistingClosed ? 3 : 0) + (existingAction ? 2 : 0) + (matchedExisting['Date close '] ? 1 : 0);
      const newScore = (isNewClosed ? 3 : 0) + (newAction ? 2 : 0) + (t['Date close '] ? 1 : 0);

      const merged =
        newScore >= existingScore
          ? { ...matchedExisting, ...t, id: matchedExisting.id, year: yr }
          : { ...t, ...matchedExisting, id: matchedExisting.id, year: yr };

      // Ensure action taken and description are never lost
      if (!merged['Action taken '] && existingAction) {
        merged['Action taken '] = existingAction;
        merged['Action Taken '] = existingAction;
      }
      if (!merged['Action taken '] && newAction) {
        merged['Action taken '] = newAction;
        merged['Action Taken '] = newAction;
      }

      const normMerged = normalizeTicketFields(merged);
      keyMap.set(matchKey, normMerged);
      if (srSiteKey) srSiteMap.set(srSiteKey, normMerged);
    }
  });

  return Array.from(keyMap.values());
}

/**
 * Identifies IDs of duplicate and invalid rows that can be safely purged from the database
 */
export function identifyDuplicateTicketIds(ticketList) {
  if (!Array.isArray(ticketList) || ticketList.length === 0) return [];
  const map = new Map();
  const duplicateIds = [];

  ticketList.forEach((rawT) => {
    if (!rawT) return;
    if (isInvalidPivotOrSummaryRow(rawT)) {
      if (rawT.id) duplicateIds.push(String(rawT.id));
      return;
    }
    const t = normalizeTicketFields(rawT);
    const key = getTicketUniqueKey(t);
    if (!key) {
      if (t.id) duplicateIds.push(String(t.id));
      return;
    }

    if (!map.has(key)) {
      map.set(key, t);
    } else {
      const existing = map.get(key);
      if (t.id && existing.id && String(t.id) !== String(existing.id)) {
        duplicateIds.push(String(t.id));
      }
    }
  });

  return duplicateIds;
}

/**
 * EXACT 18-column schema requested for Excel export matching the operational tracker:
 * Sr no. | Site | Zone | Location | Month | Date | Report Time | Request category | Employee Name | Request Via | Discription | Action taken | Date close | Resolved time | Status | Request from | Call type | Remark
 */
export const EXPORT_COLUMNS_SCHEMA = [
  { key: 'Sr no.', label: 'Sr no.', width: 10 },
  { key: 'Site ', label: 'Site ', width: 12 },
  { key: 'Zone', label: 'Zone', width: 12 },
  { key: 'Location', label: 'Location', width: 18 },
  { key: 'Month ', label: 'Month ', width: 12 },
  { key: 'Date ', label: 'Date ', width: 14 },
  { key: 'Report Time', label: 'Report Time', width: 14 },
  { key: 'Request category', label: 'Request category', width: 20 },
  { key: 'Employee Name ', label: 'Employee Name ', width: 22 },
  { key: 'Request Via ', label: 'Request Via ', width: 15 },
  { key: 'Discription ', label: 'Discription ', width: 40 },
  { key: 'Action taken ', label: 'Action taken ', width: 40 },
  { key: 'Date close ', label: 'Date close ', width: 14 },
  { key: 'Resolved time', label: 'Resolved time', width: 14 },
  { key: 'Status ', label: 'Status ', width: 15 },
  { key: 'Request from ', label: 'Request from ', width: 22 },
  { key: 'Call type', label: 'Call type', width: 14 },
  { key: 'Remark', label: 'Remark', width: 20 },
];

export const COLUMNS_SCHEMA = [
  {
    key: 'Sr no.',
    label: 'Sr no.',
    type: 'number',
    editable: true,
    width: 90,
    pinned: 'left',
    placeholder: 'e.g. 1',
    description: 'Serial number identifier',
    defaultValue: '',
  },
  {
    key: 'Site ',
    label: 'Site ',
    type: 'select',
    editable: true,
    width: 115,
    pinned: 'left',
    options: ['DT3', 'DT4 L1', 'DT4 L4', 'DT4 L5', 'DT4 L6'],
    placeholder: 'Select site / floor',
    description: 'Facility location/floor code',
    defaultValue: 'DT3',
  },
  {
    key: 'Zone',
    label: 'Zone',
    type: 'select',
    editable: true,
    width: 110,
    options: ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F'],
    placeholder: 'Select zone',
    description: 'Floor zone designation',
    defaultValue: 'Zone A',
  },
  {
    key: 'Location',
    label: 'Location',
    type: 'text',
    editable: true,
    width: 150,
    suggestions: [
      'Washroom',
      'Social Hub',
      'Cafeteria',
      'Reception',
      'Innovation Hub',
      'Workstation',
      'Passage',
      'Breakout Area',
      'Meeting Room',
      'Tuck shop',
    ],
    placeholder: 'e.g. Washroom, Cafeteria',
    description: 'Specific room or area',
    defaultValue: '',
  },
  {
    key: 'Month ',
    label: 'Month ',
    type: 'text',
    editable: true,
    width: 110,
    placeholder: 'e.g. Jan-26',
    description: 'Short month e.g. Jan-26, Feb-26',
    defaultValue: getCurrentShortMonth,
  },
  {
    key: 'Date ',
    label: 'Date ',
    type: 'date',
    editable: true,
    width: 130,
    placeholder: 'YYYY-MM-DD',
    description: 'Date request was logged',
    defaultValue: () => new Date().toISOString().split('T')[0],
  },
  {
    key: 'Report Time',
    label: 'Report Time',
    type: 'time',
    editable: true,
    width: 120,
    placeholder: 'HH:MM:SS',
    description: 'Time request was reported',
    defaultValue: () => new Date().toLocaleTimeString('en-GB'),
  },
  {
    key: 'Request category',
    label: 'Request category',
    type: 'select',
    editable: true,
    width: 170,
    options: [
      'Housekeeping',
      'HVAC',
      'E&M',
      'EMPLOYEE ACCESS',
      'Event',
      'F&B',
      'Locker request',
    ],
    placeholder: 'Select category',
    description: 'Department or category of service',
    defaultValue: 'Housekeeping',
  },
  {
    key: 'Employee Name ',
    label: 'Employee Name ',
    type: 'text',
    editable: true,
    width: 170,
    suggestions: [
      'Wajid CBRE',
      'Diksha CBRE',
      'Priya CBRE',
      'Latika Infra',
      'Manish Infra',
      'Harpreet CBRE',
      'Maya Infra',
      'Akim CBRE',
      'Riya CBRE',
      'Sunil CBRE',
      'Ayush CBRE',
      'Prem Infra',
      'Hitesh Infra',
    ],
    placeholder: 'e.g. Diksha CBRE, Wajid CBRE',
    description: 'Ticket Raiser / Logged By (Employee or Helpdesk Agent)',
    defaultValue: '',
  },
  {
    key: 'Request Via ',
    label: 'Request Via ',
    type: 'select',
    editable: true,
    width: 130,
    options: ['In person', 'Phone', 'Mail', 'Feedback Form'],
    placeholder: 'Select channel',
    description: 'Channel through which ticket arrived',
    defaultValue: 'In person',
  },
  {
    key: 'Discription ',
    label: 'Discription ',
    type: 'textarea',
    editable: true,
    width: 280,
    placeholder: 'Enter detailed ticket description...',
    description: 'Issue or requirement description',
    defaultValue: '',
  },
  {
    key: 'Action taken ',
    label: 'Action taken ',
    type: 'textarea',
    editable: true,
    width: 280,
    placeholder: 'Details of action taken...',
    description: 'Intervention performed by team',
    defaultValue: '',
  },
  {
    key: 'Date close ',
    label: 'Date close ',
    type: 'date',
    editable: true,
    width: 130,
    placeholder: 'YYYY-MM-DD',
    description: 'Date ticket was resolved/closed',
    defaultValue: '',
  },
  {
    key: 'Resolved time',
    label: 'Resolved time',
    type: 'time',
    editable: true,
    width: 130,
    placeholder: 'HH:MM:SS',
    description: 'Time ticket was closed',
    defaultValue: '',
  },
  {
    key: 'Status ',
    label: 'Status ',
    type: 'select',
    editable: true,
    width: 130,
    options: ['Resolved', 'Not Resolved', 'In-Progress', 'Open'],
    placeholder: 'Select status',
    description: 'Current ticket resolution state',
    defaultValue: 'Open',
  },
  {
    key: 'Request from ',
    label: 'Request from ',
    type: 'text',
    editable: true,
    width: 180,
    suggestions: [
      'Employee',
      'Team CBRE - Wajid',
      'Team CBRE - Diksha',
      'Team CBRE - Priya',
      'Team Infra - Latika',
      'Team CBRE - Harpreet',
      'Team Infra - Maya',
      'Team CBRE - Riya',
      'Team Infra - Manish',
      'Team Infra - Hitesh',
    ],
    placeholder: 'e.g. Employee or Team name',
    description: 'Original requestor identity',
    defaultValue: 'Employee',
  },
  {
    key: 'Call type',
    label: 'Call type',
    type: 'select',
    editable: true,
    width: 120,
    options: ['Proactive', 'Reactive'],
    placeholder: 'Select call type',
    description: 'Whether issue was proactive or reactive',
    defaultValue: 'Reactive',
  },
  {
    key: 'Remark',
    label: 'Remark',
    type: 'text',
    editable: true,
    width: 160,
    placeholder: 'Optional notes or remarks',
    description: 'Additional notes or remarks',
    defaultValue: '',
  },
  {
    key: 'is On TAT',
    label: 'is On TAT',
    type: 'select',
    editable: true,
    width: 110,
    options: ['Yes', 'No'],
    placeholder: 'Yes or No',
    description: 'Yes for within TAT / SLA, No for breached',
    defaultValue: 'Yes',
  },
  {
    key: 'Priority',
    label: 'Priority',
    type: 'select',
    editable: true,
    width: 110,
    options: ['High', 'Medium', 'Low'],
    placeholder: 'Select priority',
    description: 'Severity level (High / Medium / Low)',
    defaultValue: 'Medium',
  },
];

// Helper to normalize an object to ensure all 20 columns exist
export function createEmptyTicket() {
  const ticket = {};
  COLUMNS_SCHEMA.forEach((col) => {
    if (typeof col.defaultValue === 'function') {
      ticket[col.key] = col.defaultValue();
    } else {
      ticket[col.key] = col.defaultValue;
    }
  });
  ticket.year = '2026';
  return ticket;
}

export const SCHEMA_MAP = Object.fromEntries(
  COLUMNS_SCHEMA.map((col) => [col.key, col])
);
