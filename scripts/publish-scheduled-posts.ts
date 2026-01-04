#!/usr/bin/env node
/**
 * Scheduled Posts Publisher Script
 *
 * This script publishes posts that are scheduled and due.
 * Run this via cron job (every 5 minutes recommended).
 *
 * Usage:
 *   node scripts/publish-scheduled-posts.ts
 *
 * Or with tsx:
 *   npx tsx scripts/publish-scheduled-posts.ts
 */

import 'dotenv/config'
import 'reflect-metadata'
import { runScheduledPostPublisher } from '../src/lib/jobs/publish-scheduled-posts'

async function main() {
  const startTime = Date.now()
  console.log('='.repeat(50))
  console.log(`Scheduled Posts Publisher - ${new Date(startTime).toISOString()}`)
  console.log('='.repeat(50))

  try {
    const result = await runScheduledPostPublisher()

    const duration = Date.now() - startTime
    console.log('='.repeat(50))
    console.log('Summary:')
    console.log(`  Duration: ${duration}ms`)
    console.log(`  Processed: ${result.processed}`)
    console.log(`  Succeeded: ${result.succeeded}`)
    console.log(`  Failed: ${result.failed}`)
    console.log(`  Missed: ${result.missed}`)
    console.log('='.repeat(50))

    if (result.results && result.results.length > 0) {
      console.log('\nDetails:')
      for (const r of result.results) {
        if (r.success) {
          console.log(`  ✅ Post ${r.postId}: ${r.platformUrl}`)
        } else {
          console.log(`  ❌ Post ${r.postId}: ${r.error}`)
        }
      }
    }

    process.exit(result.success ? 0 : 1)
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
