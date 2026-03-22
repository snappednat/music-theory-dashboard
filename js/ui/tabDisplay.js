import { CHROMATIC_SHARP, normalizePitch } from '../core/notes.js';
import { SEMITONE_TO_INTERVAL_NAME } from '../core/intervals.js';
import { generateVoicings, CHORD_QUALITY_LABELS } from '../core/chords.js';
import { getDegreeInKey, getChordNumeral, DEGREE_EXPLANATIONS } from '../core/keys.js';
import { buildChordDiagramHtml } from './voicingExplorer.js';
import { playChord } from '../core/audio.js';
import { scoreVoiceLeading, vlScoreColor } from '../core/voiceLeading.js';
import { getChordScales, SCALE_DISPLAY_NAMES } from '../core/scales.js';

// Voicing selected by the user but not yet swapped to fretboard
let _pendingFrets = null;

/**
 * Convert selectedFrets to compact tab string (e.g. x32010)
 */
export function toCompactTab(selectedFrets) {
  return selectedFrets
    .map(f => f === -1 ? 'x' : String(f))
    .join('-')
    .replace(/^(\d|x)-(\d|x)-(\d|x)-(\d|x)-(\d|x)-(\d|x)$/, (_, g1, g2, g3, g4, g5, g6) => {
      const parts = [g1, g2, g3, g4, g5, g6];
      if (parts.every(p => p.length === 1)) return parts.join('');
      return parts.join('-');
    });
}

/**
 * Render vertical tab notation (standard guitar tab lines)
 */
export function toVerticalTab(selectedFrets, tuningNames) {
  const lines = [];
  for (let s = 5; s >= 0; s--) {
    const name = tuningNames[s].padStart(2, ' ');
    const fret  = selectedFrets[s];
    const fretStr = fret === -1 ? 'x' : String(fret);
    lines.push(`${name}|--${fretStr.padEnd(3, '-')}|`);
  }
  return lines.join('\n');
}

/**
 * Parse a tab string into selectedFrets array
 * Handles both "x32010" and "x-3-2-0-1-0" formats
 */
export function parseTabString(tabStr) {
  if (!tabStr || !tabStr.trim()) return null;
  const str = tabStr.trim().toLowerCase();
  let parts = str.includes('-') ? str.split('-') : str.split('');
  if (parts.length !== 6) return null;
  const frets = parts.map(p => {
    if (p === 'x' || p === 'm') return -1;
    const n = parseInt(p, 10);
    return (isNaN(n) || n < 0 || n > 22) ? null : n;
  });
  return frets.includes(null) ? null : frets;
}

/**
 * Render the chord display panel.
 * @param {object|null} chord              - identified chord object
 * @param {number[]}    selectedFrets      - current fretboard state
 * @param {number[]}    tuning             - pitch class per string
 * @param {object|null} key                - active key object
 * @param {function}    onVoicingSelect    - (frets) => void — apply voicing to fretboard
 * @param {function}    onAddToProgression - () => void — add current chord to progression
 */
export function renderChordDisplay(chord, selectedFrets, tuning, key, onVoicingSelect, onAddToProgression, progressionFrets = null) {
  const container = document.getElementById('chord-display');
  if (!container) return;

  if (!chord) {
    _pendingFrets = null;
    container.innerHTML = '<div class="key-placeholder">Click frets to build a chord…</div>';
    return;
  }

  // ── Note badges (with interval labels) ───────────────────────────────────
  const tonePitches = chord.actualPitches
    ? [...new Set(chord.actualPitches.map(p => normalizePitch(p)))]
    : [];
  const noteBadges = tonePitches.map(p => {
    const name  = CHROMATIC_SHARP[p];
    const semis = normalizePitch(p - chord.root);
    const iname = semis === 0 ? 'Root' : (SEMITONE_TO_INTERVAL_NAME[semis] ?? '');
    return `<span class="chord-note-badge ${semis === 0 ? 'is-root' : ''}">
      <span class="badge-note">${name}</span>
      <span class="badge-interval">${iname}</span>
    </span>`;
  }).join('');

  // ── Theory fact ───────────────────────────────────────────────────────────
  let theoryHtml = '';
  if (key) {
    const numeral = getChordNumeral(chord.root, chord.quality, key);
    const degree  = getDegreeInKey(chord.root, key);
    let theoryText = '';
    if (degree !== null) {
      const full = DEGREE_EXPLANATIONS[key.quality]?.[degree] ?? '';
      theoryText = full.replace(/^[^—–]+[—–]\s*/, '');
    } else {
      const interval = normalizePitch(chord.root - key.root);
      const NONDIATONIC_HINTS = {
        1:  'Neapolitan or chromatic neighbour — intense half-step colour.',
        3:  'Borrowed ♭III from the parallel minor — a dark, bluesy lift.',
        6:  'Tritone substitution — maximum harmonic tension.',
        8:  'Borrowed ♭VI from the parallel minor — bright contrast in a minor context.',
        10: 'Borrowed ♭VII — very common in rock and pop; a major chord one step below the tonic.',
      };
      theoryText = NONDIATONIC_HINTS[interval]
        ?? 'Chromatic chord — adds unexpected colour and tension outside the key.';
    }
    theoryHtml = `
      <div class="chord-theory-fact">
        <span class="chord-theory-numeral">${numeral}</span>
        <span class="chord-theory-text">${theoryText}</span>
      </div>`;
  }

  // ── Chord-scale recommendations ─────────────────────────────────────────
  const chordScales = getChordScales(chord.root, chord.quality);
  const chordScaleHtml = chordScales.length > 0 ? `
    <div class="chord-scales-section">
      <div class="chord-scales-label">Scales for improvisation:</div>
      <div class="chord-scales-list">
        ${chordScales.map(s => `<span class="chord-scale-chip" data-scale-type="${s.type}" data-root="${s.rootPitch}" title="Show ${s.label} on fretboard">${s.label}</span>`).join('')}
      </div>
    </div>
  ` : '';

  // ── Voicing cards (inside dropdown) ──────────────────────────────────────
  const voicings = generateVoicings(chord.root, chord.quality, tuning);
  const activeFretKey      = selectedFrets.join(',');
  const progressionFretKey = progressionFrets ? progressionFrets.join(',') : null;

  const voicingCards = voicings.map((v, i) => {
    const fretsKey      = v.frets.join(',');
    const isActive      = fretsKey === activeFretKey;
    const isProgression = progressionFretKey && fretsKey === progressionFretKey && fretsKey !== activeFretKey;
    const extraClass    = v.isStandard ? ' ve-standard' : v.isBarre ? ' ve-barre' : '';
    const stateClass    = isProgression ? ' ve-progression' : isActive ? ' ve-active' : '';
    return `
      <div class="ve-card${extraClass}${stateClass}"
           data-idx="${i}" data-frets="${fretsKey}" title="${v.label}">
        ${buildChordDiagramHtml(v.frets, tuning, chord.root)}
        <div class="ve-label">${v.label}</div>
        <button class="btn-play ve-play-btn" data-frets="${fretsKey}" title="Play this voicing">▶</button>
      </div>`;
  }).join('');

  const voicingsHtml = voicings.length > 0 ? `
    <details class="chord-voicings-details">
      <summary class="chord-voicings-summary">
        Voicings <span class="chord-voicings-count">(${voicings.length})</span>
      </summary>
      <div class="chord-voicings-row" id="current-chord-voicings">${voicingCards}</div>
      <div class="chord-action-row">
        <button class="btn-add-inline" id="btn-add-inline" title="Add to progression">+ Add to Progression</button>
      </div>
    </details>` : `
    <div class="chord-action-row">
      <button class="btn-add-inline" id="btn-add-inline" title="Add to progression">+ Add to Progression</button>
    </div>`;

  // ── Render ────────────────────────────────────────────────────────────────
  // Preserve the open/closed state of the voicings <details> across re-renders
  const prevDetailsOpen = container.querySelector('.chord-voicings-details')?.open ?? false;

  const displayName  = chord.slashName || chord.name;
  const qualityLabel = CHORD_QUALITY_LABELS[chord.quality] || chord.quality;

  container.innerHTML = `
    <div class="chord-main">
      <span class="chord-name-large">${displayName}</span>
      <span class="chord-quality-label">${qualityLabel}</span>
    </div>
    <div class="chord-notes-row">${noteBadges}</div>
    ${theoryHtml}
    ${chordScaleHtml}
    ${voicingsHtml}
  `;

  // Restore voicings open state (lost when innerHTML was replaced)
  if (prevDetailsOpen) {
    const details = container.querySelector('.chord-voicings-details');
    if (details) details.open = true;
  }

  // ── "Add to Progression" button ───────────────────────────────────────────
  container.querySelector('#btn-add-inline')?.addEventListener('click', () => {
    onAddToProgression?.();
  });

  // ── Voicing card interactions ─────────────────────────────────────────────
  const voicingsRow = container.querySelector('#current-chord-voicings');
  if (voicingsRow) {
    voicingsRow.addEventListener('click', e => {
      const playBtn = e.target.closest('.ve-play-btn');
      if (playBtn) {
        e.stopPropagation();
        playChord(playBtn.dataset.frets.split(',').map(Number), tuning);
        return;
      }
      const card = e.target.closest('.ve-card');
      if (!card || !onVoicingSelect) return;

      // Clicking a voicing card immediately applies it to the fretboard
      const frets = card.dataset.frets.split(',').map(Number);
      playChord(frets, tuning);
      onVoicingSelect(frets);
    });
  }

  // ── Chord-scale chip clicks ──────────────────────────────────────────────
  container.querySelectorAll('.chord-scale-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.scaleType;
      const rootPitch = parseInt(chip.dataset.root, 10);
      // Dispatch custom event that app.js can listen for
      container.dispatchEvent(new CustomEvent('scale-activate', {
        bubbles: true,
        detail: { type, rootPitch }
      }));
    });
  });
}
