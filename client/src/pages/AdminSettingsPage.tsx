import { useState } from 'react';
import { RefreshCw, Settings } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';

export default function AdminSettingsPage() {
  const { lockAdmin } = useAuth();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const restartSession = async () => {
    if (!password.trim()) {
      setMessage('Enter admin password to restart the session.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const result = await api.restartSession(password);
      setMessage(`Session restarted for ${result.session_date}. ${result.studentsReset} students reset to Not Checked In.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Restart failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Settings className="text-brand-700" size={32} />
        <div>
          <h1 className="text-2xl font-black text-stone-900">Admin Settings</h1>
          <p className="text-sm font-bold text-stone-600">Sunday session controls</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-4 border-stone-900 p-5 shadow-[3px_3px_0_#1c1917] space-y-4">
        <h2 className="font-black text-lg flex items-center gap-2">
          <RefreshCw size={20} /> Restart Sunday Session
        </h2>
        <p className="text-sm font-medium text-stone-700">
          Resets every student to <strong>Not Checked In</strong>, clears the pickup queue, and prepares the app for a new Sunday.
          The app also auto-resets on the first use each Sunday.
        </p>
        <label className="block">
          <span className="text-sm font-bold text-stone-600">Admin password</span>
          <input
            type="password"
            inputMode="numeric"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border-2 border-stone-900 rounded-xl px-3 py-2 font-bold"
          />
        </label>
        <button
          onClick={restartSession}
          disabled={loading}
          className="w-full py-3 bg-red-600 text-white rounded-xl font-black border-3 border-stone-900 disabled:opacity-50"
        >
          {loading ? 'Restarting…' : 'Restart Session'}
        </button>
        {message && <p className="text-sm font-bold text-stone-800">{message}</p>}
      </div>

      <button
        onClick={lockAdmin}
        className="text-sm font-bold text-brand-700 underline"
      >
        Lock admin access
      </button>
    </div>
  );
}
