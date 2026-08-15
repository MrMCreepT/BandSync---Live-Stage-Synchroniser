import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error in BandSync:', error, errorInfo);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-xl font-black text-white">Something went wrong</h2>
            <p className="text-xs text-zinc-400 font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800 break-all text-left">
              {this.state.error?.message || 'Unknown error occurred'}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-sm cursor-pointer transition-colors"
              >
                Reload Stage HUD
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
