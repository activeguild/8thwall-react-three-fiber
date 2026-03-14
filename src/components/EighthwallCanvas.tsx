import { useRef, useState, useLayoutEffect, useCallback, type CSSProperties } from 'react'
import { Canvas } from '@react-three/fiber'
import { XRContext } from '../context/XRContext'
import type { XR8Instance, EighthwallCanvasProps } from '../types'

// Resolved at build time by Vite's asset handling
const XR_ENGINE_URL = new URL('../engine/xr.js', import.meta.url).href

function loadScript(src: string): Promise<{ script: HTMLScriptElement; isNew: boolean }> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      resolve({ script: existing, isNew: false })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve({ script, isNew: true })
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function EighthwallCanvas({ appKey, children, style, onError }: EighthwallCanvasProps) {
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
      const { script, isNew } = await loadScript(XR_ENGINE_URL)
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
  }, [appKey])

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
