import type * as THREE from 'three'

// XR8 global type (minimal surface we use)
export interface XR8Instance {
  XrController: {
    // imageTargetData: actual JSON content of target files (offline tracking)
    configure: (config: { imageTargetData?: unknown[]; mirroredDisplay?: boolean }) => void
    pipelineModule: () => unknown
  }
  GlTextureRenderer: {
    pipelineModule: () => unknown
  }
  run: (config: { canvas: HTMLCanvasElement }) => void
  stop: () => void
  addCameraPipelineModules: (modules: unknown[]) => void
  addCameraPipelineModule: (module: unknown) => void
  removeCameraPipelineModule: (moduleName: string) => void
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
  /** URL to the xr.js engine script served from your public directory */
  xrSrc: string
  children?: React.ReactNode
  style?: React.CSSProperties
  onError?: (err: unknown) => void
}

export interface EighthwallCameraProps {
  // reserved for future options
}

export interface ImageTrackerProps {
  /** Path to the target JSON file, e.g. "/targets/macaw.json" */
  targetImage: string
  onFound?: (event: ImageFoundEvent) => void
  onUpdated?: (event: ImageFoundEvent) => void
  onLost?: () => void
  children?: React.ReactNode
}

export interface XRContextValue {
  xr8: XR8Instance | null
  /** Register a target JSON file path for tracking (e.g. "/targets/macaw.json") */
  registerTarget: (path: string) => void
}

/**
 * Derives the XR8 target name from a targetImage path.
 * e.g. "/targets/macaw.json" → "macaw"
 */
export function extractTargetName(targetImage: string): string {
  const filename = targetImage.split('/').pop() ?? targetImage
  return filename.replace(/\.json$/, '')
}
