import { useEffect, useRef, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'
import type { SkyReplacementProps } from '../types'

/**
 * Sky Replacement Component
 * Replaces the detected sky area with an image or video texture
 */
export function SkyReplacement({
  texture,
  videoSrc,
  detectionThreshold = 0.8,
  opacity = 1.0,
}: SkyReplacementProps) {
  const { xr8 } = useXRContext()
  const { camera, size } = useThree()
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const skyTextureRef = useRef<THREE.Texture | THREE.VideoTexture | null>(null)
  const maskTextureRef = useRef<THREE.DataTexture | null>(null)

  // Video setup if videoSrc is provided
  useEffect(() => {
    if (!videoSrc) return

    const video = document.createElement('video')
    video.src = videoSrc
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.play()

    const videoTexture = new THREE.VideoTexture(video)
    videoTexture.minFilter = THREE.LinearFilter
    videoTexture.magFilter = THREE.LinearFilter
    skyTextureRef.current = videoTexture

    return () => {
      video.pause()
      videoTexture.dispose()
    }
  }, [videoSrc])

  // Image texture setup
  useEffect(() => {
    if (!texture || videoSrc) return
    skyTextureRef.current = texture
  }, [texture, videoSrc])

  // Custom shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        skyTexture: { value: null },
        maskTexture: { value: null },
        opacity: { value: opacity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.999, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D skyTexture;
        uniform sampler2D maskTexture;
        uniform float opacity;
        varying vec2 vUv;

        void main() {
          // Sample the mask texture (1.0 = sky, 0.0 = not sky)
          float mask = texture2D(maskTexture, vUv).r;

          // Sample the sky replacement texture
          vec4 skyColor = texture2D(skyTexture, vUv);

          // Only show where mask indicates sky
          float alpha = mask * opacity;
          gl_FragColor = vec4(skyColor.rgb, alpha);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  }, [opacity])

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.opacity.value = opacity
    }
  }, [opacity])

  // Update mask texture from XR8
  useFrame(() => {
    if (!xr8 || !materialRef.current) return

    const material = materialRef.current

    // Update sky texture
    if (skyTextureRef.current && material.uniforms.skyTexture.value !== skyTextureRef.current) {
      material.uniforms.skyTexture.value = skyTextureRef.current
    }

    // This would be called in a pipeline module to get mask data
    // For now, we'll create a simple gradient mask as placeholder
    if (!maskTextureRef.current) {
      // Create a simple gradient mask (this will be replaced with actual segmentation data)
      const width = 256
      const height = 256
      const data = new Uint8Array(width * height)

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Simple gradient: top half is sky
          data[y * width + x] = y < height / 2 ? 255 : 0
        }
      }

      const dataTexture = new THREE.DataTexture(data, width, height, THREE.RedFormat)
      dataTexture.needsUpdate = true
      maskTextureRef.current = dataTexture
      material.uniforms.maskTexture.value = dataTexture
    }
  })

  useEffect(() => {
    if (!xr8) return

    console.log('[SkyReplacement] Registering pipeline module')

    const moduleName = 'sky-replacement'
    xr8.addCameraPipelineModule({
      name: moduleName,
      onUpdate: (args: any) => {
        const processCpuResult = args?.processCpuResult
        const layersController = processCpuResult?.layerscontroller
        const skyLayer = layersController?.layers?.sky

        if (!skyLayer || !materialRef.current) return

        const percentage = skyLayer.percentage
        if (percentage === undefined || percentage < detectionThreshold) {
          // Hide replacement when sky not detected
          if (materialRef.current.uniforms.opacity.value !== 0) {
            materialRef.current.uniforms.opacity.value = 0
          }
          return
        }

        // Show replacement when sky is detected
        if (materialRef.current.uniforms.opacity.value !== opacity) {
          materialRef.current.uniforms.opacity.value = opacity
        }

        // Update mask texture from sky layer
        if (skyLayer.texture && skyLayer.textureWidth && skyLayer.textureHeight) {
          // TODO: Convert WebGL texture to THREE.DataTexture
          // This requires reading pixel data from the WebGL texture
          console.log('[SkyReplacement] Sky mask available:', skyLayer.textureWidth, 'x', skyLayer.textureHeight)
        }
      },
    })

    return () => {
      console.log('[SkyReplacement] Cleaning up pipeline module')
      xr8.removeCameraPipelineModule(moduleName)
    }
  }, [xr8, detectionThreshold, opacity])

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} attach="material" {...shaderMaterial} />
    </mesh>
  )
}
