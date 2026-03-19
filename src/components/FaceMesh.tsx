import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'
import type { FaceMeshProps } from '../types'

/**
 * Face Mesh Component
 * Displays a 3D mesh that conforms to the detected face shape
 * Useful for applying makeup, tattoos, or face paint effects
 *
 * Note: Requires XRExtras.ThreeExtras.faceMesh() which may not be available in all 8th Wall builds
 */
export function FaceMesh({
  texture,
  alphaMap,
  materialProps = {},
}: FaceMeshProps) {
  const { xr8 } = useXRContext()
  const meshRef = useRef<THREE.Mesh | null>(null)

  useEffect(() => {
    if (!xr8) return

    // Check if XRExtras is available (not included in all builds)
    const XRExtras = (window as any).XRExtras
    if (!XRExtras?.ThreeExtras?.faceMesh) {
      console.warn('[FaceMesh] XRExtras.ThreeExtras.faceMesh() not available. Face mesh cannot be created.')
      console.warn('[FaceMesh] This feature requires 8th Wall build with XRExtras included.')
      return
    }

    try {
      // Create face mesh using XRExtras
      const faceMeshObject = XRExtras.ThreeExtras.faceMesh({
        texture: texture || undefined,
        alphaMask: alphaMap || undefined,
      })

      meshRef.current = faceMeshObject

      // Additional material customization
      if (faceMeshObject.material && materialProps) {
        Object.assign(faceMeshObject.material, materialProps)
      }

      return () => {
        if (meshRef.current) {
          meshRef.current.geometry?.dispose()
          if (meshRef.current.material) {
            if (Array.isArray(meshRef.current.material)) {
              meshRef.current.material.forEach(m => m.dispose())
            } else {
              meshRef.current.material.dispose()
            }
          }
          meshRef.current = null
        }
      }
    } catch (err) {
      console.error('[FaceMesh] Error creating face mesh:', err)
    }
  }, [xr8, texture, alphaMap, materialProps])

  // Note: Face mesh is managed by XRExtras and added to the scene automatically
  // We don't render it via React Three Fiber
  return null
}
