import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { PLATFORM, ACCOUNT_STATUS, ACCOUNT_HEALTH } from '@/lib/constants'
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getUserProfile,
} from '@/lib/services/threads.service'
import { validateState } from '@/lib/services/oauth-state.service'
import { getBaseUrl } from '@/lib/utils/url'

/**
 * GET /api/channels/threads/callback
 * Handle OAuth callback from Threads
 *
 * Query params: code, error, error_reason, state
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorReason = searchParams.get('error_reason')
    const state = searchParams.get('state')

    const baseUrl = getBaseUrl(request)

    // Check for OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/channels?error=${error}&reason=${errorReason || 'unknown'}`, baseUrl)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/channels?error=no_code', baseUrl)
      )
    }

    // Validate state parameter to prevent CSRF attacks
    if (!state) {
      return NextResponse.redirect(
        new URL('/channels?error=invalid_state&hint=Missing+state+parameter', baseUrl)
      )
    }

    const userId = validateState(state)
    if (!userId) {
      return NextResponse.redirect(
        new URL('/channels?error=invalid_state&hint=Invalid+or+expired+state+parameter', baseUrl)
      )
    }

    // Exchange code for short-lived token
    const tokenResponse = await exchangeCodeForToken(code)
    const { access_token } = tokenResponse

    // Get long-lived token (valid for 60 days)
    const longLivedToken = await getLongLivedToken(access_token)

    // Get user profile from Threads using 'me' endpoint
    const profile = await getUserProfile(longLivedToken.access_token, 'me')

    // Check if this specific Threads account (platformUserId) is already connected
    // Allows multiple Threads accounts per user, but prevents duplicate connections
    const existingAccount = await prisma.socialAccount.findFirst({
      where: {
        userId,
        platform: PLATFORM.THREADS,
        platformUserId: profile.id,
      },
    })

    const tokenExpiresAt = new Date(Date.now() + longLivedToken.expires_in * 1000)

    if (existingAccount) {
      // Update existing account
      // Note: Threads uses the long-lived access_token as the refresh token
      await prisma.socialAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: longLivedToken.access_token,
          refreshToken: longLivedToken.access_token,
          tokenExpiresAt,
          status: ACCOUNT_STATUS.ACTIVE,
          username: profile.username,
          avatar: profile.threads_profile_picture_url,
          lastSyncedAt: new Date(),
        },
      })
    } else {
      // Create new account
      // Note: Threads uses the long-lived access_token as the refresh token
      await prisma.socialAccount.create({
        data: {
          userId,
          platform: PLATFORM.THREADS,
          platformUserId: profile.id,
          username: profile.username,
          displayName: profile.username,
          avatar: profile.threads_profile_picture_url,
          accessToken: longLivedToken.access_token,
          refreshToken: longLivedToken.access_token,
          tokenExpiresAt,
          status: ACCOUNT_STATUS.ACTIVE,
          health: ACCOUNT_HEALTH.HEALTHY,
          lastSyncedAt: new Date(),
        },
      })
    }

    // Redirect to channels page with success
    return NextResponse.redirect(
      new URL('/channels?success=threads_connected', baseUrl)
    )
  } catch (error) {
    console.error('Threads OAuth callback error:', error)
    const baseUrl = getBaseUrl(request)
    return NextResponse.redirect(
      new URL(
        `/channels?error=${encodeURIComponent(error instanceof Error ? error.message : 'Connection failed')}`,
        baseUrl
      )
    )
  }
}
