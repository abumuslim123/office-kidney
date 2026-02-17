import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import ProcessesEditor, { BlockChange } from '../components/processes/ProcessesEditor';

type ProcessDepartmentNode = {
  id: string;
  name: string;
  parentId: string | null;
  children: ProcessDepartmentNode[];
};

type ProcessItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type ProcessVersion = {
  id: string;
  version: number;
  descriptionDoc: { doc?: Record<string, unknown>; text?: string };
  diffData: { changes: BlockChange[] } | null;
  changedAt: string;
};

type ProcessDetails = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentDescriptionDoc: { doc?: Record<string, unknown>; text?: string };
  latestVersion: ProcessVersion | null;
};

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

export default function Processes() {
  const { user } = useAuth();
  const canEdit = useMemo(
    () => user?.permissions?.some((p) => p.slug === 'processes_edit') ?? false,
    [user],
  );

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<ProcessDepartmentNode[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [items, setItems] = useState<ProcessItem[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<ProcessDetails | null>(null);
  const [versions, setVersions] = useState<ProcessVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [departmentForm, setDepartmentForm] = useState({ name: '', parentId: '' });
  const [showProcessForm, setShowProcessForm] = useState(false);
  const [processTitleDraft, setProcessTitleDraft] = useState('');
  const [processDocDraft, setProcessDocDraft] = useState<Record<string, unknown> | null>(null);
  const [editDocDraft, setEditDocDraft] = useState<Record<string, unknown> | null>(null);
  const [iterationDocDraft, setIterationDocDraft] = useState<Record<string, unknown> | null>(null);
  const [isIterationMode, setIsIterationMode] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? null;

  const loadDepartments = async () => {
    const res = await api.get<ProcessDepartmentNode[]>('/processes/departments');
    setDepartments(res.data);
    if (!selectedDepartmentId && res.data[0]?.id) {
      setSelectedDepartmentId(res.data[0].id);
    }
  };

  const loadItems = async (departmentId: string) => {
    const res = await api.get<ProcessItem[]>(`/processes/departments/${departmentId}/items`);
    setItems(res.data);
  };

  const loadProcess = async (processId: string) => {
    const [detailsRes, versionsRes] = await Promise.all([
      api.get<ProcessDetails>(`/processes/${processId}`),
      api.get<ProcessVersion[]>(`/processes/${processId}/versions`),
    ]);
    setSelectedProcess(detailsRes.data);
    setEditDocDraft(detailsRes.data.currentDescriptionDoc?.doc ?? null);
    setIterationDocDraft(null);
    setIsIterationMode(false);
    setVersions(versionsRes.data);
    setSelectedVersionId(versionsRes.data[0]?.id ?? null);
  };

  useEffect(() => {
    setLoading(true);
    loadDepartments()
      .catch(() => setError('Не удалось загрузить отделы'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedDepartmentId) return;
    loadItems(selectedDepartmentId).catch(() => setError('Не удалось загрузить процессы отдела'));
  }, [selectedDepartmentId]);

  const collectDepartmentOptions = (
    nodes: ProcessDepartmentNode[],
    level = 0,
  ): Array<{ id: string; label: string }> => {
    const rows: Array<{ id: string; label: string }> = [];
    nodes.forEach((n) => {
      rows.push({ id: n.id, label: `${'— '.repeat(level)}${n.name}` });
      rows.push(...collectDepartmentOptions(n.children || [], level + 1));
    });
    return rows;
  };
  const departmentOptions = collectDepartmentOptions(departments);

  const createDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentForm.name.trim()) return;
    await api.post('/processes/departments', {
      name: departmentForm.name.trim(),
      parentId: departmentForm.parentId || null,
    });
    setDepartmentForm({ name: '', parentId: '' });
    await loadDepartments();
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm('Удалить отдел и вложенные отделы?')) return;
    await api.delete(`/processes/departments/${id}`);
    if (selectedDepartmentId === id) {
      setSelectedDepartmentId(null);
      setItems([]);
      setSelectedProcess(null);
      setEditDocDraft(null);
    }
    await loadDepartments();
  };

  const createProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepartmentId || !processTitleDraft.trim()) return;
    const res = await api.post<ProcessDetails>('/processes', {
      departmentId: selectedDepartmentId,
      title: processTitleDraft.trim(),
      descriptionDoc: { doc: processDocDraft ?? undefined },
    });
    setShowProcessForm(false);
    setProcessTitleDraft('');
    setProcessDocDraft(null);
    await loadItems(selectedDepartmentId);
    await loadProcess(res.data.id);
  };

  const saveProcess = async () => {
    if (!selectedProcess || !canEdit) return;
    setSaving(true);
    try {
      const res = await api.put<ProcessDetails>(`/processes/${selectedProcess.id}`, {
        title: selectedProcess.title.trim(),
      });
      setSelectedProcess(res.data);
    } finally {
      setSaving(false);
    }
  };

  const startIteration = () => {
    if (!selectedProcess || !canEdit) return;
    setIterationDocDraft(selectedProcess.currentDescriptionDoc?.doc ?? editDocDraft ?? null);
    setIsIterationMode(true);
  };

  const cancelIteration = () => {
    setIsIterationMode(false);
    setIterationDocDraft(null);
  };

  const saveIteration = async () => {
    if (!selectedProcess || !canEdit || !isIterationMode) return;
    setSaving(true);
    try {
      await api.post(`/processes/${selectedProcess.id}/versions`, {
        descriptionDoc: { doc: iterationDocDraft ?? undefined },
      });
      await loadProcess(selectedProcess.id);
      setIsIterationMode(false);
      setIterationDocDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const applyVersion = async () => {
    if (!selectedProcess || !selectedVersion || !canEdit) return;
    await api.post(`/processes/${selectedProcess.id}/versions/apply`, {
      versionId: selectedVersion.id,
    });
    await loadProcess(selectedProcess.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Процессы</h2>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-3">Отделы</h3>
          {canEdit && (
            <form onSubmit={createDepartment} className="mb-4 grid gap-2">
              <input
                type="text"
                placeholder="Новый отдел"
                value={departmentForm.name}
                onChange={(e) => setDepartmentForm((f) => ({ ...f, name: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <select
                value={departmentForm.parentId}
                onChange={(e) => setDepartmentForm((f) => ({ ...f, parentId: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="">Без родителя</option>
                {departmentOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-3 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover"
              >
                Создать отдел
              </button>
            </form>
          )}
          <div className="space-y-1">
            {loading ? (
              <div className="text-sm text-gray-500">Загрузка...</div>
            ) : (
              <DepartmentTree
                nodes={departments}
                selectedId={selectedDepartmentId}
                onSelect={setSelectedDepartmentId}
                canEdit={canEdit}
                onDelete={deleteDepartment}
              />
            )}
          </div>
        </div>

        <div className="col-span-3 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Процессы отдела</h3>
            {canEdit && selectedDepartmentId && (
              <button
                type="button"
                onClick={() => setShowProcessForm((v) => !v)}
                className="text-sm text-accent hover:underline"
              >
                {showProcessForm ? 'Отмена' : 'Создать'}
              </button>
            )}
          </div>

          {showProcessForm && (
            <form onSubmit={createProcess} className="mb-4 p-3 border border-gray-200 rounded">
              <input
                type="text"
                placeholder="Заголовок процесса"
                value={processTitleDraft}
                onChange={(e) => setProcessTitleDraft(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2"
              />
              <ProcessesEditor
                editable={canEdit}
                contentDoc={processDocDraft}
                onChange={({ doc }) => setProcessDocDraft(doc)}
                minHeightClassName="min-h-24"
              />
              <button
                type="submit"
                className="mt-2 px-3 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover"
              >
                Создать процесс
              </button>
            </form>
          )}

          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => loadProcess(item.id)}
                className={`w-full text-left px-2 py-2 hover:bg-gray-50 rounded ${
                  selectedProcess?.id === item.id ? 'bg-gray-50' : ''
                }`}
              >
                <div className="font-medium text-sm text-gray-900">{item.title}</div>
                <div className="text-xs text-gray-500">Обновлен: {formatDate(item.updatedAt)}</div>
              </button>
            ))}
            {!items.length && <div className="text-sm text-gray-500 py-2">Нет процессов в отделе</div>}
          </div>
        </div>

        <div className="col-span-6 bg-white border border-gray-200 rounded-lg p-4">
          {!selectedProcess ? (
            <div className="text-gray-500 text-sm">Выберите процесс слева</div>
          ) : (
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <input
                    type="text"
                    value={selectedProcess.title}
                    onChange={(e) =>
                      setSelectedProcess((p) => (p ? { ...p, title: e.target.value } : p))
                    }
                    className="text-lg font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Дата создания: {formatDate(selectedProcess.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHistory(true)}
                    className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                  >
                    История версий
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={saveProcess}
                      className="px-3 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover disabled:opacity-50"
                    >
                      {saving ? 'Сохранение...' : 'Сохранить заголовок'}
                    </button>
                  )}
                </div>
              </div>

              {canEdit && !isIterationMode && (
                <button
                  type="button"
                  onClick={startIteration}
                  className="mb-3 px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                >
                  Внести итерацию
                </button>
              )}
              {canEdit && isIterationMode && (
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveIteration}
                    className="px-3 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover disabled:opacity-50"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить итерацию'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelIteration}
                    className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                </div>
              )}

              <ProcessesEditor
                editable={canEdit && isIterationMode}
                contentDoc={isIterationMode ? iterationDocDraft : editDocDraft}
                changes={selectedProcess.latestVersion?.diffData?.changes || []}
                onChange={({ doc }) => {
                  if (isIterationMode) setIterationDocDraft(doc);
                }}
              />

            </div>
          )}
        </div>
      </div>

      {showHistory && selectedProcess && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-[900px] max-h-[85vh] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">История версий процесса</h3>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Закрыть
              </button>
            </div>
            <div className="grid grid-cols-12 h-[70vh]">
              <div className="col-span-4 border-r border-gray-200 overflow-auto">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVersionId(v.id)}
                    className={`w-full text-left px-3 py-2 border-b border-gray-100 ${
                      selectedVersionId === v.id ? 'bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-sm font-medium">Версия #{v.version}</div>
                    <div className="text-xs text-gray-500">{formatDate(v.changedAt)}</div>
                  </button>
                ))}
              </div>
              <div className="col-span-8 p-4 overflow-auto">
                {!selectedVersion ? (
                  <div className="text-sm text-gray-500">Выберите версию</div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm text-gray-600">
                        Версия #{selectedVersion.version} от {formatDate(selectedVersion.changedAt)}
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={applyVersion}
                          className="px-3 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover"
                        >
                          Применить как актуальную
                        </button>
                      )}
                    </div>

                    <ProcessesEditor
                      editable={false}
                      contentDoc={selectedVersion.descriptionDoc?.doc ?? null}
                      changes={selectedVersion.diffData?.changes || []}
                    />

                    {selectedVersion.diffData?.changes && selectedVersion.diffData.changes.length > 0 && (
                      <div className="mt-3 border border-gray-200 rounded p-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Изменения в этой версии</p>
                        <div className="space-y-2">
                          {selectedVersion.diffData.changes.map((ch, idx) => (
                            <div key={idx} className="text-xs border-l-2 border-gray-300 pl-2">
                              {ch.changeType === 'modified' && ch.oldText && (
                                <div>
                                  <span className="text-red-600 font-medium">Удалено: </span>
                                  <span className="text-gray-600 line-through">
                                    {ch.oldText.length > 300 ? ch.oldText.slice(0, 300) + '...' : ch.oldText}
                                  </span>
                                </div>
                              )}
                              {ch.newText && (
                                <div className={ch.oldText ? 'mt-1' : ''}>
                                  <span className="text-green-600 font-medium">Добавлено: </span>
                                  <span className="text-gray-800">
                                    {ch.newText.length > 300 ? ch.newText.slice(0, 300) + '...' : ch.newText}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentTree({
  nodes,
  selectedId,
  onSelect,
  canEdit,
  onDelete,
}: {
  nodes: ProcessDepartmentNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canEdit: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <div key={node.id}>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              className={`text-sm text-left px-2 py-1 rounded hover:bg-gray-100 flex-1 ${
                selectedId === node.id ? 'bg-gray-100 font-medium' : ''
              }`}
            >
              {node.name}
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Удалить
              </button>
            )}
          </div>
          {!!node.children?.length && (
            <div className="ml-3 border-l border-gray-200 pl-2 mt-1">
              <DepartmentTree
                nodes={node.children}
                selectedId={selectedId}
                onSelect={onSelect}
                canEdit={canEdit}
                onDelete={onDelete}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
