import { useState, useEffect, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import { TextureLoader, VideoTexture } from 'three'
import { EighthwallCanvas, EighthwallCamera, ImageTracker, requestIMUPermission } from '@j1ngzoue/8thwall-react-three-fiber'

type ContentType = 'image' | 'cube' | 'video'

type MarkerConfig = {
  name: string
  targetImage: string
  thumbnailImage: string
  content: ContentType
}

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

const controlsStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 8,
  background: 'rgba(0,0,0,0.7)',
}

const markerControlStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const labelStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 14,
  fontWeight: 'bold',
  minWidth: 60,
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 14,
  borderRadius: 6,
  border: 'none',
  background: 'rgba(255,255,255,0.9)',
  color: '#000',
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
  const [showSensorButton, setShowSensorButton] = useState(true)
  const [markers, setMarkers] = useState<MarkerConfig[]>([
    {
      name: 'input',
      targetImage: '/targets/input.json',
      thumbnailImage: '/targets/input_thumbnail.jpeg',
      content: 'image'
    },
    {
      name: 'input2',
      targetImage: '/targets/input2.json',
      thumbnailImage: '/targets/input2.png',
      content: 'cube'
    }
  ])

  async function handleSensorClick() {
    try {
      await requestIMUPermission()
    } catch (err) {
      console.error('IMU permission error:', err)
    } finally {
      setShowSensorButton(false)
    }
  }

  function updateMarkerContent(markerName: string, content: ContentType) {
    setMarkers(prev =>
      prev.map(m => m.name === markerName ? { ...m, content } : m)
    )
  }

  return (
    <>
      <div style={controlsStyle}>
        {markers.map(marker => (
          <div key={marker.name} style={markerControlStyle}>
            <span style={labelStyle}>{marker.name}:</span>
            <select
              style={selectStyle}
              value={marker.content}
              onChange={(e) => updateMarkerContent(marker.name, e.target.value as ContentType)}
            >
              <option value="image">マーカー画像</option>
              <option value="cube">キューブ</option>
              <option value="video">動画</option>
            </select>
          </div>
        ))}
      </div>

      {showSensorButton && (
        <button style={sensorButtonStyle} onClick={handleSensorClick}>
          センサーを有効にする
        </button>
      )}

      <EighthwallCanvas
        xrSrc="/xr.js"
        style={{ width: '100vw', height: '100vh' }}
        onError={(err) => console.error('XR Error:', err)}
      >
        <EighthwallCamera />
        <ambientLight intensity={1} />

        {markers.map(marker => (
          <ImageTracker
            key={marker.name}
            targetImage={marker.targetImage}
            onFound={(e) => console.log(`${marker.name} found! scale:`, e.scale, 'position:', e.position)}
            onLost={() => console.log(`${marker.name} lost!`)}
          >
            {marker.content === 'image' && <MarkerImage />}
            {marker.content === 'cube' && <MarkerCube />}
            {marker.content === 'video' && <MarkerVideo />}
          </ImageTracker>
        ))}
      </EighthwallCanvas>
    </>
  )
}
