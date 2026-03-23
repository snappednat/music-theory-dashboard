/**
 * "Next Chord Ideas" panel.
 * Suggests chords grouped by musical intent (Resolve / Build Tension / Keep Floating /
 * Chromatic–Outside / Redirect). Clicking a card expands it to show voicing diagrams
 * and an "Add to Progression" button.
 */

import { getChordIdeas, getChordNumeral, getDegreeInKey, getHarmonicFunction } from '../core/keys.js';
import { generateVoicings }     from '../core/chords.js';
import { buildChordDiagramHtml } from './voicingExplorer.js';
import { playChord }             from '../core/audio.js';

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

// Captured callbacks — stored so re-renders inside handlers work without args
let _savedActiveKey        = null;
let _savedProgression      = null;
let _savedLastChord        = null;   // current fretboard chord — context for transition sorting
let _savedTuning           = null;
let _savedDifficultyFilter = 'advanced'; // 'beginner' | 'intermediate' | 'advanced'
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
 * @param {string}      [difficultyFilter] - 'beginner' | 'intermediate' | 'advanced'
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
    if (fn === 'T')  return deg === 1 ? 'Returns home' : 'Soft resolution';
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
  else if (lastFn === 'D'  && ideaFn === 'T')                    label = 'resolves dominant tension';
  else if (lastFn === 'T'  && ideaFn === 'D')                    label = 'jumps to dominant — energetic';
  else if (lastFn === 'T'  && ideaFn === 'PD')                   label = 'begins motion away from home';
  else if (lastFn === 'TP' && ideaFn === 'D')                    label = 'moves toward dominant';
  else if (lastFn === ideaFn)                                     label = 'stays in same harmonic area';

  return label ? `${lNum}→${iNum}: ${label}` : null;
}

// ─── Internal render ──────────────────────────────────────────────────────────

function _doRender() {
  const panel = document.getElementById('chord-ideas-panel');
  if (!panel) return;

  if (!_savedActiveKey || _savedProgression.length === 0) {
    panel.style.display = 'none';
    return;
  }

  _ideas = getChordIdeas(_savedActiveKey, _savedProgression, _savedLastChord);
  if (_ideas.length === 0) {
    panel.style.display = 'none';
    return;
  }

  const wasHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = '';
  if (wasHidden) {
    panel.classList.remove('panel-reveal');
    requestAnimationFrame(() => panel.classList.add('panel-reveal'));
  }

  // ── Partition ideas ────────────────────────────────────────────────────────
  const FIT_RANK = { green: 0, yellow: 1, red: 2 };
  const sorted = [..._ideas].sort((a, b) => {
    const fd = (FIT_RANK[a.fit] ?? 1) - (FIT_RANK[b.fit] ?? 1);
    return fd !== 0 ? fd : (b.transitionScore ?? 0) - (a.transitionScore ?? 0);
  });
  const topPicks   = sorted.slice(0, 6);
  const topPickSet = new Set(topPicks.map(i => `${i.root},${i.quality}`));
  const rest       = _ideas.filter(i => !topPickSet.has(`${i.root},${i.quality}`));

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

  let html = '<div id="chord-ideas-grid">';

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

  // ── Section 3: Chromatic / Outside ────────────────────────────────────────
  if (chromatic.length > 0) {
    html += `
      <div class="ideas-section-header intent-color" data-action="toggle-group" data-group="chromatic">
        <span class="ideas-section-arrow">${_chromaticOpen ? '▼' : '▶'}</span>
        Chromatic / Outside <span class="ideas-section-count">${chromatic.length}</span>
      </div>`;
    if (_chromaticOpen) {
      html += '<div class="idea-cards-row">' + _byDegree(chromatic).map(i => _cardHtml(i)).join('') + '</div>';
    }
  }

  html += '</div>';

  panel.innerHTML = '<div class="section-label">Next Chord Ideas</div>' + contextLabel + html;

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

  // ── Add to Progression button ─────────────────────────
  const addBtn = e.target.closest('.idea-add-btn');
  if (addBtn) {
    e.stopPropagation();
    const root    = parseInt(addBtn.dataset.root, 10);
    const quality = addBtn.dataset.quality;
    const idea = _ideas.find(i => i.root === root && i.quality === quality)
              ?? { root, quality, name: addBtn.dataset.name ?? '' };
    const allV   = generateVoicings(root, quality, _savedTuning);
    const maxRnk = _IDEA_DIFF_RANK[_savedDifficultyFilter] ?? 2;
    const filtV  = allV.filter(v => (_IDEA_DIFF_RANK[v.difficulty ?? 'advanced']) <= maxRnk);
    const pool   = filtV.length > 0 ? filtV : allV;
    const frets  = pool[_expandedVoicingIdx]?.frets ?? pool[0]?.frets;
    _expandedCardKey    = null;
    _expandedVoicingIdx = 0;
    _savedOnLock?.(null);
    if (frets && _savedOnAdd) _savedOnAdd(idea, frets);
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
    const cardKey = card.dataset.cardkey;
    if (_expandedCardKey === cardKey) {
      _expandedCardKey = null;
      _savedOnHover?.(null);
      _savedOnLock?.(null);
    } else {
      _expandedCardKey    = cardKey;
      _expandedVoicingIdx = 0;
      const idea = _ideas.find(i => `${i.root},${i.quality}` === cardKey);
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

const _IDEA_DIFF_RANK = { beginner: 0, intermediate: 1, advanced: 2 };

function _filterByDifficulty(voicings) {
  const maxRank = _IDEA_DIFF_RANK[_savedDifficultyFilter] ?? 2;
  const filtered = voicings.filter(v => (_IDEA_DIFF_RANK[v.difficulty ?? 'advanced']) <= maxRank);
  return filtered.length > 0 ? filtered : voicings; // graceful: return all if none match
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
    const levelLabel = _savedDifficultyFilter.charAt(0).toUpperCase() + _savedDifficultyFilter.slice(1);
    const nextLevel  = _savedDifficultyFilter === 'beginner' ? 'Intermediate' : 'Advanced';
    return `
      <div class="idea-expansion">
        <p class="idea-no-voicings">No ${levelLabel} shape available — switch to ${nextLevel} to see voicings.</p>
      </div>`;
  }

  const cards = voicings.slice(0, 6).map((v, i) => {
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
      <button class="idea-add-btn btn btn-accent btn-sm"
              data-root="${idea.root}" data-quality="${idea.quality}" data-name="${idea.name}">
        + Add to Progression
      </button>
    </div>
  `;
}
