/**
 * Scale Suggestions panel.
 * Shows scale cards relevant to the detected key, each with a mini fretboard
 * thumbnail and per-card position cycling arrows.
 * When a progression is provided, shows green/yellow/red rating badges and
 * per-chord compatibility. Includes "Show all" toggle for all 12 scales.
 */

import { getScaleSuggestions, getScalePositions, SCALE_DISPLAY_NAMES, SCALE_FORMULAS, rateScaleForProgression } from '../core/scales.js';

// Per-scale-type position index state (persists across re-renders)
const _posState = new Map(); // scaleType → positionIndex
let _showAll = false;
// Compact cards the user has expanded inline
const _expandedCompact = new Set();

/** Collapse consecutive items with the same key into { item, count } entries */
function _collapseConsecutive(arr, keyFn) {
  const result = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (result.length > 0 && result[result.length - 1].key === k) {
      result[result.length - 1].count++;
    } else {
      result.push({ key: k, item, count: 1 });
    }
  }
  return result;
}

/**
 * Render the suggestions panel.
 * @param {object|null} activeKey   - key object with .root and .quality
 * @param {number[]}    tuning      - pitch class per string
 * @param {function}    onActivate  - (scaleType, position) → void
 * @param {object[]}    progression - array of chord objects (optional)
 */
export function renderScaleSuggestions(activeKey, tuning, onActivate, progression = [], capoFret = 0) {
  const container = document.getElementById('scale-suggestions-panel');
  if (!container) return;

  const section = document.getElementById('scale-sugg-section');
  if (section) section.style.display = '';
  if (!activeKey) {
    container.innerHTML = '<div class="key-placeholder">Add chords to your progression to explore scale suggestions for riffs, melodies, and solos.</div>';
    container.style.display = '';
    return;
  }
  const wasHidden = container.style.display === 'none' || !container.style.display;
  container.style.display = '';
  if (wasHidden) {
    container.classList.remove('panel-reveal');
    requestAnimationFrame(() => container.classList.add('panel-reveal'));
  }
  const suggestions = getScaleSuggestions(activeKey.quality);
  const suggestedTypes = new Set(suggestions.map(s => s.type));

  // Build top-pick cards
  const topCardsHtml = suggestions.map(({ type, reason }) => {
    return _buildScaleCard(type, reason, activeKey, tuning, progression, false, capoFret);
  }).filter(Boolean).join('');

  // Build full list (all remaining scales not in suggestions)
  const allTypes = Object.keys(SCALE_FORMULAS);
  const restTypes = allTypes.filter(t => !suggestedTypes.has(t));
  const restCardsHtml = restTypes.map(type => {
    return _buildScaleCard(type, '', activeKey, tuning, progression, true, capoFret);
  }).filter(Boolean).join('');

  container.innerHTML = `
    <div class="ssc-cards" id="ssc-cards-row">${topCardsHtml}</div>
    <div class="ssc-show-all-row">
      <button class="ssc-btn" id="ssc-show-all-btn">${_showAll ? 'Hide extra scales' : 'Show all scales'}</button>
    </div>
    <div class="ssc-cards ssc-all-cards" id="ssc-all-row" style="${_showAll ? '' : 'display:none'}">${restCardsHtml}</div>
  `;

  // Wire events
  container.querySelector('#ssc-cards-row')?.addEventListener('click', e => _handleCardClick(e, activeKey, tuning, onActivate, progression, capoFret));
  container.querySelector('#ssc-all-row')?.addEventListener('click', e => _handleCardClick(e, activeKey, tuning, onActivate, progression, capoFret));
  container.querySelector('#ssc-show-all-btn')?.addEventListener('click', () => {
    _showAll = !_showAll;
    renderScaleSuggestions(activeKey, tuning, onActivate, progression, capoFret);
  });
}

function _buildScaleCard(type, reason, activeKey, tuning, progression, compact = false, capoFret = 0) {
  const positions = getScalePositions(activeKey.root, type, tuning, capoFret);
  if (positions.length === 0) return '';

  const posIdx = Math.min(_posState.get(type) ?? 0, positions.length - 1);
  const pos    = positions[posIdx];

  let ratingHtml = '';
  let fitBadgesHtml = '';
  if (progression.length > 0) {
    const { rating, chordFits } = rateScaleForProgression(type, activeKey.root, progression);
    const ratingColors = { green: '#27ae60', yellow: '#f39c12', red: '#e74c3c' };
    ratingHtml = `<span class="scale-rating-dot" style="background:${ratingColors[rating]}" title="${rating}"></span>`;
    fitBadgesHtml = `
      <div class="chord-fit-row">
        ${_collapseConsecutive(chordFits, cf => `${cf.name}|${cf.fits}`).map(({ item: { name, fits }, count }) => `
          <span class="chord-fit-badge chord-fit-${fits}" title="${fits}">${name}${count > 1 ? ` ×${count}` : ''}</span>
        `).join('')}
      </div>
    `;
  }

  if (compact) {
    const isExpanded = _expandedCompact.has(type);

    if (isExpanded) {
      // Expanded compact card — full layout with mini SVG and position nav
      return `
        <div class="ssc-card ssc-compact ssc-compact-expanded" data-scale-type="${type}">
          <div class="ssc-top">
            ${ratingHtml}
            <span class="ssc-name">${SCALE_DISPLAY_NAMES[type]}</span>
            <button class="ssc-btn ssc-compact-toggle" data-type="${type}" title="Collapse">✕</button>
          </div>
          <div class="ssc-thumb">${_buildMiniSvg(pos)}</div>
          ${fitBadgesHtml}
          <div class="ssc-footer">
            <div class="ssc-pos-nav">
              <button class="ssc-btn ssc-prev" data-type="${type}" title="Previous position">‹</button>
              <span class="ssc-pos-label">${posIdx + 1} / ${positions.length}</span>
              <button class="ssc-btn ssc-next" data-type="${type}" title="Next position">›</button>
            </div>
            <button class="ssc-btn ssc-show" data-type="${type}">Show on fretboard</button>
          </div>
        </div>
      `;
    }

    // Collapsed compact card: name + rating + chord fits + expand button
    return `
      <div class="ssc-card ssc-compact" data-scale-type="${type}">
        <div class="ssc-top">
          ${ratingHtml}
          <span class="ssc-name">${SCALE_DISPLAY_NAMES[type]}</span>
          <button class="ssc-btn ssc-compact-toggle" data-type="${type}" title="Expand to see fretboard diagram">Show</button>
        </div>
        ${fitBadgesHtml}
      </div>
    `;
  }

  return `
    <div class="ssc-card" data-scale-type="${type}">
      <div class="ssc-top">
        ${ratingHtml}
        <span class="ssc-name">${SCALE_DISPLAY_NAMES[type]}</span>
        <span class="ssc-reason">${reason}</span>
      </div>
      <div class="ssc-thumb">${_buildMiniSvg(pos)}</div>
      ${fitBadgesHtml}
      <div class="ssc-footer">
        <div class="ssc-pos-nav">
          <button class="ssc-btn ssc-prev" data-type="${type}" title="Previous position">‹</button>
          <span class="ssc-pos-label">${posIdx + 1} / ${positions.length}</span>
          <button class="ssc-btn ssc-next" data-type="${type}" title="Next position">›</button>
        </div>
        <button class="ssc-btn ssc-show" data-type="${type}">Show</button>
      </div>
    </div>
  `;
}

function _handleCardClick(e, activeKey, tuning, onActivate, progression, capoFret = 0) {
  const prev   = e.target.closest('.ssc-prev');
  const next   = e.target.closest('.ssc-next');
  const show   = e.target.closest('.ssc-show');
  const toggle = e.target.closest('.ssc-compact-toggle');

  if (prev || next) {
    const type      = (prev || next).dataset.type;
    const positions = getScalePositions(activeKey.root, type, tuning, capoFret);
    let idx = _posState.get(type) ?? 0;
    if (prev) idx = (idx - 1 + positions.length) % positions.length;
    if (next) idx = (idx + 1) % positions.length;
    _posState.set(type, idx);
    // If this card is expanded, also update the fretboard live
    if (_expandedCompact.has(type)) {
      onActivate(type, positions[idx]);
    }
    renderScaleSuggestions(activeKey, tuning, onActivate, progression, capoFret);
    return;
  }

  if (toggle) {
    const type = toggle.dataset.type;
    if (_expandedCompact.has(type)) {
      _expandedCompact.delete(type);
    } else {
      _expandedCompact.add(type);
      // Activate scale on fretboard when first expanding
      const positions = getScalePositions(activeKey.root, type, tuning, capoFret);
      const idx       = Math.min(_posState.get(type) ?? 0, positions.length - 1);
      onActivate(type, positions[idx]);
    }
    renderScaleSuggestions(activeKey, tuning, onActivate, progression, capoFret);
    return;
  }

  if (show) {
    const type      = show.dataset.type;
    const positions = getScalePositions(activeKey.root, type, tuning, capoFret);
    const idx       = Math.min(_posState.get(type) ?? 0, positions.length - 1);
    onActivate(type, positions[idx]);
  }
}

// ─── Mini fretboard SVG ──────────────────────────────────────────────────────

function _buildMiniSvg(pos) {
  const W = 186, H = 66;
  const hasOpen = pos.startFret === 0;

  // Layout: fret columns
  const SLOTS  = 4;          // fret slots to show
  const PAD_L  = hasOpen ? 18 : 26; // space for open dots or fret label
  const PAD_R  = 6;
  const PAD_T  = 5;
  const PAD_B  = 5;

  const boardW = W - PAD_L - PAD_R;
  const boardH = H - PAD_T - PAD_B;
  const slotW  = boardW / SLOTS;
  const strH   = boardH / 5; // gap between 6 strings

  const slotCX = i  => PAD_L + (i + 0.5) * slotW;
  const stringY = s => PAD_T + (5 - s) * strH;  // s=5 (high e) at top

  const parts = [];

  // Board background
  parts.push(`<rect x="${PAD_L}" y="${PAD_T}" width="${boardW}" height="${boardH}" fill="rgba(139,90,43,0.18)" rx="2"/>`);

  // Nut / fret start
  if (hasOpen) {
    // thick nut line
    parts.push(`<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T + boardH}" stroke="#c8a96a" stroke-width="3"/>`);
  } else {
    // Fret number label on left
    const labelY = PAD_T + boardH / 2 + 4;
    parts.push(`<text x="${PAD_L - 4}" y="${labelY}" font-size="9" fill="#888" text-anchor="end">${pos.startFret}</text>`);
    parts.push(`<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T + boardH}" stroke="#555" stroke-width="1"/>`);
  }

  // Fret lines (right-side of each slot)
  for (let i = 1; i <= SLOTS; i++) {
    const x = PAD_L + i * slotW;
    parts.push(`<line x1="${x}" y1="${PAD_T}" x2="${x}" y2="${PAD_T + boardH}" stroke="#555" stroke-width="1"/>`);
  }

  // String lines
  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    const sw = (0.7 + s * 0.12).toFixed(2);
    parts.push(`<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="#b8860b" stroke-width="${sw}"/>`);
  }

  // Note dots
  for (const { string: s, fret: f, isRoot } of pos.notes) {
    const fill = isRoot ? '#27AE60' : '#3b82f6';
    if (hasOpen && f === 0) {
      // Open string: circle to the left of nut
      const x = PAD_L / 2;
      const y = stringY(s);
      parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${fill}" opacity="0.9"/>`);
    } else {
      // Fretted: map to slot
      const slot = hasOpen ? (f - 1) : (f - pos.startFret);
      if (slot < 0 || slot >= SLOTS) continue;
      const x = slotCX(slot);
      const y = stringY(s);
      parts.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="${fill}" opacity="0.9"/>`);
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="ssc-mini-svg">${parts.join('')}</svg>`;
}
