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
