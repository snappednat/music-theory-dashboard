/**
 * Voice Leading Score Module
 * Evaluates smoothness of voicing transitions for guitar chord changes.
 */

import { normalizePitch } from './notes.js';

/**
 * Score the voice-leading quality between two guitar voicings.
 * Higher score = smoother transition (fewer finger movements, more common tones).
 *
 * @param {number[]} fretsA  - 6-element fret array for chord A (-1 = muted)
 * @param {number[]} fretsB  - 6-element fret array for chord B (-1 = muted)
 * @param {number[]} tuning  - 6-element pitch class array for open strings
 * @returns {{ score: number, commonTones: number, totalMovement: number, label: string }}
 */
export function scoreVoiceLeading(fretsA, fretsB, tuning) {
  if (!fretsA || !fretsB || !tuning) return { score: 0, commonTones: 0, totalMovement: 0, label: '—' };

  // Convert frets to absolute pitches (MIDI-style, not just pitch class)
  const pitchesA = [];
  const pitchesB = [];
  for (let s = 0; s < 6; s++) {
    pitchesA.push(fretsA[s] >= 0 ? tuning[s] + fretsA[s] : null);
    pitchesB.push(fretsB[s] >= 0 ? tuning[s] + fretsB[s] : null);
  }

  let commonTones = 0;
  let totalMovement = 0;
  let voiceCount = 0;

  for (let s = 0; s < 6; s++) {
    const pA = pitchesA[s];
    const pB = pitchesB[s];

    // Both muted — no contribution
    if (pA === null && pB === null) continue;

    // One muted, one not — counts as a "jump"
    if (pA === null || pB === null) {
      totalMovement += 3; // penalty for string going muted/unmuted
      voiceCount++;
      continue;
    }

    voiceCount++;
    const movement = Math.abs(pB - pA);

    if (movement === 0) {
      // Exact same note on same string — common tone
      commonTones++;
    } else if (normalizePitch(pA) === normalizePitch(pB)) {
      // Same pitch class, different octave — partial common tone
      commonTones += 0.5;
      totalMovement += movement;
    } else {
      totalMovement += movement;
    }
  }

  if (voiceCount === 0) return { score: 50, commonTones: 0, totalMovement: 0, label: '—' };

  // Score calculation:
  // Base: 100 minus movement penalty
  // Common tones bonus: +10 per common tone
  // Average movement penalty: -5 per semitone of average movement
  const avgMovement = totalMovement / voiceCount;
  let score = 100 - (avgMovement * 8) + (commonTones * 12);

  // Clamp 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Label
  let label;
  if (score >= 80) label = 'Smooth';
  else if (score >= 55) label = 'Easy';
  else if (score >= 35) label = 'Moderate';
  else label = 'Jump';

  return { score, commonTones, totalMovement, label };
}

/**
 * Get a color for a voice-leading score.
 * @param {number} score 0-100
 * @returns {string} CSS color
 */
export function vlScoreColor(score) {
  if (score >= 80) return '#27ae60'; // green
  if (score >= 55) return '#f39c12'; // gold
  if (score >= 35) return '#e67e22'; // orange
  return '#e74c3c'; // red
}
