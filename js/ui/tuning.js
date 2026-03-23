import { NOTE_SELECTOR_OPTIONS, CHROMATIC_SHARP } from '../core/notes.js';

export const TUNING_PRESETS = [
  { label: 'Standard (EADGBE)', tuning: [4, 9, 2, 7, 11, 4] },
  { label: 'Drop D (DADGBE)',   tuning: [2, 9, 2, 7, 11, 4] },
  { label: 'Open G (DGDGBD)',   tuning: [2, 7, 2, 7, 11, 2] },
  { label: 'Open D (DADF#AD)',  tuning: [2, 9, 2, 6, 9, 2] },
  { label: 'DADGAD',           tuning: [2, 9, 2, 7, 9, 2] },
  { label: 'Eb Standard',      tuning: [3, 8, 1, 6, 10, 3] },
  { label: 'Drop C',           tuning: [0, 8, 2, 7, 11, 4] },
];

// String names for UI labels (index 0 = string 6 / low E, index 5 = string 1 / high e)
const STRING_LABELS = ['String 6 (low)', 'String 5', 'String 4', 'String 3', 'String 2', 'String 1 (high)'];

let _onTuningChange = null;
let _currentTuning  = [4, 9, 2, 7, 11, 4];

export function init(onTuningChange, initialTuning) {
  _onTuningChange = onTuningChange;
  _currentTuning  = [...initialTuning];

  _renderPresets();
  _renderStringSelectors();
}

function _renderPresets() {
  const container = document.getElementById('tuning-presets');
  if (!container) return;
  container.innerHTML = '';

  for (const preset of TUNING_PRESETS) {
    const btn = document.createElement('button');
    btn.className = 'tuning-preset-btn';
    btn.textContent = preset.label;
    btn.dataset.tuning = JSON.stringify(preset.tuning);
    btn.addEventListener('click', () => {
      _currentTuning = [...preset.tuning];
      _syncSelectors();
      _highlightActivePreset(btn);
      _onTuningChange([..._currentTuning]);
    });
    container.appendChild(btn);
  }

  _highlightActivePreset(null);
}

function _renderStringSelectors() {
  const container = document.getElementById('tuning-strings');
  if (!container) return;
  container.innerHTML = '';

  // Render from string 0 (low E, index 0) up to string 5 (high e, index 5)
  // so String 6 (low E) appears first and String 1 (high e) appears last
  for (let s = 0; s <= 5; s++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'string-tuning';

    const label = document.createElement('div');
    label.className = 'string-tuning-label';
    label.textContent = STRING_LABELS[s];

    const select = document.createElement('select');
    select.className = 'string-tuning-select';
    select.dataset.stringIdx = s;

    for (const opt of NOTE_SELECTOR_OPTIONS) {
      const option = document.createElement('option');
      option.value = opt.pitch;
      option.textContent = opt.label;
      if (opt.pitch === _currentTuning[s]) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      _currentTuning[s] = parseInt(select.value, 10);
      _checkPresetMatch();
      _onTuningChange([..._currentTuning]);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    container.appendChild(wrapper);
  }
}

function _syncSelectors() {
  const selects = document.querySelectorAll('.string-tuning-select');
  for (const sel of selects) {
    const idx = parseInt(sel.dataset.stringIdx, 10);
    sel.value = _currentTuning[idx];
  }
}

function _highlightActivePreset(activeBtn) {
  document.querySelectorAll('.tuning-preset-btn').forEach(b => b.classList.remove('active'));
  if (activeBtn) activeBtn.classList.add('active');
}

function _checkPresetMatch() {
  // Find if current tuning matches a preset; if so, highlight it
  let matched = null;
  const btns = document.querySelectorAll('.tuning-preset-btn');
  btns.forEach(btn => {
    const presetTuning = JSON.parse(btn.dataset.tuning);
    if (presetTuning.every((p, i) => p === _currentTuning[i])) {
      matched = btn;
    }
  });
  _highlightActivePreset(matched);
}

export function getTuning() { return [..._currentTuning]; }

export function setTuning(tuning) {
  _currentTuning = [...tuning];
  _syncSelectors();
  _checkPresetMatch();
}
