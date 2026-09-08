import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/index';
import Logger from '../lib/logger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    try {
      Logger.uiError('ErrorBoundary', error, errorInfo?.componentStack);
    } catch (_) {
      // Logger itself may not be loaded yet
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6" role="alert">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Something went wrong
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                An unexpected error occurred while rendering this page. Your data is safe — try refreshing or go back to the dashboard.
              </p>
            </div>

            {this.state.error && (
              <details className="text-left p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <summary className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                  Error Details (Click to Expand)
                </summary>
                <pre className="mt-2 text-[10px] text-rose-600 dark:text-rose-400 overflow-x-auto whitespace-pre-wrap break-words font-mono">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="primary" onClick={this.handleRetry} leftIcon={<RefreshCw className="w-4 h-4" />}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/dashboard'} leftIcon={<Home className="w-4 h-4" />}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
