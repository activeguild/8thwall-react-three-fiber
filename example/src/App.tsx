import { useLoader } from '@react-three/fiber'
import { TextureLoader } from 'three'
import { EighthwallCanvas, EighthwallCamera, ImageTracker } from '@j1ngzoue/8thwall-react-three-fiber'

function MarkerImage() {
  const texture = useLoader(TextureLoader, '/targets/input_thumbnail.jpeg')
  return (
    <mesh>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

export default function App() {
  return (
    <EighthwallCanvas
      xrSrc="/xr.js"
      style={{ width: '100vw', height: '100vh' }}
      onError={(err) => console.error('XR Error:', err)}
    >
      <EighthwallCamera />
      <ImageTracker
        targetImage="/targets/input.json"
        onFound={(e) => console.log('input found! scale:', e.scale, 'position:', e.position)}
        onLost={() => console.log('input lost!')}
      >
        <MarkerImage />
      </ImageTracker>
    </EighthwallCanvas>
  )
}
