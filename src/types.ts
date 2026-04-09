import type * as THREE from 'three'

// XR8 global type (minimal surface we use)
export interface XR8Instance {
  XrController: {
    // imageTargetData: actual JSON content of target files (offline tracking)
    configure: (config: { imageTargetData?: unknown[]; mirroredDisplay?: boolean; disableWorldTracking?: boolean }) => void
    pipelineModule: () => unknown
  }
  GlTextureRenderer: {
    pipelineModule: () => unknown
  }
  SkyEffects?: {
    pipelineModule: () => unknown
  }
  LayersController?: {
    pipelineModule: () => unknown
    configure: (config: { layers: { sky: { invertLayerMask: boolean } } }) => void
  }
  Threejs?: {
    pipelineModule: () => unknown
    configure: (config: { layerScenes?: string[] }) => void
    xrScene: () => any
  }
  run: (config: { canvas: HTMLCanvasElement; cameraConfig?: { deviceId?: string } }) => void
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
  /** Target image width in pixels (from target JSON metadata) */
  imageWidth: number
  /** Target image height in pixels (from target JSON metadata) */
  imageHeight: number
}

export interface EighthwallCanvasProps {
  /** URL to the xr.js engine script served from your public directory */
  xrSrc: string
  /** Enable Sky Effects module for sky segmentation */
  enableSkyEffects?: boolean
  /**
   * Auto-start camera on mount.
   * If false, call startCamera() manually to request camera permission and start XR session.
   * Default: true
   */
  autoStart?: boolean
  /**
   * Disable SLAM world tracking (6DoF).
   * When true, DeviceMotion permission is not required (no permission modal on iOS).
   * Image tracking still works without world tracking.
   * Default: true
   */
  disableWorldTracking?: boolean
  children?: React.ReactNode
  /** HTML elements rendered inside the XRContext provider but outside the R3F Canvas */
  overlayChildren?: React.ReactNode
  style?: React.CSSProperties
  onError?: (err: unknown) => void
  /** WebGL renderer parameters passed to R3F Canvas. `alpha: true` is always forced for dual-canvas compositing. */
  gl?: Record<string, unknown>
  /** Device pixel ratio for R3F Canvas rendering resolution */
  dpr?: number | [number, number]
  /** HTML id attribute for the container element */
  id?: string
  /** Specific rear camera device ID (iOS 17+). Passed to XR8 run config. */
  rearCameraDeviceId?: string
  /**
   * Disable tone mapping in R3F Canvas.
   * When true, colors are not tone-mapped (linear output).
   * Default: true
   */
  flat?: boolean
}

export interface EighthwallCameraProps {
  /**
   * Camera vertical field of view in degrees.
   * If omitted, automatically estimated from the device camera's video resolution.
   * Typical smartphone rear camera (portrait): 60–65°.
   */
  fov?: number
  /** Fired once when the first camera frame is received */
  onFirstFrame?: () => void
}

export interface ImageTrackerProps {
  /** Path to the target JSON file, e.g. "/targets/macaw.json" */
  targetImage: string
  onFound?: (event: ImageFoundEvent) => void
  onUpdated?: (event: ImageFoundEvent) => void
  onLost?: () => void
  children?: React.ReactNode
  /** Enable/disable tracking. Default: true */
  enabled?: boolean
}

export interface SkySegmentation {
  /** Whether sky is detected in the current frame */
  isSkyDetected: boolean
  /** Segmentation mask data (optional, for advanced use) */
  mask?: ImageData
}

export interface SkyEffectsProps {
  /**
   * Detection threshold (0.0 - 1.0)
   * Sky is considered detected when percentage exceeds this value.
   * Default: 0.8 (80%)
   * - 0.1 = Very sensitive (detects small amounts of sky)
   * - 0.5 = Moderate (half the screen must be sky)
   * - 0.8 = Strict (most of screen must be sky)
   */
  detectionThreshold?: number
  /** Callback when sky is detected */
  onSkyDetected?: (segmentation: SkySegmentation) => void
  /** Callback when sky is lost */
  onSkyLost?: () => void
  children?: React.ReactNode
}

export interface SkyReplacementProps {
  /** Image texture to replace the sky */
  texture?: THREE.Texture
  /** Video source URL to replace the sky */
  videoSrc?: string
  /**
   * Detection threshold (0.0 - 1.0)
   * Sky replacement is shown when percentage exceeds this value.
   * Default: 0.8 (80%)
   */
  detectionThreshold?: number
  /**
   * Opacity of the sky replacement (0.0 - 1.0)
   * Default: 1.0 (fully opaque)
   */
  opacity?: number
}

export interface XRContextValue {
  xr8: XR8Instance | null
  /** Register a target JSON file path for tracking (e.g. "/targets/macaw.json") */
  registerTarget: (path: string) => void
  /**
   * Start the camera and XR session.
   * Only available when autoStart={false}. Returns true if started successfully.
   */
  startCamera: () => Promise<boolean>
  /** Get image dimensions for a registered target by name */
  getTargetMetadata: (name: string) => { imageWidth: number; imageHeight: number } | null
}

export interface CompatibilityResult {
  compatible: boolean
  issues: string[]
}

/**
 * Derives the XR8 target name from a targetImage path.
 * e.g. "/targets/macaw.json" → "macaw"
 */
export function extractTargetName(targetImage: string): string {
  const filename = targetImage.split('/').pop() ?? targetImage
  return filename.replace(/\.json$/, '')
}
