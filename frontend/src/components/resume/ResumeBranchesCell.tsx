import { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';
import { BRANCHES, BRANCH_COLORS } from '../../lib/resume-constants';

type Props = {
  candidateId: string;
  branches: string[];
  onUpdated: () => void;
};

export default function ResumeBranchesCell({ candidateId, branches, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = async (branch: string) => {
    const next = branches.includes(branch)
      ? branches.filter((b) => b !== branch)
      : [...branches, branch];
    try {
      await api.patch(`/resume/candidates/${candidateId}`, { branches: next });
      onUpdated();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-wrap gap-1 min-w-0"
      >
        {branches.length === 0 ? (
          <span className="inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-accent transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Филиал
          </span>
        ) : (
          branches.map((b) => (
            <span
              key={b}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BRANCH_COLORS[b] || 'bg-gray-100 text-gray-800'}`}
            >
              {b}
            </span>
          ))
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[160px]">
          {BRANCHES.map((b) => (
            <label key={b} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={branches.includes(b)}
                onChange={() => toggle(b)}
                className="rounded border-gray-300 text-accent focus:ring-accent/30"
              />
              {b}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
