/// <reference types="vitest/globals" />
import '@testing-library/react'

// Mock window.XR8 global
const mockXR8 = {
  XrController: {
    configure: vi.fn(),
    pipelineModule: vi.fn(() => ({ name: 'XrController' })),
  },
  run: vi.fn(),
  stop: vi.fn(),
  addCameraPipelineModules: vi.fn(),
}

Object.defineProperty(window, 'XR8', {
  value: mockXR8,
  writable: true,
})
