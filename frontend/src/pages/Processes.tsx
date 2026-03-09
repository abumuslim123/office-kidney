import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import ProcessesEditor, { BlockChange } from '../components/processes/ProcessesEditor';
import {
  hasDocTaggedMarks,
  buildDiffFromTaggedDoc,
  getTextExcludingDeleted,
} from '../components/processes/taggedDiffUtils';

type ProcessDepartmentNode = {
  id: string;
  name: string;
  parentId: string | null;
  hasUnread?: boolean;
  children: ProcessDepartmentNode[];
};

type ProcessItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  hasUnread?: boolean;
};

type ChecklistByRole = {
  role: string;
  sections: Array<{ title: string; items: string[] }>;
};

type ProcessVersion = {
  id: string;
  version: number;
  descriptionDoc: { doc?: Record<string, unknown>; text?: string };
  diffData: { changes: BlockChange[] } | null;
  changeReason?: string | null;
  changedAt: string;
  changedBy?: { id: string; displayName?: string; login?: string } | null;
  checklist?: {
    items?: Array<{ title: string; assignee?: string; completed?: boolean }>;
    checklistsByRole?: Array<{
      role: string;
      sections: Array<{ title: string; items: Array<{ title: string; completed?: boolean }> }>;
    }>;
  } | null;
};

type ProcessDetails = {
  id: string;
  departmentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  hasUnread?: boolean;
  currentDescriptionDoc: { doc?: Record<string, unknown>; text?: string };
  department?: { id: string; name: string; parentId: string | null };
  latestVersion: ProcessVersion | null;
  acknowledgmentStats?: { total: number; acknowledged: number; notAcknowledgedUserNames?: string[] };
};

type ProcessActivityItem = {
  id: string;
  processId: string;
  versionId: string | null;
  actionType:
    | 'view_process'
    | 'view_version'
    | 'acknowledge_latest'
    | 'checklist_approved'
    | 'version_created';
  createdAt: string;
  meta: Record<string, unknown> | null;
  user: {
    id: string;
    login: string;
    displayName: string;
  };
  version: {
    id: string;
    version: number;
  } | null;
};

type AssignableUser = {
  id: string;
  login: string;
  displayName: string;
};

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

function ChecklistByRoleAccordion({
  checklistsByRole,
  className = '',
  title,
}: {
  checklistsByRole: Array<{
    role: string;
    sections: Array<{ title: string; items: Array<{ title: string; completed?: boolean }> }>;
  }>;
  className?: string;
  title: string;
}) {
  const [expandedRoleIndex, setExpandedRoleIndex] = useState<number | null>(null);
  return (
    <div className={className}>
      {title ? <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4> : null}
      <div className="space-y-1">
        {checklistsByRole.map((cr, roleIdx) => (
          <div key={roleIdx} className="border border-gray-200 rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedRoleIndex((i) => (i === roleIdx ? null : roleIdx))}
              className="w-full text-left px-3 py-2 text-sm font-medium text-gray-800 bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
            >
              <span>Чек-лист — {cr.role}</span>
              <span className="text-gray-500">{expandedRoleIndex === roleIdx ? '▼' : '▶'}</span>
            </button>
            {expandedRoleIndex === roleIdx && (
              <div className="px-3 py-2 bg-white border-t border-gray-200 space-y-3">
                {cr.sections.map((sec, secIdx) => (
                  <div key={secIdx}>
                    <p className="text-xs font-medium text-gray-600 mb-1">{sec.title}</p>
                    <ul className="space-y-1 list-disc list-inside text-sm text-gray-700">
                      {sec.items.map((it, itemIdx) => (
                        <li key={itemIdx} className="flex items-center gap-2">
                          <span className="flex-shrink-0 text-gray-500">
                            {it.completed === true ? '✓' : '○'}
                          </span>
                          <span className={it.completed === true ? 'text-gray-500 line-through' : ''}>
                            {it.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditableChecklistByRole({
  value,
  onChange,
  className = '',
}: {
  value: ChecklistByRole[];
  onChange: (value: ChecklistByRole[]) => void;
  className?: string;
}) {
  const [expandedRoleIndex, setExpandedRoleIndex] = useState<number | null>(0);

  const updateRole = (roleIdx: number, role: string) => {
    const next = value.map((cr, i) => (i === roleIdx ? { ...cr, role } : cr));
    onChange(next);
  };
  const updateSectionTitle = (roleIdx: number, secIdx: number, title: string) => {
    const next = value.map((cr, i) =>
      i === roleIdx
        ? {
            ...cr,
            sections: cr.sections.map((s, j) => (j === secIdx ? { ...s, title } : s)),
          }
        : cr,
    );
    onChange(next);
  };
  const updateItem = (roleIdx: number, secIdx: number, itemIdx: number, title: string) => {
    const next = value.map((cr, i) =>
      i === roleIdx
        ? {
            ...cr,
            sections: cr.sections.map((s, j) =>
              j === secIdx
                ? { ...s, items: s.items.map((it, k) => (k === itemIdx ? title : it)) }
                : s,
            ),
          }
        : cr,
    );
    onChange(next);
  };
  const addItem = (roleIdx: number, secIdx: number) => {
    const next = value.map((cr, i) =>
      i === roleIdx
        ? {
            ...cr,
            sections: cr.sections.map((s, j) =>
              j === secIdx ? { ...s, items: [...s.items, ''] } : s,
            ),
          }
        : cr,
    );
    onChange(next);
  };
  const removeItem = (roleIdx: number, secIdx: number, itemIdx: number) => {
    const next = value.map((cr, i) =>
      i === roleIdx
        ? {
            ...cr,
            sections: cr.sections.map((s, j) =>
              j === secIdx ? { ...s, items: s.items.filter((_, k) => k !== itemIdx) } : s,
            ),
          }
        : cr,
    );
    onChange(next);
  };
  const addSection = (roleIdx: number) => {
    const next = value.map((cr, i) =>
      i === roleIdx ? { ...cr, sections: [...cr.sections, { title: '', items: [''] }] } : cr,
    );
    onChange(next);
  };
  const removeSection = (roleIdx: number, secIdx: number) => {
    const next = value.map((cr, i) =>
      i === roleIdx ? { ...cr, sections: cr.sections.filter((_, j) => j !== secIdx) } : cr,
    );
    onChange(next);
  };
  const removeRole = (roleIdx: number) => {
    onChange(value.filter((_, i) => i !== roleIdx));
    if (expandedRoleIndex === roleIdx) setExpandedRoleIndex(null);
    else if (expandedRoleIndex !== null && expandedRoleIndex > roleIdx)
      setExpandedRoleIndex(expandedRoleIndex - 1);
  };

  return (
    <div className={className}>
      <p className="text-xs text-gray-500 mb-2">Отредактируйте при необходимости и нажмите «Утвердить».</p>
      <div className="space-y-1">
        {value.map((cr, roleIdx) => (
          <div key={roleIdx} className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
              <button
                type="button"
                onClick={() => setExpandedRoleIndex((i) => (i === roleIdx ? null : roleIdx))}
                className="shrink-0 text-gray-500 hover:text-gray-700 p-0.5"
                title={expandedRoleIndex === roleIdx ? 'Свернуть' : 'Развернуть'}
              >
                {expandedRoleIndex === roleIdx ? '▼' : '▶'}
              </button>
              <input
                type="text"
                value={cr.role}
                onChange={(e) => updateRole(roleIdx, e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 text-sm font-medium text-gray-800 border border-gray-300 rounded"
                placeholder="Чек-лист — роль / должность"
              />
              {value.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRole(roleIdx)}
                  className="text-red-600 hover:text-red-800 text-xs px-1"
                  title="Удалить чек-лист этой роли"
                >
                  ✕
                </button>
              )}
            </div>
            {expandedRoleIndex === roleIdx && (
              <div className="px-3 py-2 bg-white space-y-4">
                {cr.sections.map((sec, secIdx) => (
                  <div key={secIdx} className="border-l-2 border-gray-200 pl-3">
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="text"
                        value={sec.title}
                        onChange={(e) => updateSectionTitle(roleIdx, secIdx, e.target.value)}
                        className="flex-1 px-2 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded"
                        placeholder="Название секции"
                      />
                      {cr.sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(roleIdx, secIdx)}
                          className="text-red-600 hover:text-red-800 text-xs"
                          title="Удалить секцию"
                        >
                          Удалить секцию
                        </button>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {sec.items.map((it, itemIdx) => (
                        <li key={itemIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={it}
                            onChange={(e) => updateItem(roleIdx, secIdx, itemIdx, e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            placeholder="Пункт"
                          />
                          <button
                            type="button"
                            onClick={() => removeItem(roleIdx, secIdx, itemIdx)}
                            className="text-red-600 hover:text-red-800 text-xs shrink-0"
                            title="Удалить пункт"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => addItem(roleIdx, secIdx)}
                      className="mt-1 text-xs text-gray-600 hover:text-gray-800"
                    >
                      + Добавить пункт
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSection(roleIdx)}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  + Добавить секцию
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getActivityActionText(item: ProcessActivityItem): string {
  if (item.actionType === 'view_process') {
    return 'Просмотрел процесс';
  }
  if (item.actionType === 'view_version') {
    const version = item.version?.version;
    return version ? `Просмотрел итерацию #${version}` : 'Просмотрел итерацию';
  }
  if (item.actionType === 'checklist_approved') {
    const n = item.meta && typeof item.meta.itemsCount === 'number' ? item.meta.itemsCount : null;
    return n != null ? `Утвердил чек-лист (${n} ${n === 1 ? 'пункт' : n < 5 ? 'пункта' : 'пунктов'})` : 'Утвердил чек-лист';
  }
  if (item.actionType === 'version_created') {
    const version = item.version?.version;
    return version ? `Создал итерацию #${version}` : 'Создал итерацию';
  }
  const version = item.version?.version;
  return version
    ? `Нажал «Ознакомился» с итерацией #${version}`
    : 'Нажал «Ознакомился»';
}

export default function Processes() {
  const { user } = useAuth();
  const location = useLocation();
  const canEdit = useMemo(
    () => user?.permissions?.some((p) => p.slug === 'processes_edit') ?? false,
    [user],
  );
  const canForceApprove = useMemo(
    () =>
      user?.permissions?.some((p) => p.slug === 'processes_approve') ||
      user?.role === 'admin' ||
      false,
    [user],
  );

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<ProcessDepartmentNode[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [items, setItems] = useState<ProcessItem[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<ProcessDetails | null>(null);
  const [versions, setVersions] = useState<ProcessVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityItems, setActivityItems] = useState<ProcessActivityItem[]>([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [departmentForm, setDepartmentForm] = useState({ name: '', parentId: '' });
  const [showProcessForm, setShowProcessForm] = useState(false);
  const [processTitleDraft, setProcessTitleDraft] = useState('');
  const [processDocDraft, setProcessDocDraft] = useState<Record<string, unknown> | null>(null);
  const [editDocDraft, setEditDocDraft] = useState<Record<string, unknown> | null>(null);
  const [iterationDocDraft, setIterationDocDraft] = useState<Record<string, unknown> | null>(null);
  const [iterationChangeReason, setIterationChangeReason] = useState('');
  const [isIterationMode, setIsIterationMode] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [forceAcknowledging, setForceAcknowledging] = useState(false);
  const [creatingProcess, setCreatingProcess] = useState(false);
  const [deleteDepartmentModal, setDeleteDepartmentModal] = useState<{
    id: string;
    processCount: number;
  } | null>(null);
  const [moveToDepartmentId, setMoveToDepartmentId] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [editDepartmentModal, setEditDepartmentModal] = useState<{
    id: string;
    name: string;
    parentId: string;
    userIds: string[];
  } | null>(null);
  const [savingDepartmentEdit, setSavingDepartmentEdit] = useState(false);
  const [titleInputWidth, setTitleInputWidth] = useState(192); // 12rem default
  const titleMeasureRef = useRef<HTMLSpanElement>(null);
  const lastActivitySearchRef = useRef<string | undefined>(undefined);
  const [showChecklistBlock, setShowChecklistBlock] = useState(false);
  const [checklistDocDraft, setChecklistDocDraft] = useState<Record<string, unknown> | null>(null);
  const [checklistStructuredDraft, setChecklistStructuredDraft] = useState<ChecklistByRole[] | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState('');
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [ackTooltipVisible, setAckTooltipVisible] = useState(false);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? null;
  const selectedVersionIndex = selectedVersionId ? versions.findIndex((v) => v.id === selectedVersionId) : -1;
  const previousVersion =
    selectedVersionIndex >= 0 && selectedVersionIndex + 1 < versions.length
      ? versions[selectedVersionIndex + 1]
      : null;
  const hasChanges = (selectedProcess?.latestVersion?.diffData?.changes?.length ?? 0) > 0;
  const titleChanged = selectedProcess ? selectedProcess.title !== originalTitle : false;

  useLayoutEffect(() => {
    const w = titleMeasureRef.current?.offsetWidth;
    if (w != null) setTitleInputWidth(w + 16);
  }, [selectedProcess?.title]);

  useEffect(() => {
    if (!showActivityHistory) {
      lastActivitySearchRef.current = undefined;
      return;
    }
    if (!selectedProcess) return;
    if (lastActivitySearchRef.current === activitySearch) return;
    const tid = setTimeout(() => {
      lastActivitySearchRef.current = activitySearch;
      setActivityLoading(true);
      const query = activitySearch.trim();
      const qs = query ? `?search=${encodeURIComponent(query)}` : '';
      api
        .get<ProcessActivityItem[]>(`/processes/${selectedProcess.id}/activity${qs}`)
        .then((res) => setActivityItems(res.data))
        .catch(() => {
          setError('Не удалось загрузить общую историю');
          setActivityItems([]);
        })
        .finally(() => setActivityLoading(false));
    }, 350);
    return () => clearTimeout(tid);
  }, [showActivityHistory, selectedProcess?.id, activitySearch]);

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
    setSelectedDepartmentId(detailsRes.data.departmentId);
    setOriginalTitle(detailsRes.data.title);
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

  const loadAssignableUsers = async () => {
    if (!canEdit) return;
    const res = await api.get<AssignableUser[]>('/processes/users/candidates');
    setAssignableUsers(res.data);
  };

  useEffect(() => {
    if (!canEdit) return;
    loadAssignableUsers().catch(() => setError('Не удалось загрузить пользователей'));
  }, [canEdit]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const processId = params.get('processId');
    if (!processId) return;
    if (selectedProcess?.id === processId) return;
    loadProcess(processId).catch(() => setError('Не удалось открыть процесс из уведомления'));
  }, [location.search]);

  useEffect(() => {
    if (!selectedDepartmentId) return;
    let cancelled = false;

    const refreshUnreadIndicators = async () => {
      if (cancelled || document.hidden) return;
      try {
        await Promise.all([loadDepartments(), loadItems(selectedDepartmentId)]);
      } catch {
        // Background refresh failures should not break the page state.
      }
    };

    const intervalId = window.setInterval(() => {
      refreshUnreadIndicators().catch(() => {});
    }, 20000);

    const handleFocus = () => {
      refreshUnreadIndicators().catch(() => {});
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshUnreadIndicators().catch(() => {});
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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

  const findDepartmentNode = (
    nodes: ProcessDepartmentNode[],
    id: string,
  ): ProcessDepartmentNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const nested = findDepartmentNode(node.children || [], id);
      if (nested) return nested;
    }
    return null;
  };

  const openEditDepartment = async (departmentId: string) => {
    if (!canEdit) return;
    const dep = findDepartmentNode(departments, departmentId);
    if (!dep) return;
    try {
      if (!assignableUsers.length) {
        await loadAssignableUsers();
      }
      const usersRes = await api.get<AssignableUser[]>(
        `/processes/departments/${departmentId}/users`,
      );
      setEditDepartmentModal({
        id: dep.id,
        name: dep.name,
        parentId: dep.parentId ?? '',
        userIds: usersRes.data.map((u) => u.id),
      });
    } catch {
      setError('Не удалось загрузить данные отдела');
    }
  };

  const saveDepartmentEdit = async () => {
    if (!canEdit || !editDepartmentModal) return;
    if (!editDepartmentModal.name.trim()) {
      setError('Название отдела не может быть пустым');
      return;
    }
    setSavingDepartmentEdit(true);
    try {
      await api.put(`/processes/departments/${editDepartmentModal.id}`, {
        name: editDepartmentModal.name.trim(),
        parentId: editDepartmentModal.parentId || null,
      });
      await api.put(`/processes/departments/${editDepartmentModal.id}/users`, {
        userIds: editDepartmentModal.userIds,
      });
      await loadDepartments();
      if (selectedDepartmentId) {
        await loadItems(selectedDepartmentId);
      }
      if (selectedProcess?.departmentId === editDepartmentModal.id) {
        await loadProcess(selectedProcess.id);
      }
      setError('');
      setEditDepartmentModal(null);
    } finally {
      setSavingDepartmentEdit(false);
    }
  };

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
    try {
      const res = await api.get<{ count: number }>(
        `/processes/departments/${id}/process-count`,
      );
      if (res.data.count > 0) {
        setDeleteDepartmentModal({ id, processCount: res.data.count });
        setMoveToDepartmentId('');
        return;
      }
    } catch {
      // fallback — if endpoint unavailable, just confirm
    }
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

  const confirmDeleteDepartmentWithProcesses = async () => {
    if (!deleteDepartmentModal) return;
    const { id } = deleteDepartmentModal;
    await api.delete(`/processes/departments/${id}`);
    if (selectedDepartmentId === id) {
      setSelectedDepartmentId(null);
      setItems([]);
      setSelectedProcess(null);
      setEditDocDraft(null);
    }
    setDeleteDepartmentModal(null);
    await loadDepartments();
  };

  const moveProcessesAndDeleteDepartment = async () => {
    if (!deleteDepartmentModal || !moveToDepartmentId) return;
    const { id } = deleteDepartmentModal;
    await api.put(`/processes/departments/${id}/move-processes`, {
      targetDepartmentId: moveToDepartmentId,
    });
    await api.delete(`/processes/departments/${id}`);
    if (selectedDepartmentId === id) {
      setSelectedDepartmentId(moveToDepartmentId);
    }
    setDeleteDepartmentModal(null);
    await loadDepartments();
    if (selectedDepartmentId) await loadItems(selectedDepartmentId);
  };

  const createProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingProcess) return;
    if (!selectedDepartmentId || !processTitleDraft.trim()) return;
    setCreatingProcess(true);
    try {
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
    } finally {
      setCreatingProcess(false);
    }
  };

  const saveProcess = async () => {
    if (!selectedProcess || !canEdit) return;
    setSaving(true);
    try {
      const res = await api.put<ProcessDetails>(`/processes/${selectedProcess.id}`, {
        title: selectedProcess.title.trim(),
      });
      setSelectedProcess(res.data);
      setOriginalTitle(res.data.title);
    } finally {
      setSaving(false);
    }
  };

  const startIteration = () => {
    if (!selectedProcess || !canEdit) return;
    setIterationDocDraft(selectedProcess.currentDescriptionDoc?.doc ?? editDocDraft ?? null);
    setIterationChangeReason('');
    setIsIterationMode(true);
  };

  const cancelIteration = () => {
    setIsIterationMode(false);
    setIterationDocDraft(null);
    setIterationChangeReason('');
  };

  const saveIteration = async () => {
    if (!selectedProcess || !canEdit || !isIterationMode) return;
    setSaving(true);
    try {
      const processId = selectedProcess.id;
      const departmentId = selectedProcess.departmentId;
      const doc = iterationDocDraft ?? undefined;
      const body: {
        descriptionDoc: { doc?: Record<string, unknown> };
        diffData?: { changes: BlockChange[] };
        isIteration: boolean;
        changeReason: string;
      } = {
        descriptionDoc: { doc },
        isIteration: true,
        changeReason: iterationChangeReason.trim(),
      };
      if (doc && hasDocTaggedMarks(doc)) {
        const changes = buildDiffFromTaggedDoc(
          doc,
          user?.displayName || user?.login || '',
          new Date().toISOString(),
        );
        if (changes.length) body.diffData = { changes };
      }
      await api.post(`/processes/${selectedProcess.id}/versions`, body);
      await Promise.all([loadProcess(processId), loadDepartments(), loadItems(departmentId)]);
      setIsIterationMode(false);
      setIterationDocDraft(null);
      setIterationChangeReason('');
    } finally {
      setSaving(false);
    }
  };

  const deleteProcess = async () => {
    if (!selectedProcess || !canEdit) return;
    if (!confirm('Удалить процесс со всей историей?')) return;
    await api.delete(`/processes/${selectedProcess.id}`);
    setSelectedProcess(null);
    setEditDocDraft(null);
    if (selectedDepartmentId) await loadItems(selectedDepartmentId);
  };

  const approveProcess = async () => {
    if (!selectedProcess || !canEdit) return;
    if (!confirm('Утвердить текущий процесс? Подсветка изменений будет снята.')) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/processes/${selectedProcess.id}/approve`);
      await loadProcess(selectedProcess.id);
      if (selectedDepartmentId) await loadItems(selectedDepartmentId);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { status?: number; data?: { message?: string } } })?.response?.status ===
        403
          ? 'Утвердить может только администратор или пользователь с правом «Процессы: утверждение».'
          : 'Не удалось утвердить процесс';
      setError(msg);
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

  const deleteVersion = async () => {
    if (!selectedProcess || !selectedVersion || !canEdit) return;
    if (!window.confirm(`Удалить версию #${selectedVersion.version} из истории?`)) return;
    try {
      await api.delete(`/processes/${selectedProcess.id}/versions/${selectedVersion.id}`);
      await loadProcess(selectedProcess.id);
    } catch {
      setError('Не удалось удалить версию');
    }
  };

  const openVersionInHistory = async (versionId: string) => {
    if (!selectedProcess) return;
    setSelectedVersionId(versionId);
    try {
      const res = await api.get<ProcessVersion>(
        `/processes/${selectedProcess.id}/versions/${versionId}`,
      );
      setVersions((prev) =>
        prev.map((v) => (v.id === versionId ? { ...v, ...res.data } : v)),
      );
    } catch {
      setError('Не удалось открыть итерацию');
    }
  };

  const openActivityHistory = async () => {
    if (!selectedProcess) return;
    setShowActivityHistory(true);
    setActivityLoading(true);
    try {
      const query = activitySearch.trim();
      lastActivitySearchRef.current = activitySearch;
      const qs = query ? `?search=${encodeURIComponent(query)}` : '';
      const res = await api.get<ProcessActivityItem[]>(
        `/processes/${selectedProcess.id}/activity${qs}`,
      );
      setActivityItems(res.data);
    } catch {
      setError('Не удалось загрузить общую историю');
      setActivityItems([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const resetActivitySearch = () => {
    setActivitySearch('');
  };

  const acknowledgeProcess = async () => {
    if (!selectedProcess) return;
    setAcknowledging(true);
    try {
      await api.post(`/processes/${selectedProcess.id}/acknowledge`);
      await Promise.all([
        loadProcess(selectedProcess.id),
        loadDepartments(),
        loadItems(selectedProcess.departmentId),
      ]);
      if (showActivityHistory) {
        const query = activitySearch.trim();
        const qs = query ? `?search=${encodeURIComponent(query)}` : '';
        const historyRes = await api.get<ProcessActivityItem[]>(
          `/processes/${selectedProcess.id}/activity${qs}`,
        );
        setActivityItems(historyRes.data);
      }
    } finally {
      setAcknowledging(false);
    }
  };

  const forceAcknowledgeProcess = async () => {
    if (!selectedProcess || !canForceApprove) return;
    setForceAcknowledging(true);
    try {
      await api.post(`/processes/${selectedProcess.id}/force-acknowledge`);
      await Promise.all([
        loadProcess(selectedProcess.id),
        loadDepartments(),
        loadItems(selectedProcess.departmentId),
      ]);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
        ? (err as { response: { data: { message: string } } }).response.data.message
        : 'Не удалось принудительно ознакомить';
      setError(msg);
    } finally {
      setForceAcknowledging(false);
    }
  };

  function parseChecklistText(text: string): { title: string; assignee?: string }[] {
    return text
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (m) return { title: m[1].trim(), assignee: m[2].trim() || undefined };
        return { title: line, assignee: undefined };
      });
  }

  function textToChecklistDoc(text: string): Record<string, unknown> {
    const lines = text.split(/\n/);
    const content = lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    }));
    return { type: 'doc', content: content.length ? content : [{ type: 'paragraph', content: [] }] };
  }

  function getChecklistTextFromDoc(doc: Record<string, unknown> | null): string {
    if (!doc || !doc.content || !Array.isArray(doc.content)) return '';
    return (doc.content as Record<string, unknown>[])
      .map((node) => {
        if (node.type !== 'paragraph' || !Array.isArray(node.content)) return '';
        return (node.content as Array<{ text?: string }>).map((n) => n.text || '').join('');
      })
      .join('\n');
  }

  const emptyChecklistDoc = useMemo(() => textToChecklistDoc(''), []);

  const loadChecklistIntoDraft = () => {
    if (!selectedProcess?.latestVersion?.checklist || !canEdit) return;
    const cl = selectedProcess.latestVersion.checklist;
    if (cl.checklistsByRole && cl.checklistsByRole.length > 0) {
      const draft: ChecklistByRole[] = cl.checklistsByRole.map((cr) => ({
        role: cr.role,
        sections: cr.sections.map((sec) => ({
          title: sec.title,
          items: sec.items.map((it) => it.title),
        })),
      }));
      setChecklistStructuredDraft(draft);
      setChecklistDocDraft(null);
    } else if (cl.items?.length) {
      const text = cl.items
        .map((it) => (it.assignee ? `${it.title} (${it.assignee})` : it.title))
        .join('\n');
      setChecklistStructuredDraft(null);
      setChecklistDocDraft(textToChecklistDoc(text));
    }
    setShowChecklistBlock(true);
    setChecklistError('');
  };

  const openChecklistBlock = async () => {
    if (!selectedProcess || !canEdit) return;
    setShowChecklistBlock(true);
    setChecklistError('');
    setChecklistDocDraft(emptyChecklistDoc);
    setChecklistStructuredDraft(null);
    const doc =
      isIterationMode ? iterationDocDraft : (editDocDraft ?? selectedProcess.currentDescriptionDoc ?? null);
    const text = getTextExcludingDeleted(doc);
    if (!text.trim()) {
      setChecklistError('Нет текста для анализа. Добавьте описание процесса или итерацию.');
      return;
    }
    setChecklistLoading(true);
    try {
      const res = await api.post<{ checklists: ChecklistByRole[] }>(
        `/processes/${selectedProcess.id}/suggest-checklists`,
        { text },
      );
      const checklists = Array.isArray(res.data?.checklists) ? res.data.checklists : [];
      if (checklists.length > 0) {
        setChecklistStructuredDraft(checklists);
        setChecklistDocDraft(emptyChecklistDoc);
      } else {
        setChecklistStructuredDraft(null);
        setChecklistDocDraft(emptyChecklistDoc);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err &&
        typeof (err as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Не удалось получить предложения';
      setChecklistError(msg);
    } finally {
      setChecklistLoading(false);
    }
  };

  const fetchChecklistSuggestions = async () => {
    if (!selectedProcess || !canEdit) return;
    setChecklistError('');
    const doc =
      isIterationMode ? iterationDocDraft : (editDocDraft ?? selectedProcess.currentDescriptionDoc ?? null);
    const text = getTextExcludingDeleted(doc);
    if (!text.trim()) {
      setChecklistError('Нет текста для анализа.');
      return;
    }
    setChecklistLoading(true);
    try {
      const res = await api.post<{ checklists: ChecklistByRole[] }>(
        `/processes/${selectedProcess.id}/suggest-checklists`,
        { text },
      );
      const checklists = Array.isArray(res.data?.checklists) ? res.data.checklists : [];
      if (checklists.length > 0) {
        setChecklistStructuredDraft(checklists);
        setChecklistDocDraft(emptyChecklistDoc);
      } else {
        setChecklistStructuredDraft(null);
        setChecklistDocDraft(emptyChecklistDoc);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err &&
        typeof (err as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Не удалось получить предложения';
      setChecklistError(msg);
    } finally {
      setChecklistLoading(false);
    }
  };

  const approveChecklist = async () => {
    const structured = checklistStructuredDraft && checklistStructuredDraft.length > 0;
    const text = getChecklistTextFromDoc(checklistDocDraft);
    const items = parseChecklistText(text);
    if (!selectedProcess || !canEdit) return;
    if (!structured && !items.length) return;
    const doc =
      isIterationMode ? iterationDocDraft : (editDocDraft ?? selectedProcess.currentDescriptionDoc ?? null);
    const descriptionDoc = doc && typeof doc === 'object' ? (doc.doc != null ? { doc: doc.doc } : { doc: doc }) : { doc: selectedProcess.currentDescriptionDoc?.doc ?? {} };
    setChecklistSaving(true);
    setChecklistError('');
    try {
      const checklistPayload = structured
        ? {
            checklistsByRole: checklistStructuredDraft!.map((cr) => ({
              role: cr.role,
              sections: cr.sections.map((sec) => ({
                title: sec.title,
                items: sec.items.map((title) => ({ title })),
              })),
            })),
          }
        : { items };
      await api.post(`/processes/${selectedProcess.id}/versions`, {
        descriptionDoc,
        checklist: checklistPayload,
      });
      await Promise.all([
        loadProcess(selectedProcess.id),
        loadDepartments(),
        loadItems(selectedProcess.departmentId),
      ]);
      setShowChecklistBlock(false);
      setChecklistDocDraft(null);
      setChecklistStructuredDraft(null);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err &&
        typeof (err as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Не удалось сохранить чек-лист';
      setChecklistError(msg);
    } finally {
      setChecklistSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Процессы</h2>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg p-3">
          <h3 className="font-medium text-gray-900 mb-2 text-sm">Отделы</h3>
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
                onEdit={openEditDepartment}
                onDelete={deleteDepartment}
              />
            )}
          </div>
        </div>

        <div className="col-span-2 bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 text-sm">Процессы</h3>
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
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm text-gray-900">{item.title}</div>
                  {item.hasUnread && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                      новая итерация
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">Обновлен: {formatDate(item.updatedAt)}</div>
              </button>
            ))}
            {!items.length && <div className="text-sm text-gray-500 py-2">Нет процессов в отделе</div>}
          </div>
        </div>

        <div className="col-span-8 bg-white border border-gray-200 rounded-lg p-4">
          {!selectedProcess ? (
            <div className="text-gray-500 text-sm">Выберите процесс слева</div>
          ) : (
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="inline-block relative">
                  <span
                    ref={titleMeasureRef}
                    aria-hidden
                    className="text-lg font-semibold text-gray-900 invisible absolute left-0 top-0 whitespace-pre pointer-events-none"
                  >
                    {selectedProcess.title || '\u00A0'}
                  </span>
                  <input
                    type="text"
                    value={selectedProcess.title}
                    onChange={(e) =>
                      setSelectedProcess((p) => (p ? { ...p, title: e.target.value } : p))
                    }
                    style={{ width: Math.max(titleInputWidth, 192) }}
                    className="min-w-[12rem] text-lg font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 box-border"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Дата создания: {formatDate(selectedProcess.createdAt)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Отдел: {selectedProcess.department?.name || '—'}{' '}
                    {selectedProcess.hasUnread ? (
                      <span className="text-emerald-700 font-medium">• новая итерация</span>
                    ) : null}
                  </p>
                  {selectedProcess.hasUnread && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={acknowledgeProcess}
                        disabled={acknowledging}
                        className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {acknowledging ? 'Сохранение...' : 'Ознакомился'}
                      </button>
                    </div>
                  )}
                  {selectedProcess.acknowledgmentStats &&
                    selectedProcess.acknowledgmentStats.total > 0 && (
                      <div
                        className="mt-2 relative"
                        onMouseEnter={() => setAckTooltipVisible(true)}
                        onMouseLeave={() => setAckTooltipVisible(false)}
                      >
                        <div className="text-xs text-gray-600">
                          Ознакомились: {selectedProcess.acknowledgmentStats.acknowledged} из{' '}
                          {selectedProcess.acknowledgmentStats.total}
                        </div>
                        <div className="mt-1 h-1.5 w-full max-w-xs bg-gray-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded"
                            style={{
                              width: `${
                                (selectedProcess.acknowledgmentStats.acknowledged /
                                  selectedProcess.acknowledgmentStats.total) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        {ackTooltipVisible &&
                          (selectedProcess.acknowledgmentStats.notAcknowledgedUserNames?.length ?? 0) > 0 && (
                            <div className="absolute z-10 left-0 top-full mt-1 bg-gray-800 text-white text-xs rounded px-2 py-1.5 shadow-lg whitespace-nowrap">
                              Не ознакомились: {(selectedProcess.acknowledgmentStats.notAcknowledgedUserNames ?? []).join(', ')}
                            </div>
                          )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#dc2626' }} />
                            Удалено
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#d97706' }} />
                            Изменено
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#16a34a' }} />
                            Добавлено
                          </span>
                        </div>
                      </div>
                    )}
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && titleChanged && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={saveProcess}
                      className="p-2 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                      title="Сохранить заголовок"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowHistory(true)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                    title="История версий"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={openActivityHistory}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                    title="Общая история действий"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path d="M10 3a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                      <path d="M5.05 5.05A7 7 0 1 1 3 10a1 1 0 1 1 2 0 5 5 0 1 0 1.464-3.536l1.243 1.243A1 1 0 0 1 6 8H3a1 1 0 0 1-1-1V4a1 1 0 1 1 2 0v1.586l1.05-.536Z" />
                    </svg>
                  </button>
                  {canEdit &&
                    hasChanges &&
                    canForceApprove &&
                    (() => {
                      return (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={approveProcess}
                          className="p-2 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 rounded disabled:opacity-50"
                          title="Утвердить процесс"
                        >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                      </svg>
                        </button>
                      );
                    })()}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={deleteProcess}
                      className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded"
                      title="Удалить процесс"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {canEdit && !isIterationMode && (
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={startIteration}
                    className="px-2 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50"
                  >
                    Внести итерацию
                  </button>
                  {versions.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowHistory(true);
                        setCompareMode(true);
                      }}
                      className="px-2 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50"
                    >
                      Сравнить с предыдущей версией
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openChecklistBlock}
                    className="px-2 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50"
                    title="Сгенерировать чек-листы по тексту процесса"
                  >
                    Сгенерировать чек листы
                  </button>
                  {canForceApprove &&
                    selectedProcess?.acknowledgmentStats &&
                    selectedProcess.acknowledgmentStats.total > 0 &&
                    selectedProcess.acknowledgmentStats.acknowledged < selectedProcess.acknowledgmentStats.total && (
                      <button
                        type="button"
                        onClick={forceAcknowledgeProcess}
                        disabled={forceAcknowledging}
                        className="px-2 py-1.5 border border-amber-400 text-amber-700 text-xs rounded hover:bg-amber-50 disabled:opacity-50"
                        title="Отметить всех подписантов как ознакомившихся"
                      >
                        {forceAcknowledging ? 'Сохранение...' : 'Принудительно ознакомить'}
                      </button>
                    )}
                </div>
              )}
              {canEdit && isIterationMode && (
                <div className="mb-3">
                  <label className="block text-xs text-gray-600 mb-1">
                    Комментарий: почему внесли изменения
                  </label>
                  <textarea
                    value={iterationChangeReason}
                    onChange={(e) => setIterationChangeReason(e.target.value)}
                    placeholder="Кратко опишите причину изменений"
                    className="w-full mb-2 px-3 py-2 border border-gray-300 rounded text-sm min-h-[72px]"
                  />
                  <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving || !iterationChangeReason.trim()}
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
                  <button
                    type="button"
                    onClick={openChecklistBlock}
                    className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                    title="Сгенерировать чек-листы по тексту процесса"
                  >
                    Сгенерировать чек листы
                  </button>
                  </div>
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

              {selectedProcess?.latestVersion?.changeReason ? (
                <div className="mt-3 border border-gray-200 rounded p-3 bg-gray-50">
                  <p className="text-xs font-medium text-gray-600 mb-1">Комментарий к последней итерации</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {selectedProcess.latestVersion.changeReason}
                  </p>
                </div>
              ) : null}

              {selectedProcess?.latestVersion?.checklist ? (
                (() => {
                  const cl = selectedProcess.latestVersion.checklist;
                  const byRole = cl.checklistsByRole && cl.checklistsByRole.length > 0;
                  if (byRole) {
                    return (
                      <div className="mt-4 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-700">Текущий чек-лист</h4>
                          {canEdit && !showChecklistBlock && (
                            <button
                              type="button"
                              onClick={loadChecklistIntoDraft}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Редактировать
                            </button>
                          )}
                        </div>
                        <ChecklistByRoleAccordion
                          checklistsByRole={cl.checklistsByRole!}
                          className=""
                          title=""
                        />
                      </div>
                    );
                  }
                  if (cl.items?.length) {
                    return (
                      <div className="mt-4 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-700">Текущий чек-лист</h4>
                          {canEdit && !showChecklistBlock && (
                            <button
                              type="button"
                              onClick={loadChecklistIntoDraft}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Редактировать
                            </button>
                          )}
                        </div>
                        <ul className="space-y-1.5">
                          {cl.items.map((it, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <span className="flex-shrink-0 text-gray-500">
                                {it.completed === true ? '✓' : '○'}
                              </span>
                              <span className={it.completed === true ? 'text-gray-500 line-through' : ''}>
                                {it.title}
                              </span>
                              {it.assignee && (
                                <span className="text-gray-500 text-xs">({it.assignee})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  return null;
                })()
              ) : null}

              {showChecklistBlock && selectedProcess && canEdit && (
                <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Чек-лист</h4>
                  {checklistError && (
                    <p className="text-sm text-red-600 mb-2">{checklistError}</p>
                  )}
                  {checklistLoading ? (
                    <p className="text-sm text-gray-500 mb-2">Загрузка предложений...</p>
                  ) : null}
                  {checklistStructuredDraft && checklistStructuredDraft.length > 0 ? (
                    <EditableChecklistByRole
                      value={checklistStructuredDraft}
                      onChange={setChecklistStructuredDraft}
                      className="mb-3"
                    />
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-2">
                        Один пункт на строку. Ответственного можно указать в скобках: Пункт (Имя). Или нажмите «Сгенерировать» для чек-листов по ролям.
                      </p>
                      <ProcessesEditor
                        editable={true}
                        contentDoc={checklistDocDraft ?? emptyChecklistDoc}
                        onChange={({ doc }) => setChecklistDocDraft(doc)}
                        minHeightClassName="min-h-[120px]"
                      />
                    </>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={fetchChecklistSuggestions}
                      disabled={checklistLoading}
                      className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {checklistLoading ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" aria-hidden />
                          Загрузка...
                        </>
                      ) : (
                        'Сгенерировать'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={approveChecklist}
                      disabled={
                        checklistSaving ||
                        (!(checklistStructuredDraft && checklistStructuredDraft.length > 0) &&
                          !parseChecklistText(getChecklistTextFromDoc(checklistDocDraft)).length)
                      }
                      className="px-3 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover disabled:opacity-50"
                    >
                      {checklistSaving ? 'Сохранение...' : 'Утвердить'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowChecklistBlock(false);
                        setChecklistDocDraft(null);
                        setChecklistStructuredDraft(null);
                        setChecklistError('');
                      }}
                      className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {showProcessForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-[800px] max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Новый процесс</h3>
              <button
                type="button"
                onClick={() => {
                  setShowProcessForm(false);
                  setProcessTitleDraft('');
                  setProcessDocDraft(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Закрыть
              </button>
            </div>
            <form onSubmit={createProcess} className="flex-1 overflow-auto p-5">
              <input
                type="text"
                placeholder="Заголовок процесса"
                value={processTitleDraft}
                onChange={(e) => setProcessTitleDraft(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-3"
              />
              <ProcessesEditor
                editable={canEdit}
                contentDoc={processDocDraft}
                onChange={({ doc }) => setProcessDocDraft(doc)}
                minHeightClassName="min-h-[300px]"
              />
              <div className="flex gap-3 mt-4">
                <button
                  type="submit"
                  disabled={creatingProcess}
                  className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover disabled:opacity-50"
                >
                  {creatingProcess ? 'Создание...' : 'Создать процесс'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProcessForm(false);
                    setProcessTitleDraft('');
                    setProcessDocDraft(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editDepartmentModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-[680px] max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Редактирование отдела</h3>
              <button
                type="button"
                onClick={() => setEditDepartmentModal(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Закрыть
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-4">
              <div>
                <label className="text-sm text-gray-700">Название</label>
                <input
                  type="text"
                  value={editDepartmentModal.name}
                  onChange={(e) =>
                    setEditDepartmentModal((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev,
                    )
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Родительский отдел</label>
                <select
                  value={editDepartmentModal.parentId}
                  onChange={(e) =>
                    setEditDepartmentModal((prev) =>
                      prev ? { ...prev, parentId: e.target.value } : prev,
                    )
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="">Без родителя</option>
                  {departmentOptions
                    .filter((opt) => opt.id !== editDepartmentModal.id)
                    .map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <p className="text-sm text-gray-700 mb-2">Подписка пользователей на итерации</p>
                <div className="max-h-56 overflow-auto border border-gray-200 rounded p-2 space-y-1">
                  {assignableUsers.map((u) => {
                    const checked = editDepartmentModal.userIds.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setEditDepartmentModal((prev) => {
                              if (!prev) return prev;
                              if (e.target.checked) {
                                return {
                                  ...prev,
                                  userIds: Array.from(new Set([...prev.userIds, u.id])),
                                };
                              }
                              return {
                                ...prev,
                                userIds: prev.userIds.filter((id) => id !== u.id),
                              };
                            })
                          }
                        />
                        <span>{u.displayName || u.login}</span>
                      </label>
                    );
                  })}
                  {!assignableUsers.length && (
                    <div className="text-xs text-gray-500">Нет доступных пользователей</div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex items-center gap-3">
              <button
                type="button"
                onClick={saveDepartmentEdit}
                disabled={savingDepartmentEdit}
                className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover disabled:opacity-50"
              >
                {savingDepartmentEdit ? 'Сохранение...' : 'Сохранить отдел'}
              </button>
              <button
                type="button"
                onClick={() => setEditDepartmentModal(null)}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDepartmentModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-[500px] p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Удаление отдела</h3>
            <p className="text-sm text-gray-700 mb-4">
              В отделе {deleteDepartmentModal.processCount}{' '}
              {deleteDepartmentModal.processCount === 1
                ? 'процесс'
                : deleteDepartmentModal.processCount < 5
                  ? 'процесса'
                  : 'процессов'}
              . Что сделать с ними?
            </p>

            <div className="space-y-3 mb-4">
              <div className="border border-gray-200 rounded p-3">
                <p className="text-sm font-medium text-gray-900 mb-2">Перенести в другой отдел</p>
                <select
                  value={moveToDepartmentId}
                  onChange={(e) => setMoveToDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2"
                >
                  <option value="">Выберите отдел</option>
                  {departmentOptions
                    .filter((opt) => opt.id !== deleteDepartmentModal.id)
                    .map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!moveToDepartmentId}
                  onClick={moveProcessesAndDeleteDepartment}
                  className="px-3 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover disabled:opacity-50"
                >
                  Перенести и удалить отдел
                </button>
              </div>

              <div className="border border-red-200 rounded p-3">
                <button
                  type="button"
                  onClick={confirmDeleteDepartmentWithProcesses}
                  className="px-3 py-2 border border-red-300 text-red-600 text-sm rounded hover:bg-red-50"
                >
                  Удалить отдел вместе с процессами
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDeleteDepartmentModal(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {showHistory && selectedProcess && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-[80vw] max-w-[1600px] max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-medium text-gray-900">История версий процесса</h3>
              <button
                type="button"
                onClick={() => {
                  setShowHistory(false);
                  setCompareMode(false);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Закрыть
              </button>
            </div>
            <div className="grid grid-cols-12 flex-1 min-h-0">
              <div className="col-span-3 border-r border-gray-200 overflow-auto shrink-0 max-w-[280px]">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => openVersionInHistory(v.id)}
                    className={`w-full text-left px-3 py-2 border-b border-gray-100 ${
                      selectedVersionId === v.id ? 'bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-sm font-medium">Версия #{v.version}</div>
                    <div className="text-xs text-gray-500">{formatDate(v.changedAt)}</div>
                    {v.changedBy && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {v.changedBy.displayName || v.changedBy.login || '—'}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="col-span-9 p-4 overflow-auto min-w-0">
                {!selectedVersion ? (
                  <div className="text-sm text-gray-500">Выберите версию</div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="text-sm text-gray-600">
                        Версия #{selectedVersion.version} от {formatDate(selectedVersion.changedAt)}
                        {selectedVersion.changedBy && (
                          <span className="text-gray-500 ml-1">
                            · {selectedVersion.changedBy.displayName || selectedVersion.changedBy.login || '—'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {previousVersion && (
                          <button
                            type="button"
                            onClick={() => setCompareMode((m) => !m)}
                            className={`px-3 py-2 text-sm rounded border ${
                              compareMode ? 'bg-gray-100 border-gray-400' : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {compareMode ? 'Скрыть сравнение' : 'Сравнить с предыдущей'}
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={applyVersion}
                            className="px-3 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover"
                          >
                            Применить как актуальную
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={deleteVersion}
                            className="px-3 py-2 text-sm rounded border border-red-300 text-red-700 hover:bg-red-50"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedVersion.changeReason ? (
                      <div className="mb-3 border border-gray-200 rounded p-3 bg-gray-50">
                        <p className="text-xs font-medium text-gray-600 mb-1">
                          Комментарий к изменениям
                        </p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">
                          {selectedVersion.changeReason}
                        </p>
                      </div>
                    ) : null}

                    {compareMode && previousVersion ? (
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Было (v.{previousVersion.version})</p>
                          <div className="border border-gray-200 rounded p-2 min-h-[120px]">
                            <ProcessesEditor
                              editable={false}
                              contentDoc={previousVersion.descriptionDoc?.doc ?? null}
                              changes={[]}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Стало (v.{selectedVersion.version})</p>
                          <div className="border border-gray-200 rounded p-2 min-h-[120px]">
                            <ProcessesEditor
                              editable={false}
                              contentDoc={selectedVersion.descriptionDoc?.doc ?? null}
                              changes={selectedVersion.diffData?.changes || []}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {!compareMode && selectedVersion.diffData?.changes && selectedVersion.diffData.changes.length > 0 ? (
                      <div className="mb-3 border border-gray-200 rounded p-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Изменения в этой версии</p>
                        <div className="space-y-2">
                          {selectedVersion.diffData.changes.map((ch, idx) => (
                            <div key={idx} className="text-xs border-l-2 border-gray-300 pl-2">
                              {ch.changeType === 'modified' && ch.oldText && (
                                <div>
                                  <span className="text-red-600 font-medium">Удалено: </span>
                                  <span className="text-gray-600 line-through whitespace-pre-wrap break-words">
                                    {ch.oldText.length > 300 ? ch.oldText.slice(0, 300) + '...' : ch.oldText}
                                  </span>
                                </div>
                              )}
                              {ch.newText && (
                                <div className={ch.oldText ? 'mt-1' : ''}>
                                  <span className="text-green-600 font-medium">Добавлено: </span>
                                  <span className="text-gray-800 whitespace-pre-wrap break-words">
                                    {ch.newText.length > 300 ? ch.newText.slice(0, 300) + '...' : ch.newText}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : !compareMode ? (
                      <p className="text-sm text-gray-500 mb-3">В этой версии изменений нет.</p>
                    ) : null}

                    {compareMode && previousVersion && selectedVersion.diffData?.changes && selectedVersion.diffData.changes.length > 0 ? (
                      <div className="mt-2 mb-3 border border-gray-200 rounded p-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Изменения в этой версии</p>
                        <div className="space-y-2">
                          {selectedVersion.diffData.changes.map((ch, idx) => (
                            <div key={idx} className="text-xs border-l-2 border-gray-300 pl-2">
                              {ch.changeType === 'modified' && ch.oldText && (
                                <div>
                                  <span className="text-red-600 font-medium">Удалено: </span>
                                  <span className="text-gray-600 line-through whitespace-pre-wrap break-words">
                                    {ch.oldText.length > 300 ? ch.oldText.slice(0, 300) + '...' : ch.oldText}
                                  </span>
                                </div>
                              )}
                              {ch.newText && (
                                <div className={ch.oldText ? 'mt-1' : ''}>
                                  <span className="text-green-600 font-medium">Добавлено: </span>
                                  <span className="text-gray-800 whitespace-pre-wrap break-words">
                                    {ch.newText.length > 300 ? ch.newText.slice(0, 300) + '...' : ch.newText}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedVersion.checklist ? (
                      (() => {
                        const cl = selectedVersion.checklist;
                        if (cl.checklistsByRole && cl.checklistsByRole.length > 0) {
                          return (
                            <div className="mb-3">
                              <ChecklistByRoleAccordion
                                checklistsByRole={cl.checklistsByRole}
                                className="border border-gray-200 rounded p-3"
                                title="Чек-лист"
                              />
                            </div>
                          );
                        }
                        if (cl.items?.length) {
                          return (
                            <div className="mb-3 border border-gray-200 rounded p-3">
                              <p className="text-sm font-medium text-gray-700 mb-2">Чек-лист</p>
                              <ul className="space-y-1">
                                {cl.items.map((it, idx) => (
                                  <li key={idx} className="text-sm flex items-center gap-2">
                                    {it.completed === true ? (
                                      <span className="text-emerald-600" title="Выполнено">✓</span>
                                    ) : (
                                      <span className="text-gray-400">○</span>
                                    )}{' '}
                                    {it.title}
                                    {it.assignee && <span className="text-gray-500">— {it.assignee}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        }
                        return null;
                      })()
                    ) : null}

                    {!compareMode && (
                      <ProcessesEditor
                        editable={false}
                        contentDoc={selectedVersion.descriptionDoc?.doc ?? null}
                        changes={selectedVersion.diffData?.changes || []}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showActivityHistory && selectedProcess && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-[900px] max-h-[85vh] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Общая история действий</h3>
              <button
                type="button"
                onClick={() => setShowActivityHistory(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Закрыть
              </button>
            </div>
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Поиск по пользователю, действию или версии"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <button
                type="button"
                onClick={openActivityHistory}
                className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                title="Обновить список"
              >
                Обновить
              </button>
              <button
                type="button"
                onClick={resetActivitySearch}
                className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Сбросить
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto">
              {activityLoading ? (
                <div className="text-sm text-gray-500">Загрузка истории...</div>
              ) : !activityItems.length ? (
                <div className="text-sm text-gray-500">Событий пока нет</div>
              ) : (
                <div className="space-y-2">
                  {activityItems.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded p-3">
                      <div className="text-sm text-gray-900">
                        {item.user.displayName || item.user.login}
                      </div>
                      <div className="text-xs text-gray-700 mt-1">{getActivityActionText(item)}</div>
                      {typeof item.meta?.changeReason === 'string' &&
                      item.meta.changeReason.trim() ? (
                        <div className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
                          Причина: {item.meta.changeReason}
                        </div>
                      ) : null}
                      <div className="text-xs text-gray-500 mt-1">{formatDate(item.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
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
  onEdit,
  onDelete,
}: {
  nodes: ProcessDepartmentNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canEdit: boolean;
  onEdit: (id: string) => void;
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
              <span className="inline-flex items-center gap-2">
                <span>{node.name}</span>
                {node.hasUnread && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                    новая
                  </span>
                )}
              </span>
            </button>
            {canEdit && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(node.id)}
                  className="text-xs text-gray-600 hover:underline"
                >
                  Ред.
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(node.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Удалить
                </button>
              </div>
            )}
          </div>
          {!!node.children?.length && (
            <div className="ml-3 border-l border-gray-200 pl-2 mt-1">
              <DepartmentTree
                nodes={node.children}
                selectedId={selectedId}
                onSelect={onSelect}
                canEdit={canEdit}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
