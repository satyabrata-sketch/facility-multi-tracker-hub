import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  Search,
  SlidersHorizontal,
  Trash2,
  CheckCheck,
  Edit2,
  Eye,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Columns3,
  ChevronDown,
  Filter,
  Plus,
} from 'lucide-react';
import { COLUMNS_SCHEMA, sanitizeSiteValue } from '../utils/schema';

// Badge renderers
function StatusBadgeRenderer(params) {
  const val = (params.value || '').trim();
  let color = 'bg-slate-100 text-slate-700 border-slate-300';
  if (val.toLowerCase() === 'resolved' || val.toLowerCase() === 'closed') {
    color = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (val.toLowerCase() === 'not resolved') {
    color = 'bg-rose-100 text-rose-800 border-rose-300';
  } else if (val.toLowerCase() === 'in-progress') {
    color = 'bg-blue-100 text-blue-800 border-blue-300';
  } else if (val.toLowerCase() === 'open') {
    color = 'bg-amber-100 text-amber-800 border-amber-300';
  }

  return (
    <div className="flex items-center h-full">
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${color}`}>
        {val || 'Open'}
      </span>
    </div>
  );
}

function PriorityBadgeRenderer(params) {
  const val = (params.value || 'Medium').trim();
  let color = 'bg-amber-100 text-amber-800 border-amber-300';
  if (val.toLowerCase() === 'high') {
    color = 'bg-rose-100 text-rose-800 border-rose-300 font-semibold';
  } else if (val.toLowerCase() === 'low') {
    color = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  }

  return (
    <div className="flex items-center h-full">
      <span className={`px-2 py-0.5 text-xs rounded border ${color}`}>
        {val}
      </span>
    </div>
  );
}

function TatBadgeRenderer(params) {
  const raw = String(params.value || '').trim().toLowerCase();
  const isTat = raw === 'yes' || raw === '1' || raw === 'true';
  return (
    <div className="flex items-center h-full">
      <span
        className={`px-2 py-0.5 text-xs font-semibold rounded ${
          isTat
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
            : 'bg-rose-50 text-rose-700 border border-rose-300'
        }`}
      >
        {isTat ? 'Yes' : 'No'}
      </span>
    </div>
  );
}

export default function TicketGrid({
  tickets,
  onUpdateTicket,
  onInsertRow,
  onDeleteTicket,
  onBulkDelete,
  onBulkStatus,
  onEditTicket,
  onGridFiltered,
}) {
  const gridRef = useRef();
  const [quickFilter, setQuickFilter] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [columnVisibilityMenu, setColumnVisibilityMenu] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState({});
  const [toastMessage, setToastMessage] = useState(null);
  const [isInserting, setIsInserting] = useState(false);

  const handleInsertRow = async () => {
    if (!onInsertRow || isInserting) return;
    setIsInserting(true);
    try {
      const newId = await onInsertRow();
      showToast('New row inserted! Navigating to row...');

      // Find node in AG Grid, navigate to its page, ensure visible, and start editing
      setTimeout(() => {
        if (gridRef.current && gridRef.current.api) {
          const api = gridRef.current.api;
          let targetNode = null;
          api.forEachNode((node) => {
            if (node.data && (node.data.id === newId || String(node.data['Sr no.']) === String(newId))) {
              targetNode = node;
            }
          });

          if (targetNode) {
            const pageSize = api.paginationGetPageSize ? api.paginationGetPageSize() : 50;
            const targetPage = Math.floor(targetNode.rowIndex / pageSize);
            if (api.paginationGoToPage) {
              api.paginationGoToPage(targetPage);
            }
            api.ensureNodeVisible(targetNode, 'middle');
            targetNode.setSelected(true);
            setTimeout(() => {
              api.startEditingCell({
                rowIndex: targetNode.rowIndex,
                colKey: 'Discription ',
              });
            }, 120);
          } else {
            if (api.paginationGoToLastPage) api.paginationGoToLastPage();
          }
        }
      }, 450);
    } catch (err) {
      console.error('Failed to insert row:', err);
      showToast('Error inserting row: ' + err.message);
    } finally {
      setIsInserting(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const onSelectionChanged = useCallback(() => {
    if (gridRef.current && gridRef.current.api) {
      const selected = gridRef.current.api.getSelectedRows();
      setSelectedRows(selected);
    }
  }, []);

  const onFilterChanged = useCallback(() => {
    if (gridRef.current && gridRef.current.api) {
      const filtered = [];
      gridRef.current.api.forEachNodeAfterFilter((node) => {
        if (node.data) filtered.push(node.data);
      });
      if (onGridFiltered) {
        onGridFiltered(filtered);
      }
    }
  }, [onGridFiltered]);

  const onCellValueChanged = useCallback(
    async (event) => {
      const { data, colDef, newValue, oldValue } = event;
      if (newValue === oldValue) return;

      const ticketId = data.id || String(data['Sr no.']);
      const fieldKey = colDef.field;
      const updates = { [fieldKey]: newValue };

      if (fieldKey === 'Action Taken ') {
        updates['Action taken '] = newValue;
      }
      if (fieldKey === 'Discription ') {
        updates['Description'] = newValue;
      }
      if (fieldKey === 'Date close ') {
        updates['Date close'] = newValue;
      }
      if (fieldKey === 'Resolved time') {
        updates['Resolved time '] = newValue;
      }
      if (fieldKey === 'Report Time') {
        updates['Report time'] = newValue;
      }

      try {
        await onUpdateTicket(ticketId, updates, data);
        showToast(`Saved "${colDef.headerName}"`);
      } catch (err) {
        console.error('Cell edit notice:', err);
        showToast(`Saved locally`);
      }
    },
    [onUpdateTicket]
  );

  const onCellKeyDown = useCallback(
    (params) => {
      const key = params.event?.key;
      if (key === 'Delete' && !params.event?.defaultPrevented) {
        const isEditing = params.api && params.api.getEditingCells ? params.api.getEditingCells().length > 0 : false;
        if (!isEditing && params.data && onDeleteTicket) {
          onDeleteTicket(params.data);
        }
      }
    },
    [onDeleteTicket]
  );

  const columnDefs = useMemo(() => {
    const selectCol = {
      headerName: '',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      width: 45,
      pinned: 'left',
      lockPosition: 'left',
      sortable: false,
      filter: false,
      resizable: false,
      editable: false,
      suppressNavigable: true,
    };

    const dataCols = COLUMNS_SCHEMA.map((col) => {
      const baseCol = {
        field: col.key,
        headerName: col.label,
        width: col.width,
        pinned: col.pinned || undefined,
        editable: col.editable,
        sortable: true,
        filter: true,
        resizable: true,
        hide: !!hiddenColumns[col.key],
        tooltipField: col.key,
      };

      if (col.key === 'Sr no.') {
        baseCol.sort = 'asc';
        baseCol.comparator = (valA, valB) => {
          const a = parseInt(valA, 10) || 0;
          const b = parseInt(valB, 10) || 0;
          return a - b;
        };
      }

      if (col.key === 'Site ') {
        baseCol.valueFormatter = (params) => {
          return sanitizeSiteValue(params.value);
        };
      }

      if (col.type === 'select') {
        baseCol.cellEditor = 'agSelectCellEditor';
        baseCol.cellEditorParams = {
          values: col.options,
        };
      }

      if (col.key === 'Action Taken ') {
        baseCol.valueGetter = (params) => {
          if (!params.data) return '';
          return params.data['Action Taken '] || params.data['Action taken '] || params.data['Action Taken'] || params.data['Action taken'] || '';
        };
        baseCol.valueSetter = (params) => {
          if (!params.data) return false;
          params.data['Action Taken '] = params.newValue;
          params.data['Action taken '] = params.newValue;
          return true;
        };
      }

      if (col.key === 'Discription ') {
        baseCol.valueGetter = (params) => {
          if (!params.data) return '';
          return params.data['Discription '] || params.data['Description'] || params.data['Description '] || '';
        };
        baseCol.valueSetter = (params) => {
          if (!params.data) return false;
          params.data['Discription '] = params.newValue;
          params.data['Description'] = params.newValue;
          return true;
        };
      }

      if (col.key === 'Date close ') {
        baseCol.valueGetter = (params) => {
          if (!params.data) return '';
          return params.data['Date close '] || params.data['Date close'] || params.data['Date Close '] || '';
        };
        baseCol.valueSetter = (params) => {
          if (!params.data) return false;
          params.data['Date close '] = params.newValue;
          params.data['Date close'] = params.newValue;
          return true;
        };
      }

      if (col.key === 'Resolved time') {
        baseCol.valueGetter = (params) => {
          if (!params.data) return '';
          return params.data['Resolved time'] || params.data['Resolved time '] || params.data['Resolved Time'] || params.data['Close Time'] || '';
        };
        baseCol.valueSetter = (params) => {
          if (!params.data) return false;
          params.data['Resolved time'] = params.newValue;
          params.data['Resolved time '] = params.newValue;
          return true;
        };
      }

      if (col.key === 'Report Time') {
        baseCol.valueGetter = (params) => {
          if (!params.data) return '';
          return params.data['Report Time'] || params.data['Report time'] || params.data['Report Time '] || '';
        };
        baseCol.valueSetter = (params) => {
          if (!params.data) return false;
          params.data['Report Time'] = params.newValue;
          params.data['Report time'] = params.newValue;
          return true;
        };
      }

      if (col.key === 'Status ') {
        baseCol.cellRenderer = StatusBadgeRenderer;
      } else if (col.key === 'Priority') {
        baseCol.cellRenderer = PriorityBadgeRenderer;
      } else if (col.key === 'is On TAT') {
        baseCol.cellRenderer = TatBadgeRenderer;
      }

      return baseCol;
    });

    const actionsCol = {
      headerName: 'Actions',
      field: 'actions',
      width: 85,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      editable: false,
      suppressNavigable: true,
      cellRenderer: (params) => {
        const row = params.data;
        if (!row) return null;
        return (
          <div className="flex items-center space-x-1.5 h-full">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (onEditTicket) onEditTicket(row);
              }}
              className="p-1 rounded text-indigo-600 hover:bg-indigo-50 hover:scale-110 transition cursor-pointer"
              title="Edit ticket in form"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (onDeleteTicket) onDeleteTicket(row);
              }}
              className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 hover:scale-110 transition cursor-pointer"
              title="Delete ticket row"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    };

    return [selectCol, ...dataCols, actionsCol];
  }, [hiddenColumns, onEditTicket, onDeleteTicket]);

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      minWidth: 80,
    }),
    []
  );

  const toggleColumnHide = (key) => {
    setHiddenColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const displayTickets = useMemo(() => {
    if (!quickFilter) return tickets;
    const q = quickFilter.toLowerCase();
    return tickets.filter((t) => {
      return Object.values(t).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [tickets, quickFilter]);

  return (
    <div className="flex flex-col h-full bg-white relative">
      {toastMessage && (
        <div className="absolute top-3 right-6 z-50 bg-slate-900/90 text-white text-xs px-3 py-2 rounded-lg shadow-lg border border-slate-700 flex items-center space-x-2 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Grid Toolbar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Insert Row & Quick Search */}
        <div className="flex items-center space-x-2 flex-1 max-w-sm sm:max-w-lg">
          <button
            type="button"
            onClick={handleInsertRow}
            disabled={isInserting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg shadow-sm transition disabled:opacity-50 flex-shrink-0 cursor-pointer"
            title="Insert a new ticket row directly into grid"
          >
            {isInserting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>+ Insert Row</span>
          </button>

          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search all columns across tickets..."
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          {quickFilter && (
            <button
              onClick={() => setQuickFilter('')}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded bg-slate-200 flex-shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center space-x-2">

          {/* Bulk Action Bar */}
          {selectedRows.length > 0 && (
            <div className="hidden sm:flex items-center space-x-1.5 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
              <span className="text-xs font-semibold text-indigo-900">
                {selectedRows.length} sel:
              </span>
              <button
                onClick={() => onBulkStatus(selectedRows.map((r) => r.id || String(r['Sr no.'])), 'Resolved')}
                className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded font-medium shadow-sm hover:bg-emerald-500"
              >
                Resolved
              </button>
              <button
                onClick={() => onBulkStatus(selectedRows.map((r) => r.id || String(r['Sr no.'])), 'In-Progress')}
                className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-medium shadow-sm hover:bg-blue-500"
              >
                In-Progress
              </button>
              <button
                onClick={() => onBulkDelete(selectedRows.map((r) => r.id || String(r['Sr no.'])))}
                className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded font-medium shadow-sm flex items-center space-x-1 hover:bg-rose-500"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          )}

          {/* Column Visibility */}
          <div className="relative">
            <button
              onClick={() => setColumnVisibilityMenu(!columnVisibilityMenu)}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm transition"
            >
              <Columns3 className="w-3.5 h-3.5 mr-1 text-slate-500" />
              <span className="hidden sm:inline">Columns</span>
              <ChevronDown className="w-3 h-3 ml-1 text-slate-400" />
            </button>

            {columnVisibilityMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-800">Columns (20)</span>
                  <button
                    onClick={() => setHiddenColumns({})}
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    Reset
                  </button>
                </div>
                <div className="space-y-1.5">
                  {COLUMNS_SCHEMA.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center space-x-2 text-xs text-slate-700 hover:bg-slate-50 p-1 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenColumns[col.key]}
                        onChange={() => toggleColumnHide(col.key)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area: High Performance Virtualized Data Grid */}
      <div className="flex-1 w-full ag-theme-alpine">
        <AgGridReact
          ref={gridRef}
          rowData={tickets}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          onSelectionChanged={onSelectionChanged}
          onFilterChanged={onFilterChanged}
          onCellValueChanged={onCellValueChanged}
          onCellKeyDown={onCellKeyDown}
          getRowId={(params) =>
            params.data.id || (params.data['Sr no.'] ? `sr-${params.data['Sr no.']}` : `node-${params.node?.id || Math.random()}`)
          }
          onRowDoubleClicked={(params) => {
            if (params.data && onEditTicket) {
              onEditTicket(params.data);
            }
          }}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          enterNavigatesVertically={true}
          enterNavigatesVerticallyAfterEdit={true}
          quickFilterText={quickFilter}
          pagination={true}
          paginationPageSize={50}
          paginationPageSizeSelector={[25, 50, 100, 200, 500]}
          animateRows={false}
          enableCellTextSelection={true}
          rowHeight={36}
          headerHeight={38}
          suppressHorizontalScroll={false}
          alwaysShowHorizontalScroll={true}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span>
            Total: <strong className="text-slate-700">{tickets.length}</strong>
          </span>
          {selectedRows.length > 0 && (
            <span>
              Selected: <strong className="text-indigo-600">{selectedRows.length}</strong>
            </span>
          )}
          <span className="hidden sm:inline text-slate-400">&bull;</span>
          <span className="hidden sm:inline font-medium text-slate-600">
            Single-click any cell to edit &bull; Enter/Tab to navigate &bull; Auto-saves live
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Excel View &bull; Frozen: Sr no., Site
        </div>
      </div>
    </div>
  );
}
