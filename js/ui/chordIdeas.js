/**
 * "Next Chord Ideas" panel.
 * Suggests chords grouped by musical intent (Resolve / Build Tension / Keep Floating /
 * Chromatic–Outside / Redirect). Clicking a card expands it to show voicing diagrams
 * and an "Add to Progression" button.
 */

import { getChordIdeas, getChordNumeral, getDegreeInKey, getHarmonicFunction } from '../core/keys.js';
import { generateVoicings, QUALITY_DIFFICULTY, CHORD_FORMULAS } from '../core/chords.js';
import { buildChordDiagramHtml } from './voicingExplorer.js';
import { playChord }             from '../core/audio.js';
import { CHROMATIC_SHARP, pitchToNoteInKey, normalizePitch } from '../core/notes.js';

const INTENT_GROUPS = [
  { key: 'resolve',  label: 'Resolve',             cls: 'intent-resolve'  },
  { key: 'tension',  label: 'Build Tension',       cls: 'intent-tension'  },
  { key: 'floating', label: 'Keep Floating',       cls: 'intent-floating' },
  { key: 'color',    label: 'Chromatic / Outside', cls: 'intent-color'    },
  { key: 'redirect', label: 'Redirect',            cls: 'intent-redirect' },
];

// ─── Module state ─────────────────────────────────────────────────────────────
let _expandedCardKey     = null;        // "root,quality" of the expanded card, or null
let _expandedVoicingIdx  = 0;           // selected voicing index within the expanded card
let _ideas               = [];          // last-computed ideas list (for handler closures)
// Section open/closed state
// Opening Other Options or Chromatic auto-collapses Top Picks.
// Re-opening Top Picks keeps Other/Chromatic states unchanged.
let _topPicksOpen   = true;   // open by default
let _otherOpen      = false;
let _chromaticOpen  = false;
let _slashOpen      = false;  // slash chord / inversions section

// Captured callbacks — stored so re-renders inside handlers work without args
let _savedActiveKey        = null;
let _savedProgression      = null;
let _savedLastChord        = null;   // current fretboard chord — context for transition sorting
let _savedTuning           = null;
let _savedDifficultyFilter = 'advanced'; // 'basic' | 'color' | 'advanced'
let _savedOnVoicingPreview = null;
let _savedOnAdd            = null;
let _savedOnHover          = null;  // (chord|null) => void — circle preview on hover
let _savedOnLock           = null;  // (chord|null) => void — lock preview on click/expand

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render the chord ideas panel.
 * @param {object|null} activeKey          - key object with .root, .quality
 * @param {object[]}    progression        - current progression chords (all sections)
 * @param {number[]}    tuning             - pitch class per string
 * @param {function}    onVoicingPreview   - (frets) → void   preview a voicing on the main fretboard
 * @param {function}    onAddToProgression - (idea, frets) → void   commit to the progression
 * @param {function}    [onHover]          - (chord|null) → void   hover preview on circle
 * @param {function}    [onLock]           - (chord|null) → void   lock preview on expand/collapse
 * @param {object|null} [lastChord]        - current fretboard chord used to context-sort suggestions
 * @param {string}      [difficultyFilter] - 'basic' | 'color' | 'advanced'
 */
export function renderChordIdeas(activeKey, progression, tuning, onVoicingPreview, onAddToProgression, onHover = null, onLock = null, lastChord = null, difficultyFilter = 'advanced') {
  _savedActiveKey        = activeKey;
  _savedProgression      = progression;
  _savedLastChord        = lastChord;
  _savedTuning           = tuning;
  _savedDifficultyFilter = difficultyFilter;
  _savedOnVoicingPreview = onVoicingPreview;
  _savedOnAdd            = onAddToProgression;
  _savedOnHover          = onHover;
  _savedOnLock           = onLock;

  // Attach delegated click listener once to the stable panel element.
  const panel = document.getElementById('chord-ideas-panel');
  if (panel && !panel.dataset.clickListenerAttached) {
    panel.addEventListener('click', _handleGridClick);
    panel.dataset.clickListenerAttached = 'true';
  }

  _doRender();
}

// ─── Intent helpers ───────────────────────────────────────────────────────────

function _intentGroup(idea, key) {
  if (idea.category === 'secondary') return 'redirect';
  if (idea.category === 'circle')    return 'redirect';
  if (['borrowed', 'chromatic', 'modal'].includes(idea.category)) return 'color';

  const deg = getDegreeInKey(idea.root, key);
  if (deg !== null) {
    const fn = getHarmonicFunction(deg, key.quality);
    if (fn === 'T')                  return 'resolve';
    if (fn === 'D')                  return 'tension';
    if (fn === 'TP' || fn === 'PD') return 'floating';
  }

  if (['altered', 'harmonic'].includes(idea.category)) return 'tension';
  if (idea.category === 'sus')                          return 'tension';
  if (['add9', 'extended', 'power'].includes(idea.category)) return 'floating';
  return 'color';
}

// Quality-specific flavour for tonic-landing labels
const _TONIC_LANDING = {
  maj:        'Returns home',
  min:        'Returns home — dark tonic',
  maj7:       'Returns home — warm, settled',
  min7:       'Returns home — dark, warm',
  maj9:       'Returns home — lush tonic extension',
  min9:       'Returns home — dark, rich',
  add9:       'Returns home — bright 9th colour',
  minadd9:    'Returns home — dark, airy',
  maj6:       'Returns home — jazzy 6th',
  min6:       'Returns home — bittersweet 6th',
  maj6add9:   'Returns home — open, jazzy 6/9',
  maj13:      'Returns home — full, rich extension',
  min13:      'Returns home — deep, jazzy minor',
  sus2:       'Returns home — floating sus2',
  sus4:       'Returns home — suspended 4th',
  pow5:       'Returns home — open root (no 3rd)',
  aug:        'Returns home — dreamy, unresolved',
  augmaj7:    'Returns home — ethereal augmented',
  minmaj7:    'Returns home — dark, bittersweet',
};

// Quality-specific flavour for dominant→tonic motion
const _RESOLVE_MOTION = {
  maj:        'resolves to tonic',
  min:        'resolves to tonic (minor)',
  maj7:       'resolves to tonic major 7th — warm landing',
  min7:       'resolves to tonic minor 7th',
  maj9:       'resolves to lush tonic major 9th',
  min9:       'resolves to rich tonic minor 9th',
  add9:       'resolves to tonic with bright 9th',
  minadd9:    'resolves to tonic minor with 9th',
  maj6:       'resolves to jazzy tonic 6th',
  maj6add9:   'resolves to open, jazzy tonic 6/9',
  sus2:       'resolves to suspended tonic — still floating',
  sus4:       'resolves to suspended tonic — still floating',
  pow5:       'resolves to open, ambiguous tonic root',
  aug:        'resolves — but augmented tonic stays dreamy',
};

function _outcomeLabel(idea, key) {
  if (idea.category === 'secondary') {
    const m = idea.reason.match(/V7? of ([^—\s][^—]*?)(?:\s—|$)/);
    const target = m ? m[1].trim() : '';
    return target ? `Redirects → ${target}` : 'Secondary dominant';
  }
  if (idea.category === 'circle') {
    return idea.reason.includes('V of V') ? 'Double dominant — toward V' : 'Pre-dominant motion';
  }

  const deg = getDegreeInKey(idea.root, key);
  if (deg !== null) {
    const fn = getHarmonicFunction(deg, key.quality);
    if (fn === 'T') {
      if (deg === 1) return _TONIC_LANDING[idea.quality] ?? 'Returns home';
      return 'Soft resolution';
    }
    if (fn === 'D')  return idea.category === 'altered' ? 'Dominant with tension' : 'Builds tension toward home';
    if (fn === 'TP') return 'Extends tonic area';
    if (fn === 'PD') return 'Prepares dominant';
  }

  return ({
    borrowed:  'Adds harmonic contrast',
    chromatic: 'Chromatic colour shift',
    altered:   'Adds dominant tension',
    harmonic:  'Harmonic minor colour',
    sus:       'Creates suspension',
    add9:      'Adds brightness',
    extended:  'Adds richness',
    modal:     'Modal colour',
    power:     'Neutral / ambiguous root',
  })[idea.category] ?? 'Harmonic option';
}

function _transitionReason(lastChord, idea, key) {
  if (!lastChord || !key) return null;
  const lastDeg = getDegreeInKey(lastChord.root, key);
  const ideaDeg = getDegreeInKey(idea.root, key);
  if (lastDeg === null || ideaDeg === null) return null;

  const lastFn = getHarmonicFunction(lastDeg, key.quality);
  const ideaFn = getHarmonicFunction(ideaDeg, key.quality);
  const lNum = key.diatonicChords[lastDeg - 1]?.numeral ?? String(lastDeg);
  const iNum = key.diatonicChords[ideaDeg - 1]?.numeral ?? String(ideaDeg);

  let label = null;
  if      (lastFn === 'PD' && ideaFn === 'D')                    label = 'increases tension';
  else if (lastFn === 'PD' && ideaFn === 'T' && ideaDeg === 1)   label = 'plagal resolution — smooth';
  else if (lastFn === 'D'  && ideaFn === 'T') {
    label = ideaDeg === 1
      ? (_RESOLVE_MOTION[idea.quality] ?? 'resolves dominant tension')
      : 'deceptive resolution — avoids tonic';
  }
  else if (lastFn === 'T'  && ideaFn === 'D')                    label = 'jumps to dominant — energetic';
  else if (lastFn === 'T'  && ideaFn === 'PD')                   label = 'begins motion away from home';
  else if (lastFn === 'TP' && ideaFn === 'D')                    label = 'moves toward dominant';
  else if (lastFn === ideaFn && ideaDeg === lastDeg)              label = 'tonic colour change';
  else if (lastFn === ideaFn)                                     label = 'stays in same harmonic area';

  return label ? `${lNum}→${iNum}: ${label}` : null;
}

// ─── Slash chord helpers ───────────────────────────────────────────────────────

const _SLASH_RESOLUTION = {
  1: (bassNote, rootNote) => `${bassNote} (the 3rd) in the bass — bass line steps up a half step toward ${rootNote}`,
  2: (bassNote, rootNote) => `${bassNote} (the 5th) in the bass — unstable, tends to resolve to the ${bassNote} chord`,
};

const _SLASH_OUTCOME = {
  1: 'Smooth bass line descent/ascent',
  2: 'Cadential tension — pulls to bass note',
};

/**
 * Generate first-inversion voicings for a chord algorithmically.
 * Finds shapes where targetBassPitch is on the lowest sounding string,
 * then fills higher strings with chord tones within a 4-fret window.
 */
function _generateFirstInvVoicings(root, quality, targetBassPitch, tuning) {
  const formula = CHORD_FORMULAS[quality];
  if (!formula || formula.length < 2) return [];
  const chordTones = formula.map(s => ((root + s) % 12 + 12) % 12);
  const results = [];

  for (let bassStr = 0; bassStr < 5; bassStr++) {
    // Find fret on this string that plays targetBassPitch
    let bassFret = ((targetBassPitch - tuning[bassStr]) % 12 + 12) % 12;
    if (bassFret > 9) continue; // too high for practical bass

    const frets = new Array(6).fill(-1);
    frets[bassStr] = bassFret;

    // Fill higher strings with nearest chord tone in a 4-fret window
    const hi = bassFret + 4;
    for (let s = bassStr + 1; s < 6; s++) {
      let best = -1, bestDist = 99;
      for (const tone of chordTones) {
        let f = ((tone - tuning[s]) % 12 + 12) % 12;
        // Shift up octaves until we're at or above bassFret
        while (f < bassFret) f += 12;
        if (f > hi) continue;
        const dist = Math.abs(f - bassFret);
        if (dist < bestDist) { best = f; bestDist = dist; }
      }
      frets[s] = best;
    }

    const nonMuted = frets.filter(f => f >= 0).length;
    if (nonMuted < 3) continue;

    results.push({ frets, label: CHROMATIC_SHARP[root] + '/' + CHROMATIC_SHARP[targetBassPitch], difficulty: 'color' });
    if (results.length >= 2) break;
  }
  return results;
}

/**
 * Build first-inversion slash chord ideas for the active key.
 * Only generates inversions for the most guitar-practical diatonic chords.
 */
function _getSlashIdeas(key, tuning) {
  if (!key?.diatonicChords) return [];
  const kr = key.root;
  const ideas = [];

  // Prioritize: I, IV, V, ii, vi (most common in guitar inversions)
  const PRIORITY_DEGREES = [1, 4, 5, 2, 6, 3, 7];

  for (const deg of PRIORITY_DEGREES) {
    const dc = key.diatonicChords[deg - 1];
    if (!dc) continue;
    const formula = CHORD_FORMULAS[dc.quality];
    if (!formula || formula.length < 2) continue;

    // First inversion: 3rd in bass
    const thirdSemis = formula[1];
    const thirdPitch = ((dc.root + thirdSemis) % 12 + 12) % 12;
    const rootNoteName  = pitchToNoteInKey(dc.root, kr);
    const thirdNoteName = pitchToNoteInKey(thirdPitch, kr);
    const slashName = `${dc.name}/${thirdNoteName}`;

    // Generate first-inversion voicings algorithmically
    const invV = _generateFirstInvVoicings(dc.root, dc.quality, thirdPitch, tuning);

    if (invV.length === 0) continue; // Skip if no playable inversion found

    ideas.push({
      root:         dc.root,
      quality:      dc.quality,
      name:         dc.name,
      slashName,
      bassNote:     thirdNoteName,
      bassPitch:    thirdPitch,
      inversion:    1,
      category:     'inversion',
      fit:          'green',
      reason:       `1st inversion — ${thirdNoteName} in the bass`,
      inversionType: 1,
      invVoicings:  invV,
      rootNoteName,
      degree:       deg,
    });
  }

  return ideas;
}

/**
 * Build an HTML card for a slash chord suggestion.
 */
function _slashCardHtml(idea, tuning) {
  const cardKey = `slash:${idea.root},${idea.quality}`;
  const expanded = _expandedCardKey === cardKey;
  const numeral  = _savedActiveKey ? getChordNumeral(idea.root, idea.quality, _savedActiveKey) : null;
  const badgeHtml = numeral
    ? `<span class="idea-numeral-badge idea-numeral-${_numeralClass(numeral)}">${numeral}</span>`
    : '';
  const resolutionNote = _SLASH_RESOLUTION[1]?.(idea.bassNote, idea.rootNoteName) ?? '';
  const outcome = _SLASH_OUTCOME[1];

  let expansionHtml = '';
  if (expanded) {
    const maxRnk = _IDEA_DIFF_RANK[_savedDifficultyFilter] ?? 2;
    const filtV  = idea.invVoicings.filter(v => (_IDEA_DIFF_RANK[v.difficulty ?? 'advanced']) <= maxRnk);
    const voicings = filtV.length ? filtV : idea.invVoicings;
    const vCards = voicings.slice(0, 4).map((v, i) => {
      const isSelected = i === _expandedVoicingIdx;
      const diag = buildChordDiagramHtml(v.frets, _savedTuning, idea.root);
      return `<div class="idea-voicing-card${isSelected ? ' idea-voicing-selected' : ''}"
                   data-idx="${i}" data-frets="${v.frets.join(',')}" data-cardkey="${cardKey}">
        ${diag}
        <span class="idea-voicing-label">${v.label ?? ''}</span>
        <button class="btn-play idea-play-btn" data-frets="${v.frets.join(',')}" title="Preview">▶</button>
      </div>`;
    }).join('');
    expansionHtml = `
      <div class="idea-expansion">
        <div class="idea-voicings-grid">${vCards}</div>
      </div>`;
  }

  return `
    <div class="idea-card inversion${expanded ? ' idea-card-expanded' : ''}"
         data-cardkey="${cardKey}" data-root="${idea.root}" data-quality="${idea.quality}">
      <div class="idea-card-header" data-action="toggle" data-cardkey="${cardKey}">
        <div class="idea-chord-top">
          <span class="idea-chord-name">${idea.slashName}</span>${badgeHtml}
          <span class="idea-inv-tag">inversion</span>
        </div>
        <div class="idea-outcome">${outcome}</div>
        <div class="idea-theory">${resolutionNote}</div>
        <span class="idea-expand-arrow">${expanded ? '▲' : '▼'}</span>
      </div>
      ${expansionHtml}
    </div>
  `;
}

// ─── Internal render ──────────────────────────────────────────────────────────

function _doRender() {
  const panel = document.getElementById('chord-ideas-panel');
  if (!panel) return;

  if (!_savedActiveKey || _savedProgression.length === 0) {
    panel.style.display = '';
    const contextEl = document.getElementById('chord-ideas-context');
    const gridEl    = document.getElementById('chord-ideas-grid');
    if (contextEl) contextEl.innerHTML = '';

    // Key set but no progression yet → show diatonic starter chords
    if (_savedActiveKey && _savedProgression.length === 0) {
      _ideas = _savedActiveKey.diatonicChords.map(dc => ({
        root:     dc.root,
        quality:  dc.quality,
        name:     dc.name,
        category: 'diatonic',
        fit:      'green',
        reason:   dc.explanation ?? dc.functionLabel ?? '',
        degree:   dc.degree,
      }));

      if (contextEl) contextEl.innerHTML =
        `<div class="ideas-context-label">Diatonic chords in <strong>${_savedActiveKey.name}</strong> — pick one to start</div>`;

      let html = `
        <div class="ideas-section-header ideas-top-picks" data-action="toggle-group" data-group="topPicks">
          <span class="ideas-section-arrow">${_topPicksOpen ? '▼' : '▶'}</span>
          Top Ideas <span class="ideas-section-count">${_ideas.length}</span>
        </div>`;
      if (_topPicksOpen) {
        html += '<div class="idea-cards-row">';
        for (const idea of _ideas) html += _cardHtml(idea);
        html += '</div>';
      }
      if (gridEl) gridEl.innerHTML = html;

      panel.querySelectorAll('.idea-card').forEach(card => {
        const cardKey = card.dataset.cardkey;
        const idea    = _ideas.find(i => `${i.root},${i.quality}` === cardKey);
        if (!idea) return;
        card.addEventListener('mouseenter', () => {
          if (_expandedCardKey !== cardKey) _savedOnHover?.(idea);
        });
        card.addEventListener('mouseleave', () => {
          if (_expandedCardKey !== cardKey) _savedOnHover?.(null);
        });
      });
      return;
    }

    if (gridEl) gridEl.innerHTML = '<div class="key-placeholder">Add a chord to explore what your ear wants next — find what\'s in your head.</div>';
    return;
  }

  _ideas = getChordIdeas(_savedActiveKey, _savedProgression, _savedLastChord);
  if (_ideas.length === 0) {
    panel.style.display = '';
    const contextEl = document.getElementById('chord-ideas-context');
    const gridEl    = document.getElementById('chord-ideas-grid');
    if (contextEl) contextEl.innerHTML = '';
    if (gridEl)    gridEl.innerHTML = '<div class="key-placeholder">Add a chord to explore what your ear wants next — find what\'s in your head.</div>';
    return;
  }

  const wasHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = '';
  if (wasHidden) {
    panel.classList.remove('panel-reveal');
    requestAnimationFrame(() => panel.classList.add('panel-reveal'));
  }

  // ── Partition ideas ────────────────────────────────────────────────────────
  const FIT_RANK  = { green: 0, yellow: 1, red: 2 };
  const TIER_RANK = { basic: 0, color: 1, advanced: 2 };
  const sorted = [..._ideas].sort((a, b) => {
    // 1. Most musically appropriate: diatonic (green) → functional (yellow) → chromatic (red)
    const fd = (FIT_RANK[a.fit] ?? 1) - (FIT_RANK[b.fit] ?? 1);
    if (fd !== 0) return fd;
    // 2. Most playable/common first: Basic before Color before Advanced
    const aTier = TIER_RANK[QUALITY_DIFFICULTY[a.quality] ?? 'advanced'] ?? 2;
    const bTier = TIER_RANK[QUALITY_DIFFICULTY[b.quality] ?? 'advanced'] ?? 2;
    const td = aTier - bTier;
    // 3. Richer alternatives: higher transitionScore as final tiebreak
    return td !== 0 ? td : (b.transitionScore ?? 0) - (a.transitionScore ?? 0);
  });
  const topPicks   = sorted.slice(0, 6).filter(_hasVoicingsForTier);
  const topPickSet = new Set(topPicks.map(i => `${i.root},${i.quality}`));
  const rest       = _ideas.filter(i => !topPickSet.has(`${i.root},${i.quality}`) && _hasVoicingsForTier(i));

  // Separate chromatic/outside from "Other Options"
  const chromatic = rest.filter(i => _intentGroup(i, _savedActiveKey) === 'color');
  const other     = rest.filter(i => _intentGroup(i, _savedActiveKey) !== 'color');

  // Sort ideas by scale degree (I→VII), non-diatonic last then alphabetical
  const _byDegree = arr => [...arr].sort((a, b) => {
    const dA = getDegreeInKey(a.root, _savedActiveKey);
    const dB = getDegreeInKey(b.root, _savedActiveKey);
    if (dA !== null && dB !== null) return dA - dB;
    if (dA !== null) return -1;
    if (dB !== null) return  1;
    return a.name.localeCompare(b.name);
  });

  // Sub-group Other Options by intent (preserving label order)
  const OTHER_GROUPS = INTENT_GROUPS.filter(g => g.key !== 'color');
  const byGroup = { resolve: [], tension: [], floating: [], redirect: [] };
  for (const idea of other) {
    const g = _intentGroup(idea, _savedActiveKey);
    if (byGroup[g]) byGroup[g].push(idea);
  }

  const contextLabel = _savedLastChord?.name
    ? `<div class="ideas-context-label">Following from <strong>${_savedLastChord.name}</strong></div>`
    : '';

  let html = '';

  // ── Section 1: Top Picks (toggleable, open by default) ────────────────────
  html += `
    <div class="ideas-section-header ideas-top-picks" data-action="toggle-group" data-group="topPicks">
      <span class="ideas-section-arrow">${_topPicksOpen ? '▼' : '▶'}</span>
      Top Picks <span class="ideas-section-count">${topPicks.length}</span>
    </div>`;
  if (_topPicksOpen) {
    if (topPicks.length > 0) {
      html += '<div class="idea-cards-row">';
      for (const idea of _byDegree(topPicks)) {
        const reason = _transitionReason(_savedLastChord, idea, _savedActiveKey);
        html += _cardHtml(idea, reason);
      }
      html += '</div>';
    } else {
      html += '<div class="ideas-empty-hint">Add more chords to get suggestions</div>';
    }
  }

  // ── Section 2: Other Options (Resolve / Tension / Floating / Redirect) ────
  if (other.length > 0) {
    html += `
      <div class="ideas-section-header intent-other" data-action="toggle-group" data-group="other">
        <span class="ideas-section-arrow">${_otherOpen ? '▼' : '▶'}</span>
        Other Options <span class="ideas-section-count">${other.length}</span>
      </div>`;
    if (_otherOpen) {
      html += '<div class="idea-other-body">';
      for (const grp of OTHER_GROUPS) {
        const ideas = byGroup[grp.key];
        if (!ideas?.length) continue;
        html += `<div class="ideas-sub-label ${grp.cls}">${grp.label}</div>`;
        html += '<div class="idea-cards-row">' + _byDegree(ideas).map(i => _cardHtml(i)).join('') + '</div>';
      }
      html += '</div>';
    }
  }

  // ── Section 3: Slash Chords / Inversions ──────────────────────────────────
  const slashIdeas = _getSlashIdeas(_savedActiveKey, _savedTuning);
  if (slashIdeas.length > 0) {
    html += `
      <div class="ideas-section-header intent-color" data-action="toggle-group" data-group="slash">
        <span class="ideas-section-arrow">${_slashOpen ? '▼' : '▶'}</span>
        Slash Chords / Inversions <span class="ideas-section-count">${slashIdeas.length}</span>
      </div>`;
    if (_slashOpen) {
      html += '<div class="idea-slash-blurb">First-inversion voicings — 3rd in the bass for smoother bass lines and voice leading.</div>';
      html += '<div class="idea-cards-row">' + slashIdeas.map(i => _slashCardHtml(i, _savedTuning)).join('') + '</div>';
    }
  }

  // ── Section 4: Chromatic / Outside ────────────────────────────────────────
  if (chromatic.length > 0) {
    html += `
      <div class="ideas-section-header intent-chromatic" data-action="toggle-group" data-group="chromatic">
        <span class="ideas-section-arrow">${_chromaticOpen ? '▼' : '▶'}</span>
        Chromatic / Outside <span class="ideas-section-count">${chromatic.length}</span>
      </div>`;
    if (_chromaticOpen) {
      html += '<div class="idea-cards-row">' + _byDegree(chromatic).map(i => _cardHtml(i)).join('') + '</div>';
    }
  }

  const contextEl = document.getElementById('chord-ideas-context');
  if (contextEl) contextEl.innerHTML = contextLabel;
  const gridEl = document.getElementById('chord-ideas-grid');
  if (gridEl) gridEl.innerHTML = html;

  // Hover listeners
  panel.querySelectorAll('.idea-card').forEach(card => {
    const cardKey = card.dataset.cardkey;
    const idea    = _ideas.find(i => `${i.root},${i.quality}` === cardKey);
    if (!idea) return;
    card.addEventListener('mouseenter', () => {
      if (_expandedCardKey !== cardKey) _savedOnHover?.(idea);
    });
    card.addEventListener('mouseleave', () => {
      if (_expandedCardKey !== cardKey) _savedOnHover?.(null);
    });
  });
}

// Build a single idea card HTML string
function _cardHtml(idea, transitionReason = null) {
  const cardKey  = `${idea.root},${idea.quality}`;
  const expanded = _expandedCardKey === cardKey;
  const numeral  = _savedActiveKey ? getChordNumeral(idea.root, idea.quality, _savedActiveKey) : null;
  const badgeHtml = numeral
    ? `<span class="idea-numeral-badge idea-numeral-${_numeralClass(numeral)}">${numeral}</span>`
    : '';
  const outcome = _savedActiveKey ? _outcomeLabel(idea, _savedActiveKey) : '';
  const theory  = idea.reason.replace(/\s*—\s*secondary dominant$/, '').replace(/\s*—\s*$/, '');
  const contextLine = transitionReason
    ? `<div class="idea-transition-reason">${transitionReason}</div>`
    : `<div class="idea-theory">${theory}</div>`;

  return `
    <div class="idea-card ${idea.category}${expanded ? ' idea-card-expanded' : ''}"
         data-cardkey="${cardKey}" data-root="${idea.root}" data-quality="${idea.quality}">
      <div class="idea-card-header" data-action="toggle">
        <div class="idea-chord-top">
          <span class="idea-chord-name">${idea.name}</span>${badgeHtml}
          <span class="idea-fit-dot idea-fit-${idea.fit ?? 'yellow'}"
                title="${_fitLabel(idea.fit ?? 'yellow')}"></span>
        </div>
        <div class="idea-outcome">${outcome}</div>
        ${contextLine}
        <span class="idea-expand-arrow">${expanded ? '▲' : '▼'}</span>
      </div>
      ${expanded ? _buildExpansion(idea) : ''}
    </div>
  `;
}

// Determine badge color class from a Roman numeral string
function _numeralClass(numeral) {
  const n = numeral.replace(/[^IVXivxøo°+♭♯]/g, '');
  if (/^i$/i.test(n) || /^vi$/i.test(n)) return 'tonic';
  if (/^v$/i.test(n) || /^vii/i.test(n))  return 'dominant';
  if (/^iv$/i.test(n) || /^ii$/i.test(n))  return 'subdominant';
  return 'other';
}

// ─── Click handling ───────────────────────────────────────────────────────────

function _handleGridClick(e) {
  // ── Intent group collapse toggle ──────────────────────
  const groupToggle = e.target.closest('[data-action="toggle-group"]');
  if (groupToggle) {
    const group = groupToggle.dataset.group;
    if (group === 'topPicks') {
      _topPicksOpen = !_topPicksOpen;
    } else if (group === 'other') {
      _otherOpen = !_otherOpen;
      if (_otherOpen) _topPicksOpen = false;
    } else if (group === 'chromatic') {
      _chromaticOpen = !_chromaticOpen;
      if (_chromaticOpen) _topPicksOpen = false;
    } else if (group === 'slash') {
      _slashOpen = !_slashOpen;
      if (_slashOpen) _topPicksOpen = false;
    }
    _doRender();
    return;
  }

  // ── Idea voicing play button ───────────────────────────
  const ideaPlayBtn = e.target.closest('.idea-play-btn');
  if (ideaPlayBtn) {
    e.stopPropagation();
    const frets = ideaPlayBtn.dataset.frets.split(',').map(Number);
    playChord(frets, _savedTuning);
    return;
  }

  // ── Voicing card click ────────────────────────────────
  const voicingCard = e.target.closest('.idea-voicing-card');
  if (voicingCard) {
    e.stopPropagation();
    _expandedVoicingIdx = parseInt(voicingCard.dataset.idx, 10);
    const frets = voicingCard.dataset.frets.split(',').map(Number);
    if (_savedOnVoicingPreview) _savedOnVoicingPreview(frets);
    return;
  }

  // ── Toggle (expand / collapse) card ──────────────────
  const header = e.target.closest('[data-action="toggle"]');
  if (header) {
    const card    = header.closest('.idea-card');
    const cardKey = card?.dataset.cardkey ?? header.dataset.cardkey;
    if (!cardKey) return;
    if (_expandedCardKey === cardKey) {
      _expandedCardKey = null;
      _savedOnHover?.(null);
      _savedOnLock?.(null);
    } else {
      _expandedCardKey    = cardKey;
      _expandedVoicingIdx = 0;
      // Look up in both regular ideas and slash ideas
      let idea = _ideas.find(i => `${i.root},${i.quality}` === cardKey);
      if (!idea && cardKey.startsWith('slash:')) {
        const slashIdeas = _getSlashIdeas(_savedActiveKey, _savedTuning);
        idea = slashIdeas.find(i => `slash:${i.root},${i.quality}` === cardKey);
      }
      _savedOnHover?.(null);
      _savedOnLock?.(idea ?? null);
    }
    _doRender();
  }
}

// ─── Fit label tooltip ────────────────────────────────────────────────────────

function _fitLabel(fit) {
  if (fit === 'green') return 'Diatonic — safe choice, fully in key';
  if (fit === 'red')   return 'Chromatic — exotic color, use sparingly';
  return 'Functional — outside key but musically conventional';
}

// ─── Inline expansion HTML ────────────────────────────────────────────────────

const _IDEA_DIFF_RANK = { basic: 0, color: 1, advanced: 2 };

/** Returns true if this idea has at least one voicing within the current tier. */
function _hasVoicingsForTier(idea) {
  const allV   = generateVoicings(idea.root, idea.quality, _savedTuning);
  if (!allV?.length) return false;
  const maxRnk = _IDEA_DIFF_RANK[_savedDifficultyFilter] ?? 2;
  return allV.some(v => (_IDEA_DIFF_RANK[v.difficulty ?? 'advanced']) <= maxRnk);
}

function _buildExpansion(idea) {
  const allVoicings = generateVoicings(idea.root, idea.quality, _savedTuning);

  if (!allVoicings || allVoicings.length === 0) {
    return `<div class="idea-expansion"><p class="idea-no-voicings">No voicings available</p></div>`;
  }

  const maxRank  = _IDEA_DIFF_RANK[_savedDifficultyFilter] ?? 2;
  const filtered = allVoicings.filter(v => (_IDEA_DIFF_RANK[v.difficulty ?? 'advanced']) <= maxRank);
  const voicings = filtered.length > 0 ? filtered : null;

  // If no voicings match the difficulty level, show an informative message
  if (!voicings) {
    const levelLabel = { basic: 'Basic', color: 'Color', advanced: 'Advanced' }[_savedDifficultyFilter] ?? _savedDifficultyFilter;
    const nextLevel  = _savedDifficultyFilter === 'basic' ? 'Color' : 'Advanced';
    return `
      <div class="idea-expansion">
        <p class="idea-no-voicings">No ${levelLabel} shape available — switch to ${nextLevel} to see voicings.</p>
      </div>`;
  }

  const cards = voicings.slice(0, 9).map((v, i) => {
    const selected = i === _expandedVoicingIdx;
    return `
      <div class="idea-voicing-card${selected ? ' idea-voicing-selected' : ''}"
           data-idx="${i}" data-frets="${v.frets.join(',')}">
        ${buildChordDiagramHtml(v.frets, _savedTuning, idea.root)}
        <div class="idea-voicing-label">${v.label}</div>
        <button class="btn-play idea-play-btn" data-frets="${v.frets.join(',')}" title="Play this voicing">▶</button>
      </div>
    `;
  }).join('');

  return `
    <div class="idea-expansion">
      <div class="idea-voicings-grid">${cards}</div>
    </div>
  `;
}
