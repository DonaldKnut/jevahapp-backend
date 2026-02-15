export interface TTSVoice {
  name: string;
  ssmlGender: "MALE" | "FEMALE" | "NEUTRAL";
  languageCode: string;
}

export interface TTSOptions {
  voice?: "male" | "female" | "custom";
  voiceName?: string; // For custom voices
  languageCode?: string; // e.g., "en-US", "en-GB"
  speakingRate?: number; // 0.25 to 4.0, default 1.0
  pitch?: number; // -20.0 to 20.0, default 0
  volumeGainDb?: number; // -96.0 to 16.0, default 0
  audioEncoding?: "MP3" | "LINEAR16" | "OGG_OPUS";
}

// Segment-level timing for text sync highlighting
export interface TTSSegment {
  id: string; // Stable ID, e.g., "p1-s1" (page 1, sentence 1)
  kind: "paragraph" | "sentence";
  startMs: number; // Inclusive start time in milliseconds
  endMs: number; // Exclusive end time in milliseconds
  text: string; // Exact segment text used in audio
  page?: number; // Optional: page number if available
  charStart?: number; // Optional: offset in fullText
  charEnd?: number; // Optional: offset in fullText
}

export interface TTSTimings {
  format: "segments.v1";
  segments: TTSSegment[];
}

export type TTSProvider = "google-tts" | "azure-tts";

export interface TTSResult {
  audioBuffer: Buffer;
  audioUrl: string;
  objectKey: string;
  durationMs: number; // Duration in milliseconds
  duration?: number; // Duration in seconds (for backward compatibility)
  textHash: string; // SHA-256 hash of the exact text used for generation
  timings?: TTSTimings; // Segment-level timings for text sync
  ttsConfig: {
    provider: TTSProvider;
    voicePreset?: "male" | "female" | "custom";
    voiceName?: string;
    languageCode: string;
    speed: number;
    pitch: number;
  };
}


