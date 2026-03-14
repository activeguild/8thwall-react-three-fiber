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
        // xr.js dispatches 'xrloaded' (via setTimeout) after window.XR8 = I
        window.addEventListener('xrloaded', () => resolve({ script: existing, isNew: false }), { once: true })
        existing.addEventListener('error', reject, { once: true })
      }
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve({ script, isNew: true })
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function EighthwallCanvas({ appKey, xrSrc, children, style, onError }: EighthwallCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [xr8, setXr8] = useState<XR8Instance | null>(null)
  const targetNamesRef = useRef<string[]>([])

  const registerTarget = useCallback((name: string) => {
    if (!targetNamesRef.current.includes(name)) {
      targetNamesRef.current = [...targetNamesRef.current, name]
    }
  }, [])

  useLayoutEffect(() => {
    // Children's useLayoutEffect (ImageTracker) runs before this.
    // By this point, all registerTarget calls have completed.
    // カメラ映像パススルーはXR8のパイプラインが内部で処理する。
    // 開発者はscene.backgroundを手動で設定する必要はない。
    let stopped = false
    let injectedScript: HTMLScriptElement | null = null

    async function initXR() {
      const { script, isNew } = await loadScript(xrSrc)
      if (isNew) injectedScript = script  // 自分が作成したものだけ保持
      if (stopped) return

      const xr8Instance = window.XR8

      xr8Instance.XrController.configure({
        imageTargets: targetNamesRef.current,
      })

      xr8Instance.addCameraPipelineModules([
        xr8Instance.XrController.pipelineModule(),
      ])

      const canvas = canvasRef.current
      if (!canvas) return

      xr8Instance.run({ canvas, appKey })

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
