'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import type { ControlRow, AnswerRow } from '@/lib/types';
import { ChevronDown } from 'lucide-react';

const APPROVAL_LABELS: Record<string, string> = {
  rosstat: 'Росстат',
  depr: 'ДЭПР',
  ntu: 'НТУ',
  dit: 'ДИТ',
};

const CARD_LABELS: Record<string, string> = {
  id: 'ID вопроса',
  abbreviation: 'Аббревиатура',
  fillType: 'Тип заполнения',
  precondition: 'Предусловие',
  questionText: 'Текст вопроса',
  helpText: 'Текст справки',
};

// Поля карточки только для просмотра
const READONLY_CARD_FIELDS = new Set(['id', 'abbreviation', 'fillType', 'precondition']);

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="w-1 h-4 rounded-full bg-blue-500 flex-shrink-0" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">{children}</h2>
    </div>
  );
}

function FieldRow({
  label, children,
}: {
  label: string; children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 items-start py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm pt-1.5 font-medium text-gray-500">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function ApprovalChips({
  approval, savedApproval, onChange,
}: {
  approval: { [key: string]: string };
  savedApproval: { [key: string]: string } | undefined;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {(Object.keys(APPROVAL_LABELS) as Array<keyof typeof APPROVAL_LABELS>).map((key) => {
        const isYes = (approval[key] || 'Нет') === 'Да';
        const isChanged = savedApproval !== undefined && savedApproval[key] !== approval[key];
        return (
          <button
            key={key}
            onClick={() => onChange(key, isYes ? 'Нет' : 'Да')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
              isChanged
                ? 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100'
                : isYes
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isChanged ? 'bg-amber-400' : isYes ? 'bg-emerald-500' : 'bg-gray-300'
            }`} />
            {APPROVAL_LABELS[key]}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              isChanged ? 'bg-amber-100' : isYes ? 'bg-emerald-100' : 'bg-gray-100'
            }`}>
              {isYes ? 'Да' : 'Нет'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EditableField({
  value, onChange, onCommit, multiline = false, placeholder = '—', hasError = false, isChanged = false,
}: {
  value: string; onChange: (v: string) => void; onCommit: () => void;
  multiline?: boolean; placeholder?: string; hasError?: boolean; isChanged?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  const handleChange = (v: string) => { setLocal(v); onChange(v); };

  const baseClass = 'w-full text-sm text-gray-900 rounded-lg px-3 py-2 focus:outline-none transition-all';
  let borderClass: string;
  if (hasError) {
    borderClass = 'border border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100 placeholder:text-red-300';
  } else if (isChanged) {
    borderClass = 'border border-amber-300 bg-amber-50 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder:text-gray-300';
  } else {
    borderClass = 'border border-transparent bg-gray-50 hover:border-gray-200 hover:bg-white focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300';
  }

  return (
    <div>
      {multiline ? (
        <textarea
          value={local} onChange={(e) => handleChange(e.target.value)} onBlur={onCommit}
          placeholder={placeholder} rows={2}
          className={`${baseClass} ${borderClass} resize-y leading-relaxed`}
        />
      ) : (
        <input
          type="text" value={local} onChange={(e) => handleChange(e.target.value)} onBlur={onCommit}
          placeholder={placeholder} className={`${baseClass} ${borderClass}`}
        />
      )}
      {isChanged && !hasError && (
        <p className="text-xs text-amber-600 mt-1.5 ml-1 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-amber-400 inline-block" />
          Изменено · не сохранено
        </p>
      )}
    </div>
  );
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <p className="w-full text-sm text-gray-500 rounded-lg px-3 py-2 bg-gray-50 border border-transparent min-h-[36px] leading-relaxed select-text whitespace-pre-wrap">
      {value || <span className="text-gray-300">—</span>}
    </p>
  );
}

function CollapsibleSection({ title, count, flash = false, children }: { title: string; count: number; flash?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all duration-500 ${
      flash ? 'border-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]' : 'border-gray-200'
    }`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-1 h-4 rounded-full bg-gray-300 flex-shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</span>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2.5 py-0.5">{count}</span>
          {flash && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Сохранено
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-6 pb-6 border-t border-gray-100">{children}</div>}
    </div>
  );
}

export function QuestionEditor() {
  const { currentQuestion, savedQuestion, updateQuestion, commitHistory, savedFlash } = useStore();

  if (!currentQuestion) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Выберите вопрос из списка слева
      </div>
    );
  }

  const q = currentQuestion;
  const saved = savedQuestion;

  const updateApproval = (key: string, value: string) => {
    updateQuestion({ approval: { ...q.approval, [key]: value } });
    commitHistory();
  };

  const updateCard = (key: string, value: string) => {
    updateQuestion({ card: { ...q.card, [key]: value } });
  };

  const updateControl = (idx: number, key: keyof ControlRow, value: string) => {
    updateQuestion({ controls: q.controls.map((c, i) => (i === idx ? { ...c, [key]: value } : c)) });
  };

  const updateAnswer = (idx: number, key: keyof AnswerRow, value: string) => {
    updateQuestion({ answers: q.answers.map((a, i) => (i === idx ? { ...a, [key]: value } : a)) });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F7F8FA]">
      <div className="px-8 py-5 space-y-4">

        {/* Статус утверждения */}
        <div className={`bg-white rounded-2xl border p-5 shadow-sm transition-all duration-500 ${
          savedFlash.approval ? 'border-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <SectionTitle>Статус утверждения</SectionTitle>
            {savedFlash.approval && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 mb-5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Сохранено
              </span>
            )}
          </div>
          <ApprovalChips approval={q.approval} savedApproval={saved?.approval} onChange={updateApproval} />
        </div>

        {/* Карточка вопроса */}
        <div className={`bg-white rounded-2xl border p-5 shadow-sm transition-all duration-500 ${
          savedFlash.card ? 'border-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <SectionTitle>Карточка вопроса</SectionTitle>
            {savedFlash.card && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 mb-5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Сохранено
              </span>
            )}
          </div>
          <div>
            {(Object.keys(CARD_LABELS) as Array<keyof typeof CARD_LABELS>).map((key) => {
              const label = CARD_LABELS[key];
              const isReadOnly = READONLY_CARD_FIELDS.has(key);
              const isChanged = !isReadOnly && !savedFlash.card && saved !== null &&
                (saved.card[key as keyof typeof saved.card] ?? '') !== (q.card[key as keyof typeof q.card] ?? '');
              return (
                <FieldRow key={key} label={label}>
                  {isReadOnly ? (
                    <ReadOnlyField value={q.card[key as keyof typeof q.card] || ''} />
                  ) : (
                    <EditableField
                      value={q.card[key as keyof typeof q.card] || ''}
                      onChange={(v) => updateCard(key, v)}
                      onCommit={commitHistory}
                      multiline
                      placeholder="—"
                      isChanged={isChanged}
                    />
                  )}
                </FieldRow>
              );
            })}
          </div>
        </div>

        {/* Контроли */}
        {q.controls.length > 0 && (
          <CollapsibleSection title="Контроли" count={q.controls.length} flash={savedFlash.controls}>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['ID контроля', 'Тип', 'Условия', 'Строгость'].map((h) => (
                      <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide first:pl-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.controls.map((ctrl, idx) => (
                    <tr key={idx} className="border-b border-gray-50">
                      {(['id', 'type', 'conditions', 'strictness'] as const).map((field) => (
                        <td key={field} className="py-2.5 px-3 first:pl-0 text-sm text-gray-600">
                          {ctrl[field] || <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}

        {/* Варианты ответов */}
        {q.answers.length > 0 && (
          <CollapsibleSection title="Варианты ответов" count={q.answers.length} flash={savedFlash.answers}>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['№', 'Аббр.', 'Тип', 'Тип варианта', 'Заголовок', 'Подсказка', 'Предуст.', 'Код', 'Переход'].map((h) => (
                      <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide first:pl-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.answers.map((ans, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      {(['number', 'abbreviation', 'type', 'variantType', 'headerText', 'hintText', 'defaultValue', 'code', 'nextId'] as const).map((field) => {
                        const isEditable = field === 'headerText' || field === 'hintText';
                        const isChanged = isEditable && !savedFlash.answers && saved !== null &&
                          (saved.answers[idx]?.[field] ?? '') !== ans[field];
                        return (
                          <td key={field} className="py-2 px-3 first:pl-0">
                            {isEditable ? (
                              <input
                                type="text" value={ans[field]}
                                onChange={(e) => updateAnswer(idx, field, e.target.value)}
                                onBlur={commitHistory} placeholder="—"
                                className={`w-full min-w-[56px] text-sm text-gray-900 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 transition-all placeholder:text-gray-300 ${
                                  isChanged
                                    ? 'border border-amber-300 bg-amber-50 focus:border-amber-400 focus:ring-amber-100'
                                    : 'border border-transparent bg-gray-50 hover:border-gray-200 focus:border-blue-300 focus:bg-white focus:ring-blue-100'
                                }`}
                              />
                            ) : (
                              <span className="text-sm text-gray-500 px-2.5 py-1.5 block">
                                {ans[field] || <span className="text-gray-300">—</span>}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
