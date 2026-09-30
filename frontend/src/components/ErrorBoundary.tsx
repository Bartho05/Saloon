import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Impede que um erro em uma página derrube a aplicação inteira.
 * O usuário vê uma mensagem e pode tentar novamente ou voltar ao início.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.href = '/';
  };

  render(): ReactNode {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0l-7 12a2 2 0 001.74 3z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">Algo deu errado</h1>
          <p className="text-gray-600 mb-6">
            Ocorreu um erro inesperado ao carregar esta tela. Tente novamente.
          </p>

          <details className="text-left mb-6">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Detalhes técnicos
            </summary>
            <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
              {error.message}
            </pre>
          </details>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
