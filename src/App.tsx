import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Scene from './components/Scene'
import TiktaktoScene from './components/tank/TiktaktoScene'

function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<Scene />} />
        <Route path="/tiktaktoe" element={<TiktaktoScene />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
