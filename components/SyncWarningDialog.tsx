'use client';

import { useStore } from '@/lib/store';
import { RefreshCw } from 'lucide-react';

export function SyncWarningDialog() {
  const { syncWarning, setSyncWarning, performSync, unsavedQuestions, isDirty } = useStore();

  if (!syncWarning) return null;

  const count = Object.keys(unsavedQuestions).length + (isDirty ? 1 : 0);

  const handleSync = () => {
    performSync();
  };

  const handleCancel = () => {
    setSyncWarning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={handleCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Синхронизация с таблицей
            </h3>
            <p className="text-sm text-gray-500">
              {count > 1
                ? `У вас есть несохранённые изменения в ${count} вопросах.`
                : 'У вас есть несохранённые изменения.'}{' '}
              Синхронизация загрузит актуальные данные из таблицы и изменения будут потеряны.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={handleSync}
            className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Синхронизировать
          </button>
          <button
            onClick={handleCancel}
            className="w-full px-4 py-2.5 bg-gray-50 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
