import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useXRContext } from '../context/XRContext'
import { extractTargetName } from '../types'
import { getIMUQuaternion } from '../imu'
import type { ImageTrackerProps } from '../types'

interface XRImagePose {
  name: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  scale: number
}

export function ImageTracker({ targetImage, onFound, onUpdated, onLost, children }: ImageTrackerProps) {
  const { registerTarget, xr8 } = useXRContext()
  const groupRef = useRef<THREE.Group>(null)
  const [visible, setVisible] = useState(false)
  const targetName = extractTargetName(targetImage)

  const onFoundRef = useRef(onFound)
  const onUpdatedRef = useRef(onUpdated)
  const onLostRef = useRef(onLost)
  useEffect(() => { onFoundRef.current = onFound }, [onFound])
  useEffect(() => { onUpdatedRef.current = onUpdated }, [onUpdated])
  useEffect(() => { onLostRef.current = onLost }, [onLost])

  const latestPoseRef = useRef<XRImagePose | null>(null)
  // Snapshot of IMU quaternion taken at each XR8 onUpdate call.
  // null until the first XR8 frame arrives.
  const imuSnapshotRef = useRef<THREE.Quaternion | null>(null)

  // Pre-allocated scratch objects to avoid per-frame heap allocation
  const scratchSnapshotRef = useRef(new THREE.Quaternion())
  const scratchDeltaQ = useRef(new THREE.Quaternion())
  const scratchDeltaQInv = useRef(new THREE.Quaternion())
  const scratchPosition = useRef(new THREE.Vector3())
  const scratchXr8Q = useRef(new THREE.Quaternion())
  const scratchCorrectedPos = useRef(new THREE.Vector3())
  const scratchCorrectedQ = useRef(new THREE.Quaternion())

  useLayoutEffect(() => {
    registerTarget(targetImage)
  }, [registerTarget, targetImage])

  useEffect(() => {
    if (!xr8) return

    const moduleName = `image-tracker-${targetName}`
    xr8.addCameraPipelineModule({
      name: moduleName,
      onUpdate: ({ processCpuResult }: any) => {
        // Snapshot IMU every XR8 frame (as close in time as possible to XR8 pose data)
        if (!imuSnapshotRef.current) imuSnapshotRef.current = new THREE.Quaternion()
        imuSnapshotRef.current.copy(getIMUQuaternion())

        const detectedImages: XRImagePose[] | undefined = processCpuResult?.reality?.detectedImages
        if (!detectedImages) return
        const pose = detectedImages.find((img) => img.name === targetName)
        latestPoseRef.current = pose ?? null
      },
      listeners: [
        {
          event: 'reality.imagefound',
          process: ({ detail }: { detail: XRImagePose }) => {
            if (detail.name !== targetName) return
            setVisible(true)
            onFoundRef.current?.({
              position: new THREE.Vector3(detail.position.x, detail.position.y, detail.position.z),
              rotation: new THREE.Quaternion(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w),
              scale: detail.scale,
            })
          },
        },
        {
          event: 'reality.imagelost',
          process: ({ detail }: { detail: { name: string } }) => {
            if (detail.name !== targetName) return
            setVisible(false)
            latestPoseRef.current = null
            onLostRef.current?.()
          },
        },
      ],
    })

    return () => {
      latestPoseRef.current = null
      imuSnapshotRef.current = null
      xr8.removeCameraPipelineModule(moduleName)
    }
  }, [xr8, targetName])

  useFrame(() => {
    const pose = latestPoseRef.current
    const snapshot = imuSnapshotRef.current
    if (!pose || !snapshot || !groupRef.current) return

    // ΔQ = Q_current * Q_snapshot^-1
    scratchSnapshotRef.current.copy(snapshot).invert()
    scratchDeltaQ.current.copy(getIMUQuaternion()).multiply(scratchSnapshotRef.current).normalize()

    // ΔQ_inv
    scratchDeltaQInv.current.copy(scratchDeltaQ.current).invert()

    // Corrected position: ΔQ_inv.apply(xr8_position)
    scratchPosition.current.set(pose.position.x, pose.position.y, pose.position.z)
    scratchCorrectedPos.current.copy(scratchPosition.current).applyQuaternion(scratchDeltaQInv.current)

    // Corrected quaternion: ΔQ_inv * xr8_quaternion
    scratchXr8Q.current.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w)
    scratchCorrectedQ.current.copy(scratchDeltaQInv.current).multiply(scratchXr8Q.current)

    groupRef.current.position.copy(scratchCorrectedPos.current)
    groupRef.current.quaternion.copy(scratchCorrectedQ.current)
    groupRef.current.scale.setScalar(pose.scale)

    // Clone scratch for onUpdated consumer (scratch will be overwritten next frame)
    onUpdatedRef.current?.({
      position: scratchCorrectedPos.current.clone(),
      rotation: scratchCorrectedQ.current.clone(),
      scale: pose.scale,
    })
  })

  return (
    <group ref={groupRef} visible={visible}>
      {children}
    </group>
  )
}
