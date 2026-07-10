import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx' // ◄--- ADD THIS IMPORT

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider> {/* ◄--- WRAP THE THEME CONTEXT MATRIX POOL HERE */}
        <App />
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
)
