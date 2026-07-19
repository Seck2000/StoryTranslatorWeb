const OpenAI = require('openai');
const { toFile } = require('openai');

const WHISPER_LANG_MAP = {
    fr: 'fr',
    en: 'en',
    ar: 'ar',
    es: 'es',
    de: 'de',
    it: 'it',
    pt: 'pt',
};

function getOpenAIClient() {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
        const error = new Error('Le service Whisper n\'est pas configuré (OPENAI_API_KEY manquante).');
        error.code = 'OPENAI_API_KEY_MISSING';
        throw error;
    }
    return new OpenAI({ apiKey });
}

async function transcribeAudio(buffer, { targetLang, mimeType, originalName }) {
    if (!buffer?.length) {
        const error = new Error('Enregistrement audio vide.');
        error.code = 'EMPTY_AUDIO';
        throw error;
    }

    const client = getOpenAIClient();
    const model = process.env.WHISPER_MODEL || 'whisper-1';
    const language = WHISPER_LANG_MAP[targetLang];

    const extension = mimeType?.includes('webm')
        ? 'webm'
        : mimeType?.includes('ogg')
          ? 'ogg'
          : mimeType?.includes('wav')
            ? 'wav'
            : mimeType?.includes('mp4')
              ? 'mp4'
              : 'webm';

    const file = await toFile(buffer, originalName || `speech.${extension}`, {
        type: mimeType || 'audio/webm',
    });

    const transcription = await client.audio.transcriptions.create({
        file,
        model,
        language,
        response_format: 'text',
    });

    const text = typeof transcription === 'string'
        ? transcription
        : transcription?.text || '';

    return text.trim();
}

module.exports = {
    transcribeAudio,
    WHISPER_LANG_MAP,
};
