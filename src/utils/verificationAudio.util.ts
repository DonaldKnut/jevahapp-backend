/**
 * Compute FFmpeg start offsets (seconds) for audio snippets used in pre-upload moderation.
 * Spreads samples across the file so mid-video speech is more likely transcribed.
 */

export function computeDistributedAudioSampleOffsets(
  totalDuration: number,
  sampleDuration: number,
  maxSegments: number
): number[] {
  const d = Math.max(0, totalDuration);
  if (d < 1) {
    return [0];
  }

  const cap = Math.max(1, Math.min(maxSegments, 12));
  const sd = Math.min(sampleDuration, Math.max(15, d));

  const candidates = new Set<number>();
  const add = (raw: number) => {
    const start = Math.max(
      0,
      Math.min(Math.floor(raw), Math.max(0, Math.floor(d - 10)))
    );
    candidates.add(start);
  };

  add(0);
  if (d > sd) {
    add(Math.max(0, d - sd));
  }
  if (d > 120) {
    add(Math.max(0, d / 2 - sd / 2));
  }
  if (d > 240) {
    add(Math.max(0, d * 0.25 - 15));
    add(Math.max(0, d * 0.75 - sd * 0.6));
  }
  if (d > 420) {
    add(Math.max(0, d * 0.125 - 10));
    add(Math.max(0, d * 0.875 - sd * 0.8));
  }
  if (d > 720) {
    add(Math.max(0, d * 0.375 - 20));
    add(Math.max(0, d * 0.625 - 20));
  }

  const sorted = Array.from(candidates).sort((a, b) => a - b);
  const minGap = 28;
  const merged: number[] = [];
  for (const o of sorted) {
    if (merged.length === 0 || o - merged[merged.length - 1] >= minGap) {
      merged.push(o);
    }
  }

  if (merged.length <= cap) {
    return merged;
  }

  const picked: number[] = [];
  for (let i = 0; i < cap; i++) {
    const idx = Math.min(
      merged.length - 1,
      Math.round((i / Math.max(1, cap - 1)) * (merged.length - 1))
    );
    picked.push(merged[idx]);
  }
  return [...new Set(picked)].sort((a, b) => a - b);
}
