import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { StaffRole } from '../types';
import type { ReactNode } from 'react';

export function RoleGate({ roles, children }: { roles: StaffRole[]; children: ReactNode }) {
  const { hasRole, isAuthenticated, mockAuth, login } = useAuth();

  if (!isAuthenticated && !mockAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <p className="text-lg font-semibold text-stone-800">Sign in to continue</p>
        <button
          onClick={() => login()}
          className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold text-lg shadow-lg"
        >
          Sign in with Microsoft
        </button>
      </div>
    );
  }

  const allowed = roles.some((r) => hasRole(r));
  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
