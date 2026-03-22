/**
 * Cadence Detection Module
 * Identifies cadence patterns (Authentic, Plagal, Deceptive, Half) in chord progressions.
 */

import { getDegreeInKey } from './keys.js';
import { normalizePitch } from './notes.js';

/**
 * Cadence types with descriptions
 */
export const CADENCE_TYPES = {
  PAC: {
    abbr: 'AC',
    name: 'Authentic Cadence',
    description: 'V → I — the strongest resolution in music, like a period at the end of a sentence. The leading tone resolves up to the tonic.',
  },
  IAC: {
    abbr: 'AC',
    name: 'Authentic Cadence',
    description: 'V → I — a clear resolution to the tonic. The dominant\'s tension resolves home.',
  },
  HC: {
    abbr: 'HC',
    name: 'Half Cadence',
    description: 'Ending on V — feels unfinished, like a comma or question mark. Creates expectation for what comes next.',
  },
  PC: {
    abbr: 'PC',
    name: 'Plagal Cadence',
    description: 'IV → I — the "Amen" cadence, softer than authentic. Common in hymns, blues, and rock.',
  },
  DC: {
    abbr: 'DC',
    name: 'Deceptive Cadence',
    description: 'V → vi — you expect resolution to I, but land on vi instead. A beautiful harmonic surprise.',
  },
};

/**
 * Detect cadences in a chord progression.
 * @param {object[]} progression - array of chord objects with .root and .quality
 * @param {object}   key         - key object from buildKey()
 * @returns {CadenceResult[]} array of { idx, type, typeKey, chordA, chordB, description }
 *   idx = index of the SECOND chord in the cadence pair (the resolution target)
 */
export function detectCadences(progression, key) {
  if (!key || !progression || progression.length < 2) return [];

  const results = [];

  for (let i = 1; i < progression.length; i++) {
    const chordA = progression[i - 1];
    const chordB = progression[i];
    if (!chordA || !chordB) continue;

    const degA = getDegreeInKey(chordA.root, key);
    const degB = getDegreeInKey(chordB.root, key);

    // Also check harmonic minor V (major V chord in minor key)
    const isVChord = (degA === 5) ||
      (key.harmonicV && normalizePitch(chordA.root) === normalizePitch(key.harmonicV.root) &&
       ['maj', 'dom7', 'dom9', 'dom13', 'dom7b9', 'dom7s9', 'dom7b5', 'dom7s11', 'dom7b13', 'dom7sus4'].includes(chordA.quality));

    // Authentic Cadence: V → I (includes V7 → I, any dominant-quality → I)
    if (isVChord && degB === 1) {
      results.push({
        idx: i,
        typeKey: 'PAC',
        type: CADENCE_TYPES.PAC,
        chordA: chordA.name,
        chordB: chordB.name,
      });
      continue;
    }

    // Deceptive Cadence: V → vi (in major) or V → VI (in minor)
    if (isVChord && degB === 6) {
      results.push({
        idx: i,
        typeKey: 'DC',
        type: CADENCE_TYPES.DC,
        chordA: chordA.name,
        chordB: chordB.name,
      });
      continue;
    }

    // Plagal Cadence: IV → I (or iv → i)
    if (degA === 4 && degB === 1) {
      results.push({
        idx: i,
        typeKey: 'PC',
        type: CADENCE_TYPES.PC,
        chordA: chordA.name,
        chordB: chordB.name,
      });
      continue;
    }
  }

  // Half Cadence: progression ends on V (or last chord in any section boundary is V)
  const lastChord = progression[progression.length - 1];
  if (lastChord) {
    const lastDeg = getDegreeInKey(lastChord.root, key);
    const isLastV = (lastDeg === 5) ||
      (key.harmonicV && normalizePitch(lastChord.root) === normalizePitch(key.harmonicV.root) &&
       ['maj', 'dom7', 'dom9', 'dom7sus4'].includes(lastChord.quality));

    if (isLastV) {
      results.push({
        idx: progression.length - 1,
        typeKey: 'HC',
        type: CADENCE_TYPES.HC,
        chordA: progression.length >= 2 ? progression[progression.length - 2].name : '?',
        chordB: lastChord.name,
      });
    }
  }

  // Also detect section-boundary half cadences: if chord before a section change is V
  for (let i = 0; i < progression.length - 1; i++) {
    if (progression[i].section !== progression[i + 1].section) {
      const chord = progression[i];
      const deg = getDegreeInKey(chord.root, key);
      const isV = (deg === 5) ||
        (key.harmonicV && normalizePitch(chord.root) === normalizePitch(key.harmonicV.root) &&
         ['maj', 'dom7'].includes(chord.quality));
      if (isV && !results.some(r => r.idx === i && r.typeKey === 'HC')) {
        results.push({
          idx: i,
          typeKey: 'HC',
          type: CADENCE_TYPES.HC,
          chordA: i > 0 ? progression[i - 1].name : '?',
          chordB: chord.name,
          isSectionBoundary: true,
        });
      }
    }
  }

  return results;
}
