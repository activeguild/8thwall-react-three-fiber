import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'
import type { ImageTrackerProps, PipelineUpdateArgs } from '../types'
import { extractTargetName } from '../types'

interface XRImagePose {
  name: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  scale: number
}

export function ImageTracker({
  targetImage,
  onFound,
  onUpdated,
  onLost,
  children,
  enabled = true,
}: ImageTrackerProps) {
  const { registerTarget, xr8, getTargetMetadata } = useXRContext()
  const groupRef = useRef<THREE.Group>(null)
  const [visible, setVisible] = useState(false)
  const targetName = extractTargetName(targetImage)

  const onFoundRef = useRef(onFound)
  const onUpdatedRef = useRef(onUpdated)
  const onLostRef = useRef(onLost)
  useEffect(() => {
    onFoundRef.current = onFound
  }, [onFound])
  useEffect(() => {
    onUpdatedRef.current = onUpdated
  }, [onUpdated])
  useEffect(() => {
    onLostRef.current = onLost
  }, [onLost])

  const latestPoseRef = useRef<XRImagePose | null>(null)

  useLayoutEffect(() => {
    registerTarget(targetImage)
  }, [registerTarget, targetImage])

  useEffect(() => {
    if (!xr8 || !enabled) return

    const moduleName = `image-tracker-${targetName}`
    xr8.addCameraPipelineModule({
      name: moduleName,
      onUpdate: ({ processCpuResult }: PipelineUpdateArgs) => {
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
            const metadata = getTargetMetadata(targetName)
            onFoundRef.current?.({
              position: new THREE.Vector3(detail.position.x, detail.position.y, detail.position.z),
              rotation: new THREE.Quaternion(
                detail.rotation.x,
                detail.rotation.y,
                detail.rotation.z,
                detail.rotation.w,
              ),
              scale: detail.scale,
              imageWidth: metadata?.imageWidth ?? 0,
              imageHeight: metadata?.imageHeight ?? 0,
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
      setVisible(false)
      xr8.removeCameraPipelineModule(moduleName)
    }
  }, [xr8, targetName, enabled, getTargetMetadata])

  useFrame(() => {
    if (!enabled) return
    const pose = latestPoseRef.current
    if (!pose || !groupRef.current) return

    groupRef.current.position.set(pose.position.x, pose.position.y, pose.position.z)
    groupRef.current.quaternion.set(
      pose.rotation.x,
      pose.rotation.y,
      pose.rotation.z,
      pose.rotation.w,
    )
    groupRef.current.scale.setScalar(pose.scale)

    const metadata = getTargetMetadata(targetName)
    onUpdatedRef.current?.({
      position: new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
      rotation: new THREE.Quaternion(
        pose.rotation.x,
        pose.rotation.y,
        pose.rotation.z,
        pose.rotation.w,
      ),
      scale: pose.scale,
      imageWidth: metadata?.imageWidth ?? 0,
      imageHeight: metadata?.imageHeight ?? 0,
    })
  })

  return (
    <group ref={groupRef} visible={visible}>
      {children}
    </group>
  )
}
