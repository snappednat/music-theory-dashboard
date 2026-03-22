import { CHROMATIC_SHARP, normalizePitch } from '../core/notes.js';
import { getDegreeInKey, DEGREE_NAMES, DEGREE_EXPLANATIONS, getChordNumeral, getHarmonicFunction } from '../core/keys.js';
import { CHORD_QUALITY_LABELS } from '../core/chords.js';
import { generateScale } from '../core/scales.js';

/**
 * Classify a non-diatonic chord with richer interpretive prose.
 */
function classifyNonDiatonic(chord, key) {
  const r        = normalizePitch(chord.root);
  const tonicR   = normalizePitch(key.root);
  const semFT    = normalizePitch(r - tonicR + 12); // semitones above tonic (0-11)

  // 1. Secondary dominant: dom7/dom9 whose root resolves up a 4th to a diatonic chord
  if (chord.quality === 'dom7' || chord.quality === 'dom9') {
    const resolveTarget = normalizePitch(r + 7);
    const targetDC = key.diatonicChords.find(dc => normalizePitch(dc.root) === resolveTarget);
    if (targetDC) {
      return `Secondary dominant — V7 of <strong>${targetDC.name}</strong>. Temporarily intensifies motion toward the ${targetDC.numeral} chord, creating a brief tonal detour before returning to the key.`;
    }
  }

  // 2. Borrowed ♭VII (whole step below tonic, major or maj7) — modal lift
  if (semFT === 10 && (chord.quality === 'maj' || chord.quality === 'maj7')) {
    return `Borrowed ♭VII — a major chord lifted from the parallel ${key.quality === 'major' ? 'minor' : 'major'} key. Adds a broad, cinematic expansion without requiring resolution. A common guitar color move that feels natural under the fingers.`;
  }

  // 3. Borrowed ♭III (minor third above tonic, major quality in major key)
  if (semFT === 3 && key.quality === 'major' && (chord.quality === 'maj' || chord.quality === 'maj7')) {
    return `Borrowed ♭III — a major chord borrowed from the parallel minor. Creates a sudden darker color: more surprising than the diatonic iii, yet smooth because it often shares tones with the surrounding harmony.`;
  }

  // 4. Chromatic mediant (root a third from tonic with unexpected major quality)
  if ((semFT === 3 || semFT === 4 || semFT === 8 || semFT === 9)
      && (chord.quality === 'maj' || chord.quality === 'maj7' || chord.quality === 'maj9')) {
    return `Chromatic mediant — a major chord a third away from the tonic. Creates a sudden, floating color shift rather than a functional harmonic move. Common in cinematic and guitar writing because it sounds surprising but not harsh.`;
  }

  // 5. Borrowed from parallel scale (general)
  const parallelType   = key.quality === 'major' ? 'natural_minor' : 'major';
  const parallelName   = key.quality === 'major' ? key.parallelMinorName : key.parallelMajorName;
  const parallelPitches = generateScale(key.root, parallelType);
  if (parallelPitches.includes(r)) {
    return `Borrowed from <strong>${parallelName}</strong> (parallel ${key.quality === 'major' ? 'minor' : 'major'}). This modal mixture adds expressive color without leaving the tonal center — a guitar instinct that sounds natural under the fingers.`;
  }

  // 6. Catch-all
  return `Non-diatonic color chord in ${key.name}. Its impact depends on context: it may function as a passing color, a modal tint, or a deliberate moment of surprise.`;
}

// ─── Chord quality color vocabulary ──────────────────────────────────────────

const QUALITY_COLORS = {
  maj7:      'lush, reflective quality — softer than a plain major triad',
  maj9:      'open and dreamy — the added 9th gives an airy shimmer',
  maj6:      'sweet and sophisticated — a jazz-influenced warmth',
  maj6add9:  'rich and luminous — layered color extension',
  min7:      'smooth and soulful — minor with softened edges',
  min9:      'emotionally warm — minor richness with added color',
  minmaj7:   'dark and complex — the raised 7th creates a bittersweet pull',
  dom7:      'bluesy tension — the ♭7th creates a strong directional pull',
  dom9:      'fuller dominant color — jazz sophistication',
  dom7sus4:  'suspended dominant — avoids full resolution',
  dom7no5:   'lighter dominant texture — omitting the 5th keeps it airy',
  maj7no5:   'floating quality — omitting the 5th opens the voicing',
  add9:      'open and modern — the 9th brightens without adding 7th complexity',
  sus2:      'airy and ambiguous — neither major nor minor, freely floating',
  sus4:      'suspended and expectant — yearns to resolve by a half step',
  dim7:      'maximum tension — built entirely of minor thirds and tritones',
  hdim7:     'tense but softer than full dim7 — often resolves inward',
  aug:       'unsettled, upward-straining — the augmented 5th feels unstable',
  '5':       'open power chord — harmonically ambiguous, raw and direct',
  dom7b9:    'dark, dissonant dominant — Spanish / flamenco color',
  dom7s9:    'altered dominant — jazz-inflected, harmonically charged',
  dom7s11:   'Lydian dominant — bright and floating despite the dominant function',
};
function _qualityColor(quality) { return QUALITY_COLORS[quality] ?? null; }

// ─── Theory Panel State ───────────────────────────────────────────────────────

const _sectionCollapsed = new Map();   // sectionId → bool (false = expanded)
let _theoryListenerAttached = false;

// Saved args for re-render on section toggle
let _tp_key, _tp_chords, _tp_current, _tp_cadences, _tp_mods, _tp_sections, _tp_secKeys, _tp_patterns;

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Count shared pitch classes between two consecutive chords; return note name array. */
function _commonTones(chordA, chordB) {
  if (!chordA?.actualPitches || !chordB?.actualPitches) return [];
  const setA = new Set(chordA.actualPitches.map(p => normalizePitch(p)));
  return [...new Set(chordB.actualPitches.map(p => normalizePitch(p)).filter(p => setA.has(p)))]
    .map(p => CHROMATIC_SHARP[p]);
}

/** Describe the bass motion between two chord roots in simple interval terms. */
function _bassMotionDesc(fromRoot, toRoot) {
  const up = normalizePitch(toRoot - fromRoot + 12);
  const dn = 12 - up;
  const d  = up <= 6 ? up : -dn;   // signed, shortest path
  if (d === 0)  return null;
  if (d === 1)  return 'half step up';
  if (d === -1) return 'half step down';
  if (d === 2)  return 'step up';
  if (d === -2) return 'step down';
  if (d === 5 || d === -7) return '4th up';
  if (d === -5 || d === 7) return '5th up';
  if (d === 3 || d === 4)  return 'third up';
  if (d === -3 || d === -4) return 'third down';
  return 'tritone leap';
}

/** Map a Roman numeral to the same color class used in the Next Chord panel. */
function _numeralClass(numeral) {
  const n = (numeral ?? '').replace(/[^IVXivxøo°+♭♯]/g, '');
  if (/^i$/i.test(n) || /^vi$/i.test(n)) return 'tonic';
  if (/^v$/i.test(n) || /^vii/i.test(n))  return 'dominant';
  if (/^iv$/i.test(n) || /^ii$/i.test(n))  return 'subdominant';
  return 'other';
}

function _getChordFn(chord, key) {
  if (!key || !chord) return null;
  const deg = getDegreeInKey(chord.root, key);
  return deg ? getHarmonicFunction(deg, key.quality) : null;
}

function _motionLabel(fromFn, toFn) {
  if (!fromFn || !toFn) return null;
  return ({
    'T→T':   'tonic prolongation — stays grounded',
    'T→TP':  'tonic color — stays in home area',
    'T→PD':  'subdominant lift — moves away from home',
    'T→D':   'jumps to dominant — energetic leap',
    'TP→T':  'drifts back to tonic',
    'TP→TP': 'tonic area — floating',
    'TP→PD': 'moves toward pre-dominant',
    'TP→D':  'pushes toward dominant tension',
    'PD→T':  'plagal resolution — "Amen" cadence',
    'PD→PD': 'pre-dominant extension',
    'PD→D':  'sets up dominant tension',
    'PD→TP': 'sidesteps to relative — softens motion',
    'D→T':   'resolves tension home',
    'D→TP':  'deceptive — avoids full resolution',
    'D→PD':  'delays resolution — loops back',
    'D→D':   'dominant extension — tension held',
  })[`${fromFn}→${toFn}`] ?? null;
}

function _chordCardHtml(chord, key, prevChord, nextChord, isFirstOccurrence) {
  const deg = getDegreeInKey(chord.root, key);
  const dc  = deg ? key.diatonicChords[deg - 1] : null;
  const numeral   = dc?.numeral ?? '✦';
  const qualLabel = CHORD_QUALITY_LABELS[chord.quality] || chord.quality;

  // Identity block — first global occurrence only
  let identityHtml = '';
  if (isFirstOccurrence) {
    let text = '';
    if (deg) {
      text = (DEGREE_EXPLANATIONS[key.quality] || DEGREE_EXPLANATIONS.major)[deg] || '';
    } else {
      text = classifyNonDiatonic(chord, key);
    }
    identityHtml = `<div class="theory-chord-identity">${text}</div>`;
  }

  // Quality color — first occurrence only
  const qColor = isFirstOccurrence ? _qualityColor(chord.quality) : null;
  const qualityHtml = qColor ? `<div class="theory-quality-color">${qColor}</div>` : '';

  // Functional motion + voice-leading sub-line
  const fn     = _getChordFn(chord, key);
  const prevFn = _getChordFn(prevChord, key);
  const nextFn = _getChordFn(nextChord, key);

  let fromHtml, toHtml;
  if (prevChord) {
    const lbl    = _motionLabel(prevFn, fn) ?? 'chromatic motion';
    const shared = _commonTones(prevChord, chord);
    const bass   = _bassMotionDesc(prevChord.root, chord.root);
    const vlParts = [];
    if (shared.length >= 2)      vlParts.push(`shares ${shared.join(', ')} — smooth voice-leading`);
    else if (shared.length === 1) vlParts.push(`one common tone: ${shared[0]}`);
    if (bass) vlParts.push(`bass: ${bass}`);
    const vlHtml = vlParts.length
      ? `<div class="theory-common-tones">${vlParts.join(' · ')}</div>`
      : '';
    fromHtml = `<div class="theory-motion-from">← from <strong>${prevChord.name}</strong>: ${lbl}</div>${vlHtml}`;
  } else {
    fromHtml = `<div class="theory-motion-from theory-motion-edge">← opens the progression</div>`;
  }
  if (nextChord) {
    const lbl = _motionLabel(fn, nextFn) ?? 'chromatic motion';
    toHtml = `<div class="theory-motion-to">→ to <strong>${nextChord.name}</strong>: ${lbl}</div>`;
  } else {
    toHtml = `<div class="theory-motion-to theory-motion-edge">→ closes the progression</div>`;
  }

  const numCls = _numeralClass(numeral);
  return `<div class="theory-chord-card">
    <div class="theory-chord-header">
      <span class="theory-numeral-badge idea-numeral-${numCls}">${numeral}</span>
      <span class="theory-chord-name">${chord.name}</span>
      <span class="theory-chord-quality">${qualLabel}</span>
    </div>
    ${identityHtml}
    ${qualityHtml}
    <div class="theory-motion">${fromHtml}${toHtml}</div>
  </div>`;
}

// ─── Internal render ──────────────────────────────────────────────────────────

function _doRenderTheory() {
  const key         = _tp_key;
  const chords      = _tp_chords;
  const currentChord = _tp_current;
  const cadences    = _tp_cadences;
  const modulations = _tp_mods;
  const sections    = _tp_sections;
  const patterns    = _tp_patterns || [];

  const container = document.getElementById('theory-text');
  if (!container) return;

  if (!key && !currentChord) {
    container.innerHTML = '<div class="key-placeholder">Chords and key analysis will appear here…</div>';
    return;
  }

  let html = '';

  // ── A. Key header block ───────────────────────────────────────────────────
  if (key) {
    html += `<div class="theory-item highlight">Your progression suggests the key of <strong>${key.name}</strong>.
             The scale contains: <strong>${key.scalePitches.map(p => CHROMATIC_SHARP[p]).join(' – ')}</strong>.</div>`;

    html += `<div class="theory-item scale-item">The relative ${key.relativeQuality} is <strong>${key.relativeName}</strong> — it shares the same notes but with a different tonal centre.</div>`;

    const domNote  = CHROMATIC_SHARP[key.dominantRoot];
    const subNote  = CHROMATIC_SHARP[key.subdominantRoot];
    const domLabel = key.quality === 'major' ? `${domNote} major` : `${domNote}m`;
    const subLabel = key.quality === 'major' ? `${subNote} major` : `${subNote}m`;
    html += `<div class="theory-item scale-item">On the circle of fifths, the nearest keys are <strong>${domLabel}</strong> (dominant direction — one sharp more)
             and <strong>${subLabel}</strong> (subdominant direction — one flat more).</div>`;
  }

  // ── B. Section-grouped per-chord analysis ─────────────────────────────────
  if (chords?.length && key) {
    // Build section label map from passed sections array
    const secLabelMap = new Map((sections || []).map(s => [s.id, s.label]));

    // Group chords by section id, preserving insertion order + global index
    const sectionOrder = [];
    const bySection = new Map();
    chords.forEach((chord, gi) => {
      if (!chord) return;
      const raw = chord.section;
      const sid = raw
        ? (raw.includes('-') ? raw : raw + '-1')
        : '__none__';
      if (!bySection.has(sid)) { bySection.set(sid, []); sectionOrder.push(sid); }
      bySection.get(sid).push({ chord, gi });
    });

    // Deduplication set — tracks root+quality seen globally across all sections
    const seen = new Set();

    for (const sid of sectionOrder) {
      const entries   = bySection.get(sid);
      const secLabel  = (secLabelMap.get(sid)
        ?? sid.replace(/-(\d+)$/, (_, n) => n === '1' ? '' : ` ${n}`)
               .replace(/_/g, ' ')
               .replace(/\b\w/g, c => c.toUpperCase())
               .trim()
      ) || 'Progression';
      const collapsed = _sectionCollapsed.get(sid) ?? false;

      // Pattern badge — find a named progression that spans this section
      const secGlobalIndices = new Set(entries.map(e => e.gi));
      const matchPat = patterns.find(p => {
        let hits = 0;
        for (let i = p.startIdx; i <= p.endIdx; i++) {
          if (secGlobalIndices.has(i)) hits++;
        }
        return hits >= Math.min(2, p.endIdx - p.startIdx + 1);
      });
      const patBadge = matchPat ? `<div class="theory-pattern-badge">
        ✦ ${matchPat.pattern.name}
        <span class="theory-pattern-genre">${matchPat.pattern.genre ?? ''}</span>
        ${matchPat.pattern.examples?.length
          ? `<span class="theory-pattern-examples">e.g. ${matchPat.pattern.examples.slice(0,2).join(', ')}</span>`
          : ''}
      </div>` : '';

      html += `<div class="theory-section">
        <div class="theory-section-header" data-action="toggle-theory-section" data-section="${sid}">
          <span class="theory-section-arrow">${collapsed ? '▶' : '▼'}</span>
          <span class="theory-section-name">${secLabel}</span>
          <span class="theory-section-count">${entries.length} chord${entries.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="theory-section-body"${collapsed ? ' style="display:none"' : ''}>
        ${patBadge}`;

      for (const { chord, gi } of entries) {
        const dedupeKey = `${chord.root},${chord.quality}`;
        const isFirst   = !seen.has(dedupeKey);
        if (isFirst) seen.add(dedupeKey);

        const prevChord = gi > 0 ? chords[gi - 1] : null;
        const nextChord = gi < chords.length - 1 ? chords[gi + 1] : null;

        html += _chordCardHtml(chord, key, prevChord, nextChord, isFirst);
      }

      html += `</div></div>`;
    }
  }

  // ── C. Cadences ───────────────────────────────────────────────────────────
  if (cadences?.length && key) {
    let cadHtml = '<strong>Cadences detected:</strong><ul class="cadence-list">';
    for (const cad of cadences) {
      const label = cad.isSectionBoundary
        ? `${cad.chordB} ends the section on V`
        : `${cad.chordA} → ${cad.chordB}`;
      cadHtml += `<li><span class="cadence-type-label cadence-${cad.typeKey.toLowerCase()}">${cad.type.abbr}</span> <strong>${cad.type.name}</strong> (${label})<br><em>${cad.type.description}</em></li>`;
    }
    cadHtml += '</ul>';
    html += `<div class="theory-item cadence-item">${cadHtml}</div>`;
  }

  // ── D. Modulations ────────────────────────────────────────────────────────
  if (modulations?.length) {
    let modHtml = '<strong>Key changes detected:</strong><ul class="cadence-list">';
    for (const mod of modulations) {
      const fromName = mod.fromKey.name;
      const toName   = mod.toKey.name;
      if (mod.type === 'pivot') {
        const fromNum = mod.pivotDegreeInOldKey ? ['I','ii','iii','IV','V','vi','vii°'][mod.pivotDegreeInOldKey - 1] : '?';
        const toNum   = mod.pivotDegreeInNewKey ? ['I','ii','iii','IV','V','vi','vii°'][mod.pivotDegreeInNewKey - 1] : '?';
        modHtml += `<li><strong>${fromName} → ${toName}</strong> at <strong>${mod.pivotChord}</strong><br><em>Pivot chord modulation: ${mod.pivotChord} is ${fromNum} in ${fromName} and ${toNum} in ${toName}</em></li>`;
      } else {
        modHtml += `<li><strong>${fromName} → ${toName}</strong> at <strong>${mod.pivotChord}</strong><br><em>${mod.type === 'direct' ? 'Direct modulation — abrupt key change' : 'Chromatic modulation'}</em></li>`;
      }
    }
    modHtml += '</ul>';
    html += `<div class="theory-item cadence-item">${modHtml}</div>`;
  }

  // ── E. Single chord fallback (no progression) ─────────────────────────────
  if (currentChord && (!chords || chords.length === 0)) {
    const tones    = currentChord.actualPitches ? currentChord.actualPitches.map(p => CHROMATIC_SHARP[p]).join(' – ') : '—';
    const qualLabel = CHORD_QUALITY_LABELS[currentChord.quality] || currentChord.quality;
    html += `<div class="theory-item chord-item">Current chord: <strong>${currentChord.name}</strong> (${qualLabel}).<br>Chord tones: ${tones}.</div>`;
  }

  container.innerHTML = html || '<div class="key-placeholder">Chords and key analysis will appear here…</div>';

  // ── F. Attach section-collapse listener once ──────────────────────────────
  if (!_theoryListenerAttached) {
    _theoryListenerAttached = true;
    container.addEventListener('click', e => {
      const header = e.target.closest('[data-action="toggle-theory-section"]');
      if (!header) return;
      const sid = header.dataset.section;
      _sectionCollapsed.set(sid, !(_sectionCollapsed.get(sid) ?? false));
      _doRenderTheory();
    });
  }
}

/**
 * Render the theory explanation panel.
 */
export function renderTheoryPanel(key, chords, currentChord, cadences = [], modulations = [], sections = [], sectionKeys = {}, detectedPatterns = []) {
  _tp_key       = key;
  _tp_chords    = chords;
  _tp_current   = currentChord;
  _tp_cadences  = cadences;
  _tp_mods      = modulations;
  _tp_sections  = sections;
  _tp_secKeys   = sectionKeys;
  _tp_patterns  = detectedPatterns;
  _doRenderTheory();
}

// ─── Chord richness score (0=triad, 1=7th, 2=9th/add9, 3=11th/13th) ──────────
function _chordRichness(quality) {
  if (!quality) return 0;
  if (/11|13/.test(quality)) return 3;
  if (/9|add9/.test(quality)) return 2;
  if (/7|6/.test(quality)) return 1;
  return 0;
}

// ─── Private helpers for structured progression story ────────────────────────

function _storySecOf(chord) {
  const s = chord?.section;
  if (!s) return 'verse-1';
  return s.includes('-') ? s : s + '-1';
}

function _numeralSeq(sectionChords, key) {
  const seq = [];
  for (const c of sectionChords) {
    const dc = key.diatonicChords.find(d => normalizePitch(d.root) === normalizePitch(c.root));
    const num = dc ? dc.numeral : '?';
    if (seq[seq.length - 1] !== num) seq.push(num);
  }
  if (seq.length === 2) return `${seq[0]} ↔ ${seq[1]}`;
  if (seq.length >= 4 && seq[0] === seq[2] && seq[1] === seq[3])
    return `${seq[0]} ↔ ${seq[1]}`;
  return seq.join(' → ');
}

function _funcLabel(funcs) {
  if (!funcs.length) return 'Ambiguous';
  const T  = funcs.filter(f => f === 'T').length;
  const TP = funcs.filter(f => f === 'TP').length;
  const D  = funcs.filter(f => f === 'D').length;
  const total = funcs.length;
  // True oscillation: a short pattern (1–3 long) repeats ≥ 2 times from the start
  const isOscillating = (() => {
    for (let len = 1; len <= 3; len++) {
      const repeats = Math.floor(funcs.length / len);
      if (repeats < 2) continue;
      const pat = funcs.slice(0, len);
      let ok = true;
      for (let i = 0; i < repeats * len; i++) {
        if (funcs[i] !== pat[i % len]) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  })();
  if (isOscillating && D >= 1 && T === 0) return 'Dominant preparation';
  if (isOscillating && D >= 1) return 'Dominant tension loop';
  if (D === 0 && (T + TP) >= 1) return 'Tonic prolongation';
  if ((T + TP) / total >= 0.5 && D >= 1 && funcs[funcs.length - 1] !== 'D') return 'Tonic expansion';
  if (T >= 1 && D >= 1 && funcs[funcs.length - 1] === 'T') return 'Full resolution';
  if (D >= 1 && funcs[funcs.length - 1] === 'D') return 'Dominant tension';
  return 'Mixed harmonic motion';
}

function _arcTag(label) {
  return ({
    'Tonic prolongation':    'stable',
    'Dominant preparation':  'building',
    'Dominant tension loop': 'tension',
    'Tonic expansion':       'floating',
    'Full resolution':       'resolved',
    'Dominant tension':      'suspended',
    'Mixed harmonic motion': 'mixed',
  })[label] ?? 'mixed';
}

function _bassMotionText(chords) {
  if (chords.length < 2) return null;
  const intervals = [];
  for (let i = 0; i < chords.length - 1; i++) {
    const diff = Math.abs(normalizePitch(chords[i + 1].root) - normalizePitch(chords[i].root));
    intervals.push(Math.min(diff, 12 - diff));
  }
  const step   = intervals.filter(v => v <= 2).length;
  const fourth = intervals.filter(v => v === 5 || v === 7).length;
  if (step > 0 && fourth > 0) return 'Mix of stepwise (smooth) and 4th/5th jumps (uplifting)';
  if (fourth > step) return 'Frequent 4th/5th jumps — circle-of-fifths motion';
  return 'Predominantly stepwise — smooth, vocal motion';
}

/**
 * Render a structured section-by-section harmony analysis into #progression-story.
 */
export function renderProgressionStory(key, chords, cadences = [], patterns = [], modulations = [], sections = [], sectionKeys = {}) {
  const container = document.getElementById('progression-story');
  if (!container) return;

  if (!key || !chords || chords.length === 0) {
    container.innerHTML = '<span class="story-placeholder">Add chords to see a live progression analysis…</span>';
    return;
  }

  const effectiveSections = sections.length > 0
    ? sections
    : [{ id: 'verse-1', type: 'verse', label: 'Progression' }];

  const html = [];
  const sectionLabels = [];
  const arcParts = [];

  // ── Section-by-Section Harmony ─────────────────────────────────────────
  html.push('<div class="story-h2">Section-by-Section Harmony</div>');

  for (const sec of effectiveSections) {
    const secChords = chords.filter(c => _storySecOf(c) === sec.id);
    if (secChords.length === 0) continue;

    const funcs = secChords.map(c => {
      const deg = getDegreeInKey(c.root, key);
      return deg ? getHarmonicFunction(deg, key.quality) : null;
    }).filter(Boolean);

    const numerals = _numeralSeq(secChords, key);
    const label    = _funcLabel(funcs);
    const arc      = _arcTag(label);

    const secCads = cadences.filter(cad => {
      const ch = chords[cad.idx];
      return ch && _storySecOf(ch) === sec.id;
    });

    const feelMap = {
      'Tonic prolongation':    'stable, grounded, repetitive',
      'Dominant preparation':  'building, anticipatory',
      'Dominant tension loop': 'builds tension without resolving',
      'Tonic expansion':       'open, floating',
      'Full resolution':       'strong, purposeful resolution',
      'Dominant tension':      'suspended, anticipatory',
      'Mixed harmonic motion': 'varied',
    };

    sectionLabels.push(label);
    arcParts.push(`${sec.label}: <span class="story-arc-tag story-arc-${arc}">${arc}</span>`);

    html.push('<div class="story-section">');
    html.push(`<div class="story-h3">${sec.label}</div>`);
    html.push('<ul class="story-list">');
    html.push(`<li>Progression: <strong>${numerals}</strong></li>`);
    html.push(`<li>Function: <strong>${label}</strong></li>`);
    html.push(`<li>Feel: ${feelMap[label] ?? 'varied'}</li>`);
    {
      const isLoop = label === 'Dominant preparation' || label.includes('loop');
      if (secCads.length === 0) {
        html.push(`<li>No strong cadence — <em>${isLoop ? 'continuous looping motion' : 'floating / continuous feel'}</em></li>`);
      } else if (isLoop) {
        html.push('<li>No true cadence — <em>continuous looping motion</em></li>');
      } else {
        for (const cad of secCads) {
          const resChord = chords[cad.idx];
          const atEnd = resChord === secChords[secChords.length - 1];
          const chordA = cad.chordA?.name ?? String(cad.chordA ?? '?');
          const chordB = cad.chordB?.name ?? String(cad.chordB ?? '?');
          const cadLabel = atEnd
            ? `${cad.type.name} — ${chordA}→${chordB}`
            : `Weak ${cad.type.abbr} motion — ${chordA}→${chordB} (mid-phrase)`;
          html.push(`<li>${cadLabel}</li>`);
        }
      }
    }
    html.push('</ul></div>');
    html.push('<hr class="story-rule">');
  }

  // ── Harmonic Characteristics ───────────────────────────────────────────
  html.push('<div class="story-h2">Harmonic Characteristics</div>');

  // Cadences
  html.push('<div class="story-h3">Cadences</div><ul class="story-list">');
  if (cadences.length === 0) {
    html.push('<li>No cadence detected</li>');
  } else {
    if (!cadences.some(c => c.typeKey === 'PAC' || c.typeKey === 'IAC'))
      html.push('<li>No strong authentic cadence (V–I)</li>');
    if (cadences.some(c => c.typeKey === 'PAC'))
      html.push('<li>Authentic cadence (V–I) — strong resolution</li>');
    if (cadences.some(c => c.typeKey === 'PC'))
      html.push('<li>Plagal motion (IV–I) — "Amen" cadence</li>');
    if (cadences.some(c => c.typeKey === 'HC'))
      html.push('<li>Half cadence — ends on V, feeling unresolved</li>');
    if (cadences.some(c => c.typeKey === 'DC'))
      html.push('<li>Deceptive cadence (V–vi) — harmonic surprise</li>');
    if (!cadences.some(c => c.typeKey === 'PAC'))
      html.push('<li>Resolution is delayed / avoided</li>');
  }
  html.push('</ul><hr class="story-rule">');

  // Bass Motion
  const bassText = _bassMotionText(chords);
  if (bassText) {
    html.push(`<div class="story-h3">Bass Motion</div><ul class="story-list"><li>${bassText}</li><li>Contributes to emotional contour</li></ul><hr class="story-rule">`);
  }

  // Harmonic Rhythm
  const hasLoop = sectionLabels.some(l => l.includes('loop') || l === 'Dominant preparation');
  const hasPAC  = cadences.some(c => c.typeKey === 'PAC');
  html.push('<div class="story-h3">Harmonic Rhythm</div><ul class="story-list">');
  if (hasLoop) {
    html.push('<li>Loop-based progression with delayed resolution</li><li>Avoids strong cadential endings</li>');
  } else if (hasPAC) {
    html.push('<li>Resolving arc — functional movement toward home</li>');
  } else {
    html.push('<li>Open progression — avoids strong resolution</li>');
  }
  html.push('</ul>');

  // Emotional Arc
  if (arcParts.length > 0) {
    html.push(`<hr class="story-rule"><div class="story-h3">Emotional Arc</div><ul class="story-list"><li>${arcParts.join('</li><li>')}</li></ul>`);
  }

  container.innerHTML = `<div class="story-block">${html.join('')}</div>`;
}

// Export richness helper for use in app.js section character/texture delta
export { _chordRichness };
