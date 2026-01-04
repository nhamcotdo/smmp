import { NextResponse, NextRequest } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getUserProfile,
} from '@/lib/services/threads.service'
import { validateState } from '@/lib/services/oauth-state.service'
import { Platform, AccountStatus, AccountHealth } from '@/database/entities/enums'

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

    // Check for OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/channels?error=${error}&reason=${errorReason || 'unknown'}`, request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/channels?error=no_code', request.url)
      )
    }

    // Validate state parameter to prevent CSRF attacks
    if (!state) {
      return NextResponse.redirect(
        new URL('/channels?error=invalid_state&hint=Missing+state+parameter', request.url)
      )
    }

    const userId = validateState(state)
    if (!userId) {
      return NextResponse.redirect(
        new URL('/channels?error=invalid_state&hint=Invalid+or+expired+state+parameter', request.url)
      )
    }

    // Exchange code for short-lived token
    const tokenResponse = await exchangeCodeForToken(code)
    const { access_token } = tokenResponse

    // Get long-lived token (valid for 60 days)
    const longLivedToken = await getLongLivedToken(access_token)

    // Get user profile from Threads using 'me' endpoint
    const profile = await getUserProfile(longLivedToken.access_token, 'me')

    const dataSource = await getConnection()
    const socialAccountRepository = dataSource.getRepository(SocialAccount)

    // Check if account already exists
    const existingAccount = await socialAccountRepository.findOne({
      where: {
        userId,
        platform: Platform.THREADS,
        platformUserId: profile.id,
      },
    })

    const tokenExpiresAt = new Date(Date.now() + longLivedToken.expires_in * 1000)

    if (existingAccount) {
      // Update existing account
      // Note: Threads uses the long-lived access_token as the refresh token
      await socialAccountRepository.update(existingAccount.id, {
        accessToken: longLivedToken.access_token,
        refreshToken: longLivedToken.access_token,
        tokenExpiresAt,
        status: AccountStatus.ACTIVE,
        username: profile.username,
        avatar: profile.threads_profile_picture_url,
        lastSyncedAt: new Date(),
      })
    } else {
      // Create new account
      // Note: Threads uses the long-lived access_token as the refresh token
      const newAccount = socialAccountRepository.create({
        userId,
        platform: Platform.THREADS,
        platformUserId: profile.id,
        username: profile.username,
        displayName: profile.username,
        avatar: profile.threads_profile_picture_url,
        accessToken: longLivedToken.access_token,
        refreshToken: longLivedToken.access_token,
        tokenExpiresAt,
        status: AccountStatus.ACTIVE,
        health: AccountHealth.HEALTHY,
        lastSyncedAt: new Date(),
      })
      await socialAccountRepository.save(newAccount)
    }

    // Redirect to channels page with success
    return NextResponse.redirect(
      new URL('/channels?success=threads_connected', request.url)
    )
  } catch (error) {
    console.error('Threads OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(
        `/channels?error=${encodeURIComponent(error instanceof Error ? error.message : 'Connection failed')}`,
        request.url
      )
    )
  }
}
