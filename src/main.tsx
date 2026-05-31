import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { setupViewportHeight } from './viewportHeight'

setupViewportHeight()
document.documentElement.style.setProperty(
  '--noise-texture',
  `url("${import.meta.env.BASE_URL}noise.png")`,
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
