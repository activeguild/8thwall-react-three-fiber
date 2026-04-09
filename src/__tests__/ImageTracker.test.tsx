import { describe, it, expect, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { XRContext } from '../context/XRContext'
import { ImageTracker } from '../components/ImageTracker'

vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual<typeof import('@react-three/fiber')>('@react-three/fiber')
  let frameCallback: ((state: any, delta: number) => void) | null = null
  return {
    ...actual,
    useFrame: vi.fn((cb) => { frameCallback = cb }),
    __getFrameCallback: () => frameCallback,
    __runFrame: () => frameCallback?.({}, 0.016),
  }
})

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three')
  const makeCopyable = (): any => ({
    copy: vi.fn().mockReturnThis(),
    setScalar: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    clone: vi.fn(() => makeCopyable()),
    invert: vi.fn().mockReturnThis(),
    multiply: vi.fn().mockReturnThis(),
    normalize: vi.fn().mockReturnThis(),
    applyQuaternion: vi.fn().mockReturnThis(),
  })
  return {
    ...actual,
    Vector3: vi.fn(() => makeCopyable()),
    Quaternion: vi.fn(() => makeCopyable()),
  }
})

describe('ImageTracker', () => {
  it('calls registerTarget with extracted name on mount', () => {
    const registerTarget = vi.fn()
    render(
      <XRContext.Provider value={{ xr8: null, registerTarget, startCamera: async () => true, getTargetMetadata: () => null }}>
        <ImageTracker targetImage="/targets/macaw.json">
          <mesh />
        </ImageTracker>
      </XRContext.Provider>
    )
    expect(registerTarget).toHaveBeenCalledWith('/targets/macaw.json')
  })

  it('renders without crashing', () => {
    expect(() =>
      render(
        <XRContext.Provider value={{ xr8: null, registerTarget: vi.fn(), startCamera: async () => true, getTargetMetadata: () => null }}>
          <ImageTracker targetImage="bird.json" />
        </XRContext.Provider>
      )
    ).not.toThrow()
  })

  it('calls onFound when reality.imagefound fires via pipeline module listener', () => {
    // Capture the pipeline module registered by ImageTracker
    let capturedModule: any = null
    const fakeXr8 = {
      XrController: { configure: vi.fn(), pipelineModule: vi.fn(() => ({})) },
      run: vi.fn(), stop: vi.fn(),
      addCameraPipelineModules: vi.fn(),
      addCameraPipelineModule: vi.fn((m) => { capturedModule = m }),
      removeCameraPipelineModule: vi.fn(),
    }

    // jsdom の <group> 要素は THREE.Group でないため、position/quaternion/scale を付与する
    const makeCopyable = () => ({ copy: vi.fn(), setScalar: vi.fn() })
    const groupProto = HTMLElement.prototype as any
    const origPosition = Object.getOwnPropertyDescriptor(groupProto, 'position')
    const origQuaternion = Object.getOwnPropertyDescriptor(groupProto, 'quaternion')
    const origScale = Object.getOwnPropertyDescriptor(groupProto, 'scale')
    groupProto.position = makeCopyable()
    groupProto.quaternion = makeCopyable()
    groupProto.scale = makeCopyable()

    const onFound = vi.fn()
    render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn(), startCamera: async () => true, getTargetMetadata: () => null }}>
        <ImageTracker targetImage="/targets/macaw.json" onFound={onFound}>
          <mesh />
        </ImageTracker>
      </XRContext.Provider>
    )

    // Pipeline module の reality.imagefound リスナーを直接呼ぶ
    try {
      act(() => {
        const listener = capturedModule?.listeners?.find((l: any) => l.event === 'reality.imagefound')
        listener?.process({
          name: 'reality.imagefound',
          detail: {
            name: 'macaw',
            position: { x: 0, y: 0, z: -1 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: 1,
          },
        })
      })
    } finally {
      // 後始末
      if (origPosition) Object.defineProperty(groupProto, 'position', origPosition)
      else delete groupProto.position
      if (origQuaternion) Object.defineProperty(groupProto, 'quaternion', origQuaternion)
      else delete groupProto.quaternion
      if (origScale) Object.defineProperty(groupProto, 'scale', origScale)
      else delete groupProto.scale
    }

    expect(onFound).toHaveBeenCalledTimes(1)
  })

  it('does not render group content before the first XR8 frame (imuSnapshot is null)', () => {
    const fakeXr8 = {
      addCameraPipelineModule: vi.fn(),
      removeCameraPipelineModule: vi.fn(),
    }

    const { container } = render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn(), startCamera: async () => true, getTargetMetadata: () => null }}>
        <ImageTracker targetImage="/targets/macaw.json" />
      </XRContext.Provider>
    )

    // visible state defaults to false (no imagefound fired)
    const group = container.querySelector('group')
    expect(group?.getAttribute('visible')).not.toBe('true')
  })

  it('fires onUpdated after snapshot and pose are set', async () => {
    let capturedModule: any = null
    const fakeXr8 = {
      addCameraPipelineModule: vi.fn((m) => { capturedModule = m }),
      removeCameraPipelineModule: vi.fn(),
    }

    // jsdom の <group> 要素は THREE.Group でないため、position/quaternion/scale を付与する
    const makeCopyable = (): any => ({ copy: vi.fn(), setScalar: vi.fn(), set: vi.fn(), clone: vi.fn(() => makeCopyable()) })
    const groupProto = HTMLElement.prototype as any
    const origPosition = Object.getOwnPropertyDescriptor(groupProto, 'position')
    const origQuaternion = Object.getOwnPropertyDescriptor(groupProto, 'quaternion')
    const origScale = Object.getOwnPropertyDescriptor(groupProto, 'scale')
    groupProto.position = makeCopyable()
    groupProto.quaternion = makeCopyable()
    groupProto.scale = makeCopyable()

    const onUpdated = vi.fn()
    render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn(), startCamera: async () => true, getTargetMetadata: () => null }}>
        <ImageTracker targetImage="/targets/macaw.json" onUpdated={onUpdated} />
      </XRContext.Provider>
    )

    // Trigger the useFrame callback
    const { __runFrame } = await import('@react-three/fiber') as any
    try {
      act(() => {
        capturedModule?.listeners
          ?.find((l: any) => l.event === 'reality.imagefound')
          ?.process({ detail: { name: 'macaw', position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1.5 } })
        capturedModule?.onUpdate?.({ processCpuResult: { reality: { detectedImages: [
          { name: 'macaw', position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1.5 },
        ] } } })
      })
      act(() => { __runFrame() })
    } finally {
      // 後始末
      if (origPosition) Object.defineProperty(groupProto, 'position', origPosition)
      else delete groupProto.position
      if (origQuaternion) Object.defineProperty(groupProto, 'quaternion', origQuaternion)
      else delete groupProto.quaternion
      if (origScale) Object.defineProperty(groupProto, 'scale', origScale)
      else delete groupProto.scale
    }

    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ scale: 1.5 }))
  })

  it('does not register pipeline module when enabled=false', () => {
    const fakeXr8 = {
      addCameraPipelineModule: vi.fn(),
      removeCameraPipelineModule: vi.fn(),
    }

    render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn(), startCamera: async () => true, getTargetMetadata: () => null }}>
        <ImageTracker targetImage="/targets/macaw.json" enabled={false} />
      </XRContext.Provider>
    )

    expect(fakeXr8.addCameraPipelineModule).not.toHaveBeenCalled()
  })

  it('includes imageWidth and imageHeight from target metadata in onFound', () => {
    let capturedModule: any = null
    const fakeXr8 = {
      addCameraPipelineModule: vi.fn((m: any) => { capturedModule = m }),
      removeCameraPipelineModule: vi.fn(),
    }

    const getTargetMetadata = vi.fn().mockReturnValue({ imageWidth: 1920, imageHeight: 1080 })
    const onFound = vi.fn()

    const makeCopyable = () => ({ copy: vi.fn(), setScalar: vi.fn(), set: vi.fn() })
    const groupProto = HTMLElement.prototype as any
    const origPosition = Object.getOwnPropertyDescriptor(groupProto, 'position')
    const origQuaternion = Object.getOwnPropertyDescriptor(groupProto, 'quaternion')
    const origScale = Object.getOwnPropertyDescriptor(groupProto, 'scale')
    groupProto.position = makeCopyable()
    groupProto.quaternion = makeCopyable()
    groupProto.scale = makeCopyable()

    try {
      render(
        <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn(), startCamera: async () => true, getTargetMetadata }}>
          <ImageTracker targetImage="/targets/macaw.json" onFound={onFound} />
        </XRContext.Provider>
      )

      act(() => {
        const listener = capturedModule?.listeners?.find((l: any) => l.event === 'reality.imagefound')
        listener?.process({
          detail: {
            name: 'macaw',
            position: { x: 0, y: 0, z: -1 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: 1,
          },
        })
      })

      expect(onFound).toHaveBeenCalledWith(
        expect.objectContaining({ imageWidth: 1920, imageHeight: 1080 })
      )
    } finally {
      if (origPosition) Object.defineProperty(groupProto, 'position', origPosition)
      else delete groupProto.position
      if (origQuaternion) Object.defineProperty(groupProto, 'quaternion', origQuaternion)
      else delete groupProto.quaternion
      if (origScale) Object.defineProperty(groupProto, 'scale', origScale)
      else delete groupProto.scale
    }
  })

  it('removes pipeline module when enabled changes from true to false', () => {
    const fakeXr8 = {
      addCameraPipelineModule: vi.fn(),
      removeCameraPipelineModule: vi.fn(),
    }

    const { rerender } = render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn(), startCamera: async () => true, getTargetMetadata: () => null }}>
        <ImageTracker targetImage="/targets/macaw.json" enabled={true} />
      </XRContext.Provider>
    )

    expect(fakeXr8.addCameraPipelineModule).toHaveBeenCalledTimes(1)

    rerender(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn(), startCamera: async () => true, getTargetMetadata: () => null }}>
        <ImageTracker targetImage="/targets/macaw.json" enabled={false} />
      </XRContext.Provider>
    )

    expect(fakeXr8.removeCameraPipelineModule).toHaveBeenCalledWith('image-tracker-macaw')
  })
})
