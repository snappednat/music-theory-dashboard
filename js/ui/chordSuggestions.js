import { pitchToNoteInKey, CHROMATIC_SHARP } from '../core/notes.js';
import { getCommonVoicing } from '../core/chords.js';
import { DEGREE_FUNCTIONS } from '../core/keys.js';

let _onSuggestionClick = null;

/**
 * Render the diatonic chord suggestion grid for a key
 * @param {object}   key              - key object from buildKey()
 * @param {function} onSuggestionClick - (chord, voicing) => void
 * @param {function} [onHover]        - (chord|null) => void  — fired on mouseenter/mouseleave
 * @param {function} [onLock]         - (chord|null) => void  — fired on click (locks preview)
 */
export function renderChordSuggestions(key, onSuggestionClick, onHover = null, onLock = null) {
  _onSuggestionClick = onSuggestionClick;

  const container = document.getElementById('suggestions-grid');
  if (!container) return;

  if (!key) {
    container.innerHTML = '<div class="key-placeholder">Detect a key to see chord suggestions…</div>';
    return;
  }

  const fns = DEGREE_FUNCTIONS[key.quality] || DEGREE_FUNCTIONS.major;

  const cards = key.diatonicChords.map((chord, i) => {
    const fn = fns[i + 1] || '';
    const fnClass = _fnClass(fn);
    const noteNames = chord.pitches
      .map(p => pitchToNoteInKey(p, key.root))
      .join(' ');

    return `
      <div class="suggestion-card ${fnClass}"
           data-root="${chord.root}"
           data-quality="${chord.quality}"
           data-degree="${chord.degree}"
           title="${chord.name} — ${fn}">
        <div class="suggestion-numeral">${chord.numeral}</div>
        <div class="suggestion-chord-name ${fnClass}">${chord.name}</div>
        <div class="suggestion-notes">${noteNames}</div>
        <div class="suggestion-function">${fn}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = cards;

  // Attach event listeners
  container.querySelectorAll('.suggestion-card').forEach(card => {
    const root   = parseInt(card.dataset.root, 10);
    const degree = card.dataset.degree;
    const chord  = key.diatonicChords.find(c => c.degree === parseInt(degree, 10));

    card.addEventListener('mouseenter', () => onHover?.(chord));
    card.addEventListener('mouseleave', () => onHover?.(null));

    card.addEventListener('click', () => {
      const quality = card.dataset.quality;
      const voicing = getCommonVoicing(root, quality);
      onLock?.(chord);
      if (_onSuggestionClick) _onSuggestionClick(chord, voicing);
    });
  });
}

function _fnClass(fn) {
  if (!fn) return '';
  const f = fn.toLowerCase();
  if (f.includes('tonic'))       return 'fn-tonic';
  if (f.includes('dominant'))    return 'fn-dominant';
  if (f.includes('subdominant')) return 'fn-subdominant';
  if (f.includes('pre-dominant'))return 'fn-subdominant';
  return '';
}
