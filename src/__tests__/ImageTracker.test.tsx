import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { XRContext } from '../context/XRContext'
import { ImageTracker } from '../components/ImageTracker'
import { getIMUQuaternion } from '../imu'

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

vi.mock('../imu', () => ({
  getIMUQuaternion: vi.fn(),
  requestIMUPermission: vi.fn(),
}))

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three')
  const makeCopyable = (): any => ({
    copy: vi.fn(),
    setScalar: vi.fn(),
    set: vi.fn(),
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
  beforeEach(() => {
    const makeCloneable = (): any => ({
      clone: vi.fn(() => makeCloneable()),
      invert: vi.fn().mockReturnThis(),
      multiply: vi.fn().mockReturnThis(),
      normalize: vi.fn().mockReturnThis(),
    })
    vi.mocked(getIMUQuaternion).mockReturnValue(makeCloneable())
  })

  it('calls registerTarget with extracted name on mount', () => {
    const registerTarget = vi.fn()
    render(
      <XRContext.Provider value={{ xr8: null, registerTarget }}>
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
        <XRContext.Provider value={{ xr8: null, registerTarget: vi.fn() }}>
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
    groupProto.position = makeCopyable()
    groupProto.quaternion = makeCopyable()
    groupProto.scale = makeCopyable()

    const onFound = vi.fn()
    render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn() }}>
        <ImageTracker targetImage="/targets/macaw.json" onFound={onFound}>
          <mesh />
        </ImageTracker>
      </XRContext.Provider>
    )

    // Pipeline module の reality.imagefound リスナーを直接呼ぶ
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

    // 後始末
    if (origPosition) {
      Object.defineProperty(groupProto, 'position', origPosition)
    } else {
      delete groupProto.position
    }
    delete groupProto.quaternion
    delete groupProto.scale

    expect(onFound).toHaveBeenCalledTimes(1)
  })

  it('calls getIMUQuaternion on every onUpdate call', () => {
    let capturedModule: any = null
    const fakeXr8 = {
      addCameraPipelineModule: vi.fn((m) => { capturedModule = m }),
      removeCameraPipelineModule: vi.fn(),
    }

    render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn() }}>
        <ImageTracker targetImage="/targets/macaw.json" />
      </XRContext.Provider>
    )

    act(() => {
      capturedModule?.onUpdate?.({ processCpuResult: {} })
      capturedModule?.onUpdate?.({ processCpuResult: {} })
    })

    expect(getIMUQuaternion).toHaveBeenCalledTimes(2)
  })

  it('does not render group content before the first XR8 frame (imuSnapshot is null)', () => {
    const fakeXr8 = {
      addCameraPipelineModule: vi.fn(),
      removeCameraPipelineModule: vi.fn(),
    }

    const { container } = render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn() }}>
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
    groupProto.position = makeCopyable()
    groupProto.quaternion = makeCopyable()
    groupProto.scale = makeCopyable()

    const onUpdated = vi.fn()
    render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: vi.fn() }}>
        <ImageTracker targetImage="/targets/macaw.json" onUpdated={onUpdated} />
      </XRContext.Provider>
    )

    act(() => {
      capturedModule?.listeners
        ?.find((l: any) => l.event === 'reality.imagefound')
        ?.process({ detail: { name: 'macaw', position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1.5 } })
      capturedModule?.onUpdate?.({ processCpuResult: { reality: { detectedImages: [
        { name: 'macaw', position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1.5 },
      ] } } })
    })

    // Trigger the useFrame callback
    const { __runFrame } = await import('@react-three/fiber') as any
    act(() => { __runFrame() })

    // 後始末
    if (origPosition) {
      Object.defineProperty(groupProto, 'position', origPosition)
    } else {
      delete groupProto.position
    }
    delete groupProto.quaternion
    delete groupProto.scale

    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ scale: 1.5 }))
  })
})
