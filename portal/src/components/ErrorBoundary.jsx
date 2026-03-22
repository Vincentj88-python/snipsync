import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0a0a0a', color: '#e5e5e5', fontFamily: 'sans-serif', padding: 32,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>:(</div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 24, textAlign: 'center' }}>
            SnipSync ran into an unexpected error. Your data is safe.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', background: '#22c55e', color: '#000', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
