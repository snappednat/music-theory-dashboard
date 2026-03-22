/**
 * Named Progression Pattern Recognition
 * Detects common chord progressions and provides templates.
 */

import { getDegreeInKey } from './keys.js';
import { normalizePitch } from './notes.js';

/**
 * Named progression patterns.
 * Each pattern has degrees (1-7), mode context, and metadata.
 * For minor patterns, degrees refer to natural minor scale degrees.
 */
export const NAMED_PROGRESSIONS = [
  // ── Pop / Rock ──────────────────────────────────────────────
  {
    name: 'Best-Seller / Axis',
    degrees: [1, 5, 6, 4],
    mode: 'major',
    genre: 'Pop',
    examples: ['Let It Be', 'No Woman No Cry', 'Someone Like You'],
    description: 'The most common pop progression. Creates a satisfying loop of tension and release.',
  },
  {
    name: '50s / Doo-Wop',
    degrees: [1, 6, 4, 5],
    mode: 'major',
    genre: 'Pop/Rock',
    examples: ['Stand By Me', 'Every Breath You Take', 'Earth Angel'],
    description: 'Classic 1950s progression. The minor vi gives it a bittersweet quality.',
  },
  {
    name: 'Sensitive Female',
    degrees: [6, 4, 1, 5],
    mode: 'major',
    genre: 'Pop',
    examples: ['Save Tonight', 'One of Us', 'Zombie'],
    description: 'Starts on the vi for a minor feel in a major key. Moody and introspective.',
  },
  {
    name: 'Pop-Punk',
    degrees: [1, 5, 6, 4],
    mode: 'major',
    genre: 'Pop-Punk/Rock',
    examples: ['Basket Case', 'Self Esteem'],
    description: 'Same as Best-Seller but typically played with power chords and higher energy.',
  },
  {
    name: 'Pachelbel Canon',
    degrees: [1, 5, 6, 3, 4, 1, 4, 5],
    mode: 'major',
    genre: 'Classical/Pop',
    examples: ['Canon in D', 'Memories', 'Graduation'],
    description: 'Descending bass line pattern from Baroque era, still popular today.',
  },
  {
    name: 'I-IV-V Rock',
    degrees: [1, 4, 5],
    mode: 'major',
    genre: 'Rock/Blues',
    examples: ['Twist and Shout', 'La Bamba', 'Wild Thing'],
    description: 'The three most fundamental chords in any key. Pure rock and roll.',
  },
  {
    name: 'I-IV Shuttle',
    degrees: [1, 4],
    mode: 'major',
    genre: 'Rock/Folk',
    examples: ['Born in the USA', 'Stir It Up'],
    description: 'Two-chord vamp between tonic and subdominant. Hypnotic and driving.',
  },

  // ── Jazz ────────────────────────────────────────────────────
  {
    name: 'ii-V-I',
    degrees: [2, 5, 1],
    mode: 'major',
    genre: 'Jazz',
    examples: ['Take the A Train', 'Fly Me to the Moon', 'Autumn Leaves'],
    description: 'The most important progression in jazz. Pre-dominant to dominant to tonic.',
  },
  {
    name: 'I-vi-ii-V (Turnaround)',
    degrees: [1, 6, 2, 5],
    mode: 'major',
    genre: 'Jazz',
    examples: ['I Got Rhythm', 'Heart and Soul', 'Blue Moon'],
    description: 'Classic jazz turnaround. Circle-of-fifths motion back to the tonic.',
  },

  // ── Minor Key ───────────────────────────────────────────────
  {
    name: 'Andalusian Cadence',
    degrees: [1, 7, 6, 5],
    mode: 'minor',
    genre: 'Flamenco/Rock',
    examples: ['Hit the Road Jack', 'Stairway to Heaven (intro)', 'Smooth'],
    description: 'Descending bass from tonic to dominant. Spanish/flamenco flavour.',
  },
  {
    name: 'i-VII-VI-VII',
    degrees: [1, 7, 6, 7],
    mode: 'minor',
    genre: 'Rock/Metal',
    examples: ['Stairway to Heaven', 'All Along the Watchtower'],
    description: 'Minor key oscillation using the subtonic VII. Dark and driving.',
  },
  {
    name: 'i-iv-v',
    degrees: [1, 4, 5],
    mode: 'minor',
    genre: 'Minor Blues',
    examples: ['The Thrill Is Gone'],
    description: 'Minor key version of the fundamental three-chord progression.',
  },
  {
    name: 'i-VI-III-VII',
    degrees: [1, 6, 3, 7],
    mode: 'minor',
    genre: 'Pop/Rock',
    examples: ['Mad World', 'Radioactive'],
    description: 'Minor progression using all major borrowed chords. Anthemic and cinematic.',
  },

  // ── Blues ────────────────────────────────────────────────────
  {
    name: '12-Bar Blues',
    degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5],
    mode: 'major',
    genre: 'Blues',
    examples: ['Sweet Home Chicago', 'Hound Dog', 'Johnny B. Goode'],
    description: 'The foundation of blues, rock, and jazz. 12 bars of I, IV, and V.',
  },

  // ── Classical / Extended ────────────────────────────────────
  {
    name: 'Circle of Fifths',
    degrees: [1, 4, 7, 3, 6, 2, 5, 1],
    mode: 'major',
    genre: 'Classical/Jazz',
    examples: ['Fly Me to the Moon', 'I Will Survive', 'Autumn Leaves'],
    description: 'Each chord root descends a fifth. Baroque staple, still used in jazz.',
  },
  {
    name: 'Royal Road',
    degrees: [4, 5, 3, 6],
    mode: 'major',
    genre: 'J-Pop/Anime',
    examples: ['Various anime themes'],
    description: 'IV-V-iii-vi. Popular in Japanese pop music. Emotional and bittersweet.',
  },
];

/**
 * Detect named patterns in a chord progression.
 * @param {object[]} progression - chord objects with .root, .quality
 * @param {object}   key         - key object from buildKey()
 * @returns {PatternMatch[]} array of { pattern, startIdx, endIdx, isExact }
 */
export function detectPatterns(progression, key) {
  if (!key || !progression || progression.length < 2) return [];

  // Convert progression to degree sequence
  const degrees = progression.map(chord => {
    if (!chord) return null;
    return getDegreeInKey(chord.root, key);
  });

  const matches = [];
  const seen = new Set(); // prevent duplicate pattern matches

  for (const pattern of NAMED_PROGRESSIONS) {
    // Skip patterns that require a different mode
    if (pattern.mode === 'major' && key.quality !== 'major') continue;
    if (pattern.mode === 'minor' && key.quality !== 'minor') continue;

    const pLen = pattern.degrees.length;
    if (pLen > degrees.length) continue;

    // Slide window
    for (let start = 0; start <= degrees.length - pLen; start++) {
      let match = true;
      for (let j = 0; j < pLen; j++) {
        if (degrees[start + j] !== pattern.degrees[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        const matchKey = `${pattern.name}-${start}`;
        if (!seen.has(matchKey)) {
          seen.add(matchKey);
          matches.push({
            pattern,
            startIdx: start,
            endIdx: start + pLen - 1,
            isExact: start === 0 && pLen === degrees.length,
          });
        }
      }
    }

    // Also check for rotations (the same progression starting at a different point)
    if (pLen <= degrees.length && pLen >= 3) {
      for (let rot = 1; rot < pLen; rot++) {
        const rotated = [...pattern.degrees.slice(rot), ...pattern.degrees.slice(0, rot)];
        for (let start = 0; start <= degrees.length - pLen; start++) {
          let match = true;
          for (let j = 0; j < pLen; j++) {
            if (degrees[start + j] !== rotated[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            const matchKey = `${pattern.name}-rot${rot}-${start}`;
            if (!seen.has(matchKey)) {
              seen.add(matchKey);
              matches.push({
                pattern,
                startIdx: start,
                endIdx: start + pLen - 1,
                isExact: false,
                rotation: rot,
              });
            }
          }
        }
      }
    }
  }

  // Sort: exact matches first, then by pattern length (longer = more specific)
  matches.sort((a, b) => {
    if (a.isExact !== b.isExact) return b.isExact - a.isExact;
    return b.pattern.degrees.length - a.pattern.degrees.length;
  });

  return matches;
}
