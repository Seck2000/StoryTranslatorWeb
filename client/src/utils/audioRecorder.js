export function isMicrophoneSupported() {
    return (
        typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== 'undefined'
    );
}

export function getPreferredAudioMimeType() {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
    ];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function createAudioRecorder({ onData } = {}) {
    let stream = null;
    let recorder = null;
    let chunks = [];

    async function start() {
        if (!isMicrophoneSupported()) {
            throw new Error('MICROPHONE_UNSUPPORTED');
        }

        await stop();

        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];

        const mimeType = getPreferredAudioMimeType();
        recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);

        recorder.ondataavailable = (event) => {
            if (event.data?.size > 0) {
                chunks.push(event.data);
                onData?.(event.data);
            }
        };

        recorder.start();
        return recorder;
    }

    function stop() {
        return new Promise((resolve) => {
            if (!recorder || recorder.state === 'inactive') {
                cleanupStream();
                resolve(null);
                return;
            }

            recorder.onstop = () => {
                const blob = chunks.length > 0
                    ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
                    : null;
                cleanupStream();
                recorder = null;
                chunks = [];
                resolve(blob);
            };

            try {
                recorder.stop();
            } catch {
                cleanupStream();
                recorder = null;
                chunks = [];
                resolve(null);
            }
        });
    }

    function cleanupStream() {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            stream = null;
        }
    }

    function isRecording() {
        return recorder?.state === 'recording';
    }

    return {
        start,
        stop,
        isRecording,
        cleanup: () => {
            if (recorder?.state === 'recording') {
                try {
                    recorder.stop();
                } catch {
                    // ignore
                }
            }
            cleanupStream();
            recorder = null;
            chunks = [];
        },
    };
}
