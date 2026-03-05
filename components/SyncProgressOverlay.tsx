'use client';

import { useStore } from '@/lib/store';
import { RefreshCw } from 'lucide-react';

export function SyncProgressOverlay() {
  const { isSyncing, syncProgress } = useStore();

  if (!isSyncing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[3px]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-80">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Синхронизация</p>
            <p className="text-xs text-gray-400">Загрузка данных из таблицы...</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${syncProgress}%` }}
          />
        </div>

        <p className="text-right text-xs text-gray-400 tabular-nums">{syncProgress}%</p>
      </div>
    </div>
  );
}
