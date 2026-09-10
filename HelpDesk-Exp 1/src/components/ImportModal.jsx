import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ArrowRight,
  Database,
  Filter,
  Trash2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { getExcelSheets, parseSheetToTickets } from '../utils/excelHelper';
import { batchImportTickets, clearAllTickets, purgeAllDuplicates } from '../services/ticketService';
import { sampleTickets } from '../data/sampleTickets';
import { COLUMNS_SCHEMA, deduplicateTickets } from '../utils/schema';
import { isSupabaseConfigValid } from '../supabase/supabaseConfig';

export default function ImportModal({
  isOpen,
  onClose,
  onImportComplete,
  userEmail,
  existingTickets = [],
}) {
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [parsedTickets, setParsedTickets] = useState([]);
  const [duplicatesFiltered, setDuplicatesFiltered] = useState(0);
  const [importMode, setImportMode] = useState('fresh'); // 'fresh' (Replace All) | 'merge' (Skip Existing Duplicates)
  const [skipExistingDups, setSkipExistingDups] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [purgeSuccessMsg, setPurgeSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const parseWithSettings = (wb, sheet, skipDups, mode = importMode, availableSheets = sheetNames) => {
    const isFresh = mode === 'fresh';
    if (sheet === '__ALL_SHEETS__') {
      let combined = [];
      let totalDups = 0;
      const targetSheets = availableSheets.filter((s) => s !== '__ALL_SHEETS__');
      targetSheets.forEach((s) => {
        try {
          const res = parseSheetToTickets(wb, s, existingTickets, {
            skipExisting: isFresh ? false : skipDups,
            replaceAll: isFresh,
          });
          combined = combined.concat(res.tickets);
          totalDups += res.duplicatesFiltered;
        } catch (e) {
          console.warn(`Error parsing sheet ${s}:`, e);
        }
      });
      return { tickets: combined, duplicatesFiltered: totalDups };
    }
    return parseSheetToTickets(
      wb,
      sheet,
      existingTickets,
      {
        skipExisting: isFresh ? false : skipDups,
        replaceAll: isFresh,
      }
    );
  };

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setError(null);
    setFile(selected);
    try {
      const { workbook, sheetNames: rawSheetNames } = await getExcelSheets(selected);
      setWorkbook(workbook);

      // Strictly filter ONLY genuine ticket data sheets; exclude pivot tables, calculations, dashboards, and scrap sheets!
      const validTicketSheets = rawSheetNames.filter((s) => {
        const lower = s.toLowerCase().trim();
        if (/summary|calc|dash|pivot|mylist|sheet[0-9]/i.test(lower)) return false;
        return true;
      });

      const eligibleSheets = validTicketSheets.length > 0 ? validTicketSheets : rawSheetNames;
      const combinedOptions =
        eligibleSheets.length > 1 ? ['__ALL_SHEETS__', ...eligibleSheets] : eligibleSheets;
      setSheetNames(combinedOptions);

      // Prioritize combined or current year ticket sheet
      const defaultSheet =
        combinedOptions.find((s) => s === '__ALL_SHEETS__') ||
        combinedOptions.find((s) => /2026/i.test(s)) ||
        combinedOptions[0];
      setSelectedSheet(defaultSheet);

      // Parse with settings (default: fresh import mode)
      const { tickets, duplicatesFiltered: dupCount } = parseWithSettings(
        workbook,
        defaultSheet,
        skipExistingDups,
        importMode,
        combinedOptions
      );
      setParsedTickets(tickets);
      setDuplicatesFiltered(dupCount);
    } catch (err) {
      console.error(err);
      setError('Error parsing Excel file: ' + err.message);
    }
  };

  const handleSheetChange = (e) => {
    const sheet = e.target.value;
    setSelectedSheet(sheet);
    try {
      const { tickets, duplicatesFiltered: dupCount } = parseWithSettings(
        workbook,
        sheet,
        skipExistingDups,
        importMode
      );
      setParsedTickets(tickets);
      setDuplicatesFiltered(dupCount);
    } catch (err) {
      setError('Error reading sheet: ' + err.message);
    }
  };

  const handleImportModeChange = (newMode) => {
    setImportMode(newMode);
    if (workbook && selectedSheet) {
      try {
        const { tickets, duplicatesFiltered: dupCount } = parseWithSettings(
          workbook,
          selectedSheet,
          skipExistingDups,
          newMode
        );
        setParsedTickets(tickets);
        setDuplicatesFiltered(dupCount);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleToggleSkipDups = (checked) => {
    setSkipExistingDups(checked);
    if (workbook && selectedSheet) {
      try {
        const { tickets, duplicatesFiltered: dupCount } = parseWithSettings(
          workbook,
          selectedSheet,
          checked,
          importMode
        );
        setParsedTickets(tickets);
        setDuplicatesFiltered(dupCount);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleStartImport = async () => {
    if (!parsedTickets.length) return;
    setImporting(true);
    setError(null);
    setProgress({ processed: 0, total: parsedTickets.length });

    try {
      await batchImportTickets(
        parsedTickets,
        userEmail || 'admin@cbre.com',
        (processed, total) => {
          setProgress({ processed, total });
        },
        { replaceAll: importMode === 'fresh' }
      );
      setSuccess(true);
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      console.error(err);
      setError('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handlePurgeDuplicates = () => {
    try {
      const removed = purgeAllDuplicates();
      setPurgeSuccessMsg(`Successfully purged ${removed} duplicate records! Total unique tickets intact.`);
      if (onImportComplete) {
        onImportComplete();
      }
      setTimeout(() => setPurgeSuccessMsg(null), 6000);
    } catch (err) {
      setError('Purge failed: ' + err.message);
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('Are you sure you want to wipe all tickets from the database for a fresh import?')) {
      return;
    }
    try {
      await clearAllTickets();
      setPurgeSuccessMsg('Database cleared successfully! You can now import your fresh Excel file.');
      if (onImportComplete) {
        onImportComplete();
      }
      setTimeout(() => setPurgeSuccessMsg(null), 6000);
    } catch (err) {
      setError('Clear failed: ' + err.message);
    }
  };

  const handleImportSampleData = async () => {
    setImporting(true);
    setError(null);
    setProgress({ processed: 0, total: sampleTickets.length });

    try {
      await batchImportTickets(
        sampleTickets,
        userEmail || 'admin@cbre.com',
        (processed, total) => {
          setProgress({ processed, total });
        },
        { replaceAll: true }
      );
      setSuccess(true);
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      setError('Sample import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setWorkbook(null);
    setParsedTickets([]);
    setDuplicatesFiltered(0);
    setSuccess(false);
    setError(null);
    setPurgeSuccessMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Import Helpdesk Tracker Excel
              </h2>
              <p className="text-xs text-slate-400">
                Bulk migrate Excel rows with automatic deduplication
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {success ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Import Completed Successfully!
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                All unique tickets have been stored in the database. Duplicates were automatically filtered out.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                Close & View Grid
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {purgeSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 flex items-center space-x-2 font-medium shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{purgeSuccessMsg}</span>
                </div>
              )}

              {!workbook ? (
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100/60 transition group">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <FileSpreadsheet className="w-12 h-12 text-slate-400 group-hover:text-emerald-600 transition mb-3" />
                    <span className="text-sm font-semibold text-slate-700">
                      Upload HELP DESK TRACKER (.xlsx)
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      Drag & drop your Excel file here or browse
                    </span>
                  </label>

                  {/* Database Maintenance Utilities */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Database Utilities & Quick Actions
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Current: <strong>{existingTickets.length}</strong> tickets
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={handlePurgeDuplicates}
                        className="px-3 py-2 bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-400 text-slate-700 hover:text-emerald-700 text-xs font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                        title="Remove duplicate tickets from database"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                        Purge Duplicates Now
                      </button>

                      <button
                        type="button"
                        onClick={handleClearAllData}
                        className="px-3 py-2 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-400 text-slate-700 hover:text-rose-700 text-xs font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                        title="Wipe database to prepare for fresh import"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        Clear All Data
                      </button>

                      <button
                        type="button"
                        onClick={handleImportSampleData}
                        disabled={importing}
                        className="px-3 py-2 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 text-xs font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                        title="Load pristine pre-parsed dataset"
                      >
                        <Database className="w-3.5 h-3.5 text-indigo-600" />
                        Reset to Clean Baseline
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Sheet Selector & Count */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center space-x-2.5">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{file?.name}</p>
                        <p className="text-[11px] text-slate-500">
                          Ready to import: <strong className="text-emerald-700">{parsedTickets.length} unique tickets</strong>
                          {duplicatesFiltered > 0 && (
                            <span className="text-amber-700 ml-1 font-semibold">
                              ({duplicatesFiltered} duplicates filtered)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <label className="text-xs font-semibold text-slate-700">Sheet:</label>
                      <select
                        value={selectedSheet}
                        onChange={handleSheetChange}
                        className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg shadow-sm font-semibold text-slate-800"
                      >
                        {sheetNames.map((s) => (
                          <option key={s} value={s}>
                            {s === '__ALL_SHEETS__' ? '★ All Sheets Combined (2026 & 2025)' : s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Mode Selector: Fresh Start vs Merge */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Import Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Option 1: Fresh Start */}
                      <div
                        onClick={() => handleImportModeChange('fresh')}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                          importMode === 'fresh'
                            ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'fresh'}
                          onChange={() => handleImportModeChange('fresh')}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>Fresh Start (Replace All Data)</span>
                            <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[9px] font-bold">Recommended</span>
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                            Replaces existing tickets with the fresh Excel sheet. Automatically eliminates all previous duplicates!
                          </p>
                        </div>
                      </div>

                      {/* Option 2: Merge & Deduplicate */}
                      <div
                        onClick={() => handleImportModeChange('merge')}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                          importMode === 'merge'
                            ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'merge'}
                          onChange={() => handleImportModeChange('merge')}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Merge & Skip Duplicates
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                            Keeps existing database records and only appends brand new unique rows from this sheet.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary of Data Hygiene */}
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Automatic Cleanup & De-duplication Active:
                    </p>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      &bull; Blank cells in Excel remain clean and empty (no dummy timestamps or zones injected).<br />
                      &bull; <code>Action taken</code> and <code>Date close</code> synchronized and preserved.<br />
                      &bull; Turn Around Time (TAT) normalized to <code>Yes</code> / <code>No</code>.<br />
                      &bull; Duplicate rows filtered out cleanly.
                    </p>
                  </div>

                  {importing && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                          {isSupabaseConfigValid ? 'Batch migrating into Supabase...' : 'Batch migrating into Firestore...'}
                        </span>
                        <span className="font-mono font-medium">
                          {progress.processed} / {progress.total} (
                          {Math.round((progress.processed / (progress.total || 1)) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-2 transition-all duration-300"
                          style={{
                            width: `${(progress.processed / (progress.total || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setWorkbook(null)}
                      disabled={importing}
                      className="text-xs text-slate-600 hover:text-slate-800"
                    >
                      Choose Different File
                    </button>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={importing}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleStartImport}
                        disabled={importing || !parsedTickets.length}
                        className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
                      >
                        {importing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        <span>
                          {importing
                            ? 'Importing...'
                            : `Import ${parsedTickets.length} Unique Tickets`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
