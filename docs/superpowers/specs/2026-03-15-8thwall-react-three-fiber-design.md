# Design: @activeguild/8thwall-react-three-fiber

**Date:** 2026-03-15
**Status:** Approved

---

## Overview

An npm library that provides React Three Fiber components for 8th Wall image tracking. Modeled after the component structure of `zappar-react-three-fiber`, it allows developers to compose AR experiences declaratively using JSX.

```tsx
<EighthwallCanvas>
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
- **Out of scope:** Face tracking, instant/surface tracking
- **Engine:** 8th Wall XR engine files from `endless-image-targets/external/xr/` — bundled into the npm package

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

**Bundled dependency:**
- `external/xr/xr.js` — 8th Wall XR engine (copied into `src/engine/`)

---

## Architecture

### Component Tree

```
<EighthwallCanvas>           ← R3F Canvas wrapper + XR8 init + XRContext provider
  <EighthwallCamera />       ← per-frame camera matrix sync
  <ImageTracker>             ← target registration + pose application
    {children}               ← user's 3D content
  </ImageTracker>
</EighthwallCanvas>
```

### Components

#### `EighthwallCanvas`

- Renders an R3F `<Canvas>` with `linear` color encoding and tone mapping disabled (AR best practice)
- On mount: loads `xr.js` engine and calls `XR8.run({ canvas })`
- Captures camera video stream and creates a `THREE.VideoTexture`
- Sets `scene.background` to the video texture for AR passthrough
- Provides `XRContext` to descendants: `{ xr8: XR8Instance }`

#### `EighthwallCamera`

- Consumes `XRContext`
- Inside `useFrame`: reads XR8's camera projection matrix and view matrix each frame
- Applies them to the R3F camera, overriding its default behaviour
- This aligns the Three.js render with the physical camera's perspective

#### `ImageTracker`

- Props: `targetImage: string`, `onFound?: () => void`, `onLost?: () => void`, `children?: ReactNode`
- On mount: fetches the JSON file at `targetImage`, extracts target name, and registers it with XR8 via `XR8.XrController.configure({ imageTargets: [name] })`
- Listens for XR8 events:
  - `xrimagefound` → set group visible, apply pose
  - `xrimageupdated` → apply updated pose
  - `xrimagelost` → set group invisible
- Renders a `<group>` in the R3F scene; pose (position + quaternion) is updated each event
- `children` are mounted inside the group and become visible/hidden automatically

### Data Flow

```
XR8.run() starts
    │
    ├─ Camera video → VideoTexture → scene.background (passthrough AR)
    │
    ├─ Per frame (useFrame in EighthwallCamera)
    │     XR8 camera matrices → R3F camera.projectionMatrix / matrixWorldInverse
    │
    └─ On image detection (ImageTracker)
          xrimagefound/xrimageupdated → group.position, group.quaternion updated
          xrimagelost → group.visible = false
```

### Context

```typescript
type XRContextValue = {
  xr8: typeof XR8 | null
}
const XRContext = createContext<XRContextValue>({ xr8: null })
```

---

## Types

```typescript
type ImageTrackerProps = {
  targetImage: string       // path to JSON target descriptor
  onFound?: () => void
  onLost?: () => void
  children?: React.ReactNode
}

type EighthwallCameraProps = {
  // reserved for future options (mirror, etc.)
}

type EighthwallCanvasProps = {
  children?: React.ReactNode
  style?: React.CSSProperties
}
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
│   └── index.ts
├── example/
│   ├── src/
│   │   ├── App.tsx            # basic sphere on image detection
│   │   └── main.tsx
│   ├── public/
│   │   └── targets/           # sample target JSON files
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json           # references local package via file:..
├── package.json
├── vite.config.ts             # library mode build
└── tsconfig.json
```

---

## Build Setup

**Library build (`vite.config.ts` — library mode):**
- Entry: `src/index.ts`
- Formats: `es`, `cjs`
- Externals: `react`, `react-dom`, `@react-three/fiber`, `three`
- `xr.js` included as a static asset copied to `dist/`

**Type generation:**
- `tsc --emitDeclarationOnly` outputs `.d.ts` to `dist/`

---

## Example App

Minimal Vite app in `example/`:

- Renders `<EighthwallCanvas>` with `<EighthwallCamera />` and one `<ImageTracker>`
- On detection: shows a hotpink `<mesh>` with `<sphereGeometry />`
- Uses a sample target JSON from `endless-image-targets/image-targets/`
- Runs via `npm run dev` inside `example/`

---

## Out of Scope

- Face tracking
- Instant/surface world tracking
- Multi-target tracking (multiple `<ImageTracker>` instances may work but not explicitly tested in v1)
- 8th Wall authentication / app key management (assumed handled externally by the user)
