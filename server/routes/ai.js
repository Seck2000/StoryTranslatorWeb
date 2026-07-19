const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { buildStoryContext, normalizeScenes, runChat, containsDigits, START_USER_PROMPT } = require('../services/aiChat');

const router = express.Router();

router.use(authMiddleware);

const ALLOWED_LANGS = ['fr', 'en', 'ar', 'es', 'de', 'it', 'pt'];
const ALLOWED_LEVELS = ['debutant', 'intermediaire', 'avance'];

function parseChatBody(body) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const targetLang = ALLOWED_LANGS.includes(body.targetLang) ? body.targetLang : 'en';
    const level = ALLOWED_LEVELS.includes(body.level) ? body.level : 'debutant';
    const scenes = normalizeScenes(body.scenes);

    if (!title) {
        return { error: 'Titre de l\'histoire manquant.' };
    }
    if (!scenes) {
        return { error: 'Aucun texte de scène valide pour la discussion.' };
    }

    return {
        title,
        targetLang,
        level,
        scenes,
        storyContext: buildStoryContext(title, scenes),
    };
}

function handleAiError(res, error) {
    if (error.code === 'GEMINI_API_KEY_MISSING') {
        return res.status(503).json({ error: error.message });
    }

    if (error.code === 'INVALID_CHAT_HISTORY') {
        return res.status(400).json({ error: error.message });
    }

    if (error.code === 'GEMINI_RESPONSE_BLOCKED') {
        return res.status(422).json({ error: error.message });
    }

    const message = (error.message || '').toLowerCase();

    if (message.includes('first content should be with role')) {
        return res.status(400).json({
            error: 'Historique de discussion invalide. Rechargez la page et recommencez la discussion.',
        });
    }
    const isQuotaError =
        error.status === 429 ||
        message.includes('quota') ||
        message.includes('resource_exhausted') ||
        message.includes('rate limit');

    if (isQuotaError) {
        return res.status(429).json({
            error: 'Quota Gemini épuisé. Attendez 1 à 2 minutes puis réessayez, ou vérifiez votre quota sur Google AI Studio.',
        });
    }

    const isModelNotFound =
        error.status === 404 ||
        message.includes('not found') ||
        message.includes('is not supported for generatecontent');

    if (isModelNotFound) {
        return res.status(503).json({
            error: 'Modèle Gemini introuvable. Utilisez GEMINI_CHAT_MODEL="gemini-2.5-flash" dans server/.env.',
        });
    }

    const isAuthError =
        error.status === 401 ||
        error.status === 403 ||
        message.includes('api key') ||
        message.includes('api_key_invalid') ||
        message.includes('permission denied');

    if (isAuthError) {
        return res.status(503).json({
            error: 'Clé API Gemini invalide. Créez une clé sur aistudio.google.com/apikey et mettez-la dans GEMINI_API_KEY.',
        });
    }

    const isNetworkError =
        message.includes('fetch failed') ||
        message.includes('network') ||
        message.includes('econnreset') ||
        message.includes('etimedout');

    if (isNetworkError) {
        return res.status(503).json({
            error: 'Connexion à Gemini impossible. Vérifiez votre connexion Internet et réessayez.',
        });
    }

    console.error('Erreur service IA:', error);
    return res.status(500).json({
        error: 'Le quiz est momentanément indisponible. Réessayez dans un instant.',
    });
}

// POST /api/ai/chat/start
router.post('/chat/start', async (req, res) => {
    const parsed = parseChatBody(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }

    try {
        const result = await runChat({
            messages: [
                {
                    role: 'user',
                    content: START_USER_PROMPT,
                },
            ],
            storyContext: parsed.storyContext,
            targetLang: parsed.targetLang,
            level: parsed.level,
        });

        res.json(result);
    } catch (error) {
        return handleAiError(res, error);
    }
});

// POST /api/ai/chat/message
router.post('/chat/message', async (req, res) => {
    const parsed = parseChatBody(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }

    const messages = req.body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Historique de discussion invalide.' });
    }

    const validMessages = messages.every(
        (entry) =>
            entry &&
            (entry.role === 'user' || entry.role === 'assistant') &&
            typeof entry.content === 'string' &&
            entry.content.trim().length > 0
    );

    if (!validMessages) {
        return res.status(400).json({ error: 'Format de message invalide.' });
    }

    const lastUserMessage = [...messages].reverse().find((entry) => entry.role === 'user');
    if (lastUserMessage && containsDigits(lastUserMessage.content)) {
        return res.status(400).json({
            error: 'Pas de chiffres ! Écris ta réponse en lettres (exemple : sept, pas 7).',
        });
    }

    try {
        const result = await runChat({
            messages,
            storyContext: parsed.storyContext,
            targetLang: parsed.targetLang,
            level: parsed.level,
        });

        res.json(result);
    } catch (error) {
        return handleAiError(res, error);
    }
});

module.exports = router;
