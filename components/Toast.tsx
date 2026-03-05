'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { CheckCircle2, XCircle, X } from 'lucide-react';

export function Toast() {
  const { toast, hideToast } = useStore();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hideToast, 3000);
    return () => clearTimeout(timer);
  }, [toast, hideToast]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium min-w-[220px] ${
          isSuccess
            ? 'bg-gray-900 text-white'
            : 'bg-red-600 text-white'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-200 flex-shrink-0" />
        )}
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={hideToast}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
