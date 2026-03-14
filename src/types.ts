import type * as THREE from 'three'

// XR8 global type (minimal surface we use)
export interface XR8Instance {
  XrController: {
    configure: (config: { imageTargets: string[] }) => void
    pipelineModule: () => unknown
  }
  run: (config: { canvas: HTMLCanvasElement; appKey: string }) => void
  stop: () => void
  addCameraPipelineModules: (modules: unknown[]) => void
}

declare global {
  interface Window {
    XR8: XR8Instance
  }
}

export interface ImageFoundEvent {
  position: THREE.Vector3
  rotation: THREE.Quaternion
  scale: number
}

export interface EighthwallCanvasProps {
  appKey: string
  children?: React.ReactNode
  style?: React.CSSProperties
  onError?: (err: unknown) => void
}

export interface EighthwallCameraProps {
  // reserved for future options
}

export interface ImageTrackerProps {
  targetImage: string
  onFound?: (event: ImageFoundEvent) => void
  onUpdated?: (event: ImageFoundEvent) => void
  onLost?: () => void
  children?: React.ReactNode
}

export interface XRContextValue {
  xr8: XR8Instance | null
  registerTarget: (name: string) => void
}

/**
 * Derives the XR8 target name from a targetImage path.
 * e.g. "/targets/macaw.json" → "macaw"
 */
export function extractTargetName(targetImage: string): string {
  const filename = targetImage.split('/').pop() ?? targetImage
  return filename.replace(/\.json$/, '')
}
