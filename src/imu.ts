// src/imu.ts
import * as THREE from 'three'

// Running quaternion: body-frame accumulation via right-multiply.
// Do NOT mutate the returned object — call .clone() before modifying it.
let Q = new THREE.Quaternion() // identity
let lastTime: number | null = null
let listening = false

function handleDeviceMotion(event: DeviceMotionEvent): void {
  const rr = event.rotationRate
  if (!rr) return

  const now = event.timeStamp
  if (lastTime === null) {
    lastTime = now
    return
  }

  const dt = (now - lastTime) / 1000 // seconds
  lastTime = now

  const ax = (rr.beta  ?? 0) * dt * (Math.PI / 180) // X (pitch)
  const ay = (rr.gamma ?? 0) * dt * (Math.PI / 180) // Y (roll)
  const az = (rr.alpha ?? 0) * dt * (Math.PI / 180) // Z (yaw)

  const angle = Math.sqrt(ax * ax + ay * ay + az * az)
  if (angle < 1e-10) return // skip: no meaningful rotation, avoid NaN in normalization

  const dQ = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(ax / angle, ay / angle, az / angle),
    angle,
  )
  Q.multiply(dQ) // right-multiply: body-frame accumulation
  Q.normalize()
}

function startListening(): void {
  if (listening) return
  window.addEventListener('devicemotion', handleDeviceMotion)
  listening = true
}

/**
 * Returns the current accumulated IMU quaternion (body frame).
 * Do NOT mutate the returned object — call `.clone()` before modifying it.
 */
export function getIMUQuaternion(): THREE.Quaternion {
  return Q
}

/**
 * Request permission and start the IMU listener.
 * - iOS 13+: calls DeviceMotionEvent.requestPermission() from a user gesture
 * - Android / desktop: starts immediately, returns true
 * - DeviceMotionEvent absent: returns false (IMU correction becomes no-op)
 */
export async function requestIMUPermission(): Promise<boolean> {
  if (typeof DeviceMotionEvent === 'undefined') return false

  if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
    // iOS 13+
    try {
      const state = await (DeviceMotionEvent as any).requestPermission()
      if (state === 'granted') {
        startListening()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // Android / desktop
  startListening()
  return true
}

// Auto-start when running in a browser-like environment without iOS permission gate.
// DeviceMotionEvent may be absent (e.g. desktop, jsdom) — the handler is a no-op
// for platforms that never fire 'devicemotion', so registering unconditionally is safe.
if (typeof window !== 'undefined' &&
    !(typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as any).requestPermission === 'function')) {
  startListening()
}
