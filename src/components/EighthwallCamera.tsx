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
  const { camera, gl } = useThree()
  const { xr8 } = useXRContext()
  const cameraDataRef = useRef<XRCameraProcessedDetail | null>(null)

  useEffect(() => {
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

  useFrame(() => {
    const data = cameraDataRef.current
    if (!data) return

    camera.projectionMatrix.fromArray(data.cameraProjectionMatrix)

    const { position: p, rotation: r } = data.cameraTransform
    const position = new THREE.Vector3(p.x, p.y, p.z)
    const quaternion = new THREE.Quaternion(r.x, r.y, r.z, r.w)
    const matrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1))
    camera.matrixWorldInverse.copy(matrix).invert()
  })

  return null
}
