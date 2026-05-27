import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <p className="text-2xl">Something went wrong</p>
            <p className="text-sm text-slate-400 font-mono break-all">{error.message}</p>
            <button
              onClick={this.handleReset}
              className="mt-4 px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
