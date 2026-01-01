'use client'

import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

export default function Home() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex w-full justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-black dark:text-zinc-50">
            SMMP - Social Media Management Platform
          </h1>
          <div className="flex gap-4">
            {isAuthenticated && user ? (
              <>
                <span className="text-zinc-600 dark:text-zinc-400 self-center">
                  Welcome, {user.name}
                </span>
                <button
                  onClick={logout}
                  className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>

        {isAuthenticated && user ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-900">
              <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">
                Your Profile
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex">
                  <dt className="w-32 font-medium text-zinc-600 dark:text-zinc-400">Name:</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">{user.name}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 font-medium text-zinc-600 dark:text-zinc-400">Email:</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">{user.email}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 font-medium text-zinc-600 dark:text-zinc-400">Role:</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">{user.role}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 font-medium text-zinc-600 dark:text-zinc-400">Status:</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">
                    {user.isActive ? 'Active' : 'Inactive'}
                  </dd>
                </div>
                <div className="flex">
                  <dt className="w-32 font-medium text-zinc-600 dark:text-zinc-400">Email Verified:</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">
                    {user.emailVerified ? 'Yes' : 'No'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg bg-blue-50 p-6 dark:bg-blue-900/20">
              <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2">
                Welcome to SMMP!
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                You are now logged in. Start managing your social media accounts.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
            <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
              Social Media Management Platform
            </h1>
            <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Manage multiple social media accounts, schedule posts, and analyze your performance—all in one place.
            </p>
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-900">
                <h3 className="font-semibold text-black dark:text-zinc-50 mb-2">
                  🔐 Secure Authentication
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  JWT-based authentication with encrypted passwords
                </p>
              </div>
              <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-900">
                <h3 className="font-semibold text-black dark:text-zinc-50 mb-2">
                  📊 Analytics Dashboard
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Track your social media performance with detailed analytics
                </p>
              </div>
              <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-900">
                <h3 className="font-semibold text-black dark:text-zinc-50 mb-2">
                  📅 Post Scheduling
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Schedule posts across multiple platforms in advance
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
