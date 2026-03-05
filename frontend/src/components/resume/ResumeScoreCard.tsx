import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ResumeCandidate, ResumeCandidateScore } from '../../lib/resume-types';
import { HIGHLIGHT_TYPE_ICONS, CONFIDENCE_FIELD_DESCRIPTORS } from '../../lib/resume-constants';
import { api } from '../../lib/api';

interface Props {
  candidateId: string;
  candidate?: ResumeCandidate;
  onFieldUpdated?: () => void;
}

export default function ResumeScoreCard({ candidateId, candidate, onFieldUpdated }: Props) {
  const [score, setScore] = useState<ResumeCandidateScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  // Missing fields inline-edit state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const fetchScore = useCallback(async () => {
    try {
      const res = await api.get<{ score: ResumeCandidateScore | null }>(`/resume/candidates/${candidateId}/score`);
      setScore(res.data.score || null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await api.post(`/resume/candidates/${candidateId}/score/recalculate`);
      await fetchScore();
    } catch {
      /* ignore */
    } finally {
      setRecalculating(false);
    }
  };

  const missingFields = useMemo(() => {
    if (!candidate) return [];
    return CONFIDENCE_FIELD_DESCRIPTORS.filter(f => !f.isFilled(candidate));
  }, [candidate]);

  const handleSaveMissing = async (fieldName: string, value: unknown) => {
    setSaving(true);
    try {
      await api.patch(`/resume/candidates/${candidateId}`, { [fieldName]: value });
      onFieldUpdated?.();
      setEditingField(null);
      setEditValue('');
      // Пересчитать скоринг с учётом нового поля
      api.post(`/resume/candidates/${candidateId}/score/recalculate`).then(() => fetchScore());
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleCopyList = () => {
    const editableFields = missingFields.filter(f => f.actionType !== 'readonly');
    if (editableFields.length === 0) return;
    const name = candidate?.fullName || 'кандидата';
    const lines = editableFields.map((f, i) => `${i + 1}. ${f.hint}`);
    const text = `Уточнить у ${name}:\n\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="h-20 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500">ИИ-оценка</h3>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="text-xs px-3 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            {recalculating ? 'Оценка...' : 'Оценить кандидата'}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-2">Оценка ещё не проводилась</p>
      </div>
    );
  }

  const scoreNum = score.totalScore;
  const ringColor = scoreNum >= 70 ? '#10b981' : scoreNum >= 40 ? '#f59e0b' : '#ef4444';
  const ringPercent = scoreNum / 100;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference * (1 - ringPercent);

  return (
    <div className="bg-white rounded-lg border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">ИИ-оценка кандидата</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {new Date(score.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="text-xs px-3 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            {recalculating ? 'Пересчёт...' : 'Пересчитать'}
          </button>
        </div>
      </div>

      {/* Main: score circle + summary */}
      <div className="flex gap-5 mb-4">
        {/* Score circle */}
        <div className="flex-shrink-0 relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={ringColor} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color: ringColor }}>{scoreNum}</span>
            <span className="text-xs text-gray-400">/100</span>
          </div>
        </div>

        {/* Summary */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 leading-relaxed">{score.aiSummary}</p>
          {score.percentileRank != null && score.totalCandidatesInGroup > 1 && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Лучше {Math.round(score.percentileRank)}% кандидатов среди {score.specialization || 'всех'}</span>
                <span className="text-gray-300">({score.totalCandidatesInGroup} чел.)</span>
              </div>
              <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(score.percentileRank, 5)}%`, backgroundColor: ringColor }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-scores breakdown */}
      {score.deterministicScore != null && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 mb-2">Разбивка оценки</h4>
          <div className="space-y-1.5">
            {([
              { label: 'Опыт', value: score.experienceScore, color: '#6366f1' },
              { label: 'Образование', value: score.educationScore, color: '#8b5cf6' },
              { label: 'Квалификация', value: score.qualificationScore, color: '#0ea5e9' },
              { label: 'Развитие', value: score.developmentScore, color: '#14b8a6' },
              { label: 'AI-оценка', value: score.aiQualitativeScore, color: '#f59e0b' },
            ] as const).map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-24 text-right flex-shrink-0">{label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(value ?? 0, 2)}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-600 w-8">{value != null ? Math.round(value) : '—'}</span>
              </div>
            ))}
          </div>
          {score.confidence != null && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
              <span>{score.confidence >= 70 ? '✅' : score.confidence >= 40 ? '⚠️' : '❗'}</span>
              <span>Достоверность: {Math.round(score.confidence)}%</span>
              <span className="text-gray-300">
                ({score.confidence >= 70 ? 'данные почти полные' : score.confidence >= 40 ? 'часть данных отсутствует' : 'мало данных для точной оценки'})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Missing data section */}
      {missingFields.length > 0 && (
        <div className="mb-4 border border-amber-200 rounded-lg bg-amber-50/50 p-3">
          <button
            onClick={() => setShowMissing(v => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="text-xs font-medium text-amber-700">
              Недостающие данные ({missingFields.length})
            </h4>
            <span className="text-xs text-amber-500">{showMissing ? '▲ Свернуть' : '▼ Развернуть'}</span>
          </button>

          {showMissing && (
            <div className="mt-2 space-y-2">
              {missingFields.map(field => (
                <div key={field.key} className="flex items-start gap-2 text-xs">
                  {field.actionType === 'editable' ? (
                    <span className="text-amber-500 mt-0.5">●</span>
                  ) : (
                    <span className="text-gray-400 mt-0.5">○</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-700">{field.label}</div>
                    <div className="text-gray-400 italic">{field.hint}</div>

                    {/* Inline edit for editable fields */}
                    {field.actionType === 'editable' && field.fieldName && (
                      <>
                        {editingField === field.key ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            {field.inputType === 'select' ? (
                              <select
                                className="text-xs border rounded px-1.5 py-0.5 bg-white"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                              >
                                <option value="">-- выберите --</option>
                                {field.selectOptions?.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            ) : field.inputType === 'boolean' ? (
                              <label className="flex items-center gap-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={editValue === 'true'}
                                  onChange={e => setEditValue(String(e.target.checked))}
                                  className="rounded"
                                />
                                <span>Есть аккредитация</span>
                              </label>
                            ) : (
                              <input
                                type={field.inputType === 'number' ? 'number' : 'text'}
                                className="text-xs border rounded px-1.5 py-0.5 w-40"
                                placeholder={field.label}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                autoFocus
                              />
                            )}
                            <button
                              disabled={saving || !editValue}
                              onClick={() => {
                                let val: unknown = editValue;
                                if (field.inputType === 'number') val = parseFloat(editValue);
                                if (field.inputType === 'boolean') val = editValue === 'true';
                                handleSaveMissing(field.fieldName!, val);
                              }}
                              className="text-xs px-2 py-0.5 rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                            >
                              {saving ? '...' : 'OK'}
                            </button>
                            <button
                              onClick={() => { setEditingField(null); setEditValue(''); }}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingField(field.key); setEditValue(''); }}
                            className="mt-1 text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Заполнить
                          </button>
                        )}
                      </>
                    )}

                    {field.actionType === 'section' && (
                      <span className="mt-0.5 text-xs text-gray-300">Заполняется при загрузке резюме</span>
                    )}
                    {field.actionType === 'readonly' && (
                      <span className="mt-0.5 text-xs text-gray-300">Автоматически при загрузке файла</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Copy button */}
              {missingFields.some(f => f.actionType !== 'readonly') && (
                <button
                  onClick={handleCopyList}
                  className="mt-1 text-xs px-2.5 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  {copied ? 'Скопировано!' : 'Скопировать список для рекрутера'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Strengths + Weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {score.strengths.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-emerald-700 mb-1.5">Сильные стороны</h4>
            <div className="flex flex-wrap gap-1.5">
              {score.strengths.map((s, i) => (
                <span key={i} className="inline-block text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {score.weaknesses.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-amber-700 mb-1.5">Слабые стороны</h4>
            <div className="flex flex-wrap gap-1.5">
              {score.weaknesses.map((w, i) => (
                <span key={i} className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Highlights */}
      {score.highlights.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 mb-1.5">Интересные моменты</h4>
          <div className="space-y-1">
            {score.highlights.map((h, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs ${
                  h.importance === 'high' ? 'text-gray-800' : 'text-gray-600'
                }`}
              >
                <span>{HIGHLIGHT_TYPE_ICONS[h.type] || '✨'}</span>
                <span className={h.importance === 'high' ? 'font-medium' : ''}>{h.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison */}
      {score.comparison && (
        <div className="text-xs text-gray-500 border-t pt-3">
          <span className="font-medium text-gray-600">Сравнение: </span>
          {score.comparison}
        </div>
      )}
    </div>
  );
}
