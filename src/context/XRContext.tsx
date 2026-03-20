import { createContext, useContext } from 'react'
import type { XRContextValue } from '../types'

export const XRContext = createContext<XRContextValue>({
  xr8: null,
  registerTarget: () => {},
  startCamera: async () => {
    console.warn('startCamera called outside of EighthwallCanvas context')
    return false
  },
})

export function useXRContext(): XRContextValue {
  return useContext(XRContext)
}
