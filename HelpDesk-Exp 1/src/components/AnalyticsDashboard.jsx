import React, { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  TrendingUp,
  Layers,
  Users,
  Filter,
  RotateCcw,
  Calendar,
  Building2,
  Tag,
  PhoneCall,
  Sparkles,
  AlertOctagon,
  ArrowRight,
  Zap,
  Activity,
  Check,
  Search,
  ExternalLink,
  ShieldAlert,
  ChevronRight,
  ListFilter,
  Eye,
} from 'lucide-react';
import {
  detectTicketYear,
  compareMonthsChronologically,
  VALID_REQUEST_CATEGORIES,
  deduplicateTickets,
} from '../utils/schema';

const STATUS_COLORS = {
  Resolved: '#10b981',
  Closed: '#10b981',
  'Not Resolved': '#ef4444',
  Open: '#f59e0b',
  'In-Progress': '#3b82f6',
  Other: '#94a3b8',
};

const CATEGORY_COLORS = [
  '#6366f1',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
];

const PRIORITY_COLORS = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#10b981',
};

const CHANNEL_COLORS = {
  'In person': '#3b82f6',
  Mail: '#8b5cf6',
  Phone: '#10b981',
  'Feedback Form': '#f59e0b',
  ' Feedback form': '#f59e0b',
};

export default function AnalyticsDashboard({
  allTickets = [],
  selectedYear = '2026',
  onSelectYear,
  onFilterGridToReactive,
  onDrilldownToTracker,
}) {
  // Ensure active year defaults to 2026 (current) unless 2025 is explicitly selected
  const activeYear = selectedYear === '2025' ? '2025' : selectedYear === 'all' ? 'all' : '2026';

  const handleYearToggle = (yr) => {
    resetFilters();
    if (typeof onSelectYear === 'function') {
      onSelectYear(yr);
    }
  };

  // Filter States
  const [siteFilter, setSiteFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [callTypeFilter, setCallTypeFilter] = useState('all');
  const [requestViaFilter, setRequestViaFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const activeFilterCount = [
    siteFilter !== 'all',
    categoryFilter !== 'all',
    callTypeFilter !== 'all',
    requestViaFilter !== 'all',
    monthFilter !== 'all',
    statusFilter !== 'all',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSiteFilter('all');
    setCategoryFilter('all');
    setCallTypeFilter('all');
    setRequestViaFilter('all');
    setMonthFilter('all');
    setStatusFilter('all');
  };

  // Helper to trigger interactive drilldown to Tracker Grid with all active dashboard filters preserved
  const handleDrilldown = useCallback(
    (incoming = {}) => {
      if (typeof onDrilldownToTracker !== 'function') return;

      // Build base filter state from active dashboard dropdowns
      const filters = {
        year: activeYear,
      };
      if (siteFilter !== 'all') filters.site = siteFilter;
      if (categoryFilter !== 'all') filters.category = categoryFilter;
      if (callTypeFilter !== 'all') filters.callType = callTypeFilter;
      if (requestViaFilter !== 'all') filters.requestVia = requestViaFilter;
      if (monthFilter !== 'all') filters.month = monthFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;

      // Merge explicit filter payload if provided
      if (incoming.filters) {
        Object.assign(filters, incoming.filters);
      }

      // Process specific incoming drilldown type
      const type = incoming.type || 'all';
      const value = incoming.value;

      if (type === 'pending') {
        filters.isPending = true;
      } else if (type === 'callType' && value) {
        filters.callType = value;
      } else if (type === 'status' && value) {
        filters.status = value;
      } else if (type === 'tat') {
        filters.tat = value === 'No' || value === 'breached' ? 'breached' : 'compliant';
      } else if (type === 'category' && value) {
        filters.category = value;
      } else if (type === 'site' && value) {
        filters.site = value;
      } else if (type === 'channel' && value) {
        filters.requestVia = value;
      } else if (type === 'month' && value) {
        filters.month = value;
      } else if (type === 'priority' && value) {
        filters.priority = value;
      } else if (type === 'raiser' && value) {
        filters.engineer = value;
      } else if (type === 'siteAndType' && value) {
        if (value.site) filters.site = value.site;
        if (value.callType) filters.callType = value.callType;
      } else if (type === 'ticketId') {
        // Individual ticket drilldown opens directly
        onDrilldownToTracker({
          type: 'ticketId',
          value: value,
          label: incoming.label || `Ticket #${value}`,
        });
        return;
      }

      // Build descriptive human-readable label
      const parts = [];
      if (filters.category) parts.push(`Category: ${filters.category}`);
      if (filters.site) parts.push(`Site: ${filters.site}`);
      if (filters.month) parts.push(`Month: ${filters.month}`);
      if (filters.callType) parts.push(`Call: ${filters.callType}`);
      if (filters.requestVia) parts.push(`Via: ${filters.requestVia}`);
      if (filters.status) parts.push(`Status: ${filters.status}`);
      if (filters.isPending) parts.push(`Pending`);
      if (filters.tat) parts.push(filters.tat === 'breached' ? 'TAT Breached' : 'TAT On-Time');
      if (filters.priority) parts.push(`Priority: ${filters.priority}`);
      if (filters.engineer) parts.push(`Raised by: ${filters.engineer}`);

      const yearSuffix = filters.year === 'all' ? 'All Years' : filters.year;
      const finalLabel =
        parts.length > 0
          ? `${parts.join(' • ')} (${yearSuffix})`
          : incoming.label || `All Tickets (${yearSuffix})`;

      onDrilldownToTracker({
        type: 'compound',
        label: finalLabel,
        filters: filters,
      });
    },
    [
      activeYear,
      siteFilter,
      categoryFilter,
      callTypeFilter,
      requestViaFilter,
      monthFilter,
      statusFilter,
      onDrilldownToTracker,
    ]
  );

  // Guarantee strictly unique records with zero duplicate or noise rows
  const cleanTickets = useMemo(() => {
    return deduplicateTickets(allTickets);
  }, [allTickets]);

  // Year tickets count
  const count2026 = useMemo(() => {
    return cleanTickets.filter((t) => detectTicketYear(t) === '2026').length;
  }, [cleanTickets]);

  const count2025 = useMemo(() => {
    return cleanTickets.filter((t) => detectTicketYear(t) === '2025').length;
  }, [cleanTickets]);

  // Dataset filtered by active year first
  const yearDataset = useMemo(() => {
    if (activeYear === 'all') return cleanTickets;
    return cleanTickets.filter((t) => detectTicketYear(t) === activeYear);
  }, [cleanTickets, activeYear]);

  // Extract distinct short months in current year
  const availableMonths = useMemo(() => {
    const set = new Set();
    yearDataset.forEach((t) => {
      const m = (t['Month '] || '').trim();
      if (m) set.add(m);
    });
    return Array.from(set).sort(compareMonthsChronologically);
  }, [yearDataset]);

  // Extract all categories including F&B and any custom categories in the dataset
  const allCategories = useMemo(() => {
    const set = new Set(VALID_REQUEST_CATEGORIES);
    cleanTickets.forEach((t) => {
      const c = (t['Request category'] || '').trim();
      if (
        c &&
        !c.toLowerCase().includes('total') &&
        !c.toLowerCase().includes('label') &&
        !c.toLowerCase().includes('multiple')
      ) {
        set.add(c);
      }
    });
    return Array.from(set);
  }, [cleanTickets]);

  // Filtered dataset with all filter bar constraints
  const filteredDataset = useMemo(() => {
    return yearDataset.filter((t) => {
      if (
        siteFilter !== 'all' &&
        (t['Site '] || '').trim().toLowerCase() !== siteFilter.trim().toLowerCase()
      )
        return false;
      if (
        categoryFilter !== 'all' &&
        (t['Request category'] || '').trim().toLowerCase() !== categoryFilter.trim().toLowerCase()
      )
        return false;
      if (
        callTypeFilter !== 'all' &&
        (t['Call type'] || '').trim().toLowerCase() !== callTypeFilter.trim().toLowerCase()
      )
        return false;
      if (
        requestViaFilter !== 'all' &&
        (t['Request Via '] || '').trim().toLowerCase() !== requestViaFilter.trim().toLowerCase()
      )
        return false;
      if (
        monthFilter !== 'all' &&
        (t['Month '] || '').trim().toLowerCase() !== monthFilter.trim().toLowerCase()
      )
        return false;
      if (
        statusFilter !== 'all' &&
        (t['Status '] || '').trim().toLowerCase() !== statusFilter.trim().toLowerCase()
      )
        return false;
      return true;
    });
  }, [
    yearDataset,
    siteFilter,
    categoryFilter,
    callTypeFilter,
    requestViaFilter,
    monthFilter,
    statusFilter,
  ]);

  // Overall Year Overview Metrics
  const overallMetrics = useMemo(() => {
    const total = filteredDataset.length;
    let resolved = 0;
    let open = 0;
    let inProgress = 0;
    let notResolved = 0;
    let tatBreached = 0;
    let proactive = 0;
    let reactive = 0;

    filteredDataset.forEach((t) => {
      const s = (t['Status '] || 'Open').trim().toLowerCase();
      const tat = String(t['is On TAT'] || 'Yes').trim().toLowerCase();
      const call = (t['Call type'] || '').trim().toLowerCase();

      if (s === 'resolved' || s === 'closed') {
        resolved++;
      } else if (s === 'in-progress') {
        inProgress++;
      } else if (s === 'not resolved') {
        notResolved++;
      } else {
        open++;
      }

      if (tat === 'no' || tat === '0') tatBreached++;
      if (call === 'proactive') proactive++;
      else if (call === 'reactive') reactive++;
    });

    const pendingTotal = open + inProgress + notResolved;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const tatCompliance = total > 0 ? Math.round(((total - tatBreached) / total) * 100) : 100;
    const proactiveRate = total > 0 ? Math.round((proactive / total) * 100) : 0;
    const reactiveRate = total > 0 ? Math.round((reactive / total) * 100) : 0;

    return {
      total,
      resolved,
      open,
      inProgress,
      notResolved,
      pendingTotal,
      tatBreached,
      resolutionRate,
      tatCompliance,
      proactive,
      reactive,
      proactiveRate,
      reactiveRate,
    };
  }, [filteredDataset]);

  // Pending Analytics & Backlog
  const pendingAnalytics = useMemo(() => {
    const pendingTickets = filteredDataset.filter((t) => {
      const s = (t['Status '] || 'Open').trim().toLowerCase();
      return s !== 'resolved' && s !== 'closed';
    });

    const catCounts = {};
    const siteCounts = {};
    const statusCounts = {
      Open: 0,
      'In-Progress': 0,
      'Not Resolved': 0,
    };
    const priorityCounts = {
      High: 0,
      Medium: 0,
      Low: 0,
    };

    pendingTickets.forEach((t) => {
      const c = (t['Request category'] || 'Other').trim();
      const s = (t['Site '] || 'DT3').trim();
      const st = (t['Status '] || 'Open').trim();
      const p = (t['Priority'] || 'Medium').trim();

      catCounts[c] = (catCounts[c] || 0) + 1;
      siteCounts[s] = (siteCounts[s] || 0) + 1;
      if (statusCounts[st] !== undefined) statusCounts[st]++;
      else statusCounts['Open']++;
      if (priorityCounts[p] !== undefined) priorityCounts[p]++;
      else priorityCounts['Medium']++;
    });

    const byCategory = Object.entries(catCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const bySite = Object.entries(siteCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const byStatus = Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
    }));

    const byPriority = Object.entries(priorityCounts).map(([name, value]) => ({
      name,
      value,
    }));

    const topPendingList = pendingTickets.slice(0, 10);

    return {
      total: pendingTickets.length,
      tickets: pendingTickets,
      byCategory,
      bySite,
      byStatus,
      byPriority,
      topPendingList,
    };
  }, [filteredDataset]);

  // Excel Chart 1: Request Category Month Wise (from calculation sheet)
  const categoryMonthWiseData = useMemo(() => {
    const monthMap = {};
    const categories = ['Housekeeping', 'HVAC', 'E&M', 'EMPLOYEE ACCESS', 'Event', 'F&B', 'Locker request'];

    filteredDataset.forEach((t) => {
      const m = (t['Month '] || 'Other').trim();
      const cat = (t['Request category'] || 'Other').trim();
      if (!monthMap[m]) {
        monthMap[m] = { month: m, total: 0 };
        categories.forEach((c) => {
          monthMap[m][c] = 0;
        });
      }
      monthMap[m][cat] = (monthMap[m][cat] || 0) + 1;
      monthMap[m].total++;
    });

    return Object.values(monthMap).sort((a, b) => compareMonthsChronologically(a.month, b.month));
  }, [filteredDataset]);

  // Excel Chart 2: Count of Request by Site and Type (from calculation sheet)
  const siteAndTypeData = useMemo(() => {
    const sites = ['DT3', 'DT4 L1', 'DT4 L4', 'DT4 L5', 'DT4 L6'];
    const dataMap = {};
    sites.forEach((s) => {
      dataMap[s] = { site: s, Proactive: 0, Reactive: 0, total: 0 };
    });

    filteredDataset.forEach((t) => {
      const s = (t['Site '] || 'DT3').trim();
      const call = (t['Call type'] || 'Reactive').trim();
      const key = dataMap[s] ? s : 'DT3';
      if (call.toLowerCase() === 'proactive') {
        dataMap[key].Proactive++;
      } else {
        dataMap[key].Reactive++;
      }
      dataMap[key].total++;
    });

    return Object.values(dataMap);
  }, [filteredDataset]);

  // Excel Chart 3: Monthwise Request Count Trend (from calculation sheet)
  const monthwiseTotalData = useMemo(() => {
    const monthMap = {};
    filteredDataset.forEach((t) => {
      const m = (t['Month '] || 'Other').trim();
      monthMap[m] = (monthMap[m] || 0) + 1;
    });

    return Object.entries(monthMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => compareMonthsChronologically(a.month, b.month));
  }, [filteredDataset]);

  // Excel Chart 4: Monthwise Request by Channel (from calculation sheet)
  const monthwiseChannelData = useMemo(() => {
    const monthMap = {};
    const channels = ['In person', 'Phone', 'Mail', 'Feedback Form'];

    filteredDataset.forEach((t) => {
      const m = (t['Month '] || 'Other').trim();
      let ch = (t['Request Via '] || 'In person').trim();
      if (ch === ' Feedback form') ch = 'Feedback Form';

      if (!monthMap[m]) {
        monthMap[m] = { month: m, total: 0 };
        channels.forEach((c) => {
          monthMap[m][c] = 0;
        });
      }
      monthMap[m][ch] = (monthMap[m][ch] || 0) + 1;
      monthMap[m].total++;
    });

    return Object.values(monthMap).sort((a, b) => compareMonthsChronologically(a.month, b.month));
  }, [filteredDataset]);

  // Excel Summary Chart 5: Category Distribution (from Helpdesk Summary)
  const categoryDistributionData = useMemo(() => {
    const counts = {};
    filteredDataset.forEach((t) => {
      const cat = (t['Request category'] || 'Housekeeping').trim();
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const total = filteredDataset.length || 1;
    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        percentage: Math.round((value / total) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDataset]);

  // Excel Summary Chart 6: Site Distribution (from Helpdesk Summary)
  const siteDistributionData = useMemo(() => {
    const counts = {};
    filteredDataset.forEach((t) => {
      const s = (t['Site '] || 'DT3').trim();
      counts[s] = (counts[s] || 0) + 1;
    });

    const total = filteredDataset.length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredDataset]);

  // Excel Summary Chart 7: Request Via Channel Distribution (from Helpdesk Summary)
  const channelDistributionData = useMemo(() => {
    const counts = {};
    filteredDataset.forEach((t) => {
      let ch = (t['Request Via '] || 'In person').trim();
      if (ch === ' Feedback form') ch = 'Feedback Form';
      counts[ch] = (counts[ch] || 0) + 1;
    });

    const total = filteredDataset.length || 1;
    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        percentage: Math.round((value / total) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDataset]);

  // Excel Summary Chart 8: Status Month-Wise (from Helpdesk Summary)
  const statusMonthWiseData = useMemo(() => {
    const monthMap = {};
    filteredDataset.forEach((t) => {
      const m = (t['Month '] || 'Other').trim();
      const s = (t['Status '] || 'Open').trim();
      const isResolved = s.toLowerCase() === 'resolved' || s.toLowerCase() === 'closed';

      if (!monthMap[m]) {
        monthMap[m] = { month: m, Resolved: 0, Pending: 0, total: 0 };
      }
      if (isResolved) {
        monthMap[m].Resolved++;
      } else {
        monthMap[m].Pending++;
      }
      monthMap[m].total++;
    });

    return Object.values(monthMap).sort((a, b) => compareMonthsChronologically(a.month, b.month));
  }, [filteredDataset]);

  // Priority Breakdown
  const priorityDistributionData = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 };
    filteredDataset.forEach((t) => {
      const p = (t['Priority'] || 'Medium').trim();
      if (counts[p] !== undefined) counts[p]++;
      else counts['Medium']++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredDataset]);

  // SLA TAT Compliance
  const slaComplianceData = useMemo(() => {
    let within = 0;
    let breached = 0;
    filteredDataset.forEach((t) => {
      const tat = String(t['is On TAT'] || 'Yes').trim().toLowerCase();
      if (tat === 'no' || tat === '0') breached++;
      else within++;
    });
    return [
      { name: 'Within SLA (On TAT)', value: within, color: '#10b981' },
      { name: 'Breached SLA (Delayed)', value: breached, color: '#ef4444' },
    ];
  }, [filteredDataset]);

  // Top Ticket Raisers Across All Tickets (Used in Visual 11)
  const topRaisersData = useMemo(() => {
    const raiserCounts = {};
    filteredDataset.forEach((t) => {
      const raiser = (t['Employee Name '] || 'Unassigned').trim();
      if (raiser && raiser.toLowerCase() !== 'unassigned') {
        raiserCounts[raiser] = (raiserCounts[raiser] || 0) + 1;
      }
    });

    return Object.entries(raiserCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([fullName, count]) => ({
        fullName,
        shortName:
          fullName.replace(/CBRE|Infra/gi, '').trim().slice(0, 12) || fullName.slice(0, 12),
        count,
      }));
  }, [filteredDataset]);
  const topEngineersData = topRaisersData; // alias for backwards compatibility

  // =========================================================================
  // DEEP REACTIVE TICKETS DRILL-DOWN INTELLIGENCE
  // =========================================================================
  const reactiveAnalytics = useMemo(() => {
    const reactiveTickets = filteredDataset.filter(
      (t) => (t['Call type'] || '').trim().toLowerCase() === 'reactive'
    );

    const totalReactive = reactiveTickets.length;
    let resolvedReactive = 0;
    let breachedReactive = 0;

    const catCounts = {};
    const siteCounts = {};
    const channelCounts = {};
    const monthCounts = {};
    const issueCounts = {};
    const raiserCounts = {};
    const hourCounts = {};

    reactiveTickets.forEach((t) => {
      const s = (t['Status '] || '').trim().toLowerCase();
      const tat = String(t['is On TAT'] || 'Yes').trim().toLowerCase();
      const cat = (t['Request category'] || 'Other').trim();
      const site = (t['Site '] || 'Unknown').trim();
      const channel = (t['Request Via '] || 'In person').trim();
      const m = (t['Month '] || '').trim();
      const desc = (t['Discription '] || '').trim();
      const raiser = (t['Employee Name '] || 'Unassigned').trim();
      const repTime = (t['Report Time'] || '').trim();

      if (s === 'resolved' || s === 'closed') resolvedReactive++;
      if (tat === 'no' || tat === '0') breachedReactive++;

      catCounts[cat] = (catCounts[cat] || 0) + 1;
      siteCounts[site] = (siteCounts[site] || 0) + 1;
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
      if (m) monthCounts[m] = (monthCounts[m] || 0) + 1;

      if (desc) {
        // Clean problem statement for grouping
        const cleaned = desc.replace(/\s+/g, ' ').trim().slice(0, 40);
        issueCounts[cleaned] = (issueCounts[cleaned] || 0) + 1;
      }

      if (raiser) {
        raiserCounts[raiser] = (raiserCounts[raiser] || 0) + 1;
      }

      // Hour breakdown (e.g. 08:30 -> 08:00)
      if (repTime && repTime.includes(':')) {
        const hour = repTime.split(':')[0] + ':00';
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    // 1. Reactive by Category
    const categoryData = Object.entries(catCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // 2. Reactive by Site / Floor
    const siteData = Object.entries(siteCounts)
      .map(([name, count]) => ({
        name,
        count,
        percent: totalReactive > 0 ? Math.round((count / totalReactive) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // 3. Reactive Monthly Trend
    const monthlyData = Object.entries(monthCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => compareMonthsChronologically(a.name, b.name));

    // 4. Reactive Channels (Request Via)
    const channelData = Object.entries(channelCounts)
      .map(([name, value]) => ({ name, value }));

    // 5. Top 8 Recurring Reactive Complaints
    const topIssues = Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // 6. Top Ticket Raisers on Reactive Calls
    const topRaisers = Object.entries(raiserCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        name: name.replace('CBRE', '').replace('Infra', '').trim() || name,
        fullName: name,
        count,
      }));

    // 7. Hourly Distribution
    const hourlyData = Object.keys(hourCounts)
      .sort()
      .slice(0, 10)
      .map((hr) => ({ hour: hr, count: hourCounts[hr] }));

    const resolutionRate =
      totalReactive > 0 ? Math.round((resolvedReactive / totalReactive) * 100) : 0;
    const tatCompliance =
      totalReactive > 0
        ? Math.round(((totalReactive - breachedReactive) / totalReactive) * 100)
        : 100;

    return {
      totalReactive,
      resolvedReactive,
      breachedReactive,
      resolutionRate,
      tatCompliance,
      categoryData,
      siteData,
      monthlyData,
      channelData,
      topIssues,
      topRaisers,
      topEngineers: topRaisers, // alias for backwards compatibility
      hourlyData,
    };
  }, [filteredDataset]);

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-100 p-4 sm:p-6 space-y-6 transition-all">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ========================================================================= */}
        {/* 1. TOP PROMINENT 2025 vs 2026 YEAR TOGGLE (CONNECTS TO ALL DATA) */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
                <Activity className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Operations & Reactive Analytics Hub
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Toggle year section below to switch all charts, drill-downs, and table data
            </p>
          </div>

          {/* TWO SECTION TOGGLE: 2026 (CURRENT) vs 2025 (HISTORICAL) */}
          <div className="inline-flex p-1.5 bg-slate-800/90 rounded-2xl border border-slate-700 shadow-inner self-start md:self-auto">
            {/* 2026 Section Button */}
            <button
              type="button"
              onClick={() => handleYearToggle('2026')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-all ${
                activeYear === '2026'
                  ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  activeYear === '2026' ? 'bg-white animate-pulse' : 'bg-emerald-400'
                }`}
              ></span>
              <div className="text-left">
                <div className="leading-none">FY 2025-26 (2026)</div>
                <div
                  className={`text-[10px] font-normal mt-0.5 ${
                    activeYear === '2026' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  Current Year ({count2026} tickets)
                </div>
              </div>
            </button>

            {/* 2025 Section Button */}
            <button
              type="button"
              onClick={() => handleYearToggle('2025')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-all ${
                activeYear === '2025'
                  ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  activeYear === '2025' ? 'bg-white' : 'bg-blue-400'
                }`}
              ></span>
              <div className="text-left">
                <div className="leading-none">FY 2024-25 (2025)</div>
                <div
                  className={`text-[10px] font-normal mt-0.5 ${
                    activeYear === '2025' ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  Historical Baseline ({count2025} tickets)
                </div>
              </div>
            </button>

            {/* All Years Button */}
            <button
              type="button"
              onClick={() => handleYearToggle('all')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-all ${
                activeYear === 'all'
                  ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  activeYear === 'all' ? 'bg-white' : 'bg-indigo-400'
                }`}
              ></span>
              <div className="text-left">
                <div className="leading-none">All Records</div>
                <div
                  className={`text-[10px] font-normal mt-0.5 ${
                    activeYear === 'all' ? 'text-indigo-100' : 'text-slate-400'
                  }`}
                >
                  Combined ({cleanTickets.length} tickets)
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. ANALYTICS FILTER BAR */}
        {/* ========================================================================= */}
        <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Active Year: {activeYear} Filters
              </span>
              {activeFilterCount > 0 && (
                <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {activeFilterCount} active
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleDrilldown({ type: 'all' })}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  title="Open filtered tickets directly in Tracker Grid"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View {filteredDataset.length} in Grid</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-slate-400 hover:text-rose-400 font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700/60 hover:border-rose-500/50 transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* Floor / Site */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Floor / Site
              </label>
              <select
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Sites</option>
                <option value="DT3">DT3</option>
                <option value="DT4 L1">DT4 L1</option>
                <option value="DT4 L4">DT4 L4</option>
                <option value="DT4 L5">DT4 L5</option>
                <option value="DT4 L6">DT4 L6</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Call Type */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Call Type
              </label>
              <select
                value={callTypeFilter}
                onChange={(e) => setCallTypeFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Call Types</option>
                <option value="Reactive">Reactive (Complaints)</option>
                <option value="Proactive">Proactive (Walkthrough)</option>
              </select>
            </div>

            {/* Request Via */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Request Via
              </label>
              <select
                value={requestViaFilter}
                onChange={(e) => setRequestViaFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Channels</option>
                <option value="In person">In person</option>
                <option value="Phone">Phone</option>
                <option value="Mail">Mail</option>
                <option value="Feedback Form">Feedback Form</option>
              </select>
            </div>

            {/* Month */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Month
              </label>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:ring-1 focus:ring-indigo-500 font-mono"
              >
                <option value="all">All Months</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="Resolved">Resolved</option>
                <option value="Not Resolved">Not Resolved</option>
                <option value="In-Progress">In-Progress</option>
                <option value="Open">Open</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. EXECUTIVE KPIS (CLICKABLE -> OPENS TRACKER GRID PRE-FILTERED) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Tickets */}
          <div
            onClick={() => handleDrilldown({ type: 'all', label: `Total Volume (${activeYear})` })}
            className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 shadow-sm cursor-pointer hover:border-indigo-500 hover:bg-slate-800 transition group"
            title="Click to view all filtered tickets in Tracker Grid"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Volume
              </span>
              <Inbox className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-white">
                {overallMetrics.total}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-indigo-400 flex items-center gap-1 group-hover:underline">
              <span>Open in Tracker</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 2: PENDING REQUESTS (Highlighted with Urgent Pulse Alert) */}
          <div
            onClick={() =>
              handleDrilldown({
                type: 'pending',
                label: `Pending Requests (${activeYear})`,
              })
            }
            className="bg-gradient-to-br from-rose-950/60 to-slate-800/90 rounded-2xl p-4 border-2 border-rose-500/50 shadow-sm cursor-pointer hover:border-rose-400 hover:shadow-rose-900/20 transition group"
            title="Click to view Pending tickets in Tracker Grid"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                Pending Requests
              </span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-rose-400">
                {overallMetrics.pendingTotal}
              </span>
              <span className="text-xs text-rose-300/80">
                ({overallMetrics.total > 0 ? Math.round((overallMetrics.pendingTotal / overallMetrics.total) * 100) : 0}%)
              </span>
            </div>
            <div className="mt-2 text-[10px] text-rose-300 flex items-center gap-1 font-semibold group-hover:underline">
              <span>View Backlog in Tracker</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 3: Reactive Complaints */}
          <div
            onClick={() =>
              handleDrilldown({
                type: 'callType',
                value: 'Reactive',
                label: 'Reactive Complaints',
              })
            }
            className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 shadow-sm cursor-pointer hover:border-amber-500 transition group"
            title="Click to view Reactive complaints in Tracker Grid"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                Reactive
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-amber-400">
                {overallMetrics.reactive}
              </span>
              <span className="text-xs text-amber-200/70">({overallMetrics.reactiveRate}%)</span>
            </div>
            <div className="mt-2 text-[10px] text-amber-400 flex items-center gap-1 group-hover:underline">
              <span>Open in Tracker</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 4: Proactive Walkthroughs */}
          <div
            onClick={() =>
              handleDrilldown({
                type: 'callType',
                value: 'Proactive',
                label: 'Proactive Walkthroughs',
              })
            }
            className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 shadow-sm cursor-pointer hover:border-emerald-500 transition group"
            title="Click to view Proactive tickets in Tracker Grid"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Proactive
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-400">
                {overallMetrics.proactive}
              </span>
              <span className="text-xs text-emerald-200/70">({overallMetrics.proactiveRate}%)</span>
            </div>
            <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1 group-hover:underline">
              <span>Open in Tracker</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 5: Resolved Rate */}
          <div
            onClick={() =>
              handleDrilldown({
                type: 'status',
                value: 'Resolved',
                label: 'Resolved Tickets',
              })
            }
            className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 shadow-sm cursor-pointer hover:border-emerald-500 transition group"
            title="Click to view Resolved tickets in Tracker Grid"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Resolved
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-400">
                {overallMetrics.resolved}
              </span>
              <span className="text-xs text-emerald-400 font-semibold">
                ({overallMetrics.resolutionRate}%)
              </span>
            </div>
            <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1 group-hover:underline">
              <span>Open in Tracker</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 6: SLA TAT Compliance */}
          <div
            onClick={() =>
              handleDrilldown({
                type: 'tat',
                value: 'No',
                label: 'Breached SLA / TAT Tickets',
              })
            }
            className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 shadow-sm cursor-pointer hover:border-rose-500 transition group"
            title="Click to view Breached SLA tickets in Tracker Grid"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                SLA (TAT)
              </span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-indigo-400">
                {overallMetrics.tatCompliance}%
              </span>
              {overallMetrics.tatBreached > 0 && (
                <span className="text-[11px] text-rose-400 font-medium">
                  ({overallMetrics.tatBreached} delayed)
                </span>
              )}
            </div>
            <div className="mt-2 text-[10px] text-rose-400 flex items-center gap-1 group-hover:underline">
              <span>Inspect Breaches</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. DEDICATED PENDING REQUESTS & BACKLOG CENTER */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-br from-slate-900 via-rose-950/20 to-slate-900 rounded-3xl border-2 border-rose-500/40 p-5 sm:p-6 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-rose-500/30">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-inner">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Pending Requests & Backlog Operations ({activeYear})
                  </h3>
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {pendingAnalytics.total} Action Items Awaiting Resolution
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Detailed breakdown of active open tickets across categories, floor locations, and priorities
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                handleDrilldown({
                  type: 'pending',
                  label: 'Pending Requests Backlog',
                })
              }
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
            >
              <span>View All {pendingAnalytics.total} Pending in Tracker</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Pending by Category */}
            <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-rose-400" />
                  Pending by Category
                </h4>
                <span className="text-[10px] text-slate-400">Click bar to filter</span>
              </div>
              <div className="h-52 w-full">
                {pendingAnalytics.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={pendingAnalytics.byCategory}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                      <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '11px',
                        }}
                      />
                      <Bar
                        dataKey="count"
                        radius={[6, 6, 0, 0]}
                        onClick={(entry) =>
                          handleDrilldown({
                            type: 'compound',
                            filters: { category: entry.name, isPending: true },
                            label: `Pending Category: ${entry.name}`,
                          })
                        }
                        className="cursor-pointer"
                      >
                        {pendingAnalytics.byCategory.map((_, idx) => (
                          <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-emerald-400 font-semibold">
                    No pending tickets! Zero backlog.
                  </div>
                )}
              </div>
            </div>

            {/* Pending by Floor / Site */}
            <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  Pending by Floor / Site
                </h4>
                <span className="text-[10px] text-slate-400">Click to filter</span>
              </div>
              <div className="space-y-2.5 pt-2 max-h-52 overflow-y-auto pr-1">
                {pendingAnalytics.bySite.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() =>
                      handleDrilldown({
                        type: 'compound',
                        filters: { site: item.name, isPending: true },
                        label: `Pending at Site: ${item.name}`,
                      })
                    }
                    className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 hover:border-indigo-500 cursor-pointer transition flex items-center justify-between"
                  >
                    <span className="text-xs font-semibold text-slate-200">{item.name}</span>
                    <span className="text-xs font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-800/60">
                      {item.count} pending
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Status Breakdown */}
            <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Pending Status Breakdown
                </h4>
                <span className="text-[10px] text-slate-400">Click to filter</span>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pendingAnalytics.byStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={55}
                      paddingAngle={4}
                      dataKey="value"
                      onClick={(entry) =>
                        handleDrilldown({
                          type: 'status',
                          value: entry.name,
                          label: `Status: ${entry.name}`,
                        })
                      }
                      className="cursor-pointer"
                    >
                      {pendingAnalytics.byStatus.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={STATUS_COLORS[entry.name] || CATEGORY_COLORS[idx]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={20}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Actionable Pending Tickets Quick Table */}
          {pendingAnalytics.topPendingList.length > 0 && (
            <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Actionable Pending Tickets ({pendingAnalytics.topPendingList.length} shown)
                </h4>
                <span className="text-[11px] text-indigo-400 font-semibold">
                  Click any row or button to jump directly into the ticket in Tracker
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Sr no.</th>
                      <th className="py-2.5 px-3">Site / Floor</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {pendingAnalytics.topPendingList.map((t, idx) => (
                      <tr
                        key={t.id || idx}
                        onClick={() =>
                          handleDrilldown({
                            type: 'ticketId',
                            value: t.id || t['Sr no.'],
                            label: `Ticket #${t['Sr no.']}`,
                          })
                        }
                        className="hover:bg-slate-700/50 cursor-pointer transition"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">
                          #{t['Sr no.']}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">{t['Site ']}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-[11px] border border-slate-700">
                            {t['Request category']}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-xs truncate" title={t['Discription ']}>
                          {t['Discription '] || 'No description'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t['Priority'] === 'High'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : t['Priority'] === 'Low'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {t['Priority'] || 'Medium'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            {t['Status '] || 'Open'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDrilldown({
                                type: 'ticketId',
                                value: t.id || t['Sr no.'],
                                label: `Ticket #${t['Sr no.']}`,
                              });
                            }}
                            className="p-1 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold inline-flex items-center gap-1 shadow"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 5. ALL DATA VISUALS MATCHING DASHBOARD EXCEL SHEET */}
        {/* ========================================================================= */}
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Excel Dashboard Visualizations (HELP DESK TRACKER FY 25-26)
            </h3>
            <span className="text-xs text-indigo-400">Click any chart bar or slice to view tickets</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Visual 1 (Excel Chart 1): Request Category Month Wise */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    Request Category Month Wise (Excel Chart 1)
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Monthly distribution by department (Click category bar to inspect)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleDrilldown({
                      type: 'all',
                      value: 'all',
                      label: 'All Category Breakdown',
                    })
                  }
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <span>Tracker</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-64 w-full">
                {categoryMonthWiseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryMonthWiseData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '11px',
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={30}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '10px' }}
                      />
                      <Bar
                        dataKey="Housekeeping"
                        stackId="a"
                        fill="#6366f1"
                        onClick={() =>
                          handleDrilldown({
                            type: 'category',
                            value: 'Housekeeping',
                            label: 'Category: Housekeeping',
                          })
                        }
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="HVAC"
                        stackId="a"
                        fill="#06b6d4"
                        onClick={() =>
                          handleDrilldown({
                            type: 'category',
                            value: 'HVAC',
                            label: 'Category: HVAC',
                          })
                        }
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="E&M"
                        stackId="a"
                        fill="#10b981"
                        onClick={() =>
                          handleDrilldown({
                            type: 'category',
                            value: 'E&M',
                            label: 'Category: E&M',
                          })
                        }
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="EMPLOYEE ACCESS"
                        stackId="a"
                        fill="#f59e0b"
                        onClick={() =>
                          handleDrilldown({
                            type: 'category',
                            value: 'EMPLOYEE ACCESS',
                            label: 'Category: EMPLOYEE ACCESS',
                          })
                        }
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="Event"
                        stackId="a"
                        fill="#ec4899"
                        onClick={() =>
                          handleDrilldown({
                            type: 'category',
                            value: 'Event',
                            label: 'Category: Event',
                          })
                        }
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="F&B"
                        stackId="a"
                        fill="#f97316"
                        onClick={() =>
                          handleDrilldown({
                            type: 'category',
                            value: 'F&B',
                            label: 'Category: F&B',
                          })
                        }
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="Locker request"
                        stackId="a"
                        fill="#8b5cf6"
                        onClick={() =>
                          handleDrilldown({
                            type: 'category',
                            value: 'Locker request',
                            label: 'Category: Locker request',
                          })
                        }
                        className="cursor-pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No data found
                  </div>
                )}
              </div>
            </div>

            {/* Visual 2 (Excel Chart 2): Count of Request by Site and Type */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    Count of Request by Site and Type (Excel Chart 2)
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Proactive Walkthroughs vs Reactive Complaints by Floor
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleDrilldown({
                      type: 'callType',
                      value: 'Reactive',
                      label: 'Reactive Complaints',
                    })
                  }
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <span>Filter Reactive</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={siteAndTypeData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="site" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={30}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px' }}
                    />
                    <Bar
                      dataKey="Proactive"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      onClick={(entry) =>
                        handleDrilldown({
                          type: 'siteAndType',
                          value: { site: entry.site, callType: 'Proactive' },
                          label: `${entry.site} - Proactive Walkthroughs`,
                        })
                      }
                      className="cursor-pointer"
                    />
                    <Bar
                      dataKey="Reactive"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      onClick={(entry) =>
                        handleDrilldown({
                          type: 'siteAndType',
                          value: { site: entry.site, callType: 'Reactive' },
                          label: `${entry.site} - Reactive Complaints`,
                        })
                      }
                      className="cursor-pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Visual 3 (Excel Chart 3): Monthwise Request Count */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                    Monthwise Request Count (Excel Chart 3)
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Overall monthly inflow volume trend
                  </p>
                </div>
              </div>

              <div className="h-56 w-full">
                {monthwiseTotalData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={monthwiseTotalData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={(e) => {
                        if (e && e.activeLabel) {
                          handleDrilldown({
                            type: 'month',
                            value: e.activeLabel,
                            label: `Month: ${e.activeLabel}`,
                          });
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '11px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorTotal)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No data found
                  </div>
                )}
              </div>
            </div>

            {/* Visual 4 (Excel Chart 4): Monthwise Requests by Channel */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                    Monthwise Channel Inflow (Excel Chart 4)
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Requests logged In person, Mail, Phone, Feedback Form
                  </p>
                </div>
              </div>

              <div className="h-56 w-full">
                {monthwiseChannelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthwiseChannelData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '11px',
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={25}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '10px' }}
                      />
                      <Bar
                        dataKey="In person"
                        fill="#3b82f6"
                        stackId="ch"
                        onClick={() =>
                          handleDrilldown({
                            type: 'channel',
                            value: 'In person',
                            label: 'Channel: In person',
                          })
                        }
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="Mail"
                        fill="#8b5cf6"
                        stackId="ch"
                        onClick={() =>
                          handleDrilldown({
                            type: 'channel',
                            value: 'Mail',
                            label: 'Channel: Mail',
                          })
                        }
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="Phone"
                        fill="#10b981"
                        stackId="ch"
                        onClick={() =>
                          handleDrilldown({
                            type: 'channel',
                            value: 'Phone',
                            label: 'Channel: Phone',
                          })
                        }
                        className="cursor-pointer"
                      />
                      <Bar
                        dataKey="Feedback Form"
                        fill="#f59e0b"
                        stackId="ch"
                        onClick={() =>
                          handleDrilldown({
                            type: 'channel',
                            value: 'Feedback Form',
                            label: 'Channel: Feedback Form',
                          })
                        }
                        className="cursor-pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No channel data
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. HELPDESK SUMMARY SHEET VISUALS */}
        {/* ========================================================================= */}
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-emerald-400" />
              Helpdesk Summary Distributions (From Summary Sheet in Excel)
            </h3>
            <span className="text-xs text-slate-400">Interactive Category, Floor & Channel Splits</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Visual 5 (Excel Chart 5): Category Distribution */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  Category Distribution (Chart 5)
                </h4>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                      onClick={(entry) =>
                        handleDrilldown({
                          type: 'category',
                          value: entry.name,
                          label: `Category: ${entry.name}`,
                        })
                      }
                      className="cursor-pointer"
                    >
                      {categoryDistributionData.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                      formatter={(val, name, item) => [
                        `${val} tickets (${item.payload.percentage}%)`,
                        name,
                      ]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={20}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Visual 6 (Excel Chart 6): Site / Floor Density */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  Site / Floor Share (Chart 6)
                </h4>
              </div>
              <div className="space-y-2 pt-2 max-h-52 overflow-y-auto pr-1">
                {siteDistributionData.map((site, idx) => (
                  <div
                    key={idx}
                    onClick={() =>
                      handleDrilldown({
                        type: 'site',
                        value: site.name,
                        label: `Site / Floor: ${site.name}`,
                      })
                    }
                    className="p-2 rounded-xl bg-slate-900/70 border border-slate-700/60 hover:border-cyan-500 cursor-pointer transition space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{site.name}</span>
                      <span className="text-slate-400 font-mono">
                        {site.count} tickets ({site.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-cyan-500 h-1.5 rounded-full"
                        style={{ width: `${site.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual 7 (Excel Chart 7): Channel Inflow Share */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                  Channel Share (Chart 7)
                </h4>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                      onClick={(entry) =>
                        handleDrilldown({
                          type: 'channel',
                          value: entry.name,
                          label: `Channel: ${entry.name}`,
                        })
                      }
                      className="cursor-pointer"
                    >
                      {channelDistributionData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={CHANNEL_COLORS[entry.name] || CATEGORY_COLORS[idx]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                      formatter={(val, name, item) => [
                        `${val} tickets (${item.payload.percentage}%)`,
                        name,
                      ]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={20}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Visual 8: Ticket Status Month-Wise (Helpdesk Summary sheet 68-87) */}
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Ticket Status Month-Wise (Resolved vs Pending / Open)
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Monthly track of completed resolution vs remaining tickets
                </p>
              </div>
            </div>

            <div className="h-52 w-full">
              {statusMonthWiseData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusMonthWiseData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={25}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px' }}
                    />
                    <Bar
                      dataKey="Resolved"
                      fill="#10b981"
                      stackId="st"
                      onClick={() =>
                        handleDrilldown({
                          type: 'status',
                          value: 'Resolved',
                          label: 'Status: Resolved Tickets',
                        })
                      }
                      className="cursor-pointer"
                    />
                    <Bar
                      dataKey="Pending"
                      fill="#ef4444"
                      stackId="st"
                      onClick={() =>
                        handleDrilldown({
                          type: 'pending',
                          value: ['Open', 'Not Resolved', 'In-Progress'],
                          label: 'Status: Pending / Unresolved',
                        })
                      }
                      className="cursor-pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No monthly status data
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 7. MORE VISUALS: SLA COMPLIANCE, PRIORITY & TOP TICKET RAISERS */}
        {/* ========================================================================= */}
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Operational Performance & SLA Compliance Intelligence
            </h3>
            <span className="text-xs text-slate-400">Click any chart item to view data</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Visual 9: Priority Severity */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                Priority Severity Split
              </h4>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={55}
                      paddingAngle={4}
                      dataKey="value"
                      onClick={(entry) =>
                        handleDrilldown({
                          type: 'priority',
                          value: entry.name,
                          label: `Priority: ${entry.name}`,
                        })
                      }
                      className="cursor-pointer"
                    >
                      {priorityDistributionData.map((entry, idx) => (
                        <Cell key={idx} fill={PRIORITY_COLORS[entry.name] || '#3b82f6'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={20}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Visual 10: SLA TAT Compliance */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                SLA / TAT On-Time Compliance
              </h4>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slaComplianceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={55}
                      paddingAngle={4}
                      dataKey="value"
                      onClick={(entry) => {
                        const isBreached = entry.name.includes('Breached');
                        handleDrilldown({
                          type: 'tat',
                          value: isBreached ? 'No' : 'Yes',
                          label: isBreached ? 'Breached SLA / TAT Tickets' : 'On-Time SLA / TAT Tickets',
                        });
                      }}
                      className="cursor-pointer"
                    >
                      {slaComplianceData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={20}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Visual 11: Top Ticket Raisers (Logged By) */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  Top Ticket Raisers (Logged By)
                </h4>
                <span className="text-[10px] text-slate-400">Tickets Logged</span>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topRaisersData}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                    <YAxis dataKey="shortName" type="category" stroke="#94a3b8" fontSize={10} width={65} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                      }}
                      formatter={(val, _, item) => [`${val} tickets raised`, `Raised by: ${item.payload.fullName}`]}
                    />
                    <Bar
                      dataKey="count"
                      fill="#8b5cf6"
                      radius={[0, 6, 6, 0]}
                      onClick={(entry) =>
                        handleDrilldown({
                          type: 'raiser',
                          value: entry.fullName,
                          label: `Raised By: ${entry.fullName}`,
                        })
                      }
                      className="cursor-pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 8. YEAR-OVER-YEAR (YOY) 2026 vs 2025 COMPARISON CARD */}
        {/* ========================================================================= */}
        <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Year-over-Year Snapshot (2026 vs 2025)
            </span>
            <p className="text-[11px] text-slate-400">
              Comparing current FY 25-26 operational metrics against FY 24-25 baseline
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <div className="bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-slate-400">2026 Volume:</span>{' '}
              <strong className="text-emerald-400">{count2026}</strong>
            </div>
            <div className="bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-slate-400">2025 Volume:</span>{' '}
              <strong className="text-blue-400">{count2025}</strong>
            </div>
            <button
              onClick={() => handleYearToggle(activeYear === '2026' ? '2025' : '2026')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
            >
              Switch to {activeYear === '2026' ? '2025' : '2026'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
