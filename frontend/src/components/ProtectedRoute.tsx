import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type ProtectedRouteProps = {
  children: React.ReactNode;
  roles?: string[];
  permissions?: string[];
};

export default function ProtectedRoute({ children, roles, permissions }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Legacy roles check (for backward compatibility)
  if (roles?.length && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Permissions check
  if (permissions?.length && user) {
    const userPermissions = user.permissions?.map((p) => p.slug) || [];
    const hasPermission = permissions.some((perm) => userPermissions.includes(perm));
    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
