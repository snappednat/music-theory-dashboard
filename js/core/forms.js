/**
 * Song Form Templates
 * Pre-built chord progression templates for common song structures.
 */

import { buildKey } from './keys.js';
import { buildChord, CHORD_SUFFIXES } from './chords.js';
import { pitchToNoteInKey, normalizePitch } from './notes.js';

/**
 * Song form templates.
 * degrees use 1-7 for scale degrees.
 * quality overrides: if not specified, uses the diatonic chord quality for that degree.
 */
export const SONG_FORMS = [
  {
    key: '12-bar-blues',
    name: '12-Bar Blues',
    genre: 'Blues',
    sections: [
      { name: 'verse', degrees: [
        { deg: 1 }, { deg: 1 }, { deg: 1 }, { deg: 1 },
        { deg: 4 }, { deg: 4 }, { deg: 1 }, { deg: 1 },
        { deg: 5 }, { deg: 4 }, { deg: 1 }, { deg: 5 },
      ]},
    ],
  },
  {
    key: 'pop-verse-chorus',
    name: 'Pop Verse-Chorus',
    genre: 'Pop',
    sections: [
      { name: 'verse', degrees: [{ deg: 1 }, { deg: 5 }, { deg: 6 }, { deg: 4 }] },
      { name: 'chorus', degrees: [{ deg: 4 }, { deg: 1 }, { deg: 5 }, { deg: 6 }] },
    ],
  },
  {
    key: 'jazz-ii-v-i',
    name: 'Jazz ii-V-I Turnaround',
    genre: 'Jazz',
    sections: [
      { name: 'verse', degrees: [
        { deg: 2, quality: 'min7' }, { deg: 5, quality: 'dom7' },
        { deg: 1, quality: 'maj7' }, { deg: 1, quality: 'maj7' },
      ]},
    ],
  },
  {
    key: '50s-doo-wop',
    name: '50s Doo-Wop',
    genre: 'Pop/Rock',
    sections: [
      { name: 'verse', degrees: [{ deg: 1 }, { deg: 6 }, { deg: 4 }, { deg: 5 }] },
    ],
  },
  {
    key: 'andalusian',
    name: 'Andalusian Cadence',
    genre: 'Flamenco/Rock',
    mode: 'minor',
    sections: [
      { name: 'verse', degrees: [{ deg: 1 }, { deg: 7 }, { deg: 6 }, { deg: 5, quality: 'maj' }] },
    ],
  },
  {
    key: 'minor-blues',
    name: 'Minor Blues',
    genre: 'Blues',
    mode: 'minor',
    sections: [
      { name: 'verse', degrees: [
        { deg: 1 }, { deg: 1 }, { deg: 1 }, { deg: 1 },
        { deg: 4 }, { deg: 4 }, { deg: 1 }, { deg: 1 },
        { deg: 5, quality: 'dom7' }, { deg: 4 }, { deg: 1 }, { deg: 5, quality: 'dom7' },
      ]},
    ],
  },
  {
    key: 'canon-progression',
    name: 'Pachelbel Canon',
    genre: 'Classical/Pop',
    sections: [
      { name: 'verse', degrees: [
        { deg: 1 }, { deg: 5 }, { deg: 6 }, { deg: 3 },
        { deg: 4 }, { deg: 1 }, { deg: 4 }, { deg: 5 },
      ]},
    ],
  },
  {
    key: 'axis-pop',
    name: 'Best-Seller / Axis',
    genre: 'Pop',
    sections: [
      { name: 'verse', degrees: [{ deg: 1 }, { deg: 5 }, { deg: 6 }, { deg: 4 }] },
    ],
  },
];

/**
 * Instantiate a form template into concrete chord objects.
 * @param {string} formKey - key from SONG_FORMS
 * @param {number} keyRoot - pitch class 0-11
 * @param {string} keyQuality - 'major' or 'minor'
 * @returns {{ section: string, chords: { root, quality, name, section }[] }[]}
 */
export function instantiateForm(formKey, keyRoot, keyQuality) {
  const form = SONG_FORMS.find(f => f.key === formKey);
  if (!form) return [];

  // Use form's preferred mode if specified
  const mode = form.mode || keyQuality;
  const key = buildKey(keyRoot, mode);

  const result = [];
  for (const section of form.sections) {
    const chords = section.degrees.map(d => {
      const dc = key.diatonicChords[d.deg - 1];
      if (!dc) return null;

      const quality = d.quality || dc.quality;
      const rootNote = pitchToNoteInKey(dc.root, keyRoot);
      const name = rootNote + (CHORD_SUFFIXES[quality] ?? quality);

      return {
        root: dc.root,
        quality,
        name,
        rootNote,
        actualPitches: buildChord(dc.root, quality),
        section: section.name,
      };
    }).filter(Boolean);

    result.push({ section: section.name, chords });
  }

  return result;
}
