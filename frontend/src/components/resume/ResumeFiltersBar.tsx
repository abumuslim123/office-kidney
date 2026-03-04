import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import {
  SPECIALIZATIONS,
  BRANCHES,
  CANDIDATE_STATUSES,
  CANDIDATE_PRIORITIES,
  QUALIFICATION_CATEGORIES,
  EXPERIENCE_RANGES,
} from '../../lib/resume-constants';

export type ResumeFilters = {
  search: string;
  specialization: string;
  branch: string;
  status: string;
  priority: string;
  category: string;
  city: string;
  workCity: string;
  educationCity: string;
  experience: string;
  accreditation: string;
};

const emptyFilters: ResumeFilters = {
  search: '',
  specialization: '',
  branch: '',
  status: '',
  priority: '',
  category: '',
  city: '',
  workCity: '',
  educationCity: '',
  experience: '',
  accreditation: '',
};

type FilterOptions = {
  cities: string[];
  workCities: string[];
  educationCities: string[];
  specializations: string[];
};

type Props = {
  filters: ResumeFilters;
  onChange: (f: ResumeFilters) => void;
  onExport: () => void;
  onDeduplicate: () => void;
  exporting?: boolean;
  deduplicating?: boolean;
};

export { emptyFilters };

// --- Specialization Combobox ---
function SpecializationCombobox({
  value,
  onChange,
  allSpecializations,
}: {
  value: string;
  onChange: (v: string) => void;
  allSpecializations: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = allSpecializations.filter(
    (s) => !query || s.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent">
        <input
          ref={inputRef}
          type="text"
          placeholder="Специализация"
          value={open ? query : value || ''}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          className="px-2 py-1.5 text-sm bg-transparent border-0 outline-none focus:ring-0 w-40"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
            className="px-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-30 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto min-w-[220px]">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setOpen(false);
                setQuery('');
              }}
              className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${s === value ? 'bg-accent/5 text-accent font-medium' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResumeFiltersBar({
  filters,
  onChange,
  onExport,
  onDeduplicate,
  exporting,
  deduplicating,
}: Props) {
  const [showExtra, setShowExtra] = useState(false);
  const [options, setOptions] = useState<FilterOptions>({ cities: [], workCities: [], educationCities: [], specializations: [] });
  const [localSearch, setLocalSearch] = useState(filters.search);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocalSearch(filters.search); }, [filters.search]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      onChange({ ...filters, search: value });
    }, 400);
  };

  useEffect(() => {
    api.get<FilterOptions>('/resume/filter-options').then((r) => setOptions(r.data)).catch(() => {});
  }, []);

  const update = useCallback(
    (patch: Partial<ResumeFilters>) => onChange({ ...filters, ...patch }),
    [filters, onChange],
  );

  // Merge hardcoded + dynamic specializations, deduplicate
  const allSpecializations = [...new Set([...SPECIALIZATIONS, ...options.specializations])].sort();

  const extraCount = [
    filters.category,
    filters.priority,
    filters.city,
    filters.workCity,
    filters.educationCity,
    filters.experience,
    filters.accreditation,
  ].filter(Boolean).length;

  useEffect(() => {
    if (extraCount > 0) setShowExtra(true);
  }, [extraCount]);

  const selectClass =
    'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Поиск по ФИО..."
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:ring-2 focus:ring-accent/30 focus:border-accent"
        />
        <SpecializationCombobox
          value={filters.specialization}
          onChange={(v) => update({ specialization: v })}
          allSpecializations={allSpecializations}
        />
        <select value={filters.branch} onChange={(e) => update({ branch: e.target.value })} className={selectClass}>
          <option value="">Филиал</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => update({ status: e.target.value })} className={selectClass}>
          <option value="">Этап</option>
          {Object.entries(CANDIDATE_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowExtra((v) => !v)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          Доп. фильтры
          {extraCount > 0 && <span className="ml-1 bg-accent text-white text-xs rounded-full px-1.5">{extraCount}</span>}
        </button>

        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Экспорт в Excel"
          >
            {exporting ? (
              <svg className="w-4 h-4 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            )}
          </button>
          <button
            type="button"
            onClick={onDeduplicate}
            disabled={deduplicating}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Проверить дубликаты"
          >
            {deduplicating ? (
              <svg className="w-4 h-4 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                <circle cx="18" cy="18" r="4" fill="white" stroke="currentColor" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 16.5l3 3m0-3l-3 3" />
              </svg>
            )}
          </button>
          {Object.values(filters).some(Boolean) && (
            <button
              type="button"
              onClick={() => onChange(emptyFilters)}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Сбросить
            </button>
          )}
        </div>
      </div>

      {showExtra && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <select value={filters.priority} onChange={(e) => update({ priority: e.target.value })} className={selectClass}>
            <option value="">Приоритет</option>
            {Object.entries(CANDIDATE_PRIORITIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={filters.category} onChange={(e) => update({ category: e.target.value })} className={selectClass}>
            <option value="">Категория</option>
            {Object.entries(QUALIFICATION_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={filters.city} onChange={(e) => update({ city: e.target.value })} className={selectClass}>
            <option value="">Город проживания</option>
            {options.cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={filters.workCity} onChange={(e) => update({ workCity: e.target.value })} className={selectClass}>
            <option value="">Город работы</option>
            {options.workCities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={filters.educationCity} onChange={(e) => update({ educationCity: e.target.value })} className={selectClass}>
            <option value="">Город учёбы</option>
            {options.educationCities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={filters.experience} onChange={(e) => update({ experience: e.target.value })} className={selectClass}>
            <option value="">Опыт</option>
            {EXPERIENCE_RANGES.map((r) => (
              <option key={r.label} value={`${r.min}-${r.max === Infinity ? '' : r.max}`}>{r.label}</option>
            ))}
          </select>
          <select value={filters.accreditation} onChange={(e) => update({ accreditation: e.target.value })} className={selectClass}>
            <option value="">Аккредитация</option>
            <option value="valid">Действующая</option>
            <option value="expiring">Истекает (&lt;90 дн.)</option>
            <option value="expired">Просрочена</option>
            <option value="none">Нет</option>
          </select>
        </div>
      )}
    </div>
  );
}
