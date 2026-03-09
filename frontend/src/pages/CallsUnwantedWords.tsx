import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function CallsUnwantedWords() {
  const [fillerWords, setFillerWords] = useState<string[]>([]);
  const [negativeWords, setNegativeWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newFiller, setNewFiller] = useState('');
  const [newNegative, setNewNegative] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get<{ fillerWords: string[]; negativeWords: string[] }>('/calls/unwanted-words')
      .then((res) => {
        setFillerWords(res.data.fillerWords);
        setNegativeWords(res.data.negativeWords);
      })
      .catch(() => setError('Не удалось загрузить списки слов'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.put<{ fillerWords: string[]; negativeWords: string[] }>(
        '/calls/unwanted-words',
        { fillerWords, negativeWords },
      );
      setFillerWords(res.data.fillerWords);
      setNegativeWords(res.data.negativeWords);
      setSuccess('Сохранено');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const addFiller = () => {
    const word = newFiller.trim();
    if (!word || fillerWords.includes(word)) return;
    setFillerWords((prev) => [...prev, word]);
    setNewFiller('');
  };

  const removeFiller = (idx: number) => {
    setFillerWords((prev) => prev.filter((_, i) => i !== idx));
  };

  const addNegative = () => {
    const word = newNegative.trim();
    if (!word || negativeWords.includes(word)) return;
    setNegativeWords((prev) => [...prev, word]);
    setNewNegative('');
  };

  const removeNegative = (idx: number) => {
    setNegativeWords((prev) => prev.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Нежелательные слова</h3>
      <p className="text-sm text-gray-500 mb-5">
        Слова-паразиты и негативные слова определяются в речи оператора и отображаются в отчётах и транскрипции.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Filler words */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3 h-3 rounded-full bg-orange-400 flex-shrink-0" />
            <h4 className="text-sm font-semibold text-gray-900">Слова-паразиты</h4>
            <span className="text-xs text-gray-400 ml-auto">{fillerWords.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3 min-h-[40px]">
            {fillerWords.map((word, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-orange-50 text-orange-700 border border-orange-200 rounded-full"
              >
                {word}
                <button
                  type="button"
                  onClick={() => removeFiller(idx)}
                  className="text-orange-400 hover:text-orange-600 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); addFiller(); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newFiller}
              onChange={(e) => setNewFiller(e.target.value)}
              placeholder="Добавить слово..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              +
            </button>
          </form>
        </div>

        {/* Negative words */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
            <h4 className="text-sm font-semibold text-gray-900">Негативные слова</h4>
            <span className="text-xs text-gray-400 ml-auto">{negativeWords.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3 min-h-[40px]">
            {negativeWords.map((word, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-red-50 text-red-700 border border-red-200 rounded-full"
              >
                {word}
                <button
                  type="button"
                  onClick={() => removeNegative(idx)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); addNegative(); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newNegative}
              onChange={(e) => setNewNegative(e.target.value)}
              placeholder="Добавить слово..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              +
            </button>
          </form>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? 'Сохранение...' : 'Сохранить'}
      </button>
    </div>
  );
}
