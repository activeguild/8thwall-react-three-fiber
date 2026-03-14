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
