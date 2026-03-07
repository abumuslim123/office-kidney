import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type NavItem = {
  to: string;
  label: string;
  permissions?: string[];
};

const nav: NavItem[] = [
  { to: '/', label: 'Главная' },
  { to: '/calls', label: 'KCalls', permissions: ['calls'] },
  { to: '/processes', label: 'Процессы', permissions: ['processes_view'] },
  { to: '/agents', label: 'Агенты', permissions: ['agents'] },
  { to: '/bitrix24', label: 'Битрикс24', permissions: ['bitrix24'] },
  { to: '/services', label: 'Сервисы', permissions: ['services'] },
  { to: '/hr', label: 'HR', permissions: ['hr'] },
  { to: '/users', label: 'Пользователи', permissions: ['users'] },
  { to: '/screens', label: 'Настройка экранов', permissions: ['screens'] },
  { to: '/settings', label: 'Настройки', permissions: ['processes_edit'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userPermissions = user?.permissions?.map((p) => p.slug) || [];

  const visibleNav = nav.filter(
    (item) =>
      !item.permissions ||
      item.permissions.some((perm) => userPermissions.includes(perm))
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-gray-900">Kidney Office</h1>
          <nav className="flex gap-1">
            {visibleNav.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-medium ${
                    isActive ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {user?.displayName || user?.login || user?.email} <span className="text-gray-400">({user?.role})</span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Выход
          </button>
        </div>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
