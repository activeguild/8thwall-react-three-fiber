# @j1ngzoue/8thwall-react-three-fiber

> **⚠️ Experimental** — This package is under active development. APIs may change without notice. Not recommended for production use.

React Three Fiber components for [8th Wall](https://www.8thwall.com/) image tracking. Uses the open-source 8th Wall engine ([packages/engine](https://github.com/8thwall/8thwall/tree/main/packages/engine)).

## Installation

```bash
npm install @j1ngzoue/8thwall-react-three-fiber
```

**Peer dependencies:**

```bash
npm install @react-three/fiber react react-dom three
```

## Setup

### 1. Get the 8th Wall engine

The engine files are bundled with this package under the `8thwall/` directory:

```
node_modules/@j1ngzoue/8thwall-react-three-fiber/8thwall/
  xr.js
  xr-tracking.js
  resources/
    media-worker.js
    semantics-worker.js
```

Copy them to your project's public directory (or any location your dev server can serve):

```bash
cp -r node_modules/@j1ngzoue/8thwall-react-three-fiber/8thwall/. public/
```

> `xr.js` must be served as a **static file** (not bundled by Vite). Pass its public URL via the `xrSrc` prop.

### 2. Generate image targets

Use the [8th Wall image-target-cli](https://github.com/8thwall/8thwall/tree/main/apps/image-target-cli) or the provided `generate-target.mjs` script to generate target data from your image:

```
public/targets/
  my-target.json
  my-target_luminance.jpeg
  my-target_thumbnail.jpeg
  my-target_cropped.jpeg
```

The `imagePath` field in the JSON must resolve relative to your page URL (e.g. `/targets/my-target_luminance.jpeg`).

## Usage

```tsx
import { EighthwallCanvas, EighthwallCamera, ImageTracker } from '@j1ngzoue/8thwall-react-three-fiber'

export default function App() {
  return (
    <EighthwallCanvas
      xrSrc="/xr.js"
      style={{ width: '100vw', height: '100vh' }}
      onError={(err) => console.error(err)}
    >
      <EighthwallCamera />
      <ImageTracker
        targetImage="/targets/my-target.json"
        onFound={() => console.log('target found!')}
        onLost={() => console.log('target lost!')}
      >
        <mesh>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color="hotpink" />
        </mesh>
      </ImageTracker>
      <directionalLight position={[1, 2, 3]} intensity={1.5} />
    </EighthwallCanvas>
  )
}
```

## API

### `<EighthwallCanvas>`

Root component. Sets up the XR session and provides context to child components.

| Prop | Type | Description |
|------|------|-------------|
| `xrSrc` | `string` | URL to `xr.js` (must be a static file, not bundled) |
| `style` | `CSSProperties?` | Style applied to the container `div` |
| `onError` | `(err: unknown) => void` | Called when XR initialization fails |

Internally creates two stacked canvases:
- **Back**: XR8 renders the camera feed
- **Front**: R3F renders the 3D scene (transparent background)

### `<EighthwallCamera>`

Updates the Three.js camera to match the physical device camera each frame. Place inside `<EighthwallCanvas>`.

No props.

### `<ImageTracker>`

Tracks an image target and shows its children at the tracked position. Place inside `<EighthwallCanvas>`.

| Prop | Type | Description |
|------|------|-------------|
| `targetImage` | `string` | Path to the target `.json` file (e.g. `"/targets/my-target.json"`) |
| `onFound` | `(event: ImageFoundEvent) => void` | Called when the target is first detected |
| `onUpdated` | `(event: ImageFoundEvent) => void` | Called each frame the target is tracked |
| `onLost` | `() => void` | Called when the target is no longer detected |
| `children` | `ReactNode?` | 3D content to show at the target position |

```ts
interface ImageFoundEvent {
  position: THREE.Vector3
  rotation: THREE.Quaternion
  scale: number
}
```

### `<SkyEffects>`

Detects sky in the camera feed and shows children when sky is detected. Requires `enableSkyEffects={true}` on `<EighthwallCanvas>`.

| Prop | Type | Description |
|------|------|-------------|
| `detectionThreshold` | `number?` | Detection threshold (0.0 - 1.0). Default: 0.8 |
| `onSkyDetected` | `(segmentation: SkySegmentation) => void` | Called when sky is detected |
| `onSkyLost` | `() => void` | Called when sky is lost |
| `children` | `ReactNode?` | 3D content to show when sky is detected |

```tsx
<EighthwallCanvas xrSrc="/xr.js" enableSkyEffects={true}>
  <EighthwallCamera />
  <SkyEffects
    detectionThreshold={0.8}
    onSkyDetected={(seg) => console.log('Sky detected!', seg)}
  >
    <mesh position={[0, 2, -3]}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="#00ffff" />
    </mesh>
  </SkyEffects>
</EighthwallCanvas>
```

### `<SkyReplacement>`

Replaces the detected sky area with a custom texture or video. Requires `enableSkyEffects={true}` on `<EighthwallCanvas>`.

| Prop | Type | Description |
|------|------|-------------|
| `texture` | `THREE.Texture?` | Image texture to replace the sky |
| `videoSrc` | `string?` | Video source URL to replace the sky |
| `detectionThreshold` | `number?` | Detection threshold (0.0 - 1.0). Default: 0.8 |
| `opacity` | `number?` | Opacity of the replacement (0.0 - 1.0). Default: 1.0 |

```tsx
<EighthwallCanvas xrSrc="/xr.js" enableSkyEffects={true}>
  <EighthwallCamera />
  <SkyReplacement
    videoSrc="/sky-video.mp4"
    detectionThreshold={0.8}
    opacity={1.0}
  />
</EighthwallCanvas>
```

### `<FaceTracker>`

Tracks a detected face and updates children position/rotation based on face movement. Requires `enableFaceTracking={true}` on `<EighthwallCanvas>`.

| Prop | Type | Description |
|------|------|-------------|
| `faceId` | `number?` | Face ID to track (default: 0 for first face) |
| `onFaceFound` | `(event: FaceFoundEvent) => void` | Called when face is detected |
| `onFaceUpdated` | `(event: FaceFoundEvent) => void` | Called each frame |
| `onFaceLost` | `() => void` | Called when face tracking is lost |
| `children` | `ReactNode?` | 3D content to attach to the face |

```tsx
<EighthwallCanvas xrSrc="/xr.js" enableFaceTracking={true}>
  <EighthwallCamera />
  <FaceTracker
    onFaceFound={(e) => console.log('Face found!', e)}
    onFaceLost={() => console.log('Face lost!')}
  >
    <mesh>
      <sphereGeometry args={[0.1, 32, 32]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  </FaceTracker>
</EighthwallCanvas>
```

### `<FaceAttachment>`

Attaches children to a specific point on the face. Must be used inside `<FaceTracker>`.

| Prop | Type | Description |
|------|------|-------------|
| `point` | `AttachmentPointName` | Attachment point: 'noseBridge', 'forehead', 'leftEye', 'rightEye', 'mouth' |
| `offset` | `[number, number, number]?` | Position offset from attachment point |
| `children` | `ReactNode?` | 3D content to place at the attachment point |

```tsx
<FaceTracker>
  {/* Place sunglasses on nose */}
  <FaceAttachment point="noseBridge" offset={[0, 0.02, 0]}>
    <mesh>
      <boxGeometry args={[0.1, 0.05, 0.02]} />
      <meshStandardMaterial color="#333" transparent opacity={0.3} />
    </mesh>
  </FaceAttachment>

  {/* Place hat on forehead */}
  <FaceAttachment point="forehead" offset={[0, 0.05, 0]}>
    <mesh>
      <cylinderGeometry args={[0.08, 0.1, 0.05, 32]} />
      <meshStandardMaterial color="red" />
    </mesh>
  </FaceAttachment>
</FaceTracker>
```

### `<FaceMesh>`

Displays a 3D mesh that conforms to the detected face shape. Useful for makeup, tattoos, or face paint effects.

**Note:** Requires `XRExtras.ThreeExtras.faceMesh()` which may not be available in all 8th Wall builds.

| Prop | Type | Description |
|------|------|-------------|
| `texture` | `THREE.Texture?` | Texture to apply to face mesh |
| `alphaMap` | `THREE.Texture?` | Alpha map for transparency (e.g., hide eyes/mouth) |
| `materialProps` | `Partial<THREE.MeshStandardMaterialParameters>?` | Additional material properties |

```tsx
<FaceTracker>
  <FaceMesh
    texture={tattooTexture}
    alphaMap={eyesMouthAlphaMap}
  />
</FaceTracker>
```

## How it works

- `EighthwallCanvas` loads `xr.js` as an external script (via `<script>` tag, not bundled by Vite)
- Image target JSON files are fetched and passed to `XrController.configure({ imageTargetData })`
- Camera feed and 3D scene are rendered to separate canvases to avoid overwriting each other
- All XR8 events use the pipeline module `listeners` API (`reality.imagefound`, `reality.imageupdated`, `reality.imagelost`) — not DOM events

## Publishing

Releases are published to npm automatically when a version tag is pushed to `main`:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

## License

MIT
