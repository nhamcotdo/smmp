import { NextResponse } from 'next/server'
import { runScheduledPostPublisher } from '@/lib/jobs/publish-scheduled-posts'
import type { ApiResponse } from '@/lib/types'

interface PublisherResponse {
  success: boolean
  processed: number
  succeeded: number
  failed: number
  missed: number
  results: Array<{
    postId: string
    success: boolean
    error?: string
    platformPostId?: string
    platformUrl?: string
  }>
}

/**
 * POST /api/jobs/publish-scheduled
 * Run the scheduled post publisher
 *
 * This endpoint should be called by a cron job every 5 minutes.
 * Can use services like cron-job.org, GitHub Actions, or EasyCron.
 *
 * Example cron schedule: every 5 minutes
 *
 * Authentication: Use CRON_SECRET environment variable as Bearer token
 */
export async function POST(request: Request) {
  // Verify cron secret for security
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const providedSecret = authHeader?.replace('Bearer ', '')

    if (providedSecret !== cronSecret) {
      return NextResponse.json(
        {
          data: null,
          status: 401,
          success: false,
          message: 'Unauthorized',
        } as unknown as ApiResponse<PublisherResponse>,
        { status: 401 }
      )
    }
  }
  try {
    const result = await runScheduledPostPublisher()

    return NextResponse.json({
      data: result,
      status: result.success ? 200 : 500,
      success: result.success,
      message: result.success
        ? `Processed ${result.processed} scheduled posts: ${result.succeeded} succeeded, ${result.failed} failed`
        : 'Failed to process scheduled posts',
    } as unknown as ApiResponse<PublisherResponse>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to run scheduled post publisher',
      } as unknown as ApiResponse<PublisherResponse>,
      { status: 500 }
    )
  }
}
