import { NextResponse } from 'next/server'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { getAuthorizationUrl } from '@/lib/services/threads.service'
import { createState } from '@/lib/services/oauth-state.service'
import type { ApiResponse } from '@/lib/types'

interface ConnectUrlResponse {
  url: string
}

/**
 * GET /api/channels/threads/connect
 * Get the Threads OAuth authorization URL
 */
async function getConnectUrl(_request: Request, user: User) {
  try {
    // Generate and store state token for CSRF protection
    const state = createState(user.id)

    const url = getAuthorizationUrl(
      [
        'threads_basic',
        'threads_content_publish',
        'threads_manage_insights',
        'threads_delete',
        'threads_keyword_search',
        'threads_location_tagging',
        'threads_manage_mentions',
        'threads_manage_replies',
        'threads_read_replies'
      ],
      state
    )

    return NextResponse.json({
      data: { url },
      status: 200,
      success: true,
      message: 'Authorization URL generated',
    } as unknown as ApiResponse<ConnectUrlResponse>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate authorization URL',
      } as unknown as ApiResponse<ConnectUrlResponse>,
      { status: 500 }
    )
  }
}

export const GET = withAuth(getConnectUrl)
