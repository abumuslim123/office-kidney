import { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';
import { DOCTOR_TYPE_LABELS, DOCTOR_TYPE_COLORS } from '../../lib/resume-constants';
import type { ResumeCandidateDoctorType } from '../../lib/resume-types';

type Props = {
  candidateId: string;
  doctorTypes: ResumeCandidateDoctorType[];
  onUpdated: () => void;
};

const ALL_TYPES = Object.keys(DOCTOR_TYPE_LABELS) as ResumeCandidateDoctorType[];

export default function ResumeDoctorTypesCell({ candidateId, doctorTypes, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = async (type: ResumeCandidateDoctorType) => {
    const next = doctorTypes.includes(type)
      ? doctorTypes.filter((t) => t !== type)
      : [...doctorTypes, type];
    try {
      await api.patch(`/resume/candidates/${candidateId}`, { doctorTypes: next });
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
        {doctorTypes.length === 0 ? (
          <span className="inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-accent transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Направление
          </span>
        ) : (
          doctorTypes.map((t) => (
            <span
              key={t}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DOCTOR_TYPE_COLORS[t] || 'bg-gray-100 text-gray-800'}`}
            >
              {DOCTOR_TYPE_LABELS[t] || t}
            </span>
          ))
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[160px]">
          {ALL_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={doctorTypes.includes(t)}
                onChange={() => toggle(t)}
                className="rounded border-gray-300 text-accent focus:ring-accent/30"
              />
              {DOCTOR_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
