import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { getOrBuildThreadsPostUrl } from '@/lib/services/threads.service'
import { Platform, PostStatus } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'

interface SyncResponse {
  updated: number
  failed: number
}

/**
 * POST /api/analytics/sync-permalink
 * Sync permalinks for all published Threads posts
 */
async function syncPermalinks(request: Request, user: User) {
  try {
    const dataSource = await getConnection()
    const postPublicationRepository = dataSource.getRepository(PostPublication)
    const socialAccountRepository = dataSource.getRepository(SocialAccount)

    // Find all Threads publications that don't have a permalink or have an old format URL
    const publications = await postPublicationRepository
      .createQueryBuilder('publication')
      .leftJoinAndSelect('publication.socialAccount', 'socialAccount')
      .where('publication.platform = :platform', { platform: Platform.THREADS })
      .andWhere('publication.status = :status', { status: PostStatus.PUBLISHED })
      .andWhere('(publication.platformPostUrl IS NULL OR publication.platformPostUrl LIKE :oldPattern)', {
        oldPattern: 'https://threads.net/%',
      })
      .andWhere('publication.platformPostId IS NOT NULL')
      .getMany()

    let updated = 0
    let failed = 0

    for (const publication of publications) {
      if (!publication.socialAccount) {
        failed++
        continue
      }

      try {
        const permalink = await getOrBuildThreadsPostUrl(
          publication.socialAccount.accessToken,
          publication.platformPostId,
          publication.socialAccount.username
        )

        publication.platformPostUrl = permalink
        await postPublicationRepository.save(publication)
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
