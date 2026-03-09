import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const sidebarItems = [
  { to: '/calls/settings/provider', label: 'Провайдер' },
  { to: '/calls/settings/dictionary', label: 'Словарь' },
  { to: '/calls/settings/topics', label: 'Тематики' },
  { to: '/calls/settings/unwanted-words', label: 'Нежелательные слова' },
  { to: '/calls/settings/favorites', label: 'Избранное' },
  { to: '/calls/settings/recording', label: 'Режим записи' },
  { to: '/calls/settings/reports', label: 'Отчеты' },
];

export default function CallsSettingsLayout() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/calls')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Назад"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold text-gray-900">Настройки KCalls</h2>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="flex-shrink-0 w-48 space-y-1">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
