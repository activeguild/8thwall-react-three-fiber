import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'
import type { EighthwallCameraProps } from '../types'

interface CameraState {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
}

/**
 * 動画解像度から縦方向FOVを推定する。
 * 縦持ちの場合、画面の垂直FOV = カメラセンサーの横方向FOV。
 * 対角FOVとして73°（スマートフォン標準的な値）を前提とする。
 */
function estimateFovFromVideo(videoWidth: number, videoHeight: number): number {
  const landscapeW = Math.max(videoWidth, videoHeight)
  const landscapeH = Math.min(videoWidth, videoHeight)
  const diagonal = Math.sqrt(landscapeW * landscapeW + landscapeH * landscapeH)
  const diagonalFovRad = (73 * Math.PI) / 180
  const landscapeHFov = 2 * Math.atan((landscapeW / diagonal) * Math.tan(diagonalFovRad / 2))
  return (landscapeHFov * 180) / Math.PI
}

export function EighthwallCamera({ fov }: EighthwallCameraProps) {
  const { xr8 } = useXRContext()
  const cameraDataRef = useRef<CameraState | null>(null)
  const estimatedFovRef = useRef<number>(60)
  const loggedOnce = useRef(false)
  // オブジェクトを事前確保して再利用（GC圧迫を防ぐ）
  const _position = useRef(new THREE.Vector3())
  const _quaternion = useRef(new THREE.Quaternion())
  const _scale = useRef(new THREE.Vector3(1, 1, 1))
  const _matrix = useRef(new THREE.Matrix4())

  useEffect(() => {
    if (!xr8) return
    xr8.addCameraPipelineModule({
      name: 'eighthwall-camera',
      onStart: ({ videoWidth, videoHeight }: any) => {
        const estimated = estimateFovFromVideo(videoWidth, videoHeight)
        estimatedFovRef.current = estimated
        const active = fov ?? estimated
        console.log('[EighthwallCamera] video:', videoWidth, 'x', videoHeight, '— estimated fov:', estimated.toFixed(1), '— active fov:', active.toFixed(1))
      },
      onUpdate: ({ processCpuResult }: any) => {
        const reality = processCpuResult?.reality
        if (!reality?.position) return
        if (!loggedOnce.current) {
          loggedOnce.current = true
          console.log('[EighthwallCamera] first pose:', JSON.stringify(reality.position))
        }
        cameraDataRef.current = {
          position: reality.position,
          rotation: reality.rotation,
        }
      },
    })
    return () => {
      cameraDataRef.current = null
      loggedOnce.current = false
      xr8.removeCameraPipelineModule('eighthwall-camera')
    }
  }, [xr8])

  useFrame(({ camera }) => {
    const data = cameraDataRef.current
    if (!data) return

    const { position: p, rotation: r } = data
    const activeFov = fov ?? estimatedFovRef.current

    // カメラが毎フレーム自動でmatrixを再計算しないよう無効化
    camera.matrixAutoUpdate = false

    // XR8 open-sourceはintrinsicsにFOVを提供しないため、推定値またはfovプロップを使用
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - activeFov) > 0.01) {
      camera.fov = activeFov
      camera.updateProjectionMatrix()
    }

    _position.current.set(p.x, p.y, p.z)
    _quaternion.current.set(r.x, r.y, r.z, r.w)
    _matrix.current.compose(_position.current, _quaternion.current, _scale.current)
    camera.matrixWorld.copy(_matrix.current)
    camera.matrixWorldInverse.copy(_matrix.current).invert()
  })

  return null
}
