import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'
import type { EighthwallCameraProps } from '../types'

interface CameraState {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
}

export function EighthwallCamera({ fov = 60 }: EighthwallCameraProps) {
  const { xr8 } = useXRContext()
  const cameraDataRef = useRef<CameraState | null>(null)
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
        console.log('[EighthwallCamera] video dimensions:', videoWidth, 'x', videoHeight, '— using fov:', fov)
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

    // カメラが毎フレーム自動でmatrixを再計算しないよう無効化
    camera.matrixAutoUpdate = false

    // XR8 open-sourceはintrinsicsにFOVを提供しないため、fovプロップを使用
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
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
