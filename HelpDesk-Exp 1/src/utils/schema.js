// Exact 20 Column definitions from HELP DESK TRACKER FY 25-26 (11) 1.xlsx
// Database schema matches the exact Excel column names.

// Helper to get current short month: e.g. "Jan-26"
export function getCurrentShortMonth() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[now.getMonth()];
  const yr = String(now.getFullYear()).slice(-2);
  return `${monthName}-${yr}`;
}

/**
  * Standardized ticket year detector: returns '2025' or '2026'
  */
export function detectTicketYear(ticket) {
  if (!ticket) return '2026';
  if (ticket.year === '2025' || ticket.year === '2026') return ticket.year;
  const d = String(ticket['Date '] || '').trim();
  const m = String(ticket['Month '] || '').trim().toLowerCase();
  if (d.startsWith('2025') || d.startsWith('2024') || m.includes('25') || m.includes('24') || m.endsWith('-25')) {
    return '2025';
  }
  return '2026';
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
  const sr = String(ticket['Sr no.'] || '').trim().toLowerCase();
  const cat = String(ticket['Request category'] || '').trim().toLowerCase();
  const desc = String(ticket['Discription '] || ticket['Description'] || '').trim();
  const emp = String(ticket['Employee Name '] || ticket['Employee Name'] || '').trim();
  const action = String(ticket['Action Taken '] || ticket['Action taken '] || '').trim();

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
  const sr = String(ticket['Sr no.'] || '').trim();
  const site = String(ticket['Site '] || ticket['Site'] || '').trim().toUpperCase();
  const date = String(ticket['Date '] || ticket['Month '] || '').trim();
  const time = String(ticket['Report Time'] || '').trim();
  const cat = String(ticket['Request category'] || '').trim().toLowerCase();
  const emp = String(ticket['Employee Name '] || '').trim().toLowerCase();
  const desc = String(ticket['Discription '] || ticket['Description'] || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  // Deterministic signature based on real ticket business data:
  return `${yr}_sr_${sr}_${date}_${time}_${site}_${cat}_${emp.slice(0, 20)}_${desc.slice(0, 40)}`;
}

/**
 * Deduplicates an array of tickets, merging updates and keeping only strictly unique records
 */
export function deduplicateTickets(ticketList) {
  if (!Array.isArray(ticketList) || ticketList.length === 0) return [];

  const map = new Map();

  ticketList.forEach((t, idx) => {
    if (!t || isInvalidPivotOrSummaryRow(t)) return;
    const key = getTicketUniqueKey(t);
    if (!key) return;

    if (!map.has(key)) {
      const yr = detectTicketYear(t);
      const stableId = t.id || `sr-${yr}-${idx + 1}`;
      map.set(key, { ...t, id: stableId, year: yr });
    } else {
      // Duplicate found! Keep the most complete / updated record
      const existing = map.get(key);
      const isExistingClosed =
        existing['Status '] === 'Closed' || existing['Status '] === 'Resolved';
      const isNewClosed = t['Status '] === 'Closed' || t['Status '] === 'Resolved';

      const existingScore = (isExistingClosed ? 3 : 0) + (existing['Action Taken '] ? 1 : 0);
      const newScore = (isNewClosed ? 3 : 0) + (t['Action Taken '] ? 1 : 0);

      const merged =
        newScore >= existingScore
          ? { ...existing, ...t, id: existing.id }
          : { ...t, ...existing, id: existing.id };

      map.set(key, merged);
    }
  });

  return Array.from(map.values());
}

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
    key: 'Action Taken ',
    label: 'Action Taken ',
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
