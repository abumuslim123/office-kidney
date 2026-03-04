import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ResumeCandidate } from '../lib/resume-types';
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_COLORS,
  QUALIFICATION_CATEGORIES,
  CATEGORY_COLORS,
  PREDEFINED_TAGS,
  BRANCH_COLORS,
  DOCTOR_TYPE_LABELS,
  formatDateTime,
  formatPhoneForWhatsApp,
  getDaysUntil,
} from '../lib/resume-constants';
import ResumeFiltersBar, { emptyFilters, type ResumeFilters } from '../components/resume/ResumeFiltersBar';
import ResumeBranchesCell from '../components/resume/ResumeBranchesCell';
import ResumeDoctorTypesCell from '../components/resume/ResumeDoctorTypesCell';

const PAGE_SIZES = [10, 25, 50, 100];

type ViewMode = 'table' | 'cards' | 'split';
type GroupBy = 'none' | 'specialization' | 'branch' | 'status' | 'doctorType';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'Нет' },
  { value: 'specialization', label: 'По специализации' },
  { value: 'branch', label: 'По филиалу' },
  { value: 'status', label: 'По этапу' },
  { value: 'doctorType', label: 'По направлению' },
];

function getStoredViewMode(): ViewMode {
  const stored = localStorage.getItem('resumeViewMode');
  if (stored === 'table' || stored === 'cards' || stored === 'split') return stored;
  return 'table';
}

interface CandidateGroup {
  key: string;
  label: string;
  items: ResumeCandidate[];
}

function groupCandidates(candidates: ResumeCandidate[], groupBy: GroupBy): CandidateGroup[] {
  if (groupBy === 'none') return [{ key: '', label: '', items: candidates }];

  const groups = new Map<string, ResumeCandidate[]>();
  for (const c of candidates) {
    let keys: string[];
    switch (groupBy) {
      case 'specialization':
        keys = [c.specialization || 'Без специализации'];
        break;
      case 'branch':
        keys = c.branches.length > 0 ? c.branches : ['Без филиала'];
        break;
      case 'status':
        keys = [CANDIDATE_STATUSES[c.status] || c.status];
        break;
      case 'doctorType':
        keys = c.doctorTypes.length > 0
          ? c.doctorTypes.map(t => DOCTOR_TYPE_LABELS[t] || t)
          : ['Без направления'];
        break;
      default:
        keys = [''];
    }
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
    .map(([key, items]) => ({ key, label: key, items }));
}

function sortWithinGroups(
  groups: CandidateGroup[],
  sortBy: string,
  sortOrder: 'ASC' | 'DESC',
): CandidateGroup[] {
  return groups.map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortBy] ?? '';
      const bVal = (b as unknown as Record<string, unknown>)[sortBy] ?? '';
      const cmp =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal), 'ru');
      return sortOrder === 'ASC' ? cmp : -cmp;
    }),
  }));
}

// ─── Qualification Cell (shared across views) ────────────────────────────────

function QualificationInfo({ c }: { c: ResumeCandidate }) {
  const accDays = getDaysUntil(c.accreditationExpiryDate);
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[c.qualificationCategory] || ''}`}
        >
          {QUALIFICATION_CATEGORIES[c.qualificationCategory] || '—'}
        </span>
        {c.totalExperienceYears != null && (
          <span className="text-xs text-gray-500">{c.totalExperienceYears} л.</span>
        )}
      </div>
      {c.accreditationStatus ? (
        <div
          className={`text-xs mt-0.5 ${
            accDays !== null && accDays < 0
              ? 'text-red-600'
              : accDays !== null && accDays < 90
                ? 'text-amber-600'
                : 'text-green-600'
          }`}
        >
          {c.accreditationExpiryDate
            ? `Аккр. до ${new Date(c.accreditationExpiryDate).toLocaleDateString('ru-RU')}`
            : 'Аккр. есть'}
          {accDays !== null && accDays < 0 && ' (истекла)'}
        </div>
      ) : (
        <div className="text-xs text-gray-400 mt-0.5">Нет аккр.</div>
      )}
    </>
  );
}

// ─── Contact Popup ───────────────────────────────────────────────────────────

function ContactPopup({
  c,
  isOpen,
  onToggle,
  popupRef,
}: {
  c: ResumeCandidate;
  isOpen: boolean;
  onToggle: () => void;
  popupRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (!c.phone) return null;
  return (
    <div className="relative inline-flex" ref={isOpen ? popupRef as React.RefObject<HTMLDivElement> : undefined}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-accent hover:bg-gray-100 transition-colors"
        title="Контакты"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-30 right-0 mt-1 top-full bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[220px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-900">{c.phone}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(c.phone!)}
              className="text-gray-400 hover:text-accent"
              title="Скопировать"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={`tel:${c.phone}`}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
            >
              Позвонить
            </a>
            <a
              href={`https://wa.me/${formatPhoneForWhatsApp(c.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
            >
              Написать в WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tags Cell ───────────────────────────────────────────────────────────────

function TagsCell({
  c,
  tagDropdownId,
  setTagDropdownId,
  tagDropdownRef,
  onAddTag,
  onRemoveTag,
  onRetry,
}: {
  c: ResumeCandidate;
  tagDropdownId: string | null;
  setTagDropdownId: (id: string | null) => void;
  tagDropdownRef: React.RefObject<HTMLDivElement | null>;
  onAddTag: (candidateId: string, label: string, color: string) => void;
  onRemoveTag: (tagId: string) => void;
  onRetry: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {['PENDING', 'EXTRACTING', 'PARSING'].includes(c.processingStatus) && (
        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 animate-pulse leading-tight">
          AI Обработка
        </span>
      )}
      {c.processingStatus === 'FAILED' && (
        <button
          type="button"
          onClick={() => onRetry(c.id)}
          className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer leading-tight"
        >
          Ошибка ↻
        </button>
      )}
      {(c.tags || []).map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white leading-tight"
          style={{ backgroundColor: tag.color || '#6b7280' }}
        >
          {tag.label}
          <button
            type="button"
            onClick={() => onRemoveTag(tag.id)}
            className="ml-0.5 hover:text-white/70 leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <div className="relative" ref={tagDropdownId === c.id ? tagDropdownRef as React.RefObject<HTMLDivElement> : undefined}>
        <button
          type="button"
          onClick={() => setTagDropdownId(tagDropdownId === c.id ? null : c.id)}
          className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-accent hover:bg-gray-100 transition-colors"
          title="Добавить тег"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        {tagDropdownId === c.id && (
          <div className="absolute z-30 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 min-w-[150px]">
            {PREDEFINED_TAGS.filter((p) => !(c.tags || []).some((t) => t.label === p.label)).map(
              (p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onAddTag(c.id, p.label, p.color)}
                  className="block w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-50 transition-colors"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.label}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status Select ───────────────────────────────────────────────────────────

function StatusSelect({
  candidate,
  onUpdate,
}: {
  candidate: ResumeCandidate;
  onUpdate: (id: string, field: string, value: string) => void;
}) {
  return (
    <select
      value={candidate.status}
      onChange={(e) => onUpdate(candidate.id, 'status', e.target.value)}
      className={`text-xs font-medium rounded-full px-2 py-0.5 border-0 cursor-pointer ${CANDIDATE_STATUS_COLORS[candidate.status] || ''}`}
    >
      {Object.entries(CANDIDATE_STATUSES).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

// ─── Actions Menu (archive, delete) ──────────────────────────────────────────

function ActionsMenu({
  candidateId,
  onArchive,
  onDelete,
}: {
  candidateId: string;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
          <button
            type="button"
            onClick={() => {
              onArchive(candidateId);
              setOpen(false);
            }}
            className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            В архив
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete(candidateId);
              setOpen(false);
            }}
            className="block w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}

// ─── View Mode Toggle ────────────────────────────────────────────────────────

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const modes: { mode: ViewMode; title: string; icon: React.ReactNode }[] = [
    {
      mode: 'table',
      title: 'Таблица',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
    {
      mode: 'cards',
      title: 'Карточки',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      ),
    },
    {
      mode: 'split',
      title: 'Таблица + Панель',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4m0-16h10a1 1 0 011 1v14a1 1 0 01-1 1H9m0-16v16" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
      {modes.map((m) => (
        <button
          key={m.mode}
          type="button"
          onClick={() => onChange(m.mode)}
          className={`p-1.5 transition-colors ${
            viewMode === m.mode
              ? 'bg-accent text-white'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
          title={m.title}
        >
          {m.icon}
        </button>
      ))}
    </div>
  );
}

// ─── Side Panel ──────────────────────────────────────────────────────────────

function SidePanel({
  candidate,
  onClose,
  onUpdateField,
  onArchive,
  onDelete,
  tagDropdownId,
  setTagDropdownId,
  tagDropdownRef,
  onAddTag,
  onRemoveTag,
  onRetry,
  silentReload,
}: {
  candidate: ResumeCandidate;
  onClose: () => void;
  onUpdateField: (id: string, field: string, value: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  tagDropdownId: string | null;
  setTagDropdownId: (id: string | null) => void;
  tagDropdownRef: React.RefObject<HTMLDivElement | null>;
  onAddTag: (candidateId: string, label: string, color: string) => void;
  onRemoveTag: (tagId: string) => void;
  onRetry: (id: string) => void;
  silentReload: () => void;
}) {
  const c = candidate;

  return (
    <aside className="flex-1 min-w-[300px] max-w-[400px] bg-white overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link
              to={`/hr/resume/candidates/${c.id}`}
              className="text-base font-semibold text-accent hover:underline"
            >
              {c.fullName || '—'}
            </Link>
            <div className="text-sm text-gray-500 mt-0.5">{c.specialization || '—'}</div>
            <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(c.createdAt)}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contacts */}
        {c.phone && (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-900">{c.phone}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(c.phone!)}
                className="text-gray-400 hover:text-accent"
                title="Скопировать"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
            <div className="flex gap-2">
              <a
                href={`tel:${c.phone}`}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
              >
                Позвонить
              </a>
              <a
                href={`https://wa.me/${formatPhoneForWhatsApp(c.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
              >
                WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* Stage */}
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs text-gray-500 mb-1">Этап</div>
          <StatusSelect candidate={c} onUpdate={onUpdateField} />
        </div>

        {/* Branch */}
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs text-gray-500 mb-1">Филиал</div>
          <ResumeBranchesCell candidateId={c.id} branches={c.branches} onUpdated={silentReload} />
        </div>

        {/* Qualification */}
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs text-gray-500 mb-1">Квалификация</div>
          <QualificationInfo c={c} />
        </div>

        {/* Tags */}
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs text-gray-500 mb-1">Теги</div>
          <TagsCell
            c={c}
            tagDropdownId={tagDropdownId}
            setTagDropdownId={setTagDropdownId}
            tagDropdownRef={tagDropdownRef}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onRetry={onRetry}
          />
        </div>

        {/* Actions */}
        <div className="border-t border-gray-100 pt-3 flex gap-2">
          <Link
            to={`/hr/resume/candidates/${c.id}`}
            className="flex-1 text-center px-3 py-2 text-xs font-medium text-accent border border-accent rounded-lg hover:bg-accent/5 transition-colors"
          >
            Открыть карточку
          </Link>
          <button
            type="button"
            onClick={() => onArchive(c.id)}
            className="px-3 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            В архив
          </button>
          <button
            type="button"
            onClick={() => onDelete(c.id)}
            className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Удалить
          </button>
        </div>
      </div>
    </aside>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ResumeCandidatesPage() {
  const [candidates, setCandidates] = useState<ResumeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [filters, setFilters] = useState<ResumeFilters>(emptyFilters);
  const [exporting, setExporting] = useState(false);
  const [deduplicating, setDeduplicating] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [tagDropdownId, setTagDropdownId] = useState<string | null>(null);
  const [contactPopupId, setContactPopupId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const contactPopupRef = useRef<HTMLDivElement>(null);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('resumeViewMode', mode);
    if (mode === 'split') {
      // Автоматически выбрать первого кандидата
      if (!selectedId && candidates.length > 0) setSelectedId(candidates[0].id);
    } else {
      setSelectedId(null);
    }
  };

  const buildParams = useCallback(() => {
    const params: Record<string, string | number> = { page, limit, sort: sortBy, order: sortOrder };
    if (filters.search) params.search = filters.search;
    if (filters.specialization) params.specialization = filters.specialization;
    if (filters.branch) params.branch = filters.branch;
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.doctorType) params.doctorType = filters.doctorType;
    if (filters.category) params.qualificationCategory = filters.category;
    if (filters.city) params.city = filters.city;
    if (filters.workCity) params.workCity = filters.workCity;
    if (filters.educationCity) params.educationCity = filters.educationCity;
    if (filters.experience) {
      const [min, max] = filters.experience.split('-');
      if (min) params.experienceMin = Number(min);
      if (max) params.experienceMax = Number(max);
    }
    if (filters.accreditation) params.accreditation = filters.accreditation;
    return params;
  }, [page, limit, sortBy, sortOrder, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ResumeCandidate[]; total: number }>('/resume/candidates', {
        params: buildParams(),
      });
      setCandidates(res.data.data);
      setTotal(res.data.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const silentReload = useCallback(async () => {
    try {
      const res = await api.get<{ data: ResumeCandidate[]; total: number }>('/resume/candidates', {
        params: buildParams(),
      });
      setCandidates(res.data.data);
      setTotal(res.data.total);
    } catch {
      /* ignore */
    }
  }, [buildParams]);

  useEffect(() => {
    load();
  }, [load]);

  // Автовыбор первого кандидата в split-режиме
  useEffect(() => {
    if (viewMode === 'split' && !selectedId && candidates.length > 0) {
      setSelectedId(candidates[0].id);
    }
  }, [viewMode, candidates, selectedId]);

  // Close tag dropdown on outside click
  useEffect(() => {
    if (!tagDropdownId) return;
    const handler = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tagDropdownId]);

  // Close contact popup on outside click
  useEffect(() => {
    if (!contactPopupId) return;
    const handler = (e: MouseEvent) => {
      if (contactPopupRef.current && !contactPopupRef.current.contains(e.target as Node)) {
        setContactPopupId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contactPopupId]);

  const handleFiltersChange = (f: ResumeFilters) => {
    setPage(1);
    setFilters(f);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/resume/candidates/export', { params: buildParams(), responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `candidates-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    } finally {
      setExporting(false);
    }
  };

  const handleDeduplicate = async () => {
    if (!confirm('Запустить массовую проверку дубликатов? Это может занять некоторое время.')) return;
    setDeduplicating(true);
    try {
      const res = await api.post<{ deleted: number; tagged: number }>('/resume/deduplicate');
      alert(`Удалено дубликатов: ${res.data.deleted}, помечено похожих: ${res.data.tagged}`);
      load();
    } catch {
      /* ignore */
    } finally {
      setDeduplicating(false);
    }
  };

  const updateField = async (id: string, field: string, value: string) => {
    try {
      await api.patch(`/resume/candidates/${id}`, { [field]: value });
      silentReload();
    } catch {
      /* ignore */
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await api.post(`/resume/candidates/${id}/reprocess`);
      load();
    } catch {
      /* ignore */
    }
  };

  const handleAddTag = async (candidateId: string, label: string, color: string) => {
    try {
      await api.post(`/resume/candidates/${candidateId}/tags`, { label, color });
      setTagDropdownId(null);
      silentReload();
    } catch {
      /* ignore */
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await api.delete(`/resume/tags/${tagId}`);
      silentReload();
    } catch {
      /* ignore */
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await api.patch(`/resume/candidates/${id}`, { priority: 'ARCHIVE' });
      if (selectedId === id) setSelectedId(null);
      silentReload();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить кандидата?')) return;
    try {
      await api.patch(`/resume/candidates/${id}`, { priority: 'DELETED' });
      if (selectedId === id) setSelectedId(null);
      silentReload();
    } catch {
      /* ignore */
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  // Grouping
  const groups = useMemo(() => {
    const grouped = groupCandidates(candidates, groupBy);
    if (groupBy !== 'none') {
      return sortWithinGroups(grouped, sortBy, sortOrder);
    }
    return grouped;
  }, [candidates, groupBy, sortBy, sortOrder]);

  // Selected candidate for split view
  const selectedCandidate = useMemo(
    () => (selectedId ? candidates.find((c) => c.id === selectedId) || null : null),
    [selectedId, candidates],
  );

  const SortHeader = ({
    column,
    label,
    className,
  }: {
    column: string;
    label: string;
    className?: string;
  }) => (
    <th
      className={`text-left px-3 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 group whitespace-nowrap ${className || ''}`}
      onClick={() => handleSort(column)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortBy === column ? (
          sortOrder === 'ASC' ? (
            <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )
        ) : (
          <svg
            className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        )}
      </span>
    </th>
  );

  // ─── Pagination ──────────────────────────────────────────────────────────

  const Pagination = () => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} из {total}
      </span>
      <div className="flex items-center gap-3">
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} на стр.
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Назад
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Далее
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Table Row (full) ────────────────────────────────────────────────────

  const renderTableRow = (c: ResumeCandidate) => (
    <tr key={c.id} className="hover:bg-gray-50/50">
      {/* ФИО + контакты */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="min-w-0">
            <Link to={`/hr/resume/candidates/${c.id}`} className="text-accent hover:underline font-medium">
              {c.fullName || '—'}
            </Link>
            <div className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</div>
          </div>
          <ContactPopup
            c={c}
            isOpen={contactPopupId === c.id}
            onToggle={() => setContactPopupId(contactPopupId === c.id ? null : c.id)}
            popupRef={contactPopupRef}
          />
        </div>
      </td>
      <td className="px-3 py-2 text-gray-600">{c.specialization || '—'}</td>
      <td className="px-3 py-2">
        <ResumeDoctorTypesCell candidateId={c.id} doctorTypes={c.doctorTypes || []} onUpdated={silentReload} />
      </td>
      <td className="px-3 py-2">
        <ResumeBranchesCell candidateId={c.id} branches={c.branches} onUpdated={silentReload} />
      </td>
      <td className="px-3 py-2">
        <QualificationInfo c={c} />
      </td>
      <td className="px-3 py-2">
        <StatusSelect candidate={c} onUpdate={updateField} />
      </td>
      <td className="px-3 py-2">
        <TagsCell
          c={c}
          tagDropdownId={tagDropdownId}
          setTagDropdownId={setTagDropdownId}
          tagDropdownRef={tagDropdownRef}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onRetry={handleRetry}
        />
      </td>
      <td className="px-3 py-2">
        <ActionsMenu candidateId={c.id} onArchive={handleArchive} onDelete={handleDelete} />
      </td>
    </tr>
  );

  // ─── Split Row (compact: ФИО+спец, этап, бейдж квалификации) ────────────

  const renderSplitRow = (c: ResumeCandidate) => (
    <tr
      key={c.id}
      className={`cursor-pointer transition-colors ${selectedId === c.id ? 'bg-accent/5 border-l-2 border-l-accent' : 'hover:bg-gray-50/50 border-l-2 border-l-transparent'}`}
      onClick={() => setSelectedId(c.id)}
    >
      {/* ФИО + специализация */}
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900 text-sm leading-tight">{c.fullName || '—'}</div>
        <div className="text-xs text-gray-500">{c.specialization || '—'}</div>
      </td>
      {/* Этап (цветной бейдж) */}
      <td className="px-3 py-1.5">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${CANDIDATE_STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-800'}`}>
          {CANDIDATE_STATUSES[c.status] || c.status}
        </span>
      </td>
      {/* Квалификация (компактно) */}
      <td className="px-3 py-1.5 text-xs text-gray-500">
        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[c.qualificationCategory] || ''}`}>
          {QUALIFICATION_CATEGORIES[c.qualificationCategory] || '—'}
        </span>
        {c.totalExperienceYears != null && (
          <span className="ml-1">{c.totalExperienceYears} л.</span>
        )}
      </td>
    </tr>
  );

  // ─── Card ────────────────────────────────────────────────────────────────

  const renderCard = (c: ResumeCandidate) => {
    const statusColor: Record<string, string> = {
      NEW: 'border-l-gray-400',
      REVIEWING: 'border-l-blue-500',
      INVITED: 'border-l-purple-500',
      HIRED: 'border-l-emerald-500',
      RESERVE: 'border-l-yellow-500',
      REJECTED: 'border-l-red-500',
    };

    return (
      <div
        key={c.id}
        className={`bg-white border border-gray-200 rounded-xl p-3 border-l-4 ${statusColor[c.status] || 'border-l-gray-300'} hover:shadow-md transition-shadow`}
      >
        {/* Row 1: Name + contacts */}
        <div className="flex items-start justify-between mb-1.5">
          <Link
            to={`/hr/resume/candidates/${c.id}`}
            className="text-sm font-medium text-accent hover:underline leading-tight"
          >
            {c.fullName || '—'}
          </Link>
          <div className="flex items-center gap-1">
            <ContactPopup
              c={c}
              isOpen={contactPopupId === c.id}
              onToggle={() => setContactPopupId(contactPopupId === c.id ? null : c.id)}
              popupRef={contactPopupRef}
            />
            <ActionsMenu candidateId={c.id} onArchive={handleArchive} onDelete={handleDelete} />
          </div>
        </div>

        {/* Row 2: Specialization + Branch */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="text-xs text-gray-600">{c.specialization || '—'}</span>
          {c.branches.map((b) => (
            <span
              key={b}
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${BRANCH_COLORS[b] || 'bg-gray-100 text-gray-800'}`}
            >
              {b}
            </span>
          ))}
        </div>

        {/* Row 3: Qualification */}
        <div className="mb-2">
          <QualificationInfo c={c} />
        </div>

        {/* Row 4: Status select */}
        <div className="mb-2">
          <StatusSelect candidate={c} onUpdate={updateField} />
        </div>

        {/* Row 5: Tags */}
        <TagsCell
          c={c}
          tagDropdownId={tagDropdownId}
          setTagDropdownId={setTagDropdownId}
          tagDropdownRef={tagDropdownRef}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onRetry={handleRetry}
        />
      </div>
    );
  };

  // ─── Group Header ────────────────────────────────────────────────────────

  const renderGroupHeader = (group: CandidateGroup) => {
    if (!group.key) return null;
    return (
      <div className="flex items-center gap-2 py-2 mt-4 first:mt-0">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
          {group.label} ({group.items.length})
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
    );
  };

  // ─── Table Group Header (as <tr>) ────────────────────────────────────────

  const renderTableGroupHeader = (group: CandidateGroup, colSpan: number) => {
    if (!group.key) return null;
    return (
      <tr key={`group-${group.key}`}>
        <td colSpan={colSpan} className="px-3 pt-4 pb-1">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
              {group.label} ({group.items.length})
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
        </td>
      </tr>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900">
          Кандидаты <span className="text-sm font-normal text-gray-400">({total})</span>
        </h2>
        <div className="flex items-center gap-2">
          {/* Grouping dropdown */}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
          >
            {GROUP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === 'none' ? 'Группировка' : o.label}
              </option>
            ))}
          </select>
          {/* View mode */}
          <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
        </div>
      </div>

      {/* Filters */}
      <ResumeFiltersBar
        filters={filters}
        onChange={handleFiltersChange}
        onExport={handleExport}
        onDeduplicate={handleDeduplicate}
        exporting={exporting}
        deduplicating={deduplicating}
      />

      {/* Content */}
      {loading ? (
        <p className="text-sm text-gray-400">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-gray-400">Кандидаты не найдены</p>
      ) : (
        <>
          {/* ─── TABLE VIEW ──────────────────────────────────────────────── */}
          {viewMode === 'table' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <SortHeader column="fullName" label="ФИО" />
                    <SortHeader column="specialization" label="Специализация" />
                    <SortHeader column="doctorType" label="Направление" />
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Филиал</th>
                    <SortHeader column="qualificationCategory" label="Квалификация" />
                    <SortHeader column="status" label="Этап" />
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Теги</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groups.map((group) => (
                    <>{renderTableGroupHeader(group, 8)}{group.items.map((c) => renderTableRow(c))}</>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── CARDS VIEW ──────────────────────────────────────────────── */}
          {viewMode === 'cards' && (
            <div>
              {groups.map((group) => (
                <div key={group.key || '_all'}>
                  {renderGroupHeader(group)}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {group.items.map(renderCard)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── SPLIT VIEW ──────────────────────────────────────────────── */}
          {viewMode === 'split' && (
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ minHeight: 400 }}>
              {/* Компактный список слева */}
              <div className={`${selectedCandidate ? 'w-[45%] flex-shrink-0' : 'w-full'} overflow-y-auto border-r border-gray-200`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200">
                      <SortHeader column="fullName" label="ФИО" />
                      <SortHeader column="status" label="Этап" />
                      <SortHeader column="qualificationCategory" label="Квалификация" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groups.map((group) => (
                      <>{renderTableGroupHeader(group, 3)}{group.items.map((c) => renderSplitRow(c))}</>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Панель справа */}
              {selectedCandidate && (
                <SidePanel
                  candidate={selectedCandidate}
                  onClose={() => setSelectedId(null)}
                  onUpdateField={updateField}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  tagDropdownId={tagDropdownId}
                  setTagDropdownId={setTagDropdownId}
                  tagDropdownRef={tagDropdownRef}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                  onRetry={handleRetry}
                  silentReload={silentReload}
                />
              )}
            </div>
          )}

          <Pagination />
        </>
      )}
    </div>
  );
}
