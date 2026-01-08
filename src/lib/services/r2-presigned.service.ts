/**
 * R2 Storage Service with AWS Signature V4
 * Handles file uploads to Cloudflare R2 storage
 */

import { createHash, createHmac } from 'crypto'

export interface PresignedUrlResult {
  url: string
  key: string
  expiresAt: Date
}

/**
 * Get R2 credentials from environment
 */
function getR2Credentials() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName }
}

/**
 * Get the public URL for an R2 object
 */
function getPublicUrl(key: string): string {
  const publicDomain = process.env.R2_PUBLIC_DOMAIN
  const bucketName = process.env.R2_BUCKET_NAME

  if (publicDomain) {
    // Custom domain (recommended for production)
    return `https://${publicDomain}/${key}`
  }

  if (bucketName) {
    // Default R2 public URL (using dev bucket preview)
    const accountId = process.env.R2_ACCOUNT_ID
    return `https://pub-${bucketName}.${accountId}.r2.dev/${key}`
  }

  throw new Error('Either R2_PUBLIC_DOMAIN or R2_BUCKET_NAME must be set')
}

/**
 * AWS Signature V4 - SHA256 hash (not HMAC)
 */
function sha256(message: string): Buffer {
  return createHash('sha256').update(message).digest()
}

/**
 * AWS Signature V4 - HMAC-SHA256 (keyed hash)
 */
function hmacSha256(key: Buffer, message: string): Buffer {
  return createHmac('sha256', key).update(message).digest()
}

/**
 * Generate AWS Signature V4 string to sign
 */
function getStringToSign(
  method: string,
  canonicalUri: string,
  canonicalQuerystring: string,
  canonicalHeaders: string,
  signedHeaders: string,
  timestamp: string,
  region: 'auto',
  service: 's3',
  payloadHash: string = 'UNSIGNED-PAYLOAD'
): string {
  const algorithm = 'AWS4-HMAC-SHA256'
  const dateStamp = timestamp.slice(0, 8)
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`

  // Build the canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const hashedCanonicalRequest = sha256(canonicalRequest).toString('hex')

  return [
    algorithm,
    timestamp,
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n')
}

/**
 * Calculate AWS Signature V4
 */
function calculateSignature(
  key: string,
  dateStamp: string,
  region: string,
  service: string,
  stringToSign: string
): string {
  const kDate = hmacSha256(Buffer.from(`AWS4${key}`, 'utf-8'), dateStamp)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  const kSigning = hmacSha256(kService, 'aws4_request')
  return hmacSha256(kSigning, stringToSign).toString('hex')
}

/**
 * Generate a presigned URL for R2 upload or download
 * @param key - Storage key (path/filename)
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @param method - HTTP method (default: 'PUT' for uploads, use 'GET' for downloads)
 * @returns Presigned URL
 */
export async function generatePresignedUrl(
  key: string,
  expiresIn: number = 3600,
  method: 'PUT' | 'GET' = 'PUT'
): Promise<PresignedUrlResult> {
  const creds = getR2Credentials()
  if (!creds) {
    throw new Error('R2 credentials not configured')
  }

  const { accountId, accessKeyId, secretAccessKey, bucketName } = creds

  const region = 'auto'
  const service = 's3'
  const host = `${accountId}.r2.cloudflarestorage.com`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '') // YYYYMMDDThhmmssZ
  const dateStamp = amzDate.slice(0, 8)

  // Canonical URI
  const canonicalUri = `/${bucketName}/${key}`

  // Canonical query string (without signature)
  const expiration = Math.floor(now.getTime() / 1000) + expiresIn
  const canonicalQuerystring = `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(`${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`)}&X-Amz-Date=${amzDate}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host`

  // Canonical headers
  const canonicalHeaders = `host:${host}\n`

  // Signed headers
  const signedHeaders = 'host'

  // String to sign
  const stringToSign = getStringToSign(
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    amzDate,
    region,
    service
  )

  // Calculate signature
  const signature = calculateSignature(
    secretAccessKey,
    dateStamp,
    region,
    service,
    stringToSign
  )

  // Build presigned URL with signature
  const presignedUrl = `https://${host}${canonicalUri}?${canonicalQuerystring}&X-Amz-Signature=${signature}`

  return {
    url: presignedUrl,
    key,
    expiresAt: new Date(expiration * 1000),
  }
}

/**
 * Get the public URL for a stored R2 object
 * @param key - Storage key
 * @returns Public URL
 */
export function getPublicUrlForKey(key: string): string {
  return getPublicUrl(key)
}

/**
 * Check if R2 is properly configured
 */
export function isR2Configured(): boolean {
  const creds = getR2Credentials()
  return !!creds
}

/**
 * Delete an object from R2 storage
 * @param key - Storage key to delete
 * @returns true if deleted successfully
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  const creds = getR2Credentials()
  if (!creds) {
    throw new Error('R2 credentials not configured')
  }

  const { accountId, accessKeyId, secretAccessKey, bucketName } = creds

  const method = 'DELETE'
  const region = 'auto'
  const service = 's3'
  const host = `${accountId}.r2.cloudflarestorage.com`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  // Canonical URI
  const canonicalUri = `/${bucketName}/${key}`

  // Canonical query string (empty for DELETE)
  const canonicalQuerystring = ''

  // Canonical headers
  const canonicalHeaders = `host:${host}\n`

  // Signed headers
  const signedHeaders = 'host'

  // For DELETE requests, use empty payload hash (not UNSIGNED-PAYLOAD)
  const emptyPayloadHash = sha256('').toString('hex')

  // String to sign
  const stringToSign = getStringToSign(
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    amzDate,
    region,
    service,
    emptyPayloadHash
  )

  // Calculate signature
  const signature = calculateSignature(
    secretAccessKey,
    dateStamp,
    region,
    service,
    stringToSign
  )

  // Build authorization header
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  // Send DELETE request
  const url = `https://${host}${canonicalUri}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Host': host,
      'X-Amz-Date': amzDate,
      'Authorization': authorization,
    },
  })

  if (!response.ok && response.status !== 404) {
    // 404 means object already doesn't exist, which is fine
    throw new Error(`R2 delete failed: ${response.status} ${response.statusText}`)
  }

  return true
}
