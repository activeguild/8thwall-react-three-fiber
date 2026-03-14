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
