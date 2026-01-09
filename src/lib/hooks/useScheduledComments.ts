import { useState, useCallback } from 'react'
import type { ScheduledComment } from '@/lib/types/posts'
import { useBlobCleanup } from './useBlobCleanup'

interface UseScheduledCommentsProps {
  initialComments?: Array<{ content: string; delayMinutes: number }>
  onError?: (error: string) => void
}

interface UseScheduledCommentsReturn {
  scheduledComments: ScheduledComment[]
  addScheduledComment: () => void
  removeScheduledComment: (id: string) => void
  updateScheduledComment: (id: string, field: 'content' | 'delayMinutes', value: string | number) => void
  handleCommentMediaSelect: (commentId: string, e: React.ChangeEvent<HTMLInputElement>) => void
  removeCommentMedia: (commentId: string) => void
  setScheduledComments: React.Dispatch<React.SetStateAction<ScheduledComment[]>>
}

export function useScheduledComments({ initialComments = [], onError }: UseScheduledCommentsProps = {}): UseScheduledCommentsReturn {
  const [scheduledComments, setScheduledComments] = useState<ScheduledComment[]>(
    initialComments.map(comment => ({
      id: Math.random().toString(36).substring(7),
      content: comment.content,
      delayMinutes: comment.delayMinutes,
    }))
  )
  const { revokeBlobUrl } = useBlobCleanup()

  const addScheduledComment = useCallback(() => {
    setScheduledComments(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      content: '',
      delayMinutes: 0,
    }])
  }, [])

  const removeScheduledComment = useCallback((id: string) => {
    setScheduledComments(prev => {
      const comment = prev.find(c => c.id === id)
      if (comment?.mediaPreview) {
        revokeBlobUrl(comment.mediaPreview)
      }
      return prev.filter(c => c.id !== id)
    })
  }, [revokeBlobUrl])

  const updateScheduledComment = useCallback((id: string, field: 'content' | 'delayMinutes', value: string | number) => {
    if (field === 'delayMinutes') {
      const numValue = typeof value === 'string' ? parseInt(value, 10) : value
      if (isNaN(numValue) || numValue < 0) {
        onError?.(`Invalid delay minutes: ${value}. Using 0 instead.`)
        value = 0
      }
    }

    setScheduledComments(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }, [onError])

  const handleCommentMediaSelect = useCallback((commentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      return
    }

    const preview = URL.createObjectURL(file)

    setScheduledComments(prev => prev.map(c => {
      if (c.id === commentId) {
        if (c.mediaPreview) {
          revokeBlobUrl(c.mediaPreview)
        }
        return {
          ...c,
          mediaFile: file,
          mediaPreview: preview,
          mediaType: isImage ? 'image' : 'video',
        }
      }
      return c
    }))
  }, [revokeBlobUrl])

  const removeCommentMedia = useCallback((commentId: string) => {
    setScheduledComments(prev => prev.map(c => {
      if (c.id === commentId) {
        if (c.mediaPreview) {
          revokeBlobUrl(c.mediaPreview)
        }
        return {
          ...c,
          mediaFile: undefined,
          mediaPreview: undefined,
          mediaType: undefined,
        }
      }
      return c
    }))
  }, [revokeBlobUrl])

  return {
    scheduledComments,
    addScheduledComment,
    removeScheduledComment,
    updateScheduledComment,
    handleCommentMediaSelect,
    removeCommentMedia,
    setScheduledComments,
  }
}
