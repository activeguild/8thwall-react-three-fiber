import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('checkBrowserCompatibility', () => {
  it('returns compatible:true when all features are supported', async () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(document, 'createElement').mockReturnValue({
      ...canvas,
      getContext: vi.fn().mockReturnValue({}),
      captureStream: vi.fn(),
    } as any)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    })

    const { checkBrowserCompatibility } = await import('../compatibility')
    const result = checkBrowserCompatibility()
    expect(result.compatible).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('reports WebGL2 not supported', async () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(document, 'createElement').mockReturnValue({
      ...canvas,
      getContext: vi.fn().mockReturnValue(null),
      captureStream: vi.fn(),
    } as any)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    })

    const { checkBrowserCompatibility } = await import('../compatibility')
    const result = checkBrowserCompatibility()
    expect(result.compatible).toBe(false)
    expect(result.issues).toContain('WebGL2 not supported')
  })

  it('reports getUserMedia not available', async () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(document, 'createElement').mockReturnValue({
      ...canvas,
      getContext: vi.fn().mockReturnValue({}),
      captureStream: vi.fn(),
    } as any)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    })

    const { checkBrowserCompatibility } = await import('../compatibility')
    const result = checkBrowserCompatibility()
    expect(result.compatible).toBe(false)
    expect(result.issues).toContain('getUserMedia not available')
  })

  it('reports captureStream not supported', async () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(document, 'createElement').mockReturnValue({
      ...canvas,
      getContext: vi.fn().mockReturnValue({}),
    } as any)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    })

    const { checkBrowserCompatibility } = await import('../compatibility')
    const result = checkBrowserCompatibility()
    expect(result.issues).toContain('captureStream not supported')
  })
})
