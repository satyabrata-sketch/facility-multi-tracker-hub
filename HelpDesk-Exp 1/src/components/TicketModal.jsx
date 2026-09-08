import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, FileText } from 'lucide-react';
import { COLUMNS_SCHEMA, createEmptyTicket } from '../utils/schema';

export default function TicketModal({ isOpen, onClose, onSave, initialTicket = null }) {
  const [formData, setFormData] = useState(createEmptyTicket());
  const [errors, setErrors] = useState({});
  const isEdit = !!initialTicket;

  useEffect(() => {
    if (initialTicket) {
      setFormData({ ...createEmptyTicket(), ...initialTicket });
    } else {
      setFormData(createEmptyTicket());
    }
    setErrors({});
  }, [initialTicket, isOpen]);

  if (!isOpen) return null;

  const handleChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    // Validate required fields
    if (!formData['Site ']) newErrors['Site '] = 'Site is required';
    if (!formData['Discription ']) newErrors['Discription '] = 'Description is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isEdit ? 'Edit Helpdesk Ticket' : 'Create New Helpdesk Ticket'}
              </h2>
              <p className="text-xs text-slate-400">
                All 20 schema fields matching Helpdesk Tracker FY 25-26
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Location & Reference */}
          <div>
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 pb-1 border-b border-indigo-100 flex items-center gap-1.5">
              <span>1. Location & Identification</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Sr no. */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sr No.
                </label>
                <input
                  type="text"
                  placeholder="Auto / e.g. 1"
                  value={formData['Sr no.'] || ''}
                  onChange={(e) => handleChange('Sr no.', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Site */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Site <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData['Site '] || 'DT3'}
                  onChange={(e) => handleChange('Site ', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  {['DT3', 'DT4 L1', 'DT4 L4', 'DT4 L5', 'DT4 L6'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors['Site '] && (
                  <p className="text-[11px] text-rose-500 mt-1">{errors['Site ']}</p>
                )}
              </div>

              {/* Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Zone
                </label>
                <select
                  value={formData['Zone'] || 'Zone A'}
                  onChange={(e) => handleChange('Zone', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  {['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F'].map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  list="location-list"
                  placeholder="e.g. Washroom, Cafeteria"
                  value={formData['Location'] || ''}
                  onChange={(e) => handleChange('Location', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <datalist id="location-list">
                  {[
                    'Washroom',
                    'Social Hub',
                    'Cafeteria',
                    'Reception',
                    'Innovation Hub',
                    'Workstation',
                    'Passage',
                    'Breakout Area',
                  ].map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* Section 2: Dates & Times */}
          <div>
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 pb-1 border-b border-indigo-100 flex items-center gap-1.5">
              <span>2. Timeline & Schedule</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Report Date
                </label>
                <input
                  type="date"
                  value={formData['Date '] || ''}
                  onChange={(e) => handleChange('Date ', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Month */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Month
                </label>
                <input
                  type="date"
                  value={formData['Month '] || ''}
                  onChange={(e) => handleChange('Month ', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Report Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Report Time
                </label>
                <input
                  type="text"
                  placeholder="HH:MM:SS"
                  value={formData['Report Time'] || ''}
                  onChange={(e) => handleChange('Report Time', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Date close */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Close Date
                </label>
                <input
                  type="date"
                  value={formData['Date close '] || ''}
                  onChange={(e) => handleChange('Date close ', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Resolved time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolved Time
                </label>
                <input
                  type="text"
                  placeholder="HH:MM:SS"
                  value={formData['Resolved time'] || ''}
                  onChange={(e) => handleChange('Resolved time', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Classification & Assignment */}
          <div>
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 pb-1 border-b border-indigo-100 flex items-center gap-1.5">
              <span>3. Classification, Priority & Status</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Request Category
                </label>
                <select
                  value={formData['Request category'] || 'Housekeeping'}
                  onChange={(e) => handleChange('Request category', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  {[
                    'Housekeeping',
                    'HVAC',
                    'E&M',
                    'Event',
                    'EMPLOYEE ACCESS',
                    'Locker request',
                  ].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData['Priority'] || 'Medium'}
                  onChange={(e) => handleChange('Priority', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-medium"
                >
                  <option value="High" className="text-rose-600 font-semibold">High</option>
                  <option value="Medium" className="text-amber-600 font-semibold">Medium</option>
                  <option value="Low" className="text-emerald-600 font-semibold">Low</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={formData['Status '] || 'Open'}
                  onChange={(e) => handleChange('Status ', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-medium"
                >
                  <option value="Open">Open</option>
                  <option value="In-Progress">In-Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Not Resolved">Not Resolved</option>
                </select>
              </div>

              {/* is On TAT */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  On TAT / SLA
                </label>
                <select
                  value={String(formData['is On TAT'] || '1')}
                  onChange={(e) => handleChange('is On TAT', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="1">1 (Within SLA / TAT)</option>
                  <option value="0">0 (SLA Breached)</option>
                </select>
              </div>

              {/* Assignee / Engineer */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assignee / Engineer
                </label>
                <input
                  type="text"
                  list="assignee-list"
                  placeholder="e.g. Wajid CBRE"
                  value={formData['Employee Name '] || ''}
                  onChange={(e) => handleChange('Employee Name ', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <datalist id="assignee-list">
                  {[
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
                  ].map((eng) => (
                    <option key={eng} value={eng} />
                  ))}
                </datalist>
              </div>

              {/* Request Via */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Request Via
                </label>
                <select
                  value={formData['Request Via '] || 'In person'}
                  onChange={(e) => handleChange('Request Via ', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  {['In person', 'Phone', 'Mail', 'Feedback Form'].map((via) => (
                    <option key={via} value={via}>
                      {via}
                    </option>
                  ))}
                </select>
              </div>

              {/* Request from */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Request From
                </label>
                <input
                  type="text"
                  placeholder="e.g. Employee or Team"
                  value={formData['Request from '] || ''}
                  onChange={(e) => handleChange('Request from ', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Call type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Call Type
                </label>
                <select
                  value={formData['Call type'] || 'Reactive'}
                  onChange={(e) => handleChange('Call type', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="Reactive">Reactive</option>
                  <option value="Proactive">Proactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Details & Action */}
          <div>
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 pb-1 border-b border-indigo-100 flex items-center gap-1.5">
              <span>4. Details & Action Plan</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Zone A dustbin required cleaning or AC cooling issue..."
                  value={formData['Discription '] || ''}
                  onChange={(e) => handleChange('Discription ', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors['Discription '] && (
                  <p className="text-[11px] text-rose-500 mt-1">{errors['Discription ']}</p>
                )}
              </div>

              {/* Action Taken */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Action Taken
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Informed HK team to check & clean / Tech team rectified..."
                  value={formData['Action Taken '] || ''}
                  onChange={(e) => handleChange('Action Taken ', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Remark */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remark
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional observations or notes..."
                  value={formData['Remark'] || ''}
                  onChange={(e) => handleChange('Remark', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm hover:shadow transition flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isEdit ? 'Save Changes' : 'Create Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
