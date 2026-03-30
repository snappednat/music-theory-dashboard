/**
 * Voicing Explorer panel.
 * Shows multiple chord diagram cards for a given chord,
 * generated from COMMON_VOICINGS + algorithmic generation.
 * Clicking a card loads that voicing onto the main fretboard.
 */

import { generateVoicings, CHORD_FORMULAS } from '../core/chords.js';
import { CHROMATIC_SHARP, normalizePitch } from '../core/notes.js';
import { TUNING_PRESETS } from './tuning.js';
import { playChord } from '../core/audio.js';
import { scoreVoiceLeading, vlScoreColor } from '../core/voiceLeading.js';
import { SEMITONE_TO_INTERVAL_NAME } from '../core/intervals.js';

// Track the currently-selected voicing key so we can re-highlight after re-render
let _activeKey = null;

/**
 * Build a row of chord-tone pills: "G (Root) · B (M3) · D (P5)"
 */
function buildChordToneRow(root, quality) {
  const formula = CHORD_FORMULAS[quality];
  if (!formula) return '';
  const pills = formula.map((semis, i) => {
    const pitch = ((root + semis) % 12 + 12) % 12;
    const noteName = CHROMATIC_SHARP[pitch];
    const intervalLabel = SEMITONE_TO_INTERVAL_NAME[(semis % 12 + 12) % 12] ?? '';
    const isRoot = i === 0;
    return `<span class="ve-tone-pill${isRoot ? ' ve-tone-root' : ''}">${noteName}<span class="ve-tone-interval">${isRoot ? 'Root' : intervalLabel}</span></span>`;
  });
  return `<div class="ve-chord-tones">${pills.join('<span class="ve-tone-sep">·</span>')}</div>`;
}

/**
 * Render the voicing explorer panel.
 * @param {object|null} chord       - chord object with .root and .quality
 * @param {number[]}    tuning      - pitch class per string
 * @param {function}    onSelect    - (frets: number[]) → void
 * @param {number[]|null} currentFrets - current fretboard frets for VL scoring
 */
export function renderVoicingExplorer(chord, tuning, onSelect, currentFrets = null, difficultyFilter = 'advanced') {
  const container = document.getElementById('voicing-explorer-panel');
  if (!container) return;

  if (!chord) {
    container.innerHTML = '';
    container.style.display = 'none';
    _activeKey = null;
    return;
  }

  const allVoicings = generateVoicings(chord.root, chord.quality, tuning);
  if (allVoicings.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  // Filter by tier (cumulative: basic ⊂ color ⊂ advanced)
  const _DIFF_RANK = { basic: 0, color: 1, advanced: 2 };
  const maxRank = _DIFF_RANK[difficultyFilter] ?? 2;
  let voicings = allVoicings.filter(v => (_DIFF_RANK[v.difficulty ?? 'advanced']) <= maxRank);

  // If no voicings match the selected tier, show an informative empty state.
  if (voicings.length === 0) {
    const levelLabels = { basic: 'Basic', color: 'Color', advanced: 'Advanced' };
    const nextLevel   = difficultyFilter === 'basic' ? 'Color' : 'Advanced';
    container.style.display = '';
    container.innerHTML = `
      <div class="section-label">Voicings — ${chord.slashName ?? chord.name}</div>
      <div class="ve-no-voicing">
        No ${levelLabels[difficultyFilter] ?? difficultyFilter} shape available for <strong>${chord.slashName ?? chord.name}</strong>.
        Switch to <strong>${nextLevel}</strong> to see voicings.
      </div>`;
    return;
  }

  const wasHidden = container.style.display === 'none' || !container.style.display;
  container.style.display = '';
  if (wasHidden) {
    container.classList.remove('panel-reveal');
    requestAnimationFrame(() => container.classList.add('panel-reveal'));
  }

  // Build chord tones set for colouring root dots
  const rootPitch = chord.root;

  // Score voice leading for each voicing against current frets
  const hasCurrentChord = currentFrets && currentFrets.some(f => f >= 0);

  const cardsHtml = voicings.map((v, i) => {
    const fretsKey = v.frets.join(',');
    const isActive = fretsKey === _activeKey;
    const extraClass = v.isStandard ? ' ve-standard' : v.isBarre ? ' ve-barre' : '';

    let vlBadge = '';
    if (hasCurrentChord) {
      const vl = scoreVoiceLeading(currentFrets, v.frets, tuning);
      const color = vlScoreColor(vl.score);
      vlBadge = `<span class="ve-vl-badge" style="color:${color}" title="Voice leading: ${vl.label} (${vl.score}/100, ${vl.commonTones} common tones)">${vl.label}</span>`;
    }

    return `
    <div class="ve-card${extraClass}${isActive ? ' ve-active' : ''}" data-idx="${i}" data-frets="${fretsKey}" title="${v.label}">
      ${buildChordDiagramHtml(v.frets, tuning, rootPitch)}
      <div class="ve-label">${v.label}</div>
      ${vlBadge}
      <button class="btn-play ve-play-btn" data-frets="${fretsKey}" title="Play this voicing">▶</button>
    </div>
  `;
  }).join('');

  const stdTuning = [4, 9, 2, 7, 11, 4];
  const isStandardTuning = tuning.join(',') === stdTuning.join(',');
  const tuningBadge = isStandardTuning ? '' : (() => {
    const match = TUNING_PRESETS.find(p => p.tuning.join(',') === tuning.join(','));
    const label = match ? match.label.replace(/\s*\(.*\)$/, '') : 'Custom Tuning';
    return `<span class="ve-tuning-badge">${label}</span>`;
  })();

  const fallbackNote = '';

  container.innerHTML = `
    <div class="section-label">Voicings — ${chord.slashName ?? chord.name}${tuningBadge}</div>
    ${fallbackNote}
    <div class="ve-cards" id="ve-cards-row">${cardsHtml}</div>
  `;

  container.querySelector('#ve-cards-row').addEventListener('click', e => {
    // Play button — preview sound without selecting the voicing
    const playBtn = e.target.closest('.ve-play-btn');
    if (playBtn) {
      e.stopPropagation();
      const frets = playBtn.dataset.frets.split(',').map(Number);
      playChord(frets, tuning);
      return;
    }

    const card = e.target.closest('.ve-card');
    if (!card) return;
    const idx = parseInt(card.dataset.idx, 10);
    _activeKey = voicings[idx].frets.join(',');
    onSelect(voicings[idx].frets.slice());
  });
}

// ─── Alternate Voicings for Current Chord ────────────────────────────────────

/**
 * Render a compact row of alternate voicings for the chord currently on the
 * fretboard. The active voicing (matching currentFrets) is highlighted.
 * Clicking a card calls onSelect(frets) to load it onto the fretboard.
 */
export function renderAltVoicings(chord, tuning, onSelect, currentFrets = null, difficultyFilter = 'advanced') {
  const container = document.getElementById('alt-voicings-panel');
  if (!container) return;

  if (!chord) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  const allVoicings = generateVoicings(chord.root, chord.quality, tuning);
  if (!allVoicings?.length) { container.style.display = 'none'; return; }

  // Filter by tier; fall back to all voicings if none match
  const _RANK = { basic: 0, color: 1, advanced: 2 };
  const maxRank = _RANK[difficultyFilter] ?? 2;
  const filtered = allVoicings.filter(v => (_RANK[v.difficulty ?? 'advanced']) <= maxRank);
  const voicings = filtered.length ? filtered : allVoicings;

  const currentKey = (currentFrets || []).join(',');

  const cards = voicings.map((v, i) => {
    const key    = v.frets.join(',');
    const active = key === currentKey;
    const diag   = buildChordDiagramHtml(v.frets, tuning, chord.root);
    const minFret = v.frets.filter(f => f > 0);
    const label  = minFret.length ? `${Math.min(...minFret)}fr` : 'Open';
    return `<div class="ve-card alt-ve-card${active ? ' ve-active' : ''}" data-frets="${key}" data-idx="${i}">
      ${diag}
      <span class="ve-fret-label">${label}</span>
    </div>`;
  }).join('');

  container.style.display = '';
  container.innerHTML = `
    <div class="alt-voicings-header">
      <span class="section-label">Alternate Voicings — ${chord.slashName ?? chord.name}</span>
    </div>
    <div class="ve-cards">${cards}</div>
  `;

  if (!container.dataset.altListenerAttached) {
    container.dataset.altListenerAttached = '1';
    container.addEventListener('click', e => {
      const card = e.target.closest('.alt-ve-card');
      if (!card) return;
      const frets = card.dataset.frets.split(',').map(Number);
      container.querySelectorAll('.alt-ve-card').forEach(c => c.classList.remove('ve-active'));
      card.classList.add('ve-active');
      onSelect(frets);
    });
  }
}

// ─── Chord diagram SVG ───────────────────────────────────────────────────────

/**
 * Returns an SVG string for a chord box diagram.
 * Exported so other panels (e.g. chordIdeas) can reuse the same visual.
 */
export function buildChordDiagramHtml(frets, tuning, rootPitch) {
  const W = 88, H = 102;
  const PAD_L = 20, PAD_R = 10, PAD_T = 22, PAD_B = 14;
  // boardW = W - PAD_L - PAD_R = 58px (unchanged).
  // PAD_L increased by 10 to give the fret-number label room to clear the leftmost dot.

  // Find the fret window to display
  const activeFrets = frets.filter(f => f > 0);
  const showNut   = activeFrets.length === 0 || Math.min(...activeFrets) <= 2;
  const startFret = showNut ? 1 : Math.min(...activeFrets);
  const ROWS      = 4;

  const boardW = W - PAD_L - PAD_R;
  const boardH = H - PAD_T - PAD_B;
  const strW   = boardW / 5; // 6 strings = 5 gaps
  const rowH   = boardH / ROWS;

  // string index 0 (low E) → leftmost, index 5 (high e) → rightmost
  const sx = s => PAD_L + s * strW;
  const fy = row => PAD_T + row * rowH;

  const parts = [];

  // Board background
  parts.push(`<rect x="${PAD_L}" y="${PAD_T}" width="${boardW}" height="${boardH}" fill="rgba(139,90,43,0.15)" rx="1"/>`);

  // Nut or fret start
  if (showNut) {
    parts.push(`<rect x="${PAD_L}" y="${PAD_T - 3}" width="${boardW}" height="4" fill="#c8a96a" rx="1"/>`);
  } else {
    // Fret number label — positioned so its right edge clears the leftmost dot by 3px.
    // dotR = rowH * 0.34 (same radius used when drawing finger dots below).
    const dotR = rowH * 0.34;
    const fretLabelX = (PAD_L - dotR - 3).toFixed(1);
    parts.push(`<text x="${fretLabelX}" y="${PAD_T + rowH * 0.65}" font-size="8" fill="#888" text-anchor="end">${startFret}</text>`);
  }

  // Fret lines
  for (let row = 0; row <= ROWS; row++) {
    const y = fy(row);
    parts.push(`<line x1="${PAD_L}" y1="${y}" x2="${PAD_L + boardW}" y2="${y}" stroke="#555" stroke-width="0.8"/>`);
  }

  // String lines
  for (let s = 0; s < 6; s++) {
    const x = sx(s);
    const thickness = (0.7 + s * 0.12).toFixed(2);
    parts.push(`<line x1="${x}" y1="${PAD_T}" x2="${x}" y2="${PAD_T + boardH}" stroke="#888" stroke-width="${thickness}"/>`);
  }

  // X / O markers above the diagram
  for (let s = 0; s < 6; s++) {
    const x  = sx(s);
    const f  = frets[s];
    const yM = PAD_T - 8;
    if (f === -1) {
      parts.push(`<text x="${x}" y="${yM}" font-size="9" fill="#888" text-anchor="middle" dominant-baseline="middle">✕</text>`);
    } else if (f === 0) {
      parts.push(`<circle cx="${x}" cy="${yM}" r="4.5" fill="none" stroke="#aaa" stroke-width="1.5"/>`);
    }
  }

  // Finger dots
  for (let s = 0; s < 6; s++) {
    const f = frets[s];
    if (f <= 0) continue;
    const row = f - startFret;
    if (row < 0 || row >= ROWS) continue;
    const x = sx(s);
    const y = fy(row) + rowH / 2;
    const r = rowH * 0.34;
    const pitch = normalizePitch(tuning[s] + f);
    const isRoot = pitch === rootPitch;
    const fill = isRoot ? '#27AE60' : '#e74c3c';
    parts.push(`<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${fill}"/>`);
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" overflow="visible" class="ve-diagram">${parts.join('')}</svg>`;
}
