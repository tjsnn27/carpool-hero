import { NavLink, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { Car, ClipboardList, Lock, LogIn, MapPin, Settings, Shield, Tag, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import { RoleGate } from './components/RoleGate';
import { useRealtime } from './hooks/useRealtime';
import LaneScannerPage from './pages/LaneScannerPage';
import ClassroomBoardPage from './pages/ClassroomBoardPage';
import AdminRosterPage from './pages/AdminRosterPage';
import AdminTagsPage from './pages/AdminTagsPage';
import AdminPickupZonePage from './pages/AdminPickupZonePage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import MorningCheckInPage from './pages/MorningCheckInPage';
import { AdminPasswordGate } from './auth/AdminPasswordGate';
import type { StaffRole } from './types';
import { STAFF_ROLE_LABELS } from './types';

const nav: { to: string; label: string; icon: typeof Car; roles?: StaffRole[] }[] = [
  { to: '/morning-check-in', label: 'Morning Check-In', icon: LogIn, roles: ['hallmonitor', 'trafficcontroller', 'admin'] },
  { to: '/lane-scanner', label: 'Traffic Control', icon: Car, roles: ['trafficcontroller', 'admin'] },
  { to: '/classroom-board', label: 'Board', icon: ClipboardList, roles: ['hallmonitor', 'admin'] },
  { to: '/admin-roster', label: 'Roster', icon: Shield, roles: ['admin'] },
  { to: '/admin-tags', label: 'Tags', icon: Tag, roles: ['admin'] },
  { to: '/admin-pickup-zone', label: 'Zone', icon: MapPin, roles: ['admin'] },
  { to: '/admin-settings', label: 'Admin', icon: Settings, roles: ['admin'] },
];

function HomeRedirect() {
  const { hasRole, adminUnlocked } = useAuth();
  if (hasRole('admin') && !adminUnlocked) {
    return <Navigate to="/admin-settings" replace />;
  }
  if (hasRole('trafficcontroller') && !hasRole('admin')) {
    return <Navigate to="/lane-scanner" replace />;
  }
  if (hasRole('hallmonitor') && !hasRole('admin')) {
    return <Navigate to="/classroom-board" replace />;
  }
  return <Navigate to="/classroom-board" replace />;
}

const MOCK_ROLES: StaffRole[] = ['admin', 'trafficcontroller', 'hallmonitor'];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mockAuth, setMockRole, mockRole, hasRole, adminUnlocked, login, logout, isAuthenticated } = useAuth();
  const { connected, mockMode } = useRealtime();

  const showAdminLoginHint = hasRole('admin') && !adminUnlocked && location.pathname !== '/admin-settings';

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="bg-brand-700 text-white px-4 py-3 sticky top-0 z-50 shadow-lg border-b-4 border-brand-900">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/favicon.svg" alt="" className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-black leading-tight truncate">Agasthiyar Academy</h1>
              <p className="text-xs font-bold text-brand-100 truncate">Carpool Hero</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {connected ? <Wifi size={18} className="text-green-300" /> : <WifiOff size={18} className="text-red-300" />}
            <span className="text-xs font-bold hidden sm:inline">{mockMode ? 'Mock' : 'Live'}</span>
            {mockAuth ? (
              <select
                value={mockRole}
                onChange={(e) => {
                  const role = e.target.value as StaffRole;
                  setMockRole(role);
                  if (role === 'admin') navigate('/admin-settings');
                }}
                className="text-xs bg-brand-800 border border-brand-500 rounded-lg px-2 py-1 text-white max-w-[11rem]"
                aria-label="View as"
              >
                {MOCK_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {STAFF_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            ) : !isAuthenticated ? (
              <button onClick={() => login()} className="text-xs font-bold bg-white text-brand-800 px-3 py-1.5 rounded-lg">
                Sign in
              </button>
            ) : (
              <button onClick={() => logout()} className="text-xs font-bold bg-brand-800 px-3 py-1.5 rounded-lg">
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="bg-white border-b-4 border-stone-900 px-2 py-1 flex gap-1 overflow-x-auto sticky top-[4.5rem] z-40">
        {nav
          .filter((n) => n.roles && n.roles.some((r) => hasRole(r)))
          .filter((n) => {
            const isAdminOnly = n.roles?.length === 1 && n.roles[0] === 'admin';
            if (!isAdminOnly) return true;
            if (n.to === '/admin-settings') return true;
            return adminUnlocked;
          })
          .map(({ to, label, icon: Icon }) => {
            const isAdminLogin = to === '/admin-settings' && !adminUnlocked;
            const NavIcon = isAdminLogin ? Lock : Icon;
            const navLabel = isAdminLogin ? 'Admin Login' : label;
            return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-black whitespace-nowrap border-2 ${
                  isActive
                    ? isAdminLogin
                      ? 'bg-amber-500 text-stone-900 border-stone-900 shadow-[2px_2px_0_#1c1917]'
                      : 'bg-brand-600 text-white border-stone-900 shadow-[2px_2px_0_#1c1917]'
                    : isAdminLogin
                      ? 'bg-amber-100 text-stone-900 border-amber-600 hover:border-stone-900'
                      : 'bg-amber-50 text-stone-800 border-transparent hover:border-stone-400'
                }`
              }
            >
              <NavIcon size={18} strokeWidth={2.5} />
              {navLabel}
            </NavLink>
            );
          })}
      </nav>

      {showAdminLoginHint && (
        <div className="bg-amber-100 border-b-4 border-amber-600 px-4 py-3">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-amber-950">
              Admin tools are locked. Tap <strong>Admin Login</strong> in the menu and enter the password.
            </p>
            <button
              type="button"
              onClick={() => navigate('/admin-settings')}
              className="px-4 py-2 bg-brand-600 text-white rounded-xl font-black text-sm border-2 border-stone-900"
            >
              Go to Admin Login
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/driver-pickup" element={<Navigate to="/" replace />} />
          <Route path="/faq" element={<Navigate to="/" replace />} />
          <Route
            path="/morning-check-in"
            element={
              <RoleGate roles={['hallmonitor', 'trafficcontroller', 'admin']}>
                <MorningCheckInPage />
              </RoleGate>
            }
          />
          <Route
            path="/lane-scanner"
            element={
              <RoleGate roles={['trafficcontroller', 'admin']}>
                <LaneScannerPage />
              </RoleGate>
            }
          />
          <Route
            path="/classroom-board"
            element={
              <RoleGate roles={['hallmonitor', 'admin']}>
                <ClassroomBoardPage />
              </RoleGate>
            }
          />
          <Route
            path="/admin-roster"
            element={
              <RoleGate roles={['admin']}>
                <AdminPasswordGate>
                  <AdminRosterPage />
                </AdminPasswordGate>
              </RoleGate>
            }
          />
          <Route
            path="/admin-tags"
            element={
              <RoleGate roles={['admin']}>
                <AdminPasswordGate>
                  <AdminTagsPage />
                </AdminPasswordGate>
              </RoleGate>
            }
          />
          <Route
            path="/admin-pickup-zone"
            element={
              <RoleGate roles={['admin']}>
                <AdminPasswordGate>
                  <AdminPickupZonePage />
                </AdminPasswordGate>
              </RoleGate>
            }
          />
          <Route
            path="/admin-settings"
            element={
              <RoleGate roles={['admin']}>
                <AdminPasswordGate>
                  <AdminSettingsPage />
                </AdminPasswordGate>
              </RoleGate>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
