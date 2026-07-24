import React from 'react';
import { AlertTriangle, Ban, X } from 'lucide-react';

const VARIANT_STYLES = {
  default: {
    border: 'border-amber-600',
    icon: 'text-amber-500',
    confirmBg: 'bg-amber-700 hover:bg-amber-600',
    confirmBorder: 'border-amber-500',
  },
  warning: {
    border: 'border-yellow-600',
    icon: 'text-yellow-500',
    confirmBg: 'bg-yellow-700 hover:bg-yellow-600',
    confirmBorder: 'border-yellow-500',
  },
  danger: {
    border: 'border-red-600',
    icon: 'text-red-500',
    confirmBg: 'bg-red-700 hover:bg-red-600',
    confirmBorder: 'border-red-500',
  },
};

const ConfirmModal = ({ open, title, message, confirmText, cancelText, variant, onConfirm, onCancel }) => {
  if (!open) return null;

  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.default;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className={`w-full max-w-md bg-slate-900 border-2 ${styles.border} rounded-xl shadow-2xl animate-in zoom-in-95`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <AlertTriangle size={22} className={styles.icon} />
            <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wider">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-3 px-6 pb-5 pt-3 border-t border-slate-800">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border border-slate-700 text-slate-400 font-bold uppercase text-xs rounded hover:bg-slate-800 hover:text-white transition-all tracking-widest flex items-center justify-center gap-2"
          >
            <Ban size={14} /> {cancelText || 'Cancelar'}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 border ${styles.confirmBorder} ${styles.confirmBg} text-white font-bold uppercase text-xs rounded transition-all tracking-widest flex items-center justify-center gap-2`}
          >
            <AlertTriangle size={14} /> {confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
