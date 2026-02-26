import { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';
import { BRANCHES, BRANCH_COLORS } from '../../lib/resume-constants';

interface Props {
  candidateId: string;
  branches: string[];
  onUpdate?: () => void;
}

export default function ResumeBranchesCell({ candidateId, branches: initial, onUpdate }: Props) {
  const [branches, setBranches] = useState<string[]>(initial || []);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setBranches(initial || []), [initial]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function toggle(branch: string) {
    const updated = branches.includes(branch)
      ? branches.filter((b) => b !== branch)
      : [...branches, branch];
    setBranches(updated);
    try {
      await api.put(`/resume/candidates/${candidateId}`, { branches: updated });
      onUpdate?.();
    } catch { setBranches(initial || []); }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="flex flex-wrap gap-1 min-w-[80px]"
      >
        {branches.length > 0 ? (
          branches.map((b) => (
            <span key={b} className={`inline-block text-xs px-1.5 py-0.5 rounded ${BRANCH_COLORS[b] || 'bg-gray-100 text-gray-800'}`}>
              {b}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400">Филиал</span>
        )}
      </button>
      {isOpen && (
        <div className="absolute z-20 mt-1 w-40 rounded-md border border-gray-200 bg-white shadow-lg py-1" onClick={(e) => e.stopPropagation()}>
          {BRANCHES.map((b) => {
            const checked = branches.includes(b);
            return (
              <button
                key={b}
                onClick={() => toggle(b)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 text-left"
              >
                <span className={`flex items-center justify-center h-4 w-4 rounded border ${checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                  {checked && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                <span>{b}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
