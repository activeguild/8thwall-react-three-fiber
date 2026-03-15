import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useXRContext } from '../context/XRContext'
import { extractTargetName } from '../types'
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

  // コールバックをrefで保持することで、毎レンダーのイベント再登録を防ぐ
  const onFoundRef = useRef(onFound)
  const onUpdatedRef = useRef(onUpdated)
  const onLostRef = useRef(onLost)
  useEffect(() => { onFoundRef.current = onFound }, [onFound])
  useEffect(() => { onUpdatedRef.current = onUpdated }, [onUpdated])
  useEffect(() => { onLostRef.current = onLost }, [onLost])

  // 最新姿勢をrefで保持し、useFrameで描画タイミングに合わせて適用（カメラとの同期）
  const latestPoseRef = useRef<XRImagePose | null>(null)

  // Register target JSON path before EighthwallCanvas calls XR8.run()
  useLayoutEffect(() => {
    registerTarget(targetImage)
  }, [registerTarget, targetImage])

  useEffect(() => {
    if (!xr8) return

    const moduleName = `image-tracker-${targetName}`
    xr8.addCameraPipelineModule({
      name: moduleName,
      // onUpdate で毎フレーム最新姿勢を取得（カメラ姿勢取得と同タイミング）
      onUpdate: ({ processCpuResult }: any) => {
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
      xr8.removeCameraPipelineModule(moduleName)
    }
  }, [xr8, targetName])

  useFrame(() => {
    const pose = latestPoseRef.current
    if (!pose || !groupRef.current) return

    groupRef.current.position.set(pose.position.x, pose.position.y, pose.position.z)
    groupRef.current.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w)
    groupRef.current.scale.setScalar(pose.scale)

    onUpdatedRef.current?.({
      position: new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
      rotation: new THREE.Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w),
      scale: pose.scale,
    })
  })

  return (
    <group ref={groupRef} visible={visible}>
      {children}
    </group>
  )
}
