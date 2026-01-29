import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Role = { id: string; slug: string; name: string };
type Permission = { id: string; slug: string; name: string };
type UserRow = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  role: Role;
  permissions: Permission[];
  createdAt: string;
};

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', displayName: '', roleId: '', isActive: true, permissionIds: [] as string[] });
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [uRes, rRes, pRes] = await Promise.all([
        api.get<UserRow[]>('/users'),
        api.get<Role[]>('/users/roles'),
        api.get<Permission[]>('/users/permissions'),
      ]);
      setUsers(uRes.data);
      setRoles(rRes.data);
      setPermissions(pRes.data);
      if (rRes.data.length && !form.roleId) setForm((f) => ({ ...f, roleId: rRes.data[0].id }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      setShowForm(false);
      setForm({ email: '', password: '', displayName: '', roleId: roles[0]?.id || '', isActive: true, permissionIds: [] });
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка создания');
    }
  };

  const togglePermission = (permId: string) => {
    setForm((f) => ({
      ...f,
      permissionIds: f.permissionIds.includes(permId)
        ? f.permissionIds.filter((id) => id !== permId)
        : [...f.permissionIds, permId],
    }));
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await api.put(`/users/${id}`, { isActive });
      load();
    } catch {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Пользователи</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover"
        >
          {showForm ? 'Отмена' : 'Добавить'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg max-w-md">
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <div className="grid gap-3">
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <input
              type="password"
              placeholder="Пароль"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <input
              type="text"
              placeholder="Имя"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <select
              value={form.roleId}
              onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Активен
            </label>
            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 mb-2">Права доступа:</p>
              <div className="flex flex-wrap gap-3">
                {permissions.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.permissionIds.includes(p.id)}
                      onChange={() => togglePermission(p.id)}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button type="submit" className="mt-3 px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover">
            Создать
          </button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Имя</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Роль</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Права</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Статус</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.displayName || '—'}</td>
                  <td className="px-4 py-3">{u.role?.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.permissions?.map((p) => (
                        <span key={p.id} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                          {p.name}
                        </span>
                      )) || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">{u.isActive ? 'Активен' : 'Отключён'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(u.id, !u.isActive)}
                      className="text-accent hover:underline"
                    >
                      {u.isActive ? 'Отключить' : 'Включить'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
