import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '../lib/api';

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

export default function HrEventsPublic() {
  const { token } = useParams<{ token: string }>();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [events, setEvents] = useState<HrEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const { startDate, endDate } = getMonthBounds(year, month);

  const loadEvents = async () => {
    if (!token) {
      setAccessError('Ссылка недействительна');
      setLoading(false);
      return;
    }
    setLoading(true);
    setAccessError(null);
    try {
      const res = await publicApi.get<HrEvent[]>(`/public/events-calendar/${token}`, {
        params: { startDate, endDate },
      });
      setEvents(res.data);
    } catch (err: unknown) {
      const status = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : null;
      setAccessError(status === 404 || status === 403 ? 'Доступ отключён или ссылка недействительна' : 'Ошибка загрузки');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [token, startDate, endDate]);

  const days = getCalendarDays(year, month);
  function getEventsForDay(dayStr: string): HrEvent[] {
    return events.filter((e) => eventIntersectsDay(e, dayStr));
  }

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

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow">
          <p className="text-gray-700">Ссылка недействительна</p>
        </div>
      </div>
    );
  }

  if (accessError && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow">
          <p className="text-gray-700">{accessError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">План мероприятий</h1>

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
                      className="min-h-[80px] border border-gray-200 rounded p-1.5 flex flex-col"
                    >
                      <span className="text-sm font-medium text-gray-700">{day}</span>
                      <div className="mt-1 flex flex-col gap-0.5 overflow-auto">
                        {dayEvents.map((ev) => {
                          const pos = eventDayPosition(ev, dateKey);
                          const rounded =
                            pos === 'only' ? 'rounded' : pos === 'first' ? 'rounded-l' : pos === 'last' ? 'rounded-r' : 'rounded-none';
                          const style = ev.color ? { backgroundColor: `${ev.color}20` } : undefined;
                          const className = ev.color
                            ? `text-xs px-1.5 py-1 min-h-[1.5rem] text-gray-800 truncate ${rounded}`
                            : `text-xs px-1.5 py-1 min-h-[1.5rem] bg-accent/10 text-gray-800 truncate ${rounded}`;
                          return (
                            <div
                              key={`${ev.id}-${dateKey}`}
                              className={className}
                              style={style}
                              title={ev.description || ev.title}
                            >
                              {ev.title}
                            </div>
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
    </div>
  );
}
