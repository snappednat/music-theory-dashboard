import { pitchToNoteInKey } from '../core/notes.js';
import { getScaleIntervals } from '../core/scales.js';
import { DEGREE_FUNCTIONS, DEGREE_EXPLANATIONS } from '../core/keys.js';

/**
 * Render the scale degree chart table for a key
 */
export function renderScaleDegreeChart(key) {
  const container = document.getElementById('scale-degree-chart');
  if (!container) return;

  if (!key) {
    container.innerHTML = '<div class="key-placeholder">Detect a key to see the scale degree chart…</div>';
    return;
  }

  const intervals = getScaleIntervals(key.quality === 'major' ? 'major' : 'natural_minor');
  const functions = DEGREE_FUNCTIONS[key.quality] || DEGREE_FUNCTIONS.major;
  const explanations = DEGREE_EXPLANATIONS[key.quality] || DEGREE_EXPLANATIONS.major;

  const rows = key.diatonicChords.map((chord, i) => {
    const fn = functions[i + 1] || '';
    const desc = explanations[i + 1] || '';
    const interval = intervals[i] || '';
    const fnClass = _functionClass(fn);

    return `
      <tr>
        <td class="td-numeral ${fnClass}">${chord.numeral}</td>
        <td class="td-note">${chord.rootNote}</td>
        <td class="td-interval">${interval}</td>
        <td class="td-chord ${fnClass}">${chord.name}</td>
        <td class="td-function ${fnClass}">${fn}</td>
        <td class="td-desc">${desc}</td>
      </tr>
    `;
  }).join('');

  // Add harmonic V note for minor keys
  let harmonicVNote = '';
  if (key.harmonicV) {
    harmonicVNote = `
      <tr style="opacity:0.65; font-style:italic;">
        <td class="td-numeral fn-dominant-cell">V *</td>
        <td class="td-note">${key.harmonicV.rootNote}</td>
        <td class="td-interval">P5</td>
        <td class="td-chord fn-dominant-cell">${key.harmonicV.name}</td>
        <td class="td-function fn-dominant-cell">Dominant (harmonic)</td>
        <td class="td-desc">* Borrowed from harmonic minor (raised 7th). Creates a stronger V–i cadence than the natural minor v chord.</td>
      </tr>
    `;
  }

  container.innerHTML = `
    <table class="degree-table">
      <thead>
        <tr>
          <th>Numeral</th>
          <th>Note</th>
          <th>Interval</th>
          <th>Chord</th>
          <th>Function</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${harmonicVNote}
      </tbody>
    </table>
  `;
}

function _functionClass(fn) {
  if (!fn) return '';
  const f = fn.toLowerCase();
  if (f.includes('tonic'))       return 'fn-tonic-cell';
  if (f.includes('dominant'))    return 'fn-dominant-cell';
  if (f.includes('subdominant')) return 'fn-subdominant-cell';
  if (f.includes('pre-dominant'))return 'fn-subdominant-cell';
  return 'fn-other-cell';
}
