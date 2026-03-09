import { Link } from 'react-router-dom';

export default function CallsReports() {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Отчеты</h3>
      <div className="space-y-3">
        <Link
          to="/calls/settings/reports/analysis"
          className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-accent/40 hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
            📊
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 group-hover:text-accent transition-colors">
              Анализ разговоров
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Инфографика по тематикам, приветствия, прощания, слова-паразиты, длительность
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-300 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
