import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_USER_KEY = 'auth_user';

export function saveAuth(token, user) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
}

export function loadStoredUser() {
    try {
        const raw = localStorage.getItem(AUTH_USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/** Message d'erreur lisible à partir d'une erreur Axios. */
export function getApiErrorMessage(error, fallback = 'Une erreur est survenue.') {
    const fromServer = error?.response?.data?.error;
    if (typeof fromServer === 'string' && fromServer.trim()) {
        return fromServer;
    }
    if (!error?.response) {
        return 'Impossible de joindre le serveur. Vérifie qu’il tourne sur le port 3000.';
    }
    if (error.response.status === 401) {
        return 'Session expirée. Reconnecte-toi puis réessaie.';
    }
    return fallback;
}

export async function transcribeSpeech(audioBlob, targetLang) {
    const formData = new FormData();
    const extension = audioBlob.type?.includes('ogg') ? 'ogg' : 'webm';
    formData.append('audio', audioBlob, `speech.${extension}`);
    formData.append('targetLang', targetLang);

    const { data } = await api.post('/api/speech/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

    return data.text;
}
