import { Link } from 'react-router-dom';

export default function Bitrix24() {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Списки</h3>
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
          Если Битрикс24 пишет «Нет прав для просмотра списка» — откройте список в Битрикс24 → Настройки списка → Права доступа и выдайте пользователю, от которого создан вебхук, право на просмотр и изменение.
        </p>
        <Link
          to="/bitrix24/employees"
          className="inline-flex items-center px-4 py-2 bg-accent text-white rounded text-sm font-medium hover:opacity-90"
        >
          Сотрудники
        </Link>
        <p className="text-sm text-gray-500 mt-2">
          Просмотр, добавление и удаление элементов списка «Сотрудники» из Битрикс24.
        </p>
      </div>
    </div>
  );
}
