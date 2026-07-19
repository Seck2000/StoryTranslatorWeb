import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import whisper from '../../server/services/whisperTranscribe.js';

const { transcribeAudio, WHISPER_LANG_MAP } = whisper;

const originalKey = process.env.OPENAI_API_KEY;

afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
});

describe('WHISPER_LANG_MAP', () => {
    it('supporte les 7 langues de l\'application', () => {
        expect(Object.keys(WHISPER_LANG_MAP).sort()).toEqual(
            ['ar', 'de', 'en', 'es', 'fr', 'it', 'pt']
        );
    });
});

describe('transcribeAudio', () => {
    it('rejette un enregistrement vide avec le code EMPTY_AUDIO', async () => {
        await expect(
            transcribeAudio(Buffer.alloc(0), { targetLang: 'fr' })
        ).rejects.toMatchObject({ code: 'EMPTY_AUDIO' });
    });

    it('rejette si OPENAI_API_KEY est absente', async () => {
        delete process.env.OPENAI_API_KEY;
        await expect(
            transcribeAudio(Buffer.from('fake-audio'), { targetLang: 'fr' })
        ).rejects.toMatchObject({ code: 'OPENAI_API_KEY_MISSING' });
    });
});
