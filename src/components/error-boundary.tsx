import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="grid min-h-[100dvh] w-full place-items-center bg-[#0d1018] p-6 text-[#eef3f6]">
      <div className="w-full max-w-lg rounded-sm border border-[#2c3544] bg-[#151b27] p-8 text-center shadow-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#d7ff3f]">UPCore / Recovery</p>
        <h1 className="mt-4 text-2xl font-bold">The dashboard hit a render error</h1>
        <p className="mt-2 text-sm leading-6 text-[#9aa6b2]">
          Your Discord session is still safe. Reload the dashboard or try the
          current view again.
        </p>
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-xs font-semibold text-[#9aa6b2]">
            Show technical details
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-[#0d1018] p-3 text-xs text-[#ff8760]">
            {error.message || String(error)}
          </pre>
        </details>
        <button
          type="button"
          onClick={resetError}
          className="mt-5 rounded bg-[#d7ff3f] px-4 py-2 text-sm font-bold text-[#0d1018] hover:brightness-110"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
