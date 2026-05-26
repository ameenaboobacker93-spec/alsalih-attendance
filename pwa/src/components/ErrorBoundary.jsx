import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#f8fafc',
          padding: 40,
          textAlign: 'center',
        }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: 'rgba(239,68,68,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            marginBottom: 20,
          }}>
            ⚠️
          </div>
          <h2 style={{ marginBottom: 12 }}>Something went wrong</h2>
          <p style={{ opacity: 0.6, fontSize: '0.85rem', marginBottom: 24, maxWidth: 400, lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '14px 32px',
              borderRadius: 12,
              background: '#06b6d4',
              color: 'white',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            RELOAD APP
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
