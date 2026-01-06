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
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-between py-16 px-8 bg-white dark:bg-black sm:items-start">
        <div className="flex w-full justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50">
            SMMP - Social Media Management Platform
          </h1>
          <div className="flex gap-3">
            {isAuthenticated && user ? (
              <>
                <span className="text-zinc-600 dark:text-zinc-400 self-center hidden sm:block">
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
          <div className="w-full">
            {/* Quick Actions */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <Link
                href="/channels"
                className="group rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
              >
                <div className="text-4xl mb-2">📱</div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Channels
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Manage connected accounts
                </p>
              </Link>

              <Link
                href="/posts/new"
                className="group rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center transition-colors hover:border-green-400 hover:bg-green-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-green-500 dark:hover:bg-green-900/20"
              >
                <div className="text-4xl mb-2">✍️</div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-green-600 dark:group-hover:text-green-400">
                  Create Post
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Publish to Threads
                </p>
              </Link>

              <Link
                href="/posts/scheduled"
                className="group rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center transition-colors hover:border-purple-400 hover:bg-purple-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-purple-500 dark:hover:bg-purple-900/20"
              >
                <div className="text-4xl mb-2">📅</div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                  Scheduled
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  View scheduled posts
                </p>
              </Link>

              <Link
                href="/media"
                className="group rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center transition-colors hover:border-pink-400 hover:bg-pink-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-pink-500 dark:hover:bg-pink-900/20"
              >
                <div className="text-4xl mb-2">📁</div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-pink-600 dark:group-hover:text-pink-400">
                  Media Library
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Manage uploaded media
                </p>
              </Link>

              <Link
                href="/analytics"
                className="group rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center transition-colors hover:border-orange-400 hover:bg-orange-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-orange-500 dark:hover:bg-orange-900/20"
              >
                <div className="text-4xl mb-2">📊</div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                  Analytics
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  View performance stats
                </p>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* User Profile Card */}
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
                    <dd className="text-zinc-900 dark:text-zinc-100 capitalize">{user.role.toLowerCase()}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-32 font-medium text-zinc-600 dark:text-zinc-400">Status:</dt>
                    <dd className="text-zinc-900 dark:text-zinc-100">
                      {user.isActive ? (
                        <span className="text-green-600">Active</span>
                      ) : (
                        <span className="text-red-600">Inactive</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Welcome Card */}
              <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-6 dark:from-blue-900/30 dark:to-blue-800/30">
                <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3">
                  🎉 Welcome to SMMP!
                </h2>
                <p className="text-zinc-700 dark:text-zinc-300 mb-4">
                  Get started by connecting your Threads account and creating your first post.
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/channels"
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500"
                  >
                    Connect Channels
                  </Link>
                  <Link
                    href="/posts/new"
                    className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    Create Post
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 text-center">
            <div>
              <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
                Social Media Management
                <span className="block text-blue-600">Made Simple</span>
              </h1>
              <p className="mt-4 max-w-lg text-lg text-zinc-600 dark:text-zinc-400">
                Manage multiple social media accounts, schedule posts, and analyze your performance—all in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-900 transition-transform hover:scale-105">
                <div className="text-4xl mb-3">🧵</div>
                <h3 className="font-semibold text-black dark:text-zinc-50 mb-2">
                  Threads Support
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Connect and publish to your Threads account
                </p>
              </div>
              <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-900 transition-transform hover:scale-105">
                <div className="text-4xl mb-3">📅</div>
                <h3 className="font-semibold text-black dark:text-zinc-50 mb-2">
                  Smart Scheduling
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Schedule posts for optimal engagement times
                </p>
              </div>
              <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-900 transition-transform hover:scale-105">
                <div className="text-4xl mb-3">📊</div>
                <h3 className="font-semibold text-black dark:text-zinc-50 mb-2">
                  Detailed Analytics
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Track your performance with comprehensive insights
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Ready to get started?</strong>{' '}
                <Link href="/register" className="font-medium underline hover:text-blue-700 dark:hover:text-blue-300">
                  Create an account
                </Link>
                {' '}or{' '}
                <Link href="/login" className="font-medium underline hover:text-blue-700 dark:hover:text-blue-300">
                  sign in
                </Link>
                {' '}to manage your social media presence.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
