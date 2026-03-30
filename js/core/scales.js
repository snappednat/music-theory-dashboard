import { pitchToNoteInKey, normalizePitch, CHROMATIC_SHARP } from './notes.js';
import { intervalName } from './intervals.js';
import { buildChord } from './chords.js';

// Scale formulas: semitone offsets from root (0-indexed)
export const SCALE_FORMULAS = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  natural_minor:    [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor:   [0, 2, 3, 5, 7, 8, 11],
  melodic_minor:    [0, 2, 3, 5, 7, 9, 11],  // ascending form
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues:            [0, 3, 5, 6, 7, 10],
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  phrygian:         [0, 1, 3, 5, 7, 8, 10],
  lydian:           [0, 2, 4, 6, 7, 9, 11],
  mixolydian:       [0, 2, 4, 5, 7, 9, 10],
  locrian:          [0, 1, 3, 5, 6, 8, 10],
};

export const SCALE_DISPLAY_NAMES = {
  major:            'Major',
  natural_minor:    'Natural Minor',
  harmonic_minor:   'Harmonic Minor',
  melodic_minor:    'Melodic Minor',
  pentatonic_major: 'Major Pentatonic',
  pentatonic_minor: 'Minor Pentatonic',
  blues:            'Blues',
  dorian:           'Dorian',
  phrygian:         'Phrygian',
  lydian:           'Lydian',
  mixolydian:       'Mixolydian',
  locrian:          'Locrian',
};

// Ordered groups for UI
export const SCALE_GROUPS = [
  { label: 'Diatonic', types: ['major', 'natural_minor', 'harmonic_minor', 'melodic_minor'] },
  { label: 'Pentatonic / Blues', types: ['pentatonic_major', 'pentatonic_minor', 'blues'] },
  { label: 'Modes', types: ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] },
];

/**
 * Generate pitch classes for a scale
 * @param {number} rootPitch - 0-11
 * @param {string} scaleType - key of SCALE_FORMULAS
 * @returns {number[]} array of pitch classes
 */
export function generateScale(rootPitch, scaleType) {
  const formula = SCALE_FORMULAS[scaleType];
  if (!formula) throw new Error(`Unknown scale: ${scaleType}`);
  return formula.map(offset => normalizePitch(rootPitch + offset));
}

/**
 * Get note names for a scale
 */
export function getScaleNotes(rootPitch, scaleType) {
  return generateScale(rootPitch, scaleType).map(p => pitchToNoteInKey(p, rootPitch));
}

/**
 * Get interval names for each degree of a scale
 */
export function getScaleIntervals(scaleType) {
  const formula = SCALE_FORMULAS[scaleType];
  if (!formula) return [];
  return formula.map(offset => intervalName(offset));
}

/**
 * Check if a pitch is in a scale
 */
export function isInScale(pitch, scalePitches) {
  return scalePitches.includes(normalizePitch(pitch));
}

/**
 * Get 1-based degree of a pitch in a scale; null if not present
 */
export function getScaleDegree(pitch, scalePitches) {
  const idx = scalePitches.indexOf(normalizePitch(pitch));
  return idx === -1 ? null : idx + 1;
}

// ─── Scale Suggestions ─────────────────────────────────

const _SCALE_SUGGESTIONS = {
  major: [
    { type: 'major',            reason: 'Full 7-note diatonic scale for this key' },
    { type: 'pentatonic_major', reason: '5 notes — no avoid notes, easy to improvise with' },
    { type: 'blues',            reason: 'Adds a ♭3 blue note for expressive phrasing' },
    { type: 'mixolydian',       reason: 'Major with ♭7 — great over dominant 7th chords' },
  ],
  minor: [
    { type: 'natural_minor',    reason: 'Full diatonic minor scale' },
    { type: 'pentatonic_minor', reason: '5 notes — backbone of rock and blues' },
    { type: 'blues',            reason: 'Adds ♭5 blue note — essential for blues phrasing' },
    { type: 'harmonic_minor',   reason: 'Raises 7th — creates stronger V → i cadence' },
    { type: 'dorian',           reason: 'Natural 6th gives a brighter, jazzier minor sound' },
  ],
};

/**
 * Return ordered list of scale types most relevant to a key quality.
 * @param {string} keyQuality - 'major' | 'minor'
 * @returns {{ type: string, reason: string }[]}
 */
export function getScaleSuggestions(keyQuality) {
  return _SCALE_SUGGESTIONS[keyQuality] ?? _SCALE_SUGGESTIONS.major;
}

/**
 * Rate how well a scale fits a chord progression.
 * @param {string}   scaleType   - key of SCALE_FORMULAS
 * @param {number}   rootPitch   - 0-11
 * @param {object[]} progression - array of chord objects with .root, .quality, .name
 * @returns {{ rating: 'green'|'yellow'|'red', chordFits: {name, fits: 'full'|'partial'|'clash'}[] }}
 */
export function rateScaleForProgression(scaleType, rootPitch, progression) {
  const scalePitches = new Set(generateScale(rootPitch, scaleType));
  const chordFits = [];

  for (const chord of progression) {
    const chordPitches = buildChord(chord.root, chord.quality);
    const missing = chordPitches.filter(p => !scalePitches.has(p)).length;
    const fits = missing === 0 ? 'full' : missing <= 1 ? 'partial' : 'clash';
    chordFits.push({ name: chord.name ?? CHROMATIC_SHARP[chord.root], fits });
  }

  const goodCount = chordFits.filter(c => c.fits === 'full' || c.fits === 'partial').length;
  const ratio = progression.length > 0 ? goodCount / progression.length : 1;
  const fullCount = chordFits.filter(c => c.fits === 'full').length;
  const allFull = fullCount === progression.length;

  const rating = allFull ? 'green' : ratio >= 0.7 ? 'yellow' : 'red';
  return { rating, chordFits };
}

/**
 * Chord-to-scale relationships (jazz/modal theory).
 * Maps chord quality to recommended scale types for improvisation.
 */
export const CHORD_SCALE_MAP = {
  'maj':      [{ type: 'major',      label: 'Ionian (Major)' }, { type: 'lydian', label: 'Lydian (bright)' }],
  'maj7':     [{ type: 'major',      label: 'Ionian' }, { type: 'lydian',  label: 'Lydian' }],
  'maj9':     [{ type: 'major',      label: 'Ionian' }, { type: 'lydian',  label: 'Lydian' }],
  'maj13':    [{ type: 'major',      label: 'Ionian' }, { type: 'lydian',  label: 'Lydian' }],
  'maj6':     [{ type: 'major',      label: 'Ionian' }],
  'maj6add9': [{ type: 'major',      label: 'Ionian' }],
  'maj7s11':  [{ type: 'lydian',     label: 'Lydian' }],
  'add9':     [{ type: 'major',      label: 'Ionian' }],
  'min':      [{ type: 'dorian',     label: 'Dorian' }, { type: 'natural_minor', label: 'Aeolian (Natural Minor)' }],
  'min7':     [{ type: 'dorian',     label: 'Dorian' }, { type: 'natural_minor', label: 'Aeolian' }],
  'min9':     [{ type: 'dorian',     label: 'Dorian' }],
  'min11':    [{ type: 'dorian',     label: 'Dorian' }],
  'minmaj7':  [{ type: 'melodic_minor', label: 'Melodic Minor' }],
  'minmaj9':  [{ type: 'melodic_minor', label: 'Melodic Minor' }],
  'dom7':     [{ type: 'mixolydian', label: 'Mixolydian' }],
  'dom9':     [{ type: 'mixolydian', label: 'Mixolydian' }],
  'dom13':    [{ type: 'mixolydian', label: 'Mixolydian' }],
  'dom7sus4': [{ type: 'mixolydian', label: 'Mixolydian' }],
  'dom7b9':   [{ type: 'phrygian',   label: 'Phrygian Dominant' }],
  'dom7s9':   [{ type: 'blues',      label: 'Blues Scale' }],
  'dom7b5':   [{ type: 'lydian',     label: 'Lydian Dominant' }],
  'dom7s11':  [{ type: 'lydian',     label: 'Lydian Dominant' }],
  'dom7b13':  [{ type: 'mixolydian', label: 'Mixolydian \u266d6' }],
  'dim':      [{ type: 'locrian',    label: 'Locrian' }],
  'dim7':     [{ type: 'locrian',    label: 'Locrian' }],
  'hdim7':    [{ type: 'locrian',    label: 'Locrian' }],
  'aug':      [{ type: 'lydian',     label: 'Lydian Augmented' }],
  'augmaj7':  [{ type: 'lydian',     label: 'Lydian Augmented' }],
  'sus2':     [{ type: 'mixolydian', label: 'Mixolydian' }, { type: 'major', label: 'Ionian' }],
  'sus4':     [{ type: 'mixolydian', label: 'Mixolydian' }, { type: 'major', label: 'Ionian' }],
  'pow5':     [{ type: 'pentatonic_minor', label: 'Minor Pentatonic' }, { type: 'blues', label: 'Blues' }],
};

/**
 * Get recommended scales for a given chord.
 * @param {number} chordRoot    - pitch class 0-11
 * @param {string} chordQuality - chord quality key
 * @returns {{ type: string, label: string, rootPitch: number }[]}
 */
export function getChordScales(chordRoot, chordQuality) {
  const mapping = CHORD_SCALE_MAP[chordQuality];
  if (!mapping) {
    // Fallback: major scale for major-ish chords, minor for minor-ish
    return [{ type: 'major', label: 'Major Scale', rootPitch: chordRoot }];
  }
  return mapping.map(m => ({ ...m, rootPitch: chordRoot }));
}

/**
 * Compute playable scale positions (box shapes) for a given scale.
 * Returns scale box positions covering the 24-fret neck.
 * Pentatonic/blues: 3-fret windows, up to 5 positions.
 * Diatonic/modal:   4-fret windows, up to 7 positions.
 * @param {number} rootPitch
 * @param {string} scaleType
 * @param {number[]} tuning - pitch class per string (index 0 = low E)
 * @returns {{ name: string, startFret: number, endFret: number, notes: {string, fret, pitch, isRoot}[] }[]}
 */
export function getScalePositions(rootPitch, scaleType, tuning, minFret = 0) {
  const scalePitches = generateScale(rootPitch, scaleType);

  const isPentatonicLike = ['pentatonic_major', 'pentatonic_minor', 'blues'].includes(scaleType);
  const WINDOW      = isPentatonicLike ? 3 : 4;
  const MAX_POS     = isPentatonicLike ? 5 : 7;
  // Offset all start positions by minFret (capo fret) so positions begin at or above the capo
  const START_FRETS = (isPentatonicLike
    ? [0, 3, 5, 7, 10, 12, 15, 17, 19, 22]
    : [0, 4, 7, 9, 12, 16, 19]).map(f => f + minFret);

  function _posName(start, end) {
    if (start === 0)  return 'Open Position';
    if (start === 12) return '12th Position';
    return `${start}th\u2013${end}th Fret`;
  }

  const positions = [];
  for (const start of START_FRETS) {
    if (positions.length >= MAX_POS) break;
    const end   = start + WINDOW;
    const notes = [];
    for (let s = 0; s < 6; s++) {
      for (let f = start; f <= end; f++) {
        const pitch = normalizePitch(tuning[s] + f);
        if (scalePitches.includes(pitch)) {
          notes.push({ string: s, fret: f, pitch, isRoot: pitch === rootPitch });
        }
      }
    }
    if (notes.length >= 4) {
      positions.push({ name: _posName(start, end), startFret: start, endFret: end, notes });
    }
  }
  return positions;
}
