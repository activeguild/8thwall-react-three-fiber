import type { CompatibilityResult } from './types'

/**
 * Check browser compatibility for AR features.
 * Returns whether the browser supports all required APIs and a list of issues.
 */
export function checkBrowserCompatibility(): CompatibilityResult {
  const issues: string[] = []

  // Check WebGL2 support
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  if (!gl) {
    issues.push('WebGL2 not supported')
  }

  // Check getUserMedia support
  if (!navigator.mediaDevices?.getUserMedia) {
    issues.push('getUserMedia not available')
  }

  // Check captureStream support (for video recording)
  if (typeof (canvas as any).captureStream !== 'function') {
    issues.push('captureStream not supported')
  }

  return {
    compatible: issues.length === 0,
    issues,
  }
}
