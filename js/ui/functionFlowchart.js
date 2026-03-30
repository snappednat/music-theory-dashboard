/**
 * Harmonic Function Flowchart
 * Interactive SVG showing T → TP → PD → D → T flow with progression trace.
 */

import { getDegreeInKey, getHarmonicFunction, HARMONIC_FUNCTIONS } from '../core/keys.js';

// Fretty-branded colors matching the circle of fifths rainbow palette
const FLOW_STYLES = {
  T:  { line1: 'Tonic',     line2: null,           short: 'T',  color: '#2563eb' },
  TP: { line1: 'Tonic',     line2: 'Prolongation', short: 'TP', color: '#9333ea' },
  PD: { line1: 'Pre-',      line2: 'Dominant',     short: 'PD', color: '#ec4899' },
  D:  { line1: 'Dominant',  line2: null,            short: 'D',  color: '#f97316' },
};

const FUNCS  = ['T', 'TP', 'PD', 'D'];
const W      = 360;
const H      = 90;
const BOX_W  = 78;
const BOX_H  = 56;
const GAP    = 12;
const TOTAL_W = FUNCS.length * BOX_W + (FUNCS.length - 1) * GAP;
const START_X = (W - TOTAL_W) / 2;

export function renderFunctionFlowchart(key, progression, currentChord) {
  const container = document.getElementById('function-flowchart');
  if (!container) return;

  if (!key) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = '';

  const funcMap = HARMONIC_FUNCTIONS[key.quality] ?? HARMONIC_FUNCTIONS.major;

  // Group diatonic chords by function
  const chordsByFunc = { T: [], TP: [], PD: [], D: [] };
  for (const dc of key.diatonicChords) {
    const fn = funcMap[dc.degree];
    if (fn && chordsByFunc[fn]) chordsByFunc[fn].push(dc);
  }

  // Current chord's function (for pulse highlight)
  let currentFunc = null;
  if (currentChord) {
    const deg = getDegreeInKey(currentChord.root, key);
    if (deg) currentFunc = getHarmonicFunction(deg, key.quality);
  }

  // Build progression trace
  const trace = [];
  for (const chord of progression) {
    if (!chord) continue;
    const deg = getDegreeInKey(chord.root, key);
    if (deg) {
      const fn = getHarmonicFunction(deg, key.quality);
      trace.push({ fn: fn ?? '?', name: chord.slashName ?? chord.name });
    } else {
      trace.push({ fn: '?', name: chord.slashName ?? chord.name });
    }
  }

  // ── SVG ──────────────────────────────────────────────────────────────────
  let svg = `<svg class="fn-flow-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Defs: arrowhead markers
  svg += `<defs>
    <marker id="fn-arr-fwd" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
      <path d="M0,0.5 L5,3.5 L0,6.5" fill="none" stroke="#6b7280" stroke-width="1.2"/>
    </marker>
    <marker id="fn-arr-ret" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
      <path d="M0,0.5 L5,3.5 L0,6.5" fill="none" stroke="${FLOW_STYLES.T.color}88" stroke-width="1.2"/>
    </marker>
  </defs>`;

  // Return arc (D → T) along the bottom
  const dBoxRight = START_X + 3 * (BOX_W + GAP) + BOX_W;
  const tBoxLeft  = START_X;
  const arcMidY   = H - 6;
  svg += `<path d="M ${dBoxRight} ${BOX_H / 2 + 8} Q ${dBoxRight + 12} ${arcMidY + 12} ${W / 2} ${arcMidY} Q ${tBoxLeft - 12} ${arcMidY + 12} ${tBoxLeft} ${BOX_H / 2 + 8}"
    fill="none" stroke="${FLOW_STYLES.T.color}44" stroke-width="1.5" stroke-dasharray="4,3"
    marker-end="url(#fn-arr-ret)"/>`;

  // Boxes
  FUNCS.forEach((fn, i) => {
    const x    = START_X + i * (BOX_W + GAP);
    const y    = 3;
    const st   = FLOW_STYLES[fn];
    const isActive = currentFunc === fn;
    const chordStr = (chordsByFunc[fn] ?? []).map(c => c.numeral).join(', ');
    const fillOpacity = isActive ? '33' : '1a';
    const strokeW     = isActive ? 2.5 : 1.2;
    const textOpacity = isActive ? 1 : 0.85;

    // Box fill + border
    svg += `<rect x="${x}" y="${y}" width="${BOX_W}" height="${BOX_H}" rx="8"
      fill="${st.color}${fillOpacity}" stroke="${st.color}" stroke-width="${strokeW}" opacity="${textOpacity}"/>`;

    // Pulse ring on active
    if (isActive) {
      svg += `<rect x="${x}" y="${y}" width="${BOX_W}" height="${BOX_H}" rx="8"
        fill="none" stroke="${st.color}" stroke-width="2" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.05;0.4" dur="2s" repeatCount="indefinite"/>
      </rect>`;
    }

    // Function name — one or two lines
    if (st.line2) {
      // Two-line name (e.g. "Tonic" / "Prolongation" or "Pre-" / "Dominant")
      svg += `<text x="${x + BOX_W / 2}" y="${y + 15}" text-anchor="middle"
        fill="${st.color}" font-size="9.5" font-weight="700" font-family="system-ui,sans-serif"
        opacity="${textOpacity}">${st.line1}</text>`;
      svg += `<text x="${x + BOX_W / 2}" y="${y + 26}" text-anchor="middle"
        fill="${st.color}" font-size="9.5" font-weight="700" font-family="system-ui,sans-serif"
        opacity="${textOpacity}">${st.line2}</text>`;
    } else {
      // Single-line name, vertically centered higher
      svg += `<text x="${x + BOX_W / 2}" y="${y + 21}" text-anchor="middle"
        fill="${st.color}" font-size="9.5" font-weight="700" font-family="system-ui,sans-serif"
        opacity="${textOpacity}">${st.line1}</text>`;
    }

    // Chord numerals
    svg += `<text x="${x + BOX_W / 2}" y="${y + 42}" text-anchor="middle"
      fill="rgba(255,255,255,0.65)" font-size="8.5" font-family="system-ui,sans-serif"
      opacity="${textOpacity}">${chordStr}</text>`;

    // Forward arrow to next box
    if (i < FUNCS.length - 1) {
      const ax1 = x + BOX_W + 2;
      const ax2 = x + BOX_W + GAP - 2;
      const ay  = y + BOX_H / 2;
      svg += `<line x1="${ax1}" y1="${ay}" x2="${ax2}" y2="${ay}"
        stroke="#6b7280" stroke-width="1.5" marker-end="url(#fn-arr-fwd)"/>`;
    }
  });

  svg += '</svg>';

  // ── Trace row ─────────────────────────────────────────────────────────────
  let traceHtml = '';
  if (trace.length > 0) {
    const badges = trace.map((t, i) => {
      const st = FLOW_STYLES[t.fn];
      const badge = st
        ? `<span class="fn-trace-badge" style="background:${st.color}30;color:${st.color};border-color:${st.color}60" title="${t.name}">${st.short}</span>`
        : `<span class="fn-trace-badge fn-trace-chromatic" title="${t.name} (non-diatonic)">?</span>`;
      const arrow = i < trace.length - 1 ? '<span class="fn-trace-arrow">→</span>' : '';
      return badge + arrow;
    }).join('');
    traceHtml = `<div class="fn-trace"><span class="fn-trace-label">Trace:</span>${badges}</div>`;
  }

  container.innerHTML = svg + traceHtml;
}
