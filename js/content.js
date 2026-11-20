/* =========================================================
   STORY CONTENT — edit this file only to change the story.
   ---------------------------------------------------------
   Each beat appears, in order, where the visitor clicks/taps.

   COMMON OPTIONS (any beat)
   clear     true → this tap first wipes everything off the screen
   bg        "var(--primary)" / "#hex" → the whole page changes colour
             (stays until another bg, or RESTART)
   free      true → placed in the free space instead of at the tap
             (photos/videos/stacks: around the texts; texts: around everything)
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
             color    "secondary" (orange) | "primary" (violet) | "white"
             boxed    true → white label behind (readable on top of images)
             bold     ["phrase", …] → those phrases in bold
             typing   true → typed out letter by letter (speed: ms per letter)
             typeFrom "a phrase" → the text before it appears at once,
                      only that phrase and what follows is typed
             typePause ms of pause before the typing starts (default 900)
             typeDelay ms before typing starts (the text box is already there)
             strike   "a phrase" → after typing, a line crosses it out
             links    { "phrase": "https://…" } → that phrase becomes a link
                      (opens in a new tab; tapping it never advances the story);
                      a little cursor clicks on it once to show it's clickable
                      (linkHint: false → no cursor)
             hintThen beats that pop out of the link when that cursor clicks
             id       a name for this text, so a later beat can replace it
             into     "id" → this text takes the place of that earlier text
             cues     { "word": beat } → that beat plays the moment "word" is typed
                      (free: true + jitter: 0.12 → tossed in a loose pile)
             then     beats that start BY THEMSELVES when the typing ends
                      (delay: ms; at: [x, y] share of the screen, default
                      = just below the text)
             words    true → appears one word at a time (speed: ms per word)
             lines    true → appears one line at a time (speed: ms per line)

   "image"   src      the photo, e.g. "media/00_OPENING/test1.webp"
             postcard { city, shape: "rect"|"wavy", frame: "#hex", font: "…",
                        fill: "#hex", shade: "#hex", upper: true, scale: n }
                      → a retro postcard: src = its photo, the city name on top
                        in its own font (fill colour + solid shadow)
             fill     0,1,2… (on cue beats) → spots that together cover the screen
             bleed    true → may stick out of the screen (big postcards)
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
             frame: "phone" → rounded black phone-like frame (screen recordings)
             sound: true → tries to play WITH audio; if the browser blocks it,
                     it plays muted with a small SOUND ON button
             subs: [{ from: 2.0, to: 4.5, text: "…" }] → subtitles (seconds)

   "stack"   photos   slide up from below one on top of the other (stop-motion)
             interval ms between photos (default 900)
             leave    ms after the last one → they slide away by themselves
                      (leaveInterval: ms between each one leaving)
             lifespan: 1 instead → they stay until the next tap, then slide away

   "deck"    cards    photos dealt like a deck of cards from a point, fanning
                      out in the free space nearby (interval: ms between cards,
                      spread: degrees of tilt between cards, fan: overlap)

   "burst"   photos   list of photos, same options as "image"
             size     default size of every photo in the burst
             speed    ms between photos (default 140)
             keep     "all" (default) → they pile up
                      "last"          → each one replaces the previous (flipbook)
             spread   0–1, how far from the tap they scatter
             vanish   ms → after the last photo lands, wait this long, then
                      they all disappear together

   "marquee" text     one phrase, stretched to the full screen height, scrolling
                      sideways forever (stretch: vertical stretch, speed: px/s);
                      its "then" starts when the whole phrase has come in;
                      taps pass through it; direction: "right" → enters from
                      the left (default: from the right)

   "chat"    title    optional name at the top of the chat
             messages list of { from: "me" | "them", text: "…" }
                      optional per message: typing (ms of "…"), pause (ms after)
   ========================================================= */

/* ---------- always-visible contact links (empty = hidden) */
window.CONTACT = {
  portfolio: "https://giuliavigna.com/",     // → ACTUAL PORTFOLIO
  email: "info.gommastudio@gmail.com"        // → EMAIL ME
};

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
        // when the little cursor clicks the name: 3 Google-image cards (Vogue) are dealt like a deck
        hintThen: [
          { type: "deck", size: "m", fan: 0.36, interval: 130, cards: [
              { src: "media/02_CAPITOLO_2/suzanne_1.webp", ratio: 0.79 },
              { src: "media/02_CAPITOLO_2/suzanne_2.webp", ratio: 0.661 },
              { src: "media/02_CAPITOLO_2/suzanne_3.webp", ratio: 0.79 }
          ]}
        ],
        text: "Working for Suzanne Rae.\nFeminist, sustainable fashion.\nI thought all fashion jobs were like this.\nI was wrong.",
        // right after the crossing-out line: the three screenshots slide up by themselves
        // (in the free space) and stay
        then: [
          { free: "all", type: "stack", size: "m", interval: 900, delay: 1200,
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
        ratio: 16 / 9, size: "l", tilt: -3, delay: 300,
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

  // tap: in the free space (never over the title or the meme)
  { free: true, type: "text", style: "body", typing: true, typeFrom: "London it is.", speed: 55, tilt: 0,
    lifespan: 1,   // goes away when "Fashion jobs…" appears
    text: "Visa expires. I only speak English.\n\nWhere do I go? London it is.\n\nVámonos. 💃" },

  // tap: work text (in the free space, near the tap) + the bar photo right away;
  //      then the cities are typed and each one drops its postcard
  { free: true, type: "text", style: "body", typing: true, typeFrom: "Istanbul", typePause: 700, speed: 70, tilt: 0,
    text: "Fashion jobs by day, bartending by night.\n\nMy last fashion job wasn't the coolest, but it took me to a lot of places!\n\nIstanbul, Milan, Copenhagen, Paris, Florence.",
    also: [
      { free: "all", type: "image", src: "media/03_CAPITOLO_3/bartending.webp", ratio: 1.3313, size: "s", delay: 250 }
    ],
    // postcards fill the whole page, one per city as it's typed; the text stays on top.
    // Alternating: coloured-frame cards / cream cards with a stamp-like scalloped edge.
    cues: {
        "Istanbul": { type: "image", src: "media/03_CAPITOLO_3/pc_istanbul.webp", ratio: 1.5, size: "l", scale: 1.4, bleed: true, fill: 0, jitter: 0.03, tilt: -7,
          postcard: { city: "Istanbul", shape: "rect", frame: "#F7C6D3", font: "'Shrikhand', cursive", fill: "#FFE3EC", shade: "#1F4E79" } },
        "Milan": { type: "image", src: "media/03_CAPITOLO_3/pc_milan.webp", ratio: 1.5, size: "l", scale: 1.4, bleed: true, fill: 1, jitter: 0.03, tilt: 6,
          postcard: { city: "Milan", shape: "wavy", frame: "#F6EEE3", font: "'Alfa Slab One', serif", fill: "#9FD3F2", shade: "#1B1B1B", upper: true } },
        "Copenhagen": { type: "image", src: "media/03_CAPITOLO_3/pc_copenhagen.webp", ratio: 1.5, size: "l", scale: 1.4, bleed: true, fill: 2, jitter: 0.03, tilt: -4,
          postcard: { city: "Copenhagen", shape: "rect", frame: "#D8642C", font: "'Bungee Inline', sans-serif", fill: "#FFFFFF", shade: "#1F6FA8", upper: true, scale: 1.25 } },
        "Paris": { type: "image", src: "media/03_CAPITOLO_3/pc_paris.webp", ratio: 1.5, size: "l", scale: 1.4, bleed: true, fill: 3, jitter: 0.03, tilt: 8,
          postcard: { city: "Paris", shape: "wavy", frame: "#F6EEE3", font: "'Pinyon Script', cursive", fill: "#FBE1C6", shade: "#3E4A6B", scale: 2.1 } },
        "Florence": { type: "image", src: "media/03_CAPITOLO_3/pc_florence.webp", ratio: 1.5, size: "l", scale: 1.4, bleed: true, fill: 4, jitter: 0.03, tilt: -5,
          postcard: { city: "Florence", shape: "rect", frame: "#2F6FB0", font: "'Shrikhand', cursive", fill: "#F4E9DA", shade: "#B5532F" } }
    }
  },

  /* tap: the postcards (and everything) go; the cycling text is typed,
     and meanwhile the Instagram screen recording appears */
  { clear: true,
    type: "text", text: "ALSO, I GOT REALLY INTO CYCLING.", style: "big", typing: true, speed: 45, tilt: 0,
    also: [
      { below: true, type: "text", style: "body", typing: true, typeDelay: 1700, speed: 45, tilt: 0, gap: 14,
        bold: ["TRY ROME."],
        text: "Still obsessed.\n\nCycling in London? Easy.\n\nTRY ROME." },
      { free: "all", type: "video", src: "media/03_CAPITOLO_3/bici.mp4", poster: "media/03_CAPITOLO_3/bici_poster.jpg",
        ratio: 0.4624, size: "m", frame: "phone", tilt: 3, delay: 800 }
    ]
  },

  /* tap: everything goes; SPOILER ALERT fills the screen and scrolls sideways;
     as soon as the whole phrase has come in, the rest of the text appears */
  { clear: true, type: "marquee", text: "SPOILER ALERT", stretch: 3.2, speed: 650, direction: "right",
    then: [
      { at: [0.5, 0.55], type: "text", style: "body", boxed: true, tilt: -2,
        typing: true, typeFrom: "Doing my best.", speed: 60,
        text: "Turns out, fashion isn't exactly sustainable.\nAnd that has always mattered to me.\n\n15 years vegetarian. (Yes, I know I should probably go vegan.)\n\nDoing my best. 😮‍💨" }
    ]
  },

  /* ===== 2016 — BACK TO ITALY ===== */
  // tap: everything goes, the whole page turns violet
  { clear: true, bg: "var(--primary)",
    type: "text", text: "2016", style: "big", color: "white", tilt: 0,
    also: [
      { below: true, type: "text", style: "body", color: "white", typing: true, speed: 50, tilt: 0, gap: 14, delay: 500,
        text: "Ok I'm done, time to go back to Italy" }
    ]
  },

  // tap: the chat with Leo (bubbles type themselves)
  { type: "chat", title: "Leo", tilt: -2, free: true, messages: [
      { from: "me",   text: "Hey Leo! I came across your work online. Would you be up for collaborating on a new project?" },
      { from: "them", text: "Hey! Why not? Fancy a beer?", typing: 1400 },
      { from: "me",   text: "Yes! Amazing!" }
  ]},

  { type: "text", text: "(to be continued)", style: "note", tilt: 0 }
];
