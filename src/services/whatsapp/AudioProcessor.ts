/**
 * Downloads voice note from Meta, saves to server,
 * transcribes with Whisper (OpenAI).
 * Returns transcript + detected language.
 */

import { downloadAudioFromMeta } from './MetaClient';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export type AudioResult = {
  storagePath: string;
  transcriptPath: string;
  transcript: string;
  detectedLanguage: string;
  durationSecs: number | null;
  fileSizeBytes: number;
};

export async function processVoiceNote(
  mediaId: string,
  whisperKey: string
): Promise<AudioResult> {
  const audioBuffer = await downloadAudioFromMeta(mediaId);

  const uuid = randomUUID();
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePath = `${y}/${m}/${d}`;
  const audioDir = join(process.cwd(), 'uploads', 'whatsapp', 'audio', datePath);
  await mkdir(audioDir, { recursive: true });

  const audioFilename = `${uuid}.ogg`;
  const audioPath = join(audioDir, audioFilename);
  await writeFile(audioPath, audioBuffer);

  const storagePath = `uploads/whatsapp/audio/${datePath}/${audioFilename}`;

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' }),
    audioFilename
  );
  formData.append('model', whisperKey.includes('||') ? whisperKey.split('||')[1] : 'gpt-4o-transcribe');
  formData.append('response_format', 'verbose_json');

  const actualKey = whisperKey.includes('||') ? whisperKey.split('||')[0] : whisperKey;

  let whisperRes: Response | null = null;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for audio
      
      whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${actualKey}` },
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      if (whisperRes.ok) break;

      const errText = await whisperRes.text();
      throw new Error(`Whisper failed ${whisperRes.status}: ${errText}`);
    } catch (err: any) {
      lastError = err;
      console.warn(`[AudioProcessor] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }

  if (!whisperRes || !whisperRes.ok) {
    throw new Error(lastError?.message || 'Whisper API exhausted retries.');
  }

  const whisperData = (await whisperRes.json()) as {
    text: string;
    language: string;
    duration: number;
  };

  const transcriptPath = join(audioDir, `${uuid}.txt`);
  await writeFile(transcriptPath, whisperData.text, 'utf-8');

  return {
    storagePath,
    transcriptPath: `uploads/whatsapp/audio/${datePath}/${uuid}.txt`,
    transcript: whisperData.text,
    detectedLanguage: whisperData.language ?? 'en',
    durationSecs: Math.round(whisperData.duration),
    fileSizeBytes: audioBuffer.byteLength,
  };
}
