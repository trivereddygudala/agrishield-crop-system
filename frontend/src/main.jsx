import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n/config.js'

// Restore accessibility modes from localStorage on boot (no flash of default)
if (localStorage.getItem('fieldMode') === 'true') {
  document.documentElement.classList.add('field-mode');
}
if (localStorage.getItem('farmerMode') === 'true') {
  document.documentElement.classList.add('farmer-mode');
}


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
