'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getChannels } from '@/lib/api/channels'
import type { Channel } from '@/lib/api/channels'
import { PLATFORM, ACCOUNT_STATUS } from '@/lib/constants'

import { BulkPostForm } from './components/BulkPostForm'
import { BulkUrlInput } from './components/BulkUrlInput'

import type { PublishMode, BulkPostFormData, BulkPostItem, ParsedDouyinData } from '@/lib/types/posts'
import { DOUYIN_URL_PATTERN } from '@/lib/constants'

export default function BulkCreatePostPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [urlInput, setUrlInput] = useState('')
  const [bulkPostItems, setBulkPostItems] = useState<BulkPostItem[]>([])
  const [isAddingUrls, setIsAddingUrls] = useState(false)

  const [publishMode, setPublishMode] = useState<PublishMode>('now')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isLoading && isAuthenticated) {
      getChannels()
        .then((data) => {
          setChannels(data.filter((ch) => ch.platform === PLATFORM.THREADS && ch.status === ACCOUNT_STATUS.ACTIVE))
          setIsLoadingChannels(false)
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load channels')
          setIsLoadingChannels(false)
        })
    }
  }, [isLoading, isAuthenticated, router])

  const parseDouyinUrl = async (url: string): Promise<ParsedDouyinData> => {
    const response = await fetch('/api/parse/douyin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to parse Douyin URL')
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.message || 'Failed to parse Douyin URL')
    }

    return data.data as ParsedDouyinData
  }

  const parseBulkPostLine = async (line: string, index: number) => {
    // Parse the line format: text share | Post Content | Video description | Image description | hh:mm DD/MM/YYYY | channel-username
    const parts = line.split('|').map(part => part.trim())

    // Extract text share (first part - required)
    const textShare = parts[0] || ''
    if (!textShare) {
      throw new Error(`Line ${index + 1}: Text share is required`)
    }

    // Find Douyin URL in text share
    const douyinUrl = textShare.match(DOUYIN_URL_PATTERN)?.[0]
    if (!douyinUrl) {
      throw new Error(`Line ${index + 1}: No Douyin URL found in text share`)
    }

    // Extract other optional fields using destructuring with defaults
    const [, postContent = '', videoDesc = '', imageDesc = '', schedulePart = '', scheduledChannel = ''] = parts

    // Parse scheduled time if present and convert to datetime-local format (YYYY-MM-DDTHH:mm)
    let scheduledFor = ''
    if (schedulePart) {
      const scheduleMatch = schedulePart.match(/(\d{2}:\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})/)
      if (scheduleMatch) {
        const [, time, day, month, year] = scheduleMatch
        // Convert to datetime-local format: YYYY-MM-DDTHH:mm
        scheduledFor = `${year}-${month}-${day}T${time}`
      }
    }

    // Get parsed Douyin data
    let parsedData: ParsedDouyinData | null = null
    try {
      parsedData = await parseDouyinUrl(douyinUrl)
    } catch (err) {
      throw new Error(`Line ${index + 1}: Failed to parse Douyin URL - ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    return {
      id: Math.random().toString(36).substring(7),
      douyinUrl,
      parsedData,
      isParsing: false,
      parseError: '',
      postContent: postContent || undefined,
      videoDesc: videoDesc || undefined,
      imageDesc: imageDesc || undefined,
      scheduledFor: scheduledFor || undefined,
      scheduledChannel: scheduledFor ? scheduledChannel : undefined,
    }
  }

  const handleParseUrls = async () => {
    const lines = urlInput.split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      setError('No input provided. Please enter post data in the specified format.')
      return
    }

    // Parse all lines in parallel for better performance
    const parsePromises = lines.map(async (line, i) => {
      try {
        return await parseBulkPostLine(line, i)
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to parse line', index: i }
      }
    })

    const results = await Promise.all(parsePromises)

    // Separate successes and failures with proper type guards
    const errors: Array<{ error: string; index: number }> = []
    const validItems: BulkPostItem[] = []

    results.forEach((r) => {
      if ('error' in r) {
        errors.push(r)
      } else {
        validItems.push(r)
      }
    })

    if (errors.length > 0) {
      const errorMessages = errors.map(e => `Line ${e.index + 1}: ${e.error}`).join('\n')
      setError(`Failed to parse ${errors.length} line(s):\n${errorMessages}`)
      // Still process successful items
      if (validItems.length > 0) {
        setBulkPostItems(prev => isAddingUrls ? [...prev, ...validItems] : validItems)
        setUrlInput('')
      }
      setIsAddingUrls(false)
      return
    }

    // All succeeded - update state
    setBulkPostItems(prev => isAddingUrls ? [...prev, ...validItems] : validItems)
    setError('')
    setUrlInput('')
    setIsAddingUrls(false)
  }

  const handleRemoveItem = (id: string) => {
    setBulkPostItems(prev => prev.filter(i => i.id !== id))
  }

  const handleAddManualPost = () => {
    const newItem: BulkPostItem = {
      id: Math.random().toString(36).substring(7),
      douyinUrl: '',
      parsedData: null,
      isParsing: false,
      parseError: '',
    }
    setBulkPostItems(prev => [...prev, newItem])
  }

  const handleAddMoreUrls = () => {
    // Enter URL input mode while keeping existing posts
    setIsAddingUrls(true)
    setUrlInput('')
  }

  const handleCancel = () => {
    setBulkPostItems([])
    setUrlInput('')
    setIsAddingUrls(false)
    setError('')
    setSuccessMessage('')
  }

  const handleSubmitAll = async (formData: BulkPostFormData[]) => {
    setError('')
    setSuccessMessage('')

    const response = await fetch('/api/posts/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posts: formData,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to create posts')
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.message || 'Failed to create posts')
    }

    return data.data
  }

  const handleSuccess = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => {
      if (publishMode === 'schedule') {
        router.push('/posts/scheduled')
      } else {
        router.push('/channels')
      }
    }, 2000)
  }

  if (isLoadingChannels) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading channels...</p>
        </div>
      </div>
    )
  }

  const threadsChannels = channels.filter((ch) => ch.platform === PLATFORM.THREADS)

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Bulk Create Posts
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Create multiple posts from Douyin share links at once
          </p>
        </div>
      </div>

      <div>
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

        {threadsChannels.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mx-auto mb-4 text-6xl">🧵</div>
            <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              No Threads channels connected
            </h3>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Connect your Threads account first to publish posts
            </p>
            <Link
              href="/channels"
              className="inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Go to Channels
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {isAddingUrls || bulkPostItems.length === 0 ? (
              <BulkUrlInput
                urlInput={urlInput}
                onUrlChange={setUrlInput}
                onParse={handleParseUrls}
              />
            ) : (
              <BulkPostForm
                items={bulkPostItems}
                publishMode={publishMode}
                selectedChannel={selectedChannel}
                scheduledFor={scheduledFor}
                channels={threadsChannels}
                onRemoveItem={handleRemoveItem}
                onAddManualPost={handleAddManualPost}
                onAddMoreUrls={handleAddMoreUrls}
                onCancel={handleCancel}
                onSubmit={handleSubmitAll}
                onSuccess={handleSuccess}
                onError={setError}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
