import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public handleReload = () => {
    window.location.reload();
  };

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0D13] text-white p-6 font-sans select-text">
          <div className="max-w-xl w-full bg-[#121620] border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {this.props.fallbackTitle || "Something went wrong"}
                </h2>
                <p className="text-xs text-zinc-400 font-mono">
                  The panel encountered a UI error and recovered safely.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-4 bg-black/40 border border-white/5 rounded-xl font-mono text-xs text-rose-300 overflow-x-auto max-h-48 custom-scrollbar">
                <p className="font-semibold">{this.state.error.message || String(this.state.error)}</p>
                {this.state.error.stack && (
                  <pre className="text-[10px] text-zinc-500 mt-2 whitespace-pre-wrap">
                    {this.state.error.stack.split("\n").slice(0, 5).join("\n")}
                  </pre>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-theme-600 hover:bg-theme-500 text-white text-xs font-mono rounded-xl transition-all font-medium flex items-center gap-2 shadow-lg shadow-theme-600/20"
              >
                <RefreshCw size={14} /> Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-mono rounded-xl border border-white/10 transition-all flex items-center gap-2"
              >
                Reload Page
              </button>
              <a
                href="/"
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-mono rounded-xl border border-white/10 transition-all flex items-center gap-2 ml-auto"
              >
                <Home size={14} /> Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
