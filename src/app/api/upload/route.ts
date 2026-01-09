import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'
import type { ApiResponse } from '@/lib/types'
import { generatePresignedUrl, getPublicUrlForKey, isR2Configured } from '@/lib/services/r2-presigned.service'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB for Threads API
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']

interface PresignedUrlResponse {
  uploadUrl: string
  key: string
  expiresIn: number
  expiresAt: string
}

interface PresignedUrlRequest extends FormData {
  get(name: 'filename'): File | null
  get(name: 'contentType'): string | null
  get(name: 'fileSize'): string | null
}

/**
 * POST /api/upload
 * Generate a presigned URL for direct upload to R2 storage
 * Client uploads directly to R2 using the presigned URL
 */
async function generateUploadUrl(request: Request, user: any) {
  try {
    const formData = await request.formData()
    const filename = formData.get('filename')
    const contentType = formData.get('contentType')
    const fileSizeStr = formData.get('fileSize')

    // Validate filename is a string
    if (typeof filename !== 'string') {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Filename is required and must be a string',
        } as unknown as ApiResponse<PresignedUrlResponse>,
        { status: 400 }
      )
    }

    // Validate contentType is a string if provided
    if (contentType !== null && typeof contentType !== 'string') {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'ContentType must be a string if provided',
        } as unknown as ApiResponse<PresignedUrlResponse>,
        { status: 400 }
      )
    }

    // Validate file size if provided
    if (fileSizeStr !== null) {
      if (typeof fileSizeStr !== 'string') {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: 'FileSize must be a string if provided',
          } as unknown as ApiResponse<PresignedUrlResponse>,
          { status: 400 }
        )
      }

      const fileSize = parseInt(fileSizeStr, 10)
      if (isNaN(fileSize)) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: 'FileSize must be a valid number',
          } as unknown as ApiResponse<PresignedUrlResponse>,
          { status: 400 }
        )
      }

      if (fileSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          } as unknown as ApiResponse<PresignedUrlResponse>,
          { status: 400 }
        )
      }
    }

    // Check if R2 is configured
    if (!isR2Configured()) {
      return NextResponse.json(
        {
          data: null,
          status: 500,
          success: false,
          message: 'R2 storage is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables.',
        } as unknown as ApiResponse<PresignedUrlResponse>,
        { status: 500 }
      )
    }

    // Validate file type if provided
    if (contentType) {
      if (!ALLOWED_IMAGE_TYPES.includes(contentType) && !ALLOWED_VIDEO_TYPES.includes(contentType)) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: `Invalid file type. Allowed: ${[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(', ')}`,
          } as unknown as ApiResponse<PresignedUrlResponse>,
          { status: 400 }
        )
      }
    }

    // Generate unique key with timestamp and random string
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const extension = filename.split('.').pop() || 'bin'
    const key = `uploads/${timestamp}-${randomStr}.${extension}`

    // Generate presigned URL (valid for 1 hour)
    const expiresIn = 3600 // 1 hour
    const presignedResult = await generatePresignedUrl(key, expiresIn)

    // Get public URL that the file will be accessible at
    const publicUrl = getPublicUrlForKey(key)

    return NextResponse.json({
      data: {
        uploadUrl: presignedResult.url,
        key: presignedResult.key,
        expiresIn,
        expiresAt: presignedResult.expiresAt.toISOString(),
        publicUrl,
      },
      status: 200,
      success: true,
      message: 'Presigned URL generated successfully',
    } as unknown as ApiResponse<PresignedUrlResponse & { publicUrl: string }>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate upload URL',
      } as unknown as ApiResponse<PresignedUrlResponse>,
      { status: 500 }
    )
  }
}

export const POST = withAuth(generateUploadUrl)
