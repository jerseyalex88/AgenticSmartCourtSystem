import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx' // ◄--- ADD THIS IMPORT

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider> {/* ◄--- WRAP THE SYSTEM POOL HERE */}
      <App />
    </AuthProvider>
  </StrictMode>,
)
