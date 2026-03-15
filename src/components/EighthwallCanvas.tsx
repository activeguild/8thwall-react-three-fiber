import { useRef, useState, useLayoutEffect, useCallback, type CSSProperties } from 'react'
import { Canvas } from '@react-three/fiber'
import { XRContext } from '../context/XRContext'
import type { XR8Instance, EighthwallCanvasProps } from '../types'

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
        window.addEventListener('xrloaded', () => resolve({ script: existing, isNew: false }), { once: true })
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

export function EighthwallCanvas({ appKey, xrSrc, children, style, onError }: EighthwallCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [xr8, setXr8] = useState<XR8Instance | null>(null)
  const targetPathsRef = useRef<string[]>([])

  const registerTarget = useCallback((path: string) => {
    if (!targetPathsRef.current.includes(path)) {
      targetPathsRef.current = [...targetPathsRef.current, path]
    }
  }, [])

  useLayoutEffect(() => {
    // Children's useLayoutEffect (ImageTracker) runs before this.
    // By this point, all registerTarget calls have completed.
    let stopped = false
    let injectedScript: HTMLScriptElement | null = null

    async function initXR() {
      console.log('[8thwall-r3f] build v4 — initXR start')
      const { script, isNew } = await loadScript(xrSrc)
      if (isNew) injectedScript = script
      if (stopped) return

      const xr8Instance = window.XR8

      // Fetch all registered target JSON files for offline image tracking
      const imageTargetData = await Promise.all(
        targetPathsRef.current.map((path) => fetch(path).then((r) => r.json()))
      )

      xr8Instance.XrController.configure({ imageTargetData })

      xr8Instance.addCameraPipelineModules([
        xr8Instance.GlTextureRenderer.pipelineModule(),
        xr8Instance.XrController.pipelineModule(),
      ])

      const canvas = canvasRef.current
      if (!canvas) return

      xr8Instance.run({ canvas, ...(appKey ? { appKey } : {}) })

      canvas.addEventListener('xrstarted', () => {
        if (!stopped) setXr8(xr8Instance)
      }, { once: true })
    }

    initXR().catch((err) => {
      console.error('[8thwall-r3f] XR initialization failed:', err)
      onError?.(err)
    })

    return () => {
      stopped = true
      window.XR8?.stop()
      injectedScript?.remove()
      setXr8(null)
    }
  }, [appKey, xrSrc])

  const defaultStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    ...style,
  }

  return (
    <XRContext.Provider value={{ xr8, registerTarget }}>
      <Canvas
        ref={canvasRef}
        style={defaultStyle}
        linear
        flat
        gl={{ antialias: false }}
      >
        {children}
      </Canvas>
    </XRContext.Provider>
  )
}
