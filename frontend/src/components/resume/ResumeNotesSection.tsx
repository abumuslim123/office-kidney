import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime } from '../../lib/resume-constants';
import type { NoteEntry } from '../../lib/resume-types';

interface Props {
  candidateId: string;
  notes: NoteEntry[];
  onRefresh: () => void;
}

export default function ResumeNotesSection({ candidateId, notes, onRefresh }: Props) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post(`/resume/candidates/${candidateId}/notes`, {
        content: content.trim(),
        authorName: user?.displayName || user?.login || 'HR',
      });
      setContent('');
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(noteId: string) {
    await api.delete(`/resume/candidates/${candidateId}/notes/${noteId}`);
    onRefresh();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-900">Заметки рекрутера</h3>
      </div>
      <div className="p-5 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            placeholder="Текст заметки..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Сохранение...' : 'Добавить заметку'}
          </button>
        </form>

        {notes.length > 0 && <hr className="border-gray-200" />}

        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-gray-100 p-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    {note.authorName}
                  </span>
                  <span>{formatDateTime(note.createdAt)}</span>
                </div>
                <button onClick={() => handleDelete(note.id)} className="text-red-500 hover:text-red-700">Удалить</button>
              </div>
            </div>
          ))}
          {notes.length === 0 && <p className="text-sm text-gray-400">Заметок пока нет</p>}
        </div>
      </div>
    </div>
  );
}
