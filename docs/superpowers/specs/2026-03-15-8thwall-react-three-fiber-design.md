# Design: @activeguild/8thwall-react-three-fiber

**Date:** 2026-03-15
**Status:** Approved

---

## Overview

An npm library that provides React Three Fiber components for 8th Wall image tracking. Modeled after the component structure of `zappar-react-three-fiber`, it allows developers to compose AR experiences declaratively using JSX.

```tsx
<EighthwallCanvas appKey="YOUR_8THWALL_APP_KEY">
  <EighthwallCamera />
  <ImageTracker targetImage="/targets/bird.json">
    <mesh>
      <sphereGeometry />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  </ImageTracker>
  <directionalLight />
</EighthwallCanvas>
```

---

## Scope

- **In scope:** Image tracking only
- **Out of scope:** Face tracking, instant/surface tracking, multi-target tracking (multiple `<ImageTracker>` instances are not supported in v1)
- **Engine:** 8th Wall XR engine (`xr.js`) from `endless-image-targets/external/xr/` — bundled into the npm package and injected as a `<script>` tag at runtime

---

## Package

| Field | Value |
|-------|-------|
| Name | `@activeguild/8thwall-react-three-fiber` |
| Language | TypeScript |
| Output | ESM + CJS |
| Type definitions | `.d.ts` via `tsc` |

**Peer dependencies:**
- `react >= 17`
- `@react-three/fiber >= 8`
- `three >= 0.140`

**Bundled asset:**
- `xr.js` — 8th Wall XR engine (IIFE/UMD global script). Included as a static asset and loaded via dynamic `<script>` tag injection at runtime (not imported as an ESM module, as it defines the `XR8` global).

---

## XR8 Engine Loading

Because `xr.js` is a global script (IIFE), it cannot be imported via ESM. Instead:

1. `xr.js` is copied into the library's `dist/` folder as a static asset.
2. `EighthwallCanvas` dynamically injects a `<script src="...xr.js">` tag on mount.
3. A `load` event on the script tag signals that `window.XR8` is available.
4. Only after the script is loaded does XR8 initialization proceed.

This approach is compatible with Vite and bundler setups that cannot `import` IIFE scripts directly.

---

## XR8 Initialization Sequence

The order of operations is critical — `XrController.configure` must be called before `XR8.run`:

```
1. <script src="xr.js"> injected → window.XR8 available
2. XR8.XrController.configure({ imageTargets: [name] })   ← must happen before run
3. XR8.run({ canvas, appKey })
4. XR8 emits `xrstarted` event
5. XRContext sets xr8 = window.XR8  (children now receive context)
6. EighthwallCamera & ImageTracker begin operating
```

To enforce step 2 before step 3, `EighthwallCanvas` collects target names from `ImageTracker` children (via context or a registration callback) before calling `XR8.run()`. Specifically:

- `ImageTracker` registers its target name upward via a `registerTarget(name)` callback from XRContext during its own mount phase (before XR8.run is called).
- `EighthwallCanvas` waits for all child `ImageTracker` registrations before invoking `XR8.run()`. Because React runs children's `useLayoutEffect` before the parent's `useLayoutEffect`, all `registerTarget` calls from child `ImageTracker` components will have completed by the time `EighthwallCanvas`'s own `useLayoutEffect` runs. `XR8.run()` is called synchronously inside that parent `useLayoutEffect`, after the collected target names array is ready.

---

## Architecture

### Component Tree

```
<EighthwallCanvas>           ← script injection + XR8 init + XRContext provider
  <EighthwallCamera />       ← per-frame camera matrix sync
  <ImageTracker>             ← target registration + pose application
    {children}               ← user's 3D content
  </ImageTracker>
</EighthwallCanvas>
```

### Components

#### `EighthwallCanvas`

- Renders an R3F `<Canvas>` with linear color encoding and tone mapping disabled (AR best practice)
- On mount:
  1. Injects `xr.js` as a `<script>` tag; waits for `load` event
  2. Reads registered target names collected from child `ImageTracker` mounts
  3. Calls `XR8.XrController.configure({ imageTargets: [...names] })`
  4. Calls `XR8.run({ canvas, appKey })`
  5. Listens for `xrstarted` event, then sets `xr8` in XRContext
- Camera video passthrough: XR8 internally manages the `getUserMedia` stream. The `xrcameraprocessed` event provides the rendered camera frame; we set `scene.background` from the XR8 camera feed texture (provided by XR8's camera pipeline).
- On unmount: stops XR8 and cleans up the injected script tag.
- Props include `appKey: string` (required) and `style?: CSSProperties`.

#### `EighthwallCamera`

- Consumes `XRContext`; renders nothing
- Listens to XR8's `xrcameraprocessed` event, which provides:
  - `cameraProjectionMatrix` — the physical camera's projection matrix (Float32Array, 16 elements)
  - `cameraTransform` — the camera's world transform (position + rotation)
- Inside `useFrame`: applies these to R3F's camera so Three.js renders from the same perspective as the physical camera. The `xrcameraprocessed` payload has the shape: `{ cameraProjectionMatrix: Float32Array (16), cameraTransform: { position: {x,y,z}, rotation: {x,y,z,w} } }`
- Note: `useFrame` requires this component to be rendered inside an R3F `<Canvas>` tree, which is guaranteed by the `<EighthwallCanvas>` wrapper.

#### `ImageTracker`

- On mount: calls `registerTarget(name)` from XRContext (before XR8.run is called). The `name` is derived from the `targetImage` prop by stripping the path and `.json` extension: `path.basename(targetImage, '.json')` (e.g., `"/targets/bird.json"` → `"bird"`). This name must match what the JSON descriptor uses and what XR8 expects.
- After `xrstarted`: attaches XR8 event listeners:
  - `xrimagefound` → set group visible, apply pose, call `onFound`
  - `xrimageupdated` → apply updated pose, call `onUpdated`
  - `xrimagelost` → set group invisible, call `onLost`
- Pose application: extracts `position` (THREE.Vector3) and `rotation` (THREE.Quaternion) from the XR8 event payload and applies them to the R3F `<group>`.
- Renders a `<group>` (initially invisible) containing `children`

---

## Types

```typescript
type EighthwallCanvasProps = {
  appKey: string                  // 8th Wall app key (required)
  children?: React.ReactNode
  style?: React.CSSProperties
}

type EighthwallCameraProps = {
  // reserved for future options
}

type ImageFoundEvent = {
  position: THREE.Vector3
  rotation: THREE.Quaternion
  scale: number
}

type ImageTrackerProps = {
  targetImage: string                          // path to JSON target descriptor
  onFound?: (event: ImageFoundEvent) => void
  onUpdated?: (event: ImageFoundEvent) => void
  onLost?: () => void
  children?: React.ReactNode
}

type XRContextValue = {
  xr8: typeof XR8 | null
  registerTarget: (name: string) => void       // called by ImageTracker before XR8.run
}
```

---

## Context

```typescript
const XRContext = createContext<XRContextValue>({
  xr8: null,
  registerTarget: () => {},
})
```

---

## Directory Structure

```
@activeguild/8thwall-react-three-fiber/
├── src/
│   ├── components/
│   │   ├── EighthwallCanvas.tsx
│   │   ├── EighthwallCamera.tsx
│   │   └── ImageTracker.tsx
│   ├── context/
│   │   └── XRContext.tsx
│   ├── engine/
│   │   └── xr.js              # copied from endless-image-targets/external/xr/xr.js
│   ├── types.ts
│   └── index.ts               # exports: EighthwallCanvas, EighthwallCamera, ImageTracker, types
├── example/
│   ├── src/
│   │   ├── App.tsx            # basic sphere on image detection
│   │   └── main.tsx
│   ├── public/
│   │   └── targets/           # sample target JSON + luminance JPEG files
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json           # references local package via "file:.."
├── package.json
├── vite.config.ts             # library mode build
└── tsconfig.json
```

---

## Public API Exports (`index.ts`)

```typescript
export { EighthwallCanvas } from './components/EighthwallCanvas'
export { EighthwallCamera } from './components/EighthwallCamera'
export { ImageTracker } from './components/ImageTracker'
export type { EighthwallCanvasProps, EighthwallCameraProps, ImageTrackerProps, ImageFoundEvent } from './types'
```

---

## Build Setup

**Library build (`vite.config.ts` — library mode):**
- Entry: `src/index.ts`
- Formats: `es`, `cjs`
- Externals: `react`, `react-dom`, `@react-three/fiber`, `three`
- `xr.js` is referenced via `new URL('../engine/xr.js', import.meta.url).href` inside `EighthwallCanvas`. Vite resolves this at build time and copies the asset to `dist/assets/xr.js`, returning the correct URL string. No additional `assetsInclude` config is needed for this pattern.

**Type generation:**
- `tsc --emitDeclarationOnly` outputs `.d.ts` to `dist/`

---

## Example App

Minimal Vite app in `example/`:

- Renders `<EighthwallCanvas appKey="...">` with `<EighthwallCamera />` and one `<ImageTracker>`
- On detection: shows a hotpink `<mesh>` with `<sphereGeometry />`
- Uses a sample target JSON from `endless-image-targets/image-targets/`
- Runs via `npm run dev` inside `example/`

---

## Out of Scope

- Face tracking
- Instant/surface world tracking
- Multi-target tracking (multiple `<ImageTracker>` instances in v1 — only one instance is supported; XrController.configure accepts all target names as a single array, so supporting multiple instances would require a collection step, deferred to v2)
- Camera mirroring options
- 8th Wall app key validation
