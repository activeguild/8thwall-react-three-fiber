import { EighthwallCanvas, EighthwallCamera, ImageTracker } from '@activeguild/8thwall-react-three-fiber'

const APP_KEY = import.meta.env.VITE_8THWALL_APP_KEY ?? ''

export default function App() {
  return (
    <EighthwallCanvas
      appKey={APP_KEY}
      xrSrc="/xr.js"
      style={{ width: '100vw', height: '100vh' }}
      onError={(err) => console.error('XR Error:', err)}
    >
      <EighthwallCamera />
      <ImageTracker
        targetImage="/targets/macaw.json"
        onFound={() => console.log('macaw found!')}
        onLost={() => console.log('macaw lost!')}
      >
        <mesh>
          <sphereGeometry args={[0.1, 32, 32]} />
          <meshStandardMaterial color="hotpink" />
        </mesh>
      </ImageTracker>
      <directionalLight position={[1, 2, 3]} intensity={1.5} />
    </EighthwallCanvas>
  )
}
