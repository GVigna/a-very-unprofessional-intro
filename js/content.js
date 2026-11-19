/* =========================================================
   STORY CONTENT — edit this file only to change the story.
   ---------------------------------------------------------
   Each beat appears, in order, where the visitor clicks/taps.

   COMMON OPTIONS (any beat)
   clear     true → this tap first wipes everything off the screen
   free      true → (photos/videos/stacks) placed in the free space around
             the texts instead of at the tap
   tilt      rotation in degrees. Omit for a small random tilt, 0 for straight.
   lifespan  how many MORE taps it survives before disappearing.
             Omit it and the beat stays forever.
   also      more beats that come with the SAME tap, each with
               offset: [x, y]  distance from the tap, as a share of the
                               screen's short side (e.g. [-0.4, -0.3])
               delay: ms       wait before it appears
               at: [x, y]      → fixed spot, as a share of the screen
               free: true      → goes in the free space around the texts
                                 (shrinks if needed, never covers them)
               free: "all"     → avoids texts AND photos/videos already there
               below: true     → stuck right under the main item (left-aligned)
               above: true     → stuck right above it
               gap: px         space from the main item (with below/above)
               shift: n        move it right by n × screen short side (with below/above)

   TYPES
   ---------------------------------------------------------
   "text"    text     the words. Use \n for a line break.
             style    "title" | "big" | "sub" | "body" | "note" | "small"
                      (default: normal bold)
             align    "center" → centred lines
             color    "secondary" (orange) | "primary" (violet)
             typing   true → typed out letter by letter (speed: ms per letter)
             typeFrom "a phrase" → the text before it appears at once,
                      only that phrase and what follows is typed
             typePause ms of pause before the typing starts (default 900)
             strike   "a phrase" → after typing, a line crosses it out
             links    { "phrase": "https://…" } → that phrase becomes a link
                      (opens in a new tab; tapping it never advances the story);
                      a little cursor clicks on it once to show it's clickable
                      (linkHint: false → no cursor)
             id       a name for this text, so a later beat can replace it
             into     "id" → this text takes the place of that earlier text
             then     beats that start BY THEMSELVES when the typing ends
                      (delay: ms; at: [x, y] share of the screen, default
                      = just below the text)
             words    true → appears one word at a time (speed: ms per word)
             lines    true → appears one line at a time (speed: ms per line)

   "image"   src      the photo, e.g. "media/00_OPENING/test1.webp"
   "video"            (no src → a coloured placeholder box with a label)
             label    placeholder caption
             ratio    width / height of the photo, e.g. 4/5, 16/9
             size     "xxs" | "xs" | "s" | "m" | "l"
             color    placeholder fill colour
             scale    e.g. 0.8 → 80% of the size (for slightly different sizes)
             frame    "polaroid" → white instant-photo border
             pixelated true → big crisp pixels (use a tiny image for a strong effect)
             reveal   (photos only) a colour wash slides off the photo and back
                      { color: "var(--primary)" | "#hex",
                        cutout: false   → wash covers the whole rectangle
                                         (default: follows the cut-out shape),
                        mask: "file.png" → use a ready-made coloured silhouette
                                         (e.g. with pixel/blocky edges) — then
                                         color is ignored,
                        loop: false     → reveal once and stop,
                        duration: 4500  → ms for one full loop }

   "video"   src: "file.mp4" → a real video: muted, loops, plays inline
             poster: "file.jpg" → still frame shown while it loads
             loop: false → plays once and stops on the last frame
             sound: true → tries to play WITH audio; if the browser blocks it,
                     it plays muted with a small SOUND ON button
             subs: [{ from: 2.0, to: 4.5, text: "…" }] → subtitles (seconds)

   "stack"   photos   slide up from below one on top of the other (stop-motion)
             interval ms between photos (default 900)
             leave    ms after the last one → they slide away by themselves
                      (leaveInterval: ms between each one leaving)
             lifespan: 1 instead → they stay until the next tap, then slide away

   "burst"   photos   list of photos, same options as "image"
             size     default size of every photo in the burst
             speed    ms between photos (default 140)
             keep     "all" (default) → they pile up
                      "last"          → each one replaces the previous (flipbook)
             spread   0–1, how far from the tap they scatter
             vanish   ms → after the last photo lands, wait this long, then
                      they all disappear together

   "chat"    title    optional name at the top of the chat
             messages list of { from: "me" | "them", text: "…" }
                      optional per message: typing (ms of "…"), pause (ms after)
   ========================================================= */

/* ---------- already on screen when the site opens (draggable, always stay) */
window.INTRO = {
  center: true,       // true → the block sits in the middle of the screen
  x: 0.05, y: 0.09,   // used only when center is false (share of the screen)
  gap: 18,            // px between lines
  items: [
    { type: "text", style: "title", align: "center", tilt: 0,
      text: "A VERY UNPROFESSIONAL INTRO TO MY PROFESSIONAL LIFE." },
    { type: "text", style: "sub", align: "center", color: "primary", tilt: 0,
      text: "Click and drag anywhere. Things might get weird." }
  ]
};

/* ---------- the story, one beat per tap */
window.STORY = [

  /* ===== OPENING ===== */
  { type: "image", src: "media/00_OPENING/test1.webp", alt: "Giulia",
    ratio: 0.3944, size: "m", tilt: 0,
    reveal: { mask: "media/00_OPENING/test1_mask_orange.png" },
    also: [
      { type: "text", text: "Hi, I’m Giulia", style: "big", words: true, tilt: 0,
        offset: [-0.45, 0.08], delay: 700 }
    ]
  },

  /* ===== CHAPTER 1 — IED / SUMMER JOBS ===== */
  // tap: the screen is wiped, then the IED block appears
  { clear: true,
    type: "text", text: "IED Fashion School", style: "big", tilt: 0,
    also: [
      { above: true, type: "text", text: "2010", style: "note", tilt: 0, gap: 6, delay: 350 },
      { below: true, type: "text", style: "body", typing: true, typeFrom: "Some of it", speed: 45, tilt: 0, gap: 14, delay: 700,
        text: "At 18, I decided to study Fashion Design at IED in Rome.\nI learned a lot.\nSome of it I even remember.",
        // as soon as the typing ends: burst of IED photos (no tap needed), then they vanish
        then: [
          { type: "burst", size: "s", speed: 110, spread: 0.45, vanish: 350, delay: 400, photos: [
              { src: "media/01_CAPITOLO_1/ied_01.webp", ratio: 1.3387 },
              { src: "media/01_CAPITOLO_1/ied_02.webp", ratio: 1.3387 },
              { src: "media/01_CAPITOLO_1/ied_03.webp", ratio: 0.747 },
              { src: "media/01_CAPITOLO_1/ied_04.webp", ratio: 0.747 },
              { src: "media/01_CAPITOLO_1/ied_05.webp", ratio: 0.747 },
              { src: "media/01_CAPITOLO_1/ied_06.webp", ratio: 0.747 },
              { src: "media/01_CAPITOLO_1/ied_07.webp", ratio: 0.75 },
              { src: "media/01_CAPITOLO_1/ied_08.webp", ratio: 0.747 },
              { src: "media/01_CAPITOLO_1/ied_09.webp", ratio: 1.3387 }
          ]}
        ]
      }
    ]
  },

  // tap: summer jobs, with two tiny photos
  { type: "text", text: "SUMMER JOBS: RESORT ENTERTAINER IN GREECE & EGYPT", tilt: 0, color: "secondary",
    also: [
      { below: true, type: "text", style: "body", color: "secondary", tilt: 0, gap: 10, delay: 350,
        text: "More or less 18 years old.\nIn charge of teenagers aged 14–16.\nSomehow, this involved dancing on tables in Bar Street." },
      { above: true, type: "image", src: "media/01_CAPITOLO_1/summer_01.webp", ratio: 0.75,
        size: "xxs", tilt: -5, gap: 12, delay: 800 },
      { above: true, type: "image", src: "media/01_CAPITOLO_1/summer_02.webp", ratio: 0.7471,
        size: "xxs", scale: 0.8, tilt: 6, gap: 20, shift: 0.22, delay: 1100 }
    ]
  },

  /* ===== CHAPTER 2 — NEW YORK ===== */
  // tap: screen wiped → title + text (only "I was wrong." is typed, then crossed out)
  { clear: true,
    type: "text", text: "2012 New York + Main character syndrome", style: "big", tilt: 0,
    also: [
      { below: true, id: "ny-text", type: "text", style: "body", typing: true, typeFrom: "I was wrong.",
        speed: 60, tilt: 0, gap: 14, delay: 600, strike: "I was wrong.",
        links: { "Suzanne Rae": "https://suzannerae.com/" },
        text: "Working for Suzanne Rae.\nFeminist, sustainable fashion.\nI thought all fashion jobs were like this.\nI was wrong.",
        // right after the crossing-out line: the three screenshots slide up by themselves
        // (in the free space) and stay
        then: [
          { free: true, type: "stack", size: "m", interval: 900, delay: 1200,
            photos: [
              { src: "media/02_CAPITOLO_2/ny_03.webp", ratio: 0.6667 },   // 2013-09-30 23.55.43
              { src: "media/02_CAPITOLO_2/ny_01.webp", ratio: 0.6667 },   // 2013-09-16 20.25.06
              { src: "media/02_CAPITOLO_2/ny_02.webp", ratio: 0.6667 }    // 2013-09-16 15.22.02
          ]}
        ]
      }
    ]
  },

  // tap: the small text becomes something else, then the video appears by itself
  { type: "text", into: "ny-text", style: "body", typing: true, typeFrom: "Main character syndrome", speed: 45, tilt: 0,
    text: "Stumbled upon the set of Girls on my way to work.\nMain character syndrome, basically.",
    then: [
      { free: "all", type: "video", src: "media/02_CAPITOLO_2/girls.mp4", poster: "media/02_CAPITOLO_2/girls_poster.jpg",
        ratio: 16 / 9, size: "l", tilt: 0, delay: 300,
        loop: false,          // plays once (with its sound), then stops on the last frame
        sound: true,          // tries to play with audio; if the browser blocks it → muted + SOUND ON button
        subs: [               // subtitles (seconds from the start of the clip)
          { from: 1,  to: 3,  text: "I don't wanna freak you out" },
          { from: 3,  to: 5,  text: "but I think that I may be" },
          { from: 5,  to: 7,  text: "the voice of my generation" },
          { from: 7,  to: 11, text: "or at least, a voice" },
          { from: 12, to: 13, text: "of a generation" }
        ] }
    ]
  },

  /* ===== CHAPTER 3 — LONDON ===== */
  // tap: everything goes, "London" + the Queen meme (in the free space)
  { clear: true,
    type: "text", text: "London", style: "big", tilt: 0,
    also: [
      { free: true, type: "image", src: "media/03_CAPITOLO_3/queen_meme.webp", ratio: 1.5873,
        size: "m", delay: 450 }
    ]
  },

  { type: "text", text: "(to be continued)", style: "note", tilt: 0 }
];
