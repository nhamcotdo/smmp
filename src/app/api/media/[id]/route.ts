import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import { User } from '@/database/entities/User.entity'
import { UploadedMedia } from '@/database/entities/UploadedMedia.entity'
import type { ApiResponse } from '@/lib/types'
import { deleteFromR2 } from '@/lib/services/r2-presigned.service'

interface DeleteResponse {
  deleted: boolean
}

/**
 * DELETE /api/media/:id
 * Delete an uploaded media from R2 and mark as deleted in database
 */
async function deleteMedia(
  request: Request,
  user: User,
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

    const dataSource = await getConnection()
    const uploadedMediaRepository = dataSource.getRepository(UploadedMedia)

    // Find media belonging to user
    const media = await uploadedMediaRepository.findOne({
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
    if (media.status === 'deleted') {
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
    if (media.r2Key && media.status === 'active') {
      try {
        await deleteFromR2(media.r2Key)
      } catch (error) {
        console.error('Failed to delete from R2:', error)
        // Continue to mark as deleted in database even if R2 delete fails
      }
    }

    // Mark as deleted in database
    media.status = 'deleted'
    media.deletedAt = new Date()
    await uploadedMediaRepository.save(media)

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
