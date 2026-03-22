/**
 * Harmonic Function Flowchart
 * Interactive SVG showing T → TP → PD → D → T flow with progression trace.
 */

import { getDegreeInKey, getHarmonicFunction, FUNCTION_LABELS, HARMONIC_FUNCTIONS } from '../core/keys.js';
import { normalizePitch } from '../core/notes.js';

/**
 * Render the harmonic function flowchart into #function-flowchart.
 * @param {object|null} key         - active key object
 * @param {object[]}    progression - chord progression array
 * @param {object|null} currentChord - chord currently on fretboard
 */
export function renderFunctionFlowchart(key, progression, currentChord) {
  const container = document.getElementById('function-flowchart');
  if (!container) return;

  if (!key) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = '';

  const funcs = ['T', 'TP', 'PD', 'D'];
  const funcMap = HARMONIC_FUNCTIONS[key.quality] ?? HARMONIC_FUNCTIONS.major;

  // Group diatonic chords by function
  const chordsByFunc = { T: [], TP: [], PD: [], D: [] };
  for (const dc of key.diatonicChords) {
    const fn = funcMap[dc.degree];
    if (fn && chordsByFunc[fn]) {
      chordsByFunc[fn].push(dc);
    }
  }

  // Determine current chord's function (for highlighting)
  let currentFunc = null;
  if (currentChord) {
    const deg = getDegreeInKey(currentChord.root, key);
    if (deg) currentFunc = getHarmonicFunction(deg, key.quality);
  }

  // Build the function trace from progression
  const trace = [];
  for (const chord of progression) {
    if (!chord) continue;
    const deg = getDegreeInKey(chord.root, key);
    if (deg) {
      const fn = getHarmonicFunction(deg, key.quality);
      if (fn) trace.push({ fn, name: chord.name });
      else trace.push({ fn: '?', name: chord.name });
    } else {
      trace.push({ fn: '?', name: chord.name });
    }
  }

  // Build HTML
  let html = '<div class="fn-flow-label section-label" style="margin-bottom:6px">Harmonic Function Flow</div>';

  // SVG flowchart
  const W = 320, H = 60;
  const boxW = 65, boxH = 40;
  const gap = 10;
  const totalW = funcs.length * boxW + (funcs.length - 1) * gap;
  const startX = (W - totalW) / 2;

  html += `<svg class="fn-flow-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Return arrow (D → T) — curved path along the bottom
  const dBoxX = startX + 3 * (boxW + gap);
  const tBoxX = startX;
  html += `<path d="M ${dBoxX + boxW} ${boxH / 2 + 6} Q ${W - 5} ${H + 15}, ${W / 2} ${H - 2} Q ${5} ${H + 15}, ${tBoxX} ${boxH / 2 + 6}"
    fill="none" stroke="${FUNCTION_LABELS.T.color}44" stroke-width="1.5" stroke-dasharray="4,3"
    marker-end="url(#fn-arrow-return)" />`;

  // Arrow marker defs
  html += `<defs>
    <marker id="fn-arrow-fwd" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6" fill="none" stroke="#8888aa" stroke-width="1"/>
    </marker>
    <marker id="fn-arrow-return" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6" fill="none" stroke="${FUNCTION_LABELS.T.color}88" stroke-width="1"/>
    </marker>
  </defs>`;

  funcs.forEach((fn, i) => {
    const x = startX + i * (boxW + gap);
    const y = 3;
    const info = FUNCTION_LABELS[fn];
    const isActive = currentFunc === fn;
    const chords = chordsByFunc[fn] || [];
    const chordStr = chords.map(c => c.numeral).join(', ');

    // Box
    const strokeW = isActive ? 2.5 : 1;
    const opacity = isActive ? 1 : 0.7;
    html += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="6"
      fill="${info.color}${isActive ? '33' : '18'}" stroke="${info.color}" stroke-width="${strokeW}" opacity="${opacity}" />`;

    // Function label
    html += `<text x="${x + boxW / 2}" y="${y + 14}" text-anchor="middle" fill="${info.color}"
      font-size="10" font-weight="700" font-family="system-ui,sans-serif" opacity="${opacity}">${info.name}</text>`;

    // Chord numerals
    html += `<text x="${x + boxW / 2}" y="${y + 28}" text-anchor="middle" fill="#aaa"
      font-size="8" font-family="system-ui,sans-serif">${chordStr}</text>`;

    // Pulse animation on active
    if (isActive) {
      html += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="6"
        fill="none" stroke="${info.color}" stroke-width="2" opacity="0.5">
        <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite"/>
      </rect>`;
    }

    // Forward arrow to next box (except last)
    if (i < funcs.length - 1) {
      const arrowX1 = x + boxW + 1;
      const arrowX2 = x + boxW + gap - 1;
      const arrowY = y + boxH / 2;
      html += `<line x1="${arrowX1}" y1="${arrowY}" x2="${arrowX2}" y2="${arrowY}"
        stroke="#8888aa" stroke-width="1.5" marker-end="url(#fn-arrow-fwd)" />`;
    }
  });

  html += '</svg>';

  // Function trace (if progression exists)
  if (trace.length > 0) {
    html += '<div class="fn-trace">';
    html += '<span class="fn-trace-label">Trace:</span>';
    for (let i = 0; i < trace.length; i++) {
      const t = trace[i];
      const info = FUNCTION_LABELS[t.fn];
      if (info) {
        html += `<span class="fn-trace-badge" style="background:${info.color}33;color:${info.color};border-color:${info.color}55" title="${t.name}">${info.short}</span>`;
      } else {
        html += `<span class="fn-trace-badge fn-trace-chromatic" title="${t.name} (non-diatonic)">?</span>`;
      }
      if (i < trace.length - 1) {
        html += '<span class="fn-trace-arrow">→</span>';
      }
    }
    html += '</div>';
  }

  container.innerHTML = html;
}
