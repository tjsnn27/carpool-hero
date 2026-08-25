import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { isMockAuth, loginRequest, msalConfig } from './msalConfig';
import { api } from '../lib/api';
import type { AppRole, StaffRole } from '../types';

function hasStaffRole(active: AppRole, required: StaffRole): boolean {
  return active === 'admin' || active === required;
}

function hasAnyStaffRole(activeRoles: AppRole[], required: StaffRole): boolean {
  return activeRoles.includes('admin') || activeRoles.includes(required);
}

const msalInstance = new PublicClientApplication(msalConfig);

interface AuthContextValue {
  roles: AppRole[];
  mockRole: StaffRole;
  rosterGradeRooms: string[];
  hasRole: (role: StaffRole) => boolean;
  mockAuth: boolean;
  setMockRole: (role: StaffRole) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refreshRosterGrades: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function rosterGradesFromStudents(students: { grade_room: string }[]): string[] {
  return [...new Set(students.map((s) => s.grade_room.trim()).filter(Boolean))].sort();
}

function loadRosterGrades(): Promise<string[]> {
  return api
    .getRoster()
    .then((roster) => rosterGradesFromStudents(roster.students))
    .catch(() => []);
}

function MockAuthProvider({ children }: { children: ReactNode }) {
  const [mockRole, setMockRole] = useState<StaffRole>('admin');
  const [rosterGradeRooms, setRosterGradeRooms] = useState<string[]>([]);

  useEffect(() => {
    loadRosterGrades().then(setRosterGradeRooms);
  }, []);

  const refreshRosterGrades = async () => {
    setRosterGradeRooms(await loadRosterGrades());
  };

  return (
    <AuthContext.Provider
      value={{
        roles: [mockRole],
        mockRole,
        rosterGradeRooms,
        hasRole: (r) => hasStaffRole(mockRole, r),
        mockAuth: true,
        setMockRole,
        login: async () => {},
        logout: async () => {},
        isAuthenticated: true,
        refreshRosterGrades,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function MsalAuthInner({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [rosterGradeRooms, setRosterGradeRooms] = useState<string[]>([]);

  const roles: AppRole[] = (accounts[0]?.idTokenClaims?.roles as AppRole[]) ?? [];

  useEffect(() => {
    loadRosterGrades().then(setRosterGradeRooms);
  }, []);

  const refreshRosterGrades = async () => {
    setRosterGradeRooms(await loadRosterGrades());
  };

  const mockRole: StaffRole = roles.includes('admin')
    ? 'admin'
    : roles.includes('hallmonitor')
      ? 'hallmonitor'
      : roles.includes('trafficcontroller')
        ? 'trafficcontroller'
        : 'admin';

  return (
    <AuthContext.Provider
      value={{
        roles,
        mockRole,
        rosterGradeRooms,
        hasRole: (r) => roles.some((active) => hasAnyStaffRole([active], r)),
        mockAuth: false,
        setMockRole: () => {},
        login: async () => {
          await instance.loginRedirect(loginRequest);
        },
        logout: async () => {
          await instance.logoutRedirect();
        },
        isAuthenticated,
        refreshRosterGrades,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (isMockAuth) {
    return <MockAuthProvider>{children}</MockAuthProvider>;
  }

  return (
    <MsalProvider instance={msalInstance}>
      <MsalAuthInner>{children}</MsalAuthInner>
    </MsalProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
