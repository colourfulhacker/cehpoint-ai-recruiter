import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { InterviewConfig, InterviewResult, TranscriptEntry, JOB_DESCRIPTIONS } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audio-utils';
import { Mic, StopCircle, Clock, Activity, AlertCircle, CheckCircle, Play } from 'lucide-react';

interface InterviewScreenProps {
    config: InterviewConfig;
    onComplete: (result: InterviewResult) => void;
}

const API_KEY = process.env.API_KEY || '';

export const InterviewScreen: React.FC<InterviewScreenProps> = ({ config, onComplete }) => {
    // --- UI State ---
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(600); // 10 minutes safety net (not hard limit)
    const [connectionState, setConnectionState] = useState<'idle' | 'initializing' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showContactOverlay, setShowContactOverlay] = useState(false);
    const [showInstructionBanner, setShowInstructionBanner] = useState(true);

    // Audio Visualizer Refs
    const userMeterRefs = useRef<(HTMLDivElement | null)[]>([]);
    const aiMeterRefs = useRef<(HTMLDivElement | null)[]>([]);

    // --- Refs (Mutable State) ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);

    const sessionRef = useRef<any>(null);
    const isIntentionalCloseRef = useRef<boolean>(false);

    // Transcript State
    const transcriptRef = useRef<TranscriptEntry[]>([]);
    const currentInputRef = useRef<string>("");
    const currentAiRef = useRef<string>("");

    // Reconnection Logic
    const retryCountRef = useRef<number>(0);
    const retryTimeoutRef = useRef<any>(null);
    const connectStartTimeRef = useRef<number>(0);

    // Audio Playback
    const nextStartTimeRef = useRef<number>(0);
    // Logic / Monitoring
    const lastUserSpeechTimeRef = useRef<number>(Date.now());
    const isAiSpeakingRef = useRef<boolean>(false);
    const silenceCheckIntervalRef = useRef<any>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const videoChunksRef = useRef<Blob[]>([]);
    const recordedVideoBlobRef = useRef<Blob | null>(null);
    const audioMixerRef = useRef<MediaStreamAudioDestinationNode | null>(null); // For mixing AI audio into recording
    const strikeCountRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    // Interview tracking for smart decision-making
    const questionCountRef = useRef<number>(0);
    const poorAnswerCountRef = useRef<number>(0);
    const strongAnswerCountRef = useRef<number>(0);
    const hasCalledNotifyRef = useRef<boolean>(false); // Prevent multiple notifyResult calls

    // Hide instruction banner after 4 seconds when connected
    useEffect(() => {
        if (connectionState === 'connected' && showInstructionBanner) {
            const timer = setTimeout(() => {
                setShowInstructionBanner(false);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [connectionState, showInstructionBanner]);

    // Save interview state to localStorage for data loss prevention
    const saveToLocalStorage = (data: any) => {
        try {
            localStorage.setItem(`interview_${config.name}_${Date.now()}`, JSON.stringify(data));
        } catch (e) {
            console.warn("Failed to save to localStorage", e);
        }
    };

    // Before page unload, save data
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (transcriptRef.current.length > 0) {
                saveToLocalStorage({ config, transcript: transcriptRef.current, timestamp: new Date().toISOString() });
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // --- Tools Definition ---
    const notifyResultFunc: FunctionDeclaration = {
        name: 'notifyResult',
        description: 'Call this function IMMEDIATELY when you have made a decision. Do not wait for the user to respond. This triggers the result screen.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                passed: { type: Type.BOOLEAN },
                reason: { type: Type.STRING }
            },
            required: ['passed', 'reason'],
        },
    };

    // --- 1. Timer (5 minutes hard limit, then force conclusion) ---
    useEffect(() => {
        let timer: any;
        if (connectionState === 'connected' && timeLeft > 0 && !showContactOverlay) {
            timer = setInterval(() => setTimeLeft((p) => p - 1), 1000);
        } else if (timeLeft === 0 && !showContactOverlay) {
            // 5 minutes up - force conclusion
            if (!hasCalledNotifyRef.current) {
                sessionRef.current?.send({
                    parts: [{ text: "[SYSTEM: 5 minute limit reached. Make final decision NOW. Call notifyResult with your decision.]" }]
                });
            }
        }
        return () => clearInterval(timer);
    }, [connectionState, timeLeft, showContactOverlay]);

    // --- 2. Silence Monitor ---
    useEffect(() => {
        if (connectionState === 'connected') {
            silenceCheckIntervalRef.current = setInterval(() => {
                if (isIntentionalCloseRef.current) return;
                const timeSinceSpeech = Date.now() - lastUserSpeechTimeRef.current;

                // 8 seconds of silence + AI not talking
                if (timeSinceSpeech > 8000 && !isAiSpeakingRef.current) {
                    strikeCountRef.current += 1;
                    lastUserSpeechTimeRef.current = Date.now(); // Reset to give them a chance

                    if (strikeCountRef.current >= 3) {
                        sessionRef.current?.send({ parts: [{ text: "[SYSTEM: Candidate unresponsive 3x. Fail them now. Say 'I am ending this due to lack of response' and call notifyResult(false, 'Unresponsive').]" }] });
                    } else {
                        sessionRef.current?.send({ parts: [{ text: `[SYSTEM: Silence detected (${strikeCountRef.current}/3). Ask: 'Are you still there?']` }] });
                    }
                }
            }, 1000);
        }
        return () => clearInterval(silenceCheckIntervalRef.current);
    }, [connectionState]);

    // --- 3. Lifecycle Cleanup ---
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        isIntentionalCloseRef.current = true;
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        if (silenceCheckIntervalRef.current) clearInterval(silenceCheckIntervalRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        // Stop Video Recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
            } catch (e) {
                console.warn('MediaRecorder stop error:', e);
            }
        }

        // Stop Media Stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        // Stop Audio Nodes
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current.onaudioprocess = null;
            processorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (analyzerRef.current) {
            analyzerRef.current = null;
        }

        // Close Audio Context
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(e => console.warn("Ctx close err", e));
            audioContextRef.current = null;
        }

        // Stop all playing audio
        sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { } });
        sourcesRef.current.clear();

        // Cleanup session ref
        sessionRef.current = null;
    };

    // Tab Switching Detection - Security Feature
    useEffect(() => {
        if (!isSessionActive) return;

        let tabSwitchCount = 0;
        let hasWarned = false;

        const handleVisibilityChange = () => {
            if (document.hidden && isSessionActive) {
                tabSwitchCount++;
                console.warn(`⚠️ [SECURITY] Tab switched during interview. Count: ${tabSwitchCount}/3`);

                if (tabSwitchCount === 2 && !hasWarned) {
                    // Warning on second switch
                    hasWarned = true;
                    console.warn('⚠️ [SECURITY] WARNING: One more tab switch will result in automatic rejection');
                }

                if (tabSwitchCount >= 3) {
                    // Auto-reject on third switch
                    console.error('❌ [SECURITY] Auto-rejecting due to excessive tab switching (possible cheating)');
                    isIntentionalCloseRef.current = true;
                    handleEndSession(false, 'Interview terminated: Suspicious activity detected (multiple tab switches). This suggests use of external resources during the interview.');
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isSessionActive]);

    const startInterview = async () => {
        setIsSessionActive(true);
        await initializeMedia();
    };

    const initializeMedia = async () => {
        try {
            isIntentionalCloseRef.current = false;
            setConnectionState('initializing');
            setErrorMsg(null);

            // 1. Get User Media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    autoGainControl: true,
                    noiseSuppression: true
                }
            });

            if (isIntentionalCloseRef.current) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // 2. Setup Audio Context
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass({
                sampleRate: 16000,
                latencyHint: 'interactive'
            });

            if (ctx.state === 'suspended') {
                await ctx.resume();
            }
            audioContextRef.current = ctx;

            // Create audio mixer for video recording (combines mic + AI audio)
            const audioMixer = ctx.createMediaStreamDestination();
            audioMixerRef.current = audioMixer;

            // Connect microphone to both Gemini (for speech recognition) AND the mixer (for recording)
            const micSource = ctx.createMediaStreamSource(stream);

            // Split the audio: one path to Gemini, one path to mixer for recording
            const micForGemini = ctx.createMediaStreamSource(stream);
            const micForRecording = ctx.createMediaStreamSource(stream);
            micForRecording.connect(audioMixer); // Mic goes into mixer

            console.log('🎙️ Audio mixer created - will capture both mic and AI voice');

            // Start Video Recording with MIXED audio (mic + AI)
            try {
                const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                    ? 'video/webm;codecs=vp9'
                    : MediaRecorder.isTypeSupported('video/webm')
                        ? 'video/webm'
                        : 'video/mp4';

                // Get video track from camera
                const videoTrack = stream.getVideoTracks()[0];

                // Get mixed audio track (mic + AI audio)
                const mixedAudioTrack = audioMixer.stream.getAudioTracks()[0];

                // Create combined stream with video + mixed audio
                const recordingStream = new MediaStream([videoTrack, mixedAudioTrack]);

                const mediaRecorder = new MediaRecorder(recordingStream, {
                    mimeType,
                    videoBitsPerSecond: 2500000,
                });

                videoChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        videoChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    if (videoChunksRef.current.length > 0) {
                        const videoBlob = new Blob(videoChunksRef.current, { type: mimeType });
                        recordedVideoBlobRef.current = videoBlob;
                        console.log('✅ Video recording completed with MIXED audio:', videoBlob.size, 'bytes');
                    }
                };

                mediaRecorder.start(1000);
                mediaRecorderRef.current = mediaRecorder;
                console.log('🎬 Video recording started with mixed audio (mic + AI)');
            } catch (err) {
                console.error('MediaRecorder initialization failed:', err);
            }

            // 3. Setup Audio Analysis & Processing
            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;

            const analyzer = ctx.createAnalyser();
            analyzer.fftSize = 64;
            analyzerRef.current = analyzer;
            source.connect(analyzer);

            // Visualizer Loop
            const dataArray = new Uint8Array(analyzer.frequencyBinCount);
            const updateVisualizers = () => {
                if (isIntentionalCloseRef.current) return;

                // User Volume
                if (analyzerRef.current) {
                    analyzerRef.current.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;

                    // Update User DOM
                    const normalizedVol = Math.min(avg / 100, 1);
                    userMeterRefs.current.forEach((ref, i) => {
                        if (ref) {
                            const height = Math.max(10, normalizedVol * 100 * (1 + Math.sin(Date.now() / 100 + i)));
                            ref.style.height = `${height}%`;
                            ref.style.opacity = normalizedVol > 0.1 ? '1' : '0.3';
                        }
                    });

                    // Detect user speech activity for silence monitoring
                    if (avg > 20) {
                        lastUserSpeechTimeRef.current = Date.now();
                        strikeCountRef.current = 0;
                    }
                }

                // AI Volume
                if (isAiSpeakingRef.current) {
                    aiMeterRefs.current.forEach((ref, i) => {
                        if (ref) {
                            const height = Math.max(10, 50 + 50 * Math.sin(Date.now() / 80 + i));
                            ref.style.height = `${height}%`;
                            ref.style.opacity = '1';
                        }
                    });
                } else {
                    aiMeterRefs.current.forEach((ref) => {
                        if (ref) {
                            ref.style.height = '10%';
                            ref.style.opacity = '0.3';
                        }
                    });
                }

                animationFrameRef.current = requestAnimationFrame(updateVisualizers);
            };
            updateVisualizers();

            // 4. Setup Processor - ULTRA LOW LATENCY
            // 512 buffer = minimum latency (8.3ms processing window at 16kHz)
            // This is the most aggressive setting for real-time response
            const processor = ctx.createScriptProcessor(512, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (isIntentionalCloseRef.current) return;
                // Only process if we have an active session
                if (!sessionRef.current) return;

                const inputData = e.inputBuffer.getChannelData(0);

                // ULTRA-LOW LATENCY: Send ALL audio chunks, don't skip silence
                // This ensures every frame gets to the server IMMEDIATELY
                // The API handles silence filtering server-side
                const pcmBlob = createPcmBlob(inputData);

                try {
                    sessionRef.current.sendRealtimeInput({ media: pcmBlob });
                } catch (err) {
                    // Sockets can close unexpectedly, ignore send errors
                }
            };

            source.connect(processor);
            processor.connect(ctx.destination);

            // 5. Connect to AI
            connectToGemini();

        } catch (err: any) {
            console.error("Media Init Error:", err);
            setConnectionState('error');
            setErrorMsg(`Camera/Mic Access Denied: ${err.message}`);
        }
    };

    const connectToGemini = async () => {
        if (isIntentionalCloseRef.current) return;

        setConnectionState((prev) => prev === 'initializing' ? 'connecting' : 'reconnecting');
        connectStartTimeRef.current = Date.now();

        const ai = new GoogleGenAI({ apiKey: API_KEY });

        const configObj = {
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    console.log("Gemini Connected");
                    setConnectionState('connected');
                    retryCountRef.current = 0;
                    setErrorMsg(null);

                    if (audioContextRef.current?.state === 'suspended') {
                        audioContextRef.current.resume();
                    }

                    // AI will greet automatically based on system prompt instruction
                    console.log("🎯 AI will start speaking based on system prompt");
                },
                onmessage: async (msg: LiveServerMessage) => {
                    handleServerMessage(msg);
                },
                onclose: (e: any) => {
                    console.log("Gemini Closed", e);

                    // Critical Fix: If the connection closes instantly (<1s), it's a configuration error.
                    if (Date.now() - connectStartTimeRef.current < 1000) {
                        setConnectionState('error');
                        setErrorMsg("Connection rejected. Please check API Key or Network.");
                    } else {
                        handleDisconnect();
                    }
                },
                onerror: (e: any) => {
                    console.error("Gemini Error", e);
                    handleDisconnect();
                }
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                systemInstruction: getSystemPrompt(),
                tools: [{ functionDeclarations: [notifyResultFunc] }],
                // Enable Transcription: Use empty objects as per SDK docs
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            }
        };

        try {
            const session = await ai.live.connect(configObj);
            sessionRef.current = session;

            // 🎯 KICKSTART: Send a COMMAND to FORCE the AI to speak immediately
            // This guarantees the conversation starts even if the model is waiting for input
            setTimeout(() => {
                console.log("🚀 Sending kickstart command to AI...");
                if (sessionRef.current) {
                    // Send a direct command that the AI must respond to
                    sessionRef.current.send({
                        parts: [{
                            text: "START SPEAKING NOW. Greet the candidate immediately with your introduction as instructed in the system prompt."
                        }]
                    });
                }
            }, 200);
        } catch (err: any) {
            console.error("Connection Failed:", err);
            handleDisconnect();
        }
    };

    const handleDisconnect = () => {
        if (isIntentionalCloseRef.current) return;

        sessionRef.current = null;

        if (retryCountRef.current < 3) {
            setConnectionState('reconnecting');
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 5000);
            retryCountRef.current++;

            retryTimeoutRef.current = setTimeout(() => {
                connectToGemini();
            }, delay);
        } else {
            setConnectionState('error');
            setErrorMsg("Connection lost. Please reload.");
        }
    };

    const handleServerMessage = async (msg: LiveServerMessage) => {
        if (isIntentionalCloseRef.current) return;

        const serverContent = msg.serverContent;

        // --- Transcript Accumulation ---
        if (serverContent?.inputTranscription?.text) {
            currentInputRef.current += serverContent.inputTranscription.text;
        }
        if (serverContent?.outputTranscription?.text) {
            currentAiRef.current += serverContent.outputTranscription.text;
        }

        // 0. Handle Interruption (CRITICAL FOR LATENCY)
        if (serverContent?.interrupted) {
            console.log("Interruption detected - Clearing audio queue");
            sourcesRef.current.forEach(s => {
                try { s.stop(); } catch (e) { }
            });
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            isAiSpeakingRef.current = false;

            // Commit partial AI transcript if interrupted
            if (currentAiRef.current.trim()) {
                transcriptRef.current.push({
                    speaker: 'ai',
                    text: currentAiRef.current.trim() + " [Interrupted]",
                    timestamp: new Date().toLocaleTimeString()
                });
                currentAiRef.current = "";
            }
            return;
        }

        // 1. Turn Complete -> Commit Transcripts (MINIMAL processing for latency)
        if (serverContent?.turnComplete) {
            if (currentInputRef.current.trim()) {
                transcriptRef.current.push({
                    speaker: 'user',
                    text: currentInputRef.current.trim(),
                    timestamp: new Date().toLocaleTimeString()
                });
                currentInputRef.current = "";
            }
            if (currentAiRef.current.trim()) {
                if (currentAiRef.current.trim().endsWith('?')) {
                    questionCountRef.current++;
                }
                transcriptRef.current.push({
                    speaker: 'ai',
                    text: currentAiRef.current.trim(),
                    timestamp: new Date().toLocaleTimeString()
                });
                currentAiRef.current = "";
            }
        }

        // 2. Audio Output
        const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio && audioContextRef.current) {
            isAiSpeakingRef.current = true;
            try {
                const buffer = await decodeAudioData(base64ToUint8Array(base64Audio), audioContextRef.current);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = buffer;

                // Connect AI audio to BOTH speaker output AND the mixer for recording
                source.connect(audioContextRef.current.destination); // For user to hear
                if (audioMixerRef.current) {
                    source.connect(audioMixerRef.current); // For video recording
                }

                source.onended = () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) isAiSpeakingRef.current = false;
                };

                // Schedule
                const ctxTime = audioContextRef.current.currentTime;
                let start = nextStartTimeRef.current;
                if (start < ctxTime) start = ctxTime;

                source.start(start);
                nextStartTimeRef.current = start + buffer.duration;
                sourcesRef.current.add(source);

            } catch (e) {
                console.error("Audio Decode Error", e);
            }
        }

        // 3. Tool Calls
        if (msg.toolCall?.functionCalls) {
            for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'notifyResult') {
                    const { passed, reason } = fc.args as any;

                    // Prevent multiple notifyResult calls
                    if (hasCalledNotifyRef.current) {
                        console.warn("notifyResult already called, ignoring duplicate");
                        return;
                    }
                    hasCalledNotifyRef.current = true;

                    // Ack
                    sessionRef.current?.sendToolResponse({
                        functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                    });
                    console.log("🔔 notifyResult called:", { passed, reason });
                    handleEndSession(passed, reason);
                }
            }
        }
    };

    const flushTranscriptBuffers = () => {
        if (currentInputRef.current.trim()) {
            transcriptRef.current.push({
                speaker: 'user',
                text: currentInputRef.current.trim(),
                timestamp: new Date().toLocaleTimeString()
            });
            currentInputRef.current = "";
        }
        if (currentAiRef.current.trim()) {
            transcriptRef.current.push({
                speaker: 'ai',
                text: currentAiRef.current.trim(),
                timestamp: new Date().toLocaleTimeString()
            });
            currentAiRef.current = "";
        }
    };

    const handleEndSession = (passed: boolean, reason?: string) => {
        if (showContactOverlay) return; // Already ending

        console.log("📊 Interview Ending - Result:", { passed, reason });
        console.log("🎬 [VIDEO] MediaRecorder state:", mediaRecorderRef.current?.state);
        console.log("🎬 [VIDEO] Current video blob:", recordedVideoBlobRef.current ? `${recordedVideoBlobRef.current.size} bytes` : 'null');

        // Ensure we capture the last things said
        flushTranscriptBuffers();

        // Stop video recording and wait for blob
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.log("🎬 [VIDEO] Stopping MediaRecorder...");
            mediaRecorderRef.current.stop();
            // Give a brief moment for onstop to fire and create the blob
            setTimeout(() => {
                console.log("🎬 [VIDEO] After timeout, video blob:", recordedVideoBlobRef.current ? `${recordedVideoBlobRef.current.size} bytes` : 'null');
                finalizeEndSession(passed, reason);
            }, 500);
        } else {
            console.log("🎬 [VIDEO] MediaRecorder already inactive or null");
            finalizeEndSession(passed, reason);
        }
    };

    const finalizeEndSession = (passed: boolean, reason?: string) => {
        // Save to localStorage for data loss prevention
        saveToLocalStorage({ config, transcript: transcriptRef.current, result: { passed, reason }, timestamp: new Date().toISOString() });

        cleanup();

        // IMMEDIATE result screen appearance - BOTH rejection AND selection now - NO DELAYS
        setShowContactOverlay(true);
        console.log(passed ? "✅ SELECTION" : "❌ REJECTION", "- Result screen NOW");

        const videoBlob = recordedVideoBlobRef.current || undefined;
        console.log("🎬 [VIDEO] Passing to ResultScreen:", videoBlob ? `${videoBlob.size} bytes, type: ${videoBlob.type}` : 'NO VIDEO BLOB');

        // ZERO delay - show result immediately with video blob
        onComplete({
            passed,
            notes: reason,
            transcript: transcriptRef.current,
            videoBlob: videoBlob
        });
    };

    // Language-specific professional greetings
    const getLanguageGreeting = (language: string): string => {
        const greetings: Record<string, string> = {
            'English': "Hi, I'm Sarah, Senior Recruiter at C-E-H point. Thank you for taking the time. Are you ready to start your technical assessment? We'll keep it conversational.",
            'Hindi': "नमस्ते, मैं Sarah हूँ, C-E-H point में Senior Recruiter। आपका समय देने के लिए धन्यवाद। क्या आप अपने टेक्निकल असेसमेंट शुरू करने के लिए तैयार हैं? हम इसे बातचीत जैसा रखेंगे।",
            'Bengali': "হ্যালো, আমি Sarah, C-E-H point এর Senior Recruiter। আপনার সময় দেওয়ার জন্য ধন্যবাদ। আপনি কি আপনার প্রযুক্তিগত মূল্যায়ন শুরু করতে প্রস্তুত? আমরা এটি কথোপকথনের মতো রাখব。"
        };
        return greetings[language] || greetings['English'];
    };

    const getSystemPrompt = () => `
    Identity: You are Sarah, a Senior Tech Recruiter with 10+ years of hiring experience at C-E-H point.
    Candidate: ${config.name}
    Position: ${config.role}
    Language: ${config.language} (SPEAK ONLY IN THIS LANGUAGE)
    
    ===== CRITICAL: START SPEAKING IMMEDIATELY =====
    🎯 FIRST ACTION: When this session starts, YOU MUST IMMEDIATELY greet the candidate with your introduction.
    DO NOT WAIT for the candidate to speak first. YOU speak first to start the conversation.
    Your opening line should be: "${getLanguageGreeting(config.language)}"
    After greeting, wait for their response, then begin asking questions.
    
    ${JOB_DESCRIPTIONS[config.role]}

    ===== CRITICAL EXECUTION RULES (MUST FOLLOW STRICTLY) =====
    
    1. **IMMEDIATE FEEDBACK AFTER EVERY ANSWER (MANDATORY):**
       After the candidate answers EACH question, you MUST immediately provide SHORT, DIRECT feedback:
       
       ✅ If answer is CORRECT/STRONG:
          - "Excellent! That's exactly what I wanted to hear."
          - "Great answer! You clearly have hands-on experience."
          - "Perfect. That shows strong understanding."
       
       ❌ If answer is INCORRECT/WEAK/VAGUE:
          - "That's not quite right. I was looking for [specific concept]."
          - "You're dodging the question. I need a specific example."
          - "That sounds like a textbook definition. Tell me about a REAL project."
          - "Incorrect. The right approach would be [brief explanation]."
       
       ⚠️ IMPORTANT: Do not tolerate bad answers. If they are vague, call them out. Be a REAL HR.

    2. **THREE CONSECUTIVE CORRECT ANSWERS = IMMEDIATE SHORTLIST (HARD RULE):**
       - Answer 1: CORRECT → Positive feedback, next question
       - Answer 2: CORRECT → Positive feedback, next question  
       - Answer 3: CORRECT → Positive feedback, then IMMEDIATELY say:
         "Fantastic! You've demonstrated excellent knowledge. You are SHORTLISTED for the next round."
         Then IMMEDIATELY call: \`notifyResult(true, "Shortlisted - 3 consecutive strong answers")\`
       
       ⚠️ STOP asking questions if they hit 3 in a row. Shortlist immediately.

    3. **ADAPTIVE INTERVIEWING (THE "2 GOOD, 1 WEAK" SCENARIO):**
       If a candidate answers Q1 and Q2 well, but struggles/is vague on Q3:
       - DO NOT reject them yet.
       - DO NOT continue with standard technical questions.
       - SWITCH to: "Okay, let's shift gears. How do you see yourself contributing to our company in this role?"
       - Listen to their answer. If it's good but brief, ask for CLARIFICATION: "Could you elaborate on that?"
       - Based on this final interaction, make your decision.

    4. **FINAL DECISION LOGIC:**
       After 5-6 questions (or if 3 consecutive correct), make IMMEDIATE decision.
       
       SHORTLIST if:
       - 3 consecutive correct answers (auto-shortlist)
       - Mixed start but strong finish (especially on the "contribution" question)
       - Shows real hands-on experience
       
       REJECT if:
       - First 2 answers are both poor
       - Consistently vague or textbook answers
       - Cannot provide specific examples when probed
       
       **TIMING IS CRITICAL:**
       When you decide, say the decision sentence and CALL THE TOOL IN THE SAME TURN.
       "Thank you, you are selected." -> call notifyResult(true, ...)
       "Thank you, unfortunately not selected." -> call notifyResult(false, ...)
       DO NOT WAIT for them to say "Okay" or "Thanks". End it.

    ===== QUESTION STRATEGY (Professional HR) =====
    - Ask REAL-WORLD questions ("Tell me about a bug you fixed"), not definitions ("What is React?").
    - If they give a generic answer, PROBE: "Which specific tool did you use? Why?"
    - If they answer "I don't know", move to a simpler question or ask about their projects.
    
    ===== ANSWER QUALITY JUDGMENT =====
    
    STRONG ✓ (Count as CORRECT):
    - Specific project names, technologies, timelines
    - Quantified results ("improved by 40%", "served 100k users")
    - Real problem-solving stories ("tried X, failed, then did Y")
    - Explains WHY they made decisions, not just WHAT
    - Natural, conversational tone
    
    WEAK ✗ (Count as INCORRECT):
    - "I don't know", "not sure", "I guess"
    - Only textbook definitions, no real examples
    - Vague answers ("I used React" without project context)
    - Obviously wrong technical facts
    - Too perfect/rehearsed (likely copied)
    
    ACCEPTABLE ○ (Use judgment - may count as correct if they elaborate):
    - Correct but generic
    - Mentions tools but lacks project details
    - Surface-level understanding
    - Ask follow-up: "Can you give me a specific example?"

    ===== CONVERSATION STYLE (World-Class Professional HR) =====
    - Keep questions SHORT (max 2 sentences)
    - Be warm but direct: "I appreciate that, but I need specifics."
    - Ask follow-ups naturally: "Tell me more", "What happened next?"
    - Challenge gently: "That sounds good. Can you give me a real example?"
    - NO JARGON: Speak like a person, not a robot
    - Be encouraging: "Good start. Now tell me about..."

    ===== WHAT YOU MUST DO =====
    ✓ Give immediate feedback after EVERY answer
    ✓ Track consecutive correct answers (shortlist at 3)
    ✓ Ask for specific examples and real projects
    ✓ Probe deeper on weak answers
    ✓ Make decisions FAST based on evidence
    ✓ Call notifyResult IMMEDIATELY when decision is made

    ===== WHAT YOU MUST NEVER DO =====
    ✗ Skip feedback after an answer
    ✗ Ask more than 3 questions if they got 3 correct in a row
    ✗ Ask textbook definition questions
    ✗ Let vague answers pass without probing
    ✗ Continue past 6 questions
    ✗ Delay the final decision

    ===== YOUR DECISION MOMENT =====
    When you decide (after 3 correct in a row, or after 5-6 questions):
    
    If SHORTLISTING:
    "Excellent work! I can see you have strong hands-on experience. I'm happy to inform you that you're SHORTLISTED for the next round. Congratulations!"
    Then call: notifyResult(true, "Shortlisted - [specific reason]")
    
    If REJECTING:
    "Thank you for your time. Based on this assessment, we need someone with more hands-on depth in [specific area]. Not selected this time."
    Then call: notifyResult(false, "[specific reason]")

    NO HEDGING. NO DELAYS. IMMEDIATE CLARITY.

    Remember: You're checking if this person can DO THE JOB. Ask what matters. Give feedback. Decide fast. Be fair.
  `.trim();

    // --- Render ---

    if (!isSessionActive) {
        return (
            <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-50">
                <div className="max-w-md w-full glass-panel rounded-3xl p-8 border border-indigo-500/30 shadow-[0_0_50px_rgba(79,70,229,0.2)] animate-fade-in-up">
                    <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/50">
                        <Mic className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Ready for Interview?</h2>
                    <p className="text-slate-400 mb-8">
                        We will access your microphone and camera. Please ensure you are in a quiet environment.
                    </p>
                    <button
                        onClick={startInterview}
                        className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 group"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        Start Interview
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-4 overflow-hidden font-sans">
            <div className="w-full h-full max-w-[1440px] max-h-[900px] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl relative border border-slate-800 group">

                {/* Video Layer */}
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover transition-opacity duration-1000 ${connectionState === 'connected' ? 'opacity-100' : 'opacity-50 blur-sm'}`}
                />

                {/* Status Overlay */}
                {connectionState !== 'connected' && !showContactOverlay && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        {connectionState === 'error' ? (
                            <div className="bg-slate-900 border border-red-500 p-8 rounded-2xl max-w-md text-center shadow-2xl animate-in zoom-in">
                                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">Connection Error</h3>
                                <p className="text-slate-400 mb-6">{errorMsg || "Unknown error occurred."}</p>
                                <button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-bold w-full transition-all">
                                    Reload Platform
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                                <h3 className="text-2xl font-bold text-white tracking-widest animate-pulse">
                                    {connectionState === 'initializing' ? 'ACCESSING HARDWARE...' : 'ESTABLISHING SECURE LINE...'}
                                </h3>
                                {connectionState === 'reconnecting' && (
                                    <p className="text-amber-400 mt-2 font-mono text-sm">Attempting to reconnect ({retryCountRef.current})...</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* HUD Layer */}
                <div className={`absolute inset-0 z-20 pointer-events-none flex flex-col justify-between transition-opacity duration-500 ${connectionState === 'connected' ? 'opacity-100' : 'opacity-0'}`}>

                    {/* Top Bar */}
                    <div className="p-6 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
                        <div className="pointer-events-auto">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center gap-2 bg-red-950/80 border border-red-500/50 px-3 py-1 rounded text-red-500 text-xs font-bold tracking-widest animate-pulse">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div> REC
                                </div>
                                <div className="bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1 rounded text-slate-300 text-xs font-mono">
                                    {config.role.toUpperCase()}
                                </div>
                            </div>
                            <h2 className="text-white font-bold text-xl drop-shadow-md">{config.name}</h2>
                        </div>

                        <div className={`flex items-center gap-3 px-5 py-2 rounded-xl backdrop-blur-md border shadow-lg ${timeLeft < 60 ? 'bg-red-900/40 border-red-500 text-red-200' : 'bg-slate-900/60 border-white/10 text-white'}`}>
                            <Clock className="w-4 h-4" />
                            <span className="font-mono text-xl font-bold">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                        </div>
                    </div>

                    {/* Center Instruction Banner */}
                    <div className="flex-1 flex items-center justify-center">
                        {showInstructionBanner && (
                            <div className="bg-gradient-to-r from-indigo-600/90 to-blue-600/90 backdrop-blur-md border-2 border-white/30 px-8 py-6 rounded-2xl shadow-2xl animate-pulse pointer-events-none transition-opacity duration-500">
                                <div className="flex items-center gap-4">
                                    <Mic className="w-8 h-8 text-white animate-bounce" />
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-1">👋 Say "Hello" to begin your interview</h3>
                                        <p className="text-white/90 text-sm">The AI interviewer is listening and will respond to you</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Controls */}
                    <div className="h-24 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between px-8 pointer-events-auto">

                        {/* AI Status */}
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors ${isAiSpeakingRef.current ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-800 border-slate-700'}`}>
                                <Activity className={`w-6 h-6 ${isAiSpeakingRef.current ? 'text-white' : 'text-indigo-400'}`} />
                            </div>
                            <div>
                                <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">Interviewer</p>
                                <div className="flex gap-1 h-8 items-end justify-start">
                                    {[0, 1, 2, 3, 4].map(i => (
                                        <div
                                            key={i}
                                            ref={el => aiMeterRefs.current[i] = el}
                                            className="w-1.5 bg-indigo-500 rounded-t-sm transition-all duration-75 bar-placeholder"
                                            style={{ height: '10%' }}
                                        ></div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* End Button */}
                        <button onClick={() => handleEndSession(false, "User terminated")} className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/50 px-6 py-2 rounded-full flex items-center gap-2 transition-all font-medium text-sm group">
                            <StopCircle className="w-4 h-4 group-hover:scale-110" /> End Interview
                        </button>

                        {/* Mic Status */}
                        <div className="flex items-center gap-4 text-right">
                            <div>
                                <p className="text-emerald-200 text-xs font-bold uppercase tracking-wider mb-1">Microphone</p>
                                <div className="flex gap-1 h-8 items-end justify-end">
                                    {[0, 1, 2, 3, 4].map(i => (
                                        <div
                                            key={i}
                                            ref={el => userMeterRefs.current[i] = el}
                                            className="w-1.5 bg-emerald-500 rounded-t-sm transition-all duration-75 bar-placeholder"
                                            style={{ height: '10%' }}
                                        ></div>
                                    ))}
                                </div>
                            </div>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center border bg-slate-800 border-slate-700 shadow-lg">
                                <Mic className="w-6 h-6 text-emerald-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Success Overlay */}
                {showContactOverlay && (
                    <div className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-700">
                        <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-bounce-slow">
                            <CheckCircle className="w-12 h-12 text-emerald-500" />
                        </div>
                        <h2 className="text-4xl font-bold text-white mb-2">Shortlisted!</h2>
                        <p className="text-slate-400 text-lg mb-8 max-w-md">You have successfully cleared the screening round. We are redirecting you to your performance report.</p>
                        <div className="w-full max-w-xs h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 animate-[width_8s_linear_forwards] w-0"></div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};