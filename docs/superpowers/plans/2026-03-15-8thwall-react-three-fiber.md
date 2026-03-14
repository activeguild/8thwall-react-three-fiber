# @activeguild/8thwall-react-three-fiber Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an npm library that provides React Three Fiber components (`EighthwallCanvas`, `EighthwallCamera`, `ImageTracker`) for 8th Wall image tracking.

**Architecture:** `EighthwallCanvas` wraps R3F's `<Canvas>`, injects `xr.js` as a script tag, collects target registrations from child `ImageTracker` components via context, then calls `XR8.XrController.configure` + `XR8.run`. `EighthwallCamera` reads XR8's camera matrices each frame and applies them to the R3F camera. `ImageTracker` listens for XR8 image events and applies pose to a `<group>`.

**Tech Stack:** React 18, React Three Fiber 8+, Three.js, TypeScript, Vite (library mode), Vitest, @testing-library/react

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/types.ts` | All shared TypeScript types |
| `src/context/XRContext.tsx` | React context: xr8 instance + registerTarget callback |
| `src/engine/xr.js` | 8th Wall XR engine (IIFE, defines `window.XR8`) |
| `src/components/EighthwallCanvas.tsx` | Script injection, XR8 init, R3F Canvas wrapper |
| `src/components/EighthwallCamera.tsx` | Per-frame camera matrix sync |
| `src/components/ImageTracker.tsx` | Target registration, pose application |
| `src/index.ts` | Public API exports |
| `package.json` | Library package config, peer deps |
| `vite.config.ts` | Library mode build |
| `tsconfig.json` | TypeScript compiler config |
| `example/package.json` | Example app deps (references local package) |
| `example/vite.config.ts` | Example app Vite config |
| `example/index.html` | Example app HTML entry |
| `example/src/main.tsx` | Example app React entry |
| `example/src/App.tsx` | Example: sphere on image detection |
| `example/public/targets/macaw.json` | Sample target JSON |

---

## Chunk 1: Project Setup

### Task 1: Initialize root package.json

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@activeguild/8thwall-react-three-fiber",
  "version": "0.1.0",
  "description": "React Three Fiber components for 8th Wall image tracking",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "vite build && tsc --emitDeclarationOnly --declarationDir dist",
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "vite build --watch"
  },
  "peerDependencies": {
    "react": ">=17",
    "react-dom": ">=17",
    "@react-three/fiber": ">=8",
    "three": ">=0.140"
  },
  "devDependencies": {
    "@react-three/fiber": "^8.0.0",
    "@testing-library/react": "^14.0.0",
    "@types/react": "^18.0.0",
    "@types/three": "^0.160.0",
    "jsdom": "^24.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "three": "^0.160.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/j1ngzoue/projects/8thwall-react-three-fiber
npm install
```

Expected: `node_modules/` created, no errors.

---

### Task 2: Configure TypeScript

**Files:**
- Create: `tsconfig.json`

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "declarationDir": "dist",
    "outDir": "dist",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "example"]
}
```

---

### Task 3: Configure Vite (library mode)

**Files:**
- Create: `vite.config.ts`

- [ ] **Step 1: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@react-three/fiber', 'three', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@react-three/fiber': 'ReactThreeFiber',
          three: 'THREE',
        },
      },
    },
    copyPublicDir: false,
  },
  // No assetsInclude needed: new URL('../engine/xr.js', import.meta.url) in
  // EighthwallCanvas.tsx is handled automatically by Vite, which copies the
  // asset to dist/assets/ and resolves the URL at build time.
})
```

- [ ] **Step 2: Install vite plugin**

```bash
npm install -D @vitejs/plugin-react
```

---

### Task 4: Configure Vitest

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add test config to vite.config.ts**

Add `test` block inside `defineConfig`:

```typescript
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
```

- [ ] **Step 2: Create test setup file**

Create `src/__tests__/setup.ts`:

```typescript
/// <reference types="vitest/globals" />
import '@testing-library/react'

// Mock window.XR8 global
const mockXR8 = {
  XrController: {
    configure: vi.fn(),
    pipelineModule: vi.fn(() => ({ name: 'XrController' })),
  },
  run: vi.fn(),
  stop: vi.fn(),
  addCameraPipelineModules: vi.fn(),
}

Object.defineProperty(window, 'XR8', {
  value: mockXR8,
  writable: true,
})
```

- [ ] **Step 3: Verify setup compiles**

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors. (At this point only `setup.ts` is in `src/`, so the compiler checks only that file.)

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.json vite.config.ts src/__tests__/setup.ts
git commit -m "chore: project setup — package.json, tsconfig, vite, vitest"
```

---

## Chunk 2: Engine & Core Types

### Task 5: Download xr.js engine

**Files:**
- Create: `src/engine/xr.js`

> **License note:** `xr.js` originates from the `endless-image-targets` repo which is MIT-licensed (see `external/xr/LICENSE`). Verify the LICENSE file in `external/xr/` before distributing this file in a published npm package.

- [ ] **Step 1: Create engine directory and download xr.js**

```bash
mkdir -p src/engine
curl -L "https://raw.githubusercontent.com/cmbartschat/endless-image-targets/main/external/xr/xr.js" \
  -o src/engine/xr.js
```

Expected: `src/engine/xr.js` created (~1MB).

- [ ] **Step 2: Verify file exists and is non-empty**

```bash
ls -lh src/engine/xr.js
```

Expected: file size ~1MB.

- [ ] **Step 3: Confirm first line of xr.js to verify it is an IIFE (not ESM)**

```bash
head -1 src/engine/xr.js
```

Expected: line starts with `(function` or similar IIFE/UMD pattern — not `import` or `export`. If it exports ESM, the dynamic script injection strategy in `EighthwallCanvas` will need to be adjusted.

- [ ] **Step 4: Commit**

```bash
git add src/engine/xr.js
git commit -m "chore: add 8th Wall XR engine (xr.js)"
```

---

### Task 6: Write shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { extractTargetName } from '../types'

describe('extractTargetName', () => {
  it('extracts name from full path with .json extension', () => {
    expect(extractTargetName('/targets/bird.json')).toBe('bird')
  })

  it('extracts name from simple filename', () => {
    expect(extractTargetName('macaw.json')).toBe('macaw')
  })

  it('handles nested paths', () => {
    expect(extractTargetName('/deep/path/to/target.json')).toBe('target')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/types.test.ts
```

Expected: FAIL with "Cannot find module '../types'"

- [ ] **Step 3: Create src/types.ts**

```typescript
import type * as THREE from 'three'

// XR8 global type (minimal surface we use)
export interface XR8Instance {
  XrController: {
    configure: (config: { imageTargets: string[] }) => void
    pipelineModule: () => unknown
  }
  run: (config: { canvas: HTMLCanvasElement; appKey: string }) => void
  stop: () => void
  addCameraPipelineModules: (modules: unknown[]) => void
}

declare global {
  interface Window {
    XR8: XR8Instance
  }
}

export interface ImageFoundEvent {
  position: THREE.Vector3
  rotation: THREE.Quaternion
  scale: number
}

export interface EighthwallCanvasProps {
  appKey: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

export interface EighthwallCameraProps {
  // reserved for future options
}

export interface ImageTrackerProps {
  targetImage: string
  onFound?: (event: ImageFoundEvent) => void
  onUpdated?: (event: ImageFoundEvent) => void
  onLost?: () => void
  children?: React.ReactNode
}

export interface XRContextValue {
  xr8: XR8Instance | null
  registerTarget: (name: string) => void
}

/**
 * Derives the XR8 target name from a targetImage path.
 * e.g. "/targets/macaw.json" → "macaw"
 */
export function extractTargetName(targetImage: string): string {
  const filename = targetImage.split('/').pop() ?? targetImage
  return filename.replace(/\.json$/, '')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/types.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/__tests__/types.test.ts
git commit -m "feat: add shared types and extractTargetName utility"
```

---

### Task 7: Write XRContext

**Files:**
- Create: `src/context/XRContext.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/XRContext.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { XRContext, useXRContext } from '../context/XRContext'

function Consumer() {
  const ctx = useXRContext()
  return <div data-testid="xr8">{ctx.xr8 ? 'has-xr8' : 'no-xr8'}</div>
}

describe('XRContext', () => {
  it('provides null xr8 by default', () => {
    render(<Consumer />)
    expect(screen.getByTestId('xr8').textContent).toBe('no-xr8')
  })

  it('propagates xr8 value from provider', () => {
    const fakeXr8 = {
      XrController: { configure: () => {}, pipelineModule: () => ({}) },
      run: () => {},
      stop: () => {},
      addCameraPipelineModules: () => {},
    }
    render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: () => {} }}>
        <Consumer />
      </XRContext.Provider>
    )
    expect(screen.getByTestId('xr8').textContent).toBe('has-xr8')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/XRContext.test.tsx
```

Expected: FAIL with "Cannot find module '../context/XRContext'"

- [ ] **Step 3: Create src/context/XRContext.tsx**

`EighthwallCanvas` will own the Provider and manage internal state (`xr8`, `registerTarget`). This file only exports the context object and the consumer hook.

```typescript
import { createContext, useContext } from 'react'
import type { XRContextValue } from '../types'

export const XRContext = createContext<XRContextValue>({
  xr8: null,
  registerTarget: () => {},
})

export function useXRContext(): XRContextValue {
  return useContext(XRContext)
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/XRContext.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/context/XRContext.tsx src/__tests__/XRContext.test.tsx
git commit -m "feat: add XRContext"
```

---

## Chunk 3: Components

### Task 8: Write EighthwallCanvas

**Files:**
- Create: `src/components/EighthwallCanvas.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/EighthwallCanvas.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { EighthwallCanvas } from '../components/EighthwallCanvas'

// Mock @react-three/fiber Canvas
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
}))

// Note: these are smoke tests. loadScript and XR8.run are not fully exercised
// because the mocked Canvas does not return a real HTMLCanvasElement ref.
// The tests verify render structure and prop threading only.
describe('EighthwallCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset XR8 mock
    window.XR8 = {
      XrController: { configure: vi.fn(), pipelineModule: vi.fn(() => ({})) },
      run: vi.fn(),
      stop: vi.fn(),
      addCameraPipelineModules: vi.fn(),
    } as any
  })

  it('renders R3F Canvas', () => {
    const { getByTestId } = render(
      <EighthwallCanvas appKey="test-key">
        <mesh />
      </EighthwallCanvas>
    )
    expect(getByTestId('r3f-canvas')).toBeTruthy()
  })

  it('renders children', () => {
    const { getByText } = render(
      <EighthwallCanvas appKey="test-key">
        <div>child-content</div>
      </EighthwallCanvas>
    )
    expect(getByText('child-content')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/EighthwallCanvas.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create src/components/EighthwallCanvas.tsx**

```typescript
import { useRef, useState, useLayoutEffect, useCallback, type ReactNode, type CSSProperties } from 'react'
import { Canvas } from '@react-three/fiber'
import { XRContext } from '../context/XRContext'
import type { XR8Instance, EighthwallCanvasProps } from '../types'

// Resolved at build time by Vite's asset handling
const XR_ENGINE_URL = new URL('../engine/xr.js', import.meta.url).href

function loadScript(src: string): Promise<HTMLScriptElement> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      resolve(existing)
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve(script)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function EighthwallCanvas({ appKey, children, style }: EighthwallCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [xr8, setXr8] = useState<XR8Instance | null>(null)
  const targetNamesRef = useRef<string[]>([])

  const registerTarget = useCallback((name: string) => {
    if (!targetNamesRef.current.includes(name)) {
      targetNamesRef.current = [...targetNamesRef.current, name]
    }
  }, [])

  useLayoutEffect(() => {
    // Children's useLayoutEffect (ImageTracker) runs before this.
    // By this point, all registerTarget calls have completed.
    let stopped = false
    let injectedScript: HTMLScriptElement | null = null

    async function initXR() {
      const script = await loadScript(XR_ENGINE_URL)
      injectedScript = script
      if (stopped) return

      const xr8Instance = window.XR8

      xr8Instance.XrController.configure({
        imageTargets: targetNamesRef.current,
      })

      xr8Instance.addCameraPipelineModules([
        xr8Instance.XrController.pipelineModule(),
      ])

      const canvas = canvasRef.current
      if (!canvas) return

      xr8Instance.run({ canvas, appKey })

      // Wait for XR8 to start
      canvas.addEventListener('xrstarted', () => {
        if (!stopped) setXr8(xr8Instance)
      }, { once: true })
    }

    initXR().catch(console.error)

    return () => {
      stopped = true
      window.XR8?.stop()
      injectedScript?.remove()
      setXr8(null)
    }
  }, [appKey])

  const defaultStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    ...style,
  }

  return (
    <XRContext.Provider value={{ xr8, registerTarget }}>
      <Canvas
        ref={canvasRef}
        style={defaultStyle}
        linear
        flat
        gl={{ antialias: false }}
      >
        {children}
      </Canvas>
    </XRContext.Provider>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/EighthwallCanvas.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/EighthwallCanvas.tsx src/__tests__/EighthwallCanvas.test.tsx
git commit -m "feat: add EighthwallCanvas component"
```

---

### Task 9: Write EighthwallCamera

**Files:**
- Create: `src/components/EighthwallCamera.tsx`

> **Note:** `useFrame` requires an R3F Canvas context and `window.XR8` camera events. This component is tested via smoke test only (render without crash), as full frame simulation requires a WebGL context.

- [ ] **Step 1: Write failing test**

Create `src/__tests__/EighthwallCamera.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { XRContext } from '../context/XRContext'
import { EighthwallCamera } from '../components/EighthwallCamera'

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({
    camera: { projectionMatrix: { fromArray: vi.fn() }, matrixWorldInverse: { copy: vi.fn() } },
    gl: { domElement: document.createElement('canvas') },
  }),
  useFrame: vi.fn(),
}))

describe('EighthwallCamera', () => {
  it('renders without crashing inside XRContext', () => {
    expect(() =>
      render(
        <XRContext.Provider value={{ xr8: null, registerTarget: () => {} }}>
          <EighthwallCamera />
        </XRContext.Provider>
      )
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/EighthwallCamera.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create src/components/EighthwallCamera.tsx**

```typescript
import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'

interface XRCameraProcessedDetail {
  cameraProjectionMatrix: Float32Array
  cameraTransform: {
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number; w: number }
  }
}

export function EighthwallCamera() {
  const { camera, gl } = useThree()
  const { xr8 } = useXRContext()
  const cameraDataRef = useRef<XRCameraProcessedDetail | null>(null)

  useEffect(() => {
    const canvas = gl.domElement

    function onCameraProcessed(e: Event) {
      const detail = (e as CustomEvent<XRCameraProcessedDetail>).detail
      cameraDataRef.current = detail
    }

    canvas.addEventListener('xrcameraprocessed', onCameraProcessed)
    return () => {
      canvas.removeEventListener('xrcameraprocessed', onCameraProcessed)
    }
  }, [gl, xr8])

  useFrame(() => {
    const data = cameraDataRef.current
    if (!data) return

    camera.projectionMatrix.fromArray(data.cameraProjectionMatrix)

    const { position: p, rotation: r } = data.cameraTransform
    const position = new THREE.Vector3(p.x, p.y, p.z)
    const quaternion = new THREE.Quaternion(r.x, r.y, r.z, r.w)
    const matrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1))
    camera.matrixWorldInverse.copy(matrix).invert()
  })

  return null
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/EighthwallCamera.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/EighthwallCamera.tsx src/__tests__/EighthwallCamera.test.tsx
git commit -m "feat: add EighthwallCamera component"
```

---

### Task 10: Write ImageTracker

**Files:**
- Create: `src/components/ImageTracker.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/ImageTracker.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { XRContext } from '../context/XRContext'
import { ImageTracker } from '../components/ImageTracker'

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ gl: { domElement: document.createElement('canvas') } }),
}))

describe('ImageTracker', () => {
  it('calls registerTarget with extracted name on mount', () => {
    const registerTarget = vi.fn()
    render(
      <XRContext.Provider value={{ xr8: null, registerTarget }}>
        <ImageTracker targetImage="/targets/macaw.json">
          <mesh />
        </ImageTracker>
      </XRContext.Provider>
    )
    expect(registerTarget).toHaveBeenCalledWith('macaw')
  })

  it('renders without crashing', () => {
    expect(() =>
      render(
        <XRContext.Provider value={{ xr8: null, registerTarget: vi.fn() }}>
          <ImageTracker targetImage="bird.json" />
        </XRContext.Provider>
      )
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/ImageTracker.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create src/components/ImageTracker.tsx**

```typescript
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useXRContext } from '../context/XRContext'
import { extractTargetName } from '../types'
import type { ImageTrackerProps, ImageFoundEvent } from '../types'

interface XRImageEventDetail {
  name: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  scale: number
}

export function ImageTracker({ targetImage, onFound, onUpdated, onLost, children }: ImageTrackerProps) {
  const { registerTarget, xr8 } = useXRContext()
  const { gl } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const [visible, setVisible] = useState(false)
  const targetName = extractTargetName(targetImage)

  // Register target name before EighthwallCanvas calls XR8.run()
  useLayoutEffect(() => {
    registerTarget(targetName)
  }, [registerTarget, targetName])

  // Attach XR8 image events after XR8 is running
  useEffect(() => {
    if (!xr8) return
    const canvas = gl.domElement

    function applyPose(detail: XRImageEventDetail): ImageFoundEvent {
      const position = new THREE.Vector3(detail.position.x, detail.position.y, detail.position.z)
      const rotation = new THREE.Quaternion(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w)
      if (groupRef.current) {
        groupRef.current.position.copy(position)
        groupRef.current.quaternion.copy(rotation)
        groupRef.current.scale.setScalar(detail.scale)
      }
      return { position, rotation, scale: detail.scale }
    }

    function onImageFound(e: Event) {
      const detail = (e as CustomEvent<XRImageEventDetail>).detail
      if (detail.name !== targetName) return
      setVisible(true)
      const event = applyPose(detail)
      onFound?.(event)
    }

    function onImageUpdated(e: Event) {
      const detail = (e as CustomEvent<XRImageEventDetail>).detail
      if (detail.name !== targetName) return
      const event = applyPose(detail)
      onUpdated?.(event)
    }

    function onImageLost(e: Event) {
      const detail = (e as CustomEvent<{ name: string }>).detail
      if (detail.name !== targetName) return
      setVisible(false)
      onLost?.()
    }

    canvas.addEventListener('xrimagefound', onImageFound)
    canvas.addEventListener('xrimageupdated', onImageUpdated)
    canvas.addEventListener('xrimagelost', onImageLost)

    return () => {
      canvas.removeEventListener('xrimagefound', onImageFound)
      canvas.removeEventListener('xrimageupdated', onImageUpdated)
      canvas.removeEventListener('xrimagelost', onImageLost)
    }
  }, [xr8, gl, targetName, onFound, onUpdated, onLost])

  return (
    <group ref={groupRef} visible={visible}>
      {children}
    </group>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/ImageTracker.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ImageTracker.tsx src/__tests__/ImageTracker.test.tsx
git commit -m "feat: add ImageTracker component"
```

---

### Task 11: Write index.ts and run all tests

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Add .gitignore**

Create `.gitignore` at the root:

```
node_modules/
dist/
*.local
```

```bash
git add .gitignore
```

- [ ] **Step 2: Create src/index.ts**

```typescript
export { EighthwallCanvas } from './components/EighthwallCanvas'
export { EighthwallCamera } from './components/EighthwallCamera'
export { ImageTracker } from './components/ImageTracker'
export type {
  EighthwallCanvasProps,
  EighthwallCameraProps,
  ImageTrackerProps,
  ImageFoundEvent,
} from './types'
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (6+ tests across all files).

- [ ] **Step 4: Build the library**

```bash
npm run build
```

Expected: `dist/` contains `index.js`, `index.cjs`, and `dist/assets/xr.js` (or similar). Verify `dist/` is in `.gitignore` before committing.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts .gitignore
git commit -m "feat: wire up public API exports"
```

---

## Chunk 4: Example App

### Task 12: Set up example Vite app

**Files:**
- Create: `example/package.json`
- Create: `example/vite.config.ts`
- Create: `example/index.html`
- Create: `example/src/main.tsx`

- [ ] **Step 1: Create example/package.json**

```json
{
  "name": "8thwall-r3f-example",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@activeguild/8thwall-react-three-fiber": "file:..",
    "@react-three/fiber": "^8.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "three": "^0.160.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create example/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    https: true, // 8th Wall requires HTTPS for camera access
  },
})
```

- [ ] **Step 3: Create example/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>8th Wall R3F Example</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create example/src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 5: Add example/.gitignore**

Create `example/.gitignore`:

```
node_modules/
dist/
.env.local
.env.*.local
```

- [ ] **Step 6: Install example deps**

```bash
cd /Users/j1ngzoue/projects/8thwall-react-three-fiber/example
npm install
```

> **HTTPS setup:** 8th Wall requires HTTPS. Run `mkcert -install && mkcert localhost` in `example/` and add the cert paths to `example/vite.config.ts` if needed:
> ```ts
> server: { https: { key: './localhost-key.pem', cert: './localhost.pem' } }
> ```

---

### Task 13: Write example App and add sample target

**Files:**
- Create: `example/src/App.tsx`
- Create: `example/public/targets/macaw.json`

- [ ] **Step 1: Download a sample target JSON from endless-image-targets**

```bash
mkdir -p /Users/j1ngzoue/projects/8thwall-react-three-fiber/example/public/targets
curl -L "https://raw.githubusercontent.com/cmbartschat/endless-image-targets/main/image-targets/macaw.json" \
  -o /Users/j1ngzoue/projects/8thwall-react-three-fiber/example/public/targets/macaw.json
```

- [ ] **Step 2: Create example/src/App.tsx**

```tsx
import { EighthwallCanvas, EighthwallCamera, ImageTracker } from '@activeguild/8thwall-react-three-fiber'

const APP_KEY = import.meta.env.VITE_8THWALL_APP_KEY ?? ''

export default function App() {
  return (
    <EighthwallCanvas appKey={APP_KEY} style={{ width: '100vw', height: '100vh' }}>
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
```

- [ ] **Step 3: Create example/.env.local for 8th Wall app key**

```bash
echo "VITE_8THWALL_APP_KEY=your-app-key-here" > /Users/j1ngzoue/projects/8thwall-react-three-fiber/example/.env.local
```

> **Note:** Replace `your-app-key-here` with an actual 8th Wall app key to test on device.

- [ ] **Step 4: Verify example builds**

```bash
cd /Users/j1ngzoue/projects/8thwall-react-three-fiber/example
npm run build
```

Expected: `example/dist/` created without errors.

- [ ] **Step 5: Commit (exclude .env.local)**

```bash
cd /Users/j1ngzoue/projects/8thwall-react-three-fiber
# Verify .env.local is not staged
git status example/
git add example/ -- ':!example/.env.local'
git commit -m "feat: add Vite example app with image tracking demo"
```

---

## Final Verification

- [ ] Run all library tests: `npx vitest run` — all pass
- [ ] Build library: `npm run build` — dist/ contains js, cjs files
- [ ] Build example: `cd example && npm run build` — no errors
- [ ] (On device with 8th Wall key) `cd example && npm run dev` — camera opens, sphere appears on macaw image

---

## Known Considerations

- **HTTPS required:** 8th Wall requires HTTPS for camera access. `example/vite.config.ts` sets `server.https: true`. You may need a local cert (e.g., via `mkcert`).
- **Mobile only:** 8th Wall image tracking works on mobile browsers. Test on iOS Safari or Android Chrome.
- **App key:** A valid 8th Wall developer account and app key are needed for the tracker to run. Get one at [8thwall.com](https://www.8thwall.com/).
- **xr.js API variance:** The `xrcameraprocessed` event payload shape (`cameraProjectionMatrix`, `cameraTransform`) should be verified against the actual `src/engine/xr.js` file at runtime. If the shape differs, update `EighthwallCamera.tsx` accordingly.
