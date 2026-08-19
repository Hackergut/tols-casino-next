'use client';

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional fallback UI. Receives error + reset function. */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic error boundary for catching render errors in client components.
 * Provides a retry mechanism and logs errors for debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development; in production you'd send to Sentry/etc.
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }

      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-red-400 mb-2">
              Something went wrong
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {this.state.error.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={this.reset}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
