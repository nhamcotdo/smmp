import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import type { ApiResponse } from '@/lib/types'

interface MediaListItem {
  id: string
  type: string
  filename: string
  url: string
  mimeType: string
  fileSize: number
  status: string
  createdAt: string
  updatedAt: string
  postId: string | null
}

interface MediaListResponse {
  media: MediaListItem[]
  total: number
}

interface MediaListQuery {
  type?: string
  status?: string
  page?: string
  limit?: string
}

/**
 * GET /api/media
 * List uploaded media for the authenticated user
 */
async function listMedia(request: Request, user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { userId: user.id }
    if (type) where.type = type
    if (status) where.status = status

    const [media, total] = await Promise.all([
      prisma.uploadedMedia.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.uploadedMedia.count({ where }),
    ])

    const response: MediaListResponse = {
      media: media.map((m) => ({
        id: m.id,
        type: m.type,
        filename: m.filename,
        url: m.url,
        mimeType: m.mimeType,
        fileSize: Number(m.fileSize),
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
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
