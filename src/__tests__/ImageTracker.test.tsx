import { describe, it, expect, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useThree } from '@react-three/fiber'
import { XRContext } from '../context/XRContext'
import { ImageTracker } from '../components/ImageTracker'

vi.mock('@react-three/fiber', () => ({
  useThree: vi.fn(() => ({ gl: { domElement: document.createElement('canvas') } })),
}))

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three')
  const makeCopyable = () => ({ copy: vi.fn(), setScalar: vi.fn(), set: vi.fn(), clone: vi.fn(() => makeCopyable()) })
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

  it('shows group when xrimagefound fires for matching target', () => {
    const canvas = document.createElement('canvas')
    const fakeXr8 = {
      XrController: { configure: vi.fn(), pipelineModule: vi.fn(() => ({})) },
      run: vi.fn(), stop: vi.fn(), addCameraPipelineModules: vi.fn(),
    }
    vi.mocked(useThree).mockReturnValue({ gl: { domElement: canvas } } as any)

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

    // xrimagefound イベントを発火
    act(() => {
      const event = new CustomEvent('xrimagefound', {
        detail: {
          name: 'macaw',
          position: { x: 0, y: 0, z: -1 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: 1,
        },
      })
      canvas.dispatchEvent(event)
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
})
