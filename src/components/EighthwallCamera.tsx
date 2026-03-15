import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'

interface CameraState {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  intrinsics: number[]
}

export function EighthwallCamera() {
  const { xr8 } = useXRContext()
  const cameraDataRef = useRef<CameraState | null>(null)
  // オブジェクトを事前確保して再利用（GC圧迫を防ぐ）
  const _position = useRef(new THREE.Vector3())
  const _quaternion = useRef(new THREE.Quaternion())
  const _scale = useRef(new THREE.Vector3(1, 1, 1))
  const _matrix = useRef(new THREE.Matrix4())

  useEffect(() => {
    if (!xr8) return
    // open-source xr.js: camera pose comes from processCpuResult.reality in onUpdate,
    // not from a canvas DOM event.
    xr8.addCameraPipelineModule({
      name: 'eighthwall-camera',
      onUpdate: ({ processCpuResult }: any) => {
        const reality = processCpuResult?.reality
        if (!reality?.position) return
        cameraDataRef.current = {
          position: reality.position,
          rotation: reality.rotation,
          intrinsics: reality.intrinsics,
        }
      },
    })
    return () => {
      cameraDataRef.current = null
      xr8.removeCameraPipelineModule('eighthwall-camera')
    }
  }, [xr8])

  useFrame(({ camera }) => {
    const data = cameraDataRef.current
    if (!data) return

    const { position: p, rotation: r, intrinsics } = data

    // カメラが毎フレーム自動でmatrixを再計算しないよう無効化
    camera.matrixAutoUpdate = false

    // intrinsics[5] = fy (normalized) → vertical FOV
    if (intrinsics?.[5] && camera instanceof THREE.PerspectiveCamera) {
      const newFov = (2.0 * Math.atan(1.0 / intrinsics[5]) * 180.0) / Math.PI
      if (Math.abs(camera.fov - newFov) > 0.01) {
        camera.fov = newFov
        camera.updateProjectionMatrix()
      }
    }

    _position.current.set(p.x, p.y, p.z)
    _quaternion.current.set(r.x, r.y, r.z, r.w)
    _matrix.current.compose(_position.current, _quaternion.current, _scale.current)
    camera.matrixWorld.copy(_matrix.current)
    camera.matrixWorldInverse.copy(_matrix.current).invert()
  })

  return null
}
