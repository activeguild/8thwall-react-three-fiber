import { useState, useEffect, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import { TextureLoader, VideoTexture } from 'three'
import { EighthwallCanvas, EighthwallCamera, ImageTracker, requestIMUPermission } from '@j1ngzoue/8thwall-react-three-fiber'

type ContentType = 'image' | 'cube' | 'video'

function MarkerImage() {
  const texture = useLoader(TextureLoader, '/targets/input_thumbnail.jpeg')
  return (
    <mesh>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

function MarkerCube() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  )
}

function MarkerVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [texture, setTexture] = useState<VideoTexture | null>(null)

  useEffect(() => {
    const video = document.createElement('video')
    video.src = '/input_video.mp4'
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.play()
    videoRef.current = video

    const tex = new VideoTexture(video)
    setTexture(tex)

    return () => {
      video.pause()
      tex.dispose()
    }
  }, [])

  if (!texture) return null

  return (
    <mesh>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

const selectStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  padding: '8px 12px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
}

const sensorButtonStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 40,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  padding: '12px 24px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  background: 'rgba(0,0,0,0.7)',
  color: '#fff',
  cursor: 'pointer',
}

export default function App() {
  const [content, setContent] = useState<ContentType>('image')
  const [showSensorButton, setShowSensorButton] = useState(true)

  async function handleSensorClick() {
    try {
      await requestIMUPermission()
    } catch (err) {
      console.error('IMU permission error:', err)
    } finally {
      setShowSensorButton(false)
    }
  }

  return (
    <>
      <select
        style={selectStyle}
        value={content}
        onChange={(e) => setContent(e.target.value as ContentType)}
      >
        <option value="image">マーカー画像</option>
        <option value="cube">キューブ</option>
        <option value="video">動画</option>
      </select>

      {showSensorButton && (
        <button style={sensorButtonStyle} onClick={handleSensorClick}>
          センサーを有効にする
        </button>
      )}

      <EighthwallCanvas
        xrSrc="/xr.js"
        xrResolution={0.5}
        style={{ width: '100vw', height: '100vh' }}
        onError={(err) => console.error('XR Error:', err)}
      >
        <EighthwallCamera />
        {content === 'cube' && <ambientLight intensity={1} />}
        <ImageTracker
          targetImage="/targets/input.json"
          onFound={(e) => console.log('input found! scale:', e.scale, 'position:', e.position)}
          onLost={() => console.log('input lost!')}
        >
          {content === 'image' && <MarkerImage />}
          {content === 'cube' && <MarkerCube />}
          {content === 'video' && <MarkerVideo />}
        </ImageTracker>
      </EighthwallCanvas>
    </>
  )
}
