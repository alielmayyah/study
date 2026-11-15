import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { goFullscreen } from './lib/fullscreen'

import './styles.css'

// Force full screen: every tap re-enters it (browsers require a user gesture).
document.addEventListener('click', goFullscreen)
document.addEventListener('touchend', goFullscreen)

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><HashRouter><App /></HashRouter></React.StrictMode>)
