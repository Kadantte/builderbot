import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'

/**
 * Configuration arguments for the LiveKit + OpenAI voice provider.
 * Extends the common GlobalVendorArgs (name, port, writeMyself).
 */
export interface IVoiceProviderArgs extends GlobalVendorArgs {
    /** LiveKit API key. */
    apiKey: string
    /** LiveKit API secret. */
    apiSecret: string
    /** LiveKit server websocket URL, e.g. wss://my-project.livekit.cloud */
    wsUrl: string
    /** Room the bot joins and listens on. */
    roomName: string
    /** Identity the bot uses inside the room. Default 'builderbot'. */
    identity?: string
    /** OpenAI API key used for Whisper (STT) and TTS. */
    openaiApiKey: string
    /** Whisper model for transcription. Default 'whisper-1'. */
    sttModel?: string
    /** OpenAI TTS model. Default 'gpt-4o-mini-tts'. */
    ttsModel?: string
    /** OpenAI TTS voice. Default 'alloy'. */
    ttsVoice?: string
    /** Language hint (ISO-639-1) for Whisper, e.g. 'es'. */
    language?: string
    /** Milliseconds of silence that close an utterance. Default 800. */
    silenceMs?: number
    /** RMS amplitude (0..1) below which a frame counts as silence. Default 0.015. */
    silenceThreshold?: number
}

/**
 * Normalized payload emitted by the core vendor for an incoming utterance,
 * compatible with BuilderBot's BotContext.
 */
export interface VoicePayload {
    body: string
    from: string
    name: string
    /** Raw PCM (16-bit LE mono) of the captured utterance. */
    audio?: Buffer
    /** Sample rate of the captured audio. */
    sampleRate?: number
}
