import React, { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught Error Boundary Exception:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl border border-rose-800/60 bg-rose-950/20 text-neutral-100 max-w-2xl mx-auto my-8 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400" />
            {this.props.fallbackTitle || "Something went wrong in this view"}
          </div>

          <p className="text-neutral-300 leading-relaxed">
            {this.state.error?.message || "An unexpected error occurred while rendering."}
          </p>

          <button
            onClick={this.handleReset}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 transition-all shadow-lg shadow-rose-600/20"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Reloading View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
