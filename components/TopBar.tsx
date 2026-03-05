'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Save, Loader2, RefreshCw, RotateCcw } from 'lucide-react';

export function TopBar() {
  const {
    currentQuestion,
    isDirty,
    isSaving,
    isSyncing,
    isResetting,
    saveQuestion,
    resetQuestion,
    sync,
  } = useStore();

  // Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !isSaving) saveQuestion();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, isSaving, saveQuestion]);

  // Warn on tab close with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  if (!currentQuestion) return null;

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-6 gap-4 flex-shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-gray-900 truncate">
          {currentQuestion.title || currentQuestion.sheetName}
        </h1>
        <p className="text-xs text-gray-400">{currentQuestion.sheetName}</p>
      </div>

      <div className="flex items-center gap-2">
        {isDirty && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 mr-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Есть изменения
          </div>
        )}

        {/* Reset button — only when dirty */}
        {isDirty && (
          <button
            onClick={resetQuestion}
            disabled={isResetting}
            title="Сбросить все изменения"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all duration-150 disabled:opacity-50"
          >
            <RotateCcw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Сбросить</span>
          </button>
        )}

        {/* Sync button */}
        <button
          onClick={sync}
          disabled={isSyncing}
          title="Синхронизировать с таблицей"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-150 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
        </button>

        {/* Save button */}
        <button
          onClick={saveQuestion}
          disabled={!isDirty || isSaving}
          title="Сохранить (Ctrl+S)"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            isDirty && !isSaving
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </header>
  );
}
