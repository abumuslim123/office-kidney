import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import HrTabs from '../HrTabs';

const sideLinks = [
  { to: '/hr/resume', label: 'Загрузка', end: true },
  { to: '/hr/resume/leads', label: 'Заявки' },
  { to: '/hr/resume/candidates', label: 'Кандидаты' },
  { to: '/hr/resume/analytics', label: 'Аналитика' },

  { to: '/hr/resume/archive', label: 'Архив' },
  { to: '/hr/resume/trash', label: 'Корзина' },
];

export default function ResumeLayout() {
  const applyUrl = `${window.location.origin}/resume/apply`;
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(applyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const linkClass = (isActive: boolean) =>
    `block px-3 py-2 rounded text-sm font-medium transition-colors ${
      isActive ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div>
      <HrTabs active="resume" />
      <div className="flex gap-6">
        <aside className="w-48 flex-shrink-0">
          <nav className="flex flex-col gap-1">
            {sideLinks.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => linkClass(isActive)}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={copyLink}
              className={`w-full text-left px-3 py-2 text-xs transition-colors rounded ${
                copied
                  ? 'text-green-600 bg-green-50'
                  : 'text-gray-500 hover:text-accent hover:bg-gray-50'
              }`}
              title={applyUrl}
            >
              {copied ? 'Ссылка скопирована!' : 'Копировать ссылку для соискателей'}
            </button>
          </div>
        </aside>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
