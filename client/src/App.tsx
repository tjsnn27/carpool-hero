import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Car, ClipboardList, HelpCircle, MapPin, Shield, Smartphone, Tag, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import { RoleGate } from './components/RoleGate';
import { useRealtime } from './hooks/useRealtime';
import LaneScannerPage from './pages/LaneScannerPage';
import ClassroomBoardPage from './pages/ClassroomBoardPage';
import AdminRosterPage from './pages/AdminRosterPage';
import AdminTagsPage from './pages/AdminTagsPage';
import AdminPickupZonePage from './pages/AdminPickupZonePage';
import DriverPickupPage from './pages/DriverPickupPage';
import FaqPage from './pages/FaqPage';
import type { StaffRole } from './types';
import { STAFF_ROLE_LABELS } from './types';

const STAFF_ROLES: StaffRole[] = ['dispatcher', 'teacher', 'trafficcontroller'];

const nav: { to: string; label: string; icon: typeof Car; roles?: StaffRole[]; public?: boolean }[] = [
  { to: '/driver-pickup', label: 'Driver', icon: Smartphone, public: true },
  { to: '/lane-scanner', label: 'Traffic Control', icon: Car, roles: ['trafficcontroller', 'dispatcher'] },
  { to: '/classroom-board', label: 'Board', icon: ClipboardList, roles: ['teacher', 'dispatcher'] },
  { to: '/admin-roster', label: 'Roster', icon: Shield, roles: ['dispatcher'] },
  { to: '/admin-tags', label: 'Tags', icon: Tag, roles: ['dispatcher'] },
  { to: '/admin-pickup-zone', label: 'Zone', icon: MapPin, roles: ['dispatcher'] },
  { to: '/faq', label: 'FAQ', icon: HelpCircle, public: true },
];

export default function App() {
  const { mockAuth, setMockRole, mockRole, hasRole, login, logout, isAuthenticated } = useAuth();
  const { connected, mockMode } = useRealtime();

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
                onChange={(e) => setMockRole(e.target.value as StaffRole)}
                className="text-xs bg-brand-800 border border-brand-500 rounded-lg px-2 py-1 text-white"
                aria-label="Mock role"
              >
                <option value="" disabled>Role…</option>
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>{STAFF_ROLE_LABELS[role]}</option>
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
          .filter((n) => n.public || (n.roles && n.roles.some((r) => hasRole(r))))
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-black whitespace-nowrap border-2 ${
                  isActive
                    ? 'bg-brand-600 text-white border-stone-900 shadow-[2px_2px_0_#1c1917]'
                    : 'bg-amber-50 text-stone-800 border-transparent hover:border-stone-400'
                }`
              }
            >
              <Icon size={18} strokeWidth={2.5} />
              {label}
            </NavLink>
          ))}
      </nav>

      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<Navigate to="/driver-pickup" replace />} />
          <Route path="/driver-pickup" element={<DriverPickupPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route
            path="/lane-scanner"
            element={
              <RoleGate roles={['trafficcontroller', 'dispatcher']}>
                <LaneScannerPage />
              </RoleGate>
            }
          />
          <Route
            path="/classroom-board"
            element={
              <RoleGate roles={['teacher', 'dispatcher']}>
                <ClassroomBoardPage />
              </RoleGate>
            }
          />
          <Route
            path="/admin-roster"
            element={
              <RoleGate roles={['dispatcher']}>
                <AdminRosterPage />
              </RoleGate>
            }
          />
          <Route
            path="/admin-tags"
            element={
              <RoleGate roles={['dispatcher']}>
                <AdminTagsPage />
              </RoleGate>
            }
          />
          <Route
            path="/admin-pickup-zone"
            element={
              <RoleGate roles={['dispatcher']}>
                <AdminPickupZonePage />
              </RoleGate>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
