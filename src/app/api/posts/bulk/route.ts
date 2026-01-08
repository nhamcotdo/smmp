import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { Media } from '@/database/entities/Media.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { PostStatus, ContentType, MediaType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'
import type { BulkPostFormData, PostContentType } from '@/lib/types/posts'
import { CAROUSEL, SCHEDULED_COMMENTS, TIMEZONE } from '@/lib/constants'
import { validateMediaUrl, getOwnHostname, detectMimeTypeFromUrl } from '@/lib/utils/content-parser'

interface BulkCreateRequest {
  posts: BulkPostFormData[]
}

interface BulkCreateResponse {
  created: number
  failed: number
  errors: Array<{ index: number; error: string }>
}

// Convert PostContentType to ContentType enum
function convertToContentType(contentType: PostContentType, hasImage: boolean, hasVideo: boolean): ContentType {
  if (contentType === 'carousel') return ContentType.CAROUSEL
  if (hasImage) return ContentType.IMAGE
  if (hasVideo) return ContentType.VIDEO
  return ContentType.TEXT
}

async function bulkCreatePosts(request: Request, user: User) {
  try {
    const body = await request.json() as BulkCreateRequest
    const { posts } = body

    if (!posts || posts.length === 0) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'At least one post is required',
        } as unknown as ApiResponse<BulkCreateResponse>,
        { status: 400 }
      )
    }

    const dataSource = await getConnection()
    const postRepository = dataSource.getRepository(Post)
    const mediaRepository = dataSource.getRepository(Media)
    const ownHostname = getOwnHostname()

    const results: BulkCreateResponse = {
      created: 0,
      failed: 0,
      errors: [],
    }

    // Process each post
    for (let i = 0; i < posts.length; i++) {
      const postData = posts[i]

      try {
        const {
          content,
          contentType,
          publishMode,
          socialAccountId,
          scheduledFor,
          imageUrl,
          videoUrl,
          altText,
          carouselMediaItems,
          threadsOptions,
          scheduledComments
        } = postData

        // Validate content or media
        if (!content?.trim() && !imageUrl && !videoUrl && !carouselMediaItems) {
          results.failed++
          results.errors.push({ index: i, error: 'Content or media is required' })
          continue
        }

        // Determine content type - convert from PostContentType to ContentType enum
        const finalContentType = convertToContentType(
          contentType,
          !!imageUrl,
          !!videoUrl
        )

        // Validate carousel
        if (finalContentType === ContentType.CAROUSEL) {
          if (!carouselMediaItems || carouselMediaItems.length < CAROUSEL.MIN_ITEMS) {
            results.failed++
            results.errors.push({ index: i, error: `Carousel must have at least ${CAROUSEL.MIN_ITEMS} items` })
            continue
          }
          if (carouselMediaItems.length > CAROUSEL.MAX_ITEMS) {
            results.failed++
            results.errors.push({ index: i, error: `Carousel cannot have more than ${CAROUSEL.MAX_ITEMS} items` })
            continue
          }
        }

        // Validate media URLs are publicly accessible (Threads API requirement)
        if (imageUrl) {
          const imageValidation = validateMediaUrl(imageUrl, {
            allowOwnHost: true,
            ownHostname,
          })
          if (!imageValidation.valid) {
            results.failed++
            results.errors.push({ index: i, error: `Invalid image URL: ${imageValidation.error}. Use a publicly accessible URL or upload via the form.` })
            continue
          }
        }

        if (videoUrl) {
          const videoValidation = validateMediaUrl(videoUrl, {
            allowOwnHost: true,
            ownHostname,
          })
          if (!videoValidation.valid) {
            results.failed++
            results.errors.push({ index: i, error: `Invalid video URL: ${videoValidation.error}. Use a publicly accessible URL or upload via the form.` })
            continue
          }
        }

        // Validate carousel media URLs
        if (carouselMediaItems) {
          for (const item of carouselMediaItems) {
            const validation = validateMediaUrl(item.url, {
              allowOwnHost: true,
              ownHostname,
            })
            if (!validation.valid) {
              results.failed++
              results.errors.push({ index: i, error: `Invalid ${item.type} URL in carousel: ${validation.error}. Use a publicly accessible URL or upload via the form.` })
              break
            }
          }
          if (results.errors.some(e => e.index === i)) continue
        }

        // Validate schedule mode settings
        let scheduledAtUTC: Date | undefined = undefined
        if (publishMode === 'schedule') {
          if (!scheduledFor) {
            results.failed++
            results.errors.push({ index: i, error: 'Scheduled date is required for schedule mode' })
            continue
          }

          const scheduledDate = new Date(scheduledFor)
          if (isNaN(scheduledDate.getTime())) {
            results.failed++
            results.errors.push({ index: i, error: 'Invalid date format' })
            continue
          }
          if (scheduledDate <= new Date()) {
            results.failed++
            results.errors.push({ index: i, error: 'Scheduled date must be in the future' })
            continue
          }
          scheduledAtUTC = new Date(scheduledDate.getTime() - TIMEZONE.UTC7_OFFSET_HOURS * 60 * 60 * 1000)
        }

        // Validate publish now mode settings
        if (publishMode === 'now' && !socialAccountId) {
          results.failed++
          results.errors.push({ index: i, error: 'Channel is required for publish now mode' })
          continue
        }

        // Validate and create post
        const post = postRepository.create({
          userId: user.id,
          content: content?.trim() || '',
          status: publishMode === 'schedule' ? PostStatus.SCHEDULED : PostStatus.DRAFT,
          contentType: finalContentType,
          isScheduled: publishMode === 'schedule',
          scheduledAt: scheduledAtUTC,
          socialAccountId: socialAccountId || null,
          metadata: threadsOptions ? { threads: threadsOptions } : undefined,
        })

        const savedPost = await postRepository.save(post)

        // Create media records
        if (finalContentType === ContentType.CAROUSEL && carouselMediaItems) {
          for (let j = 0; j < carouselMediaItems.length; j++) {
            const item = carouselMediaItems[j]
            const detectedMimeType = detectMimeTypeFromUrl(item.url)
            const media = mediaRepository.create({
              postId: savedPost.id,
              type: item.type === 'image' ? MediaType.IMAGE : MediaType.VIDEO,
              url: item.url,
              altText: item.altText || undefined,
              mimeType: detectedMimeType || (item.type === 'image' ? 'image/jpeg' : 'video/mp4'),
              order: j,
            })
            await mediaRepository.save(media)
          }
        } else if (imageUrl || videoUrl) {
          const mediaUrl = imageUrl || videoUrl || ''
          const detectedMimeType = detectMimeTypeFromUrl(mediaUrl)
          const media = mediaRepository.create({
            postId: savedPost.id,
            type: finalContentType === ContentType.IMAGE ? MediaType.IMAGE : MediaType.VIDEO,
            url: mediaUrl,
            altText: altText || undefined,
            mimeType: detectedMimeType || (finalContentType === ContentType.IMAGE ? 'image/jpeg' : 'video/mp4'),
            order: 0,
          })
          await mediaRepository.save(media)
        }

        // Create scheduled comments if provided
        if (scheduledComments && scheduledComments.length > 0) {
          if (scheduledComments.length > SCHEDULED_COMMENTS.MAX_ALLOWED) {
            await postRepository.delete(savedPost.id)
            results.failed++
            results.errors.push({ index: i, error: `Maximum ${SCHEDULED_COMMENTS.MAX_ALLOWED} comments allowed` })
            continue
          }

          try {
            await dataSource.transaction(async (transactionalEntityManager) => {
              for (const comment of scheduledComments) {
                const baseTime = scheduledAtUTC ? scheduledAtUTC.getTime() : Date.now()
                const commentScheduledAt = new Date(baseTime + comment.delayMinutes * 60 * 1000)

                let commentContentType = ContentType.TEXT
                if (comment.imageUrl) {
                  commentContentType = ContentType.IMAGE
                } else if (comment.videoUrl) {
                  commentContentType = ContentType.VIDEO
                }

                const childPost = postRepository.create({
                  userId: user.id,
                  parentPostId: savedPost.id,
                  content: comment.content?.trim() || '',
                  status: PostStatus.SCHEDULED,
                  contentType: commentContentType,
                  isScheduled: true,
                  scheduledAt: commentScheduledAt,
                  socialAccountId: socialAccountId || null,
                  commentDelayMinutes: comment.delayMinutes,
                })
                await transactionalEntityManager.save(childPost)

                if (comment.imageUrl || comment.videoUrl) {
                  const commentMediaUrl = comment.imageUrl || comment.videoUrl || ''
                  const detectedMimeType = detectMimeTypeFromUrl(commentMediaUrl)
                  const media = mediaRepository.create({
                    postId: childPost.id,
                    type: commentContentType === ContentType.IMAGE ? MediaType.IMAGE : MediaType.VIDEO,
                    url: commentMediaUrl,
                    altText: comment.altText || undefined,
                    mimeType: detectedMimeType || (commentContentType === ContentType.IMAGE ? 'image/jpeg' : 'video/mp4'),
                    order: 0,
                  })
                  await transactionalEntityManager.save(media)
                }
              }
            })
          } catch (transactionError) {
            await postRepository.delete(savedPost.id)
            throw transactionError
          }
        }

        results.created++
      } catch (postError) {
        results.failed++
        results.errors.push({
          index: i,
          error: postError instanceof Error ? postError.message : 'Failed to create post'
        })
      }
    }

    return NextResponse.json({
      data: results,
      status: results.failed === 0 ? 201 : 207, // 207 for multi-status
      success: true,
      message: results.failed === 0
        ? `Successfully created ${results.created} posts`
        : `Created ${results.created} posts, ${results.failed} failed`,
    } as unknown as ApiResponse<BulkCreateResponse>, {
      status: results.failed === 0 ? 201 : 207
    })
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create posts',
      } as unknown as ApiResponse<BulkCreateResponse>,
      { status: 500 }
    )
  }
}

export const POST = withAuth(bulkCreatePosts)
