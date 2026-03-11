import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ensureProcessPushSubscription } from './lib/processPush';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Agents from './pages/Agents';
import Services from './pages/Services';
import Bitrix24 from './pages/Bitrix24';
import Bitrix24Employees from './pages/Bitrix24Employees';
import HR from './pages/HR';
import HrListView from './pages/HrListView';
import HrEvents from './pages/HrEvents';
import HrEventsPublic from './pages/HrEventsPublic';
import HrListsPublic from './pages/HrListsPublic';
import Screens from './pages/Screens';
import ScreensSettings from './pages/ScreensSettings';
import Calls from './pages/Calls';
import CallDetail from './pages/CallDetail';
import CallTopics from './pages/CallTopics';
import CallsSettings from './pages/CallsSettings';
import Processes from './pages/Processes';
import Settings from './pages/Settings';
import ResumeLayout from './components/resume/ResumeLayout';
import ResumeUploadPage from './pages/ResumeUploadPage';
import ResumeCandidatesPage from './pages/ResumeCandidatesPage';
import ResumeCandidateDetailPage from './pages/ResumeCandidateDetailPage';
import ResumeAnalyticsPage from './pages/ResumeAnalyticsPage';
import ResumeArchivePage from './pages/ResumeArchivePage';
import ResumeTrashPage from './pages/ResumeTrashPage';

import ResumeLeadsPage from './pages/ResumeLeadsPage';
import ResumeApplyPublic from './pages/ResumeApplyPublic';
import ResumeApplySuccess from './pages/ResumeApplySuccess';
import ProtectedRoute from './components/ProtectedRoute';

const resumeEnabled = import.meta.env.VITE_FEATURE_RESUME !== 'false';

function App() {
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!user?.permissions?.some((p) => p.slug === 'processes_view')) return;
    ensureProcessPushSubscription().catch(() => {});
  }, [isAuthenticated, user?.id, user?.permissions]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-500">Загрузка...</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="calendar/:token" element={<HrEventsPublic />} />
      <Route path="lists/:token" element={<HrListsPublic />} />
      {resumeEnabled && <Route path="resume/apply" element={<ResumeApplyPublic />} />}
      {resumeEnabled && <Route path="resume/apply/success" element={<ResumeApplySuccess />} />}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<ProtectedRoute permissions={['users']}><Users /></ProtectedRoute>} />
        <Route path="screens" element={<ProtectedRoute permissions={['screens']}><Screens /></ProtectedRoute>} />
        <Route path="screens/settings" element={<ProtectedRoute permissions={['screens']}><ScreensSettings /></ProtectedRoute>} />
        <Route path="agents" element={<ProtectedRoute permissions={['agents']}><Agents /></ProtectedRoute>} />
        <Route path="bitrix24" element={<ProtectedRoute permissions={['bitrix24']}><Bitrix24 /></ProtectedRoute>} />
        <Route path="bitrix24/employees" element={<ProtectedRoute permissions={['bitrix24']}><Bitrix24Employees /></ProtectedRoute>} />
        <Route path="services" element={<ProtectedRoute permissions={['services']}><Services /></ProtectedRoute>} />
        <Route path="calls" element={<ProtectedRoute permissions={['calls']}><Calls /></ProtectedRoute>} />
        <Route path="calls/:id" element={<ProtectedRoute permissions={['calls']}><CallDetail /></ProtectedRoute>} />
        <Route path="processes" element={<ProtectedRoute permissions={['processes_view']}><Processes /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute permissions={['processes_edit']}><Settings /></ProtectedRoute>} />
        <Route path="calls/topics" element={<ProtectedRoute permissions={['calls_manage_topics']}><CallTopics /></ProtectedRoute>} />
        <Route path="calls/settings" element={<ProtectedRoute permissions={['calls_settings']}><CallsSettings /></ProtectedRoute>} />
        <Route path="hr" element={<ProtectedRoute permissions={['hr']}><HR /></ProtectedRoute>} />
        <Route path="hr/events" element={<ProtectedRoute permissions={['hr']}><HrEvents /></ProtectedRoute>} />
        <Route path="hr/folder/:folderId" element={<ProtectedRoute permissions={['hr']}><HR /></ProtectedRoute>} />
        <Route path="hr/:listId" element={<ProtectedRoute permissions={['hr']}><HrListView /></ProtectedRoute>} />
        {resumeEnabled && (
          <Route path="hr/resume" element={<ProtectedRoute permissions={['hr']}><ResumeLayout /></ProtectedRoute>}>
            <Route index element={<ResumeUploadPage />} />
            <Route path="leads" element={<ResumeLeadsPage />} />
            <Route path="candidates" element={<ResumeCandidatesPage />} />
            <Route path="candidates/:id" element={<ResumeCandidateDetailPage />} />
            <Route path="analytics" element={<ResumeAnalyticsPage />} />

            <Route path="archive" element={<ResumeArchivePage />} />
            <Route path="trash" element={<ResumeTrashPage />} />
          </Route>
        )}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
