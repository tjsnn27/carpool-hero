import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { isMockAuth, loginRequest, graphScopes, msalConfig } from './msalConfig';
import { api } from '../lib/api';
import type { AppRole, StaffRole } from '../types';
import { parseMockPersona, teacherPersonaValue } from '../types';

function hasStaffRole(active: AppRole, required: StaffRole): boolean {
  return active === 'dispatcher' || active === required;
}

function hasAnyStaffRole(activeRoles: AppRole[], required: StaffRole): boolean {
  return activeRoles.includes('dispatcher') || activeRoles.includes(required);
}

const msalInstance = new PublicClientApplication(msalConfig);

interface AuthContextValue {
  roles: AppRole[];
  mockPersona: string;
  mockRole: StaffRole;
  rosterGradeRooms: string[];
  activeTeacherGrade: string | null;
  teacherGradeRooms: string[];
  hasRole: (role: StaffRole) => boolean;
  mockAuth: boolean;
  setMockPersona: (persona: string) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  getGraphToken: () => Promise<string | null>;
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
  const [mockPersona, setMockPersona] = useState('dispatcher');
  const [rosterGradeRooms, setRosterGradeRooms] = useState<string[]>([]);

  const { role: mockRole, teacherGrade: activeTeacherGrade } = useMemo(
    () => parseMockPersona(mockPersona),
    [mockPersona]
  );

  const roles: AppRole[] = [mockRole];
  const teacherGradeRooms =
    mockRole === 'teacher' && activeTeacherGrade ? [activeTeacherGrade] : [];

  useEffect(() => {
    loadRosterGrades().then(setRosterGradeRooms);
  }, []);

  const refreshRosterGrades = async () => {
    setRosterGradeRooms(await loadRosterGrades());
  };

  // If roster grades change and current teacher persona is invalid, fall back to dispatcher
  useEffect(() => {
    if (mockRole !== 'teacher' || !activeTeacherGrade) return;
    if (rosterGradeRooms.length > 0 && !rosterGradeRooms.includes(activeTeacherGrade)) {
      setMockPersona('dispatcher');
    }
  }, [mockRole, activeTeacherGrade, rosterGradeRooms]);

  return (
    <AuthContext.Provider
      value={{
        roles,
        mockPersona,
        mockRole,
        rosterGradeRooms,
        activeTeacherGrade,
        teacherGradeRooms,
        hasRole: (r) => hasStaffRole(mockRole, r),
        mockAuth: true,
        setMockPersona,
        login: async () => {},
        logout: async () => {},
        isAuthenticated: true,
        getGraphToken: async () => null,
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
  const [teacherGradeRooms, setTeacherGradeRooms] = useState<string[]>([]);
  const [rosterGradeRooms, setRosterGradeRooms] = useState<string[]>([]);

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
    loadRosterGrades().then(setRosterGradeRooms);
  }, []);

  const refreshRosterGrades = async () => {
    setRosterGradeRooms(await loadRosterGrades());
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
        if (gradeRooms.length > 0) {
          setTeacherGradeRooms(gradeRooms);
        } else if (rosterGradeRooms.length > 0) {
          setTeacherGradeRooms(rosterGradeRooms);
        }
      } catch {
        setTeacherGradeRooms(rosterGradeRooms);
      }
    })();
  }, [isAuthenticated, accounts[0]?.homeAccountId, rosterGradeRooms, roles]);

  const activeTeacherGrade =
    roles.includes('teacher') && !roles.includes('dispatcher') && teacherGradeRooms.length === 1
      ? teacherGradeRooms[0]
      : null;

  return (
    <AuthContext.Provider
      value={{
        roles,
        mockPersona: roles.includes('teacher')
          ? teacherPersonaValue(activeTeacherGrade ?? teacherGradeRooms[0] ?? 'Teacher')
          : roles[0] ?? 'dispatcher',
        mockRole: roles.includes('dispatcher')
          ? 'dispatcher'
          : roles.includes('teacher')
            ? 'teacher'
            : roles.includes('trafficcontroller')
              ? 'trafficcontroller'
              : 'dispatcher',
        rosterGradeRooms,
        activeTeacherGrade,
        teacherGradeRooms,
        hasRole: (r) => roles.some((active) => hasAnyStaffRole([active], r)),
        mockAuth: false,
        setMockPersona: () => {},
        login: async () => {
          await instance.loginRedirect(loginRequest);
        },
        logout: async () => {
          await instance.logoutRedirect();
        },
        isAuthenticated,
        getGraphToken,
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
