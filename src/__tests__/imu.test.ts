// src/__tests__/imu.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('imu', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getIMUQuaternion returns identity before any events', async () => {
    // Spy before import so auto-start is captured (non-iOS env)
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {})
    const { getIMUQuaternion } = await import('../imu')
    const q = getIMUQuaternion()
    expect(q.x).toBeCloseTo(0)
    expect(q.y).toBeCloseTo(0)
    expect(q.z).toBeCloseTo(0)
    expect(q.w).toBeCloseTo(1)
  })

  it('integrates a rotationRate event and updates the quaternion', async () => {
    let capturedHandler: ((e: DeviceMotionEvent) => void) | null = null
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'devicemotion') capturedHandler = handler as any
    })

    const { getIMUQuaternion } = await import('../imu')

    const now = performance.now()
    // Prime last_time with zero-rotation event
    capturedHandler?.({
      rotationRate: { alpha: 0, beta: 0, gamma: 0 },
      timeStamp: now,
    } as unknown as DeviceMotionEvent)

    // Pure yaw at 180 deg/s for 1 second → 180° around Z axis
    capturedHandler?.({
      rotationRate: { alpha: 180, beta: 0, gamma: 0 },
      timeStamp: now + 1000,
    } as unknown as DeviceMotionEvent)

    const q = getIMUQuaternion()
    // After 180° rotation: |w| ≈ 0, |z| ≈ 1, |x| ≈ 0, |y| ≈ 0
    expect(Math.abs(q.w)).toBeCloseTo(0, 1)
    expect(Math.abs(q.z)).toBeCloseTo(1, 1)
    expect(Math.abs(q.x)).toBeCloseTo(0, 1)
    expect(Math.abs(q.y)).toBeCloseTo(0, 1)
  })

  it('skips a sample when rotationRate is null', async () => {
    let capturedHandler: ((e: DeviceMotionEvent) => void) | null = null
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'devicemotion') capturedHandler = handler as any
    })

    const { getIMUQuaternion } = await import('../imu')

    capturedHandler?.({
      rotationRate: null,
      timeStamp: performance.now(),
    } as unknown as DeviceMotionEvent)

    const q = getIMUQuaternion()
    expect(q.w).toBeCloseTo(1)
  })

  it('skips a sample when angle < 1e-10 (avoids NaN in axis normalization)', async () => {
    let capturedHandler: ((e: DeviceMotionEvent) => void) | null = null
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'devicemotion') capturedHandler = handler as any
    })

    const { getIMUQuaternion } = await import('../imu')

    const now = performance.now()
    // Prime last_time
    capturedHandler?.({ rotationRate: { alpha: 0, beta: 0, gamma: 0 }, timeStamp: now } as unknown as DeviceMotionEvent)
    // Extremely tiny rotation rate × extremely tiny dt → angle < 1e-10
    capturedHandler?.({ rotationRate: { alpha: 1e-12, beta: 0, gamma: 0 }, timeStamp: now + 0.000001 } as unknown as DeviceMotionEvent)

    const q = getIMUQuaternion()
    expect(isNaN(q.x)).toBe(false)
    expect(isNaN(q.w)).toBe(false)
    expect(q.w).toBeCloseTo(1)
  })

  it('requestIMUPermission returns true and starts listening on non-iOS', async () => {
    // Set DeviceMotionEvent without requestPermission (non-iOS) BEFORE import
    ;(window as any).DeviceMotionEvent = class {}
    const spy = vi.spyOn(window, 'addEventListener').mockImplementation(() => {})

    const { requestIMUPermission } = await import('../imu')
    const result = await requestIMUPermission()

    expect(result).toBe(true)
    // addEventListener called at least once with 'devicemotion' (auto-start or explicit)
    expect(spy).toHaveBeenCalledWith('devicemotion', expect.any(Function))
  })

  it('requestIMUPermission returns false when DeviceMotionEvent is absent', async () => {
    const original = (window as any).DeviceMotionEvent
    ;(window as any).DeviceMotionEvent = undefined
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {})

    const { requestIMUPermission } = await import('../imu')
    const result = await requestIMUPermission()

    expect(result).toBe(false)
    ;(window as any).DeviceMotionEvent = original
  })

  it('requestIMUPermission returns true when iOS grants permission', async () => {
    const originalDME = (window as any).DeviceMotionEvent
    ;(window as any).DeviceMotionEvent = class {
      static requestPermission = vi.fn().mockResolvedValue('granted')
    }
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {})

    const { requestIMUPermission } = await import('../imu')
    const result = await requestIMUPermission()

    expect(result).toBe(true)
    ;(window as any).DeviceMotionEvent = originalDME
  })

  it('requestIMUPermission returns false when iOS denies permission', async () => {
    const originalDME = (window as any).DeviceMotionEvent
    ;(window as any).DeviceMotionEvent = class {
      static requestPermission = vi.fn().mockResolvedValue('denied')
    }
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {})

    const { requestIMUPermission } = await import('../imu')
    const result = await requestIMUPermission()

    expect(result).toBe(false)
    ;(window as any).DeviceMotionEvent = originalDME
  })
})
