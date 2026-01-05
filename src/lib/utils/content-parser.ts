/**
 * Content parsing utilities for social media posts
 */

/**
 * Extract hashtags from text content
 * @param text - Content to parse
 * @returns Array of hashtags without the # symbol
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) || []
  return matches.map((tag) => tag.substring(1))
}

/**
 * Extract mentions from text content
 * @param text - Content to parse
 * @returns Array of mentions without the @ symbol
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w.]+/g) || []
  return matches.map((mention) => mention.substring(1))
}

/**
 * Extract all social metadata from text
 * @param text - Content to parse
 * @returns Object with hashtags and mentions
 */
export function extractSocialMetadata(text: string): {
  hashtags: string[]
  mentions: string[]
} {
  return {
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
  }
}
