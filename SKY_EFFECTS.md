# Sky Effects サポート

このライブラリは8th Wall OSSのSky Effects機能をサポートしています。

## 実装状況

✅ `SkyEffects`コンポーネントを実装済み
✅ `LayersController`の設定を自動化
✅ 空の検出イベントのコールバック対応
✅ デバッグログの実装

## 必要な条件

### 1. Sky Effectsを含む8th Wallバンドル

現在使用している8th Wallバンドル(`xr.js`)に**SkyEffectsモジュールが含まれている必要があります**。

バンドルを確認するには：

```bash
grep -o "SkyEffects" /path/to/your/xr.js
```

### 2. バンドルの配置

Sky Effectsを含むバンドルファイルを以下に配置してください：

```
example/public/
├── xr.js              # SkyEffectsモジュールを含むバージョン
├── xr-tracking.js
└── resources/         # リソースディレクトリ
```

## 使い方

### 基本的な使用例

```typescript
import { EighthwallCanvas, EighthwallCamera, SkyEffects } from '@j1ngzoue/8thwall-react-three-fiber'
import type { SkySegmentation } from '@j1ngzoue/8thwall-react-three-fiber'

function App() {
  function handleSkyDetected(segmentation: SkySegmentation) {
    console.log('空が検出されました:', segmentation.isSkyDetected)
  }

  return (
    <EighthwallCanvas
      xrSrc="/xr.js"
      enableSkyEffects={true}  // 重要: これを有効にする
    >
      <EighthwallCamera />
      <ambientLight intensity={1} />
      <directionalLight position={[5, 5, 5]} />

      <SkyEffects
        detectionThreshold={0.8}  // 検出閾値 0.0 - 1.0 (デフォルト: 0.8)
        onSkyDetected={handleSkyDetected}
        onSkyLost={() => console.log('空が失われました')}
      >
        {/* 空に表示するオブジェクト */}
        <mesh position={[0, 2, -3]}>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial
            color="#00ffff"
            emissive="#00ffff"
            emissiveIntensity={0.5}
          />
        </mesh>
      </SkyEffects>
    </EighthwallCanvas>
  )
}
```

### 検出閾値（detectionThreshold）の調整

`detectionThreshold`は空の検出感度を調整します（0.0 - 1.0）：

```typescript
// とても敏感（少しでも空が見えれば検出）
<SkyEffects detectionThreshold={0.1}>

// 中程度（画面の半分が空なら検出）
<SkyEffects detectionThreshold={0.5}>

// 厳格（画面のほとんどが空でないと検出しない）デフォルト
<SkyEffects detectionThreshold={0.8}>
```

**推奨設定:**
- **屋外**: `0.8` （デフォルト）- 確実に空を向いている時のみ検出
- **屋内（窓あり）**: `0.3 - 0.5` - 窓越しの空でも検出しやすく
- **テスト用**: `0.1` - 少しでも空が見えれば検出
```

## デバッグ

ブラウザの開発者コンソールで以下のログを確認してください：

### 成功時のログ

```
[8thwall-r3f] XR8 initialized
[8thwall-r3f] Enabling Sky Effects
[8thwall-r3f] Adding LayersController module
[8thwall-r3f] LayersController configured with sky layer
[SkyEffects] Registering sky effects pipeline module
[SkyEffects] Pipeline module started
[SkyEffects] Sky detected! percentage: 84.4%  ← 空の検出率
```

**percentage の意味:**
- `0% - 10%`: ほとんど空が見えない
- `10% - 50%`: 一部空が見える
- `50% - 80%`: 画面の多くが空
- `80% - 100%`: ほぼ全画面が空

### エラーが出る場合

#### `LayersController not available in XR8`

バンドルが古い、またはLayersControllerが含まれていません。

#### `sky layer not found`

LayersControllerはありますが、Sky Effectsが有効化されていません。
`enableSkyEffects={true}`を設定してください。

#### 空が検出されない

1. **カメラを空に向けてください**（上を向く）
2. **屋外または窓の近く**で試してください
3. **検出閾値を下げてください**: `detectionThreshold={0.3}`
4. コンソールで`percentage`の値を確認してください

## 参考リソース

8th Wallの公式Sky Effectsサンプル:
- https://github.com/8thwall/archive/tree/main/apps/examples/sky-effects-threejs

## トラブルシューティング

### Sky Effectsが動作しない

1. `enableSkyEffects={true}`を設定していることを確認
2. コンソールログを確認
3. バンドルに`SkyEffects`モジュールが含まれているか確認
4. カメラが空を向いているか確認（屋内では検出されません）

### 8th Wallバンドルの入手方法

**重要**: 現在使用しているバンドル（`/Users/j1ngzoue/projects/8thwall/bazel-bin/reality/app/xr/js/bundle/`）には`SkyEffects`が含まれていません。

8th Wallの最新バージョンまたはSky Effectsを含むバージョンを入手する必要があります。

## API

### EighthwallCanvasProps

```typescript
interface EighthwallCanvasProps {
  xrSrc: string
  enableSkyEffects?: boolean  // Sky Effectsを有効化
  children?: React.ReactNode
  style?: React.CSSProperties
  onError?: (err: unknown) => void
}
```

### SkyEffectsProps

```typescript
interface SkyEffectsProps {
  /**
   * Detection threshold (0.0 - 1.0)
   * Sky is considered detected when percentage exceeds this value.
   * Default: 0.8 (80%)
   */
  detectionThreshold?: number

  /** Callback when sky is detected */
  onSkyDetected?: (segmentation: SkySegmentation) => void

  /** Callback when sky is lost */
  onSkyLost?: () => void

  children?: React.ReactNode
}

interface SkySegmentation {
  /** Whether sky is currently detected */
  isSkyDetected: boolean

  /** Segmentation mask (optional, for advanced usage) */
  mask?: ImageData
}
```

## 制限事項

- Sky Effectsは**空のセグメンテーション**のみを提供します
- SLAM（ワールドトラッキング）は含まれていません
- 屋内や曇天では検出精度が低下する可能性があります
- 8th Wall OSSのバージョンによっては機能が異なる場合があります
