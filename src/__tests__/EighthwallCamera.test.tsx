import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { XRContext } from '../context/XRContext'
import { EighthwallCamera } from '../components/EighthwallCamera'

let capturedModule: any = null
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
        <XRContext.Provider value={{ xr8: null, registerTarget: () => {}, startCamera: async () => true, getTargetMetadata: () => null }}>
          <EighthwallCamera />
        </XRContext.Provider>
      )
    ).not.toThrow()
  })

  it('fires onFirstFrame once on the first camera pose update', () => {
    capturedModule = null
    const fakeXr8 = {
      addCameraPipelineModule: vi.fn((m: any) => { capturedModule = m }),
      removeCameraPipelineModule: vi.fn(),
    }
    const onFirstFrame = vi.fn()

    render(
      <XRContext.Provider value={{ xr8: fakeXr8 as any, registerTarget: () => {}, startCamera: async () => true, getTargetMetadata: () => null }}>
        <EighthwallCamera onFirstFrame={onFirstFrame} />
      </XRContext.Provider>
    )

    // Simulate first onUpdate with camera data
    act(() => {
      capturedModule?.onUpdate?.({
        processCpuResult: {
          reality: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
        },
      })
    })

    expect(onFirstFrame).toHaveBeenCalledTimes(1)

    // Second update should NOT fire again
    act(() => {
      capturedModule?.onUpdate?.({
        processCpuResult: {
          reality: {
            position: { x: 1, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
        },
      })
    })

    expect(onFirstFrame).toHaveBeenCalledTimes(1)
  })
})
