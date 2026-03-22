/**
 * Guitar Music Theory Dashboard — Main Application Controller
 * Owns AppState, wires all modules together, drives the analysis pipeline.
 */

import * as Fretboard    from './ui/fretboard.js';
import * as TuningUI     from './ui/tuning.js';
import * as TabDisplay   from './ui/tabDisplay.js';
import * as CircleOfFifths from './ui/circleOfFifths.js';
import * as ScaleDegreeChart from './ui/scaleDegreeChart.js';
import * as ChordSuggestions from './ui/chordSuggestions.js';
import { renderKeyPanel }    from './panels/keyPanel.js';
import { renderTheoryPanel, renderProgressionStory, _chordRichness } from './panels/theoryPanel.js';
import { renderRelationshipAnalyzer } from './panels/relationshipAnalyzer.js';
import { renderScaleSuggestions } from './ui/scaleSuggestions.js';
import { renderVoicingExplorer }  from './ui/voicingExplorer.js';
import { renderChordIdeas }       from './ui/chordIdeas.js';
import { renderFunctionFlowchart } from './ui/functionFlowchart.js';
import { openGlossaryModal, renderGlossaryModal } from './ui/glossaryModal.js';

import { fretboardToPitches, identifyChord, CHORD_SUFFIXES, generateVoicings, parseChordName } from './core/chords.js';
import { playChord, playProgression, stopPlayback } from './core/audio.js';
import { detectKey, buildKey, getChordNumeral, detectModulations, countProgressionAccidentals } from './core/keys.js';
import { detectCadences } from './core/cadences.js';
import { detectPatterns, NAMED_PROGRESSIONS } from './core/progressions.js';
import { SONG_FORMS, instantiateForm } from './core/forms.js';
import { generateScale, SCALE_DISPLAY_NAMES, SCALE_GROUPS } from './core/scales.js';
import { parseTabString }                    from './ui/tabDisplay.js';
import { CHROMATIC_SHARP, pitchToNoteInKey }  from './core/notes.js';

// ─── Application State ────────────────────────────────
const AppState = {
  tuning:         [4, 9, 2, 7, 11, 4], // pitch class per string; index 0 = low E
  selectedFrets:  [-1, -1, -1, -1, -1, -1],
  progression:    [],        // flat array of chord objects (all sections combined)
  sections: [],              // ordered list of song sections (empty until first chord added)
  sectionCounts:  {}, // for auto-incrementing labels
  activeSection:  null, // which section the "Add" button targets
  sectionKeys:    {},        // { sectionId: {key, confidence} | null }
  currentChord:   null,      // chord object for current fretboard state
  keyResults:     [],        // [{key, confidence}] from detectKey()
  activeKey:      null,      // key object currently displayed (from keyResults or user pick)
  keyOverridden:  false,     // true when user has manually chosen a key (suppresses auto-update)
  cadences:       [],        // CadenceResult[] from detectCadences()
  detectedPatterns: [],      // PatternMatch[] from detectPatterns()
  modulations:    [],        // ModulationResult[] from detectModulations()
  selectedChordIndices: [],  // indices of Ctrl+clicked chips for relationship analyzer
  selectedProgressionIdx: null, // index of progression chip loaded onto fretboard (for replace mode)
  activeScale:    null,      // { type, pitches } or null
  showScale:      false,
  suggestionFrets: null,     // ghost voicing from suggestion click
  activePosition:  null,     // { startFret, endFret } for scale position box
  explorerChord:   null,     // chord shown in voicing explorer
  previewChord:         null,   // chord being hovered/previewed on circle
  previewLocked:        false,  // true once user has clicked (locks preview in place)
  isPlayingProgression: false,  // true while progression sequence is playing
};

// ─── Drag-to-reorder state ──────────────────────────────
let _dragSrcIdx    = null;  // flat AppState.progression index of the chip being dragged
let _dragOverEl    = null;  // chip element currently showing a drop indicator
let _dragSectionId = null;  // section id being dragged in the tab bar

// Normalize a chord's section field to a valid section ID.
// Old data may store bare type names ('verse' → 'verse-1').
function _sectionOf(chord) {
  const s = chord.section;
  if (!s) return 'verse-1';
  return s.includes('-') ? s : s + '-1';
}

// ─── Initialisation ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Init fretboard
  Fretboard.init('fretboard-container', AppState.tuning, onFretClick);

  // Init tuning controls
  TuningUI.init(onTuningChange, AppState.tuning);

  // Init circle of fifths
  CircleOfFifths.init('circle-of-fifths-container', onCircleKeyClick);

  // Scale type buttons
  _buildScaleTypeButtons();

  // Wire buttons
  document.getElementById('btn-play-progression')?.addEventListener('click', _toggleProgressionPlayback);
  document.getElementById('btn-play-current')?.addEventListener('click', () => {
    if (AppState.selectedFrets.some(f => f >= 0)) playChord(AppState.selectedFrets, AppState.tuning);
  });
  document.getElementById('btn-shift-down')?.addEventListener('click', () => _shiftChordShape(-1));
  document.getElementById('btn-shift-up')?.addEventListener('click',   () => _shiftChordShape(+1));
  document.getElementById('btn-glossary')?.addEventListener('click', () => openGlossaryModal(AppState));

  // ── Ctrl+click selection — handled on mousedown so it fires BEFORE the browser
  //    can interpret the event as a "copy drag" on draggable="true" chips.
  document.getElementById('chord-chips')?.addEventListener('mousedown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;      // only intercept ctrl/cmd clicks
    if (e.button !== 0) return;                 // left-button only
    const chip = e.target.closest('.chord-chip');
    if (!chip) return;
    e.preventDefault();                         // stops drag-copy and text-selection
    const idx = parseInt(chip.dataset.idx, 10);
    const pos = AppState.selectedChordIndices.indexOf(idx);
    if (pos >= 0) AppState.selectedChordIndices.splice(pos, 1);
    else          AppState.selectedChordIndices.push(idx);
    _renderProgressionChips();
    renderRelationshipAnalyzer(AppState.activeKey, AppState.progression, AppState.selectedChordIndices);
  });

  // ── Progression chip delegation (wired once — avoids accumulation bug) ──
  document.getElementById('chord-chips')?.addEventListener('click', e => {
    // Ctrl/Cmd clicks are already handled in mousedown above — skip them here
    if (e.ctrlKey || e.metaKey) return;

    const chipPlayBtn = e.target.closest('.chip-play-btn');
    if (chipPlayBtn) {
      e.stopPropagation();
      const idx    = parseInt(chipPlayBtn.dataset.idx, 10);
      const stored = AppState.progression[idx];
      if (stored?.frets) playChord(stored.frets, AppState.tuning);
      return;
    }
    const removeBtn = e.target.closest('.chip-remove');
    if (removeBtn) {
      const idx = parseInt(removeBtn.dataset.remove, 10);
      AppState.progression.splice(idx, 1);
      // If the removed chip was loaded, exit replace mode
      if (AppState.selectedProgressionIdx !== null) {
        if (AppState.selectedProgressionIdx === idx) AppState.selectedProgressionIdx = null;
        else if (AppState.selectedProgressionIdx > idx) AppState.selectedProgressionIdx--;
      }
      _analyzeAndRender();
      _updateAddButton();
      return;
    }
    const chip = e.target.closest('.chord-chip');
    if (chip) {
      // Normal click: load chord onto fretboard
      const idx = parseInt(chip.dataset.idx, 10);
      const stored = AppState.progression[idx];
      if (stored) {
        // Use stored frets; if all muted (template chord), auto-generate a voicing
        let frets = stored.frets?.slice() ?? [-1, -1, -1, -1, -1, -1];
        if (frets.every(f => f === -1)) {
          const voicings = generateVoicings(stored.root, stored.quality, AppState.tuning);
          if (voicings.length > 0) frets = voicings[0].frets.slice();
        }
        AppState.selectedFrets          = frets;
        AppState.currentChord           = stored;
        AppState.suggestionFrets        = null;
        AppState.selectedProgressionIdx = idx;
        _analyzeAndRender();
        _updateAddButton();
      }
    }
  });
  document.getElementById('btn-clear-all')?.addEventListener('click', clearAll);
  document.getElementById('btn-clear-progression')?.addEventListener('click', clearProgression);
  document.getElementById('btn-add-chord')?.addEventListener('click', addChordToProgression);
  document.getElementById('btn-replace-chord')?.addEventListener('click', replaceChordInProgression);

  // Wire section tabs (dynamic — handles tab clicks, + button, and type picker)
  document.getElementById('section-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.section-tab');
    if (tab) {
      AppState.activeSection = tab.dataset.section;
      _renderSectionTabs();
      _renderProgressionChips();
      return;
    }
    const addBtn = e.target.closest('.btn-add-section');
    if (addBtn) {
      const menu = addBtn.nextElementSibling;
      if (menu) menu.style.display = menu.style.display === 'none' ? '' : 'none';
      return;
    }
    const typeBtn = e.target.closest('[data-add]');
    if (typeBtn) {
      addSection(typeBtn.dataset.add);
      const menu = typeBtn.closest('.section-add-menu');
      if (menu) menu.style.display = 'none';
    }
  });
  // Close + menu when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.section-add-wrap')) {
      document.querySelectorAll('.section-add-menu').forEach(m => m.style.display = 'none');
    }
  });
  document.getElementById('btn-toggle-scale')?.addEventListener('click', toggleScaleOverlay);
  document.getElementById('btn-parse-tab')?.addEventListener('click', parseTabInput);
  document.getElementById('tab-text-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') parseTabInput();
  });

  // Wire chord-scale chip clicks from current chord panel
  document.getElementById('chord-info-panel')?.addEventListener('scale-activate', e => {
    const { type, rootPitch } = e.detail;
    AppState.activeScale = { type, pitches: generateScale(rootPitch, type) };
    AppState.showScale = true;
    const btn = document.getElementById('btn-toggle-scale');
    if (btn) { btn.setAttribute('data-active', 'true'); btn.textContent = 'Hide Scale'; }
    _setActiveScaleButton(type);
    _fullRender();
  });

  // Form templates
  const formSelect = document.getElementById('form-template-select');
  if (formSelect) {
    for (const form of SONG_FORMS) {
      const opt = document.createElement('option');
      opt.value = form.key;
      opt.textContent = `${form.name} (${form.genre})`;
      formSelect.appendChild(opt);
    }
    formSelect.addEventListener('change', () => {
      if (!formSelect.value) return;
      const keyRoot = AppState.activeKey?.root ?? 0;
      const keyQuality = AppState.activeKey?.quality ?? 'major';
      const templateSections = instantiateForm(formSelect.value, keyRoot, keyQuality);
      // Rebuild sections from template (unique types in order)
      AppState.progression = [];
      AppState.selectedProgressionIdx = null;
      AppState.sections = [];
      AppState.sectionCounts = {};
      const typeToId = new Map();
      for (const sec of templateSections) {
        if (!typeToId.has(sec.section)) {
          const type = sec.section;
          AppState.sectionCounts[type] = (AppState.sectionCounts[type] ?? 0) + 1;
          const n  = AppState.sectionCounts[type];
          const id = `${type}-${n}`;
          AppState.sections.push({ id, type, label: `${type[0].toUpperCase() + type.slice(1)} ${n}` });
          typeToId.set(type, id);
        }
        const sectionId = typeToId.get(sec.section);
        for (const chord of sec.chords) {
          AppState.progression.push({
            ...chord,
            frets:   [-1, -1, -1, -1, -1, -1],
            section: sectionId,
          });
        }
      }
      AppState.activeSection = AppState.sections[0]?.id ?? 'verse-1';
      formSelect.value = ''; // reset dropdown
      _analyzeAndRender();
    });
  }

  // Wire drag-to-reorder on the progression chips container (once, via delegation)
  _initProgressionDrag();

  // Initial render
  _fullRender();
});

// ─── Fret Click ────────────────────────────────────────
function onFretClick(stringIdx, fret) {
  const current = AppState.selectedFrets[stringIdx];

  if (fret === 0) {
    // Open string toggle: open <-> mute
    AppState.selectedFrets[stringIdx] = current === 0 ? -1 : 0;
  } else {
    // Fretted: same fret = mute, different fret = select
    AppState.selectedFrets[stringIdx] = current === fret ? -1 : fret;
  }

  // Clear suggestion ghost and circle preview lock when user edits fretboard
  AppState.suggestionFrets = null;
  _clearPreviewLock();

  _analyzeAndRender();
}

// ─── Tuning Change ─────────────────────────────────────
function onTuningChange(newTuning) {
  AppState.tuning = newTuning;
  // Re-analyze with new tuning (fret positions unchanged)
  _analyzeAndRender();
}

// ─── Shared manual key-change handler ──────────────────
// Called from both the key panel chips and the circle of fifths click.
// Re-calculates all key-dependent derived state, then re-renders.
function _applyManualKeyChange(root, quality) {
  const isAutoDetected = AppState.keyResults.length > 0
    && AppState.keyResults[0].key.root === root
    && AppState.keyResults[0].key.quality === quality;

  const { preferFlats } = countProgressionAccidentals(AppState.progression);
  AppState.activeKey     = buildKey(root, quality, preferFlats);
  AppState.keyOverridden = !isAutoDetected;

  // Re-spell all chord names to match the new key's accidental preference
  const kr = AppState.activeKey.root;
  _applyKeySpelling(AppState.currentChord, kr);
  for (const c of AppState.progression) _applyKeySpelling(c, kr);

  // Re-calculate key-dependent analysis with the new key
  AppState.cadences = AppState.activeKey && AppState.progression.length >= 2
    ? detectCadences(AppState.progression, AppState.activeKey)
    : [];
  AppState.detectedPatterns = AppState.activeKey && AppState.progression.length >= 2
    ? detectPatterns(AppState.progression, AppState.activeKey)
    : [];

  // Update scale overlay root if a scale is currently showing
  if (AppState.activeScale) {
    AppState.activeScale.pitches = generateScale(AppState.activeKey.root, AppState.activeScale.type);
  }

  _fullRender();
  requestAnimationFrame(_triggerKeyGlow); // glow on manual key switch
}

// ─── Circle of Fifths click ────────────────────────────
function onCircleKeyClick(rootPitch, quality) {
  _applyManualKeyChange(rootPitch, quality);
}

// ─── Scale Controls ────────────────────────────────────
function _buildScaleTypeButtons() {
  const container = document.getElementById('scale-type-buttons');
  if (!container) return;

  for (const group of SCALE_GROUPS) {
    for (const type of group.types) {
      const btn = document.createElement('button');
      btn.className = 'scale-type-btn';
      btn.dataset.scaleType = type;
      btn.textContent = SCALE_DISPLAY_NAMES[type];
      btn.addEventListener('click', () => onScaleTypeClick(type, btn));
      container.appendChild(btn);
    }
  }
}

function onScaleTypeClick(type, btn) {
  // Toggle: clicking active scale deactivates
  const alreadyActive = btn.classList.contains('active');

  document.querySelectorAll('.scale-type-btn').forEach(b => b.classList.remove('active'));

  if (alreadyActive) {
    AppState.activeScale = null;
    AppState.showScale   = false;
    const tBtn0 = document.getElementById('btn-toggle-scale');
    if (tBtn0) { tBtn0.setAttribute('data-active', 'false'); tBtn0.textContent = 'Show Scale'; }
  } else {
    const root = AppState.activeKey?.root ?? 0;
    AppState.activeScale = { type, pitches: generateScale(root, type) };
    AppState.showScale   = true;
    _setActiveScaleButton(type);
    const tBtn1 = document.getElementById('btn-toggle-scale');
    if (tBtn1) { tBtn1.setAttribute('data-active', 'true'); tBtn1.textContent = 'Hide Scale'; }
  }

  _fullRender();
}

function toggleScaleOverlay() {
  AppState.showScale = !AppState.showScale;
  const btn = document.getElementById('btn-toggle-scale');
  if (btn) {
    btn.setAttribute('data-active', AppState.showScale);
    btn.textContent = AppState.showScale ? 'Hide Scale' : 'Show Scale';
  }
  _fullRender();
}

// ─── Progression Management ────────────────────────────
function addChordToProgression() {
  if (!AppState.currentChord) return;
  // Auto-create Verse 1 if no sections exist yet
  if (AppState.sections.length === 0) {
    addSection('verse');
  }
  AppState.progression.push({
    ...AppState.currentChord,
    frets:   AppState.selectedFrets.slice(),
    section: AppState.activeSection,
  });
  _analyzeAndRender();

  // ── Micro-interactions ─────────────────────────────
  // 1. Pulse the Add button
  const addBtn = document.getElementById('btn-add-chord');
  if (addBtn) {
    addBtn.classList.remove('btn-pulse');
    void addBtn.offsetWidth; // force reflow to restart
    addBtn.classList.add('btn-pulse');
    addBtn.addEventListener('animationend', () => addBtn.classList.remove('btn-pulse'), { once: true });
  }
  // 2. Spring-pop the newest chip (DOM has updated by next frame)
  requestAnimationFrame(() => {
    const chips = document.querySelectorAll('#chord-chips .chord-chip');
    const newest = chips[chips.length - 1];
    if (newest) {
      newest.classList.remove('chip-added');
      void newest.offsetWidth;
      newest.classList.add('chip-added');
      newest.addEventListener('animationend', () => newest.classList.remove('chip-added'), { once: true });
    }
  });
}

function replaceChordInProgression() {
  const idx = AppState.selectedProgressionIdx;
  if (idx === null || idx >= AppState.progression.length || !AppState.currentChord) return;
  AppState.progression[idx] = {
    ...AppState.currentChord,
    frets:   AppState.selectedFrets.slice(),
    section: AppState.progression[idx].section,
  };
  AppState.selectedProgressionIdx = null;
  _analyzeAndRender();
  _updateAddButton();
}

function clearProgression() {
  stopPlayback();
  AppState.isPlayingProgression = false;
  AppState.progression = [];
  AppState.selectedChordIndices = [];
  AppState.selectedProgressionIdx = null;
  _analyzeAndRender();
  _updateAddButton();
}

function clearAll() {
  stopPlayback();
  AppState.isPlayingProgression = false;
  AppState.selectedFrets  = [-1, -1, -1, -1, -1, -1];
  AppState.progression    = [];
  AppState.sections       = [];
  AppState.sectionCounts  = {};
  AppState.activeSection  = null;
  AppState.sectionKeys    = {};
  AppState.currentChord   = null;
  AppState.activeKey      = null;
  AppState.keyOverridden  = false;
  AppState.activeScale    = null;
  AppState.showScale      = false;
  AppState.suggestionFrets = null;
  AppState.activePosition  = null;
  AppState.explorerChord   = null;
  AppState.selectedChordIndices = [];
  AppState.selectedProgressionIdx = null;
  document.querySelectorAll('.scale-type-btn').forEach(b => b.classList.remove('active'));
  const toggleBtn = document.getElementById('btn-toggle-scale');
  if (toggleBtn) { toggleBtn.setAttribute('data-active', 'false'); toggleBtn.textContent = 'Show Scale'; }
  _fullRender();
  _updateAddButton();
}

// ─── Tab Input ─────────────────────────────────────────
function parseTabInput() {
  const input = document.getElementById('tab-text-input');
  if (!input) return;
  const raw = input.value.trim();

  // 1. Try fret-notation parse (e.g. "x32010")
  const frets = parseTabString(raw);
  if (frets) {
    AppState.selectedFrets   = frets;
    AppState.suggestionFrets = null;
    input.value = '';
    _analyzeAndRender();
    return;
  }

  // 2. Try chord-name parse (e.g. "Ab", "Dbmaj7", "Cm7")
  const parsed = parseChordName(raw);
  if (parsed) {
    const voicings = generateVoicings(parsed.root, parsed.quality, AppState.tuning);
    if (voicings.length > 0) {
      AppState.selectedFrets   = voicings[0].frets.slice();
      AppState.suggestionFrets = null;
      input.value = '';
      _analyzeAndRender();
      return;
    }
  }

  // Nothing matched — flash red border
  input.style.borderColor = 'var(--accent-red)';
  setTimeout(() => { input.style.borderColor = ''; }, 1200);
}

// ─── Chord Suggestion Click ────────────────────────────
function onSuggestionClick(chord) {
  AppState.explorerChord = chord ?? null;
  renderVoicingExplorer(AppState.explorerChord, AppState.tuning, onVoicingSelect, AppState.selectedFrets);
}

function onVoicingSelect(frets) {
  AppState.selectedFrets   = frets;
  AppState.suggestionFrets = null;
  _analyzeAndRender();
}

// ─── Chord Ideas callbacks ─────────────────────────────
function onIdeaVoicingPreview(frets) {
  AppState.selectedFrets   = frets.slice();
  AppState.suggestionFrets = null;
  _analyzeAndRender();
}

function onAddIdeaToProgression(idea, frets) {
  if (AppState.sections.length === 0) addSection('verse');
  AppState.progression.push({
    ...idea,
    frets:   frets.slice(),
    section: AppState.activeSection,
  });
  AppState.selectedFrets = frets.slice();
  AppState.currentChord  = idea;
  _clearPreviewLock();
  // Eagerly render the chips so the new chord appears immediately, even if
  // _analyzeAndRender() encounters an error before reaching _renderProgressionChips().
  _renderSectionTabs();
  _renderProgressionChips();
  _analyzeAndRender();
}

function onScaleSuggestionActivate(scaleType, position) {
  const root = AppState.activeKey?.root ?? 0;
  AppState.activeScale    = { type: scaleType, pitches: generateScale(root, scaleType) };
  AppState.activePosition = position;
  AppState.showScale      = true;
  const btn = document.getElementById('btn-toggle-scale');
  if (btn) { btn.setAttribute('data-active', 'true'); btn.textContent = 'Hide Scale'; }
  _setActiveScaleButton(scaleType);
  _fullRender();
}

// ─── Circle Preview ────────────────────────────────────
function _onChordHover(chord) {
  // Only show hover preview if nothing is locked
  if (AppState.previewLocked) return;
  AppState.previewChord = chord;
  if (chord) CircleOfFifths.renderChordPreview(chord, AppState.activeKey);
  else CircleOfFifths.clearChordPreview();
}

function _onChordPreviewLock(chord) {
  // Click locks the preview in place
  AppState.previewChord  = chord;
  AppState.previewLocked = !!chord;
  if (chord) CircleOfFifths.renderChordPreview(chord, AppState.activeKey);
  else CircleOfFifths.clearChordPreview();
}

function _clearPreviewLock() {
  AppState.previewChord  = null;
  AppState.previewLocked = false;
  CircleOfFifths.clearChordPreview();
}

// ─── Progression Playback ───────────────────────────────
function _toggleProgressionPlayback() {
  if (AppState.isPlayingProgression) {
    stopPlayback();
    AppState.isPlayingProgression = false;
    AppState.selectedFrets = [-1, -1, -1, -1, -1, -1];
    AppState.currentChord  = null;
    _updatePlayProgressionBtn();
    _highlightPlayingChip(null);
    _renderFretboard();
    _updateFretboardChordLabel();
    return;
  }
  // Build a list of { chord, flatIdx } for the active section so we can
  // highlight the right chip by its flat progression index during playback
  const sectionEntries = AppState.progression
    .map((c, i) => ({ chord: c, flatIdx: i }))
    .filter(({ chord }) => _sectionOf(chord) === AppState.activeSection);
  if (sectionEntries.length === 0) return;

  const sectionChords = sectionEntries.map(e => e.chord);

  AppState.isPlayingProgression = true;
  _updatePlayProgressionBtn();

  playProgression(sectionChords, AppState.tuning, 1, () => {
    // Playback finished — clear playback state and restore fretboard
    AppState.isPlayingProgression = false;
    AppState.selectedFrets = [-1, -1, -1, -1, -1, -1];
    AppState.currentChord  = null;
    _updatePlayProgressionBtn();
    _highlightPlayingChip(null);
    _renderFretboard();
    _updateFretboardChordLabel();
  }, (_chord, idx) => {
    // Each chord fires — update fretboard and chip highlight
    const { chord, flatIdx } = sectionEntries[idx];
    let frets = chord.frets?.slice() ?? [-1, -1, -1, -1, -1, -1];
    if (frets.every(f => f === -1)) {
      const voicings = generateVoicings(chord.root, chord.quality, AppState.tuning);
      if (voicings.length > 0) frets = voicings[0].frets.slice();
    }
    AppState.selectedFrets = frets;
    AppState.currentChord  = chord;
    _highlightPlayingChip(flatIdx);
    _renderFretboard();
    _updateFretboardChordLabel();
  });
}

function _updateFretboardChordLabel() {
  const el = document.getElementById('fretboard-chord-label');
  if (!el) return;
  if (!AppState.currentChord) {
    el.textContent = '';
    el.style.display = 'none';
    return;
  }
  el.textContent = AppState.currentChord.slashName ?? AppState.currentChord.name;
  el.style.display = '';
}

// ─── Shape Shift ────────────────────────────────────────
/**
 * Move the current chord shape up (+1) or down (-1) the neck by one fret.
 * Open strings (0) shift up to fret 1; shifting down stops when the lowest
 * fretted string reaches fret 1 (won't force strings below 0).
 */
function _shiftChordShape(delta) {
  const frets = AppState.selectedFrets;
  const active = frets.filter(f => f !== -1);
  if (active.length === 0) return;

  if (delta < 0) {
    // Shift down: only allowed when the lowest fretted (non-open) string > 0
    const minFretted = Math.min(...frets.filter(f => f > 0));
    if (!isFinite(minFretted) || minFretted <= 1) return; // already at nut
    AppState.selectedFrets = frets.map(f => f === -1 ? -1 : f + delta);
  } else {
    // Shift up: clamp so no string exceeds fret 22
    const maxFret = Math.max(...active);
    if (maxFret + delta > 22) return;
    AppState.selectedFrets = frets.map(f => f === -1 ? -1 : f + delta);
  }

  _analyzeAndRender();
  _updateShiftControls();
}

/** Sync the shape-shift bar visibility, position label, and button disabled states. */
function _updateShiftControls() {
  const bar    = document.getElementById('shape-shift-bar');
  const posEl  = document.getElementById('shape-shift-pos');
  const downBtn = document.getElementById('btn-shift-down');
  const upBtn   = document.getElementById('btn-shift-up');
  if (!bar) return;

  const frets  = AppState.selectedFrets;
  const active = frets.filter(f => f !== -1);

  if (active.length === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';

  const minFret    = Math.min(...active);
  const maxFret    = Math.max(...active);
  const minFretted = Math.min(...frets.filter(f => f > 0)); // excludes open & muted

  // Position label
  if (minFret === 0) {
    posEl.textContent = 'Open';
  } else {
    posEl.textContent = `${minFret}fr`;
  }

  // Disable down when lowest fretted string is already at 1 (can't go lower)
  downBtn.disabled = !isFinite(minFretted) || minFretted <= 1;
  // Disable up when highest string is at the neck limit
  upBtn.disabled   = maxFret >= 22;
}

function _updatePlayProgressionBtn() {
  const btn = document.getElementById('btn-play-progression');
  if (!btn) return;
  const playing = AppState.isPlayingProgression;
  btn.textContent = playing ? '■ Stop' : '▶ Play';
  btn.classList.toggle('btn-stop', playing);
}

/**
 * Highlight the chip at the given flat progression index during playback.
 * Pass null to clear all highlights.
 */
function _highlightPlayingChip(flatIdx) {
  document.querySelectorAll('#chord-chips .chord-chip').forEach(chip => {
    chip.classList.toggle('chip-playing', flatIdx !== null && parseInt(chip.dataset.idx, 10) === flatIdx);
  });
}

// ─── Analysis Pipeline ─────────────────────────────────
// ─── Key Panel Glow Helper ──────────────────────────────
function _triggerKeyGlow() {
  const panel = document.getElementById('key-panel');
  if (!panel) return;
  panel.classList.remove('key-glow');
  void panel.offsetWidth; // restart animation if already playing
  panel.classList.add('key-glow');
  panel.addEventListener('animationend', () => panel.classList.remove('key-glow'), { once: true });
}

/**
 * Show or hide the "Replace in Progression" button in the Current Chord panel.
 */
function _updateAddButton() {
  const replaceBtn = document.getElementById('btn-replace-chord');
  if (!replaceBtn) return;
  const isReplace = AppState.selectedProgressionIdx !== null;
  replaceBtn.style.display = isReplace ? '' : 'none';
}

function _analyzeAndRender() {
  // 1. Identify current chord from fretboard
  const { pitchSet, bassPitch, allPitches } = fretboardToPitches(
    AppState.selectedFrets, AppState.tuning
  );
  const identified = identifyChord(pitchSet, bassPitch);
  // In replace mode, keep showing the loaded progression chord until the user
  // builds a new recognizable chord on the fretboard
  AppState.currentChord = identified ?? (AppState.selectedProgressionIdx !== null ? AppState.currentChord : null);

  // 2. Run key detection on progression (or single chord if no progression)
  const chordsForDetection = AppState.progression.length > 0
    ? AppState.progression
    : (AppState.currentChord ? [AppState.currentChord] : []);

  AppState.keyResults = detectKey(chordsForDetection);

  // Track previous key for glow animation
  const prevKeyRoot    = AppState.activeKey?.root;
  const prevKeyQuality = AppState.activeKey?.quality;

  // 3. Update active key — skip auto-update if user has manually overridden it
  if (AppState.keyResults.length > 0 && !AppState.keyOverridden) {
    AppState.activeKey = AppState.keyResults[0].key;
  }

  // If the key changed, queue a glow pulse on the key panel after render
  const keyChanged = AppState.activeKey &&
    (AppState.activeKey.root !== prevKeyRoot || AppState.activeKey.quality !== prevKeyQuality);
  if (keyChanged) requestAnimationFrame(_triggerKeyGlow);

  // 3b. Detect cadences in the progression
  AppState.cadences = AppState.activeKey && AppState.progression.length >= 2
    ? detectCadences(AppState.progression, AppState.activeKey)
    : [];

  // 3c. Detect named progression patterns
  AppState.detectedPatterns = AppState.activeKey && AppState.progression.length >= 2
    ? detectPatterns(AppState.progression, AppState.activeKey)
    : [];

  // 3d. Detect key modulations
  AppState.modulations = AppState.progression.length >= 6
    ? detectModulations(AppState.progression)
    : [];

  // 3e. Per-section key detection (for key change dividers)
  AppState.sectionKeys = {};
  for (const sec of AppState.sections) {
    const secChords = AppState.progression.filter(c => _sectionOf(c) === sec.id);
    AppState.sectionKeys[sec.id] = secChords.length >= 2
      ? (detectKey(secChords)[0] ?? null)
      : null;
  }

  // 4. Re-spell all chord names using the detected key's accidental preference
  if (AppState.activeKey) {
    const kr = AppState.activeKey.root;
    _applyKeySpelling(AppState.currentChord, kr);
    for (const c of AppState.progression) _applyKeySpelling(c, kr);
  }

  // 5. Re-calibrate scale overlay to the detected key
  if (AppState.activeKey) {
    const topConfidence = AppState.keyResults[0]?.confidence ?? 0;
    const isConfident = topConfidence >= 0.65;

    if (AppState.activeScale) {
      // Scale is already showing — update its root to match the detected key
      AppState.activeScale.pitches = generateScale(AppState.activeKey.root, AppState.activeScale.type);

      // If confidence is high, also auto-match scale type to the key quality
      // (only if user hasn't manually selected a mode scale like dorian/lydian)
      const diatonicTypes = ['major', 'natural_minor'];
      if (isConfident && diatonicTypes.includes(AppState.activeScale.type)) {
        const idealType = AppState.activeKey.quality === 'major' ? 'major' : 'natural_minor';
        if (AppState.activeScale.type !== idealType) {
          AppState.activeScale.type   = idealType;
          AppState.activeScale.pitches = generateScale(AppState.activeKey.root, idealType);
          _setActiveScaleButton(idealType);
        }
      }
    }
  }

  _fullRender();
}

// ─── Key-aware chord spelling ──────────────────────────────────────────────────
// Re-spells a chord object's display name using the active key's accidental preference
// (sharps vs flats), so the fretboard label and suggestion cards always agree.
function _applyKeySpelling(chord, keyRoot) {
  if (!chord) return;
  const rootNote = pitchToNoteInKey(chord.root, keyRoot);
  chord.rootNote = rootNote;
  chord.name     = rootNote + (CHORD_SUFFIXES[chord.quality] ?? chord.quality);
  if (chord.inversion === 1 && chord.bassPitch != null) {
    const bassNote  = pitchToNoteInKey(chord.bassPitch, keyRoot);
    chord.bassNote  = bassNote;
    chord.slashName = `${chord.name}/${bassNote}`;
  }
}

// ─── Scale Button Helpers ───────────────────────────────
function _setActiveScaleButton(type) {
  document.querySelectorAll('.scale-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.scaleType === type);
  });
}

function _updateScaleStatus() {
  const el = document.getElementById('scale-status');
  if (!el) return;

  if (!AppState.showScale || !AppState.activeScale || !AppState.activeKey) {
    el.textContent = '';
    el.classList.remove('visible');
    return;
  }

  const rootNote = CHROMATIC_SHARP[AppState.activeKey.root];
  const scaleName = SCALE_DISPLAY_NAMES[AppState.activeScale.type] ?? AppState.activeScale.type;
  const confidence = AppState.keyResults[0]?.confidence ?? 0;
  const calibrated = confidence >= 0.65 && AppState.progression.length > 0;

  el.textContent = calibrated
    ? `${rootNote} ${scaleName} (calibrated to detected key)`
    : `${rootNote} ${scaleName}`;
  el.classList.add('visible');
}

// ─── Render Everything ─────────────────────────────────
function _fullRender() {
  _renderFretboard();
  _updateScaleStatus();
  _renderAll();
}

function _renderFretboard() {
  const scalePitches = AppState.showScale && AppState.activeScale
    ? AppState.activeScale.pitches
    : null;
  const tonicPitch = AppState.activeKey?.root ?? null;

  Fretboard.render(
    AppState.selectedFrets,
    AppState.tuning,
    scalePitches,
    tonicPitch,
    AppState.suggestionFrets,
    AppState.activePosition
  );
}

function _renderAll() {
  // Live chord label on fretboard
  _updateFretboardChordLabel();
  _updateShiftControls();

  // Chord info — pass the progression slot's frets so voicing panel can distinguish saved vs active
  const _progressionFrets = AppState.selectedProgressionIdx !== null
    ? (AppState.progression[AppState.selectedProgressionIdx]?.frets ?? null)
    : null;
  TabDisplay.renderChordDisplay(
    AppState.currentChord,
    AppState.selectedFrets,
    AppState.tuning,
    AppState.activeKey ?? null,
    onVoicingSelect,
    addChordToProgression,
    _progressionFrets
  );

  // Key panel — pass activeKey so the panel reflects manual overrides
  renderKeyPanel(AppState.keyResults, AppState.activeKey, _applyManualKeyChange);

  // Chord suggestions
  ChordSuggestions.renderChordSuggestions(AppState.activeKey, onSuggestionClick, _onChordHover, _onChordPreviewLock);

  // Scale suggestions panel (replaces manual scale buttons when confidence ≥ 0.50)
  const confidence = AppState.keyResults[0]?.confidence ?? 0;
  renderScaleSuggestions(AppState.activeKey, AppState.tuning, onScaleSuggestionActivate, AppState.progression);
  const manualScaleControls = document.getElementById('scale-manual-controls');
  if (manualScaleControls) {
    manualScaleControls.style.display = AppState.activeKey && confidence >= 0.50 ? 'none' : '';
  }

  // Voicing explorer (persists until cleared or new chord selected)
  renderVoicingExplorer(AppState.explorerChord, AppState.tuning, onVoicingSelect, AppState.selectedFrets);

  // All key-dependent panels use AppState.activeKey (which reflects manual overrides)
  const activeKey = AppState.activeKey;

  ScaleDegreeChart.renderScaleDegreeChart(activeKey);
  renderTheoryPanel(activeKey, AppState.progression, AppState.currentChord,
    AppState.cadences, AppState.modulations,
    AppState.sections, AppState.sectionKeys,
    AppState.detectedPatterns);

  // Progression story (below chips) + Relationship Analyzer
  renderProgressionStory(activeKey, AppState.progression, AppState.cadences,
    AppState.detectedPatterns, AppState.modulations,
    AppState.sections, AppState.sectionKeys);
  renderRelationshipAnalyzer(activeKey, AppState.progression, AppState.selectedChordIndices);

  // Circle of fifths highlight
  if (AppState.activeKey) {
    if (AppState.progression.length > 0) {
      CircleOfFifths.highlightProgression(AppState.progression, AppState.activeKey);
      CircleOfFifths.renderTransitionPanel(AppState.progression, AppState.activeKey, 'circle-transition-panel');
    } else {
      CircleOfFifths.highlightKey(AppState.activeKey.root, AppState.activeKey.quality, AppState.activeKey);
      const tp = document.getElementById('circle-transition-panel');
      if (tp) { tp.innerHTML = ''; tp.style.display = 'none'; }
    }
  }

  // Function flowchart
  renderFunctionFlowchart(AppState.activeKey, AppState.progression, AppState.currentChord);

  // Re-apply locked preview after circle re-draws (highlight/progression wipes inline styles)
  if (AppState.previewLocked && AppState.previewChord && AppState.activeKey) {
    CircleOfFifths.renderChordPreview(AppState.previewChord, AppState.activeKey);
  }

  // Next chord ideas — context is the last chord IN the progression so suggestions
  // always reflect "what comes next" as the progression grows.
  const ideasContext = AppState.progression.length > 0
    ? AppState.progression[AppState.progression.length - 1]
    : AppState.currentChord;
  renderChordIdeas(
    AppState.activeKey,
    AppState.progression,
    AppState.tuning,
    onIdeaVoicingPreview,
    onAddIdeaToProgression,
    _onChordHover,
    _onChordPreviewLock,
    ideasContext,
  );

  // Chord progression chips (sectioned)
  _renderSectionTabs();
  _renderProgressionChips();

  // Refresh glossary contextual terms if modal is open
  if (document.getElementById('glossary-overlay')?.style.display !== 'none') {
    renderGlossaryModal(AppState);
  }
}

// ─── Drag-to-reorder: progression chips ────────────────────────────────────
function _initProgressionDrag() {
  const container = document.getElementById('chord-chips');
  if (!container) return;

  function _clearDropIndicators() {
    if (_dragOverEl) {
      _dragOverEl.classList.remove('chip-drop-before', 'chip-drop-after');
      _dragOverEl = null;
    }
  }

  container.addEventListener('dragstart', e => {
    // Don't drag when Ctrl/Cmd held — those are selection clicks
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); return; }
    // Don't start a drag when the user clicks a button inside the chip
    if (e.target.closest('button, .chip-remove')) { e.preventDefault(); return; }
    const chip = e.target.closest('.chord-chip');
    if (!chip) return;
    _dragSrcIdx = parseInt(chip.dataset.idx, 10);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(_dragSrcIdx));
    // Defer the opacity change so the drag ghost captures the normal look
    requestAnimationFrame(() => chip.classList.add('chip-dragging'));
  });

  container.addEventListener('dragend', () => {
    document.querySelectorAll('.chip-dragging').forEach(el => el.classList.remove('chip-dragging'));
    _clearDropIndicators();
    _dragSrcIdx = null;
  });

  container.addEventListener('dragover', e => {
    if (_dragSrcIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const targetChip = e.target.closest('.chord-chip');
    if (!targetChip || parseInt(targetChip.dataset.idx) === _dragSrcIdx) {
      _clearDropIndicators();
      return;
    }

    const before = e.clientX < targetChip.getBoundingClientRect().left + targetChip.offsetWidth / 2;

    if (_dragOverEl !== targetChip) {
      _clearDropIndicators();
      _dragOverEl = targetChip;
    }
    targetChip.classList.toggle('chip-drop-before', before);
    targetChip.classList.toggle('chip-drop-after', !before);
  });

  container.addEventListener('dragleave', e => {
    // Only clear when the cursor leaves the whole container
    if (!container.contains(e.relatedTarget)) _clearDropIndicators();
  });

  container.addEventListener('drop', e => {
    e.preventDefault();
    _clearDropIndicators();
    if (_dragSrcIdx === null) return;

    const targetChip = e.target.closest('.chord-chip');
    const sectionRow = e.target.closest('.prog-section-row');
    if (!sectionRow) return;

    const newSection = sectionRow.dataset.section ?? AppState.activeSection;
    let insertIdx;

    if (targetChip) {
      const targetFlatIdx = parseInt(targetChip.dataset.idx);
      if (targetFlatIdx === _dragSrcIdx) { _dragSrcIdx = null; return; }
      const before = e.clientX < targetChip.getBoundingClientRect().left + targetChip.offsetWidth / 2;
      insertIdx = before ? targetFlatIdx : targetFlatIdx + 1;
    } else {
      // Dropped on the section area (not on a chip) — append at the end of that section
      let lastIdxInSection = -1;
      AppState.progression.forEach((c, i) => { if (c.section === newSection) lastIdxInSection = i; });
      insertIdx = lastIdxInSection === -1 ? AppState.progression.length : lastIdxInSection + 1;
    }

    // Remove the dragged chord, adjust insertion point, then re-insert
    const [chord] = AppState.progression.splice(_dragSrcIdx, 1);
    chord.section = newSection;
    if (insertIdx > _dragSrcIdx) insertIdx--;
    AppState.progression.splice(insertIdx, 0, chord);

    _dragSrcIdx = null;
    _analyzeAndRender();
  });
}

function addSection(type) {
  AppState.sectionCounts[type] = (AppState.sectionCounts[type] ?? 0) + 1;
  const n     = AppState.sectionCounts[type];
  const id    = `${type}-${n}`;
  const label = type.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') + (n > 1 ? ` ${n}` : '');
  AppState.sections.push({ id, type, label });
  AppState.activeSection = id;
  _renderSectionTabs();
  _renderProgressionChips();
}

function _renderSectionTabs() {
  const tabsEl = document.getElementById('section-tabs');
  if (!tabsEl) return;

  tabsEl.innerHTML =
    AppState.sections.map(sec =>
      `<button class="section-tab${sec.id === AppState.activeSection ? ' active' : ''}"
               data-section="${sec.id}" draggable="true">${sec.label}</button>`
    ).join('') +
    `<div class="section-add-wrap">
       <button class="btn-add-section" title="Add section">+</button>
       <div class="section-add-menu" style="display:none">
         <button data-add="intro">+ Intro</button>
         <button data-add="verse">+ Verse</button>
         <button data-add="pre-chorus">+ Pre-Chorus</button>
         <button data-add="chorus">+ Chorus</button>
         <button data-add="bridge">+ Bridge</button>
         <button data-add="outro">+ Outro</button>
       </div>
     </div>`;

  _initSectionTabDrag();
}

function _initSectionTabDrag() {
  const tabsEl = document.getElementById('section-tabs');
  if (!tabsEl) return;
  tabsEl.querySelectorAll('.section-tab').forEach(tab => {
    tab.addEventListener('dragstart', e => {
      _dragSectionId = tab.dataset.section;
      tab.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    tab.addEventListener('dragend', () => {
      tab.classList.remove('dragging');
      tabsEl.querySelectorAll('.section-tab').forEach(t => t.classList.remove('drag-over'));
      _dragSectionId = null;
    });
    tab.addEventListener('dragover', e => {
      e.preventDefault();
      if (tab.dataset.section === _dragSectionId) return;
      tabsEl.querySelectorAll('.section-tab').forEach(t => t.classList.remove('drag-over'));
      tab.classList.add('drag-over');
    });
    tab.addEventListener('drop', e => {
      e.preventDefault();
      if (!_dragSectionId || tab.dataset.section === _dragSectionId) return;
      tabsEl.querySelectorAll('.section-tab').forEach(t => t.classList.remove('drag-over'));
      const fromIdx = AppState.sections.findIndex(s => s.id === _dragSectionId);
      const toIdx   = AppState.sections.findIndex(s => s.id === tab.dataset.section);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = AppState.sections.splice(fromIdx, 1);
      AppState.sections.splice(toIdx, 0, moved);
      _renderSectionTabs();
      _renderProgressionChips();
    });
  });
}

// ─── Section character descriptor ────────────────────────────────────────────
function _sectionCharacter(chords) {
  if (!chords || chords.length === 0) return null;
  const hasAlteration = chords.some(c => /b5|s5|#5|b9|s9|#9|aug/.test(c.quality));
  const hasAdd9orSus  = chords.some(c => /add9|sus2|sus4/.test(c.quality));
  const hasPower      = chords.some(c => c.quality === 'pow5');
  const richCount     = chords.filter(c => _chordRichness(c.quality) > 0).length;
  const richRatio     = richCount / chords.length;
  if (hasAlteration)           return 'angular';
  if (hasPower && hasAdd9orSus) return 'expansive';
  if (richRatio >= 0.75)       return 'floating';
  if (richRatio >= 0.4)        return 'lush';
  return 'grounded';
}

// ─── Texture delta between two chord arrays ───────────────────────────────────
// Returns a label if the chord roots are the same but extensions differ, else null.
function _textureDelta(prevChords, currChords) {
  if (!prevChords?.length || !currChords?.length) return null;
  const prevRoots = prevChords.map(c => c.root).sort((a,b) => a - b).join(',');
  const currRoots = currChords.map(c => c.root).sort((a,b) => a - b).join(',');
  if (prevRoots !== currRoots) return null; // different harmony — not a texture shift
  const prevRich = prevChords.reduce((s, c) => s + _chordRichness(c.quality), 0);
  const currRich = currChords.reduce((s, c) => s + _chordRichness(c.quality), 0);
  if (currRich > prevRich + 1) return 'same chords, richer color';
  if (prevRich > currRich + 1) return 'same chords, stripped back';
  return null;
}

function _renderProgressionChips() {
  const container = document.getElementById('chord-chips');
  if (!container) return;

  // Group flat progression by section ID
  const bySection = {};
  AppState.sections.forEach(s => bySection[s.id] = []);
  AppState.progression.forEach((chord, i) => {
    const id = _sectionOf(chord);
    if (bySection[id]) bySection[id].push({ chord, i });
  });

  const hasAnything = AppState.progression.length > 0;

  // Pattern badge above chips
  const patternContainer = document.getElementById('pattern-badge');
  if (patternContainer) {
    if (AppState.detectedPatterns.length > 0) {
      const top = AppState.detectedPatterns[0];
      const p = top.pattern;
      const exStr = p.examples?.slice(0, 2).join(', ') ?? '';
      const rotNote = top.rotation ? ' (rotated start)' : '';
      patternContainer.innerHTML = `
        <span class="pattern-badge-icon">🎵</span>
        <span class="pattern-badge-name">${p.name}${rotNote}</span>
        <span class="pattern-badge-genre">${p.genre}</span>
        ${exStr ? `<span class="pattern-badge-examples">e.g. ${exStr}</span>` : ''}
        <span class="pattern-badge-desc">${p.description}</span>
      `;
      patternContainer.style.display = '';
    } else {
      patternContainer.innerHTML = '';
      patternContainer.style.display = 'none';
    }
  }

  // Show/hide progression play button based on active section having chords
  const playBtn = document.getElementById('btn-play-progression');
  if (playBtn) {
    const activeSectionChords = bySection[AppState.activeSection] ?? [];
    playBtn.style.display = activeSectionChords.length > 0 ? '' : 'none';
  }

  if (!hasAnything) {
    container.innerHTML = '<span class="chord-chips-empty">Select a chord, then click "+ Add to Progression".</span>';
    return;
  }

  let html = '';
  let lastRenderedSec = null;

  for (const sec of AppState.sections) {
    const items    = bySection[sec.id] ?? [];
    const isActive = sec.id === AppState.activeSection;
    // Only render row if it has chords or is the active section
    if (items.length === 0 && !isActive) continue;

    // Key change divider between adjacent rendered sections
    if (lastRenderedSec) {
      const prev = AppState.sectionKeys?.[lastRenderedSec.id];
      const curr = AppState.sectionKeys?.[sec.id];
      const gk   = AppState.activeKey;
      const bothDetected = prev?.confidence >= 0.5 && curr?.confidence >= 0.5;
      const keysDiffer   = prev && curr &&
        (prev.key.root !== curr.key.root || prev.key.quality !== curr.key.quality);
      const vsGlobal = gk && (
        (prev && (prev.key.root !== gk.root || prev.key.quality !== gk.quality)) ||
        (curr && (curr.key.root !== gk.root || curr.key.quality !== gk.quality))
      );
      if (bothDetected && keysDiffer && vsGlobal) {
        html += `<div class="key-change-divider">
          <span class="key-change-badge">⟳ ${prev.key.shortName} → ${curr.key.shortName}</span>
        </div>`;
      }

      // Texture delta: same roots, different extension richness
      const prevItems = bySection[lastRenderedSec.id] ?? [];
      const currItems = bySection[sec.id] ?? [];
      const delta = _textureDelta(prevItems.map(x => x.chord), currItems.map(x => x.chord));
      if (delta) {
        html += `<div class="texture-delta-divider">
          <span class="texture-delta-badge">≈ ${delta}</span>
        </div>`;
      }
    }
    lastRenderedSec = sec;

    html += `<div class="prog-section-row${isActive ? ' prog-section-active' : ''}" data-section="${sec.id}">`;
    const _secChar = items.length > 0 ? _sectionCharacter(items.map(x => x.chord)) : null;
    html += `<span class="prog-section-label">${sec.label}${_secChar ? `<span class="sec-character-tag">${_secChar}</span>` : ''}</span>`;
    html += '<div class="prog-section-chips">';

    if (items.length === 0) {
      html += '<span class="chord-chips-empty prog-empty-hint">No chords yet</span>';
    } else {
      for (let j = 0; j < items.length; j++) {
        const { chord, i } = items[j];
        const numeral = AppState.activeKey
          ? getChordNumeral(chord.root, chord.quality, AppState.activeKey)
          : '—';

        // Check if there's a cadence that lands at this chord index (idx = resolution target)
        const cadence = AppState.cadences.find(c => c.idx === i && !c.isSectionBoundary);
        if (cadence && j > 0) {
          html += `<span class="cadence-badge cadence-${cadence.typeKey.toLowerCase()}" title="${cadence.type.name}: ${cadence.chordA} → ${cadence.chordB}">${cadence.type.abbr}</span>`;
        }

        // Check if there's a modulation at this index
        const modulation = AppState.modulations.find(m => m.pivotIdx === i);
        if (modulation) {
          html += `<span class="modulation-marker" title="Key change: ${modulation.fromKey.name} → ${modulation.toKey.name}">🔑 ${modulation.toKey.shortName}</span>`;
        }

        const isCtrlSelected = AppState.selectedChordIndices.includes(i);
        const isLoaded       = AppState.selectedProgressionIdx === i;
        html += `
          <span class="chord-chip${isCtrlSelected ? ' chip-ctrl-selected' : ''}${isLoaded ? ' chip-loaded' : ''}" draggable="true" data-idx="${i}" title="Click to load · Ctrl+click to select for analysis · Drag to reorder">
            <span class="chip-drag-handle" aria-hidden="true">⠿</span>
            <button class="btn-play chip-play-btn" data-idx="${i}" title="Play this chord">▶</button>
            <span class="chip-chord-name">${chord.name}</span>
            <span class="chip-numeral">${numeral}</span>
            <span class="chip-remove" data-remove="${i}" title="Remove">✕</span>
          </span>
        `;

        // Half cadence badge after the last chord if it's the section boundary or end
        const hcAtEnd = AppState.cadences.find(c => c.idx === i && c.typeKey === 'HC');
        if (hcAtEnd && j === items.length - 1) {
          html += `<span class="cadence-badge cadence-hc" title="${hcAtEnd.type.name}: ends on V">${hcAtEnd.type.abbr}</span>`;
        }
      }
    }

    html += '</div></div>';
  }

  container.innerHTML = html;
  _updateAddButton();
}
