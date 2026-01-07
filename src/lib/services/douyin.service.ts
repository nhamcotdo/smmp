/**
 * Douyin Video Parser Service
 * Extracts download URLs from Douyin (TikTok China) share links
 */

const USER_AGENT = 'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36'
const CV_URL_TEMPLATE = 'https://www.iesdouyin.com/aweme/v1/play/?video_id=%s&ratio=1080p&line=0'

export interface DouyinVideoInfo {
  type: 'video' | 'image'
  videoId: string
  downloadUrl: string
  imageUrl: string[]
  videoDesc: string
  stats: {
    like: number
    comment: number
    save: number
    share: number
  }
  author: {
    username: string
    name: string
    bio: string
  }
  createdAt: string
}

export interface DouyinParseResult {
  success: boolean
  data?: DouyinVideoInfo
  error?: string
}

/**
 * Fetch URL content with proper headers
 */
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return await response.text()
}

/**
 * Parse image list from Douyin response
 */
function parseImageList(body: string): string[] {
  const content = body.replace(/\\u002F/g, '/').replace(/\\\//g, '/')

  // Find URLs in url_list
  const urlRegex = /{"uri":"[^\s"]+","url_list":\["(https:\/\/p\d{1,2}-sign\.douyinpic\.com\/[^"]+)"/g
  const uriRegex = /"uri":"([^\s"]+)","url_list":/g

  const firstUrls: string[] = []
  const uriSet = new Set<string>()

  let match
  while ((match = urlRegex.exec(content)) !== null) {
    firstUrls.push(match[1])
  }

  while ((match = uriRegex.exec(content)) !== null) {
    uriSet.add(match[1])
  }

  const resultList: string[] = []
  for (const uri of uriSet) {
    for (const url of firstUrls) {
      if (url.includes(uri) && !url.includes('/obj/')) {
        resultList.push(url)
        break
      }
    }
  }

  return resultList
}

/**
 * Extract statistics from HTML
 */
function extractStats(html: string): {
  awemeId: string
  commentCount: number
  diggCount: number
  shareCount: number
  collectCount: number
} {
  const statsRegex = /"statistics"\s*:\s*\{([\s\S]*?)\},/
  const statsMatch = statsRegex.exec(html)

  if (!statsMatch) {
    return {
      awemeId: '',
      commentCount: 0,
      diggCount: 0,
      shareCount: 0,
      collectCount: 0,
    }
  }

  const innerContent = statsMatch[1]

  const awemeIdMatch = /"aweme_id"\s*:\s*"([^"]+)"/.exec(innerContent)
  const commentMatch = /"comment_count"\s*:\s*(\d+)/.exec(innerContent)
  const diggMatch = /"digg_count"\s*:\s*(\d+)/.exec(innerContent)
  const shareMatch = /"share_count"\s*:\s*(\d+)/.exec(innerContent)
  const collectMatch = /"collect_count"\s*:\s*(\d+)/.exec(innerContent)

  return {
    awemeId: awemeIdMatch?.[1] || '',
    commentCount: commentMatch ? parseInt(commentMatch[1], 10) : 0,
    diggCount: diggMatch ? parseInt(diggMatch[1], 10) : 0,
    shareCount: shareMatch ? parseInt(shareMatch[1], 10) : 0,
    collectCount: collectMatch ? parseInt(collectMatch[1], 10) : 0,
  }
}

/**
 * Extract author info from HTML
 */
function extractAuthor(html: string): { username: string; name: string; bio: string } {
  const nicknameMatch = /"nickname":\s*"([^"]+)"/.exec(html)
  const signatureMatch = /"signature":\s*"([^"]+)"/.exec(html)
  const uniqueIdMatch = /"unique_id":\s*"([^"]+)"/.exec(html)

  return {
    username: uniqueIdMatch?.[1] || '',
    name: nicknameMatch?.[1] || '',
    bio: signatureMatch?.[1] || '',
  }
}

/**
 * Extract Douyin URL from shared link format
 * Shared links include additional text: "8.71 02/29 Okp:/ L@J.IV ... https://v.douyin.com/xxxxx/ 复制此链接..."
 */
export function extractDouyinUrl(input: string): string {
  // Match various Douyin URL patterns
  const patterns = [
    /https?:\/\/v\.douyin\.com\/[a-zA-Z0-9]+/g
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match) {
      return match[0]
    }
  }

  // If no match, return original input
  return input
}

/**
 * Parse Douyin URL and extract video/image info
 */
export async function parseDouyinUrl(url: string): Promise<DouyinParseResult> {
  try {
    // Extract actual Douyin URL from shared link format
    const extractedUrl = extractDouyinUrl(url)

    // Validate Douyin URL
    if (!extractedUrl.includes('douyin.com') && !extractedUrl.includes('iesdouyin.com')) {
      return {
        success: false,
        error: 'Invalid Douyin URL. Please use a valid Douyin share link.',
      }
    }

    const html = await fetchPage(extractedUrl)

    // Check for video or image
    const videoPattern = /"video":\{"play_addr":\{"uri":"([a-z0-9]+)"/
    const videoMatch = videoPattern.exec(html)

    let type: 'video' | 'image' = 'video'
    let downloadUrl = ''
    const imageUrl: string[] = []

    if (!videoMatch) {
      type = 'image'
      imageUrl.push(...parseImageList(html))
    } else {
      downloadUrl = CV_URL_TEMPLATE.replace('%s', videoMatch[1])
    }

    // Extract stats
    const stats = extractStats(html)

    // Extract author
    const author = extractAuthor(html)

    // Extract description
    const descMatch = /"desc":\s*"([^"]+)"/.exec(html)
    const videoDesc = descMatch?.[1] || ''

    // Extract and format create time
    const createTimeMatch = /"create_time":\s*(\d+)/.exec(html)
    let createdAt = ''
    if (createTimeMatch) {
      const timestamp = parseInt(createTimeMatch[1], 10)
      createdAt = new Date(timestamp * 1000).toISOString()
    }

    const result: DouyinVideoInfo = {
      type,
      videoId: stats.awemeId,
      downloadUrl,
      imageUrl,
      videoDesc,
      stats: {
        like: stats.diggCount,
        comment: stats.commentCount,
        save: stats.collectCount,
        share: stats.shareCount,
      },
      author,
      createdAt,
    }

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse Douyin URL',
    }
  }
}
