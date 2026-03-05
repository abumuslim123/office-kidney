import { Link } from 'react-router-dom';

export default function ResumeApplySuccess() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Заявка отправлена!</h1>
        <p className="text-sm text-gray-600 mb-6">
          Ваше резюме успешно получено. Мы рассмотрим его и свяжемся с вами в ближайшее время.
        </p>
        <Link
          to="/resume/apply"
          className="inline-block px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          Отправить ещё одно
        </Link>
      </div>
    </div>
  );
}
