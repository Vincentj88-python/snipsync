import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/electron/renderer'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: 'https://e7ddc742366a1d89e3e5661d3b9cdb8e@o4511048248918016.ingest.de.sentry.io/4511048252981328',
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
