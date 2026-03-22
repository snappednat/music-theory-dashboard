// Chromatic scale spellings
export const CHROMATIC_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHROMATIC_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map note name -> pitch class (0-11)
export const NOTE_TO_PITCH = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
};

// Keys that prefer sharp spelling (by root pitch class)
// C G D A E B F# = pitch classes 0 7 2 9 4 11 6
const SHARP_KEYS = new Set([0, 7, 2, 9, 4, 11, 6]);

/**
 * Convert pitch class to note name using sharp or flat spelling
 */
export function pitchToNote(pitch, preferFlats = false) {
  pitch = ((pitch % 12) + 12) % 12;
  return preferFlats ? CHROMATIC_FLAT[pitch] : CHROMATIC_SHARP[pitch];
}

/**
 * Convert pitch class to note name using the spelling appropriate for a given key
 */
export function pitchToNoteInKey(pitch, keyRoot) {
  pitch = ((pitch % 12) + 12) % 12;
  const root = ((keyRoot % 12) + 12) % 12;
  const preferFlats = !SHARP_KEYS.has(root);
  return preferFlats ? CHROMATIC_FLAT[pitch] : CHROMATIC_SHARP[pitch];
}

/**
 * Convert note name to pitch class; returns null if unrecognized
 */
export function noteToPitch(name) {
  return NOTE_TO_PITCH[name] ?? null;
}

/**
 * Normalize pitch class to 0-11
 */
export function normalizePitch(p) {
  return ((p % 12) + 12) % 12;
}

// All valid note names (for selects, etc.)
export const ALL_NOTE_NAMES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

// Cleaner list for UI selectors (one name per pitch, mixed sharp/flat)
export const NOTE_SELECTOR_OPTIONS = [
  { label: 'C',  pitch: 0 },
  { label: 'C#/Db', pitch: 1 },
  { label: 'D',  pitch: 2 },
  { label: 'D#/Eb', pitch: 3 },
  { label: 'E',  pitch: 4 },
  { label: 'F',  pitch: 5 },
  { label: 'F#/Gb', pitch: 6 },
  { label: 'G',  pitch: 7 },
  { label: 'G#/Ab', pitch: 8 },
  { label: 'A',  pitch: 9 },
  { label: 'A#/Bb', pitch: 10 },
  { label: 'B',  pitch: 11 },
];
