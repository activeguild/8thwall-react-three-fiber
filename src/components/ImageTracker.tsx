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

  // コールバックをrefで保持することで、毎レンダーのイベント再登録を防ぐ
  const onFoundRef = useRef(onFound)
  const onUpdatedRef = useRef(onUpdated)
  const onLostRef = useRef(onLost)
  useEffect(() => { onFoundRef.current = onFound }, [onFound])
  useEffect(() => { onUpdatedRef.current = onUpdated }, [onUpdated])
  useEffect(() => { onLostRef.current = onLost }, [onLost])

  // 事前確保されたThree.jsオブジェクト（GC圧迫を防ぐ）
  const _position = useRef(new THREE.Vector3())
  const _rotation = useRef(new THREE.Quaternion())

  // Register target name before EighthwallCanvas calls XR8.run()
  useLayoutEffect(() => {
    registerTarget(targetName)
  }, [registerTarget, targetName])

  // Attach XR8 image events after XR8 is running
  useEffect(() => {
    if (!xr8) return
    const canvas = gl.domElement

    function applyPose(detail: XRImageEventDetail): ImageFoundEvent {
      _position.current.set(detail.position.x, detail.position.y, detail.position.z)
      _rotation.current.set(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w)
      if (groupRef.current) {
        groupRef.current.position.copy(_position.current)
        groupRef.current.quaternion.copy(_rotation.current)
        groupRef.current.scale.setScalar(detail.scale)
      }
      return {
        position: _position.current.clone(),
        rotation: _rotation.current.clone(),
        scale: detail.scale,
      }
    }

    function onImageFound(e: Event) {
      const detail = (e as CustomEvent<XRImageEventDetail>).detail
      if (detail.name !== targetName) return
      setVisible(true)
      const event = applyPose(detail)
      onFoundRef.current?.(event)
    }

    function onImageUpdated(e: Event) {
      const detail = (e as CustomEvent<XRImageEventDetail>).detail
      if (detail.name !== targetName) return
      const event = applyPose(detail)
      onUpdatedRef.current?.(event)
    }

    function onImageLost(e: Event) {
      const detail = (e as CustomEvent<{ name: string }>).detail
      if (detail.name !== targetName) return
      setVisible(false)
      onLostRef.current?.()
    }

    canvas.addEventListener('xrimagefound', onImageFound)
    canvas.addEventListener('xrimageupdated', onImageUpdated)
    canvas.addEventListener('xrimagelost', onImageLost)

    return () => {
      canvas.removeEventListener('xrimagefound', onImageFound)
      canvas.removeEventListener('xrimageupdated', onImageUpdated)
      canvas.removeEventListener('xrimagelost', onImageLost)
    }
  }, [xr8, gl, targetName]) // onFound/Updated/Lost を依存配列から除外

  return (
    <group ref={groupRef} visible={visible}>
      {children}
    </group>
  )
}
