# @j1ngzoue/8thwall-react-three-fiber

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

Build `xr.js` and `xr-tracking.js` from the official open-source repo:

```bash
git clone https://github.com/8thwall/8thwall.git
cd 8thwall/packages/engine
# follow the build instructions in that repo
```

Copy the built files to your project's public directory:

```
public/
  xr.js
  xr-tracking.js
  resources/
    media-worker.js
    semantics-worker.js
```

> `xr.js` must be served from the same origin as your app (not bundled). Serve it as a static file and pass the URL via the `xrSrc` prop.

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
| `appKey` | `string?` | 8th Wall app key (optional for open-source engine builds) |
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
