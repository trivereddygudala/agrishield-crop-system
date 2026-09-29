import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from './AppLayout';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const userRole = (user.role || 'farmer').toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    if (!normalizedAllowed.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
