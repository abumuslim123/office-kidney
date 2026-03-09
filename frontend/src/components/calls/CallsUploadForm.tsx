import React from 'react';

type CallsUploadFormProps = {
  uploadEmployeeName: string;
  uploadClientName: string;
  uploadClientPhone: string;
  uploadCallAt: string;
  uploadFile: File | null;
  uploading: boolean;
  setUploadEmployeeName: (v: string) => void;
  setUploadClientName: (v: string) => void;
  setUploadClientPhone: (v: string) => void;
  setUploadCallAt: (v: string) => void;
  setUploadFile: (v: File | null) => void;
  setUploadDurationSeconds: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

function CallsUploadForm({
  uploadEmployeeName, uploadClientName, uploadClientPhone, uploadCallAt,
  uploading,
  setUploadEmployeeName, setUploadClientName, setUploadClientPhone, setUploadCallAt,
  setUploadFile, setUploadDurationSeconds, onSubmit,
}: CallsUploadFormProps) {
  return (
    <div className="mb-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="text-sm font-medium text-gray-700 mb-3">Ручная загрузка аудио</div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Сотрудник</label>
          <input
            type="text"
            value={uploadEmployeeName}
            onChange={(e) => setUploadEmployeeName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
            placeholder="Иван Иванов"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Клиент</label>
          <input
            type="text"
            value={uploadClientName}
            onChange={(e) => setUploadClientName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
            placeholder="ООО Ромашка"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Телефон клиента</label>
          <input
            type="tel"
            value={uploadClientPhone}
            onChange={(e) => setUploadClientPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
            placeholder="+7 999 123-45-67"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Дата и время</label>
          <input
            type="datetime-local"
            value={uploadCallAt}
            onChange={(e) => setUploadCallAt(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Аудиофайл</label>
          <input
            type="file"
            accept="audio/wav,audio/mpeg,audio/mp3"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setUploadFile(file);
              if (!file) return;
              const url = URL.createObjectURL(file);
              const audio = new Audio();
              audio.src = url;
              audio.addEventListener('loadedmetadata', () => {
                if (Number.isFinite(audio.duration) && audio.duration > 0) {
                  setUploadDurationSeconds(String(Math.round(audio.duration)));
                }
                URL.revokeObjectURL(url);
              });
              audio.addEventListener('error', () => {
                URL.revokeObjectURL(url);
              });
            }}
            className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer file:transition-colors"
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {uploading ? 'Загрузка...' : 'Загрузить'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default React.memo(CallsUploadForm);
