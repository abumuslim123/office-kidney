import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { ResumeLead } from '../lib/resume-types';
import { ResumeLeadStatus } from '../lib/resume-types';
import {
  LEAD_STATUSES,
  LEAD_STATUS_COLORS,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE,
  formatPhoneForWhatsApp,
  DOCTOR_TYPE_LABELS,
  BRANCHES,
  PREDEFINED_TAGS,
} from '../lib/resume-constants';

const PAGE_SIZES = [10, 25, 50, 100];

interface LeadStats {
  byStatus: Record<string, number>;
  total: number;
}

// ─── Source Combobox ─────────────────────────────────────────────────

function SourceCombobox({
  value,
  onChange,
  sources,
}: {
  value: string;
  onChange: (v: string) => void;
  sources: string[];
}) {
  const [inputValue, setInputValue] = useState(value);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Синхронизация при изменении value извне
  useEffect(() => { setInputValue(value); }, [value]);

  useEffect(() => {
    if (!focused) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [focused]);

  const query = inputValue.toLowerCase().trim();
  const filtered = query
    ? sources.filter((s) => s.toLowerCase().includes(query))
    : sources;
  const exactMatch = sources.some((s) => s.toLowerCase() === query);
  const showAddNew = query.length > 0 && !exactMatch;

  const selectSource = (s: string) => {
    setInputValue(s);
    onChange(s);
    setFocused(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setFocused(true);
  };

  const handleBlur = () => {
    // Даём время на клик по опции
    setTimeout(() => {
      onChange(inputValue.trim());
    }, 150);
  };

  const handleAddNew = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setFocused(false);
  };

  const showDropdown = focused && (filtered.length > 0 || showAddNew);

  return (
    <div className="relative" ref={ref}>
      <div className="flex gap-1">
        <input
          ref={inputRef}
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          placeholder="Введите или выберите источник..."
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
        />
        {inputValue && (
          <button
            type="button"
            className="px-2 text-gray-400 hover:text-gray-600"
            onClick={() => { setInputValue(''); onChange(''); inputRef.current?.focus(); }}
            title="Очистить"
          >
            &times;
          </button>
        )}
      </div>
      {showDropdown && (
        <div className="absolute z-40 top-full mt-1 left-0 w-full bg-white border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s}
              className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${value === s ? 'font-medium text-indigo-600' : ''}`}
              onMouseDown={() => selectSource(s)}
            >
              {s}
            </button>
          ))}
          {showAddNew && (
            <>
              {filtered.length > 0 && <div className="border-t my-1" />}
              <button
                className="block w-full text-left px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
                onMouseDown={handleAddNew}
              >
                + Добавить «{inputValue.trim()}»
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Source Filter ───────────────────────────────────────────────────

function SourceFilter({
  value,
  onChange,
  sources,
}: {
  value: string;
  onChange: (v: string) => void;
  sources: string[];
}) {
  return (
    <select
      className="border rounded-lg px-3 py-1.5 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Все источники</option>
      {sources.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

// ─── Lead Form Modal ────────────────────────────────────────────────

function LeadFormModal({
  lead,
  onClose,
  onSaved,
  sources,
}: {
  lead: ResumeLead | null;
  onClose: () => void;
  onSaved: () => void;
  sources: string[];
}) {
  const [name, setName] = useState(lead?.name || '');
  const [phone, setPhone] = useState(lead?.phone || '');
  const [email, setEmail] = useState(lead?.email || '');
  const [city, setCity] = useState(lead?.city || '');
  const [specialization, setSpecialization] = useState(lead?.specialization || '');
  const [source, setSource] = useState(lead?.source || '');
  const [notes, setNotes] = useState(lead?.notes || '');
  const [status, setStatus] = useState<string>(lead?.status || ResumeLeadStatus.NEW);
  const [doctorTypes, setDoctorTypes] = useState<string[]>(lead?.doctorTypes || []);
  const [branches, setBranches] = useState<string[]>(lead?.branches || []);
  const [desiredSalary, setDesiredSalary] = useState(lead?.desiredSalary?.toString() || '');
  const [desiredSalaryType, setDesiredSalaryType] = useState(lead?.desiredSalaryType || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        name: name || undefined,
        phone: phone || undefined,
        email: email || undefined,
        city: city || undefined,
        specialization: specialization || undefined,
        source: source || undefined,
        notes: notes || undefined,
        doctorTypes: doctorTypes.length > 0 ? doctorTypes : undefined,
        branches: branches.length > 0 ? branches : undefined,
        desiredSalary: desiredSalary ? parseInt(desiredSalary, 10) : undefined,
        desiredSalaryType: desiredSalaryType || undefined,
      };
      if (lead) {
        payload.status = status;
        await api.patch(`/resume/leads/${lead.id}`, payload);
      } else {
        await api.post('/resume/leads', payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Ошибка сохранения';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">
          {lead ? 'Редактировать заявку' : 'Новая заявка'}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Имя</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="ФИО контакта" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Телефон</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7..." />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Город</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Специализация</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Направление</label>
            <div className="flex flex-wrap gap-3">
              {Object.entries(DOCTOR_TYPE_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={doctorTypes.includes(key)}
                    onChange={(e) => {
                      if (e.target.checked) setDoctorTypes([...doctorTypes, key]);
                      else setDoctorTypes(doctorTypes.filter((t) => t !== key));
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Филиал</label>
            <div className="flex flex-wrap gap-3">
              {BRANCHES.map((b) => (
                <label key={b} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={branches.includes(b)}
                    onChange={(e) => {
                      if (e.target.checked) setBranches([...branches, b]);
                      else setBranches(branches.filter((br) => br !== b));
                    }}
                  />
                  {b}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Желаемая зарплата</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={desiredSalary}
                onChange={(e) => setDesiredSalary(e.target.value)}
                placeholder="Сумма"
              />
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={desiredSalaryType}
                onChange={(e) => setDesiredSalaryType(e.target.value)}
              >
                <option value="">Тип не указан</option>
                <option value="FIXED_RUB">Фиксированная</option>
                <option value="PERCENT_OF_VISIT">% от приёма</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Источник</label>
            <SourceCombobox value={source} onChange={setSource} sources={sources} />
          </div>
          {lead && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Статус</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(LEAD_STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Заметка</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Комментарий, план действий..." />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50" onClick={onClose}>Отмена</button>
          <button className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50" disabled={saving} onClick={handleSave}>
            {saving ? 'Сохранение...' : lead ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Convert Modal ──────────────────────────────────────────────────

function ConvertModal({
  lead,
  onClose,
  onConverted,
}: {
  lead: ResumeLead;
  onClose: () => void;
  onConverted: (candidateId: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canConvert = mode === 'file' ? !!file : rawText.trim().length > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setError('Файл слишком большой (макс. 10 МБ)');
      return;
    }
    setError('');
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setError('Файл слишком большой (макс. 10 МБ)');
      return;
    }
    setError('');
    setFile(f);
  };

  const handleConvert = async () => {
    setConverting(true);
    setError('');
    try {
      const formData = new FormData();
      if (mode === 'file' && file) {
        formData.append('file', file);
      } else if (mode === 'text') {
        formData.append('rawText', rawText);
      }

      const res = await api.post<{ id: string }>(`/resume/leads/${lead.id}/convert`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onConverted(res.data.id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Ошибка конвертации';
      setError(msg);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-1">Конвертировать в кандидата</h2>
        <p className="text-sm text-gray-500 mb-4">
          {lead.name && <span className="font-medium text-gray-700">{lead.name}</span>}
          {lead.phone && <span className="ml-2">{lead.phone}</span>}
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 mb-4">
          Заметки и теги будут перенесены в карточку кандидата. После конвертации запустится AI-обработка резюме.
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            className={`px-3 py-1.5 text-sm rounded-lg border ${mode === 'file' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'hover:bg-gray-50'}`}
            onClick={() => setMode('file')}
          >
            Загрузить файл
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-lg border ${mode === 'text' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'hover:bg-gray-50'}`}
            onClick={() => setMode('text')}
          >
            Вставить текст
          </button>
        </div>

        {mode === 'file' ? (
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-indigo-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={Object.entries(ACCEPTED_FILE_TYPES).flatMap(([, exts]) => exts).join(',')}
              onChange={handleFileChange}
            />
            {file ? (
              <div className="text-sm">
                <span className="font-medium text-indigo-600">{file.name}</span>
                <span className="text-gray-400 ml-2">({(file.size / 1024).toFixed(0)} КБ)</span>
              </div>
            ) : (
              <div className="text-sm text-gray-400">
                Перетащите файл сюда или нажмите для выбора
                <br />
                <span className="text-xs">PDF, DOCX, TXT, JPG, PNG (до 10 МБ)</span>
              </div>
            )}
          </div>
        ) : (
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm h-40 resize-none"
            placeholder="Вставьте текст резюме..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
        )}

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50" onClick={onClose}>Отмена</button>
          <button
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={!canConvert || converting}
            onClick={handleConvert}
          >
            {converting ? 'Конвертация...' : 'Конвертировать'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tags Cell (compact inline) ─────────────────────────────────────

function LeadTagsCell({
  lead,
  tagDropdownId,
  setTagDropdownId,
  tagDropdownRef,
  onAddTag,
  onRemoveTag,
  allTags,
}: {
  lead: ResumeLead;
  tagDropdownId: string | null;
  setTagDropdownId: (id: string | null) => void;
  tagDropdownRef: React.RefObject<HTMLDivElement | null>;
  onAddTag: (leadId: string, label: string, color: string) => void;
  onRemoveTag: (tagId: string) => void;
  allTags: { label: string; color: string | null }[];
}) {
  const [customLabel, setCustomLabel] = useState('');
  const [customColor, setCustomColor] = useState('#3b82f6');

  const existingLabels = new Set((lead.tags || []).map((t) => t.label));

  const mergedTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of PREDEFINED_TAGS) map.set(p.label, p.color);
    for (const t of allTags) {
      if (!map.has(t.label)) map.set(t.label, t.color || '#6b7280');
    }
    return Array.from(map.entries()).map(([label, color]) => ({ label, color }));
  }, [allTags]);

  const availableTags = mergedTags.filter((t) => !existingLabels.has(t.label));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {(lead.tags || []).map((tag) => (
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
      <div className="relative" ref={tagDropdownId === lead.id ? tagDropdownRef as React.RefObject<HTMLDivElement> : undefined}>
        <button
          type="button"
          onClick={() => setTagDropdownId(tagDropdownId === lead.id ? null : lead.id)}
          className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-accent hover:bg-gray-100 transition-colors"
          title="Добавить тег"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        {tagDropdownId === lead.id && (
          <div className="absolute z-30 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 min-w-[180px] max-h-[280px] overflow-y-auto">
            {availableTags.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onAddTag(lead.id, p.label, p.color)}
                className="block w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-50 transition-colors"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: p.color }}
                />
                {p.label}
              </button>
            ))}
            {availableTags.length > 0 && <hr className="my-1 border-gray-100" />}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customLabel.trim() && !existingLabels.has(customLabel.trim())) {
                  onAddTag(lead.id, customLabel.trim(), customColor);
                  setCustomLabel('');
                }
              }}
              className="flex items-center gap-1 px-1 pt-1"
            >
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Новый тег..."
                maxLength={100}
                className="flex-1 min-w-0 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-accent/30 focus:border-accent"
              />
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-5 h-5 rounded border border-gray-200 cursor-pointer flex-shrink-0"
              />
              <button
                type="submit"
                disabled={!customLabel.trim()}
                className="px-1.5 py-0.5 text-xs font-medium rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 flex-shrink-0"
              >
                +
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function ResumeLeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<ResumeLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [sources, setSources] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<ResumeLead | null>(null);
  const [convertingLead, setConvertingLead] = useState<ResumeLead | null>(null);

  // Contact popup
  const [contactPopupId, setContactPopupId] = useState<string | null>(null);
  const contactPopupRef = useRef<HTMLDivElement>(null);

  // Tags
  const [tagDropdownId, setTagDropdownId] = useState<string | null>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [allLeadTags, setAllLeadTags] = useState<{ label: string; color: string | null }[]>([]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterSource) params.source = filterSource;

      const res = await api.get<{ data: ResumeLead[]; total: number }>('/resume/leads', { params });
      setLeads(res.data.data);
      setTotal(res.data.total);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [page, limit, search, filterStatus, filterSource]);

  const silentReload = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterSource) params.source = filterSource;
      const res = await api.get<{ data: ResumeLead[]; total: number }>('/resume/leads', { params });
      setLeads(res.data.data);
      setTotal(res.data.total);
    } catch { /* ignore */ }
  }, [page, limit, search, filterStatus, filterSource]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get<LeadStats>('/resume/leads/stats');
      setStats(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadSources = useCallback(async () => {
    try {
      const res = await api.get<string[]>('/resume/leads/sources');
      setSources(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadAllLeadTags = useCallback(async () => {
    try {
      const res = await api.get<{ label: string; color: string | null }[]>('/resume/lead-tags/all');
      setAllLeadTags(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadSources(); }, [loadSources]);
  useEffect(() => { loadAllLeadTags(); }, [loadAllLeadTags]);

  // Close contact popup & tag dropdown on outside click
  useEffect(() => {
    if (!contactPopupId && !tagDropdownId) return;
    const handler = (e: MouseEvent) => {
      if (contactPopupId && contactPopupRef.current && !contactPopupRef.current.contains(e.target as Node)) setContactPopupId(null);
      if (tagDropdownId && tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) setTagDropdownId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contactPopupId, tagDropdownId]);

  const handleAddTag = async (leadId: string, label: string, color: string) => {
    try {
      await api.post(`/resume/leads/${leadId}/tags`, { label, color });
      silentReload();
      loadAllLeadTags();
    } catch { /* ignore */ }
    setTagDropdownId(null);
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await api.delete(`/resume/lead-tags/${tagId}`);
      silentReload();
      loadAllLeadTags();
    } catch { /* ignore */ }
  };

  const handleStatusChange = async (lead: ResumeLead, newStatus: string) => {
    try {
      await api.patch(`/resume/leads/${lead.id}`, { status: newStatus });
      silentReload();
      loadStats();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить заявку?')) return;
    try {
      await api.delete(`/resume/leads/${id}`);
      silentReload();
      loadStats();
    } catch { /* ignore */ }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Банк заявок</h1>
          {stats && (
            <div className="flex gap-3 mt-1 text-xs text-gray-500">
              <span>Всего: {stats.total}</span>
              {Object.entries(stats.byStatus)
                .filter(([k]) => k !== ResumeLeadStatus.CONVERTED && k !== ResumeLeadStatus.NOT_RELEVANT)
                .map(([k, v]) => (
                  <span key={k}>{LEAD_STATUSES[k]}: {v}</span>
                ))}
            </div>
          )}
        </div>
        <button
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          onClick={() => { setEditingLead(null); setShowForm(true); }}
        >
          + Добавить заявку
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          className="border rounded-lg px-3 py-1.5 text-sm w-64"
          placeholder="Поиск по имени, телефону, email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="border rounded-lg px-3 py-1.5 text-sm"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
        >
          <option value="">Все статусы</option>
          {Object.entries(LEAD_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <SourceFilter value={filterSource} onChange={(v) => { setFilterSource(v); setPage(1); }} sources={sources} />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-400">Загрузка...</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-gray-400">
          {search || filterStatus || filterSource ? 'Ничего не найдено' : 'Заявок пока нет'}
        </p>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Имя</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Специализация</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Направление</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Филиал</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Статус</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">ЗП</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Теги</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`hover:bg-gray-50/50 ${lead.status === ResumeLeadStatus.CONVERTED ? 'opacity-60' : ''}`}
                  >
                    {/* Имя + контакты + источник + город */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="min-w-0">
                          <button
                            className="text-accent hover:underline font-medium text-left"
                            onClick={() => { setEditingLead(lead); setShowForm(true); }}
                          >
                            {lead.name || <span className="text-gray-400 italic">Без имени</span>}
                          </button>
                          <div className="text-xs text-gray-400">
                            {[lead.city, lead.source].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                        {/* Контакт-попап */}
                        {(lead.phone || lead.email) && (
                          <div className="relative inline-flex" ref={contactPopupId === lead.id ? contactPopupRef : undefined}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setContactPopupId(contactPopupId === lead.id ? null : lead.id); }}
                              className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-accent hover:bg-gray-100 transition-colors"
                              title="Контакты"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </button>
                            {contactPopupId === lead.id && (
                              <div className="absolute z-30 right-0 mt-1 top-full bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[220px]">
                                {lead.phone && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-medium text-gray-900">{lead.phone}</span>
                                    <button type="button" onClick={() => navigator.clipboard.writeText(lead.phone!)} className="text-gray-400 hover:text-accent" title="Скопировать">
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    </button>
                                  </div>
                                )}
                                <div className="flex flex-col gap-1.5">
                                  {lead.phone && (
                                    <>
                                      <a href={`tel:${lead.phone}`} className="flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg">Позвонить</a>
                                      <a href={`https://wa.me/${formatPhoneForWhatsApp(lead.phone)}`} target="_blank" rel="noopener" className="flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg">WhatsApp</a>
                                    </>
                                  )}
                                  {lead.email && (
                                    <a href={`mailto:${lead.email}`} className="flex items-center justify-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">{lead.email}</a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{lead.specialization || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">
                      {lead.doctorTypes && lead.doctorTypes.length > 0
                        ? lead.doctorTypes.map((t) => DOCTOR_TYPE_LABELS[t] || t).join(', ')
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">
                      {lead.branches && lead.branches.length > 0
                        ? lead.branches.join(', ')
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={`text-xs rounded-full px-2 py-0.5 font-medium border-0 cursor-pointer ${LEAD_STATUS_COLORS[lead.status] || ''}`}
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead, e.target.value)}
                        disabled={lead.status === ResumeLeadStatus.CONVERTED}
                      >
                        {Object.entries(LEAD_STATUSES).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                      {lead.desiredSalary != null && lead.desiredSalaryType
                        ? lead.desiredSalaryType === 'PERCENT_OF_VISIT'
                          ? `${lead.desiredSalary}%`
                          : `${Number(lead.desiredSalary).toLocaleString('ru-RU')} \u20BD`
                        : <span className="text-gray-300">&mdash;</span>}
                    </td>
                    <td className="px-3 py-2">
                      <LeadTagsCell
                        lead={lead}
                        tagDropdownId={tagDropdownId}
                        setTagDropdownId={setTagDropdownId}
                        tagDropdownRef={tagDropdownRef}
                        onAddTag={handleAddTag}
                        onRemoveTag={handleRemoveTag}
                        allTags={allLeadTags}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {lead.status !== ResumeLeadStatus.CONVERTED ? (
                          <button
                            className="text-xs text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50 whitespace-nowrap"
                            onClick={() => setConvertingLead(lead)}
                            title="Конвертировать в кандидата"
                          >
                            В кандидата
                          </button>
                        ) : lead.convertedCandidateId ? (
                          <button
                            className="text-xs text-accent hover:underline px-1.5 py-0.5 whitespace-nowrap"
                            onClick={() => navigate(`/hr/resume/candidates/${lead.convertedCandidateId}`)}
                          >
                            Кандидат
                          </button>
                        ) : null}
                        <button
                          className="text-xs text-red-400 hover:text-red-600 px-1 py-0.5 rounded hover:bg-red-50"
                          onClick={() => handleDelete(lead.id)}
                          title="Удалить"
                        >
                          &times;
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} из {total}
            </span>
            <div className="flex items-center gap-3">
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s} на стр.</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Назад</button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Далее</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showForm && (
        <LeadFormModal
          lead={editingLead}
          onClose={() => setShowForm(false)}
          onSaved={() => { silentReload(); loadStats(); loadSources(); }}
          sources={sources}
        />
      )}
      {convertingLead && (
        <ConvertModal
          lead={convertingLead}
          onClose={() => setConvertingLead(null)}
          onConverted={(candidateId) => {
            setConvertingLead(null);
            navigate(`/hr/resume/candidates/${candidateId}`);
          }}
        />
      )}
    </div>
  );
}
