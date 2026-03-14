import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'
import { extractTargetName } from '../types'
import type { ImageTrackerProps, ImageFoundEvent } from '../types'

interface XRImageEventDetail {
  name: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  scale: number
}

export function ImageTracker({ targetImage, onFound, onUpdated, onLost, children }: ImageTrackerProps) {
  const { registerTarget, xr8 } = useXRContext()
  const { gl } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const [visible, setVisible] = useState(false)
  const targetName = extractTargetName(targetImage)

  // Register target name before EighthwallCanvas calls XR8.run()
  useLayoutEffect(() => {
    registerTarget(targetName)
  }, [registerTarget, targetName])

  // Attach XR8 image events after XR8 is running
  useEffect(() => {
    if (!xr8) return
    const canvas = gl.domElement

    function applyPose(detail: XRImageEventDetail): ImageFoundEvent {
      const position = new THREE.Vector3(detail.position.x, detail.position.y, detail.position.z)
      const rotation = new THREE.Quaternion(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w)
      if (groupRef.current) {
        groupRef.current.position.copy(position)
        groupRef.current.quaternion.copy(rotation)
        groupRef.current.scale.setScalar(detail.scale)
      }
      return { position, rotation, scale: detail.scale }
    }

    function onImageFound(e: Event) {
      const detail = (e as CustomEvent<XRImageEventDetail>).detail
      if (detail.name !== targetName) return
      setVisible(true)
      const event = applyPose(detail)
      onFound?.(event)
    }

    function onImageUpdated(e: Event) {
      const detail = (e as CustomEvent<XRImageEventDetail>).detail
      if (detail.name !== targetName) return
      const event = applyPose(detail)
      onUpdated?.(event)
    }

    function onImageLost(e: Event) {
      const detail = (e as CustomEvent<{ name: string }>).detail
      if (detail.name !== targetName) return
      setVisible(false)
      onLost?.()
    }

    canvas.addEventListener('xrimagefound', onImageFound)
    canvas.addEventListener('xrimageupdated', onImageUpdated)
    canvas.addEventListener('xrimagelost', onImageLost)

    return () => {
      canvas.removeEventListener('xrimagefound', onImageFound)
      canvas.removeEventListener('xrimageupdated', onImageUpdated)
      canvas.removeEventListener('xrimagelost', onImageLost)
    }
  }, [xr8, gl, targetName, onFound, onUpdated, onLost])

  return (
    <group ref={groupRef} visible={visible}>
      {children}
    </group>
  )
}
