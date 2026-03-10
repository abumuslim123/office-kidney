import { NavLink, Outlet } from 'react-router-dom';

const sidebarItems = [
  { to: '/settings', label: 'Основные', end: true },
  { to: '/settings/bitrix24', label: 'Битрикс24' },
  { to: '/settings/processes', label: 'Процессы' },
  { to: '/settings/kcalls', label: 'KCalls' },
];

export default function SettingsLayout() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Настройки</h2>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="flex-shrink-0 w-48 space-y-1">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : undefined}
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
