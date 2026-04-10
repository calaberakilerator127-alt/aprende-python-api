import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, X, Info } from 'lucide-react';

export default function Toast({ toast }) {
  if (!toast) return null;
  
  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';
  const isInfo = toast.type === 'info';

  const iconMap = {
    error: <XCircle size={22} className="text-red-500" />,
    warning: <AlertTriangle size={22} className="text-amber-500" />,
    info: <Info size={22} className="text-blue-500" />,
    success: <CheckCircle size={22} className="text-emerald-500" />
  };

  const bgStyles = {
    error: 'border-red-500/50 bg-red-50/90 dark:bg-red-900/20',
    warning: 'border-amber-500/50 bg-amber-50/90 dark:bg-amber-900/20',
    info: 'border-blue-500/50 bg-blue-50/90 dark:bg-blue-900/20',
    success: 'border-emerald-500/50 bg-emerald-50/90 dark:bg-emerald-900/20'
  };

  const type = toast.type || 'success';

  return (
    <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-[1.5rem] shadow-2xl flex items-center gap-4 animate-scale-in z-[200] border-2 backdrop-blur-xl transition-all ${bgStyles[type]}`}>
      <div className="flex-shrink-0 animate-pulse-slow">
        {iconMap[type]}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-black uppercase tracking-widest ${isError ? 'text-red-700 dark:text-red-400' : isWarning ? 'text-amber-700 dark:text-amber-400' : isInfo ? 'text-blue-700 dark:text-blue-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {toast.message}
        </p>
      </div>
    </div>
  );
}
