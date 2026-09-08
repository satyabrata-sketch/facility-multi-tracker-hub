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
} from 'lucide-react';
import { getExcelSheets, parseSheetToTickets } from '../utils/excelHelper';
import { batchImportTickets } from '../services/ticketService';
import { sampleTickets } from '../data/sampleTickets';
import { COLUMNS_SCHEMA } from '../utils/schema';

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
  const [skipExistingDups, setSkipExistingDups] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const parseWithSettings = (wb, sheet, skipDups) => {
    return parseSheetToTickets(
      wb,
      sheet,
      existingTickets,
      { skipExisting: skipDups }
    );
  };

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setError(null);
    setFile(selected);
    try {
      const { workbook, sheetNames } = await getExcelSheets(selected);
      setWorkbook(workbook);

      // Strictly filter ONLY genuine ticket data sheets; exclude pivot tables, calculations, dashboards, and scrap sheets!
      const validTicketSheets = sheetNames.filter((s) => {
        const lower = s.toLowerCase().trim();
        if (/summary|calc|dash|pivot|mylist|sheet[0-9]/i.test(lower)) return false;
        return true;
      });

      const eligibleSheets = validTicketSheets.length > 0 ? validTicketSheets : sheetNames;
      setSheetNames(eligibleSheets);

      // Prioritize current year ticket sheet (e.g. Helpdesk -2026)
      const defaultSheet =
        eligibleSheets.find((s) => /2026/i.test(s)) ||
        eligibleSheets.find((s) => /helpdesk\s*[-_]?\s*202/i.test(s)) ||
        eligibleSheets.find((s) => /2025/i.test(s)) ||
        eligibleSheets[0];
      setSelectedSheet(defaultSheet);

      // Parse with settings (default: import all unique rows in sheet)
      const { tickets, duplicatesFiltered: dupCount } = parseWithSettings(
        workbook,
        defaultSheet,
        skipExistingDups
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
        skipExistingDups
      );
      setParsedTickets(tickets);
      setDuplicatesFiltered(dupCount);
    } catch (err) {
      setError('Error reading sheet: ' + err.message);
    }
  };

  const handleToggleSkipDups = (checked) => {
    setSkipExistingDups(checked);
    if (workbook && selectedSheet) {
      try {
        const { tickets, duplicatesFiltered: dupCount } = parseWithSettings(
          workbook,
          selectedSheet,
          checked
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
        }
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
        }
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

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-xs text-slate-500">
                      Want to load the 500 deduplicated records from your Excel file?
                    </span>
                    <button
                      type="button"
                      onClick={handleImportSampleData}
                      disabled={importing}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Database className="w-3.5 h-3.5" />
                      Load 500 Pre-Parsed Excel Tickets
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Sheet Selector */}
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{file?.name}</p>
                        <p className="text-[11px] text-slate-500">
                          Found <strong className="text-emerald-700">{parsedTickets.length} unique tickets</strong>
                          {duplicatesFiltered > 0 && (
                            <span className="text-amber-700 ml-1">
                              (filtered {duplicatesFiltered} duplicates)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <label className="text-xs font-medium text-slate-600">Sheet:</label>
                      <select
                        value={selectedSheet}
                        onChange={handleSheetChange}
                        className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg shadow-sm font-medium"
                      >
                        {sheetNames.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Deduplication Option */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-100/90 rounded-xl border border-slate-200">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipExistingDups}
                        onChange={(e) => handleToggleSkipDups(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>Filter out rows already existing in database</span>
                    </label>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {skipExistingDups ? 'Strict Dedup' : 'Import All Sheet Rows'}
                    </span>
                  </div>

                  {/* Deduplication & format confirmation */}
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Automatic Cleanup & De-duplication Active:
                    </p>
                    <p className="text-[11px] text-emerald-800">
                      &bull; Month column automatically formatted to Short Month (e.g. <code>Jan-26</code>, <code>Sep-25</code>).<br />
                      &bull; Turn Around Time (TAT) converted to <code>Yes</code> / <code>No</code>.<br />
                      &bull; Duplicate entries automatically removed to keep only unique tickets.
                    </p>
                  </div>

                  {importing && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                          Batch migrating into Firestore...
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
