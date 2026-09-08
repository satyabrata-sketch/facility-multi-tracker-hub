import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from './components/Navbar';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import TicketGrid from './components/TicketGrid';
import TicketPage from './components/TicketPage';
import ImportModal from './components/ImportModal';
import AuthModal from './components/AuthModal';
import FirebaseConfigModal from './components/FirebaseConfigModal';
import ConfirmModal from './components/ConfirmModal';
import ErrorBoundary from './components/ErrorBoundary';
import UserManagementModal from './components/UserManagementModal';
import UserManagementView from './components/UserManagementView';
import {
  subscribeTickets,
  addTicket,
  updateTicket,
  deleteTicket,
  bulkDeleteTickets,
  bulkUpdateStatus,
} from './services/ticketService';
import { subscribeAuth, logoutUser } from './firebase/authService';
import {
  detectTicketYear,
  isInvalidPivotOrSummaryRow,
  sanitizeSiteValue,
  VALID_REQUEST_CATEGORIES,
  getCurrentShortMonth,
} from './utils/schema';
import {
  formatShortMonth,
  formatTatValue,
  exportTicketsToExcel,
} from './utils/excelHelper';
import { Loader2, Plus, Upload, Download, BarChart3, FileSpreadsheet } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker' | 'analytics'
  const [selectedYear, setSelectedYear] = useState('all'); // Show ALL imported tickets by default!
  const [activeVisualFilter, setActiveVisualFilter] = useState(null); // { type, value, label }

  // View Mode: 'grid' (main screen) | 'ticketPage' (dedicated full-page creation/edit)
  const [currentView, setCurrentView] = useState('grid');
  const [editingTicket, setEditingTicket] = useState(null);

  // Modals state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    confirmVariant: 'danger',
    onConfirm: () => {},
  });

  // Subscribe to Auth
  useEffect(() => {
    const unsubscribe = subscribeAuth((currUser) => {
      setUser(currUser);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Realtime Tickets
  useEffect(() => {
    setLoading(true);

    const unsubscribe = subscribeTickets(
      (loadedTickets) => {
        // 1. Strictly purge all invalid pivot/summary noise rows!
        const validTickets = loadedTickets.filter((t) => !isInvalidPivotOrSummaryRow(t));

        // 2. Tag year and normalize short month + Yes/No TAT + sanitize Site & Category
        const formatted = validTickets.map((t) => {
          t.year = detectTicketYear(t);
          t['Month '] = formatShortMonth(t['Month '], t.year === '2025' ? '25' : '26');
          t['is On TAT'] = formatTatValue(t['is On TAT']);

          // Sanitize Site: ensure Site is strictly one of the 5 valid facility locations
          let site = String(t['Site '] || t['Site'] || '').trim();
          let cat = String(t['Request category'] || '').trim();

          if (VALID_REQUEST_CATEGORIES.includes(site)) {
            if (!cat) cat = site;
            site = 'DT3';
          } else {
            site = sanitizeSiteValue(site);
          }

          t['Site '] = site;
          t['Request category'] = cat || 'Housekeeping';
          return t;
        });

        // SORT ASCENDING BY SR NO: Sr no 1 must show from the beginning!
        const sorted = [...formatted].sort((a, b) => {
          const srA = parseInt(a['Sr no.'], 10) || 0;
          const srB = parseInt(b['Sr no.'], 10) || 0;
          if (srA !== srB) {
            if (!srA) return 1;
            if (!srB) return -1;
            return srA - srB;
          }
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        });

        setTickets(sorted);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load tickets:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filter tickets by selected year AND active interactive visual filter
  const displayTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (selectedYear !== 'all') {
        const yr = detectTicketYear(t);
        if (yr !== selectedYear) return false;
      }

      if (!activeVisualFilter) return true;

      const { type, value } = activeVisualFilter;

      if (type === 'pending') {
        const s = (t['Status '] || 'Open').trim().toLowerCase();
        return s !== 'resolved' && s !== 'closed';
      }
      if (type === 'category') {
        return (t['Request category'] || '').trim().toLowerCase() === String(value).trim().toLowerCase();
      }
      if (type === 'site') {
        return (t['Site '] || '').trim().toLowerCase() === String(value).trim().toLowerCase();
      }
      if (type === 'callType') {
        return (t['Call type'] || '').trim().toLowerCase() === String(value).trim().toLowerCase();
      }
      if (type === 'status') {
        return (t['Status '] || '').trim().toLowerCase() === String(value).trim().toLowerCase();
      }
      if (type === 'channel') {
        return (t['Request Via '] || '').trim().toLowerCase() === String(value).trim().toLowerCase();
      }
      if (type === 'month') {
        return (t['Month '] || '').trim().toLowerCase() === String(value).trim().toLowerCase();
      }
      if (type === 'tat') {
        const tat = String(t['is On TAT'] || 'Yes').trim().toLowerCase();
        if (value === 'breached' || value === 'No') {
          return tat === 'no' || tat === '0';
        }
        return tat === 'yes' || tat === '1';
      }
      if (type === 'priority') {
        return (t['Priority'] || 'Medium').trim().toLowerCase() === String(value).trim().toLowerCase();
      }
      if (type === 'engineer' || type === 'raiser') {
        return (t['Employee Name '] || '').trim().toLowerCase().includes(String(value).trim().toLowerCase());
      }
      if (type === 'ticketId') {
        return t.id === value || String(t['Sr no.']) === String(value);
      }
      if (type === 'siteAndType') {
        // value: { site, callType }
        const sMatch = (t['Site '] || '').trim().toLowerCase() === String(value.site).trim().toLowerCase();
        const cMatch = (t['Call type'] || '').trim().toLowerCase() === String(value.callType).trim().toLowerCase();
        return sMatch && cMatch;
      }
      return true;
    });
  }, [tickets, selectedYear, activeVisualFilter]);

  // Add or Update Ticket
  const handleSaveTicket = async (ticketData) => {
    const userEmail = user ? user.email : 'user@cbre.com';
    try {
      if (!ticketData.year) {
        ticketData.year = selectedYear === 'all' ? '2026' : selectedYear;
      }
      ticketData['Month '] = formatShortMonth(ticketData['Month '], ticketData.year === '2025' ? '25' : '26');
      ticketData['is On TAT'] = formatTatValue(ticketData['is On TAT']);

      if (editingTicket && editingTicket.id) {
        setTickets((prev) =>
          prev.map((t) => (t.id === editingTicket.id ? { ...t, ...ticketData } : t))
        );
        await updateTicket(editingTicket.id, ticketData, userEmail);
      } else {
        if (!ticketData['Sr no.']) {
          const maxSr = tickets.reduce((max, t) => {
            const num = parseInt(t['Sr no.']) || 0;
            return num > max ? num : max;
          }, 0);
          ticketData['Sr no.'] = String(maxSr + 1);
        }
        const created = await addTicket(ticketData, userEmail);
        if (created) {
          setTickets((prev) => [created, ...prev]);
        }
      }
      setCurrentView('grid');
    } catch (err) {
      console.error('Error saving ticket:', err);
      alert('Failed to save ticket: ' + err.message);
    }
  };

  // Inline Cell Update from AG Grid
  // Inline Cell Update from AG Grid
  const handleInlineUpdate = useCallback(async (id, updatedFields, rowData) => {
    const userEmail = user ? user.email : 'colleague@cbre.com';
    const targetId = id || rowData?.id || (rowData?.['Sr no.'] ? String(rowData['Sr no.']) : null);
    if (updatedFields['Month ']) {
      updatedFields['Month '] = formatShortMonth(updatedFields['Month ']);
    }
    if (updatedFields['is On TAT']) {
      updatedFields['is On TAT'] = formatTatValue(updatedFields['is On TAT']);
    }
    if (updatedFields['Site ']) {
      updatedFields['Site '] = sanitizeSiteValue(updatedFields['Site ']);
    }
    setTickets((prev) =>
      prev.map((t) => {
        const match =
          (targetId && t.id && String(t.id) === String(targetId)) ||
          (targetId && t['Sr no.'] && String(t['Sr no.']) === String(targetId));
        return match ? { ...t, ...updatedFields } : t;
      })
    );
    return await updateTicket(targetId, updatedFields, userEmail);
  }, [user]);

  // Direct In-Grid Row Insertion
  const handleInsertDirectRow = useCallback(async () => {
    const userEmail = user ? user.email : 'colleague@cbre.com';
    let maxSr = 0;
    tickets.forEach((t) => {
      const num = parseInt(t['Sr no.'], 10) || 0;
      if (num > maxSr) maxSr = num;
    });

    const now = new Date();
    const curYear = selectedYear === 'all' ? '2026' : selectedYear;
    const shortMonth = getCurrentShortMonth();

    const newTicket = {
      id: `sr-${maxSr + 1}`,
      'Sr no.': String(maxSr + 1),
      'Site ': 'DT3',
      'Zone': 'Zone A',
      'Location': 'Workstation',
      'Month ': shortMonth,
      'Date ': now.toISOString().split('T')[0],
      'Report Time': now.toLocaleTimeString('en-GB'),
      'Request category': 'Housekeeping',
      'Employee Name ': '',
      'Request Via ': 'In person',
      'Discription ': '',
      'Action Taken ': '',
      'Date close ': '',
      'Resolved time': '',
      'Status ': 'Open',
      'Request from ': 'Employee',
      'Call type': 'Reactive',
      'Remark': '',
      'is On TAT': 'Yes',
      'Priority': 'Medium',
      year: curYear,
    };

    const created = await addTicket(newTicket, userEmail);
    if (created) {
      setTickets((prev) => [created, ...prev]);
    }
    return created ? created.id : null;
  }, [user, selectedYear, tickets]);

  const handleOpenEditPage = useCallback((ticket) => {
    setEditingTicket(ticket);
    setCurrentView('ticketPage');
  }, []);

  const handleOpenCreatePage = useCallback(() => {
    setEditingTicket(null);
    setCurrentView('ticketPage');
  }, []);

  const handleDeleteTicket = useCallback((ticket) => {
    if (!ticket) return;
    const targetId = ticket.id || (ticket['Sr no.'] ? String(ticket['Sr no.']) : '');
    const srNo = ticket['Sr no.'] ? String(ticket['Sr no.']) : '';

    setConfirmModal({
      isOpen: true,
      title: `Delete Ticket #${srNo || targetId}?`,
      message: `Are you sure you want to delete this ticket (${ticket['Discription '] || 'No description'})? This action cannot be undone.`,
      confirmText: 'Delete Ticket',
      confirmVariant: 'danger',
      onConfirm: async () => {
        // Instant optimistic removal from UI
        setTickets((prev) =>
          prev.filter((t) => {
            if (ticket.id && t.id && String(t.id) === String(ticket.id)) return false;
            if (srNo && t['Sr no.'] && String(t['Sr no.']) === srNo) return false;
            if (targetId && t.id && String(t.id) === String(targetId)) return false;
            if (targetId && t['Sr no.'] && String(t['Sr no.']) === String(targetId)) return false;
            return true;
          })
        );
        try {
          await deleteTicket(ticket.id, srNo);
        } catch (err) {
          console.warn('Delete notice:', err);
        }
      },
    });
  }, []);

  const handleBulkDelete = useCallback((selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: `Delete ${selectedIds.length} Selected Tickets?`,
      message: `You are about to permanently delete ${selectedIds.length} tickets from Firestore. Are you sure?`,
      confirmText: `Delete ${selectedIds.length} Tickets`,
      confirmVariant: 'danger',
      onConfirm: async () => {
        const idSet = new Set(selectedIds.map((s) => String(s)));
        setTickets((prev) =>
          prev.filter(
            (t) => !idSet.has(String(t.id)) && !idSet.has(String(t['Sr no.']))
          )
        );
        try {
          await bulkDeleteTickets(selectedIds);
        } catch (err) {
          console.warn('Bulk delete notice:', err);
        }
      },
    });
  }, []);

  const handleBulkStatus = useCallback(async (selectedIds, newStatus) => {
    const userEmail = user ? user.email : 'admin@cbre.com';
    const idSet = new Set(selectedIds.map((s) => String(s)));
    setTickets((prev) =>
      prev.map((t) =>
        idSet.has(String(t.id)) || idSet.has(String(t['Sr no.']))
          ? { ...t, 'Status ': newStatus }
          : t
      )
    );
    try {
      await bulkUpdateStatus(selectedIds, newStatus, userEmail);
    } catch (err) {
      alert('Bulk status update failed: ' + err.message);
    }
  }, [user]);

  // Export to Excel: exports separate sheets for 2026 and 2025!
  const handleExportExcel = async () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Helpdesk_Tracker_${selectedYear === 'all' ? 'MultiYear' : selectedYear}_${dateStr}.xlsx`;
    await exportTicketsToExcel(tickets, filename, selectedYear);
  };

  // Drill down grid to any visual filter (category, site, pending, channel, etc.)
  const handleDrilldownFromVisual = (filterObj) => {
    setActiveVisualFilter(filterObj);
    setActiveTab('tracker'); // Switch to Tracker Grid view to inspect tickets immediately
  };

  // IF IN DEDICATED TICKET CREATION / EDIT PAGE:
  if (currentView === 'ticketPage') {
    return (
      <TicketPage
        initialTicket={editingTicket}
        onSave={handleSaveTicket}
        onBack={() => {
          setCurrentView('grid');
          setEditingTicket(null);
        }}
        selectedYear={selectedYear}
      />
    );
  }

  // MAIN SCREEN VIEW:
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      {/* 1. Top Navbar */}
      <Navbar
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={logoutUser}
        onOpenNewTicket={handleOpenCreatePage}
        onOpenImport={() => setImportModalOpen(true)}
        onExport={handleExportExcel}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenConfig={() => setConfigModalOpen(true)}
        onOpenUsers={() => setUserModalOpen(true)}
        ticketCount={displayTickets.length}
        selectedYear={selectedYear}
        onSelectYear={(yr) => {
          setSelectedYear(yr);
          setActiveVisualFilter(null);
        }}
      />

      {/* Interactive Visual Drill-down Active Banner */}
      {activeVisualFilter && (
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md animate-fade-in border-b border-indigo-500/50">
          <div className="flex items-center space-x-2">
            <span className="p-1 rounded-md bg-white/20 text-white">
              <Upload className="w-3.5 h-3.5 rotate-90" />
            </span>
            <span>
              Interactive Filter Active: <strong className="text-amber-300">{activeVisualFilter.label}</strong> &bull; Showing{' '}
              <strong className="underline text-white font-mono">{displayTickets.length} tickets</strong>
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('analytics')}
              className="text-xs text-indigo-200 hover:text-white underline font-medium flex items-center gap-1"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Back to Analytics
            </button>
            <button
              onClick={() => setActiveVisualFilter(null)}
              className="px-3 py-1 bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold shadow-sm transition active:scale-95"
            >
              Clear Filter (Show All)
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* VIEW 1: Tracker Grid (Kept alive in DOM for instant zero-lag tab switching) */}
        <div className={`flex-1 flex flex-col min-h-0 ${activeTab === 'tracker' ? '' : 'hidden'}`}>
          {loading && tickets.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-xs font-semibold text-slate-600">
                  Loading Helpdesk Tracker...
                </p>
              </div>
            </div>
          ) : (
            <TicketGrid
              tickets={displayTickets}
              onUpdateTicket={handleInlineUpdate}
              onInsertRow={handleInsertDirectRow}
              onDeleteTicket={handleDeleteTicket}
              onBulkDelete={handleBulkDelete}
              onBulkStatus={handleBulkStatus}
              onEditTicket={handleOpenEditPage}
            />
          )}
        </div>

        {/* VIEW 2: Dedicated Full-Screen Analytics Dashboard */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'analytics' ? '' : 'hidden'}`}>
          <ErrorBoundary>
            <AnalyticsDashboard
              allTickets={tickets}
              selectedYear={selectedYear}
              onSelectYear={(yr) => {
                setSelectedYear(yr);
                setActiveVisualFilter(null);
              }}
              onFilterGridToReactive={() =>
                handleDrilldownFromVisual({
                  type: 'callType',
                  value: 'Reactive',
                  label: 'Call Type: Reactive Complaints',
                })
              }
              onDrilldownToTracker={handleDrilldownFromVisual}
            />
          </ErrorBoundary>
        </div>

        {/* VIEW 3: Dedicated Team & User Management Page (Admin only) */}
        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto bg-slate-50">
            <UserManagementView currentUser={user} isPage={true} />
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) on Mobile Screens */}
      <button
        onClick={handleOpenCreatePage}
        className="sm:hidden fixed bottom-5 right-5 z-30 w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-2xl flex items-center justify-center transition active:scale-95"
        title="Add New Ticket"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>

      {/* 3. Modals */}
      {importModalOpen && (
        <ImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImportComplete={() => {
            setSelectedYear('all');
            setActiveVisualFilter(null);
          }}
          userEmail={user ? user.email : 'importer@cbre.com'}
          existingTickets={tickets}
        />
      )}

      {userModalOpen && (
        <UserManagementModal
          isOpen={userModalOpen}
          onClose={() => setUserModalOpen(false)}
          currentUser={user}
        />
      )}

      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={(u) => setUser(u)}
        />
      )}

      {configModalOpen && (
        <FirebaseConfigModal
          isOpen={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
        />
      )}

      {confirmModal.isOpen && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          confirmVariant={confirmModal.confirmVariant}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}
