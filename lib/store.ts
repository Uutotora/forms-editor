'use client';

import { create } from 'zustand';
import type { Question, QuestionSummary } from './types';

export interface Toast {
  message: string;
  type: 'success' | 'error';
}

const REQUIRED_FIELDS: { path: string; label: string }[] = [
  { path: 'card.id', label: 'ID вопроса' },
  { path: 'card.questionText', label: 'Текст вопроса' },
];

function validateQuestion(q: Question): string[] {
  const errors: string[] = [];
  for (const { path, label } of REQUIRED_FIELDS) {
    const [section, field] = path.split('.') as ['card', keyof Question['card']];
    const value = (q[section] as Record<string, string>)[field];
    if (!value || !value.trim()) errors.push(label);
  }
  return errors;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const MAX_HISTORY = 100;

interface Store {
  questions: QuestionSummary[];
  currentQuestion: Question | null;
  savedQuestion: Question | null;
  history: Question[];
  historyIndex: number;
  isDirty: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  syncProgress: number;       // 0–100, для прогресс-бара
  syncWarning: boolean;
  savedFlash: boolean;        // кратковременная зелёная подсветка после сохранения
  toast: Toast | null;
  pendingNavigation: string | null;
  validationErrors: string[];
  unsavedQuestions: Record<string, Question>;

  loadQuestions: () => Promise<void>;
  loadQuestion: (sheetName: string) => Promise<void>;
  updateQuestion: (data: Partial<Question>) => void;
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;
  saveQuestion: () => Promise<void>;
  sync: () => void;
  performSync: () => Promise<void>;
  showToast: (message: string, type: Toast['type']) => void;
  hideToast: () => void;
  setPendingNavigation: (path: string | null) => void;
  clearValidationErrors: () => void;
  storeUnsavedQuestion: (sheetName: string, question: Question) => void;
  setSyncWarning: (value: boolean) => void;
}

export const useStore = create<Store>((set, get) => ({
  questions: [],
  currentQuestion: null,
  savedQuestion: null,
  history: [],
  historyIndex: -1,
  isDirty: false,
  isSaving: false,
  isSyncing: false,
  syncProgress: 0,
  syncWarning: false,
  savedFlash: false,
  toast: null,
  pendingNavigation: null,
  validationErrors: [],
  unsavedQuestions: {},

  loadQuestions: async () => {
    const res = await fetch('/api/questions');
    const { questions } = await res.json();
    set({ questions });
  },

  loadQuestion: async (sheetName: string) => {
    const res = await fetch(`/api/question/${encodeURIComponent(sheetName)}`);
    const { question: serverQuestion } = await res.json();
    const { unsavedQuestions } = get();
    const unsaved = unsavedQuestions[sheetName];

    if (unsaved) {
      set({
        currentQuestion: unsaved,
        savedQuestion: serverQuestion,
        history: [serverQuestion, unsaved],
        historyIndex: 1,
        isDirty: true,
        validationErrors: [],
      });
    } else {
      set({
        currentQuestion: serverQuestion,
        savedQuestion: serverQuestion,
        history: [serverQuestion],
        historyIndex: 0,
        isDirty: false,
        validationErrors: [],
      });
    }
  },

  updateQuestion: (data: Partial<Question>) => {
    const current = get().currentQuestion;
    if (!current) return;
    set({ currentQuestion: { ...current, ...data }, isDirty: true });
  },

  commitHistory: () => {
    const { currentQuestion, history, historyIndex, savedQuestion } = get();
    if (!currentQuestion) return;
    if (deepEqual(history[historyIndex], currentQuestion)) return;
    const newHistory = [...history.slice(0, historyIndex + 1), currentQuestion].slice(-MAX_HISTORY);
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
      isDirty: !deepEqual(currentQuestion, savedQuestion),
    });
  },

  undo: () => {
    const { history, historyIndex, savedQuestion } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const question = history[newIndex];
    set({ currentQuestion: question, historyIndex: newIndex, isDirty: !deepEqual(question, savedQuestion) });
  },

  redo: () => {
    const { history, historyIndex, savedQuestion } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const question = history[newIndex];
    set({ currentQuestion: question, historyIndex: newIndex, isDirty: !deepEqual(question, savedQuestion) });
  },

  saveQuestion: async () => {
    const { currentQuestion, questions, unsavedQuestions } = get();
    if (!currentQuestion) return;

    const errors = validateQuestion(currentQuestion);
    if (errors.length > 0) {
      set({ validationErrors: errors });
      get().showToast(`Заполните обязательные поля: ${errors.join(', ')}`, 'error');
      return;
    }

    set({ isSaving: true, validationErrors: [] });
    try {
      const res = await fetch(`/api/question/${encodeURIComponent(currentQuestion.sheetName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentQuestion),
      });
      if (!res.ok) throw new Error('Save failed');

      const newUnsaved = { ...unsavedQuestions };
      delete newUnsaved[currentQuestion.sheetName];

      set({
        isSaving: false,
        isDirty: false,
        savedQuestion: currentQuestion,
        savedFlash: true,
        unsavedQuestions: newUnsaved,
        questions: questions.map((q) =>
          q.sheetName === currentQuestion.sheetName ? { ...q, hasChanges: true } : q
        ),
      });

      // Сбрасываем зелёный флеш через 1.5 сек
      setTimeout(() => set({ savedFlash: false }), 1500);

      get().showToast('Изменения сохранены', 'success');
    } catch {
      set({ isSaving: false });
      get().showToast('Ошибка сохранения. Попробуйте ещё раз.', 'error');
    }
  },

  sync: () => {
    const { isDirty, unsavedQuestions } = get();
    const hasAnyUnsaved = isDirty || Object.keys(unsavedQuestions).length > 0;
    if (hasAnyUnsaved) {
      set({ syncWarning: true });
    } else {
      get().performSync();
    }
  },

  performSync: async () => {
    set({ isSyncing: true, syncWarning: false, syncProgress: 0 });

    // Симуляция прогресса: быстро до 25%, потом медленно до 85%
    set({ syncProgress: 15 });
    const progressInterval = setInterval(() => {
      const current = get().syncProgress;
      if (current < 82) {
        set({ syncProgress: Math.min(Math.floor(current + Math.random() * 5 + 1), 82) });
      }
    }, 250);

    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      const { questions } = await res.json();

      clearInterval(progressInterval);

      const { currentQuestion } = get();

      // После sync: все точки слетают — таблица и есть источник истины
      const cleanQuestions = questions.map((q: QuestionSummary) => ({ ...q, hasChanges: false }));
      set({ questions: cleanQuestions, unsavedQuestions: {}, syncProgress: 92 });

      // Перезагружаем текущий вопрос
      if (currentQuestion) {
        const r = await fetch(`/api/question/${encodeURIComponent(currentQuestion.sheetName)}`);
        const { question } = await r.json();
        set({
          currentQuestion: question,
          savedQuestion: question,
          history: [question],
          historyIndex: 0,
          isDirty: false,
          validationErrors: [],
        });
      }

      // Плавно доводим до 100%
      set({ syncProgress: 100 });
      await new Promise((r) => setTimeout(r, 500));

      set({ isSyncing: false, syncProgress: 0 });
      get().showToast('Синхронизация выполнена', 'success');
    } catch {
      clearInterval(progressInterval);
      set({ isSyncing: false, syncProgress: 0 });
      get().showToast('Ошибка синхронизации', 'error');
    }
  },

  showToast: (message: string, type: Toast['type']) => {
    set({ toast: { message, type } });
  },

  hideToast: () => {
    set({ toast: null });
  },

  setPendingNavigation: (path: string | null) => {
    set({ pendingNavigation: path });
  },

  clearValidationErrors: () => {
    set({ validationErrors: [] });
  },

  storeUnsavedQuestion: (sheetName: string, question: Question) => {
    set({ unsavedQuestions: { ...get().unsavedQuestions, [sheetName]: question } });
  },

  setSyncWarning: (value: boolean) => {
    set({ syncWarning: value });
  },
}));
