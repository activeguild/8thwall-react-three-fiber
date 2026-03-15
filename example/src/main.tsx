import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

if (import.meta.env.VITE_VCONSOLE === 'true') {
  const { default: VConsole } = await import('vconsole')
  new VConsole()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
