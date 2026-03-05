'use client';

import { create } from 'zustand';
import type { Question, QuestionSummary } from './types';

export interface Toast {
  message: string;
  type: 'success' | 'error';
}

// Fields that must not be empty before saving
const REQUIRED_FIELDS: { path: string; label: string }[] = [
  { path: 'card.id', label: 'ID вопроса' },
  { path: 'card.questionText', label: 'Текст вопроса' },
];

function validateQuestion(q: Question): string[] {
  const errors: string[] = [];
  for (const { path, label } of REQUIRED_FIELDS) {
    const [section, field] = path.split('.') as ['card', keyof Question['card']];
    const value = (q[section] as Record<string, string>)[field];
    if (!value || !value.trim()) {
      errors.push(label);
    }
  }
  return errors;
}

interface Store {
  questions: QuestionSummary[];
  currentQuestion: Question | null;
  isDirty: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  isResetting: boolean;
  toast: Toast | null;
  pendingNavigation: string | null;
  validationErrors: string[];
  loadQuestions: () => Promise<void>;
  loadQuestion: (sheetName: string) => Promise<void>;
  updateQuestion: (data: Partial<Question>) => void;
  saveQuestion: () => Promise<void>;
  resetQuestion: () => Promise<void>;
  sync: () => Promise<void>;
  showToast: (message: string, type: Toast['type']) => void;
  hideToast: () => void;
  setPendingNavigation: (path: string | null) => void;
  clearValidationErrors: () => void;
}

export const useStore = create<Store>((set, get) => ({
  questions: [],
  currentQuestion: null,
  isDirty: false,
  isSaving: false,
  isSyncing: false,
  isResetting: false,
  toast: null,
  pendingNavigation: null,
  validationErrors: [],

  loadQuestions: async () => {
    const res = await fetch('/api/questions');
    const { questions } = await res.json();
    set({ questions });
  },

  loadQuestion: async (sheetName: string) => {
    const res = await fetch(`/api/question/${encodeURIComponent(sheetName)}`);
    const { question } = await res.json();
    set({ currentQuestion: question, isDirty: false, validationErrors: [] });
  },

  updateQuestion: (data: Partial<Question>) => {
    const current = get().currentQuestion;
    if (!current) return;
    set({ currentQuestion: { ...current, ...data }, isDirty: true });
  },

  saveQuestion: async () => {
    const { currentQuestion, questions } = get();
    if (!currentQuestion) return;

    // Validate before saving
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
      set({
        isSaving: false,
        isDirty: false,
        questions: questions.map((q) =>
          q.sheetName === currentQuestion.sheetName ? { ...q, hasChanges: true } : q
        ),
      });
      get().showToast('Изменения сохранены', 'success');
    } catch {
      set({ isSaving: false });
      get().showToast('Ошибка сохранения. Попробуйте ещё раз.', 'error');
    }
  },

  resetQuestion: async () => {
    const { currentQuestion } = get();
    if (!currentQuestion) return;
    set({ isResetting: true });
    const res = await fetch(`/api/question/${encodeURIComponent(currentQuestion.sheetName)}`);
    const { question } = await res.json();
    set({ currentQuestion: question, isDirty: false, isResetting: false, validationErrors: [] });
    get().showToast('Изменения сброшены', 'success');
  },

  sync: async () => {
    set({ isSyncing: true });
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      get().showToast('Синхронизация выполнена', 'success');
    } catch {
      get().showToast('Ошибка синхронизации', 'error');
    } finally {
      set({ isSyncing: false });
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
}));
