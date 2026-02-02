import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Accounting from './pages/Accounting';
import Agents from './pages/Agents';
import Services from './pages/Services';
import HR from './pages/HR';
import HrListView from './pages/HrListView';
import HrEvents from './pages/HrEvents';
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
        <Route path="accounting" element={<ProtectedRoute permissions={['accounting']}><Accounting /></ProtectedRoute>} />
        <Route path="agents" element={<ProtectedRoute permissions={['agents']}><Agents /></ProtectedRoute>} />
        <Route path="services" element={<ProtectedRoute permissions={['services']}><Services /></ProtectedRoute>} />
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
