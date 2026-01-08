import { useRef, useEffect } from 'react'

export function useBlobCleanup() {
  const blobUrlsRef = useRef<Set<string>>(new Set())

  const trackBlobUrl = (url: string): void => {
    blobUrlsRef.current.add(url)
  }

  const revokeBlobUrl = (url: string): void => {
    URL.revokeObjectURL(url)
    blobUrlsRef.current.delete(url)
  }

  const cleanup = (): void => {
    blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    blobUrlsRef.current.clear()
  }

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  return {
    blobUrlsRef,
    trackBlobUrl,
    revokeBlobUrl,
    cleanup,
  }
}
