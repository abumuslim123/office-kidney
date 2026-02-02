import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { api } from '../lib/api';

type HrEvent = {
  id: string;
  title: string;
  date: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  const [form, setForm] = useState({ title: '', date: '', description: '' });
  const [error, setError] = useState('');

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

  const days = getCalendarDays(year, month);
  const eventsByDate: Record<string, HrEvent[]> = {};
  events.forEach((e) => {
    const d = e.date.slice(0, 10);
    if (!eventsByDate[d]) eventsByDate[d] = [];
    eventsByDate[d].push(e);
  });

  const openCreate = (day?: number) => {
    const dateStr =
      day !== undefined
        ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    setEditingEvent(null);
    setForm({ title: '', date: dateStr, description: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (event: HrEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      date: event.date.slice(0, 10),
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
          description: form.description.trim() || null,
        });
      } else {
        await api.post('/hr/events', {
          title: form.title.trim(),
          date: form.date,
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
      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
        <NavLink
          to="/hr"
          end
          className={({ isActive }) =>
            `px-3 py-2 rounded text-sm font-medium ${isActive ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-100'}`
          }
        >
          Списки
        </NavLink>
        <NavLink
          to="/hr/events"
          className={({ isActive }) =>
            `px-3 py-2 rounded text-sm font-medium ${isActive ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-100'}`
          }
        >
          План мероприятий
        </NavLink>
      </div>

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
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
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
                const dayEvents = eventsByDate[dateKey] || [];
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
                      {dayEvents.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => openEdit(ev)}
                          className="text-left text-xs px-1.5 py-0.5 rounded bg-accent/10 text-gray-800 hover:bg-accent/20 truncate"
                          title={ev.description || ev.title}
                        >
                          {ev.title}
                        </button>
                      ))}
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
