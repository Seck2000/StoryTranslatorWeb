import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Keyboard, Loader2, Mic, MicOff, Send, Sparkles, Star, Volume2 } from 'lucide-react';
import { api, transcribeSpeech } from '../api';
import { buildScenesPayload } from '../utils/storyText';
import { containsDigits, DIGIT_ERROR_MESSAGE } from '../utils/chatValidation';
import { LANGUAGES } from '../constants/languages';
import { createAudioRecorder, isMicrophoneSupported } from '../utils/audioRecorder';
import {
    isSpeechSynthesisSupported,
    speakText,
    stopSpeaking,
} from '../utils/speech';

const LANG_EMOJI = {
    fr: '🇫🇷',
    en: '🇬🇧',
    ar: '🇸🇦',
    es: '🇪🇸',
    de: '🇩🇪',
    it: '🇮🇹',
    pt: '🇵🇹',
};

function getLangLabel(code) {
    return LANGUAGES.find((lang) => lang.code === code)?.label || code;
}

export default function StoryChat({ story, targetLang, level, onBack }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [finished, setFinished] = useState(false);
    const [error, setError] = useState('');
    const [chatMode, setChatMode] = useState('text');
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const bottomRef = useRef(null);
    const audioRecorderRef = useRef(null);
    const messagesRef = useRef(messages);
    const spokenMessageCountRef = useRef(0);
    const isMountedRef = useRef(true);
    const chatModeRef = useRef(chatMode);

    const langLabel = useMemo(() => getLangLabel(targetLang), [targetLang]);
    const langEmoji = LANG_EMOJI[targetLang] || '🌍';
    const voiceSupported = isMicrophoneSupported() && isSpeechSynthesisSupported();

    const scenesPayload = useMemo(() => buildScenesPayload(story), [story]);
    const chatPayload = useMemo(
        () => ({
            title: story?.title || 'Histoire',
            scenes: scenesPayload,
            targetLang,
            level,
        }),
        [story?.title, scenesPayload, targetLang, level]
    );

    messagesRef.current = messages;
    chatModeRef.current = chatMode;

    const speakAssistantMessage = async (text) => {
        if (chatModeRef.current !== 'voice' || !text?.trim() || !isMountedRef.current) return;
        setIsSpeaking(true);
        try {
            await speakText(text, targetLang);
        } catch (speechError) {
            console.error('Erreur lecture vocale:', speechError);
        } finally {
            if (isMountedRef.current) {
                setIsSpeaking(false);
            }
        }
    };

    const stopRecording = async () => {
        if (!audioRecorderRef.current?.isRecording()) {
            setIsRecording(false);
            return;
        }

        setIsRecording(false);
        setIsTranscribing(true);
        setError('');

        try {
            const blob = await audioRecorderRef.current.stop();
            if (!blob?.size) {
                setError('Enregistrement vide. Parle plus fort et réessaie.');
                return;
            }

            const text = await transcribeSpeech(blob, targetLang);
            if (!isMountedRef.current) return;

            await submitMessage(text);
        } catch (err) {
            if (isMountedRef.current) {
                setError(err.response?.data?.error || 'Impossible de transcrire ta voix. Réessaie ou passe en mode Écrire.');
            }
        } finally {
            if (isMountedRef.current) {
                setIsTranscribing(false);
            }
        }
    };

    useEffect(() => {
        isMountedRef.current = true;
        audioRecorderRef.current = createAudioRecorder();
        return () => {
            isMountedRef.current = false;
            audioRecorderRef.current?.cleanup();
            stopSpeaking();
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function startChat() {
            if (scenesPayload.length === 0) {
                setError('Cette histoire ne contient pas de texte pour le quiz.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError('');
            spokenMessageCountRef.current = 0;

            try {
                const { data } = await api.post('/api/ai/chat/start', chatPayload);
                if (cancelled) return;

                setMessages([{ role: 'assistant', content: data.message }]);
                if (data.done) setFinished(true);
            } catch (err) {
                if (!cancelled) {
                    setError(err.response?.data?.error || 'Impossible de démarrer le quiz.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        startChat();
        return () => {
            cancelled = true;
        };
    }, [chatPayload, scenesPayload.length]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading, sending, isTranscribing]);

    useEffect(() => {
        if (chatMode !== 'voice' || loading || finished) return;

        const assistantMessages = messages.filter((message) => message.role === 'assistant');
        if (assistantMessages.length <= spokenMessageCountRef.current) return;

        const latest = assistantMessages[assistantMessages.length - 1];
        spokenMessageCountRef.current = assistantMessages.length;

        speakAssistantMessage(latest.content);
    }, [messages, chatMode, loading, finished, targetLang]);

    const submitMessage = async (rawText) => {
        const text = rawText.trim();
        if (!text || sending || finished || loading) return;

        if (containsDigits(text)) {
            setError(DIGIT_ERROR_MESSAGE);
            if (chatMode === 'voice') {
                await speakText(
                    'Pas de chiffres. Dis le nombre en lettres, par exemple sept.',
                    targetLang
                );
            }
            return;
        }

        const userMessage = { role: 'user', content: text };
        const previousMessages = messagesRef.current;
        const updatedMessages = [...previousMessages, userMessage];

        setMessages(updatedMessages);
        setInput('');
        setSending(true);
        setError('');

        try {
            const { data } = await api.post('/api/ai/chat/message', {
                ...chatPayload,
                messages: updatedMessages,
            });

            setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
            if (data.done) setFinished(true);
        } catch (err) {
            setError(err.response?.data?.error || "Impossible d'envoyer le message.");
            setMessages(previousMessages);
        } finally {
            setSending(false);
        }
    };

    const handleSend = async (event) => {
        event.preventDefault();
        await submitMessage(input);
    };

    const handleToggleRecording = async () => {
        if (!voiceSupported || isSpeaking || sending || loading || finished || isTranscribing) return;

        if (isRecording) {
            await stopRecording();
            return;
        }

        setError('');
        try {
            await audioRecorderRef.current.start();
            if (!isMountedRef.current) return;
            setIsRecording(true);
        } catch (err) {
            if (!isMountedRef.current) return;
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Autorise le micro dans ton navigateur pour parler.');
            } else if (err.message === 'MICROPHONE_UNSUPPORTED') {
                setError('Le micro n\'est pas disponible sur ce navigateur.');
            } else {
                setError('Impossible de démarrer le micro. Réessaie dans un instant.');
            }
        }
    };

    const handleModeChange = (mode) => {
        if (mode === chatMode || loading || sending || isRecording || isTranscribing) return;

        if (isRecording) {
            audioRecorderRef.current?.cleanup();
            setIsRecording(false);
        }
        stopSpeaking();
        setIsSpeaking(false);
        setError('');
        setChatMode(mode);

        if (mode === 'voice' && messages.length > 0) {
            spokenMessageCountRef.current = messages.filter((m) => m.role === 'assistant').length - 1;
        }
    };

    const voiceStatus = (() => {
        if (isSpeaking) return { label: 'L\'IA parle...', color: 'text-[#8C5EB9]' };
        if (isTranscribing) return { label: 'Je transcris ta voix...', color: 'text-amber-600' };
        if (isRecording) return { label: 'Je t\'écoute... (appuie pour envoyer)', color: 'text-red-600' };
        if (sending) return { label: 'Je réfléchis...', color: 'text-[#8C5EB9]' };
        return { label: 'Appuie sur le micro pour parler', color: 'text-gray-500' };
    })();

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-[#EBE6DC] overflow-hidden shadow-sm">
            <header className="flex items-center justify-between gap-3 px-4 py-4 border-b border-[#EBE6DC] bg-[#FAF8F6]">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white hover:bg-[#F2E9FB] text-gray-700 border border-[#EBE6DC] transition text-sm font-semibold"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                </button>
                <div className="flex items-center gap-2 text-[#8C5EB9] font-bold text-lg">
                    <Sparkles className="w-5 h-5" />
                    Quiz de l&apos;histoire
                </div>
                <div className="w-20" />
            </header>

            <div className="px-4 py-3 bg-white border-b border-[#EBE6DC] space-y-3">
                <p className="text-sm text-gray-700 text-center md:text-left">
                    <span className="font-bold">{story?.title || 'Sans titre'}</span>
                    {' — '}
                    Réponds en {langEmoji} <strong>{langLabel}</strong>
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <span className="text-xs text-gray-400 mr-1">Mode :</span>
                    <button
                        type="button"
                        onClick={() => handleModeChange('text')}
                        disabled={loading || sending || isRecording || isTranscribing}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
                            chatMode === 'text'
                                ? 'bg-[#8C5EB9] text-white'
                                : 'bg-[#FAF8F6] text-gray-600 hover:bg-[#F2E9FB] border border-[#EBE6DC]'
                        }`}
                    >
                        <Keyboard className="w-4 h-4" />
                        Écrire
                    </button>
                    <button
                        type="button"
                        onClick={() => handleModeChange('voice')}
                        disabled={loading || sending || isRecording || isTranscribing || !voiceSupported}
                        title={voiceSupported ? 'Discussion vocale' : 'Non disponible sur ce navigateur'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
                            chatMode === 'voice'
                                ? 'bg-[#8C5EB9] text-white'
                                : 'bg-[#FAF8F6] text-gray-600 hover:bg-[#F2E9FB] border border-[#EBE6DC] disabled:opacity-40'
                        }`}
                    >
                        <Mic className="w-4 h-4" />
                        Parler
                    </button>
                </div>

                <p className="text-xs text-amber-700 text-center md:text-left">
                    {chatMode === 'voice'
                        ? '🎤 Mode oral : écoute l\'IA, puis réponds à voix haute. Dis les nombres en lettres.'
                        : '✏️ Mode écrit : écris les nombres en lettres, sans chiffres (ex : « sept », pas « 7 »)'}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {loading && (
                    <div className="flex items-center justify-center gap-2 text-[#8C5EB9] py-12">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-base font-medium">On prépare ta première question...</span>
                    </div>
                )}

                {!loading &&
                    messages.map((message, index) => (
                        <div
                            key={`${message.role}-${index}`}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[90%] md:max-w-[75%] px-4 py-3 rounded-3xl text-base leading-relaxed ${
                                    message.role === 'user'
                                        ? 'bg-[#8C5EB9] text-white rounded-br-lg shadow-sm'
                                        : 'bg-[#FAF8F6] text-gray-900 border border-[#EBE6DC] rounded-bl-lg'
                                }`}
                            >
                                {message.content}
                            </div>
                        </div>
                    ))}

                {sending && chatMode === 'text' && (
                    <div className="flex justify-start">
                        <div className="bg-[#FAF8F6] border border-[#EBE6DC] px-4 py-3 rounded-3xl rounded-bl-lg text-[#8C5EB9] text-base flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Je réfléchis...
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {error && (
                <p className="mx-4 mb-2 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 font-medium">
                    {error}
                </p>
            )}

            {finished ? (
                <div className="p-5 border-t border-[#EBE6DC] bg-[#F2E9FB] text-center">
                    <div className="flex justify-center gap-1 mb-3">
                        <Star className="w-8 h-8 text-yellow-400 fill-yellow-400 animate-pulse" />
                        <Star className="w-10 h-10 text-yellow-300 fill-yellow-300 animate-pulse" />
                        <Star className="w-8 h-8 text-yellow-400 fill-yellow-400 animate-pulse" />
                    </div>
                    <p className="text-[#8C5EB9] mb-1 font-extrabold text-xl">Bravo champion ! 🎉</p>
                    <p className="text-gray-600 text-sm mb-4">Tu as super bien résumé l&apos;histoire !</p>
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-6 py-3 rounded-2xl bg-[#8C5EB9] hover:bg-[#7a4fa8] text-white font-bold text-lg transition transform hover:scale-105 active:scale-95"
                    >
                        Retour à l&apos;accueil
                    </button>
                </div>
            ) : chatMode === 'voice' ? (
                <div className="p-5 border-t border-[#EBE6DC] bg-[#FAF8F6] flex flex-col items-center gap-4">
                    <div className={`flex items-center gap-2 text-sm font-medium ${voiceStatus.color}`}>
                        {isSpeaking ? (
                            <Volume2 className="w-5 h-5 animate-pulse" />
                        ) : isTranscribing ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : isRecording ? (
                            <Mic className="w-5 h-5 animate-pulse" />
                        ) : sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Mic className="w-5 h-5" />
                        )}
                        {voiceStatus.label}
                    </div>

                    <button
                        type="button"
                        onClick={handleToggleRecording}
                        disabled={loading || sending || isSpeaking || isTranscribing || !voiceSupported}
                        className={`w-20 h-20 rounded-full flex items-center justify-center transition transform shadow-xl ${
                            isRecording
                                ? 'bg-red-600 hover:bg-red-500 scale-110 animate-pulse'
                                : 'bg-[#8C5EB9] hover:bg-[#7a4fa8] hover:scale-105 active:scale-95'
                        } disabled:bg-gray-300 disabled:scale-100 disabled:animate-none`}
                        title={isRecording ? 'Envoyer' : 'Parler'}
                    >
                        {isRecording ? (
                            <MicOff className="w-9 h-9 text-white" />
                        ) : (
                            <Mic className="w-9 h-9 text-white" />
                        )}
                    </button>

                    <p className="text-xs text-gray-500 text-center max-w-xs">
                        Parle, puis appuie à nouveau sur le micro pour envoyer. Autorise l&apos;accès au micro si demandé.
                    </p>
                </div>
            ) : (
                <form onSubmit={handleSend} className="p-4 border-t border-[#EBE6DC] bg-[#FAF8F6] flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Ta réponse en ${langLabel}...`}
                        disabled={loading || sending}
                        className="flex-1 px-4 py-3.5 rounded-2xl bg-white border border-[#EBE6DC] text-gray-900 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8C5EB9] focus:border-transparent disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={loading || sending || !input.trim()}
                        className="px-5 py-3.5 rounded-2xl bg-[#8C5EB9] hover:bg-[#7a4fa8] disabled:opacity-50 text-white transition flex items-center justify-center shadow-sm"
                        title="Envoyer"
                    >
                        {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                    </button>
                </form>
            )}
        </div>
    );
}
