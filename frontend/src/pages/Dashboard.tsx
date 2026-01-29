import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Главная</h2>
      <p className="text-gray-600">
        Добро пожаловать, {user?.displayName || user?.email}. Выберите раздел в меню.
      </p>
    </div>
  );
}
