/**
 * Relationship Analyzer Panel
 * Resting state: shows chord rows grouped by section; full analysis hidden behind
 * a "Show Full Song Analysis" button.
 * Ctrl+click mode: shows selected subset with a "Show Relationship" button.
 */

import { CHROMATIC_SHARP, normalizePitch } from '../core/notes.js';
import { SEMITONE_TO_INTERVAL_NAME, INTERVAL_FULL_NAMES } from '../core/intervals.js';
import { getDegreeInKey, getChordNumeral, getHarmonicFunction } from '../core/keys.js';
import { buildChord } from '../core/chords.js';

const FN_COLORS = { T: '#27ae60', TP: '#3498db', PD: '#f39c12', D: '#e74c3c' };
const FN_NAMES  = { T: 'Tonic', TP: 'Tonic Prol.', PD: 'Pre-Dom.', D: 'Dominant' };
const FN_FULL   = { T: 'Tonic', TP: 'Tonic Prolongation', PD: 'Pre-Dominant', D: 'Dominant' };

const MOTION_DESC = {
  0: 'same root — static pedal',
  1: 'half-step — chromatic motion',
  2: 'whole-step — stepwise motion',
  3: 'minor 3rd — mediant motion',
  4: 'major 3rd — chromatic mediant',
  5: 'perfect 4th — subdominant motion',
  6: 'tritone — maximum harmonic tension',
  7: 'perfect 5th — strongest tonal motion',
};


function describeRootMotion(semisUp) {
  const down  = 12 - semisUp;
  const dist  = Math.min(semisUp, down);
  const dir   = semisUp <= down ? '↑' : '↓';
  const iname = SEMITONE_TO_INTERVAL_NAME[dist] ?? `${dist}st`;
  const desc  = MOTION_DESC[dist] ?? `${dist} semitones`;
  return { iname, dir, desc };
}

function getChordPitches(chord) {
  if (chord.actualPitches) return chord.actualPitches.map(p => normalizePitch(p));
  return buildChord(chord.root, chord.quality);
}

function buildNarrative(key, chords) {
  if (!key || chords.length < 2) return '';

  const parts = [];
  const numerals = chords.map(c => getChordNumeral(c.root, c.quality, key));
  parts.push(`The <strong>${numerals.join('–')}</strong> movement`);

  const funcs = chords.map(c => {
    const deg = getDegreeInKey(c.root, key);
    return deg ? getHarmonicFunction(deg, key.quality) : null;
  });
  const allDiatonic = funcs.every(Boolean);

  if (allDiatonic) {
    const deduped = funcs.filter((f, i) => i === 0 || f !== funcs[i - 1]);
    const flow = deduped.map(f => `<strong>${FN_FULL[f] ?? f}</strong>`).join(' → ');
    parts.push(`follows a ${flow} flow in ${key.name}.`);
  } else {
    const diaCount = funcs.filter(Boolean).length;
    parts.push(`mixes ${diaCount} diatonic chord${diaCount !== 1 ? 's' : ''} with chromatic colour in ${key.name}.`);
  }

  if (chords.length >= 3) {
    const intervals = chords.slice(1).map((c, i) => normalizePitch(c.root - chords[i].root));
    const allSame   = intervals.every(s => s === intervals[0]);
    if (allSame) {
      const iname = SEMITONE_TO_INTERVAL_NAME[Math.min(intervals[0], 12 - intervals[0])];
      parts.push(`All roots move by a consistent <strong>${iname}</strong>.`);
    }
  }

  return parts.join(' ');
}

/** Build a chord-row + arrow HTML for a flat array of chords */
function buildChordRow(chords, key) {
  let html = '<div class="ra-chord-row">';
  for (let i = 0; i < chords.length; i++) {
    const c       = chords[i];
    const deg     = key ? getDegreeInKey(c.root, key) : null;
    const numeral = key ? getChordNumeral(c.root, c.quality, key) : '—';
    const fn      = deg ? getHarmonicFunction(deg, key.quality) : null;
    const fnColor = fn ? FN_COLORS[fn] : 'var(--text-hint)';

    html += `
      <div class="ra-chord-cell">
        <span class="ra-chord-name">${c.name}</span>
        <span class="ra-numeral">${numeral}</span>
        ${fn
          ? `<span class="ra-fn-label" style="color:${fnColor}">${FN_NAMES[fn]}</span>`
          : '<span class="ra-fn-label" style="color:var(--text-hint)">chromatic</span>'}
      </div>`;

    if (i < chords.length - 1) {
      const next  = chords[i + 1];
      const semis = normalizePitch(next.root - c.root);
      const { iname, dir } = describeRootMotion(semis);

      const pitchesA = new Set(getChordPitches(c));
      const pitchesB = new Set(getChordPitches(next));
      const ct = [...pitchesA].filter(p => pitchesB.has(normalizePitch(p))).length;

      html += `
        <div class="ra-arrow-cell">
          <span class="ra-interval-badge">${iname} ${dir}</span>
          <span class="ra-common-tones" title="${ct} common tone${ct !== 1 ? 's' : ''}">${ct}✦</span>
        </div>`;
    }
  }
  html += '</div>';
  return html;
}

/** Build transition-details + narrative HTML for a flat array of chords */
function buildDetails(chords, key) {
  let html = '';

  if (chords.length >= 2) {
    // Build raw transitions then collapse consecutive identical ones
    const rawTransitions = [];
    for (let i = 0; i < chords.length - 1; i++) {
      const a = chords[i], b = chords[i + 1];
      const semis = normalizePitch(b.root - a.root);
      const { iname, dir, desc } = describeRootMotion(semis);

      const pitchesA = new Set(getChordPitches(a));
      const pitchesB = new Set(getChordPitches(b));
      const commonPitches = [...pitchesA].filter(p => pitchesB.has(normalizePitch(p)));
      const commonNames   = commonPitches.map(p => CHROMATIC_SHARP[normalizePitch(p)]).join(', ');
      const ct = commonPitches.length;

      let keyInfo = '';
      if (key) {
        const degA = getDegreeInKey(a.root, key);
        const degB = getDegreeInKey(b.root, key);
        const fnA  = degA ? getHarmonicFunction(degA, key.quality) : null;
        const fnB  = degB ? getHarmonicFunction(degB, key.quality) : null;
        if (fnA && fnB) {
          keyInfo = `<span class="ra-fn-flow" style="color:${FN_COLORS[fnA]}">${FN_NAMES[fnA]}</span> → <span class="ra-fn-flow" style="color:${FN_COLORS[fnB]}">${FN_NAMES[fnB]}</span>`;
        }
      }

      const collapseKey = `${a.name}|${b.name}|${iname}|${dir}|${ct}|${commonNames}|${keyInfo}`;
      if (rawTransitions.length > 0 && rawTransitions[rawTransitions.length - 1].collapseKey === collapseKey) {
        rawTransitions[rawTransitions.length - 1].count++;
      } else {
        rawTransitions.push({ aName: a.name, bName: b.name, iname, dir, desc, ct, commonNames, keyInfo, collapseKey, count: 1 });
      }
    }

    html += '<div class="ra-transitions">';
    for (const { aName, bName, iname, dir, desc, ct, commonNames, keyInfo, count } of rawTransitions) {
      const countBadge = count > 1 ? ` <span class="ra-trans-count">×${count}</span>` : '';
      html += `
        <div class="ra-transition-row">
          <span class="ra-trans-pair"><strong>${aName}</strong> → <strong>${bName}</strong>${countBadge}</span>
          <span class="ra-trans-motion">${iname} ${dir} — ${desc}</span>
          <span class="ra-trans-common">${ct > 0 ? `${ct} shared: <em>${commonNames}</em>` : 'no common tones'}</span>
          ${keyInfo ? `<span class="ra-trans-fn">${keyInfo}</span>` : ''}
        </div>`;
    }
    html += '</div>';
  }

  const narrative = buildNarrative(key, chords);
  if (narrative) {
    html += `<div class="ra-narrative">${narrative}</div>`;
  }

  return html;
}

/**
 * Render the relationship analyzer panel.
 * @param {object|null} key              - active key
 * @param {object[]}    progression      - full AppState.progression
 * @param {number[]}    selectedIndices  - Ctrl+clicked chip indices ([] = show all)
 */
export function renderRelationshipAnalyzer(key, progression, selectedIndices) {
  const container = document.getElementById('relationship-analyzer');
  if (!container) return;

  const usingSubset = selectedIndices && selectedIndices.length >= 2;
  const allChords   = (progression || []).filter(Boolean);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (allChords.length === 0) {
    container.innerHTML = `
      <div class="ra-empty">
        <span class="ra-empty-icon">⇄</span>
        <span>Add chords to your progression to see relationship analysis.</span>
        <span class="ra-hint">Ctrl+click multiple chord chips to analyze a specific subset.</span>
      </div>`;
    return;
  }

  // ── Ctrl+click subset mode ───────────────────────────────────────────────────
  if (usingSubset) {
    const chords = selectedIndices.map(i => progression[i]).filter(Boolean);

    const detailsHtml = buildDetails(chords, key);

    container.innerHTML = `
      <div class="ra-header">
        <span class="section-label" style="margin-bottom:0">Chord Relationship</span>
        <span class="ra-hint">Analyzing ${chords.length} selected · Ctrl+click to change selection</span>
      </div>
      ${buildChordRow(chords, key)}
      <div class="ra-details" id="ra-details-subset">
        ${detailsHtml}
      </div>
    `;
    return;
  }

  // ── All-chords resting state (grouped by section) ────────────────────────────
  const SECTIONS       = ['verse', 'chorus', 'bridge'];
  const SECTION_LABELS = { verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge' };

  // Group by section
  const bySection = { verse: [], chorus: [], bridge: [] };
  for (const chord of allChords) {
    const sec = chord.section ?? 'verse';
    if (bySection[sec]) bySection[sec].push(chord);
  }

  let sectionRowsHtml = '';
  for (const sec of SECTIONS) {
    const chords = bySection[sec];
    if (chords.length === 0) continue;
    sectionRowsHtml += `
      <div class="ra-section-group">
        <span class="ra-section-label">${SECTION_LABELS[sec]}</span>
        ${buildChordRow(chords, key)}
      </div>`;
  }

  const detailsHtml = buildDetails(allChords, key);

  container.innerHTML = `
    ${sectionRowsHtml}
    <div class="ra-details" id="ra-details-full">
      ${detailsHtml}
    </div>
  `;
}
