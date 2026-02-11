import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
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
import CallTopics from './pages/CallTopics';
import CallsSettings from './pages/CallsSettings';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { isAuthenticated, isLoading } = useAuth();

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
        <Route path="calls/topics" element={<ProtectedRoute permissions={['calls_manage_topics']}><CallTopics /></ProtectedRoute>} />
        <Route path="calls/settings" element={<ProtectedRoute permissions={['calls_settings']}><CallsSettings /></ProtectedRoute>} />
        <Route path="hr" element={<ProtectedRoute permissions={['hr']}><HR /></ProtectedRoute>} />
        <Route path="hr/events" element={<ProtectedRoute permissions={['hr']}><HrEvents /></ProtectedRoute>} />
        <Route path="hr/folder/:folderId" element={<ProtectedRoute permissions={['hr']}><HR /></ProtectedRoute>} />
        <Route path="hr/:listId" element={<ProtectedRoute permissions={['hr']}><HrListView /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
