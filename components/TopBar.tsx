'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Save, Loader2, RefreshCw, Undo2, Redo2 } from 'lucide-react';

export function TopBar() {
  const {
    currentQuestion,
    isDirty,
    isSaving,
    isSyncing,
    historyIndex,
    history,
    saveQuestion,
    undo,
    redo,
    sync,
  } = useStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !isSaving) saveQuestion();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      if (
        (e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey ||
        (e.ctrlKey || e.metaKey) && e.key === 'y'
      ) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, isSaving, canUndo, canRedo, saveQuestion, undo, redo]);

  // Warn on tab close
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

      <div className="flex items-center gap-1">
        {isDirty && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 mr-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Есть изменения
          </div>
        )}

        {/* Undo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Отменить (Ctrl+Z)"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
        >
          <Undo2 className="h-4 w-4" />
        </button>

        {/* Redo */}
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Повторить (Ctrl+Shift+Z)"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Sync */}
        <button
          onClick={sync}
          disabled={isSyncing}
          title="Синхронизировать с таблицей"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-150 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
        </button>

        {/* Save */}
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
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </header>
  );
}
