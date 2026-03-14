import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'

interface XRCameraProcessedDetail {
  cameraProjectionMatrix: Float32Array
  cameraTransform: {
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number; w: number }
  }
}

export function EighthwallCamera() {
  const { gl } = useThree()
  const { xr8 } = useXRContext()
  const cameraDataRef = useRef<XRCameraProcessedDetail | null>(null)
  // オブジェクトを事前確保して再利用（GC圧迫を防ぐ）
  const _position = useRef(new THREE.Vector3())
  const _quaternion = useRef(new THREE.Quaternion())
  const _scale = useRef(new THREE.Vector3(1, 1, 1))
  const _matrix = useRef(new THREE.Matrix4())

  useEffect(() => {
    if (!xr8) return  // xr8がnullの間はリスナーを登録しない
    const canvas = gl.domElement

    function onCameraProcessed(e: Event) {
      const detail = (e as CustomEvent<XRCameraProcessedDetail>).detail
      cameraDataRef.current = detail
    }

    canvas.addEventListener('xrcameraprocessed', onCameraProcessed)
    return () => {
      canvas.removeEventListener('xrcameraprocessed', onCameraProcessed)
    }
  }, [gl, xr8])

  useFrame(({ camera }) => {
    const data = cameraDataRef.current
    if (!data) return

    camera.projectionMatrix.fromArray(data.cameraProjectionMatrix)

    const { position: p, rotation: r } = data.cameraTransform
    _position.current.set(p.x, p.y, p.z)
    _quaternion.current.set(r.x, r.y, r.z, r.w)
    _matrix.current.compose(_position.current, _quaternion.current, _scale.current)
    camera.matrixWorldInverse.copy(_matrix.current).invert()
  })

  return null
}
