import { describe, it, expect } from 'vitest'
import { extractTargetName } from '../types'

describe('extractTargetName', () => {
  it('extracts name from full path with .json extension', () => {
    expect(extractTargetName('/targets/bird.json')).toBe('bird')
  })

  it('extracts name from simple filename', () => {
    expect(extractTargetName('macaw.json')).toBe('macaw')
  })

  it('handles nested paths', () => {
    expect(extractTargetName('/deep/path/to/target.json')).toBe('target')
  })
})
