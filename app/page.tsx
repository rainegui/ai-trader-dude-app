'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password === process.env.NEXT_PUBLIC_APP_PASSWORD) {
      // Set auth cookie (30 days)
      document.cookie = `atd_auth=true; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      router.push('/chat');
    } else {
      setError('Wrong password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Logo / Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-plum-deep mb-4">
              <svg
                className="w-8 h-8 text-pink"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-plum-deep">
              AI Trader Dude
            </h1>
            <p className="text-muted text-sm mt-1">Trading intelligence</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 rounded-lg border border-border bg-bg text-text placeholder:text-muted focus:outline-none focus:border-input-focus focus:ring-2 focus:ring-input-focus/20 transition-colors"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 rounded-lg bg-plum text-white font-medium hover:bg-plum-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entering...' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
