import { Canvas } from '@react-three/fiber'
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { XRContext } from '../context/XRContext'
import type { EighthwallCanvasProps, XR8Instance } from '../types'
import { extractTargetName } from '../types'

function loadScript(src: string): Promise<{ script: HTMLScriptElement; isNew: boolean }> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (window.XR8) {
        // Script already executed and XR8 is ready
        resolve({ script: existing, isNew: false })
      } else {
        // Script is still loading — wait for xr.js to set window.XR8
        // New xr.js sets window.XR8 AFTER preload chunks (xr-tracking.js) load,
        // then dispatches 'xrloaded' 1ms later — so XrController is ready by then.
        window.addEventListener('xrloaded', () => resolve({ script: existing, isNew: false }), {
          once: true,
        })
        existing.addEventListener('error', reject, { once: true })
      }
      return
    }
    const script = document.createElement('script')
    script.src = src
    // 'slam' chunk loads xr-tracking.js which provides XrController for image tracking
    script.setAttribute('data-preload-chunks', 'slam')
    script.onload = () => resolve({ script, isNew: true })
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function EighthwallCanvas({
  xrSrc,
  enableSkyEffects = false,
  autoStart = true,
  disableWorldTracking = true,
  children,
  overlayChildren,
  style,
  onError,
  gl: userGl,
  dpr,
  id,
  rearCameraDeviceId,
  flat = true,
}: EighthwallCanvasProps) {
  // Separate canvas for XR8 camera feed (behind) vs R3F 3D scene (front, alpha=true)
  const xrCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [xr8, setXr8] = useState<XR8Instance | null>(null)
  const targetPathsRef = useRef<string[]>([])
  const [isReady, setIsReady] = useState(false) // XR8 initialized but not started
  const [isStarted, setIsStarted] = useState(false) // Camera started
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const targetMetadataRef = useRef<Map<string, { imageWidth: number; imageHeight: number }>>(
    new Map(),
  )

  const registerTarget = useCallback((path: string) => {
    if (!targetPathsRef.current.includes(path)) {
      targetPathsRef.current = [...targetPathsRef.current, path]
    }
  }, [])

  const getTargetMetadata = useCallback((name: string) => {
    return targetMetadataRef.current.get(name) ?? null
  }, [])

  // Keep XR canvas pixel dimensions in sync with display size (devicePixelRatio対応)
  useLayoutEffect(() => {
    const canvas = xrCanvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      canvas.width = Math.round(canvas.clientWidth * window.devicePixelRatio)
      canvas.height = Math.round(canvas.clientHeight * window.devicePixelRatio)
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  // Start camera manually (only when autoStart=false)
  const startCamera = useCallback(async (): Promise<boolean> => {
    if (isStarted) {
      console.warn('[8thwall-r3f] Camera already started')
      return true
    }
    if (!isReady || !xr8) {
      console.warn('[8thwall-r3f] XR8 not ready yet')
      return false
    }

    const canvas = xrCanvasRef.current
    if (!canvas) {
      console.warn('[8thwall-r3f] Canvas not available')
      return false
    }

    try {
      console.log('[8thwall-r3f] Starting camera...')
      xr8.run({
        canvas,
        ...(rearCameraDeviceId ? { cameraConfig: { deviceId: rearCameraDeviceId } } : {}),
      })
      setIsStarted(true)
      return true
    } catch (err) {
      console.error('[8thwall-r3f] Failed to start camera:', err)
      onErrorRef.current?.(err)
      return false
    }
  }, [isReady, isStarted, xr8, rearCameraDeviceId])

  useLayoutEffect(() => {
    // Children's useLayoutEffect (ImageTracker) runs before this.
    // By this point, all registerTarget calls have completed.
    let stopped = false
    let injectedScript: HTMLScriptElement | null = null

    async function initXR() {
      console.log('[8thwall-r3f] build v5 — initXR start')

      // When world tracking is disabled, bypass DeviceMotion/Orientation permission dialogs.
      // XR8's camera pipeline always requests these permissions regardless of disableWorldTracking,
      // but image-only tracking doesn't need device motion data.
      let savedMotionPermission: (() => Promise<PermissionState>) | undefined
      let savedOrientationPermission: (() => Promise<PermissionState>) | undefined
      if (disableWorldTracking) {
        const DME = globalThis.DeviceMotionEvent as typeof DeviceMotionEvent & {
          requestPermission?: () => Promise<PermissionState>
        }
        const DOE = globalThis.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<PermissionState>
        }
        if (DME.requestPermission) {
          savedMotionPermission = DME.requestPermission
          DME.requestPermission = () => Promise.resolve('granted' as PermissionState)
        }
        if (DOE.requestPermission) {
          savedOrientationPermission = DOE.requestPermission
          DOE.requestPermission = () => Promise.resolve('granted' as PermissionState)
        }
      }

      const { script, isNew } = await loadScript(xrSrc)
      console.log('[8thwall-r3f] loadScript resolved', {
        isNew,
        stopped,
        XR8: window.XR8,
        XrController: window.XR8?.XrController,
      })
      if (isNew) injectedScript = script
      if (stopped) {
        console.log('[8thwall-r3f] stopped before setup, aborting')
        return
      }

      const xr8Instance = window.XR8
      console.log('[8thwall-r3f] XR8 initialized')
      console.log('[8thwall-r3f] targets:', targetPathsRef.current)

      // Fetch all registered target JSON files for offline image tracking
      const imageTargetData = await Promise.all(
        targetPathsRef.current.map((path) => fetch(path).then((r) => r.json())),
      )
      console.log('[8thwall-r3f] imageTargetData loaded, count:', imageTargetData.length)

      for (let i = 0; i < targetPathsRef.current.length; i++) {
        const data = imageTargetData[i]
        const name = extractTargetName(targetPathsRef.current[i])
        const imageWidth = data?.properties?.width ?? data?.imageWidth ?? 0
        const imageHeight = data?.properties?.height ?? data?.imageHeight ?? 0
        targetMetadataRef.current.set(name, { imageWidth, imageHeight })
      }

      xr8Instance.XrController.configure({ imageTargetData, disableWorldTracking })
      console.log('[8thwall-r3f] XrController.configure done')

      const pipelineModules = [
        xr8Instance.GlTextureRenderer.pipelineModule(),
        xr8Instance.XrController.pipelineModule(),
      ]

      if (enableSkyEffects) {
        console.log('[8thwall-r3f] Enabling Sky Effects')

        // Add LayersController if available
        if (xr8Instance.LayersController) {
          console.log('[8thwall-r3f] Adding LayersController module')
          pipelineModules.push(xr8Instance.LayersController.pipelineModule())

          // Configure sky layer
          xr8Instance.LayersController.configure({
            layers: {
              sky: {
                invertLayerMask: false,
              },
            },
          })
          console.log('[8thwall-r3f] LayersController configured with sky layer')
        } else {
          console.warn('[8thwall-r3f] LayersController not available in XR8')
        }

        // Add SkyEffects module if available
        if (xr8Instance.SkyEffects) {
          console.log('[8thwall-r3f] Adding SkyEffects module')
          pipelineModules.push(xr8Instance.SkyEffects.pipelineModule())
        } else {
          console.warn('[8thwall-r3f] SkyEffects not available in XR8')
        }
      }

      xr8Instance.addCameraPipelineModules(pipelineModules)
      console.log('[8thwall-r3f] addCameraPipelineModules done')

      if (!stopped) {
        setXr8(xr8Instance)
        setIsReady(true)
      }

      // Auto-start camera if enabled
      if (autoStart && !stopped) {
        const canvas = xrCanvasRef.current
        console.log('[8thwall-r3f] xrCanvasRef.current:', canvas)
        if (!canvas) {
          console.warn('[8thwall-r3f] xr canvas is null, cannot run')
          return
        }

        console.log('[8thwall-r3f] Auto-starting camera (autoStart=true)')
        xr8Instance.run({
          canvas,
          ...(rearCameraDeviceId ? { cameraConfig: { deviceId: rearCameraDeviceId } } : {}),
        })
        setIsStarted(true)
      } else {
        console.log(
          '[8thwall-r3f] Camera not started (autoStart=false), call startCamera() to start',
        )
      }

      // Restore original requestPermission after XR8 has started
      if (disableWorldTracking) {
        const DME = globalThis.DeviceMotionEvent as typeof DeviceMotionEvent & {
          requestPermission?: () => Promise<PermissionState>
        }
        const DOE = globalThis.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<PermissionState>
        }
        if (savedMotionPermission) DME.requestPermission = savedMotionPermission
        if (savedOrientationPermission) DOE.requestPermission = savedOrientationPermission
      }
    }

    initXR().catch((err) => {
      console.error('[8thwall-r3f] XR initialization failed:', err)
      onErrorRef.current?.(err)
    })

    return () => {
      stopped = true
      window.XR8?.stop()
      injectedScript?.remove()
      setXr8(null)
      setIsReady(false)
      setIsStarted(false)
    }
  }, [xrSrc, enableSkyEffects, autoStart, disableWorldTracking, rearCameraDeviceId])

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    ...style,
  }

  const fillStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  }

  return (
    <XRContext.Provider value={{ xr8, registerTarget, startCamera, getTargetMetadata }}>
      <div id={id} style={containerStyle}>
        {/* XR8 renders camera feed to this canvas (behind) */}
        <canvas ref={xrCanvasRef} style={fillStyle} />
        {/* R3F renders 3D scene with transparent background on top */}
        <Canvas
          style={fillStyle}
          linear
          flat={flat}
          gl={{ antialias: false, ...userGl, alpha: true }}
          dpr={dpr}
        >
          {children}
        </Canvas>
        {overlayChildren}
      </div>
    </XRContext.Provider>
  )
}
