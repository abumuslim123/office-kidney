import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type Role = { id: string; slug: string; name: string };
type Permission = { id: string; slug: string; name: string };
type UserRow = {
  id: string;
  login: string;
  email?: string;
  displayName: string;
  isActive: boolean;
  role: Role;
  permissions: Permission[];
  createdAt: string;
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ login: '', email: '', password: '', displayName: '', roleId: '', isActive: true, permissionIds: [] as string[] });
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ login: '', email: '', displayName: '', roleId: '', isActive: true, permissionIds: [] as string[] });
  const [editError, setEditError] = useState('');
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const processPerms = permissions.filter(
    (p) =>
      p.slug === 'processes_view' ||
      p.slug === 'processes_edit' ||
      p.slug === 'processes_approve',
  );
  const hrPerms = permissions.filter((p) => p.slug === 'hr' || p.slug.startsWith('hr_'));
  const otherPerms = permissions.filter(
    (p) =>
      !hrPerms.some((x) => x.id === p.id) &&
      !processPerms.some((x) => x.id === p.id),
  );

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
      setForm({ login: '', email: '', password: '', displayName: '', roleId: roles[0]?.id || '', isActive: true, permissionIds: [] });
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

  const toggleEditPermission = (permId: string) => {
    setEditForm((f) => ({
      ...f,
      permissionIds: f.permissionIds.includes(permId)
        ? f.permissionIds.filter((id) => id !== permId)
        : [...f.permissionIds, permId],
    }));
  };

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setEditForm({
      login: u.login || '',
      email: u.email ?? '',
      displayName: u.displayName || '',
      roleId: u.role?.id || roles[0]?.id || '',
      isActive: u.isActive,
      permissionIds: u.permissions?.map((p) => p.id) || [],
    });
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');
    try {
      await api.put(`/users/${editingUser.id}`, editForm);
      setEditingUser(null);
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setEditError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка сохранения');
    }
  };

  const openPassword = (u: UserRow) => {
    setPasswordUser(u);
    setPasswordForm({ currentPassword: '', newPassword: '' });
    setPasswordError('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      setPasswordError('Новый пароль не менее 6 символов');
      return;
    }
    const isSelf = currentUser?.id === passwordUser.id;
    if (isSelf && !passwordForm.currentPassword?.trim()) {
      setPasswordError('Введите текущий пароль');
      return;
    }
    setPasswordError('');
    try {
      await api.post(`/users/${passwordUser.id}/change-password`, {
        currentPassword: isSelf ? passwordForm.currentPassword : undefined,
        newPassword: passwordForm.newPassword,
      });
      setPasswordUser(null);
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setPasswordError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка смены пароля');
    }
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
              type="text"
              placeholder="Логин"
              value={form.login}
              onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <input
              type="email"
              placeholder="Email (необязательно)"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
              <div className="flex flex-col gap-3">
                {processPerms.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Процессы</p>
                    <div className="flex flex-wrap gap-3">
                      {processPerms.map((p) => (
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
                )}
                {hrPerms.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">HR</p>
                    <div className="flex flex-wrap gap-3">
                      {hrPerms.map((p) => (
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
                )}
                {otherPerms.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {otherPerms.map((p) => (
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
                )}
              </div>
            </div>
          </div>
          <button type="submit" className="mt-3 px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover">
            Создать
          </button>
        </form>
      )}

      {editingUser && (
        <form onSubmit={handleSaveEdit} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg w-full max-w-4xl">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Редактировать пользователя</h3>
          {editError && <p className="text-red-600 text-sm mb-2">{editError}</p>}
          <div className="grid gap-3">
            <input
              type="text"
              placeholder="Логин"
              value={editForm.login}
              onChange={(e) => setEditForm((f) => ({ ...f, login: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <input
              type="email"
              placeholder="Email (необязательно)"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <input
              type="text"
              placeholder="Имя"
              value={editForm.displayName}
              onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <select
              value={editForm.roleId}
              onChange={(e) => setEditForm((f) => ({ ...f, roleId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Активен
            </label>
            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 mb-2">Права доступа:</p>
              <div className="flex flex-wrap gap-8">
                {processPerms.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Процессы</p>
                    <div className="flex flex-col gap-2">
                      {processPerms.map((p) => (
                        <label key={p.id} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.permissionIds.includes(p.id)}
                            onChange={() => toggleEditPermission(p.id)}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {hrPerms.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">HR</p>
                    <div className="flex flex-col gap-2">
                      {hrPerms.map((p) => (
                        <label key={p.id} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.permissionIds.includes(p.id)}
                            onChange={() => toggleEditPermission(p.id)}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {otherPerms.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Другое</p>
                    <div className="flex flex-col gap-2">
                      {otherPerms.map((p) => (
                        <label key={p.id} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.permissionIds.includes(p.id)}
                            onChange={() => toggleEditPermission(p.id)}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover">
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => openPassword(editingUser)}
              className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
            >
              Сменить пароль
            </button>
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {passwordUser && (
        <form onSubmit={handleChangePassword} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg max-w-md">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Сменить пароль {currentUser?.id === passwordUser.id ? '(свой)' : `— ${passwordUser.login}`}
          </h3>
          {passwordError && <p className="text-red-600 text-sm mb-2">{passwordError}</p>}
          <div className="grid gap-3">
            {currentUser?.id === passwordUser.id && (
              <input
                type="password"
                placeholder="Текущий пароль"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            )}
            <input
              type="password"
              placeholder="Новый пароль"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover">
              Сменить пароль
            </button>
            <button
              type="button"
              onClick={() => setPasswordUser(null)}
              className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Логин</th>
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
                  <td className="px-4 py-3">{u.login}</td>
                  <td className="px-4 py-3">{u.email ?? '—'}</td>
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        title="Редактировать"
                        className="p-2 rounded text-blue-600 hover:bg-blue-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.795L2 15.174V18h2.826l9.38-9.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPassword(u)}
                        title="Сменить пароль"
                        className="p-2 rounded text-gray-600 hover:bg-gray-100"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                          <path fillRule="evenodd" d="M8 10a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5A.75.75 0 0 1 8 10Z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M3.75 6A2.75 2.75 0 0 1 6.5 3.25h7A2.75 2.75 0 0 1 16.25 6v8A2.75 2.75 0 0 1 13.5 16.75h-7A2.75 2.75 0 0 1 3.75 14V6Zm2.75-1.25a1.25 1.25 0 0 0-1.25 1.25v8a1.25 1.25 0 0 0 1.25 1.25h7a1.25 1.25 0 0 0 1.25-1.25V6a1.25 1.25 0 0 0-1.25-1.25h-7Z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(u.id, !u.isActive)}
                        title={u.isActive ? 'Отключить' : 'Включить'}
                        className={`p-2 rounded ${u.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                      >
                        {u.isActive ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
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
