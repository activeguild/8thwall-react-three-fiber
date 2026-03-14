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
