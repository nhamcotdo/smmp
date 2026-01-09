import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import { PLATFORM, POST_STATUS } from '@/lib/constants'
import { getOrBuildThreadsPostUrl } from '@/lib/services/threads.service'
import type { ApiResponse } from '@/lib/types'

interface SyncResponse {
  updated: number
  failed: number
}

/**
 * POST /api/analytics/sync-permalink
 * Sync permalinks for all published Threads posts
 */
async function syncPermalinks(request: Request, user: any) {
  try {
    // Find all Threads publications that don't have a permalink or have an old format URL
    const publications = await prisma.postPublication.findMany({
      where: {
        platform: PLATFORM.THREADS,
        status: POST_STATUS.PUBLISHED,
        platformPostId: { not: null },
        OR: [
          { platformPostUrl: null },
          { platformPostUrl: { contains: 'https://threads.net/' } },
        ],
      },
      include: {
        socialAccount: true,
      },
    })

    let updated = 0
    let failed = 0

    for (const publication of publications) {
      if (!publication.socialAccount || !publication.socialAccount.accessToken) {
        failed++
        continue
      }

      try {
        const permalink = await getOrBuildThreadsPostUrl(
          publication.socialAccount.accessToken,
          publication.platformPostId!,
          publication.socialAccount.username
        )

        await prisma.postPublication.update({
          where: { id: publication.id },
          data: { platformPostUrl: permalink },
        })
        updated++
      } catch (error) {
        console.error(`Failed to sync permalink for publication ${publication.id}:`, error)
        failed++
      }
    }

    return NextResponse.json({
      data: { updated, failed },
      status: 200,
      success: true,
      message: `Synced ${updated} permalinks, ${failed} failed`,
    } as unknown as ApiResponse<SyncResponse>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to sync permalinks',
      } as unknown as ApiResponse<SyncResponse>,
      { status: 500 }
    )
  }
}

export const POST = withAuth(syncPermalinks)
