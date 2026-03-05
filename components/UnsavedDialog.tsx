'use client';

import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { AlertTriangle } from 'lucide-react';

export function UnsavedDialog() {
  const { pendingNavigation, setPendingNavigation, saveQuestion, currentQuestion, storeUnsavedQuestion } = useStore();
  const router = useRouter();

  if (!pendingNavigation) return null;

  const handleSaveAndGo = async () => {
    await saveQuestion();
    const path = pendingNavigation;
    setPendingNavigation(null);
    router.push(path);
  };

  const handleDiscardAndGo = () => {
    // Сохраняем несохранённое состояние — при возврате восстановится с жёлтой подсветкой
    if (currentQuestion) {
      storeUnsavedQuestion(currentQuestion.sheetName, currentQuestion);
    }
    const path = pendingNavigation;
    setPendingNavigation(null);
    router.push(path);
  };

  const handleCancel = () => {
    setPendingNavigation(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={handleCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Несохранённые изменения</h3>
            <p className="text-sm text-gray-500">
              Вы изменили данные вопроса, но не сохранили. Что сделать с изменениями?
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={handleSaveAndGo}
            className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Сохранить и перейти
          </button>
          <button
            onClick={handleDiscardAndGo}
            className="w-full px-4 py-2.5 bg-gray-50 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors"
          >
            Перейти без сохранения
          </button>
          <button
            onClick={handleCancel}
            className="w-full px-4 py-2.5 text-gray-400 text-sm hover:text-gray-600 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
