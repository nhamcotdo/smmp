'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { POST_STATUS } from '@/lib/constants'

interface DashboardStats {
  totalPosts: number
  scheduledPosts: number
  totalChannels: number
  totalMedia: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalPosts: 0,
    scheduledPosts: 0,
    totalChannels: 0,
    totalMedia: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardStats()
  }, [])

  async function loadDashboardStats() {
    try {
      const [postsRes, channelsRes, mediaRes] = await Promise.all([
        fetch('/api/posts?limit=1'),
        fetch('/api/channels'),
        fetch('/api/media?limit=1'),
      ])

      const postsData = await postsRes.json()
      const channelsData = await channelsRes.json()
      const mediaData = await mediaRes.json()

      setStats({
        totalPosts: postsData.data?.total || 0,
        scheduledPosts: postsData.data?.posts?.filter((p: { status: string }) => p.status === POST_STATUS.SCHEDULED).length || 0,
        totalChannels: channelsData.data?.length || 0,
        totalMedia: mediaData.data?.total || 0,
      })
    } catch (error) {
      console.error('Failed to load dashboard stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const quickActions = [
    {
      title: 'Create Post',
      description: 'Create and publish content',
      href: '/posts/new',
      icon: '✍️',
      color: 'green',
    },
    {
      title: 'Manage Channels',
      description: 'Connect social accounts',
      href: '/channels',
      icon: '📱',
      color: 'blue',
    },
    {
      title: 'Scheduled Posts',
      description: 'View upcoming content',
      href: '/posts/scheduled',
      icon: '📅',
      color: 'purple',
    },
    {
      title: 'Media Library',
      description: 'Manage uploaded files',
      href: '/media',
      icon: '📁',
      color: 'pink',
    },
    {
      title: 'Analytics',
      description: 'View performance insights',
      href: '/analytics',
      icon: '📊',
      color: 'orange',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Here&apos;s what&apos;s happening with your social media accounts today.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Posts</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-50">
                {isLoading ? '...' : stats.totalPosts}
              </p>
            </div>
            <div className="text-4xl">📝</div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Scheduled</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-50">
                {isLoading ? '...' : stats.scheduledPosts}
              </p>
            </div>
            <div className="text-4xl">📅</div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Channels</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-50">
                {isLoading ? '...' : stats.totalChannels}
              </p>
            </div>
            <div className="text-4xl">📱</div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Media Files</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-50">
                {isLoading ? '...' : stats.totalMedia}
              </p>
            </div>
            <div className="text-4xl">📁</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition-all hover:border-gray-400 hover:bg-white dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600 dark:hover:bg-gray-800"
            >
              <div className="mb-3 text-4xl transition-transform group-hover:scale-110">
                {action.icon}
              </div>
              <h3 className="mb-1 font-semibold text-gray-900 dark:text-gray-50">
                {action.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Getting Started Card */}
      {stats.totalChannels === 0 && (
        <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 dark:border-blue-800 dark:from-blue-900/30 dark:to-blue-800/30">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🚀</div>
            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
                Get Started with SMMP
              </h3>
              <p className="mb-4 text-sm text-blue-800 dark:text-blue-200">
                Connect your social media accounts and start creating content in just a few clicks.
              </p>
              <div className="flex gap-3">
                <Link
                  href="/channels"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Connect Channels
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="/posts/new"
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  Create Post
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
