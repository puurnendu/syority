/**
 * TranscriptionService — Channel-agnostic audio transcription
 *
 * Extracted from AudioProcessor for reuse across Voice and WhatsApp channels.
 *
 * DOES:
 *   - Accept raw audio buffer
 *   - Validate size/format/duration constraints
 *   - Transcribe via Whisper (OpenAI) with retry/timeout
 *   - Return transcript, confidence, language
 *
 * DOES NOT:
 *   - Download audio from Meta (that's AudioProcessor/MetaClient)
 *   - Establish identity, organization, event, or role
 *   - Perform entity resolution or intent classification
 *   - Access Prisma or domain tables
 */

export interface TranscriptionRequest {
  audioBuffer: Buffer | ArrayBuffer;
  /** MIME type of the audio (e.g. 'audio/ogg', 'audio/webm', 'audio/wav') */
  mimeType: string;
  /** Original filename (for Whisper API) */
  filename?: string;
}

export interface TranscriptionResult {
  transcript: string;
  detectedLanguage: string;
  durationSecs: number;
  /** Model-reported confidence (0-1). null if model does not provide it. */
  confidence: number | null;
}

export interface TranscriptionOptions {
  /** Whisper API key (or key||model format from ProviderLoader) */
  apiKey: string;
  /** Max audio file size in bytes. Default: 10MB */
  maxSizeBytes?: number;
  /** Max audio duration in seconds. Default: 120s */
  maxDurationSecs?: number;
  /** Timeout per attempt in ms. Default: 20000 */
  timeoutMs?: number;
  /** Max retry attempts. Default: 3 */
  maxRetries?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_DURATION = 120; // 2 minutes
const DEFAULT_TIMEOUT = 20_000; // 20s
const DEFAULT_RETRIES = 3;
const ALLOWED_MIME_PREFIXES = ['audio/'];
const WHISPER_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

// ── Validation ────────────────────────────────────────────────────────────────

export class TranscriptionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionValidationError';
  }
}

export class TranscriptionProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionProviderError';
  }
}

function validateAudio(
  buffer: Buffer | ArrayBuffer,
  mimeType: string,
  maxSize: number
): void {
  // 1. Size check
  const size = buffer instanceof ArrayBuffer ? buffer.byteLength : buffer.length;
  if (size === 0) {
    throw new TranscriptionValidationError('Audio file is empty');
  }
  if (size > maxSize) {
    throw new TranscriptionValidationError(
      `Audio file exceeds maximum size (${Math.round(size / 1024 / 1024)}MB > ${Math.round(maxSize / 1024 / 1024)}MB)`
    );
  }

  // 2. MIME type check
  const normalizedMime = mimeType.toLowerCase().trim();
  if (!ALLOWED_MIME_PREFIXES.some(prefix => normalizedMime.startsWith(prefix))) {
    throw new TranscriptionValidationError(
      `Unsupported audio format: ${mimeType}. Expected audio/* MIME type.`
    );
  }
}

// ── Transcription ─────────────────────────────────────────────────────────────

/**
 * Transcribe audio using Whisper API.
 *
 * @throws TranscriptionValidationError for invalid audio
 * @throws TranscriptionProviderError for API failures after retries
 */
export async function transcribe(
  request: TranscriptionRequest,
  options: TranscriptionOptions
): Promise<TranscriptionResult> {
  const maxSize = options.maxSizeBytes ?? DEFAULT_MAX_SIZE;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxRetries = options.maxRetries ?? DEFAULT_RETRIES;
  const maxDuration = options.maxDurationSecs ?? DEFAULT_MAX_DURATION;

  // Validate
  validateAudio(request.audioBuffer, request.mimeType, maxSize);

  // Parse key (supports "key||model" format from ProviderLoader)
  const rawKey = options.apiKey;
  const actualKey = rawKey.includes('||') ? rawKey.split('||')[0] : rawKey;
  const model = rawKey.includes('||') ? rawKey.split('||')[1] : 'gpt-4o-transcribe';

  // Build form data
  const bytes = request.audioBuffer instanceof ArrayBuffer
    ? new Uint8Array(request.audioBuffer)
    : new Uint8Array(request.audioBuffer);

  const filename = request.filename || 'audio.ogg';

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([bytes], { type: request.mimeType }),
    filename
  );
  formData.append('model', model);
  formData.append('response_format', 'verbose_json');

  // Retry loop
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(WHISPER_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${actualKey}` },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Whisper API ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as {
        text: string;
        language: string;
        duration: number;
        segments?: Array<{ no_speech_prob?: number }>;
      };

      // Duration check
      if (data.duration > maxDuration) {
        throw new TranscriptionValidationError(
          `Audio duration exceeds maximum (${Math.round(data.duration)}s > ${maxDuration}s)`
        );
      }

      // Compute average confidence from segments (if available)
      let confidence: number | null = null;
      if (data.segments && data.segments.length > 0) {
        const avgNoSpeech = data.segments.reduce(
          (sum, s) => sum + (s.no_speech_prob ?? 0), 0
        ) / data.segments.length;
        confidence = Math.max(0, Math.min(1, 1 - avgNoSpeech));
      }

      return {
        transcript: data.text || '',
        detectedLanguage: data.language ?? 'en',
        durationSecs: Math.round(data.duration),
        confidence,
      };
    } catch (err: any) {
      lastError = err;
      // Don't retry validation errors
      if (err instanceof TranscriptionValidationError) throw err;

      console.warn(`[TranscriptionService] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  throw new TranscriptionProviderError(
    lastError?.message || 'Transcription failed after all retries'
  );
}
