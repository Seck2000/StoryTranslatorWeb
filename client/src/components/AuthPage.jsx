import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, saveAuth } from '../api';
import { LANGUAGES, LEVELS } from '../constants/languages';
import { AGE_BANDS } from '../constants/ageBands';

const inputClass =
    'w-full px-4 py-2.5 rounded-lg bg-white border border-[#EBE6DC] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8C5EB9] focus:border-transparent transition';

const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

export default function AuthPage({ mode, onSuccess, onSwitchMode, onBack }) {
    const isRegister = mode === 'register';

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [spokenLang, setSpokenLang] = useState('fr');
    const [learningLang, setLearningLang] = useState('en');
    const [level, setLevel] = useState('debutant');
    const [ageBand, setAgeBand] = useState('moyens');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (isRegister) {
            if (!ageBand) {
                setError('Choisis une tranche d’âge.');
                return;
            }
            if (password !== passwordConfirm) {
                setError('Les mots de passe ne correspondent pas.');
                return;
            }
            if (spokenLang === learningLang) {
                setError('La langue cible doit être différente de la langue maternelle.');
                return;
            }
        }

        setLoading(true);

        try {
            const url = isRegister ? '/api/auth/register' : '/api/auth/login';
            const body = isRegister
                ? {
                      firstName,
                      lastName,
                      email,
                      spokenLang,
                      learningLang,
                      level,
                      ageBand,
                      password,
                      passwordConfirm,
                  }
                : { email, password };

            const { data } = await api.post(url, body);
            saveAuth(data.token, data.user);
            onSuccess(data.user);
        } catch (err) {
            const msg =
                err.response?.data?.error ||
                (isRegister ? "Impossible de créer le compte." : "Impossible de se connecter.");
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex items-center justify-center py-6 overflow-y-auto">
            <div
                className={`w-full ${isRegister ? 'max-w-2xl' : 'max-w-md'} bg-white border border-[#EBE6DC] rounded-2xl p-6 md:p-8 shadow-xl my-4`}
            >
                <h1 className="text-2xl md:text-3xl font-bold text-[#8C5EB9] mb-1">
                    {isRegister ? 'Créer un compte' : 'Connexion'}
                </h1>
                <p className="text-gray-500 text-sm mb-6">
                    {isRegister
                        ? 'Ces infos servent à proposer les bonnes histoires selon ton âge.'
                        : 'Connectez-vous pour retrouver votre progression.'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegister && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Prénom *</label>
                                    <input
                                        type="text"
                                        required
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className={inputClass}
                                        placeholder="Aissatou"
                                        autoComplete="given-name"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Nom *</label>
                                    <input
                                        type="text"
                                        required
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className={inputClass}
                                        placeholder="Seck"
                                        autoComplete="family-name"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Adresse courriel *</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={inputClass}
                                    placeholder="vous@exemple.com"
                                    autoComplete="email"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Langue maternelle *</label>
                                    <select
                                        required
                                        value={spokenLang}
                                        onChange={(e) => setSpokenLang(e.target.value)}
                                        className={inputClass}
                                    >
                                        {LANGUAGES.map((l) => (
                                            <option key={l.code} value={l.code}>
                                                {l.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Langue cible *</label>
                                    <select
                                        required
                                        value={learningLang}
                                        onChange={(e) => setLearningLang(e.target.value)}
                                        className={inputClass}
                                    >
                                        {LANGUAGES.map((l) => (
                                            <option key={l.code} value={l.code}>
                                                {l.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Niveau *</label>
                                    <select
                                        required
                                        value={level}
                                        onChange={(e) => setLevel(e.target.value)}
                                        className={inputClass}
                                    >
                                        {LEVELS.map((l) => (
                                            <option key={l.code} value={l.code}>
                                                {l.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Tranche d’âge *</label>
                                    <select
                                        required
                                        value={ageBand}
                                        onChange={(e) => setAgeBand(e.target.value)}
                                        className={inputClass}
                                    >
                                        {AGE_BANDS.map((band) => (
                                            <option key={band.id} value={band.id}>
                                                {band.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Mot de passe *</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={inputClass}
                                        placeholder="Au moins 6 caractères"
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Confirmation *</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={passwordConfirm}
                                        onChange={(e) => setPasswordConfirm(e.target.value)}
                                        className={inputClass}
                                        placeholder="Répétez le mot de passe"
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {!isRegister && (
                        <>
                            <div>
                                <label className={labelClass}>Adresse courriel</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={inputClass}
                                    placeholder="vous@exemple.com"
                                    autoComplete="email"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Mot de passe</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={inputClass}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                            </div>
                        </>
                    )}

                    {error && (
                        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-lg bg-[#8C5EB9] hover:bg-[#7a4fa8] disabled:bg-purple-300 text-white font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-purple-200/50"
                    >
                        <span className="inline-flex w-5 h-5 items-center justify-center" aria-hidden="true">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                        </span>
                        <span>{isRegister ? 'Créer mon compte' : 'Se connecter'}</span>
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500 space-y-2">
                    <button
                        type="button"
                        onClick={() => onSwitchMode(isRegister ? 'login' : 'register')}
                        className="text-[#8C5EB9] hover:underline"
                    >
                        {isRegister
                            ? 'Déjà un compte ? Se connecter'
                            : "Pas de compte ? S'inscrire"}
                    </button>
                    <div>
                        <button
                            type="button"
                            onClick={onBack}
                            className="text-gray-400 hover:text-gray-700"
                        >
                            ← Retour à l&apos;accueil
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
