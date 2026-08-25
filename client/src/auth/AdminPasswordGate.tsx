import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from './AuthProvider';

export function AdminPasswordGate({ children }: { children: ReactNode }) {
  const { adminUnlocked, unlockAdmin } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (adminUnlocked) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockAdmin(password)) {
      setError('');
      setPassword('');
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6">
      <Lock className="text-brand-700" size={40} />
      <h2 className="text-xl font-black text-stone-900">Admin Access</h2>
      <p className="text-sm font-bold text-stone-600 text-center max-w-sm">
        Enter the admin password to open roster, tags, zone, and session controls.
      </p>
      <form onSubmit={submit} className="w-full max-w-xs space-y-3">
        <input
          type="password"
          inputMode="numeric"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full border-3 border-stone-900 rounded-xl px-4 py-3 font-bold text-center text-lg"
          autoComplete="current-password"
        />
        {error && <p className="text-red-700 font-bold text-sm text-center">{error}</p>}
        <button
          type="submit"
          className="w-full py-3 bg-brand-600 text-white rounded-xl font-black border-3 border-stone-900"
        >
          Unlock Admin
        </button>
      </form>
    </div>
  );
}
