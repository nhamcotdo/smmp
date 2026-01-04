'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getChannels, disconnectChannel, refreshChannelToken, getThreadsConnectUrl } from '@/lib/api/channels'
import type { Channel } from '@/lib/api/channels'

export default function ChannelsPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isLoading && isAuthenticated) {
      loadChannels()
    }
  }, [isLoading, isAuthenticated])

  async function loadChannels() {
    setIsLoadingChannels(true)
    setError('')
    try {
      const data = await getChannels()
      setChannels(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels')
    } finally {
      setIsLoadingChannels(false)
    }
  }

  async function handleConnectThreads() {
    try {
      const url = await getThreadsConnectUrl()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get authorization URL')
    }
  }

  async function handleDisconnect(channelId: string) {
    if (!confirm('Are you sure you want to disconnect this channel?')) {
      return
    }

    setError('')
    setSuccessMessage('')
    try {
      await disconnectChannel(channelId)
      setSuccessMessage('Channel disconnected successfully')
      await loadChannels()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect channel')
    }
  }

  async function handleRefresh(channelId: string) {
    setError('')
    setSuccessMessage('')
    try {
      const result = await refreshChannelToken(channelId)
      setSuccessMessage(`Token refreshed. Expires at ${new Date(result.tokenExpiresAt).toLocaleString()}`)
      await loadChannels()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh token')
    }
  }

  function getPlatformIcon(platform: string) {
    switch (platform.toLowerCase()) {
      case 'threads':
        return '🧵'
      case 'facebook':
        return '📘'
      case 'instagram':
        return '📷'
      case 'tiktok':
        return '🎵'
      case 'youtube':
        return '▶️'
      default:
        return '📱'
    }
  }

  function getStatusColor(status: string) {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
      case 'expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
      case 'error':
      case 'revoked':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200'
    }
  }

  function formatExpiresAt(expiresAt?: string) {
    if (!expiresAt) return 'Unknown'
    const date = new Date(expiresAt)
    const now = new Date()
    const daysUntilExpiry = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry < 0) return 'Expired'
    if (daysUntilExpiry === 0) return 'Expires today'
    if (daysUntilExpiry === 1) return 'Expires tomorrow'
    if (daysUntilExpiry < 7) return `Expires in ${daysUntilExpiry} days`
    return `Expires ${date.toLocaleDateString()}`
  }

  if (isLoading || isLoadingChannels) {
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
                Channels
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Manage your connected social media accounts
              </p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-md bg-green-50 p-4 dark:bg-green-900/20">
            <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Connected Channels ({channels.length})
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Connect your social media accounts to manage and publish content
            </p>
          </div>
          <button
            onClick={handleConnectThreads}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            + Connect Threads
          </button>
        </div>

        {channels.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mx-auto mb-4 text-6xl">📱</div>
            <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              No channels connected yet
            </h3>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Connect your Threads account to start publishing content
            </p>
            <button
              onClick={handleConnectThreads}
              className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Connect Your First Channel
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-2xl dark:bg-zinc-800">
                    {channel.avatar ? (
                      <img
                        src={channel.avatar}
                        alt={channel.username}
                        className="h-12 w-12 rounded-full"
                      />
                    ) : (
                      <span>{getPlatformIcon(channel.platform)}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                        @{channel.username}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(channel.status)}`}
                      >
                        {channel.status}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                      <span>Followers: {channel.followersCount?.toLocaleString() || 'N/A'}</span>
                      <span>Posts: {channel.postsCount?.toLocaleString() || 'N/A'}</span>
                      <span>{formatExpiresAt(channel.tokenExpiresAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRefresh(channel.id)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    title="Refresh access token"
                  >
                    🔄 Refresh
                  </button>
                  <button
                    onClick={() => handleDisconnect(channel.id)}
                    className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                    title="Disconnect channel"
                  >
                    ✕ Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-lg bg-blue-50 p-6 dark:bg-blue-900/20">
          <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-200">
            🔒 Secure Connection
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Your access tokens are encrypted and stored securely. You can disconnect your
            accounts at any time, and tokens will be automatically refreshed when needed.
          </p>
        </div>
      </main>
    </div>
  )
}
