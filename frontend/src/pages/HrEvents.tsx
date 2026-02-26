import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import HrTabs from '../components/HrTabs';

type HrEvent = {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  color: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

const EVENT_COLORS = [
  { value: '', label: 'По умолчанию' },
  { value: '#3b82f6', label: 'Синий' },
  { value: '#22c55e', label: 'Зелёный' },
  { value: '#eab308', label: 'Жёлтый' },
  { value: '#f97316', label: 'Оранжевый' },
  { value: '#ef4444', label: 'Красный' },
  { value: '#8b5cf6', label: 'Фиолетовый' },
  { value: '#ec4899', label: 'Розовый' },
  { value: '#06b6d4', label: 'Бирюзовый' },
  { value: '#64748b', label: 'Серый' },
];

function eventEndDate(event: HrEvent): string {
  return event.endDate ?? event.date;
}

function eventIntersectsDay(event: HrEvent, dayStr: string): boolean {
  const start = event.date.slice(0, 10);
  const end = eventEndDate(event).slice(0, 10);
  return dayStr >= start && dayStr <= end;
}

function eventDayPosition(event: HrEvent, dayStr: string): 'first' | 'middle' | 'last' | 'only' {
  const start = event.date.slice(0, 10);
  const end = eventEndDate(event).slice(0, 10);
  if (start === end) return 'only';
  if (dayStr === start) return 'first';
  if (dayStr === end) return 'last';
  return 'middle';
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getMonthBounds(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}

export default function HrEvents() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [events, setEvents] = useState<HrEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<HrEvent | null>(null);
  const [form, setForm] = useState({ title: '', date: '', endDate: '', color: '', description: '' });
  const [error, setError] = useState('');
  const [shareSettings, setShareSettings] = useState<{ enabled: boolean; token: string; publicUrl: string | null } | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const { startDate, endDate } = getMonthBounds(year, month);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get<HrEvent[]>('/hr/events', {
        params: { startDate, endDate },
      });
      setEvents(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [startDate, endDate]);

  const loadShareSettings = async () => {
    try {
      const res = await api.get<{ enabled: boolean; token: string; publicUrl: string | null }>('/hr/events/share');
      setShareSettings(res.data);
    } catch {
      setShareSettings({ enabled: false, token: '', publicUrl: null });
    }
  };

  useEffect(() => {
    loadShareSettings();
  }, []);

  const enableShare = async () => {
    setShareLoading(true);
    try {
      const res = await api.post<{ publicUrl: string }>('/hr/events/share/enable');
      setShareSettings((s) => (s ? { ...s, enabled: true, publicUrl: res.data.publicUrl } : { enabled: true, token: '', publicUrl: res.data.publicUrl }));
    } finally {
      setShareLoading(false);
    }
  };

  const disableShare = async () => {
    setShareLoading(true);
    try {
      await api.post('/hr/events/share/disable');
      setShareSettings((s) => (s ? { ...s, enabled: false, publicUrl: null } : null));
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareLink = () => {
    const url = shareSettings?.publicUrl || (shareSettings?.token ? `${window.location.origin}/calendar/${shareSettings.token}` : '');
    if (url) navigator.clipboard.writeText(url).then(() => alert('Ссылка скопирована'));
  };

  const days = getCalendarDays(year, month);
  function getEventsForDay(dayStr: string): HrEvent[] {
    return events.filter((e) => eventIntersectsDay(e, dayStr));
  }

  const openCreate = (day?: number) => {
    const dateStr =
      day !== undefined
        ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    setEditingEvent(null);
    setForm({ title: '', date: dateStr, endDate: '', color: '', description: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (event: HrEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      date: event.date.slice(0, 10),
      endDate: event.endDate ? event.endDate.slice(0, 10) : '',
      color: event.color || '',
      description: event.description || '',
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingEvent) {
        await api.put(`/hr/events/${editingEvent.id}`, {
          title: form.title.trim(),
          date: form.date,
          endDate: form.endDate.trim() || null,
          color: form.color.trim() || null,
          description: form.description.trim() || null,
        });
      } else {
        await api.post('/hr/events', {
          title: form.title.trim(),
          date: form.date,
          endDate: form.endDate.trim() || null,
          color: form.color.trim() || null,
          description: form.description.trim() || null,
        });
      }
      setShowForm(false);
      loadEvents();
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
          : null;
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка сохранения');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить мероприятие?')) return;
    try {
      await api.delete(`/hr/events/${id}`);
      setShowForm(false);
      loadEvents();
    } catch {}
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  return (
    <div>
      <HrTabs active="events" />

      <div className="mb-4">
        <Link to="/hr" className="text-accent hover:underline text-sm">
          ← Назад к HR
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">План мероприятий</h2>
        <button
          type="button"
          onClick={() => openCreate()}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover"
        >
          Добавить мероприятие
        </button>
      </div>

      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Поделиться календарём</h3>
        {shareSettings === null ? (
          <span className="text-sm text-gray-500">Загрузка...</span>
        ) : shareSettings.enabled && shareSettings.publicUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareSettings.publicUrl}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm bg-white"
            />
            <button
              type="button"
              onClick={copyShareLink}
              className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-100"
            >
              Скопировать ссылку
            </button>
            <button
              type="button"
              onClick={disableShare}
              disabled={shareLoading}
              className="px-3 py-2 border border-red-300 text-red-600 text-sm rounded hover:bg-red-50 disabled:opacity-50"
            >
              Отключить
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={enableShare}
            disabled={shareLoading}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover disabled:opacity-50"
          >
            Включить публичную ссылку
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg max-w-md">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            {editingEvent ? 'Редактировать мероприятие' : 'Новое мероприятие'}
          </h3>
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <div className="grid gap-3">
            <input
              type="text"
              placeholder="Название"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <label className="text-sm text-gray-600">Дата начала</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <label className="text-sm text-gray-600">Дата окончания (необязательно)</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              min={form.date}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <label className="text-sm text-gray-600">Цвет</label>
            <div className="flex flex-wrap gap-2 items-center">
              {EVENT_COLORS.map((c) => (
                <label key={c.value || 'default'} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="color"
                    value={c.value}
                    checked={form.color === c.value}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="sr-only"
                  />
                  <span
                    className={`w-6 h-6 rounded-full border-2 flex-shrink-0 ${
                      form.color === c.value ? 'border-gray-900 scale-110' : 'border-gray-300 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: c.value || 'var(--accent, #2563eb)' }}
                    title={c.label}
                  />
                  {c.value === '' && <span className="text-xs text-gray-600">{c.label}</span>}
                </label>
              ))}
            </div>
            <textarea
              placeholder="Описание (необязательно)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover">
              {editingEvent ? 'Сохранить' : 'Добавить'}
            </button>
            {editingEvent && (
              <button
                type="button"
                onClick={() => handleDelete(editingEvent.id)}
                className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded hover:bg-red-50"
              >
                Удалить
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <button
            type="button"
            onClick={prevMonth}
            className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
          >
            ← Пред. месяц
          </button>
          <span className="font-medium text-gray-900">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
          >
            След. месяц →
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-xs font-medium text-gray-500 py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="min-h-[80px] bg-gray-50 rounded" />;
                }
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = getEventsForDay(dateKey);
                return (
                  <div
                    key={dateKey}
                    className="min-h-[80px] border border-gray-200 rounded p-1.5 flex flex-col hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{day}</span>
                      <button
                        type="button"
                        onClick={() => openCreate(day)}
                        className="text-gray-400 hover:text-accent text-xs"
                        title="Добавить"
                      >
                        +
                      </button>
                    </div>
                    <div className="mt-1 flex flex-col gap-0.5 overflow-auto">
                      {dayEvents.map((ev) => {
                        const pos = eventDayPosition(ev, dateKey);
                        const rounded =
                          pos === 'only' ? 'rounded' : pos === 'first' ? 'rounded-l' : pos === 'last' ? 'rounded-r' : 'rounded-none';
                        const style = ev.color ? { backgroundColor: `${ev.color}20` } : undefined;
                        const className = ev.color
                          ? `text-left text-xs px-1.5 py-1 min-h-[1.5rem] truncate ${rounded} hover:opacity-90`
                          : `text-left text-xs px-1.5 py-1 min-h-[1.5rem] truncate ${rounded} hover:opacity-90 bg-accent/10 text-gray-800 hover:bg-accent/20`;
                        return (
                          <button
                            key={`${ev.id}-${dateKey}`}
                            type="button"
                            onClick={() => openEdit(ev)}
                            className={className}
                            style={style}
                            title={ev.description || ev.title}
                          >
                            {ev.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
