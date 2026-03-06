import { NavLink } from 'react-router-dom';

const resumeEnabled = import.meta.env.VITE_FEATURE_RESUME !== 'false';

type HrTabsProps = {
  active?: 'hunter' | 'lists' | 'events' | 'resume';
};

export default function HrTabs({ active }: HrTabsProps) {
  const linkClass = (isActive: boolean, forceActive = false) =>
    `px-3 py-2 rounded text-sm font-medium ${
      isActive || forceActive ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
      <NavLink to="/hr/hunter" className={({ isActive }) => linkClass(isActive, active === 'hunter')}>
        Хантер
      </NavLink>
      <NavLink to="/hr" end className={({ isActive }) => linkClass(isActive, active === 'lists')}>
        Списки
      </NavLink>
      <NavLink to="/hr/events" className={({ isActive }) => linkClass(isActive, active === 'events')}>
        План мероприятий
      </NavLink>
      {resumeEnabled && (
        <NavLink to="/hr/resume" className={({ isActive }) => linkClass(isActive, active === 'resume')}>
          Резюме
        </NavLink>
      )}
    </div>
  );
}
