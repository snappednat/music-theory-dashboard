import { generateScale } from './scales.js';
import { buildChord, formatChordNameInKey, CHORD_SUFFIXES } from './chords.js';
import { pitchToNote, pitchToNoteInKey, normalizePitch } from './notes.js';

// Diatonic chord qualities per scale degree (major, minor, and modes)
export const DIATONIC_QUALITIES = {
  major:         ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
  natural_minor: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
  harmonic_minor:['min', 'dim', 'aug', 'min', 'maj', 'maj', 'dim'],
  dorian:        ['min', 'min', 'maj', 'maj', 'min', 'dim', 'maj'],
  phrygian:      ['min', 'maj', 'maj', 'min', 'dim', 'maj', 'min'],
  lydian:        ['maj', 'maj', 'min', 'dim', 'maj', 'min', 'min'],
  mixolydian:    ['maj', 'min', 'dim', 'maj', 'min', 'min', 'maj'],
};

// Maps quality name → generateScale() scale type
const QUALITY_TO_SCALE = {
  major: 'major', minor: 'natural_minor',
  dorian: 'dorian', phrygian: 'phrygian', lydian: 'lydian', mixolydian: 'mixolydian',
};

// For modal keys: maps to parent diatonic quality for borrowed-chord logic
const MODAL_PARENT = { dorian: 'minor', phrygian: 'minor', lydian: 'major', mixolydian: 'major' };

// Semitone offset from modal root back to its parent Ionian root
const MODE_PARENT_OFFSET = { dorian: 2, phrygian: 4, lydian: 5, mixolydian: 7 };

// Circle of fifths order (pitch classes starting from C going clockwise)
export const FIFTHS_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

// Scale degree names (quality-aware: degree 7 differs between major and minor)
export const DEGREE_NAMES = {
  major:      { 1: 'Tonic', 2: 'Supertonic', 3: 'Mediant', 4: 'Subdominant', 5: 'Dominant', 6: 'Submediant', 7: 'Leading Tone' },
  minor:      { 1: 'Tonic', 2: 'Supertonic', 3: 'Mediant', 4: 'Subdominant', 5: 'Dominant', 6: 'Submediant', 7: 'Subtonic' },
  dorian:     { 1: 'Tonic', 2: 'Supertonic', 3: 'Mediant', 4: 'Subdominant', 5: 'Dominant', 6: 'Submediant', 7: 'Subtonic' },
  phrygian:   { 1: 'Tonic', 2: 'Supertonic', 3: 'Mediant', 4: 'Subdominant', 5: 'Dominant', 6: 'Submediant', 7: 'Subtonic' },
  lydian:     { 1: 'Tonic', 2: 'Supertonic', 3: 'Mediant', 4: 'Tritone Chord', 5: 'Dominant', 6: 'Submediant', 7: 'Subtonic' },
  mixolydian: { 1: 'Tonic', 2: 'Supertonic', 3: 'Mediant', 4: 'Subdominant', 5: 'Dominant', 6: 'Submediant', 7: 'Subtonic' },
};

// Functional group per degree
export const DEGREE_FUNCTIONS = {
  major: {
    1: 'Tonic', 2: 'Pre-dominant', 3: 'Tonic substitute',
    4: 'Subdominant', 5: 'Dominant', 6: 'Tonic substitute', 7: 'Dominant substitute',
  },
  minor: {
    1: 'Tonic', 2: 'Pre-dominant', 3: 'Tonic / Relative Major',
    4: 'Subdominant', 5: 'Dominant', 6: 'Subdominant / Color', 7: 'Subtonic',
  },
  dorian: {
    1: 'Tonic', 2: 'Pre-dominant', 3: 'Tonic substitute',
    4: 'Modal IV ★', 5: 'Dominant', 6: 'Tonic color', 7: 'Subtonic',
  },
  phrygian: {
    1: 'Tonic', 2: 'Phrygian Dominant ★', 3: 'Mediant',
    4: 'Pre-dominant', 5: 'Unstable', 6: 'Color chord', 7: 'Subtonic',
  },
  lydian: {
    1: 'Tonic', 2: 'Lydian II ★', 3: 'Mediant',
    4: 'Tritone chord', 5: 'Dominant', 6: 'Submediant', 7: 'Subtonic',
  },
  mixolydian: {
    1: 'Tonic', 2: 'Pre-dominant', 3: 'Avoid chord',
    4: 'Subdominant', 5: 'Weak Dominant', 6: 'Submediant', 7: 'Modal VII ★',
  },
};

// Explanatory text per degree
export const DEGREE_EXPLANATIONS = {
  major: {
    1: 'Tonic (I) — the home chord. Stable, fully resolved. Songs gravitate back here. Everything else creates tension that resolves to I.',
    2: 'Supertonic (ii) — mild tension. The ii–V–I is the most fundamental cadence in Western music; ii "sets up" the dominant.',
    3: 'Mediant (iii) — ambiguous and soft. Shares two notes with I and two with V, so it bridges between tonic and dominant functions.',
    4: 'Subdominant (IV) — pulls away from the tonic, creating a sense of lift and departure. The IV–I "Amen cadence" is the backbone of blues and rock.',
    5: 'Dominant (V) — maximum tension. Contains the leading tone (7th scale degree) which pulls upward by a half step to resolve to the tonic. Adding the 7th (V7) makes this pull even stronger.',
    6: 'Submediant (vi) — the relative minor. Shares two notes with I, giving it a melancholic feel while staying firmly in the key. The I–V–vi–IV loop is the foundation of countless pop songs.',
    7: 'Leading Tone (vii°) — diminished chord, contains the tritone (most harmonically tense interval). Nearly always resolves directly to I. Common in classical voice leading, less so in rock.',
  },
  minor: {
    1: 'Tonic (i) — home, but darker and more melancholic than its major counterpart.',
    2: 'Supertonic (ii°) — diminished and unstable. Tends to resolve to V or VII, rarely stands alone.',
    3: 'Mediant (III) — the relative major key\'s tonic. A bright, major chord that creates strong contrast against the minor tonic.',
    4: 'Subdominant (iv) — minor subdominant, somber and heavy. Creates movement away from i without the brightness of a major IV.',
    5: 'Dominant (v/V) — natural minor has a minor v chord (no leading tone), giving a weaker pull home. Borrowing the major V from harmonic minor (raised 7th) creates a much stronger cadence back to i. Both are valid choices.',
    6: 'Submediant (VI) — a major chord in a minor key; a moment of brightness and lift. Common in emotional passages.',
    7: 'Subtonic (VII) — major chord a whole step below the tonic. Not a "leading tone" (that would require a half step up). Very common in rock minor keys: Am–G–F–E, for example.',
  },
};

// Modal scale degree explanations
export const DEGREE_EXPLANATIONS_MODAL = {
  dorian: {
    1: 'Tonic (i) — the Dorian home chord. Minor, but brighter than natural minor thanks to the raised 6th. Feels settled without being dark.',
    2: 'Supertonic (ii) — minor ii chord. Smooth preparation for the IV; both chords share the raised 6th that defines the mode.',
    3: 'Mediant (♭III) — major chord a minor third above. Borrows brightness from the relative major key.',
    4: 'Subdominant (IV ★) — Dorian\'s signature chord: a *major* IV (natural minor has a minor iv). The raised 6th creates this bright subdominant — the i–IV motion is the quintessential Dorian sound (Santana, jazz minor grooves).',
    5: 'Dominant (v) — minor v chord; no leading tone. Dorian\'s pull back home is gentle and smooth rather than tense. The IV often substitutes for a dominant function.',
    6: 'Submediant (vi°) — diminished chord, rarely used standalone. The natural 6th creates this unstable sonority; useful as a passing chord.',
    7: 'Subtonic (♭VII) — major chord a whole step below the tonic. The i–IV–♭VII loop is a staple of modal rock and jazz. Adds momentum without the tension of a dominant.',
  },
  phrygian: {
    1: 'Tonic (i) — the Phrygian home chord. Dark, heavy minor anchored by the ♭2 a half step above.',
    2: 'Supertonic (♭II ★) — Phrygian\'s signature: a major chord just a half step above the tonic. The ♭II–i motion (Phrygian cadence) defines flamenco and metal. No other mode has this half-step resolution — it\'s the darkest cadence in modal music.',
    3: 'Mediant (♭III) — major chord a minor third above. Used in cascading descents: i–♭VII–♭VI–♭VII or i–♭II–♭III.',
    4: 'Subdominant (iv) — minor subdominant. Darker and heavier than a major IV; prepares ♭II or the diminished v.',
    5: 'Dominant (v°) — diminished chord on degree 5. Rarely functions as a dominant; the ♭II performs that role in Phrygian. Use for passing tension.',
    6: 'Submediant (♭VI) — major chord. A bright moment of contrast against the dark i and iv; the ♭VI–♭VII–i cascade is very common in metal and flamenco.',
    7: 'Subtonic (♭vii) — minor chord a minor seventh above tonic. Provides movement without disrupting the modal atmosphere; common in ♭VI–♭VII–i progressions.',
  },
  lydian: {
    1: 'Tonic (I) — the Lydian home chord. Major, but floating and dreamlike thanks to the raised 4th. Never feels fully resolved — it yearns upward.',
    2: 'Supertonic (II ★) — Lydian\'s signature: a *major* II chord a whole step above the tonic. The I–II motion is instantly recognizable (Star Wars theme, many John Williams cues). This chord gives Lydian its "magical" quality.',
    3: 'Mediant (iii) — minor iii chord. Bridges between the bright I/II area and the dominant; adds emotional nuance.',
    4: 'Tritone Chord (♯iv°) — diminished chord built on the raised 4th. The ♯4 scale degree creates this unstable sound; usually avoided as a focal chord, but its tritone color adds tension.',
    5: 'Dominant (V) — major V chord, same as in major keys. Normal dominant function; provides the clearest resolution back to I in this otherwise floating mode.',
    6: 'Submediant (vi) — minor vi chord. Adds contrast and melancholy depth against the bright tonic.',
    7: 'Subtonic (vii) — minor vii chord. In Lydian this is a natural minor vii (not diminished like in major), giving a softer, less tense quality.',
  },
  mixolydian: {
    1: 'Tonic (I) — the Mixolydian home chord. Major and confident, but with a flat 7th that gives it an earthy, modal quality — it never fully resolves the way a major tonic does.',
    2: 'Supertonic (ii) — minor ii chord. Common in Mixolydian; prepares the IV or the signature ♭VII.',
    3: 'Mediant (iii°) — diminished chord. Rarely used in Mixolydian progressions; tends to disrupt the modal feel.',
    4: 'Subdominant (IV) — major IV chord, same function as in major keys. Strong movement; the backbone of the I–IV–♭VII loop.',
    5: 'Dominant (v ★) — *minor* v chord: the flat 7th removes the leading tone, so there\'s no strong pull back to I. The ♭VII chord performs the dominant role instead. Use for a soft, floating dominant.',
    6: 'Submediant (vi) — minor vi chord. Adds emotional depth and works well before IV or ♭VII.',
    7: 'Subtonic (♭VII ★) — Mixolydian\'s signature: a *major* ♭VII chord. The I–♭VII riff is the defining sound of Mixolydian rock (Sweet Home Alabama, Norwegian Wood, many blues-rock anthems). This chord is the soul of the mode.',
  },
};

// Harmonic function categories per scale degree
export const HARMONIC_FUNCTIONS = {
  major:      { 1: 'T', 2: 'PD', 3: 'TP', 4: 'PD', 5: 'D', 6: 'TP', 7: 'D'  },
  minor:      { 1: 'T', 2: 'PD', 3: 'TP', 4: 'PD', 5: 'D', 6: 'TP', 7: 'TP' },
  dorian:     { 1: 'T', 2: 'PD', 3: 'TP', 4: 'PD', 5: 'D', 6: 'TP', 7: 'TP' },
  mixolydian: { 1: 'T', 2: 'PD', 3: 'D',  4: 'PD', 5: 'D', 6: 'TP', 7: 'TP' },
  phrygian:   { 1: 'T', 2: 'TP', 3: 'TP', 4: 'PD', 5: 'D', 6: 'TP', 7: 'PD' },
  lydian:     { 1: 'T', 2: 'TP', 3: 'PD', 4: 'D',  5: 'D', 6: 'TP', 7: 'PD' },
};

export const FUNCTION_LABELS = {
  T:  { name: 'Tonic',              short: 'T',  color: '#27ae60' },
  TP: { name: 'Tonic Prolongation', short: 'TP', color: '#3498db' },
  PD: { name: 'Pre-Dominant',       short: 'PD', color: '#f39c12' },
  D:  { name: 'Dominant',           short: 'D',  color: '#e74c3c' },
};

/**
 * Get the harmonic function category for a scale degree.
 * @param {number} degree 1-7
 * @param {string} keyQuality 'major' or 'minor'
 * @returns {string|null} 'T', 'TP', 'PD', or 'D'
 */
export function getHarmonicFunction(degree, keyQuality) {
  const map = HARMONIC_FUNCTIONS[keyQuality] ?? HARMONIC_FUNCTIONS.major;
  return map[degree] ?? null;
}

function toRomanNumeral(degree, quality) {
  const upper = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][degree - 1];
  const isUpperCase = ['maj', 'aug', 'dom7', 'maj7', 'maj6', 'sus2', 'sus4', 'pow5'].includes(quality);
  let numeral = isUpperCase ? upper : upper.toLowerCase();
  if (quality === 'dim' || quality === 'dim7') numeral += '°';
  else if (quality === 'aug') numeral += '+';
  else if (quality === 'hdim7') numeral += 'ø';
  return numeral;
}

/**
 * Build a complete key object — supports major, minor, and the four common modes.
 * @param {number} rootPitch - 0-11
 * @param {'major'|'minor'|'dorian'|'phrygian'|'lydian'|'mixolydian'} quality
 */
/**
 * Count flat- vs. sharp-spelled chord roots in a progression.
 * Compares chord names against known flat/sharp root spellings on black-key pitches.
 * Used to choose the enharmonic spelling of a detected key (Ab vs G#, Bb vs A#, etc.)
 * @param {object[]} chords - chord objects with .name or .rootNote
 * @returns {{ flatCount, sharpCount, preferFlats }}
 */
export function countProgressionAccidentals(chords) {
  const FLAT_ROOTS  = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'];
  const SHARP_ROOTS = ['C#', 'D#', 'F#', 'G#', 'A#'];
  let flatCount = 0, sharpCount = 0;
  for (const chord of (chords ?? [])) {
    const name = chord?.name ?? chord?.rootNote ?? '';
    if (FLAT_ROOTS.some(n => name.startsWith(n)))       flatCount++;
    else if (SHARP_ROOTS.some(n => name.startsWith(n))) sharpCount++;
  }
  // Return undefined (not false) when tied — lets buildKey use its SHARP_KEYS fallback.
  // Only override with an explicit boolean when the progression clearly prefers one spelling.
  const preferFlats = flatCount > sharpCount ? true
    : sharpCount > flatCount ? false
    : undefined;
  return { flatCount, sharpCount, preferFlats };
}

export function buildKey(rootPitch, quality = 'major', preferFlats = undefined) {
  const scaleType = QUALITY_TO_SCALE[quality] ?? 'major';
  const scalePitches = generateScale(rootPitch, scaleType);
  const diatonicQualities = DIATONIC_QUALITIES[scaleType] ?? DIATONIC_QUALITIES.major;

  const isModal = quality !== 'major' && quality !== 'minor';
  const degFunctions    = DEGREE_FUNCTIONS[quality]    ?? DEGREE_FUNCTIONS.major;
  const degExplanations = isModal
    ? (DEGREE_EXPLANATIONS_MODAL[quality] ?? DEGREE_EXPLANATIONS.major)
    : (DEGREE_EXPLANATIONS[quality]       ?? DEGREE_EXPLANATIONS.major);

  const diatonicChords = scalePitches.map((degreePitch, i) => {
    const q = diatonicQualities[i];
    return {
      degree: i + 1,
      numeral: toRomanNumeral(i + 1, q),
      root: degreePitch,
      rootNote: pitchToNoteInKey(degreePitch, rootPitch),
      quality: q,
      name: formatChordNameInKey(degreePitch, q, rootPitch),
      pitches: buildChord(degreePitch, q),
      functionLabel: degFunctions[i + 1],
      explanation: degExplanations[i + 1],
    };
  });

  // Harmonic minor V chord — only for natural minor keys
  let harmonicV = null;
  if (quality === 'minor') {
    const harmonicScale = generateScale(rootPitch, 'harmonic_minor');
    const vRoot = harmonicScale[4];
    harmonicV = {
      degree: 5,
      numeral: 'V',
      root: vRoot,
      rootNote: pitchToNoteInKey(vRoot, rootPitch),
      quality: 'maj',
      name: formatChordNameInKey(vRoot, 'maj', rootPitch),
      pitches: buildChord(vRoot, 'maj'),
      isHarmonicV: true,
    };
  }

  const circlePos       = FIFTHS_ORDER.indexOf(normalizePitch(rootPitch));
  const dominantRoot    = FIFTHS_ORDER[(circlePos + 1) % 12];
  const subdominantRoot = FIFTHS_ORDER[(circlePos + 11) % 12];
  // Enharmonic spelling: caller can supply a preference (from accidental counting);
  // fallback uses the SHARP_KEYS convention already encoded in pitchToNoteInKey.
  const rootNote = preferFlats !== undefined
    ? pitchToNote(rootPitch, preferFlats)
    : pitchToNoteInKey(rootPitch, rootPitch);

  // Relative / parent key
  let relativeRoot, relativeQuality, relativeName, relativeLabel;
  if (isModal) {
    const parentOffset = MODE_PARENT_OFFSET[quality] ?? 0;
    relativeRoot    = normalizePitch(rootPitch - parentOffset);
    relativeQuality = 'major';
    relativeName    = pitchToNote(relativeRoot) + ' Major';
    relativeLabel   = 'Parent Key';
  } else {
    const relativeOffset = quality === 'major' ? 9 : 3;
    relativeRoot    = normalizePitch(rootPitch + relativeOffset);
    relativeQuality = quality === 'major' ? 'minor' : 'major';
    relativeName    = pitchToNoteInKey(relativeRoot, rootPitch) +
                      (relativeQuality === 'minor' ? 'm' : '');
    relativeLabel   = quality === 'major' ? 'Relative Minor' : 'Relative Major';
  }

  const modeName = isModal
    ? quality.charAt(0).toUpperCase() + quality.slice(1)
    : quality === 'major' ? 'Major' : 'Minor';

  return {
    root: rootPitch,
    rootNote,
    quality,
    modeName,
    isModal,
    name: `${rootNote} ${modeName}`,
    shortName: isModal ? `${rootNote} ${modeName}` : rootNote + (quality === 'minor' ? 'm' : ''),
    scalePitches,
    diatonicChords,
    harmonicV,
    circlePos,
    dominantRoot,
    subdominantRoot,
    relativeRoot,
    relativeQuality,
    relativeName,
    relativeLabel,
    parallelMinorName: rootNote + 'm',
    parallelMajorName: rootNote,
  };
}

/**
 * Score how well a chord fits in a key (0.0 to 1.0)
 */
function scoreChordInKey(chord, key) {
  if (!chord || !chord.actualPitches) return 0;

  const root = normalizePitch(chord.root);
  const degreeIdx = key.scalePitches.indexOf(root);

  if (degreeIdx === -1) {
    // Not diatonic — check if it's the harmonic minor V
    if (key.harmonicV && root === key.harmonicV.root && chord.quality === 'maj') {
      return 0.75;
    }
    // Could be a borrowed chord — give partial credit if most tones are in key
    const tonesInKey = chord.actualPitches.filter(p => key.scalePitches.includes(normalizePitch(p))).length;
    return (tonesInKey / chord.actualPitches.length) * 0.3;
  }

  const expectedQ = key.diatonicChords[degreeIdx]?.quality;
  const tonesInKey = chord.actualPitches.filter(p => key.scalePitches.includes(normalizePitch(p))).length;
  const coverage = tonesInKey / chord.actualPitches.length;

  if (chord.quality === expectedQ) {
    // Perfect diatonic match
    return 0.5 + coverage * 0.5;
  } else {
    // Right root, borrowed quality
    return coverage * 0.55;
  }
}

/**
 * Detect the most likely keys from a list of chord objects.
 * @param {object[]} chords - array of chord objects from identifyChord()
 * @returns {{ key, confidence }[]} ranked list (highest confidence first)
 */
const DETECTABLE_QUALITIES = ['major', 'minor', 'dorian', 'mixolydian', 'phrygian', 'lydian'];

export function detectKey(chords) {
  if (!chords || chords.length === 0) return [];

  // Infer enharmonic spelling preference from how chords are named in the progression
  const { preferFlats } = countProgressionAccidentals(chords);

  const results = [];

  for (let root = 0; root < 12; root++) {
    for (const quality of DETECTABLE_QUALITIES) {
      const key = buildKey(root, quality, preferFlats);
      let totalScore = 0;
      let totalWeight = 0;

      for (const chord of chords) {
        if (!chord) continue;
        const degreeIdx = key.scalePitches.indexOf(normalizePitch(chord.root));

        // Weight tonic and dominant more heavily — but only when quality matches
        let weight = 1.0;
        if (degreeIdx === 0) {
          // Tonic bonus: chord quality must match or extend the expected tonic quality
          // (e.g. 'maj7'.startsWith('maj') ✓, 'dom7'.startsWith('maj') ✗)
          const expectedQ = key.diatonicChords[0]?.quality ?? '';
          const qualityMatch = chord.quality === expectedQ
            || (chord.quality ?? '').startsWith(expectedQ);
          weight = qualityMatch ? 1.5 : 1.0;
        }
        if (degreeIdx === 4) {
          // Dominant bonus: exact match OR dom7 (V and V7 both serve dominant function)
          const expectedQ = key.diatonicChords[4]?.quality ?? '';
          const isDom = chord.quality === expectedQ || chord.quality === 'dom7';
          weight = isDom ? 1.3 : 1.0;
        }

        totalScore += scoreChordInKey(chord, key) * weight;
        totalWeight += weight;
      }

      // Tonic-frequency bonus: reward keys whose tonic chord appears multiple times.
      // This addresses denominator-inflation: a key with 3 tonic appearances should
      // outscore a relative key with only 1 tonic appearance, even when both share
      // the same 7 scale notes (e.g. Ab Major vs F Minor).
      // +0.04 per confirmed tonic match (quality-matched chord at degree 0), max 0.12.
      const expectedTonicQ = key.diatonicChords[0]?.quality ?? '';
      const tonicMatches = chords.filter(c => {
        if (!c || normalizePitch(c.root) !== key.root) return false;
        return c.quality === expectedTonicQ || (c.quality ?? '').startsWith(expectedTonicQ);
      }).length;
      const tonicBonus = Math.min(tonicMatches * 0.04, 0.12);

      // Mild tiebreaker: prefer tonal keys when a modal key shares the same scale notes.
      // 3% penalty is small enough not to suppress genuine modal results.
      const isModal = !['major', 'minor'].includes(quality);
      const baseConfidence = totalWeight > 0 ? totalScore / totalWeight : 0;
      const confidence = Math.min(1.0, (baseConfidence + tonicBonus) * (isModal ? 0.97 : 1.0));
      results.push({ key, confidence });
    }
  }

  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .filter(r => r.confidence > 0);
}

/**
 * Get 1-based scale degree of a chord root in a key; null if not diatonic
 */
export function getDegreeInKey(chordRoot, key) {
  const idx = key.scalePitches.indexOf(normalizePitch(chordRoot));
  return idx === -1 ? null : idx + 1;
}

/**
 * Detect key modulations within a chord progression.
 * Uses a sliding window to find where the detected key changes.
 * @param {object[]} progression - chord objects
 * @returns {ModulationResult[]} array of { fromKey, toKey, pivotIdx, pivotChord, type }
 */
export function detectModulations(progression) {
  if (!progression || progression.length < 6) return [];

  const windowSize = 4;
  const results    = [];
  let prevKeyRoot      = null;
  let prevKeyQuality   = null;
  // Candidate tracking: a potential new key must appear in 2 consecutive windows
  // before being confirmed as a real modulation.
  let candidateRoot     = null;
  let candidateQuality  = null;
  let candidateFirstIdx = -1;

  const { preferFlats } = countProgressionAccidentals(progression);

  for (let i = 0; i <= progression.length - windowSize; i++) {
    const win = progression.slice(i, i + windowSize);
    const keyResults = detectKey(win);
    if (keyResults.length === 0) continue;

    const topKey     = keyResults[0].key;
    const confidence = keyResults[0].confidence;

    // Raised from 0.6 → require stronger evidence before considering a key shift
    if (confidence < 0.72) continue;

    if (prevKeyRoot === null) {
      prevKeyRoot    = topKey.root;
      prevKeyQuality = topKey.quality;
      continue;
    }

    const sameAsPrev = topKey.root === prevKeyRoot && topKey.quality === prevKeyQuality;

    if (sameAsPrev) {
      // Window reverted to the established key — discard any pending candidate
      candidateRoot = candidateQuality = null;
      candidateFirstIdx = -1;
      continue;
    }

    const sameCandidate = candidateRoot !== null &&
      topKey.root === candidateRoot && topKey.quality === candidateQuality;

    if (sameCandidate) {
      // Two consecutive windows agree on the same new key → real modulation
      const pivotIdx   = candidateFirstIdx;
      const pivotChord = progression[pivotIdx];
      const fromKey    = buildKey(prevKeyRoot, prevKeyQuality, preferFlats);
      const toKey      = topKey;

      const pivotDegFrom = getDegreeInKey(pivotChord.root, fromKey);
      const pivotDegTo   = getDegreeInKey(pivotChord.root, toKey);
      const type = (pivotDegFrom && pivotDegTo) ? 'pivot' : 'chromatic';

      const lastMod = results[results.length - 1];
      if (!lastMod || pivotIdx - lastMod.pivotIdx >= 2) {
        results.push({
          fromKey, toKey, pivotIdx,
          pivotChord: pivotChord.name, type,
          pivotDegreeInOldKey: pivotDegFrom,
          pivotDegreeInNewKey: pivotDegTo,
        });
      }

      prevKeyRoot    = toKey.root;
      prevKeyQuality = toKey.quality;
      candidateRoot = candidateQuality = null;
      candidateFirstIdx = -1;
    } else {
      // First window suggesting a new key — start tracking it as a candidate
      candidateRoot     = topKey.root;
      candidateQuality  = topKey.quality;
      candidateFirstIdx = i;
    }
  }

  return results;
}

/**
 * Return a Roman numeral string for a chord relative to a key,
 * including chromatic accidentals (♭/♯) for non-diatonic roots.
 * @param {number} chordRoot    0–11
 * @param {string} chordQuality key of CHORD_SUFFIXES
 * @param {object} key          active key object (has .root)
 * @returns {string}  e.g. "I", "ii", "♭VII", "♯IV"
 */
export function getChordNumeral(chordRoot, chordQuality, key) {
  const INTERVAL_MAP = [
    { degree: 1, acc: ''  }, // 0  — unison
    { degree: 2, acc: '♭' }, // 1  — ♭2
    { degree: 2, acc: ''  }, // 2  — 2
    { degree: 3, acc: '♭' }, // 3  — ♭3
    { degree: 3, acc: ''  }, // 4  — 3
    { degree: 4, acc: ''  }, // 5  — 4
    { degree: 4, acc: '♯' }, // 6  — ♯4/♭5
    { degree: 5, acc: ''  }, // 7  — 5
    { degree: 6, acc: '♭' }, // 8  — ♭6
    { degree: 6, acc: ''  }, // 9  — 6
    { degree: 7, acc: '♭' }, // 10 — ♭7
    { degree: 7, acc: ''  }, // 11 — 7
  ];
  const interval = normalizePitch(chordRoot - key.root);
  const { degree, acc } = INTERVAL_MAP[interval];
  const upper = ['I','II','III','IV','V','VI','VII'][degree - 1];
  const isUpper = ['maj','aug','dom7','dom9','dom7b9','dom7s9','dom7b5','dom7s11',
                   'maj7','maj7s11','maj6','maj6add9','maj9','maj13','augmaj7',
                   'sus2','sus4','dom7sus4','dom9sus4','dom13sus4','pow5',
                   'dom7b13','dom7b9sus4','dom13','add9',
                   ].includes(chordQuality);
  let numeral = isUpper ? upper : upper.toLowerCase();
  if (chordQuality === 'dim' || chordQuality === 'dim7') numeral += '°';
  else if (chordQuality === 'aug' || chordQuality === 'augmaj7') numeral += '+';
  else if (chordQuality === 'hdim7') numeral += 'ø';
  return acc + numeral;
}

/**
 * Map a diatonic triad quality to its 7th-chord quality.
 * Returns null for qualities with no clean 7th in the basic palette (e.g. aug).
 */
function _triad7Quality(triadQuality, degree, keyQuality) {
  if (triadQuality === 'maj') return (degree === 5 && keyQuality === 'major') ? 'dom7' : 'maj7';
  if (triadQuality === 'min') return 'min7';
  if (triadQuality === 'dim') return 'hdim7';
  return null;
}

// ─── Chord transition probability tables ─────────────────────────────────────
// For each scale degree (1-7), lists the most natural *next* degrees in order.
// Used to sort diatonic suggestions based on the current chord context.
const NEXT_DEGREE_ORDER = {
  major: {
    1: [5, 4, 6, 2, 3, 7],   // I  → V IV vi ii iii vii
    2: [5, 7, 4, 1, 6, 3],   // ii → V vii IV I vi iii
    3: [4, 6, 2, 1, 5, 7],   // iii→ IV vi ii I V vii
    4: [5, 1, 2, 6, 3, 7],   // IV → V I ii vi iii vii
    5: [1, 6, 4, 3, 2, 7],   // V  → I vi IV iii ii vii
    6: [2, 4, 5, 1, 3, 7],   // vi → ii IV V I iii vii
    7: [1, 3, 6, 2, 4, 5],   // vii→ I iii vi ii IV V
  },
  minor: {
    1: [7, 6, 4, 5, 2, 3],   // i   → VII VI iv V ii° III
    2: [5, 1, 7, 4, 6, 3],   // ii° → V i VII iv VI III
    3: [6, 7, 4, 1, 2, 5],   // III → VI VII iv i ii° V
    4: [5, 1, 7, 6, 2, 3],   // iv  → V i VII VI ii° III
    5: [1, 6, 4, 7, 3, 2],   // V/v → i VI iv VII III ii°
    6: [3, 4, 7, 2, 5, 1],   // VI  → III iv VII ii° V i
    7: [1, 3, 6, 4, 5, 2],   // VII → i III VI iv V ii°
  },
  dorian: {
    1: [4, 7, 5, 2, 3, 6],   // i   → IV ♭VII v ii ♭III vi°
    2: [5, 1, 4, 7, 3, 6],   // ii  → v i IV ♭VII ♭III vi°
    3: [4, 7, 6, 1, 2, 5],   // ♭III→ IV ♭VII vi° i ii v
    4: [1, 7, 5, 2, 3, 6],   // IV  → i ♭VII v ii ♭III vi°
    5: [1, 4, 7, 2, 3, 6],   // v   → i IV ♭VII ii ♭III vi°
    6: [3, 7, 4, 2, 5, 1],   // vi° → ♭III ♭VII IV ii v i
    7: [4, 1, 2, 3, 5, 6],   // ♭VII→ IV i ii ♭III v vi°
  },
  mixolydian: {
    1: [7, 4, 5, 2, 6, 3],   // I   → ♭VII IV v ii vi iii°
    2: [5, 1, 7, 4, 6, 3],   // ii  → v I ♭VII IV vi iii°
    3: [4, 7, 1, 2, 6, 5],   // iii°→ IV ♭VII I ii vi v
    4: [1, 7, 5, 2, 6, 3],   // IV  → I ♭VII v ii vi iii°
    5: [1, 7, 4, 2, 6, 3],   // v   → I ♭VII IV ii vi iii°
    6: [2, 4, 7, 5, 1, 3],   // vi  → ii IV ♭VII v I iii°
    7: [1, 4, 2, 6, 5, 3],   // ♭VII→ I IV ii vi v iii°
  },
  phrygian: {
    1: [2, 7, 3, 4, 6, 5],   // i   → ♭II ♭vii ♭III iv ♭VI v°
    2: [1, 7, 6, 3, 4, 5],   // ♭II → i ♭vii ♭VI ♭III iv v°
    3: [6, 7, 4, 2, 1, 5],   // ♭III→ ♭VI ♭vii iv ♭II i v°
    4: [5, 1, 7, 2, 3, 6],   // iv  → v° i ♭vii ♭II ♭III ♭VI
    5: [1, 2, 7, 6, 3, 4],   // v°  → i ♭II ♭vii ♭VI ♭III iv
    6: [3, 7, 2, 4, 1, 5],   // ♭VI → ♭III ♭vii ♭II iv i v°
    7: [1, 2, 3, 6, 4, 5],   // ♭vii→ i ♭II ♭III ♭VI iv v°
  },
  lydian: {
    1: [2, 5, 6, 3, 7, 4],   // I   → II V vi iii vii ♯iv°
    2: [1, 5, 6, 3, 7, 4],   // II  → I V vi iii vii ♯iv°
    3: [6, 2, 4, 1, 5, 7],   // iii → vi II ♯iv° I V vii
    4: [5, 2, 1, 6, 3, 7],   // ♯iv°→ V II I vi iii vii
    5: [1, 6, 2, 3, 7, 4],   // V   → I vi II iii vii ♯iv°
    6: [2, 3, 7, 5, 1, 4],   // vi  → II iii vii V I ♯iv°
    7: [1, 6, 2, 3, 5, 4],   // vii → I vi II iii V ♯iv°
  },
};

/**
 * Suggest chords to add to a progression based on music theory.
 * @param {object}      activeKey   - key object from buildKey()
 * @param {object[]}    progression - current chord objects
 * @param {object|null} lastChord   - the chord currently on the fretboard (context for suggestions)
 * @returns {{ root, quality, name, reason, category, fit, transitionScore }[]} up to 20 suggestions
 */
export function getChordIdeas(activeKey, progression, lastChord = null) {
  if (!activeKey) return [];

  // For modal keys, delegate borrowed/sus/extended logic to the parent quality
  const effectiveQ = activeKey.quality === 'major' || activeKey.quality === 'minor'
    ? activeKey.quality
    : (MODAL_PARENT[activeKey.quality] ?? 'major');

  const suggestions = [];
  const progressionRoots = new Set(progression.map(c => normalizePitch(c.root)));
  const seen = new Set();

  function addIdea(root, quality, reason, category, fit = 'yellow') {
    root = normalizePitch(root);
    const key = `${root}-${quality}`;
    if (seen.has(key)) return;
    // Filter only on exact root+quality match (diatonic chords always shown regardless of progression)
    if (category !== 'diatonic' && progressionRoots.has(root) &&
        progression.some(c => normalizePitch(c.root) === root && c.quality === quality)) return;
    seen.add(key);
    const rootNote = pitchToNoteInKey(root, activeKey.root);
    const name = rootNote + (CHORD_SUFFIXES[quality] ?? quality);
    suggestions.push({ root, quality, name, reason, category, fit });
  }

  // ── Unused diatonic triads ─────────────────────────────────────────────────
  for (const dc of activeKey.diatonicChords) {
    addIdea(dc.root, dc.quality,
      `${dc.numeral} — diatonic (${dc.functionLabel ?? ''})`,
      'diatonic', 'green');
  }

  // ── Diatonic 7th chords ────────────────────────────────────────────────────
  const suffix7Map = { maj7: 'maj7', dom7: '7', min7: '7', hdim7: 'm7(♭5)' };
  for (const dc of activeKey.diatonicChords) {
    const q7 = _triad7Quality(dc.quality, dc.degree, activeKey.quality);
    if (!q7) continue;
    // Strip trailing °/+ from triad numeral so "vii°" + "ø7" → "viiø7"
    const base7 = dc.numeral.replace(/[°+]$/, '');
    const numeral7 = base7 + (suffix7Map[q7] ?? '7');
    addIdea(dc.root, q7,
      `${numeral7} — diatonic 7th, adds color within the key`,
      'diatonic7', 'green');
  }

  // ── Secondary dominants: V7 of each non-tonic diatonic chord ─────────────
  for (const dc of activeKey.diatonicChords) {
    if (dc.degree === 1) continue;
    const secDomRoot = normalizePitch(dc.root + 7);
    addIdea(secDomRoot, 'dom7',
      `V7 of ${dc.name} — secondary dominant`,
      'secondary', 'yellow');
  }

  // ── Borrowed chords from parallel minor (major/Lydian/Mixolydian keys) ─────
  if (effectiveQ === 'major') {
    const pm = generateScale(activeKey.root, 'natural_minor');
    addIdea(pm[6], 'maj', `Borrowed ♭VII from ${activeKey.parallelMinorName} — dark, powerful`,     'borrowed', 'yellow');
    addIdea(pm[5], 'maj', `Borrowed ♭VI from ${activeKey.parallelMinorName} — dramatic`,            'borrowed', 'yellow');
    addIdea(pm[2], 'maj', `Borrowed ♭III from ${activeKey.parallelMinorName} — bluesy lift`,        'borrowed', 'yellow');
    addIdea(pm[3], 'min', `Borrowed iv from ${activeKey.parallelMinorName} — soulful minor IV`,     'borrowed', 'yellow');
  }

  // ── Borrowed chords from parallel major (minor/Dorian/Phrygian keys) ──────
  if (effectiveQ === 'minor') {
    const pM = generateScale(activeKey.root, 'major');
    addIdea(pM[3], 'maj', `Borrowed IV from ${activeKey.parallelMajorName} — bright lift`,          'borrowed', 'yellow');
    if (activeKey.harmonicV) {
      addIdea(activeKey.harmonicV.root, 'maj', `Major V from harmonic minor — strong cadence`,      'borrowed', 'yellow');
    }
    addIdea(pM[6], 'maj', `Borrowed ♭VII from ${activeKey.parallelMajorName} — bright rock sound`, 'borrowed', 'yellow');
  }

  // ── Harmonic minor extras (minor-parent keys) ─────────────────────────────
  if (effectiveQ === 'minor') {
    addIdea(normalizePitch(activeKey.root + 11), 'dim7',
      `vii°7 from harmonic minor — leading-tone fully-diminished, maximum tension into i`,          'harmonic', 'yellow');
    addIdea(normalizePitch(activeKey.root + 10), 'dom7',
      `♭VII7 backdoor dominant — approaches i from below, classic rock & jazz device`,             'harmonic', 'yellow');
    addIdea(normalizePitch(activeKey.root + 3), 'aug',
      `♭IIIaug from harmonic minor — augmented mediant, eerie and cinematic`,                       'harmonic', 'yellow');
  }

  // ── Circle of fifths neighbors ─────────────────────────────────────────────
  const circlePos       = activeKey.circlePos;
  const dominantKeyRoot = FIFTHS_ORDER[(circlePos + 1) % 12];
  const subdomKeyRoot   = FIFTHS_ORDER[(circlePos + 11) % 12];
  addIdea(dominantKeyRoot, 'maj', `V of V — builds tension toward dominant`, 'circle', 'yellow');
  addIdea(subdomKeyRoot,   'maj', `IV of IV — double subdominant motion`,    'circle', 'yellow');

  // ── Power chords (5 chords) on diatonic roots ─────────────────────────────
  for (const dc of activeKey.diatonicChords) {
    addIdea(dc.root, 'pow5',
      `${dc.numeral}5 — power chord on ${dc.functionLabel ?? 'diatonic'} root`,
      'power', 'green');
  }
  // Extra ♭VII5 power chord (common in rock regardless of key)
  addIdea(normalizePitch(activeKey.root + 10), 'pow5',
    `♭VII5 — classic rock power chord, dark energy`,
    'power', 'yellow');
  // IV5 / I5 / V5 chromatic power chords common in metal/punk
  addIdea(normalizePitch(activeKey.root + 1), 'pow5',
    `♭II5 — Phrygian power chord, heavy and aggressive`,
    'power', 'red');

  // ── Modal characteristic chords ───────────────────────────────────────────
  if (activeKey.quality === 'dorian') {
    addIdea(normalizePitch(activeKey.root + 5), 'min',
      'iv — borrowed from Aeolian; swapping Dorian\'s major IV for minor iv darkens the sound',
      'modal', 'yellow');
  }
  if (activeKey.quality === 'mixolydian') {
    addIdea(normalizePitch(activeKey.root + 7), 'maj',
      'Major V — borrowed from Ionian; Mixolydian\'s own v is minor (no leading tone). Use for a strong resolution.',
      'modal', 'yellow');
  }
  if (activeKey.quality === 'phrygian') {
    addIdea(normalizePitch(activeKey.root + 6), 'maj',
      '♭V area — tritone away from tonic. Extreme tension that complements the dark Phrygian sound.',
      'modal', 'red');
  }
  if (activeKey.quality === 'lydian') {
    addIdea(normalizePitch(activeKey.root + 10), 'maj',
      '♭VII — borrowed from Mixolydian; modal mixture that grounds the floating Lydian brightness',
      'modal', 'yellow');
  }

  // ── Suspended chords ───────────────────────────────────────────────────────
  if (effectiveQ === 'major') {
    addIdea(activeKey.root,                     'sus4',     `Isus4 — suspends the tonic, creates anticipation before resolving`,  'sus', 'yellow');
    addIdea(activeKey.root,                     'sus2',     `Isus2 — open, floating tonic ambiguity`,                             'sus', 'yellow');
    addIdea(normalizePitch(activeKey.root + 5), 'sus4',     `IVsus4 — adds lift and forward momentum`,                           'sus', 'yellow');
    addIdea(normalizePitch(activeKey.root + 7), 'sus4',     `Vsus4 — classic suspension resolving to V`,                         'sus', 'yellow');
    addIdea(normalizePitch(activeKey.root + 7), 'sus2',     `Vsus2 — airy dominant color, unresolved feeling`,                   'sus', 'yellow');
    addIdea(normalizePitch(activeKey.root + 7), 'dom7sus4',  `V7sus4 — jazz/soul suspended dominant, floats before resolving`,   'sus', 'yellow');
    addIdea(normalizePitch(activeKey.root + 7), 'dom9sus4',  `V9sus4 — suspended dominant with 9th, soulful float`,              'sus', 'yellow');
    addIdea(normalizePitch(activeKey.root + 7), 'dom13sus4', `V13sus4 — suspended dominant with 13th, full jazz sus`,            'sus', 'yellow');
  }
  if (effectiveQ === 'minor') {
    addIdea(activeKey.root,                     'sus4',      `isus4 — suspended minor tonic, builds tension before resolving to i`, 'sus', 'yellow');
    addIdea(activeKey.root,                     'sus2',      `isus2 — open, melancholic ambiguity on the tonic`,                   'sus', 'yellow');
    addIdea(normalizePitch(activeKey.root + 7), 'sus4',      `vsus4 — suspended minor dominant`,                                   'sus', 'yellow');
    addIdea(normalizePitch(activeKey.root + 7), 'dom7sus4',  `v7sus4 — suspended minor dominant 7th, jazz/soul float`,             'sus', 'yellow');
    addIdea(normalizePitch(activeKey.root + 7), 'dom9sus4',  `v9sus4 — suspended minor dominant with 9th`,                        'sus', 'yellow');
    addIdea(normalizePitch(activeKey.root + 5), 'sus2',      `ivsus2 — airy IV-area color`,                                        'sus', 'yellow');
  }

  // ── Add9 chords ────────────────────────────────────────────────────────────
  // add9 enriches the tonic, IV, and V with a 9th — keeps the open-string sparkle
  addIdea(activeKey.root,                     'add9', `Iadd9 / iadd9 — tonic with added 9th, bright sparkle`, 'add9', 'green');
  addIdea(normalizePitch(activeKey.root + 5), 'add9', `IVadd9 — lush subdominant colour`,                    'add9', 'green');
  addIdea(normalizePitch(activeKey.root + 7), 'add9', `Vadd9 — add9 dominant, open and airy`,                'add9', 'yellow');

  // ── Extended 9th chords ────────────────────────────────────────────────────
  if (effectiveQ === 'major') {
    addIdea(activeKey.root,                     'maj9',    `Imaj9 — lush tonic with 9th, jazz/funk sparkle`,      'extended', 'green');
    addIdea(normalizePitch(activeKey.root + 5), 'maj9',    `IVmaj9 — floating subdominant with 9th`,              'extended', 'green');
    addIdea(normalizePitch(activeKey.root + 9), 'min9',    `vim9 — rich minor-6th chord, tonic substitute`,       'extended', 'green');
    addIdea(activeKey.root,                     'maj6add9',`I6/9 — lush major with 6th & 9th, no 7th; classic jazz comping`, 'extended', 'green');
    addIdea(activeKey.root,                     'maj13',   `Imaj13 — richest major extension, full jazz colour`,  'extended', 'green');
    addIdea(normalizePitch(activeKey.root + 5), 'maj13',   `IVmaj13 — lush subdominant with 13th`,                'extended', 'green');
    addIdea(normalizePitch(activeKey.root + 7), 'dom13',   `V13 — classic jazz dominant with 13th`,               'extended', 'yellow');
    addIdea(activeKey.root,                     'maj7s11', `Imaj7♯11 — Lydian major, bright and modern`,          'extended', 'yellow');
    addIdea(activeKey.root,                     'augmaj7', `Imaj7#5 — augmented major 7th, dreamy tension`,       'extended', 'yellow');
  }
  if (effectiveQ === 'minor') {
    addIdea(activeKey.root,                     'min9',    `im9 — smooth minor tonic with 9th`,                   'extended', 'green');
    addIdea(normalizePitch(activeKey.root + 5), 'min9',    `ivm9 — lush minor subdominant with 9th`,              'extended', 'green');
    addIdea(activeKey.root,                     'min11',   `im11 — lush minor tonic with 11th`,                   'extended', 'green');
    addIdea(normalizePitch(activeKey.root + 5), 'min11',   `ivm11 — minor subdominant with 11th`,                 'extended', 'green');
    addIdea(activeKey.root,                     'minmaj9', `imMaj9 — minor/major 9th, cinematic jazz tension`,    'extended', 'yellow');
    addIdea(normalizePitch(activeKey.root + 7), 'dom13',   `V13 — dominant 13th, jazz resolution into i`,        'extended', 'yellow');
    addIdea(normalizePitch(activeKey.root + 3), 'maj9',    `♭IIImaj9 — borrowed major 9th, warm colour`,         'extended', 'yellow');
  }

  // ── Altered dominants (jazz V-chord colours) ──────────────────────────────
  const domRoot = normalizePitch(activeKey.root + 7);
  addIdea(domRoot, 'dom7b9',  `V7♭9 — classic jazz dominant, strong resolution pull to I`,    'altered', 'yellow');
  addIdea(domRoot, 'dom7s9',  `V7♯9 — "Hendrix chord", blues-rock dominant tension`,          'altered', 'yellow');
  addIdea(domRoot, 'dom7b5',  `V7♭5 — tritone-tinged dominant, smooth bass motion into I`,    'altered', 'yellow');
  addIdea(domRoot, 'dom7s11', `V7♯11 — Lydian dominant, sophisticated modern jazz colour`,    'altered', 'yellow');
  addIdea(domRoot, 'dom7b13',    `V7b13 — flat-13 altered dominant, dark chromatic colour`,       'altered', 'yellow');
  addIdea(domRoot, 'dom7b9sus4', `V7b9sus4 — suspended altered dominant, jazz tension cadence`,  'altered', 'yellow');
  // Altered secondary dominant of IV
  addIdea(normalizePitch(activeKey.root + 11), 'dom7b9',
    `VII7♭9 — altered secondary dominant of IV, strong pull`,                                  'altered', 'yellow');

  // ── Chromatic color chords ─────────────────────────────────────────────────
  if (effectiveQ === 'major') {
    addIdea(normalizePitch(activeKey.root + 4), 'maj',
      `Chromatic mediant III — major 3rd up, striking modal shift`,                                 'chromatic', 'red');
    addIdea(normalizePitch(activeKey.root + 9), 'maj',
      `Chromatic mediant VI — parallel major color, bright surprise`,                               'chromatic', 'red');
  }
  if (effectiveQ === 'minor') {
    addIdea(normalizePitch(activeKey.root + 2), 'maj',
      `Chromatic supertonic II — raw modal intensity, Phrygian-adjacent`,                           'chromatic', 'red');
  }

  // Tritone substitution (both keys)
  const tritoneSubRoot = normalizePitch(activeKey.dominantRoot + 6);
  addIdea(tritoneSubRoot, 'dom7',
    `Tritone sub ♭II7 — swaps with V7, smooth chromatic bass motion into I`,                       'chromatic', 'red');

  // ── Sort diatonic suggestions by transition probability ───────────────────
  // Compute how naturally each suggestion follows from lastChord using the
  // degree-transition table.  Non-diatonic categories keep their original order.
  const lastDegree = lastChord ? getDegreeInKey(lastChord.root, activeKey) : null;
  const nextOrder  = lastDegree
    ? (NEXT_DEGREE_ORDER[activeKey.quality]?.[lastDegree] ?? [])
    : [];

  for (const s of suggestions) {
    const ideaDegree = getDegreeInKey(s.root, activeKey);
    const pos = ideaDegree !== null ? nextOrder.indexOf(ideaDegree) : -1;
    s.transitionScore = pos === -1 ? 0 : (nextOrder.length - pos); // higher = better
  }

  // Re-sort the diatonic bucket by transitionScore (others keep insertion order)
  const diatonic = suggestions.filter(s => s.category === 'diatonic')
    .sort((a, b) => b.transitionScore - a.transitionScore);
  const rest = suggestions.filter(s => s.category !== 'diatonic');

  return [...diatonic, ...rest].slice(0, 80);
}
