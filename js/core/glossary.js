/**
 * Music theory glossary — definitions and contextual term detection.
 */

export const GLOSSARY = {
  tonic: {
    term: 'Tonic',
    short: 'The I chord — home base, fully resolved.',
    long:  'The tonic chord is built on the first scale degree. It represents stability, rest, and arrival. All harmonic tension in a piece ultimately resolves here; everything else is motion away from or back toward this point.',
  },
  dominant: {
    term: 'Dominant',
    short: 'The V chord — maximum tension, pulls strongly to the tonic.',
    long:  'Built on the 5th scale degree, the dominant chord contains the leading tone which creates a powerful half-step pull upward to the tonic root. Adding a 7th (V7) intensifies this further. The V→I motion is the most fundamental resolution in Western tonal harmony.',
  },
  subdominant: {
    term: 'Subdominant',
    short: 'The IV chord — moves away from the tonic, creates lift.',
    long:  'Built on the 4th scale degree, the subdominant creates a sense of departure from home. It often precedes the dominant (IV→V→I) or resolves directly to I in the plagal ("Amen") cadence. In blues and rock, the IV chord is one of the most-used harmonic building blocks.',
  },
  scale_degree: {
    term: 'Scale Degree',
    short: 'The numbered position of a note within a scale (1st through 7th).',
    long:  'Each note in a 7-note scale is assigned a number counting up from the root (1–7). Scale degrees let musicians describe patterns without naming a specific key. Roman numerals (I–VII) label the chords built on each degree.',
  },
  diatonic: {
    term: 'Diatonic',
    short: 'Notes or chords that naturally belong to the current key.',
    long:  'A diatonic note is one of the 7 pitches in the active scale. A diatonic chord uses only those same pitches. Chords outside the key are called non-diatonic — they introduce colour, tension, or a sense of modal contrast.',
  },
  roman_numerals: {
    term: 'Roman Numeral Notation',
    short: 'I–VII labels for scale degrees; capital = major, lowercase = minor.',
    long:  'Capital Roman numerals (I, IV, V) indicate major chords; lowercase (ii, iii, vi) indicate minor; ° marks diminished; + marks augmented. The system is key-independent — I–V–vi–IV describes the same chord relationship in every key.',
  },
  cadence: {
    term: 'Cadence',
    short: 'A chord progression that creates a sense of resolution or pause.',
    long:  'A cadence is a harmonic punctuation mark — V→I (authentic) gives the strongest resolution; IV→I (plagal) is softer and warmer; V→vi (deceptive) surprises by landing somewhere unexpected. Cadences define the rhythmic shape and breathing of a piece.',
  },
  relative_key: {
    term: 'Relative Key',
    short: 'A major and minor key sharing the exact same seven notes.',
    long:  'Every major key has a relative minor starting 3 semitones below it — and vice versa. C major and A minor share the notes C D E F G A B but with different tonal centres. Composers pivot between relative keys to shift mood without changing the key signature.',
  },
  circle_of_fifths: {
    term: 'Circle of Fifths',
    short: 'A diagram arranging all 12 keys in ascending intervals of a perfect fifth.',
    long:  'Moving clockwise adds one sharp to the key signature; counterclockwise adds one flat. Adjacent keys share 6 of 7 scale notes, making them harmonically close. Secondary dominants, common modulations, and cycle-of-fourths progressions all follow circle-of-fifths logic.',
  },
  leading_tone: {
    term: 'Leading Tone',
    short: 'Scale degree 7 in a major key — a half step below the tonic.',
    long:  'Because it sits just a semitone below the root, the leading tone creates a strong upward pull that "leads" to the tonic. It appears in the dominant (V) and vii° chords, which is why both feel tense and demand resolution. In harmonic minor, the raised 7th serves this same role.',
  },
  subtonic: {
    term: 'Subtonic',
    short: 'Scale degree 7 in natural minor — a whole step below the tonic.',
    long:  'Unlike the leading tone in major, the subtonic is a full whole step below the root, giving it a much weaker pull upward. This is why the v chord in natural minor feels less tense. The natural minor VII chord (e.g. G major in A minor) is common in rock precisely because it does not demand resolution.',
  },
  natural_minor: {
    term: 'Natural Minor Scale',
    short: 'The standard minor scale — whole-whole-half-whole-whole-half-whole.',
    long:  'Natural minor (Aeolian mode) is the most common minor scale. Its whole-step subtonic gives a darker, less resolved feel compared to harmonic minor. The scale is identical to starting a major scale from its 6th degree — A natural minor uses the same pitches as C major.',
  },
  harmonic_minor: {
    term: 'Harmonic Minor Scale',
    short: 'Natural minor with a raised 7th — creates a strong leading tone.',
    long:  'Raising the 7th degree by a half step creates a half-step approach to the tonic, producing a major V chord for stronger authentic cadences. The raised 7th also creates an augmented 2nd between degrees 6 and 7 — a striking interval heard in classical, metal, and Middle Eastern music.',
  },
  borrowed_chord: {
    term: 'Borrowed Chord',
    short: 'A chord taken from the parallel key (same root, opposite quality).',
    long:  'In C major, borrowing from C minor gives access to bVII (Bb), bVI (Ab), bIII (Eb), and iv (Fm). These "minor colour" chords add darkness and drama without fully modulating. The technique is called modal mixture. Classic examples: "Bohemian Rhapsody" (bVI–bVII–I), "Blackbird" (borrowed iv).',
  },
  mode_mixture: {
    term: 'Mode Mixture',
    short: 'Blending chords from parallel major and minor on the same root.',
    long:  'Rather than modulating to a new key, mode mixture integrates chords from the parallel minor (or major) for emotional depth. A C major progression might include Fm (iv from C minor) — the parallel key\'s minor iv adds a soulful, darker quality against the otherwise major-key progression.',
  },
  parallel_key: {
    term: 'Parallel Key',
    short: 'Major and minor keys sharing the same root note (e.g. C major ↔ C minor).',
    long:  'Parallel keys share a tonic pitch but differ in scale notes and mood. Borrowing chords from the parallel key (modal mixture) is a powerful tool — dramatically different from modulating to the relative key. C major and C minor are parallel; C major and A minor are relative.',
  },
  secondary_dominant: {
    term: 'Secondary Dominant',
    short: 'A V7 chord that resolves to a chord other than the tonic.',
    long:  'Any diatonic chord can temporarily act as a local tonic — its secondary dominant V7 creates a strong approach. For example, in C major, A7 is V7/ii and resolves to Dm. Secondary dominants add harmonic momentum and a sense of brief tonicisation without fully modulating.',
  },
  authentic_cadence: {
    term: 'Authentic Cadence (V→I)',
    short: 'The strongest cadential motion in tonal music — dominant resolves to tonic.',
    long:  'The V→I cadence is the defining resolution of Western tonal music. The leading tone resolves upward to the root, and the dominant\'s 5th typically moves down. A V7→I makes this resolution even more decisive. Almost every tonal piece ends with at least one authentic cadence.',
  },
  plagal_cadence: {
    term: 'Plagal Cadence (IV→I)',
    short: 'The "Amen" cadence — subdominant resolves gently to tonic.',
    long:  'Less decisive than V→I, the plagal cadence resolves the subdominant directly to the tonic. It\'s named for its traditional use in hymn endings ("A-men"). In blues, gospel, and rock it appears at the end of verses and choruses. The IV chord\'s two shared notes with I make the resolution soft and warm.',
  },
  pre_dominant: {
    term: 'Pre-dominant',
    short: 'Chords that naturally lead to V before resolving to I.',
    long:  'The ii (supertonic) and IV (subdominant) chords most commonly precede V, building harmonic momentum toward resolution. ii→V→I and IV→V→I are foundational progressions. In jazz, the ii7→V7→Imaj7 cadence is the single most important harmonic building block.',
  },
  voice_leading: {
    term: 'Voice Leading',
    short: 'The smooth, step-wise movement of individual notes between chords.',
    long:  'Good voice leading minimises the distance each note moves between chords. Common tones are held; other notes move by half step or whole step. Parallel fifths and octaves are traditionally avoided as they reduce voice independence. Smooth voice leading is a major reason some chord progressions feel more natural than others.',
  },
  tritone: {
    term: 'Tritone',
    short: 'An interval of 6 semitones — the most harmonically tense interval.',
    long:  'The tritone divides the octave in half and historically was called "diabolus in musica." It appears between the 3rd and 7th of a dominant-7th chord, creating the tension that demands resolution. Diminished chords are built from stacked tritones and minor thirds, making them maximally unstable.',
  },
  pentatonic: {
    term: 'Pentatonic Scale',
    short: 'A 5-note scale with no half-step "avoid notes" — versatile for soloing.',
    long:  'The major pentatonic (1-2-3-5-6) and minor pentatonic (1-b3-4-5-b7) omit the scale degrees most likely to clash with underlying chords. The minor pentatonic is the backbone of blues, rock, and countless guitar solos. Adding the b5 "blue note" to the minor pentatonic creates the full blues scale.',
  },
  modes: {
    term: 'Modes',
    short: 'Scales derived by starting a major scale from a different degree.',
    long:  'There are 7 modes: Ionian (major), Dorian, Phrygian, Lydian, Mixolydian, Aeolian (natural minor), and Locrian. Each has a distinct character. Modes are used when a progression centres on a particular scale degree rather than the I chord — e.g. Dorian over a minor ii vamp, Mixolydian over a dominant chord.',
  },
  dorian: {
    term: 'Dorian Mode',
    short: 'A minor mode with a natural 6th — brighter and jazzier than natural minor.',
    long:  'Dorian is natural minor with a raised 6th degree. Its slightly brighter sound is widely used in jazz, rock, and funk. Famous examples: "So What" (Miles Davis), "Oye Como Va" (Santana), "Scarborough Fair." When a progression centres on the ii chord, Dorian is often the implied scale.',
  },
  mixolydian: {
    term: 'Mixolydian Mode',
    short: 'A major mode with a flatted 7th — the sound of blues and rock.',
    long:  'Mixolydian is the major scale with a b7. It\'s the scale implied when a dominant-7th chord functions as a tonal centre rather than resolving to a tonic. Used extensively in blues, classic rock, and folk — "Sweet Home Alabama," "Norwegian Wood," "Sympathy for the Devil." The b7 gives it a relaxed, earthy quality.',
  },
  inversion: {
    term: 'Chord Inversion',
    short: 'A chord voicing with a note other than the root in the bass.',
    long:  'Root position has the root as the lowest note. First inversion has the 3rd in the bass (e.g. C/E); second inversion has the 5th (C/G). Inversions create smoother bass lines and different degrees of stability — second inversion is particularly unstable and often resolves to V.',
  },
  voicing: {
    term: 'Voicing',
    short: 'A specific arrangement of a chord\'s notes across the guitar strings.',
    long:  'The same chord can be voiced many different ways — open shapes, barre shapes, three-note partials, or spread voicings. Voicing affects register, texture, and playability. Many 7th chord voicings omit the 5th to keep a clean sound while preserving the chord\'s identity.',
  },
  barre_chord: {
    term: 'Barre Chord',
    short: 'A chord shape where one finger presses all strings at one fret.',
    long:  'Barring all strings at one fret effectively moves the nut position, making every chord shape transposable up the neck. An E-shape barre at fret 5 becomes A major; an A-shape barre at fret 7 becomes E major. Barre chords are the foundation of moveable chord vocabulary on guitar.',
  },
  open_position: {
    term: 'Open Position',
    short: 'Chord and scale shapes near the nut that use open strings.',
    long:  'Open position chords (C, G, D, Em, Am, etc.) incorporate the resonance of open (unfretted) strings, giving them a full, ringing quality. Scale positions in open position span roughly frets 0–4. Playing in open position allows open strings to act as scale notes, adding sustain and resonance.',
  },

  // ── New features ────────────────────────────────────────────────────────────

  harmonic_function: {
    term: 'Harmonic Function',
    short: 'The role a chord plays in harmonic motion: Tonic, Pre-Dominant, or Dominant.',
    long:  'Every chord in a key has a harmonic function that describes its gravitational pull. <strong>Tonic (T)</strong> — I and vi — is home; it feels stable and resolved. <strong>Tonic Prolongation (TP)</strong> — iii — extends the feeling of home. <strong>Pre-Dominant (PD)</strong> — IV and ii — creates momentum away from tonic toward tension. <strong>Dominant (D)</strong> — V and vii° — is maximum tension; it demands resolution back to Tonic. The conventional flow is T → PD → D → T.',
  },
  deceptive_cadence: {
    term: 'Deceptive Cadence (V→vi)',
    short: 'V resolves "deceptively" to vi instead of I — a surprise landing.',
    long:  'Instead of the expected V→I authentic cadence, the music lands on vi (the relative minor), which shares two notes with I but sounds distinctly different. The surprise effect makes the phrase feel unfinished and often pushes the music forward into another section. Used constantly in pop, classical, and gospel to avoid formulaic endings.',
  },
  half_cadence: {
    term: 'Half Cadence (→V)',
    short: 'A phrase that ends on V — feels open and unresolved, like a comma.',
    long:  'A half cadence lands on the dominant (V) at the end of a phrase, creating a sense of pause rather than resolution. Because V is the tension chord, ending there leaves the listener expecting more music to follow. It\'s the harmonic equivalent of a question mark. Common in classical periods and call-and-response structures.',
  },
  named_progression: {
    term: 'Named Progression',
    short: 'A recognisable chord pattern that appears across hundreds of songs.',
    long:  'Certain Roman numeral sequences are so widely used they have names. The <strong>Best-Seller / Axis progression</strong> (I–V–vi–IV) underlies hundreds of pop hits. The <strong>50s Doo-Wop</strong> (I–vi–IV–V) defined early rock \'n\' roll. The <strong>ii–V–I</strong> is the cornerstone of jazz harmony. When the app detects one of these patterns in your progression, it shows the name, genre, and well-known songs that use it.',
  },
  voice_leading_score: {
    term: 'Voice Leading Score',
    short: 'A 0–100 smoothness rating measuring how little each note moves between chords.',
    long:  'The app calculates a voice leading score for each voicing relative to your current chord. <strong>Smooth (80–100)</strong>: most notes stay put or move by a half step. <strong>Easy (60–79)</strong>: modest movement with some common tones. <strong>Moderate (40–59)</strong>: noticeable movement across the neck. <strong>Jump (0–39)</strong>: large position shift required. Higher scores mean a more connected, melodic transition — important for fingerpicking, legato playing, and sophisticated chord substitutions.',
  },
  modulation: {
    term: 'Modulation',
    short: 'A shift from one tonal centre to another within a progression.',
    long:  'Modulation happens when a piece moves from one key to another, establishing a new tonal centre. The most common type uses a <strong>pivot chord</strong> — a chord that exists diatonically in both the old and new key — to make the transition smooth. Direct (abrupt) modulation skips the pivot entirely for a dramatic jolt. The app detects modulations by analysing a sliding window of 4-chord groups and flagging when the most likely key changes.',
  },
  pivot_chord: {
    term: 'Pivot Chord',
    short: 'A chord that belongs to two keys, used to modulate smoothly between them.',
    long:  'When modulating from C major to G major, the D minor chord (ii in C major) can serve as the pivot — it\'s also vi in G major. The pivot chord sounds natural in both contexts, so the ear doesn\'t notice the key change until the new key is established. Pivot chord modulations are the smoothest and most common in classical, jazz, and pop music.',
  },
  chord_scale: {
    term: 'Chord-Scale Relationship',
    short: 'Which scale(s) work best for improvising over a given chord quality.',
    long:  'Jazz theory maps each chord quality to one or more "target" scales that share the most notes and avoid the worst clashes. <strong>Major / maj7</strong> → Ionian (major) or Lydian. <strong>Minor / min7</strong> → Dorian or Aeolian. <strong>Dominant 7th</strong> → Mixolydian. <strong>Half-diminished (ø7)</strong> → Locrian. <strong>Diminished 7th</strong> → Whole-Half Diminished. The "Scales for this chord" chips in the Current Chord panel let you instantly overlay any of these on the fretboard.',
  },
  song_form: {
    term: 'Song Form Template',
    short: 'A pre-built chord progression structure for a common song style.',
    long:  'Song form templates give you a starting-point progression in your current key, structured across sections (Verse, Chorus, Bridge). Available templates include the 12-Bar Blues, Pop Verse-Chorus (I–V–vi–IV verse / IV–I–V–vi chorus), Jazz ii–V–I Turnaround, 50s Doo-Wop, Andalusian Cadence, Minor Blues, Pachelbel Canon, and the Best-Seller / Axis pattern. Select a template from the "Start from Template…" dropdown in the Chord Progression header.',
  },
  relationship_analysis: {
    term: 'Relationship Analysis',
    short: 'A breakdown of the intervals, common tones, and harmonic function between adjacent chords.',
    long:  'The Relationship Analysis panel shows how each chord in your progression connects to the next. For each transition it reports: the <strong>root motion interval</strong> (e.g. P5 ↓ — perfect fifth down) and its direction; the number of <strong>common tones</strong> (shared pitches that smooth the transition); and the <strong>harmonic function flow</strong> (e.g. Pre-Dominant → Dominant). Click "Show Full Song Analysis" for a detailed per-transition table plus a narrative summary. Ctrl+click chord chips to select a subset, then click "Show Relationship" to analyse just those chords.',
  },
  interval_label: {
    term: 'Interval Label',
    short: 'The name of a note\'s distance from the chord root (Root, M3, P5, b7, etc.).',
    long:  'Each note badge in the Current Chord panel shows both the note name and its interval above the chord\'s root: <strong>Root</strong> (unison), <strong>m3/M3</strong> (minor/major 3rd), <strong>P5</strong> (perfect 5th), <strong>b7/M7</strong> (minor/major 7th), etc. These interval labels let you instantly see the structure of any chord — e.g. Root + M3 + P5 = major triad; Root + m3 + P5 + b7 = minor 7th. Recognising intervals on the fretboard is the foundation of chord construction and improvisation.',
  },
  common_tones: {
    term: 'Common Tones',
    short: 'Notes shared between two adjacent chords — the glue of smooth voice leading.',
    long:  'Common tones are pitches that appear in both the current chord and the next. Keeping those notes stationary while the other voices move minimises overall hand movement and creates a sense of continuity. Progressions with many common tones (e.g. I–vi, which share two notes) feel cohesive; those with none (e.g. I–bII) feel more dramatic. The ✦ count in the Relationship Analysis arrows shows how many tones are shared at each step.',
  },

  // ── Inversions & Slash Chords ────────────────────────────────────────────────

  root_position: {
    term: 'Root Position',
    short: 'The chord\'s root note is the lowest-sounding note — the most stable voicing.',
    long:  'A chord is in root position when the root (the note the chord is named after) is the bass note. For example, a G major chord with G as the lowest note is in root position. Root position voicings sound the most stable and grounded. On guitar, most standard open-position chords are in root position — the low string is fretted or muted to put the root in the bass.',
  },
  first_inversion: {
    term: 'First Inversion',
    short: 'The chord\'s 3rd is the bass note — creates forward motion.',
    long:  'A chord is in first inversion when the 3rd of the chord is the lowest note. Written as a slash chord: G/B means G major with B (the 3rd) in the bass. First inversion chords have a characteristic forward pull — the bass note wants to resolve up by a half step to the root of the next chord (e.g. G/B → C). They are common in descending bass lines and smooth voice-led progressions.',
  },
  second_inversion: {
    term: 'Second Inversion',
    short: 'The chord\'s 5th is the bass note — unstable, pulls toward the bass-note chord.',
    long:  'A chord is in second inversion when the 5th of the chord is the lowest note. Written as a slash chord: C/G means C major with G in the bass. Second inversion chords feel less stable than root position or first inversion, and typically resolve to the chord built on the bass note (C/G → G). The cadential 6/4 (I in second inversion before V) is one of the most recognisable uses in classical music.',
  },
  slash_chord: {
    term: 'Slash Chord',
    short: 'Notation for specifying the bass note: "Chord / Bass" (e.g. G/B).',
    long:  'A slash chord is written as X/Y where X is the chord quality and Y is the bass note. G/B means play a G major chord with B as the lowest note (first inversion). D/F# means D major with F# in the bass. Slash chords often appear in descending or ascending bass lines — e.g. C → G/B → Am creates a smooth stepwise descent. On guitar, they require muting higher strings below the target bass note or finding the bass note on a lower string.',
  },

  // ── Intervals & Steps ───────────────────────────────────────────────────────

  half_step: {
    term: 'Half Step (Semitone)',
    short: 'The smallest interval in Western music — one fret on guitar.',
    long:  'A half step (or semitone) is the distance from one note to the very next adjacent note — no note in between. On the guitar, moving one fret up or down is always a half step. On the piano, adjacent keys (including black keys) are a half step apart. There is no half step between E and F, or B and C — those pairs are naturally adjacent with no sharp or flat between them. The Jaws theme is a famous half-step ostinato.',
  },
  whole_step: {
    term: 'Whole Step (Tone)',
    short: 'Two half steps — skip one note, or move two frets on guitar.',
    long:  'A whole step equals two half steps. On the guitar, moving two frets (skipping one) is a whole step. On the piano, a whole step skips one key (white or black). C to D is a whole step; D to E is a whole step; but E to F is only a half step. Understanding whole vs. half steps is essential for building scales — the major scale follows the pattern W–W–H–W–W–W–H.',
  },
  major_scale_formula: {
    term: 'Major Scale Formula (W–W–H–W–W–W–H)',
    short: 'The interval pattern that defines any major scale: Whole–Whole–Half–Whole–Whole–Whole–Half.',
    long:  'Every major scale is built by following the same pattern of whole steps (W) and half steps (H) starting from the root: <strong>W–W–H–W–W–W–H</strong>. Starting on G: G(W)A(W)B(H)C(W)D(W)E(W)F#(H)G. The F must become F# to satisfy the W between E and F#, which is why G major has one sharp. Apply this formula to any starting note to build its major scale — and to derive which notes must be sharp or flat.',
  },
  major_third: {
    term: 'Major Third',
    short: 'An interval of 4 semitones — the bright-sounding 3rd in a major chord.',
    long:  'A major third spans 4 half steps. It is the interval between the root and the 3rd degree of a major chord (and a major scale). For example, G to B is a major third (4 frets). The major third gives major chords their characteristic bright, happy quality. On guitar, on the same string, a major third is always 4 frets up from any note.',
  },
  minor_third: {
    term: 'Minor Third',
    short: 'An interval of 3 semitones — the dark-sounding 3rd in a minor chord.',
    long:  'A minor third spans 3 half steps — one semitone narrower than a major third. It is the interval between the root and the 3rd of a minor chord. For example, G to Bb is a minor third (3 frets). To convert any major chord to minor, flatten the 3rd by one half step (e.g. G–B–D becomes G–Bb–D). The minor third gives minor chords their darker, more introspective quality.',
  },
  perfect_fifth: {
    term: 'Perfect Fifth',
    short: 'An interval of 7 semitones — the stable upper note in any major or minor chord.',
    long:  'A perfect fifth spans 7 half steps. It is the interval between the root and the 5th of any major or minor triad. For example, G to D is a perfect fifth. The perfect fifth is the most consonant interval after the octave, which is why power chords (root + 5th) sound so strong and full. In the circle of fifths, each key is a perfect fifth away from the next — that\'s what makes it a circle of <em>fifths</em>.',
  },

  // ── Key Signature Mnemonics ──────────────────────────────────────────────────

  sharps_mnemonic: {
    term: 'Order of Sharps — "Fat Cats Get Dizzy After Eating Breakfast"',
    short: 'Mnemonic for the order sharps are added: F# C# G# D# A# E# B#.',
    long:  'As you move clockwise around the circle of fifths, each key adds one more sharp. The order those sharps are added is always <strong>F# → C# → G# → D# → A# → E# → B#</strong>. The mnemonic "Fat Cats Get Dizzy After Eating Breakfast" gives the first letter of each sharp. G major has 1 sharp (F#). D major has 2 sharps (F#, C#). A major has 3 sharps (F#, C#, G#), and so on. To find the sharps in any key, count how many sharps that key has, then list the first N letters from the mnemonic.',
  },
  flats_mnemonic: {
    term: 'Order of Flats — "Before Eating A Donut, Get Coffee First" (BEAD GCF)',
    short: 'Mnemonic for the order flats are added: Bb Eb Ab Db Gb Cb Fb.',
    long:  'As you move counter-clockwise around the circle of fifths, each key adds one more flat. The order is always <strong>Bb → Eb → Ab → Db → Gb → Cb → Fb</strong>. The mnemonic "Before Eating A Donut, Get Coffee First" (or just "BEAD GCF") gives the first letter. F major has 1 flat (Bb). Bb major has 2 flats (Bb, Eb). Eb major has 3 flats (Bb, Eb, Ab), and so on. Notice the flats order is the exact reverse of the sharps order.',
  },
};

/**
 * Determine which glossary terms are relevant to the current app state.
 * @param {object} appState  - AppState from app.js
 * @returns {Set<string>}    - set of term keys from GLOSSARY
 */
export function getContextualTerms(appState) {
  const terms = new Set([
    'tonic', 'dominant', 'subdominant', 'scale_degree',
    'diatonic', 'roman_numerals', 'cadence',
  ]);

  const {
    activeKey, progression = [], activeScale, explorerChord,
    cadences = [], detectedPatterns = [], modulations = [],
    currentChord,
  } = appState;

  if (activeKey) {
    terms.add('relative_key');
    terms.add('circle_of_fifths');
    terms.add('harmonic_function');

    if (activeKey.quality === 'major') {
      terms.add('leading_tone');
    } else {
      terms.add('subtonic');
      terms.add('natural_minor');
      terms.add('harmonic_minor');
    }
  }

  if (progression.length >= 2) {
    terms.add('voice_leading');
    terms.add('relationship_analysis');
    terms.add('common_tones');
    terms.add('interval_label');
  }

  // Cadence-specific terms
  if (cadences.length > 0) {
    for (const c of cadences) {
      if (c.typeKey === 'AC' || c.typeKey === 'PAC') terms.add('authentic_cadence');
      if (c.typeKey === 'PC')  terms.add('plagal_cadence');
      if (c.typeKey === 'DC')  terms.add('deceptive_cadence');
      if (c.typeKey === 'HC')  terms.add('half_cadence');
    }
  }

  // Named progressions detected
  if (detectedPatterns.length > 0) {
    terms.add('named_progression');
  }

  // Modulation detected
  if (modulations.length > 0) {
    terms.add('modulation');
    terms.add('pivot_chord');
  }

  // Chord-scale chips visible when a chord is selected
  if (currentChord) {
    terms.add('chord_scale');
    terms.add('interval_label');
  }

  // Song form: always show if progression has any chords (template may have been used)
  if (progression.length > 0) {
    terms.add('song_form');
  }

  if (activeKey && progression.length > 0) {
    for (const chord of progression) {
      if (!chord) continue;

      const r = ((chord.root % 12) + 12) % 12;
      const degreeIdx = activeKey.scalePitches.indexOf(r);

      // Borrowed chord detection (root not in active key's scale)
      if (degreeIdx === -1) {
        terms.add('borrowed_chord');
        terms.add('mode_mixture');
        terms.add('parallel_key');
      }

      // Secondary dominant detection: dom7 whose P5-above is a diatonic root
      if (chord.quality === 'dom7') {
        const resolveTarget = (r + 7) % 12;
        const isDomSecondary = activeKey.diatonicChords.some(dc => ((dc.root % 12) + 12) % 12 === resolveTarget);
        if (isDomSecondary) {
          terms.add('secondary_dominant');
        }
      }

      // Pre-dominant: ii (degree 2) or IV (degree 4) present
      if (degreeIdx === 1 || degreeIdx === 3) {
        terms.add('pre_dominant');
      }

      // Tritone: dim, dim7, hdim7, or dom7 chord
      if (['dim', 'dim7', 'hdim7', 'dom7'].includes(chord.quality)) {
        terms.add('tritone');
      }

      // Voice leading score visible in voicing explorer whenever explorer is open
      if (appState.explorerChord) {
        terms.add('voice_leading_score');
      }
    }
  }

  if (activeScale) {
    const type = activeScale.type ?? '';
    if (type.includes('pentatonic')) {
      terms.add('pentatonic');
    }
    // Mode-specific terms
    if (['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'].includes(type)) {
      terms.add('modes');
      if (type === 'dorian') terms.add('dorian');
      if (type === 'mixolydian') terms.add('mixolydian');
    }
  }

  if (explorerChord) {
    terms.add('voicing');
    terms.add('barre_chord');
    terms.add('open_position');
    terms.add('voice_leading_score');
    terms.add('major_third');
    terms.add('minor_third');
    terms.add('perfect_fifth');
  }

  // Inversion terms when an inversion is detected on the fretboard
  if (appState.currentInversion && appState.currentInversion !== 'root') {
    terms.add('inversion');
    terms.add('slash_chord');
    if (appState.currentInversion === 'first') terms.add('first_inversion');
    if (appState.currentInversion === 'second') terms.add('second_inversion');
  }
  if (appState.currentInversion === 'root') {
    terms.add('root_position');
  }

  // Key signature info: always show mnemonics when a key is active
  if (activeKey) {
    terms.add('major_scale_formula');
    terms.add('half_step');
    terms.add('whole_step');
    if (activeKey.quality === 'major') {
      terms.add('sharps_mnemonic');
      terms.add('flats_mnemonic');
    }
  }

  return terms;
}
