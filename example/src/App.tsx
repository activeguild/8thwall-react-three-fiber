import { EighthwallCanvas, EighthwallCamera, ImageTracker } from '@j1ngzoue/8thwall-react-three-fiber'

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
        onFound={() => console.log('input found!')}
        onLost={() => console.log('input lost!')}
      >
        <mesh>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial color="hotpink" />
        </mesh>
      </ImageTracker>
      <directionalLight position={[1, 2, 3]} intensity={1.5} />
    </EighthwallCanvas>
  )
}
