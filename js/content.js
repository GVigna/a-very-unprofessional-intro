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
                      ({ advance: true, delay: ms } → the story moves on by itself)
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
             rate: 1.2 → playback speed (1.2 = 20% faster)
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

   "code"    lines    the CV, one line each ("## TITLE" = section, "2024  …" = entry);
                      streams line by line like code (speed: ms per line), behind
                      everything; cues: { lineNumber: beat } → plays at that line

   "book"    front, back  cover images; ratio, depth (thickness), spine colour,
                      rest (resting angle in degrees), year (shown above it)
                      → a 3D book that spins in

   "chat"    title    optional name at the top of the chat
             messages list of { from: "me" | "them", text: "…" }
                      optional per message: typing (ms of "…"), pause (ms after)
   ========================================================= */

/* ---------- always-visible contact links (empty = hidden) */
window.CONTACT = {
  portfolio: "https://giuliavigna.com/",     // → ACTUAL PORTFOLIO
  email: "info.gommastudio@gmail.com",       // → EMAIL ME
  cv: "media/00_OPENING/Cv_GiuliaVigna_2026.pdf",  // → CV (next to ACTUAL PORTFOLIO)
  cvPages: ["media/00_OPENING/cv_page_1.webp"],     // the CV shown inside the site, with a way back
  chatEmail: "giu.vigna@gmail.com",                 // the halfway "wanna chat?" alert
  midAlertAt: 20                                    // after this step (after Doccia Fredda)

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
      { type: "text", text: "Hi, I’m Giulia", style: "big", words: true, tilt: 0, color: "secondary",
        offset: [-0.45, 0.08], delay: 700 }
    ]
  },

  /* ===== CHAPTER 1 — IED ===== */
  // tap: the screen is wiped, then the IED block appears
  { clear: true,
    type: "text", text: "IED Fashion School", style: "big", tilt: 0,
    also: [
      { above: true, type: "text", text: "2010", style: "note", tilt: 0, gap: 6, delay: 350 },
      { below: true, type: "text", style: "body", typing: true, typeFrom: "Some of it", speed: 45, tilt: 0, gap: 14, delay: 700,
        text: "I decided to study Fashion Design at IED in Rome.\nI learned a lot.\nSome of it I even remember.",
        // as soon as the typing ends: burst of IED photos (no tap needed); they stay
        then: [
          { type: "burst", size: "s", speed: 110, spread: 0.45, delay: 400, photos: [   // they stay
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
              { src: "media/02_CAPITOLO_2/suzanne_1.webp", ratio: 0.7662 },
              { src: "media/02_CAPITOLO_2/suzanne_2.webp", ratio: 0.6411 },
              { src: "media/02_CAPITOLO_2/suzanne_3.webp", ratio: 0.7662 }
          ]}
        ],
        text: "Working for Suzanne Rae.\nFeminist, sustainable fashion.\nI thought all fashion jobs were like this.\nI was wrong.",
        // right after the crossing-out line: the three screenshots slide up by themselves
        // (in the free space) and stay
        then: [
          // diagonal to the Vogue cards, a bit on top of them, tossed rather than neatly piled
          { near: "deck", free: "all", type: "stack", size: "m", mess: 1, interval: 810, delay: 1080,
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
    also: [   // the video starts together with the typing
      { free: "all", type: "video", src: "media/02_CAPITOLO_2/girls.mp4", poster: "media/02_CAPITOLO_2/girls_poster.jpg",
        ratio: 16 / 9, size: "l", tilt: -3, delay: 300,
        loop: false,          // plays once (with its sound), then stops on the last frame
        sound: true,          // tries to play with audio; if the browser blocks it → muted + SOUND ON button
        subs: [               // subtitles (seconds from the start of the clip)
          { from: 0.1,  to: 2.05,  text: "I don't wanna freak you out" },
          { from: 2.05, to: 4.05,  text: "but I think that I may be" },
          { from: 4.05, to: 6.05,  text: "the voice of my generation" },
          { from: 6.05, to: 10.05, text: "or at least, a voice" },
          { from: 11.05, to: 12.05, text: "of a generation" }
        ] }
    ]
  },

  /* ===== CHAPTER 3 — LONDON ===== */
  // tap: everything goes, the page turns violet (white texts from here on), "London" + the Queen meme
  { clear: true, bg: "var(--primary)",
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
  { free: true, type: "text", style: "body", typing: true, typeFrom: "Istanbul", typePause: 400, speed: 110, tilt: 0, box: "light",
    text: "Fashion jobs by day, bartending by night.\n\nMy last fashion job wasn't the coolest, but it took me to a lot of places!\n\nIstanbul, Milan, Copenhagen, Paris, Florence.",
    // the postcards stay until the next tap

    // postcards fill the whole page, one per city as it's typed; the text stays on top.
    // Alternating: coloured-frame cards / cream cards with a stamp-like scalloped edge.
    cues: {
        // the bar photo pops out of "bartending" as an iMessage photo bubble, right of the text box
        "bartending": { beside: true, bubble: true, type: "image", src: "media/03_CAPITOLO_3/bartending.webp", ratio: 1.3313, size: "s", tilt: -2 },
        "Istanbul": { type: "image", src: "media/03_CAPITOLO_3/pc_istanbul.webp", ratio: 1.5, size: "l", scale: 1.05, bleed: true, corner: true,
          postcard: { city: "Istanbul", shape: "rect", frame: "#F7C6D3", font: "'Fraunces', serif", fill: "#FFF1C9", shade: "#C2410C" } },
        "Milan": { type: "image", src: "media/03_CAPITOLO_3/pc_milan.webp", ratio: 1.5, size: "l", scale: 1.05, bleed: true, corner: true,
          postcard: { city: "Milan", shape: "wavy", frame: "#F6EEE3", font: "'Alfa Slab One', serif", fill: "#9FD3F2", shade: "#1B1B1B", upper: true } },
        "Copenhagen": { type: "image", src: "media/03_CAPITOLO_3/pc_copenhagen.webp", ratio: 1.5, size: "l", scale: 1.05, bleed: true, corner: true,
          postcard: { city: "Copenhagen", shape: "rect", frame: "#D8642C", font: "'Righteous', sans-serif", fill: "#FFFFFF", shade: "#1F6FA8", upper: true, scale: 1.25 } },
        "Paris": { type: "image", src: "media/03_CAPITOLO_3/pc_paris.webp", ratio: 1.5, size: "l", scale: 1.05, bleed: true, corner: true,
          postcard: { city: "Paris", shape: "wavy", frame: "#F6EEE3", font: "'Pinyon Script', cursive", fill: "#FBE1C6", shade: "#3E4A6B", scale: 2.1, spacing: "-0.035em" } },
        "Florence": { type: "image", src: "media/03_CAPITOLO_3/pc_florence.webp", ratio: 1.5, size: "l", scale: 1.05, bleed: true, corner: true,
          postcard: { city: "Florence", shape: "rect", frame: "#E2A72E", font: "'Shrikhand', cursive", fill: "#F4E9DA", shade: "#B5532F", noShadow: true } }
    }
  },

  /* tap: the postcards (and everything) go; the cycling text is typed,
     and meanwhile the Instagram screen recording appears */
  { clear: true,
    type: "text", text: "ALSO, I GOT REALLY INTO CYCLING.", style: "big", typing: true, speed: 45, tilt: 0,
    also: [
      { below: true, type: "text", style: "body", typing: true, typeDelay: 1700, speed: 45, tilt: 0, gap: 14,
        bold: ["TRY ROME."],
        text: "Still obsessed.\n\nCycling in London? Easy.\nTRY ROME." },
      { free: "all", type: "video", src: "media/03_CAPITOLO_3/bici.mp4", poster: "media/03_CAPITOLO_3/bici_poster.jpg",
        ratio: 0.4624, size: "m", frame: "phone", tilt: 3, delay: 800,
        rate: 1.2, loop: false }   // 20% faster, plays once, freezes on the last frame
    ]
  },

  /* tap: everything goes; SPOILER ALERT fills the screen and scrolls sideways,
     the text sits on top of it from the start */
  { clear: true, type: "marquee", text: "SPOILER ALERT", stretch: 3.2, speed: 945,
    also: [   // the text is there straight away; the giant words scroll underneath
      { at: [0.5, 0.55], type: "text", style: "body", boxed: true, tilt: -2,
        typing: true, typeFrom: "Doing my best.", speed: 60,
        text: "Turns out, fashion isn't exactly sustainable. And that has always mattered to me.\n\n15 years vegetarian. (Yes, I know I should probably go vegan.)\n\nDoing my best. 😮‍💨" }
    ]
  },

  /* ===== 2016 — BACK TO ITALY ===== */
  // tap: everything goes, the whole page turns violet
  { clear: true, bg: "default",          // new chapter: back to white
    type: "text", text: "2016", style: "big", tilt: 0,
    also: [
      { below: true, type: "text", style: "body", typing: true, speed: 50, tilt: 0, gap: 14, delay: 500,
        text: "Ok I'm done, time to go back to Italy, become a graphic and motion designer and maybe an artist (?)",
        then: [ { advance: true, delay: 900 } ] }   // the chat with Leo starts by itself
    ]
  },

  // tap: the chat with Leo (bubbles type themselves)
  { type: "chat", title: "Leonardo Magrelli", tilt: -2, free: true, messages: [
      { from: "me",   text: "Hey Leo! I came across your work online. Would you be up for collaborating on a new project?", typing: 300, pause: 400 },
      { from: "them", text: "Hey! Why not? Fancy a beer?", typing: 1400 },
      { from: "me",   text: "Yes! Amazing!" },
      { from: "note", text: "Vaste Programme was born." }
  ]},

  // tap: the Vaste Programme CV streams like code (behind everything; half screen on
  //      wide screens, full screen on phones); meanwhile the two books spin in, in 3D
  { type: "code", speed: 110,
    lines: [
      "## VASTE PROGRAMME CV",
      "## EXHIBITIONS & FESTIVALS",
      "2026  Ghostland - Fotografia Europea • curated by Arianna Catania • Palazzo da Mosto, Reggio Emilia, IT",
      "2026  MMMMMMM KM • Permanent Installation • Museo Tam • Matera, Italy",
      "2025  Una Boccata d'Arta • curated by Roberta Mansueto • Miglionico, Italy",
      "2025  Calentamiento • Istituto Italiano di Cultura • Stockholm, Sweden",
      "2024  Fast Forward • Eleven Ten Studio • Basel, Switzerland",
      "2024  Calentamiento • curated by Irene Angenica • CONDOMINIO • Milan, Italy",
      "2024  What We Already Think We Know • Istituto Italiano di Cultura • Londra, United Kingdom",
      "2024  Corrispondenze • curated by Daniele De Luigi & Chiara Dall'Olio • FMAV Fondazione Modena Arti Visive • Modena • 2024",
      "2024  That’s Contemporary! A call for Video Arts • curated by Bianca Basile and Camilla Remondina • Real Collegio • Lucca, Italy",
      "2024  That’s Contemporary! A call for Video Arts • curated by Bianca Basile and Camilla Remondina • Cremona Art Fair • Cremona, Italy",
      "2023  Le nostre radici • Charta Festival • Galleria 291 Est • Rome, Italy",
      "2023  Calentamiento • curated by Irene Angenica • CAMERA - Centro italiano per la fotografia • Turin, Italy",
      "2023  Calentamiento • curated by Irene Angenica • Manifattura Tabacchi • Florence, Italy",
      "2023  Cascasse il cielo • curated by Giulia Tornesello • 1/9unosunove • Rome, Italy",
      "2023  D3C4M3R0N3 • curated by maurizio Coccia and Mara Predicatori • Palazzo Lucarini • Trevi, PG Italy",
      "2023  But it did happen • curated by Giulia Gaibisso • Spazio In Situ • Rome, Italy",
      "2023  13 fotografi per 13 Musei • curated by Matteo Balduzzi • Palazzo Reale • Milan, Italy",
      "2022  Princìpi - Costruire per le Generazioni / Biennale Tecnologia • Torino, Italy",
      "2022  Senso Comune • curated by Adiacenze • Habitat Ottantatre • Verona, Italy",
      "2022  Screening at Spazio In Situ during RAW Rome Art Week • Rome, Italy",
      "2022  Calentamiento • curated by Irene Angenica • Fondazione smART - polo per l'arte • Rome, Italy",
      "2022  Calentamiento • curated by Irene Angenica • viaraffineria • Catania, Italy",
      "2022  Helsinki Photo Festival • Helsinki, Finland",
      "2022  Tales • Racconti dal tempo che viviamo • Bergamo, Italy",
      "2022  Eyes On Tomorrow. Giovane Fotografia Italiana nel Mondo • Algeri, Algeria",
      "2022  The Expanded body • curated by Angelica Gatto and Simone Zacchini • 1/9unosunove • Rome, Italy",
      "2021  Cortona on the Move • Cortona, Italy",
      "2020  Photo Open Up • curated by Carlo Sala • Padova, Italy",
      "2020  Spazio libero. Immagini per riabitare la città - Comune di Reggio Emilia • Reggio Emilia, Italy",
      "2019  Odesa Photo Days • Odesa Museum of Western & Eastern Art • Odesa, Ukraine",
      "2019  Odesa Photo Days • Maslo Gallery • Khmelnitskiy, Ukraine",
      "2018  Fotoroom X Gnomic Book • (Shortlisted)",
      "2017  Latent • (Shortlisted) • Materia Gallery • Rome, Italy",
      "## AWARDS",
      "2026  Prima Materia 0.2 / Finalist • Palazzo Sforza Cesarini • Genzano, Italy",
      "2024  Contemporanea Prize / Winner • Tagliacozzo, Italy",
      "2023  Talent Prize / 2nd Place • Rome, Italy",
      "2023  Premio Combat / Section Winner / Photography • Livorno, Italy",
      "2023  Premio E.ART.H. / Finalist • curated by Treti Galaxie • Verona, Italy",
      "2022  Premio Combat / Finalist / Video • Livorno, Italy",
      "2022  Premio Marco Bastianelli / Jury Award – Special Mention Italian Author • Rome, Italy",
      "2021  Premio Francesco Fabbri / Jury Award – Special Mention • Soligo, Italy",
      "2021  Etherea Art Prize • Genova, Italy",
      "2020  Giovane Fotografia Italiana #08 - Fotografia Europea / Winners • curated by Ilaria Campioli and Daniele de Luigi • Reggio Emilia, Italy",
      "2019  Unseen Dummy Award / Shortlisted • Amsterdam, Netherlands",
      "2019  Premio Francesco Fabbri / Finalist • Pieve di Soligo, Italy",
      "2019  Skinnerboox Book Award / Shortlisted • Jesi, Italy",
      "## RESIDENCIES & WORKSHOPS",
      "2022  Workshop • Fail Again, Fail Better • in collaborazione con Agnese Fieno Spolverini • a cura di Irene Angenica • Fondazione Elpis • Milano, Italy",
      "2022  Workshop • Loft Workshop • Luiss Guido Carli • Rome, Italy",
      "2022  Workshop • Quasar Institute • Rome, Italy",
      "2022  Workshop • Esaurire/Altrimenti • with CampoBase • Fondazione smART - polo per l'arte • Rome, Italy",
      "2022  Residency • D3CAM3R0N3 • Trevi, Italy",
      "2021  Residency • Viaraffineria & Fondazione Oelle • Catania, Italy",
      "## GRANTS & COMMISSIONS",
      "2024  Corrispondenze • curated by Daniele De Luigi & Chiara Dall'Olio • FMAV Fondazione Modena Arti Visive • Modena • 2024",
      "2023  Come si fa la marmellata • curated by Associazione Arteco & JEST • Pinacoteca G.A. Levis • Chiomonte, TO, Italy",
      "2023  Gli Aspetti Familiari • curated by Anna Catalano • Fotografia Calabria Festival • Fiumefreddo, Italy",
      "2022  13 fotografi per 13 Musei • Committenza Direzione Regionale Musei Lombardia / MUFOCO - Museo di Fotografia Contemporanea",
      "## BOOKS",
      "2023  How to make Jam • Witty Books",
      "2021  The Long Way Home of Ivan Putnik, Truck Driver • The Eriskay Connection"
    ],
    cues: {
      19: { type: "book", free: true, size: "s", alt: "The Long Way Home of Ivan Putnik, Truck Driver (2021)",
            front: "media/04_CAPITOLO_4/ivan_front.webp", back: "media/04_CAPITOLO_4/ivan_back.webp",
            ratio: 0.6667, depth: 0.08, spine: "#7c5634", rest: -40, tilt: -3, lifespan: 1, year: "2021" },
      39: { type: "book", free: true, size: "s", alt: "How to make Jam (2023)",
            front: "media/04_CAPITOLO_4/jam_front.webp", back: "media/04_CAPITOLO_4/jam_back.webp",
            ratio: 0.7533, depth: 0.12, spine: "#4a1519", rest: -40, scale: 1.13, tilt: 4, lifespan: 1, year: "2023" }
    }
  },

  // tap: the books go; the work photos slide in one after another, big, on top of everything,
  //      straight (no tilt, no shadow). They stay.
  { type: "slides", interval: 550, photos: [
      { src: "media/04_CAPITOLO_4/work_0.webp", ratio: 0.7503 },
      { src: "media/04_CAPITOLO_4/work_1.webp", ratio: 1.3333 },
      { src: "media/04_CAPITOLO_4/work_2.webp", ratio: 1.3333 },
      { src: "media/04_CAPITOLO_4/work_3.webp", ratio: 0.75 },
      { src: "media/04_CAPITOLO_4/work_4.webp", ratio: 0.75 },
      { src: "media/04_CAPITOLO_4/work_5.webp", ratio: 0.75 },
      { src: "media/04_CAPITOLO_4/work_6.webp", ratio: 0.8119 },
      { src: "media/04_CAPITOLO_4/work_7.webp", ratio: 1.3333 },
      { src: "media/04_CAPITOLO_4/work_8.webp", ratio: 0.7369 },
      { src: "media/04_CAPITOLO_4/work_9.webp", ratio: 1.3333 },
      { src: "media/04_CAPITOLO_4/work_10.webp", ratio: 0.75 },
      { src: "media/04_CAPITOLO_4/work_11.webp", ratio: 1.3333 },
      { src: "media/04_CAPITOLO_4/work_12.webp", ratio: 0.6663 },
      { src: "media/04_CAPITOLO_4/work_13.webp", ratio: 0.6663 },
      { src: "media/04_CAPITOLO_4/work_14.webp", ratio: 1.0804 },
      { src: "media/04_CAPITOLO_4/work_15.webp", ratio: 1.0804 },
      { src: "media/04_CAPITOLO_4/work_16.webp", ratio: 1.4995 }
  ]},

  /* ===== FREELANCE ===== */
  // tap: everything goes, the page is white again
  { clear: true, bg: "default",
    type: "text", style: "body", typing: true, speed: 40, tilt: 0,
    bold: ["Meanwhile,"],
    text: "Meanwhile, I've been freelancing for 10 years now!\nA few projects:",
    // then a big laptop opens and giuliavigna.com scrolls slowly on its screen (live site in an iframe).
    then: [
      { type: "laptop", delay: 200, alt: "Giulia's Behance profile on a laptop: 19,191 project views, 1,429 appreciations, 350 followers",
        scroll: false, holdEnd: 14500,  // stays open while all the projects scroll by, then the lid closes
        // a simplified Behance profile (numbers from Giulia's profile, Nov 2026); covers loaded from Behance
        profile: { name: "Giulia Vigna", role: "Graphic & Motion Designer · Rome", initials: "GV",
          avatar: "https://pps.services.adobe.com/api/profile/FE4F424F4E7B8A800A490D44@AdobeID/image/2f150e72-148b-4124-89cd-230663cfdf4e/276",
          stats: [ ["project views", "19,191"], ["appreciations", "1,429"], ["followers", "350"] ],
          scrollTime: 14,   // seconds to scroll through all the projects
          covers: [
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/8a4e8d214429615.Y3JvcCwxMDA3LDc4OCwxOTcsMA.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/a98548204945815.Y3JvcCwxMDA3LDc4OCwxOTcsMA.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/7ade7e204420103.Y3JvcCwxMzgwLDEwODAsMjcwLDA.png",
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/faef14196842089.Y3JvcCwxNjExLDEyNjAsNDc0LDg3.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/0e3855185106913.Y3JvcCwxMDA3LDc4OCwxOTcsMA.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/320c72184890177.Y3JvcCwxODAwLDE0MDcsMCwxNw.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/b03783152641725.Y3JvcCwxMzQyLDEwNTAsMjksMA.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/413af3128639515.Y3JvcCwxODM0LDE0MzQsMCwxOTk.png",
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/3dea8095366789.Y3JvcCwxNTAwLDExNzMsMCwzMjY.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/fdbfaf94733593.Y3JvcCwxNDAwLDEwOTUsMCwxMzg.png",
            "https://mir-s3-cdn-cf.behance.net/projects/max_808_webp/8a654894414573.Y3JvcCw0NTAwLDM1MTksMCw0Njc.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/404/2d73f993996177.Y3JvcCwxNDAwLDEwOTUsMCww.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/404/d1079993855165.Y3JvcCwxMDIyLDc5OSwxNzcsMTY5.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/808/6da3aa92471113.Y3JvcCwxMDQ1LDgxNywxOCww.jpg",
            "https://mir-s3-cdn-cf.behance.net/projects/808/a8099988149447.Y3JvcCw5OTcsNzgwLDEwMSww.gif",
            "https://mir-s3-cdn-cf.behance.net/projects/808/bdfa9d86978347.Y3JvcCw4MDgsNjMyLDAsMA.png",
            "https://mir-s3-cdn-cf.behance.net/projects/808/dc4f8886978049.Y3JvcCw5NTgsNzUwLDEyMSww.png",
            "https://mir-s3-cdn-cf.behance.net/projects/808/e1c5c086977717.Y3JvcCw5NTgsNzUwLDEyMSww.jpg"
          ] },
        // Behance gallery features, as ribbons on the screen
        awards: [ { label: "UI", bg: "#A69259", fg: "#FFFFFF" },
                  { label: "Xd", bg: "#470137", fg: "#FF61F6" } ] }
    ]
  },

  /* tap: the projects go; the clients stream in like the Vaste Programme CV (typewriter font) */
  { clear: true, type: "code", speed: 140,
    // a pile of 12 photos (placeholders for now): flick the top one away, or tap the pile
    also: [ { type: "flick", delay: 700, size: "m", interval: 850, photos: [
      { color: "#7D00FF" }, { color: "#FF5500" }, { color: "#FFC93C" }, { color: "#1FA36B" },
      { color: "#2F6FB0" }, { color: "#F7C6D3" }, { color: "#111111" }, { color: "#B5532F" },
      { color: "#9FD3F2" }, { color: "#E5432A" }, { color: "#6B4E9B" }, { color: "#D9D3C7" }
    ] } ],
    lines: [
      "## I WORKED WITH AGENCIES, ARTISTS, BRANDS, FESTIVALS, TV.",
      "Salva Tu Alma • Milan",
      "Impolite • Berlin",
      "Made in Evolve • Modena",
      "Art Multiply • India",
      "Four in the Morning • Rome",
      "Kelross • London",
      "Cultivar • Rome",
      "Yinka Ilori • London",
      "MTV • International",
      "Rai • International",
      "Cook inc. • Lucca",
      "Goldenpoint • Milan",
      "Spring Attitude • Rome",
      "Roma Lazio Film Commission • Rome",
      "House of Ronin • Milan",
      "Anclude",
      "Textbroker • Berlin",
      "T—Weiss • Berlin",
      "Pacifico"
    ]
  },

  /* ===== CHAPTER 6 — MEGAZINNE ===== */
  // tap: everything goes, the page turns orange (white texts)
  { clear: true, bg: "var(--secondary)",
    type: "text", text: "2020 — LET'S TALK ABOUT BOOBS.", style: "big", tilt: 0,
    also: [
      { below: true, type: "text", style: "body", typing: true, speed: 40, tilt: 0, gap: 14, delay: 500,
        bold: ["How could I say no?"],
        links: { "MEGAZINNE": "https://www.instagram.com/megazinne/" },
        // the little cursor clicks MEGAZINNE → a blue folder pops up and the press cards slide out of it
        hintThen: [
          { type: "folder", size: "m", fan: 0.55, interval: 300, alt: "A folder of press articles about Megazinne", cards: [
              { src: "media/06_CAPITOLO_6/press/elle.webp", ratio: 1.0587, alt: "ELLE Italia article on Megazinne" },
              { src: "media/06_CAPITOLO_6/press/messaggero.webp", ratio: 1.4686, alt: "Il Messaggero article on Megazinne" },
              { src: "media/06_CAPITOLO_6/press/rollingstone.webp", ratio: 0.7407, alt: "Rolling Stone Italia article on Megazinne" }
          ]}
        ],
        text: "My childhood BFF Ilena Ilardo\n(we met at a school run by nuns, btw) has an idea: a magazine about boobs.\n\nCalled MEGAZINNE. (The joke makes sense only in Italian, sorry.)\n\nHow could I say no? 🍐" }
    ]
  },

  // tap: in the free space
  { free: true, type: "text", style: "body", typing: true, speed: 40, tilt: 0,
    text: "Three issues, over €20K raised for charity.\n\nRolling Stone, ELLE, Il Messaggero.",
    // the magazines (issues 2 and 3, no covers): it opens in a flash, then the spreads flip by fast
    // the three magazines (no covers), each on its own side, never overlapping: issue 1 smaller
    also: [
      { type: "flipbook", delay: 200, share: 0.62, side: "random", tilt: 2, flip: 150, interval: 70, loop: true, alt: "Megazinne issue 2", spreads: [
        "media/06_CAPITOLO_6/mz2_00.webp",
        "media/06_CAPITOLO_6/mz2_01.webp",
        "media/06_CAPITOLO_6/mz2_02.webp",
        "media/06_CAPITOLO_6/mz2_03.webp",
        "media/06_CAPITOLO_6/mz2_04.webp",
        "media/06_CAPITOLO_6/mz2_05.webp",
        "media/06_CAPITOLO_6/mz2_06.webp",
        "media/06_CAPITOLO_6/mz2_07.webp",
        "media/06_CAPITOLO_6/mz2_08.webp",
        "media/06_CAPITOLO_6/mz2_09.webp",
        "media/06_CAPITOLO_6/mz2_10.webp",
        "media/06_CAPITOLO_6/mz2_11.webp",
        "media/06_CAPITOLO_6/mz2_12.webp"
      ] },
      { type: "flipbook", delay: 500, share: 0.62, side: "random", tilt: -2, flip: 150, interval: 70, loop: true, alt: "Megazinne issue 3", spreads: [
        "media/06_CAPITOLO_6/mz3_00.webp",
        "media/06_CAPITOLO_6/mz3_01.webp",
        "media/06_CAPITOLO_6/mz3_02.webp",
        "media/06_CAPITOLO_6/mz3_03.webp",
        "media/06_CAPITOLO_6/mz3_04.webp",
        "media/06_CAPITOLO_6/mz3_05.webp",
        "media/06_CAPITOLO_6/mz3_06.webp",
        "media/06_CAPITOLO_6/mz3_07.webp",
        "media/06_CAPITOLO_6/mz3_08.webp",
        "media/06_CAPITOLO_6/mz3_09.webp",
        "media/06_CAPITOLO_6/mz3_10.webp",
        "media/06_CAPITOLO_6/mz3_11.webp",
        "media/06_CAPITOLO_6/mz3_12.webp",
        "media/06_CAPITOLO_6/mz3_13.webp"
      ] },
      { type: "flipbook", delay: 800, share: 0.4, side: "random", tilt: -4, flip: 150, interval: 70, loop: true, alt: "Megazinne issue 1", spreads: [
        "media/06_CAPITOLO_6/mz1_00.webp",
        "media/06_CAPITOLO_6/mz1_01.webp",
        "media/06_CAPITOLO_6/mz1_02.webp",
        "media/06_CAPITOLO_6/mz1_03.webp",
        "media/06_CAPITOLO_6/mz1_04.webp",
        "media/06_CAPITOLO_6/mz1_05.webp",
        "media/06_CAPITOLO_6/mz1_06.webp",
        "media/06_CAPITOLO_6/mz1_07.webp",
        "media/06_CAPITOLO_6/mz1_08.webp",
        "media/06_CAPITOLO_6/mz1_09.webp",
        "media/06_CAPITOLO_6/mz1_10.webp",
        "media/06_CAPITOLO_6/mz1_11.webp",
        "media/06_CAPITOLO_6/mz1_12.webp"
      ] }
    ] },

  // tap: everything goes; while this is typed, a receipt prints out (tap it: it crumples into a ball)
  { clear: true, free: true, type: "text", style: "body", typing: true, speed: 40, tilt: 0,
    bold: ["Thanks, bye!"],
    text: "Thanks, bye! Social media feminism wasn't really our thing anymore, so we called it quits.",
    also: [
      { type: "receipt", delay: 500, tilt: -3,
        text: "********************************\n          MEGAZINNE\n********************************\n\nCHARITY RECEIPT\n2020 — 2021\n\n--------------------------------\nITEM 01\nMEGAZINNE — ISSUE #01\nOCTOBER 2020\n\nLILT FIRENZE\nCancer prevention, patient\nsupport & rehabilitation.\n\n--------------------------------\nITEM 02\nMEGAZINNE — ISSUE #02\nMARCH 2021\n\nD.i.Re\nWomen Against Violence Network\n\n--------------------------------\nITEM 03\nMEGAZINNE — ISSUE #03\n\nAIDOS\nItalian Association for\nWomen in Development\n\n\n--------------------------------\n\nISSUES PUBLISHED             03\n\n********************************\n\n**TOTAL RAISED            €20,000+**\n\n********************************\n\n100% OF PROCEEDS DONATED\n\nTHANK YOU FOR SUPPORTING\nWOMEN'S HEALTH & RIGHTS.\n\n--------------------------------\n\n\n        ♥ MEGAZINNE ♥\n\n********************************" }
    ] },

  /* ===== DOCCIA FREDDA ===== */
  // tap: everything goes. Videos and audio will come from Giulia — for now, placeholders in Reel format (9:16)
  { clear: true, bg: "default", alsoShuffle: { from: 1, start: 1200, gap: 1500 },          // new chapter: back to white
    type: "text", text: "2026 — WE'RE BACK.", style: "big", tilt: 0,
    also: [
      { below: true, type: "text", style: "body", typing: true, speed: 40, tilt: 0, gap: 14, delay: 500,
        bold: ["DOCCIA FREDDA"],
        text: "Meet DOCCIA FREDDA, our new podcast about love, heartbreak and questionable romantic decisions.\n\nBecause apparently, we still have a lot to talk about." },
      // two Instagram Reels, muted, looping
      { free: "all", type: "video", src: "media/08_CAPITOLO_8/doccia_fredda_1.mp4", poster: "media/08_CAPITOLO_8/doccia_fredda_1_poster.jpg",
        ratio: 0.5625, size: "m", phoneSize: "s", tilt: -3, delay: 900 },
      { free: "all", type: "video", src: "media/08_CAPITOLO_8/doccia_fredda_2.mp4", poster: "media/08_CAPITOLO_8/doccia_fredda_2_poster.jpg",
        ratio: 0.5625, size: "m", phoneSize: "s", tilt: 4, delay: 1200 },
      // a photo with a little audio player under it (audio trimmed to start on the sound, 25 s)
      { free: "all", type: "audiocard", src: "media/08_CAPITOLO_8/audio_foto.webp", audio: "media/08_CAPITOLO_8/audio_nuovo.mp3",
        ratio: 0.53, photoRatio: 0.8, size: "m", tilt: -2, delay: 1600, startAt: 0, alt: "Doccia Fredda — audio clip" }
    ]
  },

  /* ===== MOTION ===== */
  // tap: everything goes; the text sits in front, a very long list of skills streams behind it.
  // The first ~9 lines at reading pace, then it speeds up (about 8 s in all) — no need to read it all.
  { clear: true, bg: "default",
    type: "text", text: "OH, I ALSO MAKE THINGS MOVE.", style: "big", tilt: 0,
    also: [
      { below: true, type: "text", style: "body", typing: true, speed: 40, tilt: 0, gap: 14, delay: 500,
        text: "At some point, static images weren't enough anymore.\n\nSo I taught myself After Effects." },
      { type: "code", delay: 1200, keepTexts: true, faint: true, accel: { after: 9, slow: 420, total: 8000 },
        lines: [
        "Art Direction",
        "Graphic Design",
        "Visual Identities",
        "Branding",
        "Editorial Design",
        "Social Media Assets",
        "Motion Graphics",
        "Video Editing",
        "Packaging Design",
        "Print Production",
        "Layout Design",
        "Digital Design",
        "UI/UX Design",
        "Creative Direction",
        "Presentations",
        "Making Things Look Nice",
        "Making Things Move",
        "Making Things Move Nicely",
        "Organising Chaos",
        "Making Lists",
        "Making Lists About Lists",
        "Overthinking Typography",
        "Finding the Right Shade of Blue",
        "Opening 47 Tabs for Research",
        "Naming Files FINAL_FINAL_v3",
        "Working Across Time Zones",
        "Explaining Why This Font Is Better",
        "Getting Everyone on the Same Page",
        "Actually Meeting Deadlines",
        "Dancing on Tables",
        "Making Magazines About Boobs",
        "Cycling in Rome",
        "Keeping Plants Alive (Sometimes)",
        "Having Too Many Side Projects",
        "Starting Another Side Project",
        "Learning Something New Instead of Resting",
        "Apparently, Going Back to University",
        "## AND THE LIST GOES ON..."
        ] }
    ]
  },

  /* ===== CHAPTER 7 — BACK TO SCHOOL ===== */
  // tap: the university card on its lanyard swings in from the left and wipes everything away; white page
  { wipe: true, wipeMs: 700, bg: "default",
    type: "lanyard", src: "media/07_CAPITOLO_7/sapienza_card.webp", ratio: 1.66, x: 0.78, alt: "Sapienza University of Rome student card on a lanyard",
    also: [
      { free: true, type: "text", text: "2026 — Back to school.\nAgain.", style: "big", typing: true, speed: 30, tilt: 0, delay: 1300,
        then: [
          { below: true, type: "text", style: "body", typing: true, speed: 40, tilt: 0, gap: 14, delay: 400,
            text: "Went back to University.\n\nCurrently in my second year of a BA in Art History at Sapienza University of Rome.\n\nBecause having several jobs and projects clearly wasn't enough." }
        ] }
    ]
  },

  // tap: the card swings back out; same layout as Megazinne (big title + text below)
  { clear: true, bg: "default",
    type: "text", text: "OK, BUT WHAT DO I ACTUALLY CARE ABOUT?", style: "big", tilt: 0,
    also: [
      { below: true, type: "text", style: "body", typing: true, speed: 40, tilt: 0, gap: 14, delay: 500,
        text: "People, mostly. Doing things together. Sharing what I know, learning what I don't.\n\nI care about community, collaboration, and finding ways to make creative work a little more sustainable." }
    ]
  },

  // tap: in the free space
  { free: true, type: "text", style: "body", typing: true, speed: 40, tilt: 0,
    text: "I'd also love to work more with younger generations, share what I've learned, and hopefully learn twice as much in return.\n\nI'd rather be in a room where everyone has something to share than be the smartest person in it." },

  /* ===== CLOSING ===== */
  // tap: everything goes; title + first block
  { clear: true, bg: "default",
    type: "text", text: "WHAT'S NEXT?", style: "big", tilt: 0,
    also: [
      { below: true, type: "text", style: "body", typing: true, speed: 40, tilt: 0, gap: 14, delay: 500,
        bold: ["YES, PLEASE."],
        text: "More art?\nMore design?\nMore people doing weird things together?\nYES, PLEASE." }
    ]
  },

  // tap: the second block in the free space; when it's typed, a little winged letter flies in
  { free: true, type: "text", style: "body", typing: true, speed: 40, tilt: 0,
    bold: ["GOT SOMETHING IN MIND?", "HMU ↗"],
    links: { "HMU ↗": "mailto:giu.vigna@gmail.com" }, linkHint: false,
    text: "Freelance projects, collaborations, teaching, workshops, collective experiments, unexpected ideas.\n\nGOT SOMETHING IN MIND?\nHMU ↗",
    then: [ { type: "mailicon", email: "giu.vigna@gmail.com", delay: 300 } ] },

];
