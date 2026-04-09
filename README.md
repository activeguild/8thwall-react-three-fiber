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
| `autoStart` | `boolean?` | Auto-start camera on mount. If `false`, call `startCamera()` to start manually. Default: `true` |
| `disableWorldTracking` | `boolean?` | Disable 6DoF world tracking. Skips DeviceMotion permission on iOS. Image tracking still works. Default: `true` |
| `enableSkyEffects` | `boolean?` | Enable sky segmentation module |
| `gl` | `Record<string, unknown>?` | WebGL renderer parameters passed to R3F Canvas. `alpha: true` is always forced. |
| `dpr` | `number \| [number, number]?` | Device pixel ratio for R3F Canvas |
| `id` | `string?` | HTML id attribute for the container element |
| `rearCameraDeviceId` | `string?` | Specific rear camera device ID (iOS 17+) |
| `style` | `CSSProperties?` | Style applied to the container `div` |
| `overlayChildren` | `ReactNode?` | HTML elements rendered inside context but outside the R3F Canvas |
| `onError` | `(err: unknown) => void` | Called when XR initialization fails |

Internally creates two stacked canvases:
- **Back**: XR8 renders the camera feed
- **Front**: R3F renders the 3D scene (transparent background)

#### Manual Camera Start

To request camera permission at a specific time (e.g., after user clicks a button):

```tsx
import { EighthwallCanvas, useXRContext } from '@j1ngzoue/8thwall-react-three-fiber'

function StartButton() {
  const { startCamera } = useXRContext()

  async function handleClick() {
    const success = await startCamera()
    if (!success) {
      alert('Failed to start camera')
    }
  }

  return <button onClick={handleClick}>Start AR</button>
}

function App() {
  return (
    <EighthwallCanvas xrSrc="/xr.js" autoStart={false}>
      <StartButton />
      {/* Your AR content */}
    </EighthwallCanvas>
  )
}
```

#### Screenshot / Video Recording

To enable `canvas.toDataURL()` or `canvas.captureStream()`, set `preserveDrawingBuffer`:

```tsx
<EighthwallCanvas
  xrSrc="/xr.js"
  id="ar-canvas"
  gl={{ preserveDrawingBuffer: true }}
  dpr={2}
>
  {/* ... */}
</EighthwallCanvas>
```

```ts
const canvas = document.querySelector('#ar-canvas canvas:last-of-type') as HTMLCanvasElement
const dataUrl = canvas.toDataURL('image/png', 1)
```

### `<EighthwallCamera>`

Updates the Three.js camera to match the physical device camera each frame. Place inside `<EighthwallCanvas>`.

| Prop | Type | Description |
|------|------|-------------|
| `fov` | `number?` | Vertical FOV in degrees. Auto-estimated from video resolution if omitted. |
| `onFirstFrame` | `() => void` | Fired once when the first camera frame is received. Useful for dismissing loading UI. |

### `<ImageTracker>`

Tracks an image target and shows its children at the tracked position. Place inside `<EighthwallCanvas>`.

| Prop | Type | Description |
|------|------|-------------|
| `targetImage` | `string` | Path to the target `.json` file (e.g. `"/targets/my-target.json"`) |
| `enabled` | `boolean?` | Enable/disable tracking dynamically. Default: `true` |
| `onFound` | `(event: ImageFoundEvent) => void` | Called when the target is first detected |
| `onUpdated` | `(event: ImageFoundEvent) => void` | Called each frame the target is tracked |
| `onLost` | `() => void` | Called when the target is no longer detected |
| `children` | `ReactNode?` | 3D content to show at the target position |

```ts
interface ImageFoundEvent {
  position: THREE.Vector3
  rotation: THREE.Quaternion
  scale: number
  imageWidth: number   // Target image width in pixels
  imageHeight: number  // Target image height in pixels
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

### `useXRContext()`

Hook to access XR context. Must be used inside `<EighthwallCanvas>`.

**Returns:**
- `xr8`: XR8 instance (available after initialization)
- `registerTarget(path)`: Register an image target JSON file
- `startCamera()`: Start the camera manually (only when `autoStart={false}`)
- `getTargetMetadata(name)`: Get image dimensions `{ imageWidth, imageHeight }` for a registered target

### `permissionGranted()` / `permissionDenied()` / `permissionRequest()`

Camera permission utilities. Use **before** mounting `<EighthwallCanvas>` to check/request camera access.

```tsx
import { permissionRequest } from '@j1ngzoue/8thwall-react-three-fiber'

function ARScreen() {
  const [permitted, setPermitted] = useState<boolean | null>(null)

  useEffect(() => {
    permissionRequest().then(setPermitted)
  }, [])

  if (permitted === null) return <div>Checking camera permission...</div>
  if (!permitted) return <div>Camera permission required</div>

  return (
    <EighthwallCanvas xrSrc="/xr.js" autoStart={true}>
      {/* AR content */}
    </EighthwallCanvas>
  )
}
```

> **Important:** Do not call `permissionRequest()` after `<EighthwallCanvas>` has mounted. XR8 manages its own camera stream — calling `getUserMedia` concurrently will conflict.

### `checkBrowserCompatibility()`

Check browser support for AR features.

```tsx
import { checkBrowserCompatibility } from '@j1ngzoue/8thwall-react-three-fiber'

const result = checkBrowserCompatibility()
// { compatible: true, issues: [] }
// { compatible: false, issues: ['WebGL2 not supported', 'getUserMedia not available'] }
```

Checks: WebGL, `getUserMedia`, `captureStream`.

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
