import { useState } from 'react'
import { EighthwallCanvas, EighthwallCamera, SkyEffects } from '@j1ngzoue/8thwall-react-three-fiber'
import type { SkySegmentation } from '@j1ngzoue/8thwall-react-three-fiber'

/**
 * Sky Effects の使用例
 * 空が検出されたときに、空にオブジェクトを表示します
 */
export default function SkyEffectsExample() {
  const [skyDetected, setSkyDetected] = useState(false)
  const [detectionCount, setDetectionCount] = useState(0)

  function handleSkyDetected(segmentation: SkySegmentation) {
    if (!skyDetected) {
      setSkyDetected(true)
      console.log('空が検出されました:', segmentation)
    }
    setDetectionCount(prev => prev + 1)
  }

  function handleSkyLost() {
    setSkyDetected(false)
    console.log('空が失われました')
  }

  return (
    <>
      {/* ステータス表示 */}
      <div style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 10,
        padding: 12,
        borderRadius: 8,
        background: 'rgba(0,0,0,0.7)',
        color: '#fff',
        fontSize: 14,
      }}>
        <div>空の検出: {skyDetected ? '✓ 検出中' : '× 未検出'}</div>
        <div>更新回数: {detectionCount}</div>
      </div>

      <EighthwallCanvas
        xrSrc="/xr.js"
        enableSkyEffects={true}  // Sky Effects を有効化
        style={{ width: '100vw', height: '100vh' }}
        onError={(err) => console.error('XR Error:', err)}
      >
        <EighthwallCamera />
        <ambientLight intensity={1} />
        <directionalLight position={[5, 5, 5]} />

        {/* Sky Effects コンポーネント */}
        <SkyEffects
          onSkyDetected={handleSkyDetected}
          onSkyLost={handleSkyLost}
        >
          {/* 空に表示するオブジェクト */}
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
        </SkyEffects>
      </EighthwallCanvas>
    </>
  )
}
