import React from 'react';
import { X } from 'lucide-react';
import UserManagementView, { ROLE_CONFIGS } from './UserManagementView';

export { ROLE_CONFIGS };

export default function UserManagementModal({ isOpen, onClose, currentUser }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition z-10"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="p-6 overflow-y-auto flex-1">
          <UserManagementView currentUser={currentUser} isPage={false} />
        </div>
      </div>
    </div>
  );
}
