/**
 * SVG Fretboard renderer
 * Strings: index 0 = low E (bottom of SVG), index 5 = high e (top of SVG)
 */

const FRET_COUNT = 22;
const SVG_WIDTH  = 920;
const SVG_HEIGHT = 220;

// Layout constants
const NUT_X        = 60;   // x position of the nut
const BOARD_END_X  = 890;  // x of the last fret
const TOP_Y        = 30;   // y of string 5 (high e, top)
const BOT_Y        = 180;  // y of string 0 (low E, bottom)
const STRING_GAP   = (BOT_Y - TOP_Y) / 5;  // = 30

// Fret position markers (dots at these fret numbers)
const INLAY_FRETS  = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAY = [12];

// Guitar scale length used for fret spacing (normalised to our display width)
const SCALE_LENGTH = BOARD_END_X - NUT_X;

/**
 * Calculate x coordinate for a fret (0 = nut, 1 = first fret, ...)
 * Uses linear spacing so high frets remain readable.
 */
function fretX(fretNum) {
  if (fretNum === 0) return NUT_X;
  return NUT_X + (SCALE_LENGTH / FRET_COUNT) * fretNum;
}

/**
 * Calculate the centre x of a fret slot (between fret n-1 and fret n)
 */
function fretCentreX(fretNum) {
  const left  = fretNum === 1 ? NUT_X : fretX(fretNum - 1);
  const right = fretX(fretNum);
  return (left + right) / 2;
}

/**
 * Y coordinate for a string (index 0 = low E = bottom)
 */
function stringY(stringIdx) {
  // Index 0 is at the bottom (BOT_Y), index 5 at top (TOP_Y)
  return BOT_Y - stringIdx * STRING_GAP;
}

let _onFretClick   = null;
let _onFretHover   = null;
let _svgEl         = null;
let _noteLayer     = null;
let _hoverEl       = null;
let _tuning        = [4, 9, 2, 7, 11, 4]; // standard EADGBE

export function init(containerId, tuning, onFretClick) {
  _tuning      = tuning;
  _onFretClick = onFretClick;

  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = ''; // replace any static placeholder SVG

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'fretboard-svg');
  svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  _svgEl = svg;

  _buildFretboard(svg);

  // Note dot layer (rendered on top of everything)
  _noteLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  _noteLayer.setAttribute('id', 'note-dot-layer');
  svg.appendChild(_noteLayer);

  // Single shared hover ring
  _hoverEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  _hoverEl.setAttribute('class', 'fb-hover-ring');
  _hoverEl.setAttribute('r', '11');
  _hoverEl.style.opacity = '0';
  _hoverEl.style.pointerEvents = 'none';
  svg.appendChild(_hoverEl);

  container.appendChild(svg);

  // Event delegation for clicks and hovers
  svg.addEventListener('click', _handleClick);
  svg.addEventListener('mousemove', _handleHover);
  svg.addEventListener('mouseleave', () => { _hoverEl.style.opacity = '0'; });
}

function _buildFretboard(svg) {
  // Background
  const bg = _el('rect', { class: 'fb-body', x: NUT_X, y: TOP_Y - 8,
    width: BOARD_END_X - NUT_X, height: BOT_Y - TOP_Y + 16, rx: 2 });
  svg.appendChild(bg);

  // Nut
  const nut = _el('line', { class: 'fb-nut', x1: NUT_X, y1: TOP_Y - 6, x2: NUT_X, y2: BOT_Y + 6 });
  svg.appendChild(nut);

  // Fret lines
  for (let f = 1; f <= FRET_COUNT; f++) {
    const x = fretX(f);
    svg.appendChild(_el('line', { class: 'fb-fret', x1: x, y1: TOP_Y - 4, x2: x, y2: BOT_Y + 4 }));
  }

  // Inlay dots
  for (const f of INLAY_FRETS) {
    const x = fretCentreX(f);
    const y = (TOP_Y + BOT_Y) / 2;
    svg.appendChild(_el('circle', { class: 'fb-inlay', cx: x, cy: y, r: 5 }));
  }
  for (const f of DOUBLE_INLAY) {
    const x = fretCentreX(f);
    svg.appendChild(_el('circle', { class: 'fb-inlay', cx: x, cy: (TOP_Y + BOT_Y) / 2 - 12, r: 5 }));
    svg.appendChild(_el('circle', { class: 'fb-inlay', cx: x, cy: (TOP_Y + BOT_Y) / 2 + 12, r: 5 }));
  }

  // String lines and labels
  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    svg.appendChild(_el('line', {
      class: `fb-string-${s}`,
      x1: NUT_X, y1: y, x2: BOARD_END_X, y2: y,
    }));
  }

  // Fret number labels at inlay positions
  for (const f of [5, 7, 9, 12]) {
    const x = fretCentreX(f);
    svg.appendChild(_el('text', { class: 'fb-fret-label', x, y: BOT_Y + 16 }, `${f}`));
  }

  // Hit areas (transparent rectangles over each fret slot × string)
  for (let s = 0; s < 6; s++) {
    const y = stringY(s);

    // Open string hit area (before nut)
    const openHit = _el('rect', {
      class: 'fb-hit',
      'data-string': s, 'data-fret': 0,
      x: 8, y: y - 12, width: NUT_X - 12, height: 24,
    });
    svg.appendChild(openHit);

    // Fretted positions
    for (let f = 1; f <= FRET_COUNT; f++) {
      const xLeft  = f === 1 ? NUT_X : fretX(f - 1);
      const xRight = fretX(f);
      const hit = _el('rect', {
        class: 'fb-hit',
        'data-string': s, 'data-fret': f,
        x: xLeft + 1, y: y - 12, width: xRight - xLeft - 2, height: 24,
      });
      svg.appendChild(hit);
    }
  }
}

function _handleClick(e) {
  const hit = e.target.closest('.fb-hit');
  if (!hit || !_onFretClick) return;
  const string = parseInt(hit.dataset.string, 10);
  const fret   = parseInt(hit.dataset.fret, 10);
  _onFretClick(string, fret);
}

function _handleHover(e) {
  const hit = e.target.closest('.fb-hit');
  if (!hit) { _hoverEl.style.opacity = '0'; return; }
  const string = parseInt(hit.dataset.string, 10);
  const fret   = parseInt(hit.dataset.fret, 10);
  const x = fret === 0 ? NUT_X / 2 : fretCentreX(fret);
  const y = stringY(string);
  _hoverEl.setAttribute('cx', x);
  _hoverEl.setAttribute('cy', y);
  _hoverEl.style.opacity = '1';
}

/**
 * Full re-render of note dots from state
 * @param {number[]} selectedFrets   - [-1=muted, 0=open, 1-22=fret]
 * @param {number[]} tuning
 * @param {number[]|null} scalePitches  - if provided, show scale overlay
 * @param {number|null} tonicPitch
 * @param {number[]} suggestionFrets    - ghost dots for chord suggestion
 * @param {{startFret,endFret}|null} activePosition - when set, restrict scale to this window
 */
export function render(selectedFrets, tuning, scalePitches, tonicPitch, suggestionFrets, activePosition) {
  _tuning = tuning;
  _noteLayer.innerHTML = '';

  // Render string labels (left side) dynamically
  _renderStringLabels(tuning);

  // Dim overlay outside the active position window
  if (scalePitches && scalePitches.length && activePosition) {
    const { startFret, endFret } = activePosition;
    if (startFret > 0) {
      _noteLayer.appendChild(_el('rect', {
        class: 'fb-pos-dim',
        x: NUT_X, y: TOP_Y - 8,
        width: fretX(startFret) - NUT_X,
        height: BOT_Y - TOP_Y + 16,
      }));
    }
    if (endFret < FRET_COUNT) {
      _noteLayer.appendChild(_el('rect', {
        class: 'fb-pos-dim',
        x: fretX(endFret), y: TOP_Y - 8,
        width: BOARD_END_X - fretX(endFret),
        height: BOT_Y - TOP_Y + 16,
      }));
    }
  }

  // Scale overlay first (behind selected notes)
  if (scalePitches && scalePitches.length) {
    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= FRET_COUNT; f++) {
        if (activePosition && (f < activePosition.startFret || f > activePosition.endFret)) continue;
        const pitch = (tuning[s] + f) % 12;
        if (!scalePitches.includes(pitch)) continue;
        if (selectedFrets[s] === f) continue; // will be covered by selected dot
        const x = f === 0 ? NUT_X - (NUT_X - 8) / 2 : fretCentreX(f);
        const y = stringY(s);
        const degree = scalePitches.indexOf(pitch) + 1;
        _addDot(x, y, 8, 'note-dot note-dot-scale', String(degree));
      }
    }
  }

  // Ghost suggestion dots
  if (suggestionFrets) {
    for (let s = 0; s < 6; s++) {
      if (suggestionFrets[s] === -1) continue;
      const f = suggestionFrets[s];
      const x = f === 0 ? NUT_X / 2 : fretCentreX(f);
      const y = stringY(s);
      _addDot(x, y, 10, 'note-dot note-dot-suggestion', '');
    }
  }

  // Selected notes
  for (let s = 0; s < 6; s++) {
    const f = selectedFrets[s];
    const y = stringY(s);

    if (f === -1) {
      // Mute marker: ✕ on the string, left of the nut
      const t = _el('text', { class: 'fb-mute', x: NUT_X / 2, y }, '✕');
      _noteLayer.appendChild(t);
      continue;
    }

    const pitch = (tuning[s] + f) % 12;
    const x = f === 0 ? NUT_X / 2 : fretCentreX(f);

    if (f === 0) {
      // Open string: hollow ring on the string line, left of the nut
      const circle = _el('circle', { class: 'fb-open', cx: x, cy: y, r: 8 });
      _noteLayer.appendChild(circle);
      continue;
    }

    // Determine dot colour class
    let dotClass = 'note-dot note-dot-selected';
    if (tonicPitch !== null && tonicPitch !== undefined && pitch === tonicPitch) {
      dotClass = 'note-dot note-dot-tonic';
    }

    _addDot(x, y, 11, dotClass, null); // label added separately
  }

  // Render open string O markers and mute X markers
  _renderOpenMuteMarkers(selectedFrets);
}

function _renderStringLabels(tuning) {
  // Remove old labels
  document.querySelectorAll('.fb-string-label-dynamic').forEach(el => el.remove());
  const { CHROMATIC_SHARP } = { CHROMATIC_SHARP: ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] };
  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    const note = CHROMATIC_SHARP[tuning[s]];
    const t = _el('text', {
      class: 'fb-string-label fb-string-label-dynamic',
      x: NUT_X - 20, y,
    }, note);
    _noteLayer.appendChild(t);
  }
}

function _renderOpenMuteMarkers(selectedFrets) {
  // Already handled per string in render(); additional markers above nut for open/mute
}

function _addDot(x, y, r, cls, label) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const circle = _el('circle', { class: cls, cx: x, cy: y, r });
  g.appendChild(circle);
  if (label) {
    const labelCls = cls.includes('scale') ? 'note-label note-label-scale' : 'note-label';
    const t = _el('text', { class: labelCls, x, y }, label);
    g.appendChild(t);
  }
  _noteLayer.appendChild(g);
}

function _el(tag, attrs, textContent) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}
