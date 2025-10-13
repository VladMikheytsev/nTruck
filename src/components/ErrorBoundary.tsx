import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Произошла ошибка
              </h2>
              <p className="text-gray-600 mb-4">
                Что-то пошло не так. Попробуйте перезагрузить страницу.
              </p>
              
              <button
                onClick={this.handleReload}
                className="btn-primary mb-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Перезагрузить
              </button>

              <details className="text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  Подробности ошибки
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-auto max-h-40">
                  <div className="font-semibold mb-2">Error:</div>
                  <div className="mb-2">{this.state.error?.toString()}</div>
                  
                  {this.state.errorInfo && (
                    <>
                      <div className="font-semibold mb-2">Stack trace:</div>
                      <pre className="whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
