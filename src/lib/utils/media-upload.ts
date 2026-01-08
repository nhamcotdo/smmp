import type { CarouselMediaItem, ScheduledComment } from '@/lib/types/posts'

export async function uploadMediaFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/upload/proxy', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.message || 'File upload failed')
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.message || 'File upload failed')
  }

  return data.data.url
}

export async function uploadCarouselMediaItems(
  items: CarouselMediaItem[]
): Promise<Array<{ type: 'image' | 'video'; url: string; altText?: string }>> {
  const finalCarouselMedia: Array<{ type: 'image' | 'video'; url: string; altText?: string }> = []

  for (const item of items) {
    let finalUrl = item.url

    if (item.file) {
      finalUrl = await uploadMediaFile(item.file)
    }

    finalCarouselMedia.push({
      type: item.type,
      url: finalUrl,
      altText: item.altText || undefined,
    })
  }

  return finalCarouselMedia
}

export async function uploadScheduledCommentMedia(
  comments: ScheduledComment[]
): Promise<Array<{ content: string; delayMinutes: number; imageUrl?: string; videoUrl?: string }>> {
  const finalComments: Array<{ content: string; delayMinutes: number; imageUrl?: string; videoUrl?: string }> = []

  for (const comment of comments) {
    let mediaUrl: string | undefined = undefined

    if (comment.mediaFile) {
      mediaUrl = await uploadMediaFile(comment.mediaFile)
    }

    finalComments.push({
      content: comment.content.trim(),
      delayMinutes: comment.delayMinutes,
      ...(comment.mediaType === 'image' && mediaUrl ? { imageUrl: mediaUrl } : {}),
      ...(comment.mediaType === 'video' && mediaUrl ? { videoUrl: mediaUrl } : {}),
    })
  }

  return finalComments
}
