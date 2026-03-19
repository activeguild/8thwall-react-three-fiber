import * as THREE from 'three'

export type SkyType = 'blue' | 'sunset' | 'night'

/**
 * Generate a sky texture using Canvas API
 */
export function generateSkyTexture(type: SkyType = 'blue', resolution: number = 1024): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = resolution
  canvas.height = resolution

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, resolution)

  switch (type) {
    case 'blue':
      gradient.addColorStop(0, '#0066cc')    // Top: deep blue
      gradient.addColorStop(0.5, '#3399ff')  // Middle: bright blue
      gradient.addColorStop(1, '#ccddff')    // Bottom: light blue
      break

    case 'sunset':
      gradient.addColorStop(0, '#ff6b35')    // Top: orange
      gradient.addColorStop(0.3, '#f7931e')  // Middle-top: warm orange
      gradient.addColorStop(0.6, '#fbb040')  // Middle-bottom: yellow
      gradient.addColorStop(1, '#ffcf99')    // Bottom: light yellow
      break

    case 'night':
      gradient.addColorStop(0, '#000814')    // Top: very dark blue
      gradient.addColorStop(0.5, '#001d3d')  // Middle: dark blue
      gradient.addColorStop(1, '#003566')    // Bottom: medium dark blue
      break
  }

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, resolution, resolution)

  // Add stars for night sky
  if (type === 'night') {
    ctx.fillStyle = 'white'
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * resolution
      const y = Math.random() * resolution * 0.7 // Stars in top 70%
      const size = Math.random() * 2 + 0.5
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    // Add subtle noise for other sky types
    const imageData = ctx.getImageData(0, 0, resolution, resolution)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 10
      data[i] += noise     // R
      data[i + 1] += noise // G
      data[i + 2] += noise // B
    }

    ctx.putImageData(imageData, 0, 0)
  }

  // Create THREE.js texture from canvas
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

  return texture
}
