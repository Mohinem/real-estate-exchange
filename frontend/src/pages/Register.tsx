import React, { useState } from 'react';
import Layout from '../components/Layout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Register() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [okMsg, setOkMsg] = useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setOkMsg(undefined);

    // minimal validation
    if (!email.trim()) return setError('Please enter an email.');
    if (!name.trim()) return setError('Please enter your name.');
    if (!password || password.length < 6)
      return setError('Password must be at least 6 characters.');

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // send both naming conventions for safety
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: name.trim(),
          display_name: name.trim(),
        }),
      });

      if (!res.ok) throw new Error((await res.text()) || 'Registration failed');
      await res.json();
      setOkMsg('Registered successfully! Redirecting to login…');
      setTimeout(() => (location.href = '/login'), 700);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      {/* Header strip (matches Home/Login) */}
      <section className="bg-gradient-to-b from-white to-blue-50 border-b">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
            Create your account
          </h1>
          <p className="mt-3 max-w-2xl text-gray-600 text-base sm:text-lg">
            Join the marketplace to post listings, propose exchanges, and chat with owners.
          </p>
        </div>
      </section>

      {/* Form card */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <div className="mx-auto max-w-md">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100">
            <div className="px-6 sm:px-8 py-8">
              {(error || okMsg) && (
                <div
                  className={`mb-6 rounded-lg px-4 py-3 text-sm ${
                    error
                      ? 'border border-red-200 bg-red-50 text-red-700'
                      : 'border border-green-200 bg-green-50 text-green-700'
                  }`}
                >
                  {error || okMsg}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-6">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    required
                  />
                </div>

                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full name
                  </label>
                  <input
                    id="name"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    required
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Use at least 6 characters. You can change this later.
                  </p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-medium text-white transition
                    ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                  `}
                >
                  {loading && (
                    <svg
                      className="mr-2 h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
                    </svg>
                  )}
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              {/* Divider */}
              <div className="mt-6 flex items-center gap-4 text-xs text-gray-400">
                <div className="h-px flex-1 bg-gray-200" />
                or
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Login link */}
              <p className="mt-6 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <a href="/login" className="text-blue-700 hover:text-blue-800 font-medium">
                  Sign in
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
