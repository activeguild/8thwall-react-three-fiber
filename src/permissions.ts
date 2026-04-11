type CachedState = 'granted' | 'denied' | 'unknown'

let cachedState: CachedState = 'unknown'

/**
 * Returns true if camera permission has been granted.
 * Call permissionRequest() first to populate the cache.
 */
export function permissionGranted(): boolean {
  return cachedState === 'granted'
}

/**
 * Returns true if camera permission has been explicitly denied.
 * Call permissionRequest() first to populate the cache.
 */
export function permissionDenied(): boolean {
  return cachedState === 'denied'
}

/**
 * Request camera permission via getUserMedia.
 * Shows browser permission dialog if not yet decided.
 * Returns true if granted, false if denied.
 * Caches the result for subsequent permissionGranted()/permissionDenied() calls.
 */
export async function permissionRequest(): Promise<boolean> {
  if (cachedState === 'granted') return true

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    for (const track of stream.getTracks()) track.stop()
    cachedState = 'granted'
    return true
  } catch {
    cachedState = 'denied'
    return false
  }
}
