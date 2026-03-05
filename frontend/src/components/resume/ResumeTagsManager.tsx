import { useState } from 'react';
import { api } from '../../lib/api';
import type { ResumeCandidateTag } from '../../lib/resume-types';
import { PREDEFINED_TAGS } from '../../lib/resume-constants';

type Props = {
  candidateId: string;
  tags: ResumeCandidateTag[];
  onUpdated: () => void;
};

export default function ResumeTagsManager({ candidateId, tags, onUpdated }: Props) {
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (label: string, color: string) => {
    if (!label.trim()) return;
    if (tags.some((t) => t.label === label.trim())) return;
    setAdding(true);
    try {
      await api.post(`/resume/candidates/${candidateId}/tags`, {
        label: label.trim(),
        color,
      });
      setNewLabel('');
      onUpdated();
    } catch {
      /* ignore */
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (tagId: string) => {
    try {
      await api.delete(`/resume/candidates/${candidateId}/tags/${tagId}`);
      onUpdated();
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Теги</h3>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: tag.color || '#6b7280' }}
            >
              {tag.label}
              <button
                type="button"
                onClick={() => handleRemove(tag.id)}
                className="hover:opacity-75 ml-0.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {PREDEFINED_TAGS.filter((p) => !tags.some((t) => t.label === p.label)).map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleAdd(p.label, p.color)}
              disabled={adding}
              className="px-2.5 py-1 rounded-full text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              + {p.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd(newLabel, newColor);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Новый тег..."
            maxLength={100}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
          />
          <button
            type="submit"
            disabled={!newLabel.trim() || adding}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            +
          </button>
        </form>
      </div>
    </div>
  );
}
