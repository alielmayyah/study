import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { goFullscreen } from './lib/fullscreen'

import './styles.css'

// Go full screen on the first tap anywhere (browsers require a tap).
document.addEventListener('click', goFullscreen, { once: true })

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><HashRouter><App /></HashRouter></React.StrictMode>)
