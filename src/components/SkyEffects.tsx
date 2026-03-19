import { useEffect, useRef, useState } from 'react'
import { useXRContext } from '../context/XRContext'
import type { SkyEffectsProps, SkySegmentation } from '../types'

export function SkyEffects({
  detectionThreshold = 0.8,
  onSkyDetected,
  onSkyLost,
  children
}: SkyEffectsProps) {
  const { xr8 } = useXRContext()
  const [isSkyVisible, setIsSkyVisible] = useState(false)

  const onSkyDetectedRef = useRef(onSkyDetected)
  const onSkyLostRef = useRef(onSkyLost)
  useEffect(() => { onSkyDetectedRef.current = onSkyDetected }, [onSkyDetected])
  useEffect(() => { onSkyLostRef.current = onSkyLost }, [onSkyLost])

  const wasDetectedRef = useRef(false)
  const thresholdRef = useRef(detectionThreshold)
  useEffect(() => { thresholdRef.current = detectionThreshold }, [detectionThreshold])

  useEffect(() => {
    if (!xr8) return

    const moduleName = 'sky-effects-tracker'
    xr8.addCameraPipelineModule({
      name: moduleName,
      onUpdate: (args: any) => {
        const processCpuResult = args?.processCpuResult
        const layersController = processCpuResult?.layerscontroller
        const skyLayer = layersController?.layers?.sky

        if (!skyLayer) return

        // Get sky percentage (0.0 - 1.0)
        const percentage = skyLayer.percentage
        if (percentage === undefined) return

        // Check if sky is detected based on threshold
        const isSkyDetected = percentage > thresholdRef.current

        const skySegmentation: SkySegmentation = {
          isSkyDetected,
          mask: undefined // Could use skyLayer.texture if needed for advanced usage
        }

        // Track state changes
        if (isSkyDetected && !wasDetectedRef.current) {
          // Sky was just detected
          wasDetectedRef.current = true
          setIsSkyVisible(true)
          onSkyDetectedRef.current?.(skySegmentation)
        } else if (!isSkyDetected && wasDetectedRef.current) {
          // Sky was just lost
          wasDetectedRef.current = false
          setIsSkyVisible(false)
          onSkyLostRef.current?.()
        } else if (isSkyDetected && wasDetectedRef.current) {
          // Sky is still detected - trigger callback with updated data
          onSkyDetectedRef.current?.(skySegmentation)
        }
      },
    })

    return () => {
      wasDetectedRef.current = false
      setIsSkyVisible(false)
      xr8.removeCameraPipelineModule(moduleName)
    }
  }, [xr8])

  return (
    <group visible={isSkyVisible}>
      {children}
    </group>
  )
}
