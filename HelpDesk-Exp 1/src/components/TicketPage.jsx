import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  RotateCcw,
  FileText,
  MapPin,
  Calendar,
  Layers,
  FileCheck2,
  AlertCircle,
  Save,
  Building2,
  Clock,
  User,
  Sparkles,
} from 'lucide-react';
import { COLUMNS_SCHEMA, createEmptyTicket, getCurrentShortMonth, VALID_REQUEST_CATEGORIES, normalizeTicketFields } from '../utils/schema';

export default function TicketPage({
  initialTicket = null,
  onSave,
  onBack,
  selectedYear = '2026',
}) {
  const isEdit = !!initialTicket;
  const [formData, setFormData] = useState(() => {
    if (initialTicket) {
      return normalizeTicketFields({ ...createEmptyTicket(), ...initialTicket });
    }
    const empty = createEmptyTicket();
    const yr = selectedYear === '2025' ? '2025' : '2026';
    empty.year = yr;
    if (yr === '2025') {
      empty['Month '] = 'Jan-25';
      empty['Date '] = '2025-01-15';
      empty['Date close '] = '2025-01-15';
    }
    return normalizeTicketFields(empty);
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialTicket) {
      setFormData(normalizeTicketFields({ ...createEmptyTicket(), ...initialTicket }));
    }
  }, [initialTicket]);

  const handleChange = (key, value) => {
    setFormData((prev) => {
      const updated = {
        ...prev,
        [key]: value,
      };
      if (key === 'Action Taken ') updated['Action taken '] = value;
      if (key === 'Action taken ') updated['Action Taken '] = value;
      if (key === 'Discription ') updated['Description'] = value;
      if (key === 'Description') updated['Discription '] = value;
      if (key === 'Date close ') updated['Date close'] = value;
      if (key === 'Date close') updated['Date close '] = value;
      if (key === 'Resolved time') updated['Resolved time '] = value;
      if (key === 'Resolved time ') updated['Resolved time'] = value;
      if (key === 'Report Time') updated['Report time'] = value;
      if (key === 'Report time') updated['Report Time'] = value;
      return updated;
    });
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const handleReset = () => {
    if (confirm('Reset form to initial values?')) {
      if (initialTicket) {
        setFormData({ ...createEmptyTicket(), ...initialTicket });
      } else {
        const empty = createEmptyTicket();
        const yr = selectedYear === '2025' ? '2025' : '2026';
        empty.year = yr;
        if (yr === '2025') {
          empty['Month '] = 'Jan-25';
          empty['Date '] = '2025-01-15';
          empty['Date close '] = '2025-01-15';
        }
        setFormData(empty);
      }
      setErrors({});
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const newErrors = {};

    if (!formData['Site ']) newErrors['Site '] = 'Site / Floor is required';
    if (!formData['Discription ']) newErrors['Discription '] = 'Description is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(normalizeTicketFields(formData));
      onBack();
    } catch (err) {
      alert('Error saving ticket: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-24 sm:pb-12">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1.5 text-xs font-semibold"
              title="Return to Ticket Grid"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
              <span className="hidden sm:inline">Back to Grid</span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {isEdit ? `Update Ticket #${formData['Sr no.'] || initialTicket?.id}` : 'Create New Ticket'}
                </h1>
                <span className="text-[11px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                  FY {formData.year === '2025' ? '24-25' : '25-26'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Exact 20 Excel columns matching your uploaded tracker
              </p>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleReset}
              className="hidden sm:inline-flex items-center px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm hover:shadow transition disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-1.5" />
              <span>{isSubmitting ? 'Saving...' : isEdit ? 'Save Updates' : 'Create Ticket'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {Object.keys(errors).length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-800">Please correct the following fields:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {Object.values(errors).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Section 1: Location & Reference */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  1. Location & Identification
                </h2>
                <p className="text-xs text-slate-400">Sr no., Site/Floor, Zone, Location</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Sr no. */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sr no.
                </label>
                <input
                  type="text"
                  placeholder="Auto-generated if empty"
                  value={formData['Sr no.'] || ''}
                  onChange={(e) => handleChange('Sr no.', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              {/* Site */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Site <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData['Site '] || 'DT3'}
                  onChange={(e) => handleChange('Site ', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                >
                  {['DT3', 'DT4 L1', 'DT4 L4', 'DT4 L5', 'DT4 L6'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors['Site '] && (
                  <p className="text-xs text-rose-500 mt-1">{errors['Site ']}</p>
                )}
              </div>

              {/* Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Zone
                </label>
                <select
                  value={formData['Zone'] || 'Zone A'}
                  onChange={(e) => handleChange('Zone', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  list="page-location-list"
                  placeholder="e.g. Washroom, Cafeteria"
                  value={formData['Location'] || ''}
                  onChange={(e) => handleChange('Location', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
                <datalist id="page-location-list">
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

          {/* Section 2: Timeline & Dates */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  2. Timeline & Schedule
                </h2>
                <p className="text-xs text-slate-400">Month (Short Month format e.g. Jan-26), Report Date, Times</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Month (Short Month format) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Month <span className="text-[11px] text-slate-400">(Short Month)</span>
                </label>
                <input
                  type="text"
                  list="short-month-list"
                  placeholder="e.g. Jan-26"
                  value={formData['Month '] || ''}
                  onChange={(e) => handleChange('Month ', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-medium"
                />
                <datalist id="short-month-list">
                  {[
                    'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26',
                    'Jul-26', 'Aug-26', 'Sep-26', 'Oct-26', 'Nov-26', 'Dec-26',
                    'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25'
                  ].map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={formData['Date '] || ''}
                  onChange={(e) => handleChange('Date ', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              {/* Report Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Report Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 08:24 AM or 14:30"
                  value={formData['Report Time'] || formData['Report time'] || ''}
                  onChange={(e) => handleChange('Report Time', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              {/* Date close */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Date close
                </label>
                <input
                  type="date"
                  value={formData['Date close '] || ''}
                  onChange={(e) => handleChange('Date close ', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              {/* Resolved time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Resolved time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 08:48 AM or 14:30"
                  value={formData['Resolved time'] || formData['Resolved time '] || ''}
                  onChange={(e) => handleChange('Resolved time', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Classification & Assignment */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  3. Classification, Priority & Assignment
                </h2>
                <p className="text-xs text-slate-400">Request category, Employee Name, Status, is On TAT (Yes/No)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Request category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Request category
                </label>
                <select
                  value={formData['Request category'] || 'Housekeeping'}
                  onChange={(e) => handleChange('Request category', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-medium"
                >
                  {VALID_REQUEST_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Priority
                </label>
                <select
                  value={formData['Priority'] || 'Medium'}
                  onChange={(e) => handleChange('Priority', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-semibold text-slate-800"
                >
                  <option value="High" className="text-rose-600 font-bold">High</option>
                  <option value="Medium" className="text-amber-600 font-bold">Medium</option>
                  <option value="Low" className="text-emerald-600 font-bold">Low</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status
                </label>
                <select
                  value={formData['Status '] || 'Open'}
                  onChange={(e) => handleChange('Status ', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-semibold"
                >
                  <option value="Open">Open</option>
                  <option value="In-Progress">In-Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Not Resolved">Not Resolved</option>
                </select>
              </div>

              {/* is On TAT (Yes / No) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  is On TAT
                </label>
                <select
                  value={formData['is On TAT'] || 'Yes'}
                  onChange={(e) => handleChange('is On TAT', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-semibold"
                >
                  <option value="Yes" className="text-emerald-600 font-bold">Yes (Within SLA / TAT)</option>
                  <option value="No" className="text-rose-600 font-bold">No (SLA Breached)</option>
                </select>
              </div>

              {/* Employee Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Employee Name
                </label>
                <input
                  type="text"
                  list="page-assignee-list"
                  placeholder="e.g. Wajid CBRE"
                  value={formData['Employee Name '] || ''}
                  onChange={(e) => handleChange('Employee Name ', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
                <datalist id="page-assignee-list">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Request Via
                </label>
                <select
                  value={formData['Request Via '] || 'In person'}
                  onChange={(e) => handleChange('Request Via ', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Request from
                </label>
                <input
                  type="text"
                  placeholder="e.g. Employee or Team"
                  value={formData['Request from '] || ''}
                  onChange={(e) => handleChange('Request from ', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              {/* Call type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Call type
                </label>
                <select
                  value={formData['Call type'] || 'Reactive'}
                  onChange={(e) => handleChange('Call type', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                >
                  <option value="Reactive">Reactive</option>
                  <option value="Proactive">Proactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Details & Action */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  4. Details & Action Taken
                </h2>
                <p className="text-xs text-slate-400">Discription, Action Taken, Remark</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Discription */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Discription <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Zone A dustbin required cleaning, AC cooling issue, hydraulic table not working..."
                  value={formData['Discription '] || ''}
                  onChange={(e) => handleChange('Discription ', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
                {errors['Discription '] && (
                  <p className="text-xs text-rose-500 mt-1">{errors['Discription ']}</p>
                )}
              </div>

              {/* Action Taken */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Action Taken
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Informed HK team to check & clean, technician rectified table..."
                  value={formData['Action Taken '] || formData['Action taken '] || ''}
                  onChange={(e) => handleChange('Action Taken ', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>

              {/* Remark */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Remark
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional notes, escalation notes, or vendor references..."
                  value={formData['Remark'] || ''}
                  onChange={(e) => handleChange('Remark', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
            </div>
          </div>
        </form>
      </main>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3 flex items-center justify-between gap-3 sm:hidden shadow-lg z-30">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 py-2.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? 'Saving...' : isEdit ? 'Save Updates' : 'Create Ticket'}</span>
        </button>
      </div>
    </div>
  );
}
