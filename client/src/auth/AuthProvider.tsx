import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { isMockAuth, loginRequest, graphScopes, msalConfig } from './msalConfig';
import { api } from '../lib/api';
import type { AppRole } from '../types';

const msalInstance = new PublicClientApplication(msalConfig);

interface AuthContextValue {
  roles: AppRole[];
  mockRole: AppRole;
  teacherGradeRooms: string[];
  hasRole: (role: AppRole) => boolean;
  mockAuth: boolean;
  setMockRole: (role: AppRole) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  getGraphToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_TEACHER_GRADES: Record<AppRole, string[]> = {
  admin: [],
  teacher: ['K-1'],
  lanevolunteer: [],
  driver: [],
};

function MockAuthProvider({ children }: { children: ReactNode }) {
  const [mockRole, setMockRole] = useState<AppRole>('admin');
  const roles: AppRole[] = [mockRole];

  return (
    <AuthContext.Provider
      value={{
        roles,
        mockRole,
        teacherGradeRooms: MOCK_TEACHER_GRADES[mockRole],
        hasRole: (r) => mockRole === 'admin' || mockRole === r,
        mockAuth: true,
        setMockRole,
        login: async () => {},
        logout: async () => {},
        isAuthenticated: true,
        getGraphToken: async () => null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function MsalAuthInner({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [teacherGradeRooms, setTeacherGradeRooms] = useState<string[]>([]);

  const roles: AppRole[] = (accounts[0]?.idTokenClaims?.roles as AppRole[]) ?? [];

  const getGraphToken = async (): Promise<string | null> => {
    if (!accounts[0]) return null;
    try {
      const result = await instance.acquireTokenSilent({ ...graphScopes, account: accounts[0] });
      return result.accessToken;
    } catch {
      const result = await instance.acquireTokenPopup(graphScopes);
      return result.accessToken;
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !roles.includes('teacher')) {
      setTeacherGradeRooms([]);
      return;
    }

    (async () => {
      try {
        const token = await getGraphToken();
        const { gradeRooms } = await api.getMyClasses(token ?? undefined);
        setTeacherGradeRooms(gradeRooms);
      } catch {
        setTeacherGradeRooms([]);
      }
    })();
  }, [isAuthenticated, accounts[0]?.homeAccountId]);

  return (
    <AuthContext.Provider
      value={{
        roles,
        mockRole: 'admin',
        teacherGradeRooms,
        hasRole: (r) => roles.includes('admin') || roles.includes(r),
        mockAuth: false,
        setMockRole: () => {},
        login: async () => {
          await instance.loginRedirect(loginRequest);
        },
        logout: async () => {
          await instance.logoutRedirect();
        },
        isAuthenticated,
        getGraphToken,
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
