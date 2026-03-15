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
        imuSnapshotRef.current = getIMUQuaternion().clone()

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
    // Skip if no XR8 frame has arrived yet, or if the marker is not detected
    if (!pose || !snapshot || !groupRef.current) return

    // ΔQ = Q_current * Q_snapshot^-1  (rotation since the XR8 frame was captured)
    const deltaQ = getIMUQuaternion().clone().multiply(snapshot.clone().invert()).normalize()
    // Inverse delta: undo the camera movement to keep the overlay aligned to the physical marker
    const deltaQInv = deltaQ.clone().invert()

    const xr8Position = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z)
    const xr8Quaternion = new THREE.Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w)

    const correctedPosition = xr8Position.clone().applyQuaternion(deltaQInv)
    const correctedQuaternion = deltaQInv.clone().multiply(xr8Quaternion)

    groupRef.current.position.copy(correctedPosition)
    groupRef.current.quaternion.copy(correctedQuaternion)
    groupRef.current.scale.setScalar(pose.scale)

    // Fire with corrected pose so consumers stay in sync with what is rendered
    onUpdatedRef.current?.({
      position: correctedPosition.clone(),
      rotation: correctedQuaternion.clone(),
      scale: pose.scale,
    })
  })

  return (
    <group ref={groupRef} visible={visible}>
      {children}
    </group>
  )
}
