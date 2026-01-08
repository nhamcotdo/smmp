'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  // Redirect authenticated users to dashboard (which will be handled by the (dashboard) group)
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // The dashboard layout will be applied since we're rendering this at root level
      // but the actual dashboard content should be shown
      router.replace('/analytics')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  // Don't show landing page if authenticated (they'll be redirected)
  if (isAuthenticated) {
    return null
  }

  // Show landing page for non-authenticated users
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col items-center px-8 py-16 text-center sm:py-24">
        {/* Logo/Brand */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-5xl md:text-6xl">
            Social Media Management
            <span className="block text-blue-600">Made Simple</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg text-gray-600 dark:text-gray-400">
            Manage multiple social media accounts, schedule posts, and analyze your performance—all in one place.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-transform hover:scale-105 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 text-4xl">🧵</div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-50">
              Threads Support
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Connect and publish to your Threads account with ease
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-transform hover:scale-105 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 text-4xl">📅</div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-50">
              Smart Scheduling
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Schedule posts for optimal engagement times automatically
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-transform hover:scale-105 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 text-4xl">📊</div>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-50">
              Detailed Analytics
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track your performance with comprehensive insights
            </p>
          </div>
        </div>

        {/* CTA */}
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
      </main>
    </div>
  )
}
