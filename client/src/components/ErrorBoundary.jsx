import { Component } from 'react';

function isRemoveChildError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('removechild') || message.includes('nœud à supprimer') || message.includes('not a child');
}

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorMessage: '', autoRetried: false };
    }

    static getDerivedStateFromError(error) {
        const message =
            error?.message ||
            (typeof error === 'string' ? error : 'Erreur inconnue');
        return { hasError: true, errorMessage: message };
    }

    componentDidCatch(error, info) {
        console.error('Erreur React capturée:', error, info);
        try {
            sessionStorage.setItem(
                'last_react_error',
                JSON.stringify({
                    message: error?.message || String(error),
                    stack: error?.stack || '',
                    componentStack: info?.componentStack || '',
                    at: new Date().toISOString(),
                })
            );
        } catch {
            // ignore storage errors
        }

        // removeChild est souvent un faux crash (traduction navigateur / re-render).
        // On récupère une fois automatiquement.
        if (isRemoveChildError(error) && !this.state.autoRetried) {
            window.setTimeout(() => {
                this.setState({ hasError: false, errorMessage: '', autoRetried: true });
            }, 50);
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, errorMessage: '', autoRetried: false });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#FAF8F6] text-gray-900 flex items-center justify-center p-6">
                    <div className="max-w-lg w-full bg-white border border-[#EBE6DC] rounded-2xl p-6 text-center shadow-xl">
                        <h1 className="text-2xl font-bold text-red-600 mb-3">Une erreur est survenue</h1>
                        <p className="text-gray-600 mb-4">
                            La page ne peut pas s&apos;afficher correctement. Tu peux réessayer sans
                            perdre ta session, ou recharger complètement.
                        </p>
                        {this.state.errorMessage && (
                            <p className="text-left text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 break-words font-mono">
                                {this.state.errorMessage}
                            </p>
                        )}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                type="button"
                                onClick={this.handleReset}
                                className="px-5 py-3 rounded-xl bg-[#8C5EB9] hover:bg-[#7a4fa8] text-white font-semibold transition"
                            >
                                Réessayer
                            </button>
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="px-5 py-3 rounded-xl bg-white border border-[#EBE6DC] hover:bg-[#F2E9FB] text-gray-800 font-semibold transition"
                            >
                                Recharger la page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
