import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import type { ApiResponse } from '@/lib/types'
import type { BulkPostFormData, PostContentType } from '@/lib/types/posts'
import type { ContentType } from '@prisma/client'
import { CAROUSEL, SCHEDULED_COMMENTS, TIMEZONE, POST_STATUS, CONTENT_TYPE, MEDIA_TYPE } from '@/lib/constants'
import { validateMediaUrl, getOwnHostname, detectMimeTypeFromUrl } from '@/lib/utils/content-parser'

interface BulkCreateRequest {
  posts: BulkPostFormData[]
}

interface BulkCreateResponse {
  created: number
  failed: number
  errors: Array<{ index: number; error: string }>
}

// Convert PostContentType to ContentType
function convertToContentType(contentType: PostContentType, hasImage: boolean, hasVideo: boolean): ContentType {
  if (contentType === 'carousel') return CONTENT_TYPE.CAROUSEL as ContentType
  if (hasImage) return CONTENT_TYPE.IMAGE as ContentType
  if (hasVideo) return CONTENT_TYPE.VIDEO as ContentType
  return CONTENT_TYPE.TEXT as ContentType
}

async function bulkCreatePosts(request: Request, user: any) {
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

        // Determine content type - convert from PostContentType to string
        const finalContentType = convertToContentType(
          contentType,
          !!imageUrl,
          !!videoUrl
        )

        // Validate carousel
        if (finalContentType === CONTENT_TYPE.CAROUSEL) {
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
        const savedPost = await prisma.post.create({
          data: {
            userId: user.id,
            content: content?.trim() || '',
            status: publishMode === 'schedule' ? POST_STATUS.SCHEDULED : POST_STATUS.DRAFT,
            contentType: finalContentType,
            isScheduled: publishMode === 'schedule',
            scheduledAt: scheduledAtUTC,
            socialAccountId: socialAccountId || null,
            metadata: threadsOptions ? { threads: threadsOptions } as any : undefined,
          },
        })

        // Create media records
        if (finalContentType === CONTENT_TYPE.CAROUSEL && carouselMediaItems) {
          for (let j = 0; j < carouselMediaItems.length; j++) {
            const item = carouselMediaItems[j]
            const detectedMimeType = detectMimeTypeFromUrl(item.url)
            await prisma.media.create({
              data: {
                postId: savedPost.id,
                type: item.type === 'image' ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
                url: item.url,
                altText: item.altText || undefined,
                mimeType: detectedMimeType || (item.type === 'image' ? 'image/jpeg' : 'video/mp4'),
                order: j,
              },
            })
          }
        } else if (imageUrl || videoUrl) {
          const mediaUrl = imageUrl || videoUrl || ''
          const detectedMimeType = detectMimeTypeFromUrl(mediaUrl)
          await prisma.media.create({
            data: {
              postId: savedPost.id,
              type: finalContentType === CONTENT_TYPE.IMAGE ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
              url: mediaUrl,
              altText: altText || undefined,
              mimeType: detectedMimeType || (finalContentType === CONTENT_TYPE.IMAGE ? 'image/jpeg' : 'video/mp4'),
              order: 0,
            },
          })
        }

        // Create scheduled comments if provided
        if (scheduledComments && scheduledComments.length > 0) {
          if (scheduledComments.length > SCHEDULED_COMMENTS.MAX_ALLOWED) {
            await prisma.post.delete({ where: { id: savedPost.id } })
            results.failed++
            results.errors.push({ index: i, error: `Maximum ${SCHEDULED_COMMENTS.MAX_ALLOWED} comments allowed` })
            continue
          }

          try {
            await prisma.$transaction(async (tx) => {
              for (const comment of scheduledComments) {
                const baseTime = scheduledAtUTC ? scheduledAtUTC.getTime() : Date.now()
                const commentScheduledAt = new Date(baseTime + comment.delayMinutes * 60 * 1000)

                let commentContentType: ContentType = CONTENT_TYPE.TEXT as ContentType
                if (comment.imageUrl) {
                  commentContentType = CONTENT_TYPE.IMAGE as ContentType
                } else if (comment.videoUrl) {
                  commentContentType = CONTENT_TYPE.VIDEO as ContentType
                }

                const childPost = await tx.post.create({
                  data: {
                    userId: user.id,
                    parentPostId: savedPost.id,
                    content: comment.content?.trim() || '',
                    status: POST_STATUS.SCHEDULED,
                    contentType: commentContentType,
                    isScheduled: true,
                    scheduledAt: commentScheduledAt,
                    socialAccountId: socialAccountId || null,
                    commentDelayMinutes: comment.delayMinutes,
                  },
                })

                if (comment.imageUrl || comment.videoUrl) {
                  const commentMediaUrl = comment.imageUrl || comment.videoUrl || ''
                  const detectedMimeType = detectMimeTypeFromUrl(commentMediaUrl)
                  await tx.media.create({
                    data: {
                      postId: childPost.id,
                      type: commentContentType === CONTENT_TYPE.IMAGE ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
                      url: commentMediaUrl,
                      altText: comment.altText || undefined,
                      mimeType: detectedMimeType || (commentContentType === CONTENT_TYPE.IMAGE ? 'image/jpeg' : 'video/mp4'),
                      order: 0,
                    },
                  })
                }
              }
            })
          } catch (transactionError) {
            await prisma.post.delete({ where: { id: savedPost.id } })
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
