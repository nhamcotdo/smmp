import { NextResponse } from 'next/server'
import { parseDouyinUrl } from '@/lib/services/douyin.service'
import type { ApiResponse } from '@/lib/types'

interface ParseRequest {
  url: string
}

/**
 * POST /api/parse/douyin
 * Parse Douyin URL and extract download URL
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as ParseRequest
    const { url } = body

    if (!url?.trim()) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'URL is required',
        } as unknown as ApiResponse<never>,
        { status: 400 }
      )
    }

    const result = await parseDouyinUrl(url)

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: result.error || 'Failed to parse Douyin URL',
        } as unknown as ApiResponse<never>,
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: {
        type: result.data.type,
        downloadUrl: result.data.downloadUrl,
        imageUrl: result.data.imageUrl,
        videoDesc: result.data.videoDesc,
      },
      status: 200,
      success: true,
      message: 'Douyin URL parsed successfully',
    } as unknown as ApiResponse<{
      type: 'video' | 'image'
      downloadUrl: string
      imageUrl: string[]
      videoDesc: string
    }>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to parse Douyin URL',
      } as unknown as ApiResponse<never>,
      { status: 500 }
    )
  }
}
