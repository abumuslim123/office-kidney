import { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';
import { PREDEFINED_TAGS } from '../../lib/resume-constants';
import type { TagEntry } from '../../lib/resume-types';

interface Props {
  candidateId: string;
  tags: TagEntry[];
  onRefresh: () => void;
}

export default function ResumeTagsManager({ candidateId, tags: initialTags, onRefresh }: Props) {
  const [tags, setTags] = useState<TagEntry[]>(initialTags);
  const [customLabel, setCustomLabel] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setTags(initialTags), [initialTags]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function saveTags(updatedTags: TagEntry[]) {
    setIsSaving(true);
    try {
      await api.put(`/resume/candidates/${candidateId}/tags`, {
        tags: updatedTags.map((t) => ({ label: t.label, color: t.color })),
      });
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  }

  function addTag(label: string, color: string | null) {
    if (tags.some((t) => t.label === label)) return;
    const newTag: TagEntry = { id: `temp-${Date.now()}`, label, color };
    const updated = [...tags, newTag];
    setTags(updated);
    saveTags(updated);
    setIsOpen(false);
    setCustomLabel('');
  }

  function removeTag(tagId: string) {
    const updated = tags.filter((t) => t.id !== tagId);
    setTags(updated);
    saveTags(updated);
  }

  const availablePredefined = PREDEFINED_TAGS.filter(
    (pt) => !tags.some((t) => t.label === pt.label),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded text-white"
          style={{ backgroundColor: tag.color || '#64748b' }}
        >
          {tag.label}
          <button onClick={() => removeTag(tag.id)} disabled={isSaving} className="text-white/80 hover:text-white ml-0.5">
            &times;
          </button>
        </span>
      ))}

      <div ref={ref} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Добавить тег
        </button>

        {isOpen && (
          <div className="absolute z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-3 space-y-3">
            {availablePredefined.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase mb-1.5">Готовые теги</p>
                <div className="flex flex-wrap gap-1">
                  {availablePredefined.map((pt) => (
                    <button
                      key={pt.label}
                      onClick={() => addTag(pt.label, pt.color)}
                      className="text-xs px-2 py-0.5 rounded text-white hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: pt.color }}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] font-medium text-gray-400 uppercase mb-1.5">Свой тег</p>
              <div className="flex gap-1">
                <input
                  placeholder="Название тега"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); if (customLabel.trim()) addTag(customLabel.trim(), null); }
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => { if (customLabel.trim()) addTag(customLabel.trim(), null); }}
                  disabled={!customLabel.trim()}
                  className="px-2 py-1 bg-indigo-600 text-white rounded text-sm disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
