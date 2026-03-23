import { CHROMATIC_SHARP, pitchToNoteInKey, normalizePitch } from './notes.js';

// Chord formulas: semitone intervals from root
export const CHORD_FORMULAS = {
  maj:      [0, 4, 7],
  min:      [0, 3, 7],
  dim:      [0, 3, 6],
  aug:      [0, 4, 8],
  sus2:     [0, 2, 7],
  sus4:     [0, 5, 7],
  dom7sus4: [0, 5, 7, 10],  // dominant 7sus4 — jazz/soul, suspended dominant
  maj7:     [0, 4, 7, 11],
  dom7:     [0, 4, 7, 10],
  min7:     [0, 3, 7, 10],
  dim7:     [0, 3, 6, 9],
  hdim7:    [0, 3, 6, 10],   // half-diminished / min7b5
  minmaj7:  [0, 3, 7, 11],
  maj6:     [0, 4, 7, 9],
  min6:     [0, 3, 7, 9],
  add9:     [0, 4, 7, 2],    // root + M3 + P5 + M2 (9th as 2nd mod 12)
  dom9:     [0, 4, 7, 10, 2],
  pow5:     [0, 7],
  // ── Extended / altered ────────────────────────────────────────────────────
  maj9:     [0, 4, 7, 11, 2],  // major 9th (Imaj9)
  min9:     [0, 3, 7, 10, 2],  // minor 9th (im9)
  maj7s11:  [0, 4, 7, 11, 6],  // major 7♯11 — Lydian major
  dom7b9:   [0, 4, 7, 10, 1],  // dominant 7♭9 — jazz cadence
  dom7s9:   [0, 4, 7, 10, 3],  // dominant 7♯9 — "Hendrix chord"
  dom7b5:   [0, 4, 6, 10],     // dominant 7♭5 — tritone-tinged
  dom7s11:  [0, 4, 7, 10, 6],  // dominant 7♯11 — Lydian dominant
  // ── Jazz extensions (jazzguitar.be dictionary) ────────────────────────────
  maj6add9:   [0, 4, 7, 9, 2],  // 6/9 — major with 6th and 9th, no 7th
  augmaj7:    [0, 4, 8, 11],    // maj7#5 — augmented major 7th
  maj13:      [0, 4, 7, 11, 9], // major 13th
  dom13:      [0, 4, 7, 10, 9], // dominant 13th
  dom9sus4:   [0, 5, 7, 10, 2], // 9sus4 — suspended dominant with 9th
  dom13sus4:  [0, 5, 7, 10, 9], // 13sus4 — suspended dominant with 13th
  min11:      [0, 3, 7, 10, 5], // minor 11th
  minmaj9:    [0, 3, 7, 11, 2], // minor/major 9th
  dom7b13:    [0, 4, 7, 10, 8], // 7b13 — altered dominant with flat 13
  dom7b9sus4: [0, 5, 7, 10, 1], // 7b9sus4 — altered suspended dominant
  // ── All-guitar-chords additions ──────────────────────────────────────────
  maj11:      [0, 4, 7, 11, 2, 5],  // major 11th
  maj9s11:    [0, 4, 7, 11, 2, 6],  // major 9♯11 — Lydian maj9
  maj13s11:   [0, 4, 7, 11, 6, 9],  // major 13♯11
  maj7b5:     [0, 4, 6, 11],        // major 7♭5
  min13:      [0, 3, 7, 10, 9],     // minor 13th
  minadd9:    [0, 3, 7, 2],         // minor add9
  min6add9:   [0, 3, 7, 9, 2],      // minor 6 add9
  minmaj7aug: [0, 3, 8, 10],        // minor 7♯5
  dom11:      [0, 4, 7, 10, 5],     // dominant 11th
  dom7s5:     [0, 4, 8, 10],        // dominant 7♯5 — augmented dominant
  dom7b5b9:   [0, 4, 6, 10, 1],     // dominant 7♭5♭9
  dom7b5s9:   [0, 4, 6, 10, 3],     // dominant 7♭5♯9
  dom7s5b9:   [0, 4, 8, 10, 1],     // dominant 7♯5♭9
  dom7s5s9:   [0, 4, 8, 10, 3],     // dominant 7♯5♯9
  dom9b5:     [0, 4, 6, 10, 2],     // dominant 9♭5
  dom9s5:     [0, 4, 8, 10, 2],     // dominant 9♯5
  dom13s11:   [0, 4, 7, 10, 6, 9],  // dominant 13♯11
  dom13b9:    [0, 4, 7, 10, 1, 9],  // dominant 13♭9
  dom11b9:    [0, 4, 7, 10, 1, 5],  // dominant 11♭9
  sus2sus4:   [0, 2, 5, 7],         // suspended 2 and 4
  majb5:      [0, 4, 6],            // major ♭5 triad
  // ── Extended coverage (sus-7, add4, dim/aug ext, shells, quartal) ─────────
  dom7sus2:   [0, 2, 7, 10],        // 7sus2 — dominant sus with major 2nd
  maj7sus2:   [0, 2, 7, 11],        // maj7sus2
  maj7sus4:   [0, 5, 7, 11],        // maj7sus4
  add4:       [0, 4, 5, 7],         // major add 4th (no 7th)
  minadd4:    [0, 3, 5, 7],         // minor add 4th
  dimmaj7:    [0, 3, 6, 11],        // diminished major 7th
  dim9:       [0, 3, 6, 9, 2],      // diminished 9th (dim7 + M9)
  hdim9:      [0, 3, 6, 10, 2],     // half-dim 9th (m9♭5)
  hdim11:     [0, 3, 6, 10, 5],     // half-dim 11th (m11♭5)
  aug9:       [0, 4, 8, 10, 2],     // augmented 9th (7♯5 + 9)
  augmaj9:    [0, 4, 8, 11, 2],     // augmented major 9th
  augadd9:    [0, 4, 8, 2],         // augmented add9 (no 7th)
  maj6sus2:   [0, 2, 7, 9],         // 6sus2
  maj6sus4:   [0, 5, 7, 9],         // 6sus4
  dom9s11:    [0, 4, 7, 10, 2, 6],  // 9♯11 — Lydian dominant 9th
  dom9b13:    [0, 4, 7, 10, 2, 8],  // 9♭13
  dom9s11b13: [0, 4, 7, 10, 2, 6, 8], // 9♯11♭13
  dom13s9:    [0, 4, 7, 10, 3, 9],     // 13♯9
  dom13s9s11: [0, 4, 7, 10, 3, 6, 9],  // 13♯9♯11
  dom13s9b5:  [0, 4, 6, 10, 3, 9],     // 13♯9♭5
  dom13b9b5:  [0, 4, 6, 10, 1, 9],     // 13♭9♭5
  dom13b9s11: [0, 4, 7, 10, 1, 6, 9],  // 13♭9♯11
  dom7b9s11:  [0, 4, 7, 10, 1, 6],     // 7(♭9,♯11)
  dom7s9s11:  [0, 4, 7, 10, 3, 6],     // 7(♯9,♯11)
  dom7b9b13:  [0, 4, 7, 10, 1, 8],     // 7(♭9,♭13)
  dom7s9b13:  [0, 4, 7, 10, 3, 8],     // 7(♯9,♭13)
  minmaj11:   [0, 3, 7, 11, 2, 5],     // minor/major 11th
  minmaj13:   [0, 3, 7, 11, 9],        // minor/major 13th
  dom7no5:    [0, 4, 10],              // 7(no5) — jazz shell voicing
  maj7no5:    [0, 4, 11],              // maj7(no5)
  min7no5:    [0, 3, 10],              // m7(no5)
  dom9no5:    [0, 4, 10, 2],           // 9(no5)
  maj9no5:    [0, 4, 11, 2],           // maj9(no5)
  min9no5:    [0, 3, 10, 2],           // m9(no5)
  min11no5:   [0, 3, 10, 5],           // m11(no5) — minor 7th shell + 11th (common guitar voicing)
  quartal:    [0, 5, 10],              // quartal triad (stacked perfect 4ths)
  quartal7:   [0, 5, 10, 3],           // quartal 7th (four stacked 4ths)
  quintal:    [0, 7, 2],               // quintal triad (stacked perfect 5ths)
};

// Display suffix for each quality
export const CHORD_SUFFIXES = {
  maj: '', min: 'm', dim: '°', aug: '+',
  sus2: 'sus2', sus4: 'sus4', dom7sus4: '7sus4',
  maj7: 'maj7', dom7: '7', min7: 'm7',
  dim7: '°7', hdim7: 'ø7', minmaj7: 'mMaj7',
  maj6: '6', min6: 'm6',
  add9: 'add9', dom9: '9', pow5: '5',
  maj9: 'maj9', min9: 'm9', maj7s11: 'maj7♯11',
  dom7b9: '7♭9', dom7s9: '7♯9', dom7b5: '7♭5', dom7s11: '7♯11',
  maj6add9: '6/9', augmaj7: 'maj7#5', maj13: 'maj13', dom13: '13',
  dom9sus4: '9sus4', dom13sus4: '13sus4',
  min11: 'm11', minmaj9: 'mMaj9',
  dom7b13: '7b13', dom7b9sus4: '7b9sus4',
  maj11: 'maj11', maj9s11: 'maj9♯11', maj13s11: 'maj13♯11', maj7b5: 'maj7♭5',
  min13: 'm13', minadd9: 'madd9', min6add9: 'm6add9', minmaj7aug: 'm7♯5',
  dom11: '11', dom7s5: '7♯5',
  dom7b5b9: '7(♭5,♭9)', dom7b5s9: '7(♭5,♯9)', dom7s5b9: '7(♯5,♭9)', dom7s5s9: '7(♯5,♯9)',
  dom9b5: '9♭5', dom9s5: '9♯5',
  dom13s11: '13♯11', dom13b9: '13♭9', dom11b9: '11♭9',
  sus2sus4: 'sus2sus4', majb5: '♭5',
  dom7sus2: '7sus2', maj7sus2: 'maj7sus2', maj7sus4: 'maj7sus4',
  add4: 'add4', minadd4: 'madd4',
  dimmaj7: 'dim(maj7)', dim9: 'dim9', hdim9: 'm9♭5', hdim11: 'm11♭5',
  aug9: 'aug9', augmaj9: 'maj9♯5', augadd9: 'augadd9',
  maj6sus2: '6sus2', maj6sus4: '6sus4',
  dom9s11: '9♯11', dom9b13: '9♭13', dom9s11b13: '9♯11♭13',
  dom13s9: '13♯9', dom13s9s11: '13♯9♯11', dom13s9b5: '13♯9♭5',
  dom13b9b5: '13♭9♭5', dom13b9s11: '13♭9♯11',
  dom7b9s11: '7(♭9,♯11)', dom7s9s11: '7(♯9,♯11)',
  dom7b9b13: '7(♭9,♭13)', dom7s9b13: '7(♯9,♭13)',
  minmaj11: 'mMaj11', minmaj13: 'mMaj13',
  dom7no5: '7(no5)', maj7no5: 'maj7(no5)', min7no5: 'm7(no5)',
  dom9no5: '9(no5)', maj9no5: 'maj9(no5)', min9no5: 'm9(no5)',
  min11no5: 'm11(no5)',
  quartal: '(4ths)', quartal7: '(4ths7)', quintal: '(5ths)',
};

// Human-readable quality labels
export const CHORD_QUALITY_LABELS = {
  maj: 'Major', min: 'Minor', dim: 'Diminished', aug: 'Augmented',
  sus2: 'Suspended 2nd', sus4: 'Suspended 4th', dom7sus4: 'Dominant 7sus4',
  maj7: 'Major 7th', dom7: 'Dominant 7th', min7: 'Minor 7th',
  dim7: 'Diminished 7th', hdim7: 'Half-Diminished 7th', minmaj7: 'Minor/Major 7th',
  maj6: 'Major 6th', min6: 'Minor 6th',
  add9: 'Add 9', dom9: 'Dominant 9th', pow5: 'Power Chord',
  maj9: 'Major 9th', min9: 'Minor 9th', maj7s11: 'Major 7♯11',
  dom7b9: 'Dominant 7♭9', dom7s9: 'Dominant 7♯9', dom7b5: 'Dominant 7♭5', dom7s11: 'Dominant 7♯11',
  maj6add9: 'Major 6/9', augmaj7: 'Major 7#5', maj13: 'Major 13th', dom13: 'Dominant 13th',
  dom9sus4: 'Dominant 9sus4', dom13sus4: 'Dominant 13sus4',
  min11: 'Minor 11th', minmaj9: 'Minor/Major 9th',
  dom7b13: 'Dominant 7b13', dom7b9sus4: 'Dominant 7b9sus4',
  maj11: 'Major 11th', maj9s11: 'Major 9♯11', maj13s11: 'Major 13♯11', maj7b5: 'Major 7♭5',
  min13: 'Minor 13th', minadd9: 'Minor Add9', min6add9: 'Minor 6 Add9', minmaj7aug: 'Minor 7♯5',
  dom11: 'Dominant 11th', dom7s5: 'Dominant 7♯5',
  dom7b5b9: 'Dominant 7♭5♭9', dom7b5s9: 'Dominant 7♭5♯9', dom7s5b9: 'Dominant 7♯5♭9', dom7s5s9: 'Dominant 7♯5♯9',
  dom9b5: 'Dominant 9♭5', dom9s5: 'Dominant 9♯5',
  dom13s11: 'Dominant 13♯11', dom13b9: 'Dominant 13♭9', dom11b9: 'Dominant 11♭9',
  sus2sus4: 'Suspended 2&4', majb5: 'Major ♭5',
  dom7sus2: 'Dominant 7sus2', maj7sus2: 'Major 7sus2', maj7sus4: 'Major 7sus4',
  add4: 'Add 4', minadd4: 'Minor Add4',
  dimmaj7: 'Diminished Maj7', dim9: 'Diminished 9th', hdim9: 'Half-Dim 9th', hdim11: 'Half-Dim 11th',
  aug9: 'Augmented 9th', augmaj9: 'Augmented Maj9', augadd9: 'Augmented Add9',
  maj6sus2: 'Major 6sus2', maj6sus4: 'Major 6sus4',
  dom9s11: 'Dominant 9♯11', dom9b13: 'Dominant 9♭13', dom9s11b13: 'Dominant 9♯11♭13',
  dom13s9: 'Dominant 13♯9', dom13s9s11: 'Dominant 13♯9♯11', dom13s9b5: 'Dominant 13♯9♭5',
  dom13b9b5: 'Dominant 13♭9♭5', dom13b9s11: 'Dominant 13♭9♯11',
  dom7b9s11: 'Dominant 7♭9♯11', dom7s9s11: 'Dominant 7♯9♯11',
  dom7b9b13: 'Dominant 7♭9♭13', dom7s9b13: 'Dominant 7♯9♭13',
  minmaj11: 'Minor/Major 11th', minmaj13: 'Minor/Major 13th',
  dom7no5: 'Dominant 7 (no5)', maj7no5: 'Major 7 (no5)', min7no5: 'Minor 7 (no5)',
  dom9no5: 'Dominant 9 (no5)', maj9no5: 'Major 9 (no5)', min9no5: 'Minor 9 (no5)',
  min11no5: 'Minor 11th (no5)',
  quartal: 'Quartal', quartal7: 'Quartal 7th', quintal: 'Quintal',
};

// ─── Difficulty classification ────────────────────────────────────────────────

const _DIFF_RANK = { beginner: 0, intermediate: 1, advanced: 2 };

/** Map chord quality → minimum difficulty level for that sound. */
export const QUALITY_DIFFICULTY = {
  // Beginner — simple, commonly taught first
  maj:'beginner', min:'beginner', sus2:'beginner', sus4:'beginner',
  add9:'beginner', pow5:'beginner', minadd9:'beginner',
  // Intermediate — 7ths, 6ths, 9ths, basic extensions
  dom7:'intermediate', maj7:'intermediate', min7:'intermediate',
  dim:'intermediate',  dim7:'intermediate', hdim7:'intermediate', aug:'intermediate',
  maj6:'intermediate', min6:'intermediate', dom9:'intermediate',
  maj9:'intermediate', min9:'intermediate', minmaj7:'intermediate',
  maj6add9:'intermediate', augmaj7:'intermediate', dom7sus4:'intermediate',
  dom7sus2:'intermediate', maj7sus2:'intermediate', maj7sus4:'intermediate',
  add4:'intermediate', minadd4:'intermediate', sus2sus4:'intermediate',
  maj11:'intermediate', min11:'intermediate', dom11:'intermediate',
  min13:'intermediate', maj13:'intermediate', dom13:'intermediate',
  majb5:'intermediate', dom13sus4:'intermediate', minmaj9:'intermediate',
  // Everything not listed → defaults to 'advanced'
};

/** Classify a voicing shape by mechanical difficulty (finger count, span, barre). */
function _mechanicsDifficulty(frets, isBarre) {
  const frettedOnly = frets.filter(f => f > 0);
  const fingers     = countFingers(frets);
  const span        = frettedOnly.length > 1
    ? Math.max(...frettedOnly) - Math.min(...frettedOnly) : 0;
  const hasOpen     = frets.some(f => f === 0);
  // Beginner: open-position chord (≥1 open string), ≤3 effective fingers, span ≤2.
  // Partial barres on open chords (e.g. A major x02220) are still beginner-accessible,
  // so we don't disqualify based on isBarre when open strings are present.
  if (hasOpen && fingers <= 3 && span <= 2) return 'beginner';
  // Intermediate: full barre chord or closed position ≤4 fingers with span ≤3
  if (isBarre || (fingers <= 4 && span <= 3)) return 'intermediate';
  return 'advanced';
}

/**
 * Return the difficulty rating for a voicing.
 * Final difficulty = max(chord-quality difficulty, finger-mechanics difficulty).
 * @export so voicingExplorer can reference it if needed.
 */
export function voicingDifficulty(frets, quality, isBarre = false) {
  const qualRank = _DIFF_RANK[QUALITY_DIFFICULTY[quality] ?? 'advanced'];
  const mechRank = _DIFF_RANK[_mechanicsDifficulty(frets, isBarre)];
  return ['beginner', 'intermediate', 'advanced'][Math.max(qualRank, mechRank)];
}

// ─── Chord Name Parser ────────────────────────────────────────────────────────

// Root-note spellings ordered longest-first so regex matches greedily
const ROOT_RE = /^([A-G][b#]?)/i;

// Reverse CHORD_SUFFIXES: display-suffix → quality key, sorted longest-first.
// Additional aliases for common informal spellings (min, maj, etc.)
const _SUFFIX_TO_QUALITY = (() => {
  const entries = Object.entries(CHORD_SUFFIXES)
    .map(([q, s]) => [s, q])
    .sort((a, b) => b[0].length - a[0].length); // longest suffix first

  const map = new Map(entries);

  // Extra informal aliases not in CHORD_SUFFIXES display strings
  const aliases = [
    ['min7',   'min7'], ['min9',  'min9'],  ['min11', 'min11'],
    ['min13',  'min13'],['min',   'min'],   ['maj',   'maj'],
    ['dom7',   'dom7'], ['dom9',  'dom9'],  ['dom11', 'dom11'],
    ['dom13',  'dom13'],['M7',    'maj7'],  ['M',     'maj'],
    ['(no5)',  null],   // stripped below
  ];
  for (const [alias, q] of aliases) {
    if (q && !map.has(alias)) map.set(alias, q);
  }
  return map;
})();

/**
 * Parse a chord name string like "Abmaj7", "Cm7", "F#dim" into { root, quality }.
 * Returns null if unrecognised.
 * @param {string} str
 * @returns {{ root: number, quality: string }|null}
 */
export function parseChordName(str) {
  if (!str?.trim()) return null;
  const s = str.trim();

  // Extract root note
  const rootMatch = ROOT_RE.exec(s);
  if (!rootMatch) return null;
  const rootStr = rootMatch[1];

  // Normalise the root string to a pitch class (case-insensitive lookup)
  const NOTE_TO_PITCH = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
  };
  // Try exact then title-case
  const rootNorm = rootStr.charAt(0).toUpperCase() + rootStr.slice(1).toLowerCase();
  const root = NOTE_TO_PITCH[rootNorm] ?? NOTE_TO_PITCH[rootStr];
  if (root === undefined) return null;

  let suffix = s.slice(rootStr.length).trim();

  // Strip parenthetical modifiers we can't fully resolve (no5, no3, etc.)
  suffix = suffix.replace(/\(no\d\)/g, '').trim();

  // Try matching suffix (longest-first already encoded in the Map iteration order)
  // We need sorted entries for greedy matching
  const sortedEntries = [..._SUFFIX_TO_QUALITY.entries()]
    .sort((a, b) => b[0].length - a[0].length);

  for (const [sfx, quality] of sortedEntries) {
    if (sfx === suffix || sfx.toLowerCase() === suffix.toLowerCase()) {
      return { root, quality };
    }
  }

  // Empty suffix → major
  if (suffix === '') return { root, quality: 'maj' };

  return null;
}

export function formatChordName(rootNote, quality) {
  return `${rootNote}${CHORD_SUFFIXES[quality] ?? quality}`;
}

export function formatChordNameInKey(rootPitch, quality, keyRoot) {
  const rootNote = pitchToNoteInKey(rootPitch, keyRoot);
  return `${rootNote}${CHORD_SUFFIXES[quality] ?? quality}`;
}

/**
 * Build the pitch classes for a chord given root and quality
 */
export function buildChord(rootPitch, quality) {
  const formula = CHORD_FORMULAS[quality];
  if (!formula) return [];
  return formula.map(offset => normalizePitch(rootPitch + offset));
}

/**
 * Extract pitch classes from fretboard state
 * @param {number[]} selectedFrets  [-1=muted, 0=open, 1-22=fret]; index 0 = low string
 * @param {number[]} tuning         pitch class per string; index 0 = low string
 */
export function fretboardToPitches(selectedFrets, tuning) {
  const allPitches = [];
  let bassPitch = null;

  for (let i = 0; i < 6; i++) {
    if (selectedFrets[i] === -1) continue;
    const pitch = normalizePitch(tuning[i] + selectedFrets[i]);
    allPitches.push(pitch);
    if (bassPitch === null) bassPitch = pitch; // lowest string first
  }

  const pitchSet = [...new Set(allPitches)];
  return { pitchSet, bassPitch, allPitches };
}

/**
 * Identify the best chord match for a set of pitch classes.
 * Returns a chord object or null.
 */
export function identifyChord(pitchSet, bassPitch = null) {
  if (!pitchSet || pitchSet.length === 0) return null;

  // Single pitch = note only
  if (pitchSet.length === 1) {
    const note = CHROMATIC_SHARP[pitchSet[0]];
    return {
      root: pitchSet[0], rootNote: note, quality: 'maj',
      name: note, pitches: pitchSet, actualPitches: pitchSet,
      inversion: 0, bassNote: note, confidence: 0.3,
    };
  }

  let best = null;
  let bestScore = -Infinity;

  for (const candidateRoot of pitchSet) {
    // Intervals from this candidate root (all mod 12)
    const intervals = new Set(
      pitchSet.map(p => normalizePitch(p - candidateRoot))
    );

    for (const [quality, formula] of Object.entries(CHORD_FORMULAS)) {
      const formulaSet = new Set(formula.map(x => normalizePitch(x)));

      let matches = 0;
      for (const f of formulaSet) {
        if (intervals.has(f)) matches++;
      }

      let extras = 0;
      for (const iv of intervals) {
        if (!formulaSet.has(iv)) extras++;
      }

      // Reward complete matches; penalize extras lightly
      const score = (matches / formulaSet.size) - (extras * 0.12);

      if (score > bestScore) {
        bestScore = score;
        const rootNote = CHROMATIC_SHARP[candidateRoot];
        const isInversion = bassPitch !== null && bassPitch !== candidateRoot;
        best = {
          root: candidateRoot,
          rootNote,
          quality,
          name: formatChordName(rootNote, quality),
          pitches: buildChord(candidateRoot, quality),
          actualPitches: pitchSet,
          inversion: isInversion ? 1 : 0,
          bassNote: bassPitch !== null ? CHROMATIC_SHARP[bassPitch] : rootNote,
          bassPitch: bassPitch,   // stored so callers can re-spell with key context
          confidence: Math.max(0, score),
        };
        if (isInversion) {
          best.slashName = `${best.name}/${CHROMATIC_SHARP[bassPitch]}`;
        }
      }
    }
  }

  return best;
}

/**
 * Get a common guitar voicing (fret positions) for well-known chords.
 * Returns selectedFrets array for standard tuning, or null if not in library.
 */
export const COMMON_VOICINGS = {
  // [string6, string5, string4, string3, string2, string1]
  // -1=muted, 0=open
  'C-maj':   [-1, 3, 2, 0, 1, 0],
  'D-maj':   [-1, -1, 0, 2, 3, 2],
  'E-maj':   [0, 2, 2, 1, 0, 0],
  'F-maj':   [1, 3, 3, 2, 1, 1],
  'G-maj':   [3, 2, 0, 0, 0, 3],
  'A-maj':   [-1, 0, 2, 2, 2, 0],
  'B-maj':   [-1, 2, 4, 4, 4, -1],  // 4 fingers; barre version generated by generateBarreVoicings
  'Am-min':  [-1, 0, 2, 2, 1, 0],
  'Dm-min':  [-1, -1, 0, 2, 3, 1],
  'Em-min':  [0, 2, 2, 0, 0, 0],
  'Bm-min':  [-1, 2, 4, 4, 3, -1], // 4 fingers; barre version generated by generateBarreVoicings
  'G-dom7':  [3, 2, 0, 0, 0, 1],
  'C-maj7':  [-1, 3, 2, 0, 0, 0],
  'A-dom7':  [-1, 0, 2, 0, 2, 0],
  'E-dom7':  [0, 2, 0, 1, 0, 0],
  'D-dom7':  [-1, -1, 0, 2, 1, 2],
  'B-dom7':  [-1, 2, 1, 2, 0, 2],
};

export function getCommonVoicing(rootPitch, quality) {
  const rootNote = CHROMATIC_SHARP[rootPitch];
  const key = `${rootNote}-${quality}`;
  return COMMON_VOICINGS[key] ?? null;
}

/**
 * Count the number of fretting fingers required for a voicing.
 * Barre-aware: if 2+ strings share the lowest fretted position, the barre
 * counts as 1 finger regardless of how many strings it covers.
 * @param {number[]} frets  [-1=muted, 0=open, >0=fretted]
 * @returns {number}
 */
function countFingers(frets) {
  const frettedFrets = frets.filter(f => f > 0);
  if (frettedFrets.length === 0) return 0;
  const minFret = Math.min(...frettedFrets);
  const stringsAtMin = frettedFrets.filter(f => f === minFret).length;
  if (stringsAtMin >= 2) {
    // Barre chord: index lays flat across minFret; individual fingers above it
    return 1 + frettedFrets.filter(f => f > minFret).length;
  }
  return frettedFrets.length;
}

/**
 * Internal helper: generate algorithmic voicings for a chord using a two-phase fill.
 * Phase A covers all chord tones first; Phase B fills remaining strings greedily.
 * @param {number}   rootPitch
 * @param {number[]} targetPitches
 * @param {number[]} tuning
 * @param {number}   spanLimit  - max fret span allowed (4 = normal, 5 = relaxed)
 */
function _generateAlgorithmicVoicings(rootPitch, targetPitches, tuning, spanLimit) {
  const results = [];

  for (let bassString = 0; bassString <= 3; bassString++) {
    for (let rootFret = 0; rootFret <= 12; rootFret++) {
      if (normalizePitch(tuning[bassString] + rootFret) !== rootPitch) continue;

      const frets   = new Array(6).fill(-1);
      frets[bassString] = rootFret;

      // Phase A: cover each chord tone that isn't yet on the bass string
      const covered = new Set([normalizePitch(tuning[bassString] + rootFret)]);
      const usedStr = new Set([bassString]);

      for (const tp of targetPitches) {
        if (covered.has(tp)) continue;
        let bestStr = -1, bestFret = -1, bestDist = Infinity;
        for (let s = bassString + 1; s < 6; s++) {
          if (usedStr.has(s)) continue;
          for (let f = Math.max(0, rootFret - 1); f <= rootFret + spanLimit; f++) {
            if (normalizePitch(tuning[s] + f) === tp) {
              // Open strings are always preferred over fretted notes
              const dist = f === 0 ? -1 : Math.abs(f - rootFret);
              if (dist < bestDist) { bestDist = dist; bestStr = s; bestFret = f; }
            }
          }
        }
        if (bestStr !== -1) {
          frets[bestStr] = bestFret;
          usedStr.add(bestStr);
          covered.add(tp);
        }
      }

      // Phase B: fill remaining strings with any closest chord tone (greedy)
      for (let s = bassString + 1; s < 6; s++) {
        if (usedStr.has(s)) continue;
        let bestFret = -1, bestDist = Infinity;
        for (const tp of targetPitches) {
          for (let f = Math.max(0, rootFret - 1); f <= rootFret + spanLimit; f++) {
            if (normalizePitch(tuning[s] + f) === tp) {
              // Open strings are always preferred over fretted notes
              const dist = f === 0 ? -1 : Math.abs(f - rootFret);
              if (dist < bestDist) { bestDist = dist; bestFret = f; }
            }
          }
        }
        frets[s] = bestFret;
      }

      // Post-process: if > 4 fingers, mute redundant strings (duplicate pitches) until ≤ 4
      if (countFingers(frets) > 4) {
        const pitchToStrings = new Map();
        for (let s = 0; s < 6; s++) {
          if (frets[s] < 0) continue;
          const p = normalizePitch(tuning[s] + frets[s]);
          if (!pitchToStrings.has(p)) pitchToStrings.set(p, []);
          pitchToStrings.get(p).push(s);
        }
        for (const [, strings] of pitchToStrings) {
          if (strings.length <= 1) continue;
          // Keep the string with the lowest fret; mute higher-fret duplicates
          strings.sort((a, b) => frets[a] - frets[b]);
          for (let i = 1; i < strings.length; i++) {
            if (countFingers(frets) <= 4) break;
            frets[strings[i]] = -1;
          }
        }
      }

      // Validate: ≥3 sounding strings, span within limit, all chord tones present, ≤5 fretted
      const activeFrets = frets.filter(f => f >= 0);
      if (activeFrets.length < 3) continue;
      const frettedFrets = activeFrets.filter(f => f > 0);
      const span = frettedFrets.length > 0
        ? Math.max(...frettedFrets) - Math.min(...frettedFrets) : 0;
      if (span > spanLimit) continue;
      const played = new Set(
        frets.map((f, s) => f >= 0 ? normalizePitch(tuning[s] + f) : null).filter(x => x !== null)
      );
      if (!targetPitches.every(p => played.has(p))) continue;

      // Reject physically impossible voicings (> 4 fingers)
      if (countFingers(frets) > 4) continue;

      const lowestFret = Math.min(...frets.filter(f => f > 0), Infinity);
      const label = activeFrets.some(f => f === 0) ? 'Open' : `${lowestFret}th fret`;
      // Detect if the algorithmic shape happens to be a barre (2+ strings at minFret)
      const frettedOnly = frets.filter(f => f > 0);
      const minFretVal  = frettedOnly.length ? Math.min(...frettedOnly) : 0;
      const isAlgoBarre = frettedOnly.filter(f => f === minFretVal).length >= 2;
      results.push({ frets: frets.slice(), label, ...(isAlgoBarre ? { isBarre: true } : {}) });
    }
  }

  return results;
}

/**
 * Generate multiple playable voicings for a chord algorithmically.
 * Returns up to 6 voicings ordered from open position up the neck.
 * @param {number}   rootPitch  0–11
 * @param {string}   quality    key of CHORD_FORMULAS
 * @param {number[]} tuning     pitch class per string (index 0 = low E)
 * @returns {{ frets: number[], label: string, isStandard?: true }[]}
 */
export function generateVoicings(rootPitch, quality, tuning) {
  const formula = CHORD_FORMULAS[quality];
  if (!formula) return [];
  const targetPitches = formula.map(offset => normalizePitch(rootPitch + offset));
  const voicings = [];

  // Hard-coded standard voicing — validate pitches against actual tuning before using
  const standard = getCommonVoicing(rootPitch, quality);
  if (standard) {
    const targetSet = new Set(targetPitches);
    const played = standard
      .map((f, s) => f >= 0 ? normalizePitch(tuning[s] + f) : null)
      .filter(x => x !== null);
    const playedSet = new Set(played);
    const isValid = targetPitches.every(p => playedSet.has(p))
                 && played.every(p => targetSet.has(p));
    if (isValid && countFingers(standard) <= 4) {
      const isStdTuning = tuning.join(',') === [4, 9, 2, 7, 11, 4].join(',');
      voicings.push({ frets: standard, label: isStdTuning ? 'Standard' : 'Open', isStandard: true });
    }
  }

  // Algorithmic: two-pass fill, normal span
  let algorithmic = _generateAlgorithmicVoicings(rootPitch, targetPitches, tuning, 4);

  // Fallback A: wider span (helps alternate tunings where tones are spread further apart)
  if (algorithmic.length === 0) {
    algorithmic = _generateAlgorithmicVoicings(rootPitch, targetPitches, tuning, 5);
  }

  // Fallback B: shell voicing for 7th chords — drop the 7th and use the triad
  if (algorithmic.length === 0 && formula.length === 4) {
    const triadPitches = [targetPitches[0], targetPitches[1], targetPitches[2]];
    algorithmic = _generateAlgorithmicVoicings(rootPitch, triadPitches, tuning, 5)
      .map(v => ({ ...v, label: v.label + ' (shell)' }));
  }

  // Fallback C: extended chords (5+ notes) — drop the 5th (standard jazz practice)
  if (algorithmic.length === 0 && formula.length >= 5) {
    // Remove the 5th (index 2 in the formula is always P5) to create a playable shell
    const without5th = targetPitches.filter((_, i) => i !== 2);
    algorithmic = _generateAlgorithmicVoicings(rootPitch, without5th, tuning, 4)
      .map(v => ({ ...v, label: v.label + ' (no 5)' }));
    if (algorithmic.length === 0) {
      algorithmic = _generateAlgorithmicVoicings(rootPitch, without5th, tuning, 5)
        .map(v => ({ ...v, label: v.label + ' (no 5)' }));
    }
  }

  voicings.push(...algorithmic);

  // Append barre chord shapes (full formula)
  voicings.push(...generateBarreVoicings(rootPitch, quality, tuning));

  // For extended chords, also try barre shapes with the no-5th shell
  if (formula.length >= 5) {
    const without5th = targetPitches.filter((_, i) => i !== 2);
    voicings.push(...generateBarreVoicings(rootPitch, quality, tuning, without5th)
      .map(v => ({ ...v, label: v.label + ' (no 5)' })));
  }

  // Deduplicate, sort open-string-rich voicings first, annotate difficulty, then limit
  const seen = new Set();
  return voicings.filter(v => {
    const key = v.frets.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => {
    const openA = a.frets.filter(f => f === 0).length;
    const openB = b.frets.filter(f => f === 0).length;
    return openB - openA;
  }).map(v => ({
    ...v,
    difficulty: voicingDifficulty(v.frets, quality, v.isBarre ?? false),
  })).slice(0, 8);
}

/**
 * Generate moveable barre chord voicings using a tuning-aware search.
 * Works for any tuning by computing chord-tone positions from actual string intervals.
 * @param {number}    rootPitch
 * @param {string}    quality
 * @param {number[]}  tuning
 * @param {number[]?} overridePitches  optional explicit target pitches (e.g. no-5th shell)
 * @returns {{ frets: number[], label: string, isBarre: true }[]}
 */
export function generateBarreVoicings(rootPitch, quality, tuning, overridePitches) {
  const formula = CHORD_FORMULAS[quality];
  if (!formula) return [];
  const targetPitches = overridePitches ?? formula.map(offset => normalizePitch(rootPitch + offset));
  const results = [];

  // Try barring with root on string 0 (E-shape) or string 1 (A-shape)
  for (let bassStr = 0; bassStr <= 1; bassStr++) {
    for (let barFret = 1; barFret <= 12; barFret++) {
      if (normalizePitch(tuning[bassStr] + barFret) !== rootPitch) continue;

      const frets = new Array(6).fill(-1);
      // Mute any strings below bass string
      for (let s = 0; s < bassStr; s++) frets[s] = -1;
      frets[bassStr] = barFret;

      // Phase A: cover each chord tone with the nearest string+fret above the barre
      const covered = new Set([normalizePitch(tuning[bassStr] + barFret)]);
      const usedStr = new Set([bassStr]);

      for (const tp of targetPitches) {
        if (covered.has(tp)) continue;
        let bestStr = -1, bestFret = -1, bestPri = Infinity;
        for (let s = bassStr + 1; s < 6; s++) {
          if (usedStr.has(s)) continue;
          for (let f = barFret; f <= barFret + 3; f++) {
            if (normalizePitch(tuning[s] + f) === tp) {
              const pri = (f - barFret) * 10;
              if (pri < bestPri) { bestPri = pri; bestStr = s; bestFret = f; }
            }
          }
        }
        if (bestStr !== -1) {
          frets[bestStr] = bestFret;
          usedStr.add(bestStr);
          covered.add(tp);
        }
      }

      // Phase B: fill remaining strings greedily (prefer lower frets, root > 5th > other)
      for (let s = bassStr + 1; s < 6; s++) {
        if (usedStr.has(s)) continue;
        let bestFret = -1, bestPri = Infinity;
        for (const tp of targetPitches) {
          for (let f = barFret; f <= barFret + 3; f++) {
            if (normalizePitch(tuning[s] + f) === tp) {
              const fretCost = (f - barFret) * 10;
              const toneCost = tp === rootPitch                      ? 0
                             : tp === normalizePitch(rootPitch + 7) ? 1
                             : 2;
              const pri = fretCost + toneCost;
              if (pri < bestPri) { bestPri = pri; bestFret = f; }
            }
          }
        }
        frets[s] = bestFret;
      }

      // Post-process: if > 4 fingers, mute redundant duplicate-pitch strings until ≤ 4
      if (countFingers(frets) > 4) {
        const pitchToStr = new Map();
        for (let s = 0; s < 6; s++) {
          if (frets[s] < 0) continue;
          const p = normalizePitch(tuning[s] + frets[s]);
          if (!pitchToStr.has(p)) pitchToStr.set(p, []);
          pitchToStr.get(p).push(s);
        }
        for (const [, strings] of pitchToStr) {
          if (strings.length <= 1) continue;
          strings.sort((a, b) => frets[a] - frets[b]);
          for (let i = 1; i < strings.length; i++) {
            if (countFingers(frets) <= 4) break;
            frets[strings[i]] = -1;
          }
        }
      }

      // Validation
      const activeFrets = frets.filter(f => f >= 0);
      if (activeFrets.length < 4) continue;

      const span = Math.max(...activeFrets) - barFret;
      if (span > 3) continue; // no more than 3 frets above barre

      const played = new Set(
        frets.map((f, s) => f >= 0 ? normalizePitch(tuning[s] + f) : null).filter(x => x !== null)
      );
      if (!targetPitches.every(p => played.has(p))) continue; // missing chord tones
      if (countFingers(frets) > 4) continue;                  // safety: never exceed 4 fingers

      const shapeLabel = bassStr === 0 ? 'E-shape Barre' : 'A-shape Barre';
      results.push({ frets: frets.slice(), label: `${shapeLabel} (${barFret}fr)`, isBarre: true });
    }
  }

  return results;
}
