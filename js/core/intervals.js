// Interval names and their semitone counts
export const INTERVAL_SEMITONES = {
  'P1': 0,  'R': 0,
  'm2': 1,  'b2': 1,
  'M2': 2,  '2': 2,
  'm3': 3,  'b3': 3,
  'M3': 4,  '3': 4,
  'P4': 5,  '4': 5,
  'A4': 6,  'd5': 6, 'TT': 6,
  'P5': 7,  '5': 7,
  'A5': 8,  'm6': 8,
  'M6': 9,  '6': 9,
  'm7': 10, 'b7': 10,
  'M7': 11, '7': 11,
  'P8': 12,
};

// Semitone offset -> standard interval name (for display)
export const SEMITONE_TO_INTERVAL_NAME = [
  'Root', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7',
];

// Full interval names for display
export const INTERVAL_FULL_NAMES = {
  'Root': 'Perfect Unison',
  'm2':  'Minor 2nd',
  'M2':  'Major 2nd',
  'm3':  'Minor 3rd',
  'M3':  'Major 3rd',
  'P4':  'Perfect 4th',
  'TT':  'Tritone / Aug 4th',
  'P5':  'Perfect 5th',
  'm6':  'Minor 6th',
  'M6':  'Major 6th',
  'm7':  'Minor 7th',
  'M7':  'Major 7th',
};

/**
 * Get interval name (e.g. 'M3') for a number of semitones
 */
export function intervalName(semitones) {
  semitones = ((semitones % 12) + 12) % 12;
  return SEMITONE_TO_INTERVAL_NAME[semitones] ?? `${semitones}st`;
}

/**
 * Semitones from one pitch to another, going upward (0-11)
 */
export function semitonesBetween(fromPitch, toPitch) {
  return ((toPitch - fromPitch) % 12 + 12) % 12;
}
