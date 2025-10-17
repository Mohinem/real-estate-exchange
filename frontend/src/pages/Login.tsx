// frontend/src/pages/Login.tsx
import React, { useState } from 'react';
import Layout from '../components/Layout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(undefined);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error((await res.text()) || 'Login failed');

      const { token } = await res.json();
      if (!token) throw new Error('Login succeeded but no token returned');

      // ✅ Write BOTH keys to avoid breaking anything:
      localStorage.setItem('token', token); // what AuthProvider expects
      localStorage.setItem('jwt', token);   // backward-compat with any old reads

      // Optional tiny debug (harmless in prod)
      // console.debug('[Login] token set (head):', token.slice(0, 30) + '…');

      // Keep existing behavior: hard redirect to home
      location.href = '/';
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      {/* Hero / Intro (keeps visual rhythm with Home.tsx) */}
      <section className="bg-gradient-to-b from-white to-blue-50 border-b">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            Welcome back
          </h1>
          <p className="mt-4 max-w-2xl text-gray-600 text-lg leading-relaxed">
            Sign in to list properties, propose exchanges, and keep your swaps moving.
          </p>
        </div>
      </section>

      {/* Auth Card */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <div className="max-w-md mx-auto">
          <div className="bg-white border rounded-2xl shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900">Login</h2>
            <p className="mt-2 text-gray-600">
              Use the email and password you registered with.
            </p>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-2 relative">
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-12 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-sm text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onChange={() => {}}
                  />
                  Remember me
                </label>

                <a href="/forgot" className="text-sm font-medium text-blue-700 hover:text-blue-800">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full inline-flex items-center justify-center rounded-lg px-4 py-2.5 font-medium text-white transition
                  ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                `}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="mt-6 text-sm text-gray-600">
              Don’t have an account?{' '}
              <a href="/register" className="font-medium text-blue-700 hover:text-blue-800">
                Create one
              </a>
            </div>
          </div>

          {/* Subtle help text */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Having trouble? Contact support or try resetting your password.
          </p>
        </div>
      </section>
    </Layout>
  );
}
