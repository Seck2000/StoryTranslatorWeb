const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const { transcribeAudio, WHISPER_LANG_MAP } = require('../services/whisperTranscribe');

const router = express.Router();

router.use(authMiddleware);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

function handleSpeechError(res, error) {
    if (error.code === 'OPENAI_API_KEY_MISSING') {
        return res.status(503).json({ error: error.message });
    }

    if (error.code === 'EMPTY_AUDIO') {
        return res.status(400).json({ error: error.message });
    }

    const message = (error.message || '').toLowerCase();

    if (error.status === 429 || message.includes('quota') || message.includes('insufficient_quota')) {
        return res.status(429).json({
            error: 'Quota OpenAI épuisé pour Whisper. Vérifiez votre compte OpenAI.',
        });
    }

    if (error.status === 401 || message.includes('api key')) {
        return res.status(503).json({
            error: 'Clé API OpenAI invalide. Vérifiez OPENAI_API_KEY dans server/.env.',
        });
    }

    console.error('Erreur Whisper:', error);
    return res.status(500).json({
        error: 'Impossible de transcrire l\'audio. Réessayez ou passez en mode Écrire.',
    });
}

// POST /api/speech/transcribe
router.post('/transcribe', upload.single('audio'), async (req, res) => {
    const targetLang = WHISPER_LANG_MAP[req.body?.targetLang]
        ? req.body.targetLang
        : 'fr';

    if (!req.file?.buffer?.length) {
        return res.status(400).json({ error: 'Fichier audio manquant.' });
    }

    try {
        const text = await transcribeAudio(req.file.buffer, {
            targetLang,
            mimeType: req.file.mimetype,
            originalName: req.file.originalname,
        });

        if (!text) {
            return res.status(422).json({
                error: 'Aucune parole détectée. Parle plus fort et réessaie.',
            });
        }

        res.json({ text });
    } catch (error) {
        return handleSpeechError(res, error);
    }
});

module.exports = router;
