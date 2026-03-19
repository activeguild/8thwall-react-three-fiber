import { useEffect, useRef, useState, createContext, useContext } from 'react'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'
import type { FaceTrackerProps, FaceFoundEvent, AttachmentPointName } from '../types'

interface FaceContextValue {
  attachmentPoints: Record<AttachmentPointName, { position: THREE.Vector3 }> | null
}

const FaceContext = createContext<FaceContextValue>({ attachmentPoints: null })

export function useFaceContext() {
  return useContext(FaceContext)
}

/**
 * Face Tracker Component
 * Tracks a detected face and updates children position/rotation based on face movement
 */
export function FaceTracker({
  faceId = 0,
  onFaceFound,
  onFaceUpdated,
  onFaceLost,
  children,
}: FaceTrackerProps) {
  const { xr8 } = useXRContext()
  const groupRef = useRef<THREE.Group>(null)
  const [isFaceVisible, setIsFaceVisible] = useState(false)
  const [attachmentPoints, setAttachmentPoints] = useState<Record<AttachmentPointName, { position: THREE.Vector3 }> | null>(null)

  const onFaceFoundRef = useRef(onFaceFound)
  const onFaceUpdatedRef = useRef(onFaceUpdated)
  const onFaceLostRef = useRef(onFaceLost)

  useEffect(() => { onFaceFoundRef.current = onFaceFound }, [onFaceFound])
  useEffect(() => { onFaceUpdatedRef.current = onFaceUpdated }, [onFaceUpdated])
  useEffect(() => { onFaceLostRef.current = onFaceLost }, [onFaceLost])

  const wasFaceVisibleRef = useRef(false)

  useEffect(() => {
    if (!xr8) return

    const moduleName = `face-tracker-${faceId}`

    xr8.addCameraPipelineModule({
      name: moduleName,
      onUpdate: (args: any) => {
        const processCpuResult = args?.processCpuResult
        const faceController = processCpuResult?.facecontroller

        if (!faceController) return

        const faces = faceController.faces
        if (!faces || faces.length === 0) {
          // No faces detected
          if (wasFaceVisibleRef.current) {
            wasFaceVisibleRef.current = false
            setIsFaceVisible(false)
            setAttachmentPoints(null)
            onFaceLostRef.current?.()
          }
          return
        }

        // Get face by ID (default to first face)
        const face = faces[faceId]
        if (!face) {
          if (wasFaceVisibleRef.current) {
            wasFaceVisibleRef.current = false
            setIsFaceVisible(false)
            setAttachmentPoints(null)
            onFaceLostRef.current?.()
          }
          return
        }

        // Update group transform
        if (groupRef.current && face.transform) {
          const { position, rotation, scale } = face.transform

          if (position) {
            groupRef.current.position.copy(position)
          }
          if (rotation) {
            groupRef.current.quaternion.copy(rotation)
          }
          if (scale) {
            groupRef.current.scale.set(scale, scale, scale)
          }
        }

        // Parse attachment points
        let points: Record<AttachmentPointName, { position: THREE.Vector3 }> | null = null
        if (face.attachmentPoints) {
          points = {} as Record<AttachmentPointName, { position: THREE.Vector3 }>
          const pointNames: AttachmentPointName[] = ['noseBridge', 'forehead', 'leftEye', 'rightEye', 'mouth']

          for (const pointName of pointNames) {
            if (face.attachmentPoints[pointName]?.position) {
              points[pointName] = {
                position: new THREE.Vector3().copy(face.attachmentPoints[pointName].position)
              }
            }
          }
        }

        setAttachmentPoints(points)

        const event: FaceFoundEvent = {
          id: faceId,
          transform: {
            position: groupRef.current?.position.clone() || new THREE.Vector3(),
            rotation: groupRef.current?.quaternion.clone() || new THREE.Quaternion(),
            scale: groupRef.current?.scale.clone() || new THREE.Vector3(1, 1, 1),
          },
          attachmentPoints: points || undefined,
        }

        if (!wasFaceVisibleRef.current) {
          // Face just found
          wasFaceVisibleRef.current = true
          setIsFaceVisible(true)
          onFaceFoundRef.current?.(event)
        } else {
          // Face still being tracked
          onFaceUpdatedRef.current?.(event)
        }
      },
    })

    return () => {
      wasFaceVisibleRef.current = false
      setIsFaceVisible(false)
      setAttachmentPoints(null)
      if (xr8) {
        xr8.removeCameraPipelineModule(moduleName)
      }
    }
  }, [xr8, faceId])

  return (
    <FaceContext.Provider value={{ attachmentPoints }}>
      <group ref={groupRef} visible={isFaceVisible}>
        {children}
      </group>
    </FaceContext.Provider>
  )
}
