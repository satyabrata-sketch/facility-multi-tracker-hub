import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  MapPin,
  User,
  Tag,
  Calendar,
  ChevronRight,
} from 'lucide-react';

export default function MobileTicketList({
  tickets,
  onEditTicket,
  onDeleteTicket,
  onQuickStatusChange,
}) {
  if (!tickets || tickets.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        No tickets match the current filters.
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 pb-24">
      {tickets.map((t) => {
        const status = (t['Status '] || 'Open').trim();
        const priority = (t['Priority'] || 'Medium').trim();
        const isResolved =
          status.toLowerCase() === 'resolved' || status.toLowerCase() === 'closed';

        return (
          <div
            key={t.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 transition active:scale-[0.99]"
          >
            {/* Top Row: Sr No, Site, Priority, Status */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  #{t['Sr no.'] || t.id}
                </span>
                <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                  {t['Site '] || 'DT3'}
                </span>
                {t['Zone'] && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    {t['Zone']}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-1.5">
                {/* Priority Badge */}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    priority.toLowerCase() === 'high'
                      ? 'bg-rose-100 text-rose-700'
                      : priority.toLowerCase() === 'low'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {priority}
                </span>

                {/* Status Toggle Pill */}
                <button
                  onClick={() =>
                    onQuickStatusChange(
                      t.id,
                      isResolved ? 'Open' : 'Resolved'
                    )
                  }
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border transition flex items-center gap-1 ${
                    isResolved
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : status.toLowerCase() === 'in-progress'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-amber-50 text-amber-700 border-amber-300'
                  }`}
                  title="Tap to toggle Status"
                >
                  {isResolved ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Clock className="w-3 h-3 text-amber-600" />
                  )}
                  <span>{status}</span>
                </button>
              </div>
            </div>

            {/* Middle: Description */}
            <div>
              <p className="text-xs font-medium text-slate-800 line-clamp-2 leading-relaxed">
                {t['Discription '] || 'No description provided.'}
              </p>
              {t['Action Taken '] && (
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">
                  ↳ Action: {t['Action Taken ']}
                </p>
              )}
            </div>

            {/* Bottom Meta & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              <div className="flex items-center space-x-3">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-400" />
                  {t['Request category'] || 'Housekeeping'}
                </span>
                {t['Employee Name '] && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    {t['Employee Name ']}
                  </span>
                )}
                {t['Date '] && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {t['Date ']}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => onEditTicket(t)}
                  className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Update</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTicket(t)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
