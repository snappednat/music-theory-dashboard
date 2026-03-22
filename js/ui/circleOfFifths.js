import { FIFTHS_ORDER } from '../core/keys.js';
import { pitchToNote, CHROMATIC_SHARP } from '../core/notes.js';
import { buildChord } from '../core/chords.js';
import { generateScale } from '../core/scales.js';

// Major key names in circle of fifths order
const MAJOR_NAMES = ['C', 'G', 'D', 'A', 'E', 'B', 'F#/Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
// Relative minor names at same positions
const MINOR_NAMES = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

const SVG_SIZE = 340;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const R_OUTER  = 148;
const R_MID    = 108;
const R_INNER  = 70;
const R_CENTRE = 30;

// Major key segment colours (one per 12 positions, cycling through a warm palette)
const OUTER_COLORS = [
  '#2563eb','#1d4ed8','#7c3aed','#6d28d9',
  '#db2777','#be185d','#dc2626','#b91c1c',
  '#d97706','#b45309','#059669','#047857',
];
const INNER_COLORS = OUTER_COLORS.map(c => c + 'cc'); // slightly transparent

let _onKeyClick = null;
let _svgEl = null;
let _activeRoot = null;
let _activeQuality = null;

/**
 * Initialise the circle of fifths SVG
 */
export function init(containerId, onKeyClick) {
  _onKeyClick = onKeyClick;

  const container = document.getElementById(containerId);
  if (!container) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'circle-svg');
  svg.setAttribute('viewBox', `0 0 ${SVG_SIZE} ${SVG_SIZE}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  _svgEl = svg;

  _buildCircle(svg);

  container.appendChild(svg);
}

/**
 * Highlight the detected key (and its neighbours), and add Roman numeral labels.
 * @param {number} rootPitch  - 0-11
 * @param {string} quality    - 'major' | 'minor' | modal name
 * @param {object} [activeKey] - full key object with .diatonicChords (optional)
 */
export function highlightKey(rootPitch, quality, activeKey) {
  _activeRoot    = rootPitch;
  _activeQuality = quality;

  if (!_svgEl) return;

  const activePos = FIFTHS_ORDER.indexOf(rootPitch);

  // Reset all segments
  _svgEl.querySelectorAll('.cof-seg').forEach(seg => {
    seg.classList.remove('cof-active-outer', 'cof-active-inner');
    seg.style.filter = '';
    seg.style.opacity = '1';
  });

  // Remove old numeral labels
  _svgEl.querySelectorAll('.cof-numeral-label').forEach(el => el.remove());

  if (activePos === -1) return;

  // Highlight active segment — modal keys highlight the outer ring at the root
  if (quality === 'major') {
    const seg = _svgEl.querySelector(`.cof-seg-outer-${activePos}`);
    if (seg) { seg.classList.add('cof-active-outer'); seg.style.filter = 'brightness(1.4)'; }
  } else if (quality === 'minor') {
    const seg = _svgEl.querySelector(`.cof-seg-inner-${activePos}`);
    if (seg) { seg.classList.add('cof-active-inner'); seg.style.filter = 'brightness(1.4)'; }
  } else {
    // Modal key — highlight outer ring at root
    const seg = _svgEl.querySelector(`.cof-seg-outer-${activePos}`);
    if (seg) { seg.classList.add('cof-active-outer'); seg.style.filter = 'brightness(1.35)'; }
  }

  // Highlight adjacent keys (IV = counterclockwise, V = clockwise)
  const dominant    = (activePos + 1) % 12;
  const subdominant = (activePos + 11) % 12;
  for (const pos of [dominant, subdominant]) {
    const seg = _svgEl.querySelector(`.cof-seg-outer-${pos}`);
    if (seg) seg.style.filter = 'brightness(1.15)';
  }

  // ── Roman numeral labels inside diatonic segments ─────────────────────────
  _updateNumeralLabels(activeKey);
}

/**
 * Render (or refresh) Roman numeral labels inside diatonic circle segments.
 * Uses the module-level _activeRoot to determine which label is highlighted.
 * Safe to call multiple times — always clears old labels first.
 * @param {object|null} activeKey - key object with .diatonicChords
 */
function _updateNumeralLabels(activeKey) {
  if (!_svgEl) return;

  // Remove stale labels
  _svgEl.querySelectorAll('.cof-numeral-label').forEach(el => el.remove());

  if (!activeKey?.diatonicChords) return;

  const NS      = 'http://www.w3.org/2000/svg';
  const labelR  = (R_MID + R_INNER) / 2;  // ~89
  const activePos = FIFTHS_ORDER.indexOf(_activeRoot);

  for (const dc of activeKey.diatonicChords) {
    const pos = FIFTHS_ORDER.indexOf(dc.root);
    if (pos === -1) continue;

    const angle = ((pos * 30 - 90 - 14) + 15) * Math.PI / 180;
    const tx = CX + labelR * Math.cos(angle);
    const ty = CY + labelR * Math.sin(angle);

    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', tx);
    t.setAttribute('y', ty);
    t.setAttribute('class', `cof-numeral-label${pos === activePos ? ' cof-numeral-active' : ''}`);
    t.textContent = dc.numeral;
    _svgEl.appendChild(t);
  }
}

// Motion arc color key → hex color
const ARC_COLORS = {
  strong:  '#4ade80',               // P5 down (V→I)
  circle:  '#22d3ee',               // P4 up
  third:   '#fbbf24',               // 3rd motion
  second:  '#fb923c',               // 2nd motion (step)
  tritone: '#f87171',               // tritone
  weak:    'rgba(200,200,255,0.35)',  // other
};

function _motionColorKey(intervalSemitones) {
  const i = ((intervalSemitones % 12) + 12) % 12;
  if (i === 7) return 'strong';
  if (i === 5) return 'circle';
  if (i === 3 || i === 4) return 'third';
  if (i === 1 || i === 2) return 'second';
  if (i === 6) return 'tritone';
  return 'weak';
}

/**
 * Add arrowhead <marker> defs to the SVG (idempotent).
 */
function _ensureArrowMarkers(svg) {
  if (svg.querySelector('#cof-arrow-defs')) return;
  const NS   = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(NS, 'defs');
  defs.setAttribute('id', 'cof-arrow-defs');

  for (const [key, color] of Object.entries(ARC_COLORS)) {
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id',          `cof-arr-${key}`);
    marker.setAttribute('markerWidth',  '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX',         '5');
    marker.setAttribute('refY',         '3');
    marker.setAttribute('orient',       'auto');

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d',    'M0,0 L0,6 L6,3 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);
    defs.appendChild(marker);
  }
  svg.appendChild(defs);
}

/**
 * Highlight progression chords on the circle, dim everything else.
 * Draws numbered badges and root-motion arcs between consecutive chords.
 * @param {object[]} chords     - array of chord objects with .root and .quality
 * @param {object}   activeKey  - key object with .root and .quality
 */
export function highlightProgression(chords, activeKey) {
  if (!_svgEl) return;

  _ensureArrowMarkers(_svgEl);

  // Collect unique root pitches in the progression
  const progressionPitches = new Set(chords.map(c => c.root));

  // Reset all segments to dimmed state
  _svgEl.querySelectorAll('.cof-seg').forEach(seg => {
    seg.classList.remove('cof-active-outer', 'cof-active-inner');
    seg.style.filter = 'brightness(0.4)';
    seg.style.opacity = '0.5';
  });

  // Remove old badges and motion arcs
  _svgEl.querySelectorAll('.cof-prog-badge, .cof-motion-arc').forEach(el => el.remove());

  // Brighten segments that match progression chord roots
  for (const pitch of progressionPitches) {
    const pos = FIFTHS_ORDER.indexOf(pitch);
    if (pos === -1) continue;

    const outerSeg = _svgEl.querySelector(`.cof-seg-outer-${pos}`);
    const innerSeg = _svgEl.querySelector(`.cof-seg-inner-${pos}`);
    if (outerSeg) { outerSeg.style.filter = 'brightness(1.3)'; outerSeg.style.opacity = '1'; }
    if (innerSeg) { innerSeg.style.filter = 'brightness(1.1)'; innerSeg.style.opacity = '1'; }
  }

  // Add numbered badges for each chord
  const NS = 'http://www.w3.org/2000/svg';
  chords.forEach((chord, i) => {
    const pos = FIFTHS_ORDER.indexOf(chord.root);
    if (pos === -1) return;

    const midAngle = ((pos * 30 - 90 - 14) + 15) * Math.PI / 180;
    const badgeR = R_OUTER + 14;
    const bx = CX + badgeR * Math.cos(midAngle);
    const by = CY + badgeR * Math.sin(midAngle);

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'cof-prog-badge');

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', bx);
    circle.setAttribute('cy', by);
    circle.setAttribute('r', '10');
    circle.setAttribute('fill', '#1abc9c');
    circle.setAttribute('stroke', '#0f0f1a');
    circle.setAttribute('stroke-width', '1');
    g.appendChild(circle);

    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', bx);
    text.setAttribute('y', by);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#fff');
    text.setAttribute('font-size', '8');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-family', 'system-ui, sans-serif');
    text.textContent = String(i + 1);
    g.appendChild(text);

    _svgEl.appendChild(g);
  });

  // ── Roman numeral labels for the active key ──────────────────────────────
  _updateNumeralLabels(activeKey);

  // ── Root motion arcs between consecutive chords ───────────────────────────
  const arcR = R_MID + 10;  // radius for arc anchor points (just outside the mid ring)

  for (let i = 0; i < chords.length - 1; i++) {
    const A = chords[i];
    const B = chords[i + 1];

    const posA = FIFTHS_ORDER.indexOf(((A.root % 12) + 12) % 12);
    const posB = FIFTHS_ORDER.indexOf(((B.root % 12) + 12) % 12);
    if (posA === -1 || posB === -1 || posA === posB) continue;

    const angleA = ((posA * 30 - 90 - 14) + 15) * Math.PI / 180;
    const angleB = ((posB * 30 - 90 - 14) + 15) * Math.PI / 180;

    const ax = CX + arcR * Math.cos(angleA);
    const ay = CY + arcR * Math.sin(angleA);
    const bx = CX + arcR * Math.cos(angleB);
    const by = CY + arcR * Math.sin(angleB);

    // Control point pulled toward center (creates inward curve)
    const mx  = (ax + bx) / 2;
    const my  = (ay + by) / 2;
    const pull = 0.45; // how far toward center
    const cx2 = mx + (CX - mx) * pull;
    const cy2 = my + (CY - my) * pull;

    const interval  = ((B.root - A.root) % 12 + 12) % 12;
    const colorKey  = _motionColorKey(interval);
    const color     = ARC_COLORS[colorKey];

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d',           `M ${ax} ${ay} Q ${cx2} ${cy2} ${bx} ${by}`);
    path.setAttribute('stroke',      color);
    path.setAttribute('stroke-width','2');
    path.setAttribute('fill',        'none');
    path.setAttribute('marker-end',  `url(#cof-arr-${colorKey})`);
    path.setAttribute('class',       'cof-motion-arc');
    _svgEl.appendChild(path);
  }
}

/**
 * Render chord-to-chord transition explanations into a container element.
 * @param {object[]} progression  - array of chord objects with .root, .quality, .name
 * @param {object}   activeKey    - key object with .root, .quality, .diatonicChords
 * @param {string}   containerId  - element ID to render into
 */
export function renderTransitionPanel(progression, activeKey, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!progression || progression.length < 2) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = '';

  // Build set of diatonic root pitches for fast lookup
  const diatonicRoots = new Set(
    (activeKey?.diatonicChords ?? []).map(c => c.root)
  );

  const rows = [];
  for (let i = 0; i < progression.length - 1; i++) {
    const A = progression[i];
    const B = progression[i + 1];

    const interval = ((B.root - A.root) % 12 + 12) % 12;
    let label = '';
    let cls   = 'transition-neutral';

    // Classify the transition
    if (diatonicRoots.has(B.root)) {
      if (interval === 7) {
        label = 'Moving up a 5th — strong dominant motion';
        cls = 'transition-dominant';
      } else if (interval === 5) {
        label = 'Moving up a 4th — subdominant motion';
        cls = 'transition-subdominant';
      } else if (interval === 9) {
        label = 'Down to relative minor — tonic function';
        cls = 'transition-tonic';
      } else if (interval === 3) {
        label = 'Up to relative major — tonic function';
        cls = 'transition-tonic';
      } else {
        label = 'Diatonic step — smooth voice leading';
        cls = 'transition-tonic';
      }
    } else {
      // Check secondary dominant: B is a dom7 chord a P5 above the next diatonic chord
      const next = progression[i + 2];
      if (next && B.quality === 'dom7' && ((next.root - B.root + 12) % 12) === 5) {
        label = `Secondary dominant — V7 of ${next.name ?? CHROMATIC_SHARP[next.root]}`;
        cls = 'transition-secondary';
      } else {
        // Borrowed chord
        label = `Borrowed chord — outside the key of ${activeKey?.name ?? 'current key'}`;
        cls = 'transition-borrowed';
      }
    }

    rows.push(`
      <div class="transition-row ${cls}">
        <span class="transition-chord">${A.name ?? CHROMATIC_SHARP[A.root]}</span>
        <span class="transition-arrow">→</span>
        <span class="transition-chord">${B.name ?? CHROMATIC_SHARP[B.root]}</span>
        <span class="transition-desc">${label}</span>
      </div>
    `);
  }

  container.innerHTML = `
    <div class="section-label" style="margin-bottom:6px">Chord Transitions</div>
    ${rows.join('')}
  `;
}

// ─── Chord Preview ────────────────────────────────────────────────────────────

let _previewSegmentEl = null;  // currently highlighted preview segment

/**
 * Highlight a chord on the circle for hover/click preview.
 * Additive — does not remove existing key/progression highlights.
 * @param {object|null} chord     chord object with .root and .quality; null = clear
 * @param {object|null} activeKey current active key
 */
export function renderChordPreview(chord, activeKey) {
  clearChordPreview();
  if (!chord) return;

  const r = ((chord.root % 12) + 12) % 12;

  // Find the outer segment matching this pitch (both outer and inner segments have data-pitch)
  const seg = _svgEl?.querySelector(`.cof-segment-outer[data-pitch="${r}"]`);
  if (seg) {
    seg.classList.add('cof-preview');
    _previewSegmentEl = seg;
  }

  // Show explanation panel
  const panel = document.getElementById('circle-preview-panel');
  if (!panel) return;
  const { badge, badgeClass, text } = _previewExplanation(chord, activeKey);
  const chordDisplayName = chord.slashName ?? chord.name ?? chord.rootNote ?? CHROMATIC_SHARP[r];
  panel.innerHTML = `
    <span class="preview-chord-name">${chordDisplayName}</span>
    ${badge ? `<span class="preview-badge preview-badge-${badgeClass}">${badge}</span>` : ''}
    <span class="preview-reason">${text}</span>
  `.trim();
  panel.style.display = 'flex';
}

/**
 * Remove the preview highlight and hide the explanation panel.
 */
export function clearChordPreview() {
  if (_previewSegmentEl) {
    _previewSegmentEl.classList.remove('cof-preview');
    _previewSegmentEl = null;
  }
  const panel = document.getElementById('circle-preview-panel');
  if (panel) panel.style.display = 'none';
}

/**
 * Build a human-readable explanation for a chord in the context of the active key.
 * @private
 */
function _previewExplanation(chord, activeKey) {
  if (!activeKey) {
    return { badge: null, badgeClass: '', text: chord.name ?? '' };
  }

  const r = ((chord.root % 12) + 12) % 12;
  const degreeIdx = activeKey.scalePitches.indexOf(r);

  if (degreeIdx !== -1) {
    // Diatonic chord
    const dc = activeKey.diatonicChords.find(d => ((d.root % 12) + 12) % 12 === r);
    const fn = dc?.functionLabel ?? '';
    const numeral = dc?.numeral ?? '';
    const badgeClass = fn.toLowerCase().replace(/[^a-z]/g, '') || 'chromatic';
    const explanation = dc?.explanation ? ` — ${dc.explanation}` : (fn ? ` — ${fn}` : '');
    return {
      badge: fn || null,
      badgeClass,
      text: `${numeral} chord in ${activeKey.name}${explanation}`,
    };
  }

  // Secondary dominant: dom7 whose root is a P4 below a diatonic root (resolves a P5 up)
  if (chord.quality === 'dom7') {
    const resolveTarget = (r + 7) % 12;
    const targetDC = activeKey.diatonicChords.find(dc => ((dc.root % 12) + 12) % 12 === resolveTarget);
    if (targetDC) {
      return {
        badge: 'Secondary Dom',
        badgeClass: 'secondary',
        text: `V7 of ${targetDC.name} — resolves to the ${targetDC.numeral} chord`,
      };
    }
  }

  // Borrowed from parallel key
  const parallelType = activeKey.quality === 'major' ? 'natural_minor' : 'major';
  const parallelName = activeKey.quality === 'major'
    ? activeKey.parallelMinorName
    : activeKey.parallelMajorName;
  const parallelPitches = generateScale(activeKey.root, parallelType);
  if (parallelPitches && parallelPitches.includes(r)) {
    const dir = activeKey.quality === 'major' ? 'minor' : 'major';
    return {
      badge: 'Borrowed',
      badgeClass: 'borrowed',
      text: `Borrowed from ${parallelName ?? 'parallel key'} — the parallel ${dir} key`,
    };
  }

  return {
    badge: 'Chromatic',
    badgeClass: 'chromatic',
    text: `Non-diatonic in ${activeKey.name}`,
  };
}

// ─── Circle Building ──────────────────────────────────────────────────────────

function _buildCircle(svg) {
  // Defs — arc paths that label <textPath> elements reference
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);

  // Centre circle
  const centreCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  centreCircle.setAttribute('cx', CX);
  centreCircle.setAttribute('cy', CY);
  centreCircle.setAttribute('r', R_CENTRE);
  centreCircle.setAttribute('fill', '#1a1a2e');
  centreCircle.setAttribute('stroke', '#2d2d4e');
  centreCircle.setAttribute('stroke-width', '1');
  svg.appendChild(centreCircle);

  for (let pos = 0; pos < 12; pos++) {
    // Outer segment (major key)
    const outerPath = _arcPath(pos, R_MID, R_OUTER);
    const outerSeg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    outerSeg.setAttribute('d', outerPath);
    outerSeg.setAttribute('fill', OUTER_COLORS[pos]);
    outerSeg.setAttribute('stroke', '#0f0f1a');
    outerSeg.setAttribute('stroke-width', '1.5');
    outerSeg.setAttribute('class', `cof-seg cof-segment-outer cof-seg-outer-${pos}`);
    outerSeg.dataset.pos    = pos;
    outerSeg.dataset.pitch  = FIFTHS_ORDER[pos];
    outerSeg.dataset.quality = 'major';
    outerSeg.addEventListener('click', () => _onKeyClick(FIFTHS_ORDER[pos], 'major'));
    svg.appendChild(outerSeg);

    // Inner segment (relative minor)
    const innerPath = _arcPath(pos, R_INNER, R_MID);
    const innerSeg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    innerSeg.setAttribute('d', innerPath);
    innerSeg.setAttribute('fill', INNER_COLORS[pos]);
    innerSeg.setAttribute('stroke', '#0f0f1a');
    innerSeg.setAttribute('stroke-width', '1');
    innerSeg.setAttribute('class', `cof-seg cof-segment-inner cof-seg-inner-${pos}`);
    innerSeg.dataset.pos    = pos;
    innerSeg.dataset.pitch  = FIFTHS_ORDER[pos];
    innerSeg.dataset.quality = 'minor';
    innerSeg.addEventListener('click', () => _onKeyClick(FIFTHS_ORDER[pos], 'minor'));
    svg.appendChild(innerSeg);

    // Arc direction: segments in the bottom/left half need a reversed arc so
    // the text reads left-to-right when viewed from outside the circle.
    const midAngleDeg = pos * 30 - 89;
    const reverse = midAngleDeg > 90 && midAngleDeg < 270;

    const startAngle = (pos * 30 - 90 - 14) * Math.PI / 180;
    const endAngle   = ((pos + 1) * 30 - 90 - 14) * Math.PI / 180;

    // Radius slightly adjusted per direction so the text baseline sits centred
    // in each colour band (on CW arcs glyphs rise outward; on CCW arcs inward).
    const outerLabelR = reverse ? (R_MID + R_OUTER) / 2 + 4 : (R_MID + R_OUTER) / 2 - 4;
    const innerLabelR = reverse ? (R_INNER + R_MID)  / 2 + 3 : (R_INNER + R_MID)  / 2 - 3;

    _defArc(defs, `cof-arc-o-${pos}`, startAngle, endAngle, outerLabelR, reverse);
    _defArc(defs, `cof-arc-i-${pos}`, startAngle, endAngle, innerLabelR, reverse);

    // Major label — flows along the outer ring arc
    const majorLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    majorLabel.setAttribute('class', 'cof-label-outer');
    const outerTP = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
    outerTP.setAttribute('href', `#cof-arc-o-${pos}`);
    outerTP.setAttribute('startOffset', '50%');
    outerTP.textContent = MAJOR_NAMES[pos];
    majorLabel.appendChild(outerTP);
    svg.appendChild(majorLabel);

    // Minor label — flows along the inner ring arc
    const minorLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    minorLabel.setAttribute('class', 'cof-label-inner');
    const innerTP = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
    innerTP.setAttribute('href', `#cof-arc-i-${pos}`);
    innerTP.setAttribute('startOffset', '50%');
    innerTP.textContent = MINOR_NAMES[pos];
    minorLabel.appendChild(innerTP);
    svg.appendChild(minorLabel);
  }

  // Centre text
  const centreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  centreText.setAttribute('x', CX);
  centreText.setAttribute('y', CY);
  centreText.setAttribute('text-anchor', 'middle');
  centreText.setAttribute('dominant-baseline', 'middle');
  centreText.setAttribute('fill', '#5a5a7a');
  centreText.setAttribute('font-size', '9');
  centreText.setAttribute('font-family', 'system-ui, sans-serif');
  centreText.textContent = 'Circle of 5ths';
  svg.appendChild(centreText);
}

/**
 * Append a <path> to defs for use as a textPath guide arc.
 * reverse=true flips the arc direction (for bottom-half segments) so text
 * reads left-to-right when viewed from outside the circle.
 */
function _defArc(defs, id, startAngle, endAngle, r, reverse) {
  const [sx, sy] = _cart(startAngle, r);
  const [ex, ey] = _cart(endAngle,   r);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('id', id);
  path.setAttribute('d', reverse
    ? `M ${ex} ${ey} A ${r} ${r} 0 0 0 ${sx} ${sy}`   // counter-clockwise
    : `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`); // clockwise
  defs.appendChild(path);
}

/**
 * Generate SVG arc path for position pos (0-11) between inner and outer radii
 */
function _arcPath(pos, innerR, outerR) {
  const startAngle = (pos * 30 - 90 - 14) * Math.PI / 180;
  const endAngle   = ((pos + 1) * 30 - 90 - 14) * Math.PI / 180;
  const gap = 0.012; // slight gap between segments

  const [ox1, oy1] = _cart(startAngle + gap, outerR);
  const [ox2, oy2] = _cart(endAngle  - gap, outerR);
  const [ix1, iy1] = _cart(endAngle  - gap, innerR);
  const [ix2, iy2] = _cart(startAngle + gap, innerR);

  return [
    `M ${ox1} ${oy1}`,
    `A ${outerR} ${outerR} 0 0 1 ${ox2} ${oy2}`,
    `L ${ix1} ${iy1}`,
    `A ${innerR} ${innerR} 0 0 0 ${ix2} ${iy2}`,
    'Z',
  ].join(' ');
}

function _cart(angle, r) {
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

