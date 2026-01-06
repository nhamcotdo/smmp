import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'
import { getConnection } from '@/lib/db/connection'
import { User } from '@/database/entities/User.entity'
import { UploadedMedia } from '@/database/entities/UploadedMedia.entity'
import { MediaType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'
import { generatePresignedUrl, isR2Configured } from '@/lib/services/r2-presigned.service'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB for Threads API
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']

interface ProxyUploadResponse {
  url: string
  key: string
}

/**
 * POST /api/upload/proxy
 * Upload a file to R2 via server proxy (no CORS issues)
 * Server uploads to R2 and returns the public URL
 */
async function proxyUpload(request: Request, user: User) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'File is required',
        } as unknown as ApiResponse<ProxyUploadResponse>,
        { status: 400 }
      )
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        } as unknown as ApiResponse<ProxyUploadResponse>,
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: `Invalid file type. Allowed: ${[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(', ')}`,
        } as unknown as ApiResponse<ProxyUploadResponse>,
        { status: 400 }
      )
    }

    // Check if R2 is configured
    if (!isR2Configured()) {
      return NextResponse.json(
        {
          data: null,
          status: 500,
          success: false,
          message: 'R2 storage is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables.',
        } as unknown as ApiResponse<ProxyUploadResponse>,
        { status: 500 }
      )
    }

    // Generate unique key with timestamp and random string
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const extension = file.name.split('.').pop() || 'bin'
    const key = `uploads/${timestamp}-${randomStr}.${extension}`

    // Generate presigned URL for server-side upload (no CORS issues server-side)
    const presignedResult = await generatePresignedUrl(key, 3600)

    // Upload to R2 from server (no CORS)
    const arrayBuffer = await file.arrayBuffer()
    const uploadResponse = await fetch(presignedResult.url, {
      method: 'PUT',
      body: arrayBuffer,
      headers: {
        'Content-Type': file.type,
      },
    })

    if (!uploadResponse.ok) {
      throw new Error(`R2 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`)
    }

    // Get public URL
    const bucketName = process.env.R2_BUCKET_NAME
    const publicDomain = process.env.R2_PUBLIC_DOMAIN
    let publicUrl: string

    if (publicDomain) {
      publicUrl = `https://${publicDomain}/${key}`
    } else if (bucketName) {
      const accountId = process.env.R2_ACCOUNT_ID
      publicUrl = `https://pub-${bucketName}.${accountId}.r2.dev/${key}`
    } else {
      throw new Error('Either R2_PUBLIC_DOMAIN or R2_BUCKET_NAME must be set')
    }

    // Determine media type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type)
    const mediaType = isImage ? MediaType.IMAGE : MediaType.VIDEO

    // Save to database
    const dataSource = await getConnection()
    const uploadedMediaRepository = dataSource.getRepository(UploadedMedia)

    const uploadedMedia = uploadedMediaRepository.create({
      userId: user.id,
      type: mediaType,
      filename: file.name,
      url: publicUrl,
      r2Key: key,
      mimeType: file.type,
      fileSize: file.size,
      status: 'active',
    })
    await uploadedMediaRepository.save(uploadedMedia)

    return NextResponse.json({
      data: {
        url: publicUrl,
        key,
      },
      status: 200,
      success: true,
      message: 'File uploaded successfully',
    } as unknown as ApiResponse<ProxyUploadResponse>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload file',
      } as unknown as ApiResponse<ProxyUploadResponse>,
      { status: 500 }
    )
  }
}

export const POST = withAuth(proxyUpload)
