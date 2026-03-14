import { createContext, useContext } from 'react'
import type { XRContextValue } from '../types'

export const XRContext = createContext<XRContextValue>({
  xr8: null,
  registerTarget: () => {},
})

export function useXRContext(): XRContextValue {
  return useContext(XRContext)
}
