export const SPEECH_LANG_MAP = {
    fr: 'fr-FR',
    en: 'en-US',
    ar: 'ar-SA',
    es: 'es-ES',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-PT',
};

export function isSpeechRecognitionSupported() {
    return Boolean(getSpeechRecognitionClass());
}

export function isSpeechSynthesisSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getSpeechRecognitionClass() {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function stopSpeaking() {
    if (isSpeechSynthesisSupported()) {
        window.speechSynthesis.cancel();
    }
}

function waitForVoices() {
    return new Promise((resolve) => {
        if (!isSpeechSynthesisSupported()) {
            resolve();
            return;
        }

        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve();
            return;
        }

        const onVoicesChanged = () => {
            window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
            resolve();
        };

        window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
        window.setTimeout(() => {
            window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
            resolve();
        }, 500);
    });
}

export async function speakText(text, langCode) {
    if (!text?.trim() || !isSpeechSynthesisSupported()) {
        return;
    }

    stopSpeaking();
    await waitForVoices();

    return new Promise((resolve) => {
        try {
            const utterance = new SpeechSynthesisUtterance(text.trim());
            utterance.lang = SPEECH_LANG_MAP[langCode] || 'fr-FR';
            utterance.rate = 0.95;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
        } catch {
            resolve();
        }
    });
}

export function createSpeechRecognition(langCode) {
    try {
        const SpeechRecognition = getSpeechRecognitionClass();
        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();
        recognition.lang = SPEECH_LANG_MAP[langCode] || 'fr-FR';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        return recognition;
    } catch {
        return null;
    }
}
