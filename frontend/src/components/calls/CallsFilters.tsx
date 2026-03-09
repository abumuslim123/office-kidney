import React from 'react';
import type { CallStats, CallTopic } from './calls-types';

type CallsFiltersProps = {
  filterFrom: string;
  filterTo: string;
  filterEmployees: string[];
  filterTopics: string[];
  setFilterFrom: (v: string) => void;
  setFilterTo: (v: string) => void;
  setFilterEmployees: (v: string[]) => void;
  setFilterTopics: (v: string[]) => void;
  stats: CallStats | null;
  activeTopics: CallTopic[];
  onApply: () => void;
  onReset: () => void;
};

function CallsFilters({
  filterFrom, filterTo, filterEmployees, filterTopics,
  setFilterFrom, setFilterTo, setFilterEmployees, setFilterTopics,
  stats, activeTopics, onApply, onReset,
}: CallsFiltersProps) {
  return (
    <div className="mb-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Период с</label>
          <input
            type="datetime-local"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Период по</label>
          <input
            type="datetime-local"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Сотрудники</label>
          <select
            multiple
            value={filterEmployees}
            onChange={(e) =>
              setFilterEmployees(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-[72px] focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
          >
            {(stats?.employees || []).map((row) => (
              <option key={row.employeeName} value={row.employeeName}>
                {row.employeeName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Тематики</label>
          <select
            multiple
            value={filterTopics}
            onChange={(e) =>
              setFilterTopics(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-[72px] focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
          >
            {activeTopics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={onApply}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Применить
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Сбросить
        </button>
      </div>
    </div>
  );
}

export default React.memo(CallsFilters);
