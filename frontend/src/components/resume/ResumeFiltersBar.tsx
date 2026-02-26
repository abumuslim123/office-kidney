import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  SPECIALIZATIONS,
  CANDIDATE_STATUSES,
  CANDIDATE_PRIORITIES,
  BRANCHES,
  QUALIFICATION_CATEGORIES,
  EXPERIENCE_RANGES,
} from '../../lib/resume-constants';
import type { FilterOptions } from '../../lib/resume-types';

interface Filters {
  search: string;
  specialization: string;
  category: string;
  status: string;
  priority: string;
  branch: string;
  city: string;
  workCity: string;
  educationCity: string;
  experience: string;
  accreditation: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onExport: () => void;
  onDedup: () => void;
  exporting: boolean;
  deduping: boolean;
  dedupResult: string | null;
}

export default function ResumeFiltersBar({ filters, onChange, onExport, onDedup, exporting, deduping, dedupResult }: Props) {
  const [showExtra, setShowExtra] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    specializations: [], categories: [], statuses: [], priorities: [], branches: [], cities: [], workCities: [], educationCities: [],
  });

  useEffect(() => {
    api.get<FilterOptions>('/resume/candidates/filter-options')
      .then((res) => setFilterOptions(res.data))
      .catch(() => {});
  }, []);

  const update = useCallback((key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value });
  }, [filters, onChange]);

  const clearFilters = useCallback(() => {
    onChange({
      search: '', specialization: '', category: '', status: '', priority: '',
      branch: '', city: '', workCity: '', educationCity: '', experience: '', accreditation: '',
    });
  }, [onChange]);

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const extraFiltersCount = [filters.category, filters.priority, filters.workCity, filters.educationCity, filters.city, filters.experience, filters.accreditation].filter(Boolean).length;
  const isExpanded = showExtra || extraFiltersCount > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по ФИО..."
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <select value={filters.specialization} onChange={(e) => update('specialization', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
          <option value="">Специализация</option>
          {(filterOptions.specializations.length > 0 ? filterOptions.specializations : SPECIALIZATIONS as unknown as string[]).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select value={filters.branch} onChange={(e) => update('branch', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
          <option value="">Филиал</option>
          {(filterOptions.branches.length > 0 ? filterOptions.branches : BRANCHES as unknown as string[]).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select value={filters.status} onChange={(e) => update('status', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
          <option value="">Статус</option>
          {Object.entries(CANDIDATE_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowExtra(!showExtra)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
        >
          Ещё фильтры
          {extraFiltersCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-indigo-600 text-white text-[10px]">{extraFiltersCount}</span>
          )}
          <svg className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
            Сбросить
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onDedup}
            disabled={deduping}
            title="Найти и удалить дубликаты"
            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {deduping ? 'Поиск...' : 'Дедупликация'}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? 'Экспорт...' : 'Excel'}
          </button>
        </div>
      </div>

      {dedupResult && (
        <p className="text-xs text-gray-600">Результат дедупликации: {dedupResult}</p>
      )}

      {isExpanded && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <select value={filters.category} onChange={(e) => update('category', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">Категория</option>
            {Object.entries(QUALIFICATION_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select value={filters.priority} onChange={(e) => update('priority', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">Приоритет</option>
            {Object.entries(CANDIDATE_PRIORITIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select value={filters.city} onChange={(e) => update('city', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">Город кандидата</option>
            {filterOptions.cities.map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>

          <select value={filters.workCity} onChange={(e) => update('workCity', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">Город работы</option>
            {filterOptions.workCities.map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>

          <select value={filters.educationCity} onChange={(e) => update('educationCity', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">Город образования</option>
            {filterOptions.educationCities.map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>

          <select value={filters.experience} onChange={(e) => update('experience', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">Стаж</option>
            {EXPERIENCE_RANGES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>

          <select value={filters.accreditation} onChange={(e) => update('accreditation', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">Аккредитация</option>
            <option value="yes">Есть</option>
            <option value="no">Нет</option>
          </select>
        </div>
      )}
    </div>
  );
}
