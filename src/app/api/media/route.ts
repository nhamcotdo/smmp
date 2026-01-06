import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import { User } from '@/database/entities/User.entity'
import { UploadedMedia } from '@/database/entities/UploadedMedia.entity'
import { MediaType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'

interface MediaListItem {
  id: string
  type: MediaType
  filename: string
  url: string
  mimeType: string
  fileSize: number
  status: 'active' | 'deleted' | 'expired'
  createdAt: string
  postId: string | null
}

interface MediaListResponse {
  media: MediaListItem[]
  total: number
}

interface MediaListQuery {
  type?: MediaType
  status?: 'active' | 'deleted' | 'expired'
  page?: string
  limit?: string
}

/**
 * GET /api/media
 * List uploaded media for the authenticated user
 */
async function listMedia(request: Request, user: User) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as MediaType | null
    const status = searchParams.get('status') as 'active' | 'deleted' | 'expired' | null
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    const dataSource = await getConnection()
    const uploadedMediaRepository = dataSource.getRepository(UploadedMedia)

    const where: Record<string, unknown> = { userId: user.id }
    if (type) where.type = type
    if (status) where.status = status

    const [media, total] = await uploadedMediaRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    })

    const response: MediaListResponse = {
      media: media.map((m) => ({
        id: m.id,
        type: m.type,
        filename: m.filename,
        url: m.url,
        mimeType: m.mimeType,
        fileSize: m.fileSize,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        postId: m.postId || null,
      })),
      total,
    }

    return NextResponse.json({
      data: response,
      status: 200,
      success: true,
      message: 'Media retrieved successfully',
    } as unknown as ApiResponse<MediaListResponse>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve media',
      } as unknown as ApiResponse<MediaListResponse>,
      { status: 500 }
    )
  }
}

export const GET = withAuth(listMedia)
