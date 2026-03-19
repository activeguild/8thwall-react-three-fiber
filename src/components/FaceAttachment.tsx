import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFaceContext } from './FaceTracker'
import type { FaceAttachmentProps } from '../types'

/**
 * Face Attachment Component
 * Attaches children to a specific point on the face (noseBridge, forehead, etc.)
 * Must be used inside a FaceTracker component
 */
export function FaceAttachment({
  point,
  offset = [0, 0, 0],
  children,
}: FaceAttachmentProps) {
  const { attachmentPoints } = useFaceContext()
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!groupRef.current || !attachmentPoints?.[point]) return

    const attachmentPoint = attachmentPoints[point]
    if (attachmentPoint?.position) {
      // Apply position from attachment point + offset
      groupRef.current.position.set(
        attachmentPoint.position.x + offset[0],
        attachmentPoint.position.y + offset[1],
        attachmentPoint.position.z + offset[2]
      )
    }
  })

  return (
    <group ref={groupRef}>
      {children}
    </group>
  )
}
