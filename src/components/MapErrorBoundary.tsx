import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class MapErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Google Maps rendering issue',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MapErrorBoundary caught an unhandled map error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          id="map-error-boundary-fallback"
          className="relative w-full min-h-[520px] rounded-xl overflow-hidden border border-amber-500/30 bg-[#0F1A3D] p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-md"
        >
          {/* Subtle Grid Backdrop */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(#0F9D8C 1px, transparent 1px), linear-gradient(to right, #0F9D8C 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative z-10 max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Google Maps Display Notice
              </h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                The interactive Google Map encountered a temporary rendering issue ({this.state.errorMessage}).
                Your project data and metrics remain intact.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F9D8C] hover:bg-[#0d8778] text-white shadow-sm transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Google Map</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
