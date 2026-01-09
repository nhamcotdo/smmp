import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import type { ApiResponse } from '@/lib/types'
import { deleteFromR2 } from '@/lib/services/r2-presigned.service'
import { UPLOADED_MEDIA_STATUS } from '@/lib/constants'

interface DeleteResponse {
  deleted: boolean
}

/**
 * DELETE /api/media/:id
 * Delete an uploaded media from R2 and mark as deleted in database
 */
async function deleteMedia(
  request: Request,
  user: any,
  context?: { params: Promise<Record<string, string>> },
) {
  try {
    const { id } = await context?.params ?? {}
    if (!id) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Media ID is required',
        } as unknown as ApiResponse<DeleteResponse>,
        { status: 400 }
      )
    }

    // Find media belonging to user
    const media = await prisma.uploadedMedia.findFirst({
      where: { id, userId: user.id },
    })

    if (!media) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Media not found',
        } as unknown as ApiResponse<DeleteResponse>,
        { status: 404 }
      )
    }

    // Check if already deleted
    if (media.status === UPLOADED_MEDIA_STATUS.DELETED) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Media already deleted',
        } as unknown as ApiResponse<DeleteResponse>,
        { status: 400 }
      )
    }

    // Delete from R2
    if (media.r2Key && media.status === UPLOADED_MEDIA_STATUS.ACTIVE) {
      try {
        await deleteFromR2(media.r2Key)
      } catch (error) {
        console.error('Failed to delete from R2:', error)
        // Continue to mark as deleted in database even if R2 delete fails
      }
    }

    // Mark as deleted in database
    await prisma.uploadedMedia.update({
      where: { id },
      data: {
        status: UPLOADED_MEDIA_STATUS.DELETED,
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({
      data: { deleted: true },
      status: 200,
      success: true,
      message: 'Media deleted successfully',
    } as unknown as ApiResponse<DeleteResponse>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete media',
      } as unknown as ApiResponse<DeleteResponse>,
      { status: 500 }
    )
  }
}

export const DELETE = withAuth(deleteMedia)
