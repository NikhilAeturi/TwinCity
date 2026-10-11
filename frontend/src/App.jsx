import React, { useState } from 'react';
import StuntStudio from './components/StuntStudio';
import MobileScannerView from './components/MobileScannerView';

class ErrorBoundary extends React.Component {
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
          padding: '24px',
          margin: '20px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #ef4444',
          borderRadius: '12px',
          color: '#f8fafc',
          fontFamily: 'Inter, sans-serif'
        }}>
          <h4 style={{ color: '#ef4444', marginBottom: '8px' }}>
            ⚠️ {this.props.fallbackTitle || 'Rendering Error'}
          </h4>
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '16px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#f59e0b',
              color: '#07090e',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            Reload Component
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const isMobilePath = typeof window !== 'undefined' && (
    window.location.pathname === '/phone' || window.location.search.includes('mode=phone')
  );

  const [isMobileMode, setIsMobileMode] = useState(isMobilePath);

  // If in mobile scanner mode (e.g. phone camera pairing)
  if (isMobileMode) {
    return (
      <ErrorBoundary fallbackTitle="Mobile Scanner">
        <MobileScannerView onBackToDashboard={() => setIsMobileMode(false)} />
      </ErrorBoundary>
    );
  }

  // Flagship Hollywood Pre-Visualization & Movie Directing Platform
  return (
    <ErrorBoundary fallbackTitle="TwinCity Director Studio">
      <StuntStudio />
    </ErrorBoundary>
  );
}
