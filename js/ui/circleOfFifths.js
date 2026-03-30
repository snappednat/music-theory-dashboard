import { FIFTHS_ORDER, getChordNumeral, buildKey } from '../core/keys.js';
import { CHROMATIC_SHARP } from '../core/notes.js';
import { generateScale, getScaleSuggestions } from '../core/scales.js';

const MAJOR_NAMES = ['C', 'G', 'D', 'A', 'E', 'B', 'F#/Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const MINOR_NAMES = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

// Short display names (no slash for center label)
const MAJOR_SHORT = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const MINOR_SHORT = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

const SVG_SIZE = 380;
const CX = 190, CY = 190;
const R_OUTER  = 155;
const R_MID    = 113;   // invisible split: outer half = major zone, inner half = minor zone
const R_INNER  = 73;
const R_CENTRE = 63;

// Rainbow gradient palette (clockwise from C at top)
const SEGMENT_COLORS = [
  '#1e3a8a',  // C  — deep navy
  '#1d56c5',  // G  — royal blue
  '#2563eb',  // D  — bright blue
  '#4338ca',  // A  — indigo
  '#6d28d9',  // E  — violet
  '#9333ea',  // B  — purple
  '#be185d',  // F#/Gb — deep magenta
  '#c93a20',  // Db — red-orange
  '#e88012',  // Ab — amber
  '#1e3a4a',  // Eb — dark teal
  '#1a2e52',  // Bb — dark navy
  '#1a2e52',  // F  — dark navy
];
const INNER_COLORS = SEGMENT_COLORS.map(c => c + 'cc');

// Decorative 4-pointed sparkles outside the ring
const SPARKLE_DEFS = [
  { angle: -90,  dist: 175, size: 5.5, color: '#22d3ee' },
  { angle: -48,  dist: 187, size: 4,   color: '#2dd4bf' },
  { angle:  20,  dist: 191, size: 3.5, color: '#a78bfa' },
  { angle:  95,  dist: 188, size: 5.5, color: '#c084fc' },
  { angle: 148,  dist: 184, size: 5,   color: '#f472b6' },
  { angle: 200,  dist: 182, size: 7,   color: '#f97316' },
  { angle: 228,  dist: 184, size: 4.5, color: '#ec4899' },
  { angle: 262,  dist: 177, size: 4,   color: '#facc15' },
  { angle: -70,  dist: 183, size: 3,   color: '#f472b6' },
  { angle: -28,  dist: 193, size: 2.5, color: '#60a5fa' },
  { angle:  50,  dist: 190, size: 3,   color: '#818cf8' },
  { angle: 120,  dist: 186, size: 3,   color: '#fb923c' },
  { angle: 168,  dist: 188, size: 4,   color: '#f59e0b' },
  { angle: 243,  dist: 180, size: 2.5, color: '#34d399' },
  { angle: 282,  dist: 184, size: 3,   color: '#a78bfa' },
  { angle: -108, dist: 186, size: 2.5, color: '#38bdf8' },
];

// ─── Module state ──────────────────────────────────────────────────────────────
let _onKeyClick       = null;
let _onChordLoad      = null;   // called when "Often Moves To" chip clicked → load on fretboard
let _svgEl            = null;
let _activeRoot       = null;
let _activeQuality    = null;
let _previewSegmentEl = null;

// New interactive state
let _centerLine1El  = null;   // first tspan in center text
let _centerLine2El  = null;   // second tspan in center text
let _tooltipEl      = null;   // #cof-tooltip div
let _detailCardEl   = null;   // #cof-detail-card div
let _compareRoot    = null;   // first segment in shift-click compare
let _compareQuality = null;
let _compareSegEl   = null;   // DOM element of first compare segment
let _lockedRoot     = null;   // center label locks on click
let _lockedQuality  = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export function init(containerId, onKeyClick, onChordLoad) {
  _onKeyClick  = onKeyClick;
  _onChordLoad = onChordLoad ?? null;
  const container = document.getElementById(containerId);
  if (!container) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'circle-svg');
  svg.setAttribute('viewBox', `0 0 ${SVG_SIZE} ${SVG_SIZE}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  _svgEl = svg;
  _buildCircle(svg);
  container.appendChild(svg);

  // Grab refs to the dynamic elements
  _tooltipEl    = document.getElementById('cof-tooltip');
  _detailCardEl = document.getElementById('cof-detail-card');

  // Wire "Set as Key" delegation on the detail card
  _detailCardEl?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="cof-set-key"]');
    if (!btn) return;
    const root    = parseInt(btn.dataset.root, 10);
    const quality = btn.dataset.quality;
    if (_onKeyClick) _onKeyClick(root, quality, null, true); // 4th arg = forceSet
    clearDetailCard();
  });

  // Escape key clears all overlays
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    _compareRoot = null; _compareQuality = null;
    _clearCompareHighlight();
    _lockedRoot = null; _lockedQuality = null;
    _resetCenterLabel();
    if (_detailCardEl) _detailCardEl.style.display = 'none';
    if (_tooltipEl)    _tooltipEl.style.display    = 'none';
  });
}

/**
 * Enable or disable segment click interactions.
 */
export function setEnabled(enabled) {
  if (!_svgEl) return;
  _svgEl.querySelectorAll('.cof-seg').forEach(seg => {
    seg.style.pointerEvents = enabled ? '' : 'none';
    seg.style.cursor        = enabled ? 'pointer' : 'default';
  });
}

export function highlightKey(rootPitch, quality, activeKey) {
  _activeRoot    = rootPitch;
  _activeQuality = quality;
  if (!_svgEl) return;

  // Update center label to reflect the active key (if not locked on a different segment)
  if (_lockedRoot === null) {
    const pos  = FIFTHS_ORDER.indexOf(rootPitch);
    const name = quality === 'minor' ? MINOR_SHORT[pos] : MAJOR_SHORT[pos];
    const qualStr = quality === 'minor' ? 'Minor' : quality === 'major' ? 'Major' : quality;
    _updateCenterLabel(name, qualStr);
  }

  const activePos = FIFTHS_ORDER.indexOf(rootPitch);

  _svgEl.querySelectorAll('.cof-seg').forEach(seg => {
    seg.classList.remove('cof-active-outer', 'cof-active-inner');
    seg.style.filter  = '';
    seg.style.opacity = '1';
  });
  _svgEl.querySelectorAll('.cof-numeral-label, .cof-prog-badge, .cof-motion-arc').forEach(el => el.remove());

  if (activePos === -1) return;

  if (quality === 'major') {
    const seg = _svgEl.querySelector(`.cof-seg-outer-${activePos}`);
    if (seg) { seg.classList.add('cof-active-outer'); seg.style.filter = 'brightness(1.5)'; }
  } else if (quality === 'minor') {
    const seg = _svgEl.querySelector(`.cof-seg-inner-${activePos}`);
    if (seg) { seg.classList.add('cof-active-inner'); seg.style.filter = 'brightness(1.5)'; }
  } else {
    const seg = _svgEl.querySelector(`.cof-seg-outer-${activePos}`);
    if (seg) { seg.classList.add('cof-active-outer'); seg.style.filter = 'brightness(1.4)'; }
  }

  const dominant    = (activePos + 1) % 12;
  const subdominant = (activePos + 11) % 12;
  for (const pos of [dominant, subdominant]) {
    const seg = _svgEl.querySelector(`.cof-seg-outer-${pos}`);
    if (seg) seg.style.filter = 'brightness(1.2)';
  }

  _updateNumeralLabels(activeKey);
}

function _updateNumeralLabels(activeKey) {
  if (!_svgEl) return;
  _svgEl.querySelectorAll('.cof-numeral-label').forEach(el => el.remove());
  if (!activeKey?.diatonicChords) return;

  const NS        = 'http://www.w3.org/2000/svg';
  const labelR    = (R_MID + R_INNER) / 2;
  const activePos = FIFTHS_ORDER.indexOf(_activeRoot);

  for (const dc of activeKey.diatonicChords) {
    const pos = FIFTHS_ORDER.indexOf(dc.root);
    if (pos === -1) continue;
    const angle = (pos * 30 - 89) * Math.PI / 180;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', CX + labelR * Math.cos(angle));
    t.setAttribute('y', CY + labelR * Math.sin(angle));
    t.setAttribute('class', `cof-numeral-label${pos === activePos ? ' cof-numeral-active' : ''}`);
    t.textContent = dc.numeral;
    _svgEl.appendChild(t);
  }
}

// ─── Arc motion colors ────────────────────────────────────────────────────────

const ARC_COLORS = {
  strong:  '#4ade80',
  circle:  '#22d3ee',
  third:   '#fbbf24',
  second:  '#fb923c',
  tritone: '#f87171',
  weak:    'rgba(200,200,255,0.35)',
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

// ─── Progression highlight ────────────────────────────────────────────────────

export function highlightProgression(chords, activeKey) {
  if (!_svgEl) return;
  _ensureArrowMarkers(_svgEl);

  // Update center to show the active key (if not locked on an exploration click)
  if (_lockedRoot === null && activeKey) {
    const pos  = FIFTHS_ORDER.indexOf(activeKey.root);
    const name = activeKey.quality === 'minor' ? MINOR_SHORT[pos] : MAJOR_SHORT[pos];
    _updateCenterLabel(name, activeKey.quality === 'minor' ? 'Minor' : 'Major');
  }

  const progressionPitches = new Set(chords.map(c => c.root));

  _svgEl.querySelectorAll('.cof-seg').forEach(seg => {
    seg.classList.remove('cof-active-outer', 'cof-active-inner');
    seg.style.filter  = 'brightness(0.4)';
    seg.style.opacity = '0.5';
  });
  _svgEl.querySelectorAll('.cof-prog-badge, .cof-motion-arc').forEach(el => el.remove());

  for (const pitch of progressionPitches) {
    const pos = FIFTHS_ORDER.indexOf(pitch);
    if (pos === -1) continue;
    const outerSeg = _svgEl.querySelector(`.cof-seg-outer-${pos}`);
    const innerSeg = _svgEl.querySelector(`.cof-seg-inner-${pos}`);
    if (outerSeg) { outerSeg.style.filter = 'brightness(1.4)'; outerSeg.style.opacity = '1'; }
    if (innerSeg) { innerSeg.style.filter = 'brightness(1.1)'; innerSeg.style.opacity = '1'; }
  }

  const NS = 'http://www.w3.org/2000/svg';
  chords.forEach((chord, i) => {
    const pos = FIFTHS_ORDER.indexOf(chord.root);
    if (pos === -1) return;
    const midAngle = ((pos * 30 - 90 - 14) + 15) * Math.PI / 180;
    const badgeR   = R_OUTER + 14;
    const bx = CX + badgeR * Math.cos(midAngle);
    const by = CY + badgeR * Math.sin(midAngle);

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'cof-prog-badge');

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', bx); circle.setAttribute('cy', by); circle.setAttribute('r', '10');
    circle.setAttribute('fill', '#1abc9c');
    circle.setAttribute('stroke', '#0f0f1a'); circle.setAttribute('stroke-width', '1');
    g.appendChild(circle);

    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', bx); text.setAttribute('y', by);
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#fff'); text.setAttribute('font-size', '8');
    text.setAttribute('font-weight', 'bold'); text.setAttribute('font-family', 'system-ui, sans-serif');
    text.textContent = String(i + 1);
    g.appendChild(text);

    // Custom tooltip using the existing _tooltipEl (more reliable than SVG <title>)
    g.addEventListener('mouseenter', () => {
      if (!_tooltipEl) return;
      _tooltipEl.innerHTML = `<strong>#${i + 1}: ${chord.slashName ?? chord.name}</strong><br><span style="opacity:0.75">Chord ${i + 1} of ${chords.length} in progression</span>`;
      const containerEl = g.closest('#circle-of-fifths-container');
      if (!containerEl) { _tooltipEl.style.display = ''; return; }
      const cRect = containerEl.getBoundingClientRect();
      const gRect = g.getBoundingClientRect();
      _tooltipEl.style.left      = (gRect.left + gRect.width  / 2 - cRect.left) + 'px';
      _tooltipEl.style.top       = (gRect.top - cRect.top - 8) + 'px';
      _tooltipEl.style.transform = 'translateX(-50%) translateY(-100%)';
      _tooltipEl.style.display   = '';
    });
    g.addEventListener('mouseleave', () => {
      if (_tooltipEl) _tooltipEl.style.display = 'none';
    });

    _svgEl.appendChild(g);
  });

  _updateNumeralLabels(activeKey);

  const arcR = R_MID + 10;
  for (let i = 0; i < chords.length - 1; i++) {
    const A = chords[i], B = chords[i + 1];
    const posA = FIFTHS_ORDER.indexOf(((A.root % 12) + 12) % 12);
    const posB = FIFTHS_ORDER.indexOf(((B.root % 12) + 12) % 12);
    if (posA === -1 || posB === -1 || posA === posB) continue;

    const angleA = ((posA * 30 - 90 - 14) + 15) * Math.PI / 180;
    const angleB = ((posB * 30 - 90 - 14) + 15) * Math.PI / 180;
    const ax = CX + arcR * Math.cos(angleA), ay = CY + arcR * Math.sin(angleA);
    const bx = CX + arcR * Math.cos(angleB), by = CY + arcR * Math.sin(angleB);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const cx2 = mx + (CX - mx) * 0.45, cy2 = my + (CY - my) * 0.45;

    const interval = ((B.root - A.root) % 12 + 12) % 12;
    const colorKey = _motionColorKey(interval);

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d',            `M ${ax} ${ay} Q ${cx2} ${cy2} ${bx} ${by}`);
    path.setAttribute('stroke',       ARC_COLORS[colorKey]);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill',         'none');
    path.setAttribute('marker-end',   `url(#cof-arr-${colorKey})`);
    path.setAttribute('class',        'cof-motion-arc');
    _svgEl.appendChild(path);
  }
}

// ─── Transition panel ─────────────────────────────────────────────────────────

export function renderTransitionPanel(progression, activeKey, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!progression || progression.length < 2) {
    container.innerHTML = ''; container.style.display = 'none'; return;
  }
  container.style.display = '';
  const diatonicRoots = new Set((activeKey?.diatonicChords ?? []).map(c => c.root));
  const transitions = [];
  for (let i = 0; i < progression.length - 1; i++) {
    const A = progression[i], B = progression[i + 1];
    const interval = ((B.root - A.root) % 12 + 12) % 12;
    let label = '', cls = 'transition-neutral';
    if (diatonicRoots.has(B.root)) {
      if (interval === 7)      { label = 'Moving up a 5th — strong dominant motion'; cls = 'transition-dominant'; }
      else if (interval === 5) { label = 'Moving up a 4th — subdominant motion';     cls = 'transition-subdominant'; }
      else if (interval === 9) { label = 'Down to relative minor — tonic function';  cls = 'transition-tonic'; }
      else if (interval === 3) { label = 'Up to relative major — tonic function';    cls = 'transition-tonic'; }
      else                     { label = 'Diatonic step — smooth voice leading';      cls = 'transition-tonic'; }
    } else {
      const next = progression[i + 2];
      if (next && B.quality === 'dom7' && ((next.root - B.root + 12) % 12) === 5) {
        label = `Secondary dominant — V7 of ${next.name ?? CHROMATIC_SHARP[next.root]}`;
        cls = 'transition-secondary';
      } else {
        label = `Borrowed chord — outside the key of ${activeKey?.name ?? 'current key'}`;
        cls = 'transition-borrowed';
      }
    }
    const aName = A.name ?? CHROMATIC_SHARP[A.root];
    const bName = B.name ?? CHROMATIC_SHARP[B.root];
    const key = `${aName}|${bName}|${label}`;
    if (transitions.length > 0 && transitions[transitions.length - 1].key === key) {
      transitions[transitions.length - 1].count++;
    } else {
      transitions.push({ aName, bName, label, cls, key, count: 1 });
    }
  }
  const rows = transitions.map(({ aName, bName, label, cls, count }) => `<div class="transition-row ${cls}">
      <span class="transition-chord">${aName}</span>
      <span class="transition-arrow">→</span>
      <span class="transition-chord">${bName}</span>
      <span class="transition-desc">${label}${count > 1 ? `<span class="transition-count"> ×${count}</span>` : ''}</span>
    </div>`);
  container.innerHTML = `<div class="section-label" style="margin-bottom:6px">Chord Transitions</div>${rows.join('')}`;
}

// ─── Chord preview ────────────────────────────────────────────────────────────

export function renderChordPreview(chord, activeKey) {
  clearChordPreview();
  if (!chord) return;
  const r = ((chord.root % 12) + 12) % 12;
  const seg = _svgEl?.querySelector(`.cof-segment-outer[data-pitch="${r}"]`);
  if (seg) { seg.classList.add('cof-preview'); _previewSegmentEl = seg; }
  // Info shown in the Current Chord panel — no separate preview panel needed
}

export function clearChordPreview() {
  if (_previewSegmentEl) { _previewSegmentEl.classList.remove('cof-preview'); _previewSegmentEl = null; }
}

function _previewExplanation(chord, activeKey) {
  if (!activeKey) return { badge: null, badgeClass: '', text: chord.name ?? '' };
  const r = ((chord.root % 12) + 12) % 12;
  const degreeIdx = activeKey.scalePitches.indexOf(r);
  if (degreeIdx !== -1) {
    const dc = activeKey.diatonicChords.find(d => ((d.root % 12) + 12) % 12 === r);
    const fn = dc?.functionLabel ?? '';
    const numeral = dc?.numeral ?? '';
    const badgeClass = fn.toLowerCase().replace(/[^a-z]/g, '') || 'chromatic';
    const explanation = dc?.explanation ? ` — ${dc.explanation}` : (fn ? ` — ${fn}` : '');
    return { badge: fn || null, badgeClass, text: `${numeral} chord in ${activeKey.name}${explanation}` };
  }
  if (chord.quality === 'dom7') {
    const resolveTarget = (r + 7) % 12;
    const targetDC = activeKey.diatonicChords.find(dc => ((dc.root % 12) + 12) % 12 === resolveTarget);
    if (targetDC) {
      return { badge: 'Secondary Dom', badgeClass: 'secondary', text: `V7 of ${targetDC.name} — resolves to the ${targetDC.numeral} chord` };
    }
  }
  const parallelType    = activeKey.quality === 'major' ? 'natural_minor' : 'major';
  const parallelName    = activeKey.quality === 'major' ? activeKey.parallelMinorName : activeKey.parallelMajorName;
  const parallelPitches = generateScale(activeKey.root, parallelType);
  if (parallelPitches && parallelPitches.includes(r)) {
    const dir = activeKey.quality === 'major' ? 'minor' : 'major';
    return { badge: 'Borrowed', badgeClass: 'borrowed', text: `Borrowed from ${parallelName ?? 'parallel key'} — the parallel ${dir} key` };
  }
  return { badge: 'Chromatic', badgeClass: 'chromatic', text: `Non-diatonic in ${activeKey.name}` };
}

// ─── Detail card ──────────────────────────────────────────────────────────────

// ─── Next chord move table (by scale degree 1–7) ──────────────────────────────
const _NEXT_BY_DEGREE = {
  1: [4, 5, 6, 2],
  2: [5, 4, 1, 6],
  3: [4, 6, 2, 5],
  4: [5, 1, 2, 6],
  5: [1, 6, 2, 4],
  6: [2, 4, 5, 1],
  7: [1, 3],
};

export function showSegmentInfo(rootPitch, quality, activeKey, progression) {
  if (!_detailCardEl) return;

  const pos     = FIFTHS_ORDER.indexOf(rootPitch);
  const keyName = quality === 'minor' ? MINOR_SHORT[pos] : MAJOR_SHORT[pos];
  const keySig  = _getKeySignatureDetail(pos, quality);

  // Build key object for this segment
  let segKey = null;
  try { segKey = buildKey(rootPitch, quality, pos >= 7); } catch (e) { /* ignore */ }

  // Is this segment's root in the progression?
  const inProgression = (progression ?? []).reduce((acc, c, i) => {
    if (((c.root % 12) + 12) % 12 === rootPitch) acc.push(i + 1);
    return acc;
  }, []);

  let html = '';

  // ── Title row ────────────────────────────────────────────────────────────────
  if (activeKey) {
    const dc        = activeKey.diatonicChords?.find(d => ((d.root % 12) + 12) % 12 === rootPitch);
    const numeral   = dc?.numeral ?? getChordNumeral(rootPitch, quality, activeKey) ?? '';
    const funcLabel = dc?.functionLabel ?? '';
    const explanation = dc?.explanation ?? '';

    const titleParts = [keyName];
    if (numeral)   titleParts.push(`<span class="cof-detail-numeral">${numeral}</span>`);
    if (funcLabel) titleParts.push(`<span class="cof-detail-func">${funcLabel}</span>`);
    html += `<div class="cof-detail-title">${titleParts.join(' · ')}</div>`;

    const subParts = [keySig];
    if (segKey?.relativeName) subParts.push(`rel: ${segKey.relativeName}`);
    if (inProgression.length) subParts.push(`chord ${inProgression.join(', ')} in progression`);
    html += `<div class="cof-detail-sub">${subParts.join(' · ')}</div>`;

    if (explanation) html += `<div class="cof-detail-explanation">${explanation}</div>`;
  } else {
    html += `<div class="cof-detail-title">${keyName} <span class="cof-detail-quality">${quality === 'minor' ? 'Minor' : 'Major'}</span></div>`;
    const subParts = [keySig];
    if (segKey?.relativeName) subParts.push(`relative: ${segKey.relativeName}`);
    html += `<div class="cof-detail-sub">${subParts.join(' · ')}</div>`;
  }

  // ── Diatonic chords ──────────────────────────────────────────────────────────
  if (segKey?.diatonicChords?.length) {
    html += `<div class="cof-detail-label">Diatonic chords</div><div class="cof-diatonic-row">`;
    for (const d of segKey.diatonicChords) {
      html += `<span class="cof-diatonic-chip">${d.numeral} ${d.name}</span>`;
    }
    html += `</div>`;
  }

  // ── Neighbor keys ────────────────────────────────────────────────────────────
  if (segKey) {
    const domName = MAJOR_SHORT[FIFTHS_ORDER.indexOf(segKey.dominantRoot)]    ?? '';
    const subName = MAJOR_SHORT[FIFTHS_ORDER.indexOf(segKey.subdominantRoot)] ?? '';
    if (domName || subName) {
      html += `<div class="cof-detail-label">Neighbor keys</div><div class="cof-diatonic-row">`;
      if (subName) html += `<span class="cof-diatonic-chip">${subName} (IV)</span>`;
      if (domName) html += `<span class="cof-diatonic-chip">${domName} (V)</span>`;
      html += `</div>`;
    }
  }

  // ── Borrowed colors ──────────────────────────────────────────────────────────
  if (segKey) {
    const borrowedDefs = quality === 'minor'
      ? [
          { label: 'V7',   root: (rootPitch + 7)  % 12, q: 'major' },
          { label: '♭VII', root: (rootPitch + 10) % 12, q: 'major' },
          { label: '♭VI',  root: (rootPitch + 8)  % 12, q: 'major' },
        ]
      : [
          { label: '♭VII', root: (rootPitch + 10) % 12, q: 'major' },
          { label: 'iv',   root: (rootPitch + 5)  % 12, q: 'minor' },
          { label: '♭VI',  root: (rootPitch + 8)  % 12, q: 'major' },
        ];
    html += `<div class="cof-detail-label">Borrowed colors</div><div class="cof-diatonic-row">`;
    for (const b of borrowedDefs) {
      const bPos  = FIFTHS_ORDER.indexOf(b.root);
      const bName = b.q === 'minor' ? MINOR_SHORT[bPos] : MAJOR_SHORT[bPos];
      html += `<span class="cof-diatonic-chip cof-borrowed">${b.label} ${bName}</span>`;
    }
    html += `</div>`;
  }

  // ── Common cadences ──────────────────────────────────────────────────────────
  if (segKey) {
    const domName   = MAJOR_SHORT[FIFTHS_ORDER.indexOf(segKey.dominantRoot)]    ?? '';
    const subName   = MAJOR_SHORT[FIFTHS_ORDER.indexOf(segKey.subdominantRoot)] ?? '';
    const tonicName = keyName;
    html += `<div class="cof-detail-label">Common cadences</div><div class="cof-diatonic-row">`;
    if (domName)  html += `<span class="cof-cadence-chip">V→I: ${domName}→${tonicName}</span>`;
    if (subName)  html += `<span class="cof-cadence-chip">IV→I: ${subName}→${tonicName}</span>`;
    if (domName)  html += `<span class="cof-cadence-chip">I→V: ${tonicName}→${domName} (half)</span>`;
    html += `</div>`;
  }

  // ── Next chord suggestions (only with active key) ─────────────────────────────
  if (activeKey && segKey) {
    const dc = activeKey.diatonicChords?.find(d => ((d.root % 12) + 12) % 12 === rootPitch);
    const degree = dc?.degree ?? null;
    const nextDegrees = degree ? (_NEXT_BY_DEGREE[degree] ?? []) : [];
    if (nextDegrees.length) {
      html += `<div class="cof-detail-label">Often moves to</div><div class="cof-diatonic-row">`;
      for (const nd of nextDegrees) {
        const nextDC = activeKey.diatonicChords?.find(d => d.degree === nd);
        if (!nextDC) continue;
        const nextPos = FIFTHS_ORDER.indexOf(((nextDC.root % 12) + 12) % 12);
        html += `<button class="cof-next-chip" data-root="${((nextDC.root % 12) + 12) % 12}" data-quality="${nextDC.quality}">${nextDC.name} (${nextDC.numeral})</button>`;
      }
      html += `</div>`;
    }
  }

  // ── Scales (exploration mode only) ───────────────────────────────────────────
  if (!activeKey) {
    const scaleTypes = getScaleSuggestions(quality);
    if (scaleTypes?.length) {
      html += `<div class="cof-detail-label">Suggested scales</div>`;
      html += `<div class="cof-detail-sub">${scaleTypes.slice(0, 3).map(s => (s.type ?? s).replace(/_/g, ' ')).join(' · ')}</div>`;
    }
  }

  // ── Set as Key button ────────────────────────────────────────────────────────
  html += `<button class="cof-detail-set-key-btn" data-action="cof-set-key" data-root="${rootPitch}" data-quality="${quality}">Set as Key</button>`;

  _detailCardEl.innerHTML = html;
  _detailCardEl.style.display = '';

  // Wire next-chip clicks (delegation on the card)
  _detailCardEl.querySelectorAll('.cof-next-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = parseInt(btn.dataset.root, 10);
      const q = btn.dataset.quality;
      // Load the chord onto the fretboard + Current Chord panel
      if (_onChordLoad) _onChordLoad(r, q);
      // Also update the detail card to show info for the navigated chord
      showSegmentInfo(r, q, activeKey, progression);
    });
  });

  // Lock center label to this segment
  _lockedRoot    = rootPitch;
  _lockedQuality = quality;
  const lockedNumeral = activeKey
    ? (activeKey.diatonicChords?.find(d => ((d.root % 12) + 12) % 12 === rootPitch)?.numeral ?? '')
    : '';
  const line2 = lockedNumeral
    ? `${lockedNumeral} in ${activeKey?.shortName ?? ''}`
    : (quality === 'minor' ? 'Minor' : 'Major');
  _updateCenterLabel(keyName, line2);
}

export function clearDetailCard() {
  if (_detailCardEl) _detailCardEl.style.display = 'none';
  _lockedRoot    = null;
  _lockedQuality = null;
  _resetCenterLabel();
}

/**
 * Full state reset — call when the user clears everything (Clear All).
 * Removes all highlights, closes cards, resets center label to default.
 */
export function resetState() {
  _activeRoot    = null;
  _activeQuality = null;
  _lockedRoot    = null;
  _lockedQuality = null;
  _compareRoot   = null;
  _compareQuality = null;
  _clearCompareHighlight();
  if (_detailCardEl) _detailCardEl.style.display = 'none';
  if (_tooltipEl)    _tooltipEl.style.display    = 'none';
  _svgEl?.querySelectorAll('.cof-seg').forEach(seg => {
    seg.classList.remove('cof-active-outer', 'cof-active-inner', 'cof-compare-seg');
    seg.style.filter  = '';
    seg.style.opacity = '1';
  });
  _svgEl?.querySelectorAll('.cof-numeral-label, .cof-prog-badge, .cof-motion-arc').forEach(el => el.remove());
  _resetCenterLabel();
}

// ─── Compare mode ─────────────────────────────────────────────────────────────

export function handleCompareClick(rootPitch, quality) {
  if (_compareRoot === null) {
    // First selection
    _compareRoot    = rootPitch;
    _compareQuality = quality;
    const pos = FIFTHS_ORDER.indexOf(rootPitch);
    const segClass = quality === 'minor' ? `cof-seg-inner-${pos}` : `cof-seg-outer-${pos}`;
    _compareSegEl = _svgEl?.querySelector(`.${segClass}`) ?? null;
    _compareSegEl?.classList.add('cof-compare-seg');
    const name = quality === 'minor' ? MINOR_SHORT[pos] : MAJOR_SHORT[pos];
    _updateCenterLabel('Compare', `+ ${name}`);
  } else {
    // Second selection — render compare card
    _renderCompareCard(_compareRoot, _compareQuality, rootPitch, quality);
    _compareRoot    = null;
    _compareQuality = null;
    _clearCompareHighlight();
  }
}

function _clearCompareHighlight() {
  _compareSegEl?.classList.remove('cof-compare-seg');
  _compareSegEl = null;
}

function _renderCompareCard(root1, quality1, root2, quality2) {
  if (!_detailCardEl) return;
  const pos1 = FIFTHS_ORDER.indexOf(root1);
  const pos2 = FIFTHS_ORDER.indexOf(root2);
  const name1 = quality1 === 'minor' ? MINOR_SHORT[pos1] : MAJOR_SHORT[pos1];
  const name2 = quality2 === 'minor' ? MINOR_SHORT[pos2] : MAJOR_SHORT[pos2];

  // Circle distance (shorter path)
  const raw  = Math.abs(pos1 - pos2);
  const dist = Math.min(raw, 12 - raw);
  const distLabel = dist === 0 ? 'same position'
    : dist === 1 ? '1 fifth apart'
    : `${dist} fifths apart`;

  // Harmonic relationship
  const relLabels = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd',
    'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th'];
  const semitones = ((root2 - root1) % 12 + 12) % 12;
  const relLabel  = relLabels[semitones] ?? '';

  // Shared tones (build triads from each root)
  const triad1 = new Set([root1, (root1 + (quality1 === 'minor' ? 3 : 4)) % 12, (root1 + 7) % 12]);
  const triad2 = new Set([root2, (root2 + (quality2 === 'minor' ? 3 : 4)) % 12, (root2 + 7) % 12]);
  const shared  = [...triad1].filter(p => triad2.has(p)).map(p => CHROMATIC_SHARP[p]);

  const html = `
    <div class="cof-detail-title">Comparing: ${name1} ↔ ${name2}</div>
    <div class="cof-detail-sub">${distLabel} · ${relLabel}</div>
    <div class="cof-diatonic-row">
      <span class="cof-diatonic-chip">${name1}</span>
      <span class="cof-detail-arrow">↔</span>
      <span class="cof-diatonic-chip">${name2}</span>
    </div>
    <div class="cof-detail-label">Shared tones</div>
    <div class="cof-detail-sub">${shared.length ? shared.join(', ') + ` (${shared.length} common)` : 'No common tones'}</div>
    <div class="cof-detail-label">Relationship</div>
    <div class="cof-detail-sub">${relLabel} · ${dist === 1 ? 'Neighbor keys — smooth modulation' : dist <= 2 ? 'Close keys — moderate motion' : 'Distant keys — dramatic motion'}</div>
  `;

  _detailCardEl.innerHTML = html;
  _detailCardEl.style.display = '';
  _updateCenterLabel(`${name1} ↔`, `${name2}`);
}

// ─── Center label helpers ─────────────────────────────────────────────────────

function _updateCenterLabel(line1, line2) {
  if (!_centerLine1El) return;
  _centerLine1El.textContent = line1;
  _centerLine2El.textContent = line2 ?? '';
}

function _resetCenterLabel() {
  if (_activeRoot !== null) {
    // Restore to the active key name (set by highlightKey)
    const pos  = FIFTHS_ORDER.indexOf(_activeRoot);
    const name = _activeQuality === 'minor' ? MINOR_SHORT[pos] : MAJOR_SHORT[pos];
    const qual = _activeQuality === 'minor' ? 'Minor' : 'Major';
    _updateCenterLabel(name, qual);
  } else {
    _updateCenterLabel('CIRCLE', 'tap to explore');
  }
}

// ─── Hover handlers ───────────────────────────────────────────────────────────

function _onSegHover(root, quality, segEl, activeKey) {
  const pos     = FIFTHS_ORDER.indexOf(root);
  const name    = quality === 'minor' ? MINOR_SHORT[pos] : MAJOR_SHORT[pos];
  const qualStr = quality === 'minor' ? 'Minor' : 'Major';

  // Center label (hover preview — only if nothing locked)
  if (_lockedRoot === null && _compareRoot === null) {
    let line2 = qualStr;
    if (activeKey) {
      const dc = activeKey.diatonicChords?.find(d => ((d.root % 12) + 12) % 12 === root);
      const numeral = dc?.numeral;
      if (numeral) line2 = `${numeral} in ${activeKey.shortName ?? activeKey.name}`;
    }
    _updateCenterLabel(name, line2);
  } else if (_compareRoot !== null) {
    // Compare mode hover hint
    const compareName = _compareQuality === 'minor'
      ? MINOR_SHORT[FIFTHS_ORDER.indexOf(_compareRoot)]
      : MAJOR_SHORT[FIFTHS_ORDER.indexOf(_compareRoot)];
    _updateCenterLabel(name, `vs ${compareName}`);
  }

  // Tooltip
  _showTooltip(segEl, root, quality, activeKey);
}

function _onSegLeave() {
  // Restore center label
  if (_lockedRoot !== null) {
    // Restore locked state
    const pos  = FIFTHS_ORDER.indexOf(_lockedRoot);
    const name = _lockedQuality === 'minor' ? MINOR_SHORT[pos] : MAJOR_SHORT[pos];
    _updateCenterLabel(name, _lockedQuality === 'minor' ? 'Minor' : 'Major');
  } else if (_compareRoot !== null) {
    const pos  = FIFTHS_ORDER.indexOf(_compareRoot);
    const name = _compareQuality === 'minor' ? MINOR_SHORT[pos] : MAJOR_SHORT[pos];
    _updateCenterLabel('Compare', `+ ${name}`);
  } else {
    _resetCenterLabel();
  }

  // Hide tooltip
  if (_tooltipEl) _tooltipEl.style.display = 'none';
}

function _showTooltip(segEl, root, quality, activeKey) {
  if (!_tooltipEl || !segEl) return;
  const pos     = FIFTHS_ORDER.indexOf(root);
  const name    = quality === 'minor' ? MINOR_SHORT[pos] : MAJOR_SHORT[pos];
  const qualStr = quality === 'minor' ? 'Minor' : 'Major';

  let line1 = `<strong>${name}</strong> ${qualStr}`;
  let line2  = '';

  if (_compareRoot !== null) {
    const compareName = _compareQuality === 'minor'
      ? MINOR_SHORT[FIFTHS_ORDER.indexOf(_compareRoot)]
      : MAJOR_SHORT[FIFTHS_ORDER.indexOf(_compareRoot)];
    line2 = `Click to compare with ${compareName}`;
  } else if (activeKey) {
    const dc = activeKey.diatonicChords?.find(d => ((d.root % 12) + 12) % 12 === root);
    const numeral   = dc?.numeral;
    const funcLabel = dc?.functionLabel ?? '';
    if (numeral) {
      line1 = `<strong>${name}</strong> · ${numeral} in ${activeKey.shortName ?? activeKey.name}`;
      line2  = funcLabel;
    } else {
      line2 = 'Non-diatonic · click to explore';
    }
  } else {
    line2 = 'Click to explore';
  }

  _tooltipEl.innerHTML = line1 + (line2 ? `<br><span style="opacity:0.75">${line2}</span>` : '');

  const containerEl = segEl.closest('#circle-of-fifths-container');
  if (!containerEl) { _tooltipEl.style.display = ''; return; }

  const containerRect = containerEl.getBoundingClientRect();
  const segRect       = segEl.getBoundingClientRect();
  const x = segRect.left + segRect.width  / 2 - containerRect.left;
  const y = segRect.top                       - containerRect.top - 8;

  _tooltipEl.style.left      = x + 'px';
  _tooltipEl.style.top       = y + 'px';
  _tooltipEl.style.transform = 'translateX(-50%) translateY(-100%)';
  _tooltipEl.style.display   = '';
}

// ─── Key signature helper ─────────────────────────────────────────────────────

const _FLAT_NAMES  = ['Bb','Eb','Ab','Db','Gb','Cb','Fb'];
const _SHARP_NAMES = ['F#','C#','G#','D#','A#','E#','B#'];

function _getKeySigPos(circlePos, quality) {
  let pos = circlePos;
  if (quality === 'minor') {
    const minorRoot  = FIFTHS_ORDER[circlePos];
    const relMajRoot = (minorRoot + 3) % 12;
    pos = FIFTHS_ORDER.indexOf(relMajRoot);
    if (pos === -1) pos = circlePos;
  }
  return pos;
}

function _getKeySignatureString(circlePos, quality) {
  const pos = _getKeySigPos(circlePos, quality);
  if (pos === 0)  return 'no key sig';
  if (pos <= 6)   return `${pos}♯`;
  return `${12 - pos}♭`;
}

function _getKeySignatureDetail(circlePos, quality) {
  const pos = _getKeySigPos(circlePos, quality);
  if (pos === 0)  return 'no sharps or flats';
  if (pos <= 6) {
    const notes = _SHARP_NAMES.slice(0, pos).join(' · ');
    return `${pos}♯: ${notes}`;
  }
  const n = 12 - pos;
  const notes = _FLAT_NAMES.slice(0, n).join(' · ');
  return `${n}♭: ${notes}`;
}

// ─── Circle build ─────────────────────────────────────────────────────────────

function _buildCircle(svg) {
  const NS = 'http://www.w3.org/2000/svg';

  // Gradient def for center circle
  const defs = document.createElementNS(NS, 'defs');
  const grad = document.createElementNS(NS, 'radialGradient');
  grad.setAttribute('id', 'cof-center-grad');
  grad.setAttribute('cx', '40%'); grad.setAttribute('cy', '35%'); grad.setAttribute('r', '70%');
  for (const [offset, color] of [['0%', '#1c2f6a'], ['100%', '#080d1a']]) {
    const s = document.createElementNS(NS, 'stop');
    s.setAttribute('offset', offset); s.setAttribute('stop-color', color);
    grad.appendChild(s);
  }
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Sparkles (drawn behind segments)
  for (const sp of SPARKLE_DEFS) {
    const rad = sp.angle * Math.PI / 180;
    _addSparkle(svg, NS, CX + sp.dist * Math.cos(rad), CY + sp.dist * Math.sin(rad), sp.size, sp.color);
  }

  // 12 ring segments
  for (let pos = 0; pos < 12; pos++) {
    const root = FIFTHS_ORDER[pos];

    // Outer half (major zone): R_MID → R_OUTER
    const outerSeg = document.createElementNS(NS, 'path');
    outerSeg.setAttribute('d',            _arcPath(pos, R_MID, R_OUTER));
    outerSeg.setAttribute('fill',         SEGMENT_COLORS[pos]);
    outerSeg.setAttribute('stroke',       '#0d1327');
    outerSeg.setAttribute('stroke-width', '1.5');
    outerSeg.setAttribute('class', `cof-seg cof-segment-outer cof-seg-outer-${pos}`);
    outerSeg.dataset.pos = pos; outerSeg.dataset.pitch = root; outerSeg.dataset.quality = 'major';
    outerSeg.addEventListener('click', e => _onKeyClick && _onKeyClick(root, 'major', e));
    outerSeg.addEventListener('mouseenter', () => _onSegHover(root, 'major', outerSeg, _currentActiveKey()));
    outerSeg.addEventListener('mouseleave', _onSegLeave);
    svg.appendChild(outerSeg);

    // Inner half (minor zone): R_INNER → R_MID
    const innerSeg = document.createElementNS(NS, 'path');
    innerSeg.setAttribute('d',            _arcPath(pos, R_INNER, R_MID));
    innerSeg.setAttribute('fill',         INNER_COLORS[pos]);
    innerSeg.setAttribute('stroke',       '#0d1327');
    innerSeg.setAttribute('stroke-width', '1');
    innerSeg.setAttribute('class', `cof-seg cof-segment-inner cof-seg-inner-${pos}`);
    innerSeg.dataset.pos = pos; innerSeg.dataset.pitch = root; innerSeg.dataset.quality = 'minor';
    innerSeg.addEventListener('click', e => _onKeyClick && _onKeyClick(root, 'minor', e));
    innerSeg.addEventListener('mouseenter', () => _onSegHover(root, 'minor', innerSeg, _currentActiveKey()));
    innerSeg.addEventListener('mouseleave', _onSegLeave);
    svg.appendChild(innerSeg);

    // Upright text labels centered in each zone
    const midAngle = (pos * 30 - 89) * Math.PI / 180;

    const majorLabel = document.createElementNS(NS, 'text');
    majorLabel.setAttribute('x', CX + ((R_MID + R_OUTER) / 2) * Math.cos(midAngle));
    majorLabel.setAttribute('y', CY + ((R_MID + R_OUTER) / 2) * Math.sin(midAngle));
    majorLabel.setAttribute('class', 'cof-label-major');
    majorLabel.setAttribute('pointer-events', 'none');
    majorLabel.textContent = MAJOR_NAMES[pos];
    svg.appendChild(majorLabel);

    const minorLabel = document.createElementNS(NS, 'text');
    minorLabel.setAttribute('x', CX + ((R_INNER + R_MID) / 2) * Math.cos(midAngle));
    minorLabel.setAttribute('y', CY + ((R_INNER + R_MID) / 2) * Math.sin(midAngle));
    minorLabel.setAttribute('class', 'cof-label-minor');
    minorLabel.setAttribute('pointer-events', 'none');
    minorLabel.textContent = MINOR_NAMES[pos];
    svg.appendChild(minorLabel);
  }

  // Center dark circle with gradient
  const centreCircle = document.createElementNS(NS, 'circle');
  centreCircle.setAttribute('cx', CX); centreCircle.setAttribute('cy', CY);
  centreCircle.setAttribute('r', R_CENTRE);
  centreCircle.setAttribute('fill', 'url(#cof-center-grad)');
  centreCircle.setAttribute('stroke', '#1a2a50'); centreCircle.setAttribute('stroke-width', '1.5');
  centreCircle.setAttribute('pointer-events', 'none');
  svg.appendChild(centreCircle);

  // Dynamic center text — store tspan refs
  const centerText = document.createElementNS(NS, 'text');
  centerText.setAttribute('class', 'cof-center-text');
  centerText.setAttribute('pointer-events', 'none');
  const line1 = document.createElementNS(NS, 'tspan');
  line1.setAttribute('x', CX); line1.setAttribute('y', CY - 7); line1.textContent = 'CIRCLE';
  centerText.appendChild(line1);
  const line2 = document.createElementNS(NS, 'tspan');
  line2.setAttribute('x', CX); line2.setAttribute('dy', '14'); line2.textContent = 'OF FIFTHS';
  centerText.appendChild(line2);
  svg.appendChild(centerText);

  // Store refs for dynamic updates
  _centerLine1El = line1;
  _centerLine2El = line2;
}

// ─── Active key accessor (avoids circular imports) ────────────────────────────
// The hover handler needs activeKey but the module doesn't own it.
// We store a reference that app.js updates via setActiveKeyRef().
let _activeKeyRef = null;
export function setActiveKeyRef(key) { _activeKeyRef = key; }
function _currentActiveKey() { return _activeKeyRef; }

function _addSparkle(svg, NS, cx, cy, size, color) {
  const t = size * 0.18;
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', `M ${cx} ${cy - size} Q ${cx + t} ${cy - t} ${cx + size} ${cy} Q ${cx + t} ${cy + t} ${cx} ${cy + size} Q ${cx - t} ${cy + t} ${cx - size} ${cy} Q ${cx - t} ${cy - t} ${cx} ${cy - size} Z`);
  path.setAttribute('fill', color);
  path.setAttribute('pointer-events', 'none');
  svg.appendChild(path);
}

function _arcPath(pos, innerR, outerR) {
  const startAngle = (pos * 30 - 90 - 14) * Math.PI / 180;
  const endAngle   = ((pos + 1) * 30 - 90 - 14) * Math.PI / 180;
  const gap = 0.012;
  const [ox1, oy1] = _cart(startAngle + gap, outerR);
  const [ox2, oy2] = _cart(endAngle   - gap, outerR);
  const [ix1, iy1] = _cart(endAngle   - gap, innerR);
  const [ix2, iy2] = _cart(startAngle + gap, innerR);
  return `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 0 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 0 0 ${ix2} ${iy2} Z`;
}

function _cart(angle, r) {
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}
