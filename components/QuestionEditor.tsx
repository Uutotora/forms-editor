'use client';

import { useStore } from '@/lib/store';
import type { Question, ControlRow, AnswerRow } from '@/lib/types';
import { Plus, Trash2 } from 'lucide-react';

const APPROVAL_LABELS: Record<string, string> = {
  rosstat: 'Утвержден Росстат',
  depr: 'Утвержден ДЭПР',
  ntu: 'Утвержден НТУ',
  dit: 'Утвержден ДИТ',
};

const CARD_LABELS: Record<string, string> = {
  id: 'ID вопроса',
  abbreviation: 'Аббревиатура',
  fillType: 'Тип заполнения',
  precondition: 'Предусловие',
  questionText: 'Текст вопроса',
  helpText: 'Текст справки',
};

// Must match labels in store.ts REQUIRED_FIELDS
const REQUIRED_CARD_FIELDS: Record<string, string> = {
  id: 'ID вопроса',
  questionText: 'Текст вопроса',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
      {children}
    </h2>
  );
}

function FieldRow({
  label,
  children,
  required,
  hasError,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hasError?: boolean;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 items-start py-3 border-b border-gray-100 last:border-0">
      <span className={`text-sm pt-1.5 font-medium flex items-center gap-1 ${hasError ? 'text-red-500' : 'text-gray-500'}`}>
        {label}
        {required && <span className="text-red-400 text-xs leading-none">*</span>}
      </span>
      <div>{children}</div>
    </div>
  );
}

function ApprovalToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isYes = value === 'Да';
  return (
    <button
      onClick={() => onChange(isYes ? 'Нет' : 'Да')}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
        isYes
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isYes ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      {isYes ? 'Да' : 'Нет'}
    </button>
  );
}

function EditableField({
  value,
  onChange,
  multiline = false,
  placeholder = '—',
  hasError = false,
}: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  hasError?: boolean;
}) {
  const baseClass = 'w-full text-sm text-gray-900 bg-transparent rounded-md px-2 py-1.5 focus:bg-white focus:outline-none transition-all';
  const normalBorder = 'border border-transparent hover:border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200';
  const errorBorder = 'border border-red-300 bg-red-50 focus:border-red-400 focus:ring-1 focus:ring-red-200 placeholder:text-red-300';

  const className = `${baseClass} ${hasError ? errorBorder : normalBorder} ${multiline ? 'resize-y' : ''}`;

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={className}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${className} placeholder:text-gray-300`}
    />
  );
}

export function QuestionEditor() {
  const { currentQuestion, updateQuestion, validationErrors } = useStore();

  if (!currentQuestion) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Выберите вопрос из списка слева
      </div>
    );
  }

  const q = currentQuestion;

  const updateApproval = (key: string, value: string) => {
    updateQuestion({ approval: { ...q.approval, [key]: value } });
  };

  const updateCard = (key: string, value: string) => {
    updateQuestion({ card: { ...q.card, [key]: value } });
  };

  const updateControl = (idx: number, key: keyof ControlRow, value: string) => {
    const controls = q.controls.map((c, i) => (i === idx ? { ...c, [key]: value } : c));
    updateQuestion({ controls });
  };

  const addControl = () => {
    updateQuestion({
      controls: [...q.controls, { id: '', type: '', conditions: '', strictness: '' }],
    });
  };

  const removeControl = (idx: number) => {
    updateQuestion({ controls: q.controls.filter((_, i) => i !== idx) });
  };

  const updateAnswer = (idx: number, key: keyof AnswerRow, value: string) => {
    const answers = q.answers.map((a, i) => (i === idx ? { ...a, [key]: value } : a));
    updateQuestion({ answers });
  };

  const addAnswer = () => {
    updateQuestion({
      answers: [
        ...q.answers,
        { number: String(q.answers.length + 1), type: '', headerText: '', hintText: '-', defaultValue: '-', code: '', nextId: '' },
      ],
    });
  };

  const removeAnswer = (idx: number) => {
    updateQuestion({ answers: q.answers.filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">

        {/* Title */}
        <div>
          <input
            type="text"
            value={q.title}
            onChange={(e) => updateQuestion({ title: e.target.value })}
            className="w-full text-2xl font-bold text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0 p-0 placeholder:text-gray-300"
            placeholder="Заголовок вопроса"
          />
        </div>

        {/* Approval Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>Статус утверждения</SectionTitle>
          <div className="space-y-0">
            {(Object.keys(APPROVAL_LABELS) as Array<keyof typeof APPROVAL_LABELS>).map((key) => (
              <FieldRow key={key} label={APPROVAL_LABELS[key]}>
                <ApprovalToggle
                  value={q.approval[key as keyof typeof q.approval] || 'Нет'}
                  onChange={(v) => updateApproval(key, v)}
                />
              </FieldRow>
            ))}
          </div>
        </div>

        {/* Card Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>Карточка вопроса</SectionTitle>
          <div className="space-y-0">
            {(Object.keys(CARD_LABELS) as Array<keyof typeof CARD_LABELS>).map((key) => {
              const isRequired = key in REQUIRED_CARD_FIELDS;
              const label = CARD_LABELS[key];
              const hasError = isRequired && validationErrors.includes(label);
              return (
                <FieldRow key={key} label={label} required={isRequired} hasError={hasError}>
                  <EditableField
                    value={q.card[key as keyof typeof q.card] || ''}
                    onChange={(v) => updateCard(key, v)}
                    multiline={['fillType', 'questionText', 'helpText', 'precondition'].includes(key)}
                    placeholder={isRequired ? 'Обязательное поле' : '—'}
                    hasError={hasError}
                  />
                </FieldRow>
              );
            })}
          </div>
        </div>

        {/* Controls Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Контроли</SectionTitle>
            <button
              onClick={addControl}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить контроль
            </button>
          </div>
          {q.controls.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Нет контролей</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['ID контроля', 'Тип контроля', 'Условия контроля', 'Строгость', ''].map((h) => (
                      <th key={h} className="text-left py-2 px-2 text-xs font-medium text-gray-400 first:pl-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.controls.map((ctrl, idx) => (
                    <tr key={idx} className="border-b border-gray-50 group">
                      {(['id', 'type', 'conditions', 'strictness'] as const).map((field) => (
                        <td key={field} className="py-1.5 px-2 first:pl-0">
                          <input
                            type="text"
                            value={ctrl[field]}
                            onChange={(e) => updateControl(idx, field, e.target.value)}
                            placeholder="—"
                            className="w-full text-sm text-gray-900 bg-transparent border border-transparent rounded px-1.5 py-1 hover:border-gray-200 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 transition-all placeholder:text-gray-300"
                          />
                        </td>
                      ))}
                      <td className="py-1.5 px-2 w-8">
                        <button
                          onClick={() => removeControl(idx)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Answers Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Варианты ответов</SectionTitle>
            <button
              onClick={addAnswer}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить ответ
            </button>
          </div>
          {q.answers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Нет вариантов ответов</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['№', 'Тип ответа', 'Заголовок', 'Подсказка', 'Предуст. знач.', 'Код', 'Переход на ID', ''].map((h) => (
                      <th key={h} className="text-left py-2 px-2 text-xs font-medium text-gray-400 first:pl-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.answers.map((ans, idx) => (
                    <tr key={idx} className="border-b border-gray-50 group">
                      {(['number', 'type', 'headerText', 'hintText', 'defaultValue', 'code', 'nextId'] as const).map((field) => (
                        <td key={field} className="py-1.5 px-2 first:pl-0">
                          <input
                            type="text"
                            value={ans[field]}
                            onChange={(e) => updateAnswer(idx, field, e.target.value)}
                            placeholder="—"
                            className="w-full min-w-[60px] text-sm text-gray-900 bg-transparent border border-transparent rounded px-1.5 py-1 hover:border-gray-200 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 transition-all placeholder:text-gray-300"
                          />
                        </td>
                      ))}
                      <td className="py-1.5 px-2 w-8">
                        <button
                          onClick={() => removeAnswer(idx)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
