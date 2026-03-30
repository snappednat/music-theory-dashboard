import { NOTE_SELECTOR_OPTIONS, CHROMATIC_SHARP } from '../core/notes.js';
import { setTonePreset, getTonePresetName, TONE_PRESET_LABELS } from '../core/audio.js';

export const TUNING_PRESETS = [
  { label: 'Standard (EADGBE)', tuning: [4, 9, 2, 7, 11, 4] },
  { label: 'Drop D (DADGBE)',   tuning: [2, 9, 2, 7, 11, 4] },
  { label: 'Open G (DGDGBD)',   tuning: [2, 7, 2, 7, 11, 2] },
  { label: 'Open D (DADF#AD)',  tuning: [2, 9, 2, 6, 9, 2] },
  { label: 'DADGAD',           tuning: [2, 9, 2, 7, 9, 2] },
  { label: 'Eb Standard',      tuning: [3, 8, 1, 6, 10, 3] },
  { label: 'Drop C',           tuning: [0, 8, 2, 7, 11, 4] },
  { label: 'B Standard',       tuning: [11, 4, 9, 2, 6, 11] },
  { label: 'A Standard (P5)',  tuning: [9, 2, 7, 0, 4, 9] },
  { label: 'D-G-D-F#-G-G',    tuning: [2, 7, 2, 6, 7, 7] },
];

// String names for UI labels (index 0 = string 6 / low E, index 5 = string 1 / high e)
const STRING_LABELS = ['String 6 (low)', 'String 5', 'String 4', 'String 3', 'String 2', 'String 1 (high)'];

let _onTuningChange = null;
let _currentTuning  = [4, 9, 2, 7, 11, 4];

export function init(onTuningChange, initialTuning) {
  _onTuningChange = onTuningChange;
  _currentTuning  = [...initialTuning];

  _renderPresets();
  _renderToneSelector();
  _renderStringSelectors();
  _initPopovers();
}

function _initPopovers() {
  const pairs = [
    { btnId: 'tuning-icon-btn', popId: 'tuning-popover', otherIds: ['tone-popover', 'capo-popover'],   otherBtnIds: ['tone-icon-btn', 'capo-icon-btn']   },
    { btnId: 'tone-icon-btn',   popId: 'tone-popover',   otherIds: ['tuning-popover', 'capo-popover'], otherBtnIds: ['tuning-icon-btn', 'capo-icon-btn'] },
    { btnId: 'capo-icon-btn',   popId: 'capo-popover',   otherIds: ['tuning-popover', 'tone-popover'], otherBtnIds: ['tuning-icon-btn', 'tone-icon-btn'] },
  ];

  pairs.forEach(({ btnId, popId, otherIds, otherBtnIds }) => {
    const btn = document.getElementById(btnId);
    const pop = document.getElementById(popId);
    if (!btn || !pop) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const opening = pop.hidden;
      // Close all others
      otherIds.forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
      otherBtnIds.forEach(id => document.getElementById(id)?.classList.remove('open'));
      // Toggle self — all three buttons get the .open ring while their popover is open
      pop.hidden = !opening;
      btn.classList.toggle('open', opening);
      if (opening) {
        // Position using fixed coords so it escapes any overflow:hidden ancestor
        const rect = btn.getBoundingClientRect();
        pop.style.top  = (rect.bottom + 8) + 'px';
        pop.style.left = rect.left + 'px';
      }
    });

    // Clicks inside the popover stay inside — don't trigger the outside-close handler
    pop.addEventListener('click', e => e.stopPropagation());
  });

  // Clicking anywhere outside closes all popovers
  document.addEventListener('click', () => {
    document.getElementById('tuning-popover').hidden = true;
    document.getElementById('tone-popover').hidden   = true;
    const capoPop = document.getElementById('capo-popover');
    if (capoPop) capoPop.hidden = true;
    document.getElementById('tuning-icon-btn')?.classList.remove('open');
    document.getElementById('tone-icon-btn')?.classList.remove('open');
    document.getElementById('capo-icon-btn')?.classList.remove('open');
  });
}

function _renderToneSelector() {
  const container = document.getElementById('tone-selector');
  if (!container) return;
  const active = getTonePresetName();
  container.innerHTML = `
    <div class="tuning-tone-row">
      <span class="string-tuning-label" style="margin-bottom:3px">Tone</span>
      <div class="tuning-presets" style="margin:0">
        ${Object.entries(TONE_PRESET_LABELS).map(([key, label]) =>
          `<button class="tuning-preset-btn tone-btn${key === active ? ' active' : ''}" data-tone="${key}">${label}</button>`
        ).join('')}
      </div>
    </div>`;
  container.querySelectorAll('.tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setTonePreset(btn.dataset.tone);
      container.querySelectorAll('.tone-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
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
      // Do NOT fire tuning change here — user must click Apply
      _markPendingChange();
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    container.appendChild(wrapper);
  }

  // Apply button — commits custom string tuning
  const applyBtn = document.createElement('button');
  applyBtn.id = 'tuning-apply-btn';
  applyBtn.className = 'tuning-apply-btn';
  applyBtn.textContent = 'Apply';
  applyBtn.addEventListener('click', () => {
    _onTuningChange([..._currentTuning]);
    _clearPendingChange();
  });
  container.appendChild(applyBtn);
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

function _markPendingChange() {
  document.getElementById('tuning-apply-btn')?.classList.add('pending');
}

function _clearPendingChange() {
  document.getElementById('tuning-apply-btn')?.classList.remove('pending');
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
