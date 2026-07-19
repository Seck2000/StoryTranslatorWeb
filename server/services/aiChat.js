const { GoogleGenerativeAI } = require('@google/generative-ai');

const LANG_LABELS = {
    fr: 'français',
    en: 'anglais',
    ar: 'arabe',
    es: 'espagnol',
    de: 'allemand',
    it: 'italien',
    pt: 'portugais',
};

const LEVEL_LABELS = {
    debutant: 'débutant',
    intermediaire: 'intermédiaire',
    avance: 'avancé',
};

const DEFAULT_MODEL = 'gemini-2.5-flash';
const START_USER_PROMPT =
    "L'élève a terminé l'histoire. Accueille-le brièvement et pose la première question de compréhension.";

function getGeminiClient() {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
        const error = new Error('Le service IA n\'est pas configuré (GEMINI_API_KEY manquante).');
        error.code = 'GEMINI_API_KEY_MISSING';
        throw error;
    }
    return new GoogleGenerativeAI(apiKey);
}

function buildStoryContext(title, scenes) {
    const lines = scenes.map((scene, index) => {
        const label = scene.id ?? index + 1;
        return `Scène ${label}: ${scene.text}`;
    });
    return `Titre: ${title}\n\n${lines.join('\n')}`;
}

function buildSystemPrompt(storyContext, targetLang, level) {
    const lang = LANG_LABELS[targetLang] || targetLang;
    const lvl = LEVEL_LABELS[level] || level;

    return `Tu es un tuteur de langues bienveillant pour des ENFANTS. L'élève vient de lire une histoire.

RÈGLES STRICTES SUR LE CONTENU:
- Pose des questions UNIQUEMENT sur le contenu de l'histoire ci-dessous.
- N'invente aucun personnage, lieu ou événement absent du texte.
- Une seule question à la fois.
- Après 3 à 5 échanges, demande un court résumé de l'histoire.
- Quand l'élève a bien résumé, félicite-le chaleureusement et termine par [FIN].

LANGUE UNIQUE OBLIGATOIRE:
- Tu communiques EXCLUSIVEMENT en ${lang}. C'est la langue que l'enfant apprend.
- INTERDIT d'utiliser une autre langue (pas d'anglais si la langue cible est le français, etc.).
- Toutes tes questions ET la demande de résumé final doivent être en ${lang} uniquement.

ÉCRITURE DES NOMBRES:
- N'accepte JAMAIS les chiffres (0-9) dans les réponses de l'élève.
- Si l'élève répond avec un chiffre, refuse gentiment et demande d'écrire le nombre en toutes lettres en ${lang}.
- Exemple: si l'élève écrit "7", demande "sept" (ou l'équivalent en ${lang}).

STYLE PÉDAGOGIQUE:
- Adapte ton vocabulaire au niveau ${lvl}.
- Sois encourageant, simple et chaleureux avec un enfant.
- Utilise des phrases courtes et claires.

HISTOIRE:
${storyContext}`;
}

const DIGIT_PATTERN = /[0-9٠-٩۰-۹]/;

function containsDigits(text) {
    return DIGIT_PATTERN.test(text || '');
}

function parseAssistantReply(content) {
    const raw = (content || '').trim();
    const done = raw.includes('[FIN]');
    const message = raw.replace(/\[FIN\]/g, '').trim();
    return { message: message || 'Merci pour ta participation !', done };
}

function toGeminiHistory(messages) {
    return messages.map((entry) => ({
        role: entry.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: entry.content }],
    }));
}

function buildGeminiChatHistory(geminiMessages) {
    const history = geminiMessages.slice(0, -1);

    if (history.length > 0 && history[0].role === 'model') {
        return [
            { role: 'user', parts: [{ text: START_USER_PROMPT }] },
            ...history,
        ];
    }

    return history;
}

function extractResponseText(result) {
    try {
        return result.response.text();
    } catch (error) {
        const blocked = new Error('La réponse de l\'IA a été bloquée par les filtres de sécurité. Reformulez votre message.');
        blocked.code = 'GEMINI_RESPONSE_BLOCKED';
        throw blocked;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelayMs(error) {
    const message = error?.message || '';
    const match = message.match(/retry in ([\d.]+)s/i);
    if (match) {
        return Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 500, 35000);
    }
    return 20000;
}

function isNetworkError(error) {
    const message = (error?.message || '').toLowerCase();
    return (
        message.includes('fetch failed') ||
        message.includes('network') ||
        message.includes('econnreset') ||
        message.includes('etimedout')
    );
}

function isModelNotFoundError(error) {
    if (error.status === 404) return true;
    const message = (error.message || '').toLowerCase();
    return message.includes('not found');
}

function isRateLimitError(error) {
    if (error.status === 429) return true;
    const message = (error.message || '').toLowerCase();
    return message.includes('quota') || message.includes('rate limit') || message.includes('resource_exhausted');
}

function getPreferredModel() {
    return (process.env.GEMINI_CHAT_MODEL || DEFAULT_MODEL).trim();
}

async function runChatWithModel(modelName, { messages, storyContext, targetLang, level }) {
    const client = getGeminiClient();

    const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: buildSystemPrompt(storyContext, targetLang, level),
        generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.6,
        },
    });

    const geminiMessages = toGeminiHistory(messages);
    const lastMessage = geminiMessages[geminiMessages.length - 1];

    if (!lastMessage || lastMessage.role !== 'user') {
        const error = new Error('Le dernier message doit provenir de l\'utilisateur.');
        error.code = 'INVALID_CHAT_HISTORY';
        throw error;
    }

    const history = buildGeminiChatHistory(geminiMessages);
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const content = extractResponseText(result);

    return parseAssistantReply(content);
}

async function runChat(params) {
    const preferredModel = getPreferredModel();
    const modelsToTry = preferredModel === DEFAULT_MODEL
        ? [preferredModel]
        : [preferredModel, DEFAULT_MODEL];

    let lastError;

    for (const modelName of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                return await runChatWithModel(modelName, params);
            } catch (error) {
                lastError = error;

                if (isNetworkError(error) && attempt === 0) {
                    console.warn('Erreur réseau Gemini, nouvel essai...', error.message);
                    await sleep(2000);
                    continue;
                }

                if (isRateLimitError(error) && attempt === 0) {
                    const delay = parseRetryDelayMs(error);
                    console.warn(`Limite Gemini (${modelName}), attente ${delay}ms...`);
                    await sleep(delay);
                    continue;
                }

                if (isModelNotFoundError(error)) {
                    break;
                }

                throw error;
            }
        }
    }

    throw lastError;
}

function normalizeScenes(scenes) {
    if (!Array.isArray(scenes) || scenes.length === 0) {
        return null;
    }

    const normalized = scenes
        .map((scene, index) => ({
            id: scene.id ?? index + 1,
            text: typeof scene.text === 'string' ? scene.text.trim() : '',
        }))
        .filter((scene) => scene.text.length > 0);

    return normalized.length > 0 ? normalized : null;
}

module.exports = {
    buildStoryContext,
    normalizeScenes,
    runChat,
    containsDigits,
    DEFAULT_MODEL,
    START_USER_PROMPT,
};
