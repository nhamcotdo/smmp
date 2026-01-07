'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import type { PostInsights } from '@/lib/types/analytics'

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
    id: string
    platform: string
    platformPostId: string | null
    platformPostUrl?: string
    status: string
    publishedAt: string | null
    analytics?: PostInsights
    analyticsError?: string
  }[]
}

export default function AnalyticsPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [posts, setPosts] = useState<PostAnalytics[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [loadingInsights, setLoadingInsights] = useState<Set<string>>(new Set())
  const [insightsCache, setInsightsCache] = useState<Map<string, PostInsights>>(new Map())
  const inFlightRequests = useRef<Set<string>>(new Set())
  const [isFetchingAll, setIsFetchingAll] = useState(false)

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

  const fetchInsights = useCallback(async (publicationId: string, postId: string) => {
    // Double-check: cache AND in-flight to prevent race condition
    if (insightsCache.has(publicationId) || inFlightRequests.current.has(publicationId)) {
      return
    }

    // Mark as in-flight BEFORE the async operation
    inFlightRequests.current.add(publicationId)
    setLoadingInsights((prev) => new Set(prev).add(publicationId))

    try {
      const response = await fetch(`/api/analytics/posts/${publicationId}/insights`)
      const data = await response.json()

      if (data.success && data.data) {
        // Update cache
        setInsightsCache((prev) => new Map(prev).set(publicationId, data.data))

        // Update posts state with new insights
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  publications: post.publications.map((pub) =>
                    pub.id === publicationId
                      ? { ...pub, analytics: data.data, analyticsError: undefined }
                      : pub
                  ),
                }
              : post
          )
        )
      } else {
        throw new Error(data.message || 'Failed to load insights')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load insights'
      console.error('Failed to fetch insights:', errorMessage)

      // Add error to the publication state for user-facing feedback
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.postId === postId
            ? {
                ...post,
                publications: post.publications.map((pub) =>
                  pub.id === publicationId
                    ? { ...pub, analyticsError: errorMessage }
                    : pub
                ),
              }
            : post
        )
      )
    } finally {
      inFlightRequests.current.delete(publicationId)
      setLoadingInsights((prev) => {
        const next = new Set(prev)
        next.delete(publicationId)
        return next
      })
    }
  }, [insightsCache])

  const fetchAllInsights = useCallback(async () => {
    setIsFetchingAll(true)

    // Collect all Threads publications that need insights
    const publicationsToFetch: Array<{ publicationId: string }> = []
    const postIdsToUpdate = new Set<string>()

    // Use functional updates to get latest state
    setPosts((currentPosts) => {
      for (const post of currentPosts) {
        for (const pub of post.publications) {
          if (
            pub.platform === 'THREADS' &&
            pub.platformPostId &&
            pub.status === 'PUBLISHED' &&
            !insightsCache.has(pub.id) &&
            !inFlightRequests.current.has(pub.id)
          ) {
            publicationsToFetch.push({ publicationId: pub.id })
            postIdsToUpdate.add(post.postId)
          }
        }
      }
      return currentPosts
    })

    if (publicationsToFetch.length === 0) {
      setIsFetchingAll(false)
      return
    }

    // Fetch all insights in parallel
    const results = await Promise.allSettled(
      publicationsToFetch.map(({ publicationId }) =>
        fetch(`/api/analytics/posts/${publicationId}/insights`).then(async (res) => {
          const data = await res.json()
          return { publicationId, data, success: data.success }
        })
      )
    )

    // Update state with results
    const updates = new Map<string, { analytics?: PostInsights; error?: string }>()

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { publicationId, data, success } = result.value
        if (success && data.data) {
          setInsightsCache((prev) => new Map(prev).set(publicationId, data.data))
          updates.set(publicationId, { analytics: data.data })
        } else {
          updates.set(publicationId, { error: data.message || 'Failed to load insights' })
        }
      } else {
        const publicationId = publicationsToFetch[results.indexOf(result)]?.publicationId || ''
        updates.set(publicationId, { error: 'Failed to load insights' })
      }
    }

    // Apply all updates at once for posts that were updated
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        postIdsToUpdate.has(post.postId)
          ? {
              ...post,
              publications: post.publications.map((pub) => {
                const update = updates.get(pub.id)
                if (update) {
                  return {
                    ...pub,
                    analytics: update.analytics,
                    analyticsError: update.error,
                  }
                }
                return pub
              }),
            }
          : post
      )
    )

    setIsFetchingAll(false)
  }, [insightsCache])

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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Recent Posts Performance
            </h2>
            {posts.length > 0 && (
              <button
                onClick={fetchAllInsights}
                disabled={isFetchingAll}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-blue-800"
              >
                {isFetchingAll ? 'Loading...' : 'Get All Insights'}
              </button>
            )}
          </div>
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
                    {post.publications.map((pub) => (
                      <div
                        key={pub.id}
                        className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
                      >
                        <div className="flex items-center gap-2">
                          <span>{getPlatformIcon(pub.platform)}</span>
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {pub.platform}
                          </span>
                          {pub.platformPostUrl && (
                            <a
                              href={pub.platformPostUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                            >
                              View post
                            </a>
                          )}
                        </div>
                        {pub.platform === 'THREADS' && pub.platformPostId && pub.status === 'PUBLISHED' ? (
                          <div className="flex items-center gap-4">
                            {pub.analytics ? (
                              <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                                <span>👁️ {formatNumber(pub.analytics.views)}</span>
                                <span>❤️ {formatNumber(pub.analytics.likes)}</span>
                                <span>💬 {formatNumber(pub.analytics.shares)}</span>
                                <span>↩️ {formatNumber(pub.analytics.replies)}</span>
                                <span>❝ {formatNumber(pub.analytics.quotes)}</span>
                                <span>🔄 {formatNumber(pub.analytics.reposts)}</span>
                              </div>
                            ) : loadingInsights.has(pub.id) ? (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                Loading...
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => fetchInsights(pub.id, post.postId)}
                                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  View insight
                                </button>
                                {pub.analyticsError && (
                                  <span className="text-xs text-red-600 dark:text-red-400">
                                    {pub.analyticsError}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : pub.platform === 'THREADS' && pub.status !== 'PUBLISHED' ? (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            Not published yet
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            No insights available
                          </span>
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
