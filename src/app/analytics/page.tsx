'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface AnalyticsOverview {
  totalPosts: number
  publishedPosts: number
  scheduledPosts: number
  failedPosts: number
  totalPublications: number
  totalReach: number
  totalEngagement: number
  avgEngagementRate: number
  byPlatform: {
    platform: string
    posts: number
    reach: number
    engagement: number
  }[]
}

interface PostAnalytics {
  postId: string
  content: string
  status: string
  publishedAt: string | null
  publications: {
    platform: string
    platformPostId: string | null
    status: string
    publishedAt: string | null
    analytics?: {
      likes: number
      comments: number
      shares: number
      impressions: number
      reach: number
      engagementRate: number
    }
  }[]
}

export default function AnalyticsPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [posts, setPosts] = useState<PostAnalytics[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isLoading && isAuthenticated) {
      loadAnalytics()
    }
  }, [isLoading, isAuthenticated])

  async function loadAnalytics() {
    setIsLoadingData(true)
    setError('')

    try {
      const [overviewRes, postsRes] = await Promise.all([
        fetch('/api/analytics?type=overview'),
        fetch('/api/analytics'),
      ])

      const overviewData = await overviewRes.json()
      const postsData = await postsRes.json()

      if (!overviewData.success) {
        throw new Error(overviewData.message)
      }

      if (!postsData.success) {
        throw new Error(postsData.message)
      }

      setOverview(overviewData.data)
      setPosts(postsData.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setIsLoadingData(false)
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  function getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      THREADS: '🧵',
      INSTAGRAM: '📷',
      FACEBOOK: '📘',
      TWITTER: '🐦',
      TIKTOK: '🎵',
    }
    return icons[platform] || '📱'
  }

  if (isLoading || isLoadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="bg-white dark:bg-zinc-900 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Analytics
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track your social media performance
              </p>
            </div>
            <Link
              href="/"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {overview && (
          <>
            {/* Key Metrics */}
            <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total Posts</p>
                    <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                      {overview.totalPosts}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {overview.publishedPosts} published, {overview.scheduledPosts} scheduled
                    </p>
                  </div>
                  <div className="text-4xl">📝</div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total Reach</p>
                    <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                      {formatNumber(overview.totalReach)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Across all platforms
                    </p>
                  </div>
                  <div className="text-4xl">👁️</div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Engagement</p>
                    <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                      {formatNumber(overview.totalEngagement)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Likes, comments, shares
                    </p>
                  </div>
                  <div className="text-4xl">❤️</div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Engagement Rate</p>
                    <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                      {overview.avgEngagementRate.toFixed(2)}%
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Average across posts
                    </p>
                  </div>
                  <div className="text-4xl">📊</div>
                </div>
              </div>
            </div>

            {/* Platform Breakdown */}
            {overview.byPlatform.length > 0 && (
              <div className="mb-8 rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
                <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Performance by Platform
                </h2>
                <div className="space-y-4">
                  {overview.byPlatform.map((platform) => (
                    <div key={platform.platform} className="flex items-center gap-4">
                      <div className="text-2xl">{getPlatformIcon(platform.platform)}</div>
                      <div className="flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {platform.platform}
                          </span>
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {platform.posts} posts
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                          <div
                            className="h-2 rounded-full bg-blue-600"
                            style={{
                              width: `${overview.totalReach > 0 ? (platform.reach / overview.totalReach) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{formatNumber(platform.reach)} reach</span>
                          <span>{formatNumber(platform.engagement)} engagement</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Recent Posts with Analytics */}
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Recent Posts Performance
          </h2>
          {posts.length === 0 ? (
            <p className="text-center text-zinc-600 dark:text-zinc-400">
              No posts published yet. Start creating content to see analytics!
            </p>
          ) : (
            <div className="space-y-4">
              {posts.slice(0, 10).map((post) => (
                <div
                  key={post.postId}
                  className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
                >
                  <p className="mb-3 text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2">
                    {post.content}
                  </p>
                  <div className="space-y-2">
                    {post.publications.map((pub, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
                      >
                        <div className="flex items-center gap-2">
                          <span>{getPlatformIcon(pub.platform)}</span>
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {pub.platform}
                          </span>
                          {pub.platformPostId && (
                            <a
                              href={`https://threads.net/@${pub.platformPostId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                            >
                              View post
                            </a>
                          )}
                        </div>
                        {pub.analytics && (
                          <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                            <span>❤️ {formatNumber(pub.analytics.likes)}</span>
                            <span>💬 {formatNumber(pub.analytics.comments)}</span>
                            <span>🔄 {formatNumber(pub.analytics.shares)}</span>
                            <span>👁️ {formatNumber(pub.analytics.impressions)}</span>
                            <span className="font-medium">
                              {pub.analytics.engagementRate.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-8 rounded-lg bg-blue-50 p-6 dark:bg-blue-900/20">
          <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-200">
            💡 Analytics Tips
          </h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-blue-800 dark:text-blue-300">
            <li>Engagement rate = (likes + comments + shares) / reach × 100</li>
            <li>Posts with images typically get 2x more engagement than text-only posts</li>
            <li>Best times to post: Weekdays 9-11am and 2-4pm</li>
            <li>Use hashtags to increase discoverability by up to 50%</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
