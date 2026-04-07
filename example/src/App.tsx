import { useState, useEffect, useRef, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { TextureLoader, VideoTexture } from 'three'
import { EighthwallCanvas, EighthwallCamera, ImageTracker, SkyEffects, SkyReplacement, useXRContext } from '@j1ngzoue/8thwall-react-three-fiber'
import type { SkySegmentation } from '@j1ngzoue/8thwall-react-three-fiber'
import { generateSkyTexture, type SkyType } from './generateSkyTexture'

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

function SkyObject() {
  return (
    <group position={[0, 2, -3]}>
      {/* 空に浮かぶ球体 */}
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* 周りを回るリング */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.1, 16, 32]} />
        <meshStandardMaterial
          color="#ff00ff"
          emissive="#ff00ff"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
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

const checkboxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
}

const statusStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 10,
  padding: 12,
  borderRadius: 8,
  background: 'rgba(0,0,0,0.7)',
  color: '#fff',
  fontSize: 14,
}

function CameraStartButton() {
  const { startCamera } = useXRContext()
  const [isStarting, setIsStarting] = useState(false)

  async function handleStartCamera() {
    setIsStarting(true)
    const success = await startCamera()
    if (!success) {
      alert('カメラの起動に失敗しました')
    }
    setIsStarting(false)
  }

  return (
    <button
      style={{
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
        cursor: isStarting ? 'not-allowed' : 'pointer',
        opacity: isStarting ? 0.5 : 1,
      }}
      onClick={handleStartCamera}
      disabled={isStarting}
    >
      {isStarting ? 'カメラを起動中...' : 'カメラを起動する'}
    </button>
  )
}

export default function App() {
  const [autoStart, setAutoStart] = useState(false)
  const [enableSkyEffects, setEnableSkyEffects] = useState(false)
  const [enableSkyReplacement, setEnableSkyReplacement] = useState(false)
  const [skyType, setSkyType] = useState<SkyType>('blue')
  const [skyDetected, setSkyDetected] = useState(false)
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

  function updateMarkerContent(markerName: string, content: ContentType) {
    setMarkers(prev =>
      prev.map(m => m.name === markerName ? { ...m, content } : m)
    )
  }

  function handleSkyDetected(segmentation: SkySegmentation) {
    if (!skyDetected) {
      setSkyDetected(true)
      console.log('空が検出されました:', segmentation)
    }
  }

  function handleSkyLost() {
    setSkyDetected(false)
    console.log('空が失われました')
  }

  // Generate sky texture
  const skyTexture = useMemo(() => {
    return generateSkyTexture(skyType, 1024)
  }, [skyType])

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

        {/* Sky Effects トグル */}
        <label style={checkboxStyle}>
          <input
            type="checkbox"
            checked={enableSkyEffects}
            onChange={(e) => setEnableSkyEffects(e.target.checked)}
          />
          <span style={labelStyle}>Sky Effects</span>
        </label>

        {/* Sky Replacement トグル */}
        <label style={checkboxStyle}>
          <input
            type="checkbox"
            checked={enableSkyReplacement}
            onChange={(e) => setEnableSkyReplacement(e.target.checked)}
          />
          <span style={labelStyle}>Sky Replacement</span>
        </label>

        {/* Sky Type選択 */}
        {enableSkyReplacement && (
          <div style={markerControlStyle}>
            <span style={labelStyle}>Sky Type:</span>
            <select
              style={selectStyle}
              value={skyType}
              onChange={(e) => setSkyType(e.target.value as SkyType)}
            >
              <option value="blue">青空 (Blue Sky)</option>
              <option value="sunset">夕焼け (Sunset)</option>
              <option value="night">夜空 (Night Sky)</option>
            </select>
          </div>
        )}

        {/* Auto Start トグル */}
        <label style={checkboxStyle}>
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
          />
          <span style={labelStyle}>Auto Start Camera</span>
        </label>
      </div>

      {/* Sky 検出ステータス */}
      {enableSkyEffects && (
        <div style={statusStyle}>
          <div>空の検出: {skyDetected ? '✓ 検出中' : '× 未検出'}</div>
        </div>
      )}

      <EighthwallCanvas
        xrSrc="/xr.js"
        enableSkyEffects={enableSkyEffects || enableSkyReplacement}
        autoStart={autoStart}
        disableWorldTracking={!(enableSkyEffects || enableSkyReplacement)}
        style={{ width: '100vw', height: '100vh' }}
        onError={(err) => console.error('XR Error:', err)}
        overlayChildren={!autoStart ? <CameraStartButton /> : undefined}
      >
        <EighthwallCamera />
        <ambientLight intensity={1} />
        <directionalLight position={[5, 5, 5]} />

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

        {/* Sky Effects */}
        {enableSkyEffects && (
          <SkyEffects
            detectionThreshold={0.8}  // 0.0 - 1.0 (default: 0.8)
            onSkyDetected={handleSkyDetected}
            onSkyLost={handleSkyLost}
          >
            <SkyObject />
          </SkyEffects>
        )}

        {/* Sky Replacement */}
        {enableSkyReplacement && (
          <SkyReplacement
            texture={skyTexture}
            detectionThreshold={0.8}
            opacity={1.0}
          />
        )}
      </EighthwallCanvas>
    </>
  )
}
