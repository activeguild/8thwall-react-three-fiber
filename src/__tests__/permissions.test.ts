import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('permissionGranted', () => {
  it('returns false before any request', async () => {
    const { permissionGranted } = await import('../permissions')
    expect(permissionGranted()).toBe(false)
  })

  it('returns true after successful permissionRequest', async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] }
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    })
    const { permissionGranted, permissionRequest } = await import('../permissions')
    await permissionRequest()
    expect(permissionGranted()).toBe(true)
  })
})

describe('permissionDenied', () => {
  it('returns false before any request', async () => {
    const { permissionDenied } = await import('../permissions')
    expect(permissionDenied()).toBe(false)
  })

  it('returns true after failed permissionRequest', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied')) },
      configurable: true,
    })
    const { permissionDenied, permissionRequest } = await import('../permissions')
    await permissionRequest()
    expect(permissionDenied()).toBe(true)
  })
})

describe('permissionRequest', () => {
  it('returns true when getUserMedia succeeds', async () => {
    const stopFn = vi.fn()
    const mockStream = { getTracks: () => [{ stop: stopFn }] }
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    })
    const { permissionRequest } = await import('../permissions')
    const result = await permissionRequest()
    expect(result).toBe(true)
    expect(stopFn).toHaveBeenCalled()
  })

  it('returns false when getUserMedia fails', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('NotAllowedError')) },
      configurable: true,
    })
    const { permissionRequest } = await import('../permissions')
    const result = await permissionRequest()
    expect(result).toBe(false)
  })

  it('returns true immediately if already granted', async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] }
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    })
    const { permissionRequest } = await import('../permissions')
    await permissionRequest()
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>
    getUserMedia.mockClear()
    const result = await permissionRequest()
    expect(result).toBe(true)
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})
