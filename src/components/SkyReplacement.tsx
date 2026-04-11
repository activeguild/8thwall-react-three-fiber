import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'
import type { PipelineStartArgs, PipelineUpdateArgs, SkyReplacementProps } from '../types'

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
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const skyTextureRef = useRef<THREE.Texture | THREE.VideoTexture | null>(null)
  const maskTextureRef = useRef<THREE.DataTexture | null>(null)
  const thresholdRef = useRef(detectionThreshold)
  const opacityRef = useRef(opacity)

  // Update refs when props change
  useEffect(() => {
    thresholdRef.current = detectionThreshold
  }, [detectionThreshold])

  useEffect(() => {
    opacityRef.current = opacity
  }, [opacity])

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
    skyTextureRef.current.needsUpdate = true
  }, [texture, videoSrc])

  // Custom shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        skyTexture: { value: null },
        maskTexture: { value: null },
        opacity: { value: 1.0 },
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
          // Only show when opacity > 0 (sky detected)
          if (opacity < 0.01) {
            discard;
          }

          // Sample the mask texture (1.0 = sky, 0.0 = not sky)
          float mask = texture2D(maskTexture, vUv).r;

          // Sample the sky replacement texture
          vec4 skyColor = texture2D(skyTexture, vUv);

          // Only show where mask indicates sky
          float alpha = mask * opacity;

          // Discard fragments that are not sky
          if (alpha < 0.01) {
            discard;
          }

          gl_FragColor = vec4(skyColor.rgb, alpha);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  }, [])

  // Update textures
  useFrame(() => {
    if (!materialRef.current) return

    const material = materialRef.current

    // Update sky texture
    if (skyTextureRef.current && material.uniforms.skyTexture.value !== skyTextureRef.current) {
      material.uniforms.skyTexture.value = skyTextureRef.current
      material.uniformsNeedUpdate = true
    }

    // Update mask texture from pipeline module data
    if (maskTextureRef.current && material.uniforms.maskTexture.value !== maskTextureRef.current) {
      material.uniforms.maskTexture.value = maskTextureRef.current
    }
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Dispose mask texture
      if (maskTextureRef.current) {
        maskTextureRef.current.dispose()
        maskTextureRef.current = null
      }

      // Dispose shader material
      if (materialRef.current) {
        materialRef.current.dispose()
      }
    }
  }, [])

  useEffect(() => {
    if (!xr8) return

    const moduleName = 'sky-replacement'
    let glCtx: WebGLRenderingContext | WebGL2RenderingContext | null = null
    let framebuffer: WebGLFramebuffer | null = null

    xr8.addCameraPipelineModule({
      name: moduleName,
      onStart: (args: PipelineStartArgs) => {
        // Get WebGL context from XR8
        const canvas = args?.canvas
        if (canvas) {
          glCtx = canvas.getContext('webgl2') || canvas.getContext('webgl')
          if (glCtx) {
            framebuffer = glCtx.createFramebuffer()
          }
        }
      },
      onUpdate: (args: PipelineUpdateArgs) => {
        const processCpuResult = args?.processCpuResult
        const layersController = processCpuResult?.layerscontroller
        const skyLayer = layersController?.layers?.sky

        if (!skyLayer || !materialRef.current) return

        const percentage = skyLayer.percentage

        if (percentage === undefined || percentage < thresholdRef.current) {
          // Hide replacement when sky not detected
          if (materialRef.current.uniforms.opacity.value !== 0) {
            materialRef.current.uniforms.opacity.value = 0
          }
          return
        }

        // Show replacement when sky is detected
        if (materialRef.current.uniforms.opacity.value !== opacityRef.current) {
          materialRef.current.uniforms.opacity.value = opacityRef.current
        }

        // Update mask texture from sky layer
        if (
          skyLayer.texture &&
          skyLayer.textureWidth &&
          skyLayer.textureHeight &&
          glCtx &&
          framebuffer
        ) {
          try {
            const width = skyLayer.textureWidth
            const height = skyLayer.textureHeight
            const webglTexture = skyLayer.texture

            // Method 1: Try to wrap WebGL texture directly (may not work across contexts)
            // Method 2: Use readPixels to copy data (more reliable but slower)

            // Save current framebuffer
            const prevFramebuffer = glCtx.getParameter(glCtx.FRAMEBUFFER_BINDING)

            // Bind our framebuffer and attach the texture
            glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, framebuffer)
            glCtx.framebufferTexture2D(
              glCtx.FRAMEBUFFER,
              glCtx.COLOR_ATTACHMENT0,
              glCtx.TEXTURE_2D,
              webglTexture,
              0,
            )

            // Check if framebuffer is complete
            const status = glCtx.checkFramebufferStatus(glCtx.FRAMEBUFFER)
            if (status === glCtx.FRAMEBUFFER_COMPLETE) {
              // Read pixel data
              const pixels = new Uint8Array(width * height * 4) // RGBA
              glCtx.readPixels(0, 0, width, height, glCtx.RGBA, glCtx.UNSIGNED_BYTE, pixels)

              // Convert to grayscale data for RED format
              const grayData = new Uint8ClampedArray(width * height)
              for (let i = 0; i < width * height; i++) {
                grayData[i] = pixels[i * 4] // Use red channel (mask is grayscale)
              }

              // Create or update DataTexture
              if (!maskTextureRef.current) {
                const dataTexture = new THREE.DataTexture(grayData, width, height, THREE.RedFormat)
                dataTexture.minFilter = THREE.LinearFilter
                dataTexture.magFilter = THREE.LinearFilter
                dataTexture.needsUpdate = true
                maskTextureRef.current = dataTexture
              } else {
                // Update existing texture
                const dataTexture = maskTextureRef.current as THREE.DataTexture
                if (dataTexture.image.width !== width || dataTexture.image.height !== height) {
                  // Recreate if size changed
                  dataTexture.image = { data: grayData, width, height }
                  dataTexture.needsUpdate = true
                } else {
                  // Just update data
                  dataTexture.image.data.set(grayData)
                  dataTexture.needsUpdate = true
                }
              }
            }

            // Restore previous framebuffer
            glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, prevFramebuffer)
          } catch (err) {
            console.error('[SkyReplacement] Error reading WebGL texture:', err)
          }
        }
      },
    })

    return () => {
      if (glCtx && framebuffer) {
        glCtx.deleteFramebuffer(framebuffer)
      }
      if (xr8) {
        xr8.removeCameraPipelineModule(moduleName)
      }
    }
  }, [xr8])

  return (
    <mesh ref={meshRef} position={[0, 0, -1]} renderOrder={999}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        attach="material"
        {...shaderMaterial}
        transparent={true}
        depthTest={false}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
