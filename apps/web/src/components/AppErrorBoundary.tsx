import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV)
      console.error('Unexpected application render error', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="mx-auto max-w-xl p-8" role="alert">
          <h1 className="text-2xl font-bold">This page ran into a problem</h1>
          <p className="mt-3">Your data has not been changed. Reload the page to try again.</p>
          <button
            className="mt-5 rounded-xl bg-aqua px-5 py-3 font-bold"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
