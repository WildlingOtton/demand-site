import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Demand HQ render failure:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', padding: '2rem', color: '#1f2937', background: '#f8fafc' }}>
          <h1 style={{ marginTop: 0 }}>Demand HQ failed to render</h1>
          <p style={{ marginBottom: '1rem' }}>A runtime error occurred while loading the app.</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#ffffff', padding: '1rem', borderRadius: '0.5rem' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
