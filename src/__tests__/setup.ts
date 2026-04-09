/// <reference types="vitest/globals" />
import '@testing-library/react'

// jsdom does not implement ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock window.XR8 global
const mockXR8 = {
  XrController: {
    configure: vi.fn(),
    pipelineModule: vi.fn(() => ({ name: 'XrController' })),
  },
  GlTextureRenderer: {
    pipelineModule: vi.fn(() => ({ name: 'GlTextureRenderer' })),
  },
  run: vi.fn(),
  stop: vi.fn(),
  addCameraPipelineModules: vi.fn(),
  addCameraPipelineModule: vi.fn(),
  removeCameraPipelineModule: vi.fn(),
}

Object.defineProperty(window, 'XR8', {
  value: mockXR8,
  writable: true,
})
