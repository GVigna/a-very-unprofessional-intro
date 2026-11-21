/* =========================================================
   INTERACTION ENGINE
   You shouldn't need to edit this to change the story —
   see js/content.js instead.

   Beat types handled here:
     text    words (optionally typed out letter by letter)
     image   a photo (placeholder box for now)
     video   a video (placeholder box for now)
     burst   one tap → a quick volley of photos
     chat    message bubbles that type themselves
   ========================================================= */
(function () {
  "use strict";

  var STORY = window.STORY || [];

  // ---- tuning knobs -----------------------------------------------------
  var TAP_SLOP = 10;        // px a finger may wobble and still count as a tap
  var EDGE = 8;             // px kept free around the screen edge
  var MAX_TILT = 6;         // degrees, for beats without an explicit tilt
  var SIZE = { xxs: 0.13, xs: 0.2, s: 0.30, m: 0.46, l: 0.66 }; // share of the screen's short side…
  var SIZE_CAP = { xxs: 100, xs: 150, s: 220, m: 340, l: 520 };  // …but never wider than this (px)
  var TYPE_SPEED = 45;      // ms per letter for typed text
  var TYPE_FACTOR = 0.85;   // global typing pace (0.85 = 15% faster)
  var TYPE_PAUSE = 900;     // ms of silence before a "typeFrom" phrase starts typing
  var CHAT_PAUSE = 500;     // ms between chat messages
  var CHAT_TYPING = 900;    // ms the "…" dots show before a message

  // ---- elements ---------------------------------------------------------
  var stage = document.getElementById("stage");
  var progress = document.getElementById("progress");
  var restartBtn = document.getElementById("restart");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- state ------------------------------------------------------------
  var step = 0;            // how many beats have been revealed
  var z = 1;               // next z-index (newer/touched items go on top)
  var live = [];           // { el, x, y, diesAt }
  var timers = [];         // pending timeouts (cleared on restart)
  var tap = null;          // pending tap on empty canvas
  var drag = null;         // current drag

  // ======================================================================
  // Helpers
  // ======================================================================
  function viewport() {
    var vv = window.visualViewport;
    return {
      w: vv ? vv.width : window.innerWidth,
      h: vv ? vv.height : window.innerHeight
    };
  }

  var FAST = false;          // true while replaying steps to go back (no waiting)
  var taps = [];             // where each step was tapped, to replay it
  function later(fn, ms) {
    if (FAST) ms = 0;
    var id = setTimeout(function () {
      timers.splice(timers.indexOf(id), 1);
      fn();
    }, ms);
    timers.push(id);
  }

  var segmenter = (typeof Intl !== "undefined" && Intl.Segmenter) ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  function graphemes(str) {
    return segmenter ? Array.from(segmenter.segment(str), function (g) { return g.segment; }) : Array.from(str);
  }

  function randomTilt() { return (Math.random() * 2 - 1) * MAX_TILT; }

  // Keep an item fully on screen.
  // heights of the top / bottom UI bands (nothing may sit under them)
  function bands() {
    var t = document.getElementById("band-top"), b = document.getElementById("band-bottom");
    return { t: t ? t.offsetHeight : EDGE, b: b ? b.offsetHeight : EDGE };
  }

  function clamp(item, x, y) {
    var v = viewport();
    var w = item.el.offsetWidth, h = item.el.offsetHeight;
    if (item.bleed) {
      // may stick out of the screen, but at least ~45% of it stays visible
      return {
        x: Math.min(Math.max(x, -w * 0.55), v.w - w * 0.45),
        y: Math.min(Math.max(y, -h * 0.55), v.h - h * 0.45)
      };
    }
    var B = bands(), top = B.t + 4;
    var maxX = Math.max(EDGE, v.w - w - EDGE);
    var maxY = Math.max(top, v.h - h - B.b - 4);
    return {
      x: Math.min(Math.max(x, EDGE), maxX),
      y: Math.min(Math.max(y, top), maxY)
    };
  }

  function place(item, x, y) {
    if (item.fixed) return;
    var p = clamp(item, x, y);
    item.x = p.x;
    item.y = p.y;
    item.el.style.transform = "translate3d(" + p.x + "px," + p.y + "px,0)";
  }

  // re-clamp after an item changed size (typing text, growing chat)
  function refit(item) { if (!item.dead) place(item, item.x, item.y); }

  function toFront(item) { item.el.style.zIndex = ++z; }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var backBtn = document.getElementById("back"), nextBtn = document.getElementById("next");
  var hint = document.getElementById("hint");
  function updateProgress() {
    progress.textContent = pad(step) + "/" + pad(STORY.length);
    if (backBtn) backBtn.hidden = step <= 0;
    if (nextBtn) nextBtn.hidden = step >= STORY.length;
    if (hint) hint.classList.toggle("gone", step > 0);
    maybeMidAlert();
  }

  // ---- analytics: how far people get in the story (Foliaire custom event; each step counted once per visit)
  var trackedMax = 0;
  function trackStep() {
    if (FAST || step <= trackedMax) return;
    trackedMax = step;
    try {
      if (window.foliaire && window.foliaire.track)
        window.foliaire.track("story_step", { storyStep: step, storyTotal: STORY.length, storyEnd: step >= STORY.length });
    } catch (e) {}
  }

  // ---- the halfway "you made it this far" alert (once per visit)
  var midShown = false;
  function maybeMidAlert() {
    var C = window.CONTACT || {}, at = C.midAlertAt || Math.round(STORY.length / 2);
    if (midShown || FAST || step < at) return;
    midShown = true;
    setTimeout(function () {
      var box = document.getElementById("midalert");
      if (!box || popupOpen()) return;
      document.getElementById("midalert-yes").href = "mailto:" + (C.chatEmail || C.email || "");
      box.hidden = false;
      document.getElementById("midalert-no").focus({ preventScroll: true });
    }, 2600);
  }
  function closeMid() { var box = document.getElementById("midalert"); if (box) box.hidden = true; stage.focus({ preventScroll: true }); }

  // ---- the CV / portfolio viewer
  function openViewer(kind) {
    var C = window.CONTACT || {}, v = document.getElementById("viewer"), body = document.getElementById("viewer-body");
    body.innerHTML = "";
    var open = document.getElementById("viewer-open");
    if (kind === "cv") {
      open.href = C.cv;
      (C.cvPages || []).forEach(function (src) { var im = document.createElement("img"); im.src = src; im.alt = "CV"; body.appendChild(im); });
      body.className = "viewer-body cv";
    } else {
      open.href = C.portfolio;
      var f = document.createElement("iframe"); f.src = C.portfolio; f.title = "Portfolio";
      body.appendChild(f); body.className = "viewer-body site";
    }
    v.hidden = false;
    document.getElementById("viewer-back").focus({ preventScroll: true });
  }
  function closeViewer() { var v = document.getElementById("viewer"); v.hidden = true; document.getElementById("viewer-body").innerHTML = ""; stage.focus({ preventScroll: true }); }

  // ---- the starburst shape (zigzag polygon)
  (function () {
    var poly = document.getElementById("hint-shape"); if (!poly) return;
    var pts = [], n = 22;
    for (var i = 0; i < n * 2; i++) {
      var a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.74 : 1;
      pts.push((100 + Math.cos(a) * 96 * r).toFixed(1) + "," + (70 + Math.sin(a) * 66 * r).toFixed(1));
    }
    poly.setAttribute("points", pts.join(" "));
  })()

  function nudgeProgress() {
    progress.classList.remove("bump");
    void progress.offsetWidth; // restart the animation
    progress.classList.add("bump");
  }

  // ======================================================================
  // Building elements
  // ======================================================================
  function shell(kind, tilt) {
    var el = document.createElement("div");
    var inner = document.createElement("div");
    el.className = "item " + kind;
    inner.className = "inner";
    el.style.setProperty("--tilt", (tilt != null ? tilt : randomTilt()).toFixed(1) + "deg");
    el.appendChild(inner);
    return { el: el, inner: inner };
  }

  function mediaWidth(size, ratio, scale) {
    var v = viewport();
    var share = SIZE[size] || SIZE.m;
    var cap = SIZE_CAP[size] || SIZE_CAP.m;
    var w = Math.min(Math.min(v.w, v.h) * share * 1.25, cap, v.w - EDGE * 2) * (scale || 1);
    var B = bands(), maxH = (v.h - B.t - B.b) * 0.8; // tall items must also fit between the UI bands
    if (w / ratio > maxH) w = maxH * ratio;
    return Math.round(w);
  }

  // a rectangle whose edges are gentle waves (amp = wave height, wl = wavelength), as SVG
  function wavySVG(w, h) {
    // postage-stamp / pinking-shears edge: small regular teeth, pointed tips and round valleys
    var tooth = Math.max(7, Math.min(w, h) * 0.034), depth = tooth * 0.42, pts = [], x, y;
    function e(t) { var f = (t / tooth) % 1; return depth * (1 - Math.abs(Math.sin(Math.PI * f))); }   // 0 at the tips
    for (x = 0; x <= w; x += 1.5) pts.push([x, e(x)]);
    for (y = 0; y <= h; y += 1.5) pts.push([w - e(y), y]);
    for (x = w; x >= 0; x -= 1.5) pts.push([x, h - e(x)]);
    for (y = h; y >= 0; y -= 1.5) pts.push([e(y), y]);
    var d = "M" + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L") + "Z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><path d="' + d + '" fill="#000"/></svg>';
  }

  function makeImg(src, cls) {
    var img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.draggable = false;
    img.className = cls;
    return img;
  }

  // image / video: a real photo if spec.src is set, otherwise a placeholder box
  function buildMedia(spec, kind, size, tilt) {
    var s = shell("media " + kind, tilt);
    var ratio = spec.ratio || 1;
    var w = Math.round(mediaWidth(spec.size || size, ratio, spec.scale) * (spec._fit || 1));
    var h = Math.round(w / ratio);

    if (spec.frame === "polaroid") {
      // white border, thicker at the bottom, like an instant photo
      var side = Math.max(4, Math.round(w * 0.06)), bottom = Math.round(w * 0.24);
      s.el.classList.add("polaroid");
      s.inner.style.padding = side + "px " + side + "px " + bottom + "px";
      s.el.style.width = (w + side * 2) + "px";
      s.el.style.height = (h + side + bottom) + "px";
    } else {
      s.el.style.width = w + "px";
      s.el.style.height = h + "px";
    }

    if (spec.postcard) {
      // POSTCARD: "rect" = coloured frame, "wavy" = cream card with a stamp-like scalloped edge.
      // The city name sits on the photo, in its own retro font.
      var pc = spec.postcard;
      s.el.classList.add("postcard", "pc-" + (pc.shape || "rect"));
      s.inner.style.setProperty("--frame", pc.frame || "#F7C6D3");
      var pic = document.createElement("div");
      pic.className = "pc-pic";
      if (spec.src) pic.appendChild(makeImg(spec.src, "pic"));
      else pic.style.background = pc.field || "#cfd8de";
      var name = document.createElement("div");
      name.className = "pc-name";
      name.textContent = pc.city || "";
      name.style.fontFamily = pc.font || "Georgia, serif";
      name.style.color = pc.fill || "#F7D046";
      name.style.setProperty("--shade", pc.shade || "#E5432A");
      if (pc.upper) name.style.textTransform = "uppercase";
      if (pc.spacing) name.style.letterSpacing = pc.spacing;
      if (pc.noShadow) name.classList.add("flat");
      // size the name to the card: longer names get smaller
      var len = Math.max(4, (pc.city || "").length);
      var base = Math.min(h * 0.42, (w * (pc.scale || 1.55)) / len);
      name.style.fontSize = base + "px";
      name.dataset.base = base;
      pic.appendChild(name);
      s.inner.appendChild(pic);
      if ((pc.shape || "rect") === "wavy") {
        var full = s.el.style.width ? parseFloat(s.el.style.width) : w;
        var fullH = s.el.style.height ? parseFloat(s.el.style.height) : h;
        var url = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(wavySVG(full, fullH)) + '")';
        s.inner.style.webkitMaskImage = url; s.inner.style.maskImage = url;
      }
      s.el.setAttribute("role", "img");
      s.el.setAttribute("aria-label", "Postcard from " + (pc.city || ""));
      // appear in one go: wait for the photo and the font (max ~1.2 s), not frame → photo → text
      s.el.classList.add("pc-wait");
      var im = pic.querySelector("img"), ready = [];
      if (im) ready.push(im.decode ? im.decode().catch(function () {}) : Promise.resolve());
      if (document.fonts && document.fonts.load) ready.push(document.fonts.load("1em " + (pc.font || "serif")).catch(function () {}));
      var shown = false, show = function () { if (shown) return; shown = true; s.el.classList.remove("pc-wait"); fitNames(s.el); };
      Promise.all(ready).then(show); setTimeout(show, 1200);
      return s.el;
    }

    if (spec.src && kind === "video") {
      s.el.classList.add("photo", "clip");
      if (spec.frame === "phone") s.el.classList.add("phone");
      var vid = document.createElement("video");
      vid.src = spec.src;
      if (spec.poster) vid.poster = spec.poster;
      vid.muted = true; vid.defaultMuted = true;          // never any sound
      vid.loop = spec.loop !== false; vid.autoplay = !reduceMotion;   // loop: false → plays once, stops on the last frame
      vid.playsInline = true;
      vid.setAttribute("muted", ""); vid.setAttribute("playsinline", "");
      vid.preload = "auto";
      vid.className = "pic";
      if (spec.rate) {                       // e.g. 1.2 → 20% faster
        vid.defaultPlaybackRate = spec.rate; vid.playbackRate = spec.rate;
        vid.addEventListener("loadedmetadata", function () { vid.playbackRate = spec.rate; });
      }
      s.inner.appendChild(vid);

      if (spec.subs) addSubs(s.inner, vid, spec.subs);

      if (spec.sound) {
        // try WITH sound; browsers often refuse → play muted + a small sound button
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sound";
        var setLabel = function () { btn.textContent = vid.muted ? "SOUND ON" : "SOUND OFF"; };
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          vid.muted = !vid.muted;
          if (!vid.muted) { var p2 = vid.play(); if (p2 && p2.catch) p2.catch(function () {}); }
          setLabel();
        });
        s.inner.appendChild(btn);
        vid.muted = false; vid.removeAttribute("muted");
        var p1 = vid.play();
        if (p1 && p1.then) {
          p1.then(setLabel, function () {
            vid.muted = true; setLabel();
            var p3 = vid.play(); if (p3 && p3.catch) p3.catch(function () {});
          });
        }
        setLabel();
      } else if (!reduceMotion) { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); }
      return s.el;
    }

    if (spec.src && kind === "image") {
      s.el.classList.add("photo");
      if (spec.pixelated) s.el.classList.add("pixelated");
      s.inner.appendChild(makeImg(spec.src, "pic"));
      if (spec.alt) { s.el.setAttribute("role", "img"); s.el.setAttribute("aria-label", spec.alt); }
      if (spec.reveal) addReveal(s, spec, w);
      return s.el;
    }

    s.inner.style.setProperty("--fill", spec.color || "#ddd");
    var tag = document.createElement("span");
    tag.className = "tag";
    tag.innerHTML = (spec.label || kind.toUpperCase()) +
      " <small>" + (kind === "video" ? "video" : "img") + "</small>";
    s.inner.appendChild(tag);

    if (kind === "video") {
      s.inner.insertAdjacentHTML("beforeend", '<span class="play"></span><span class="bar"></span>');
    }
    s.el.setAttribute("role", "img");
    s.el.setAttribute("aria-label", (spec.label || kind) + " placeholder");
    return s.el;
  }

  // "reveal": a flat-colour copy of the photo (the silhouette, if the photo is
  // a cut-out) that slides away top→bottom, then comes back up — in a loop.
  function addReveal(s, spec, w) {
    var r = spec.reveal === true ? {} : spec.reveal;
    var wash = document.createElement("div");
    wash.className = "wash" + (r.loop === false ? " once" : "");
    wash.style.setProperty("--wash", r.color || "var(--primary)");
    if (r.duration) wash.style.animationDuration = r.duration + "ms";
    if (r.mask) {
      // a ready-made silhouette image (e.g. blocky/pixel edges), already in its colour.
      // Until it has loaded, the photo stays hidden: it must always START orange.
      var m = makeImg(r.mask, "mask");
      wash.appendChild(m);
      if (!m.complete) {
        s.inner.classList.add("waiting");
        var ready = function () {
          s.inner.classList.remove("waiting");
          wash.style.animation = "none"; void wash.offsetWidth; wash.style.animation = ""; // restart from orange
          if (r.duration) wash.style.animationDuration = r.duration + "ms";
        };
        m.addEventListener("load", ready);
        m.addEventListener("error", ready);
      }
    } else if (r.cutout !== false) {
      // silhouette: the same image, pushed out of the box, casting a coloured shadow back in
      var sil = makeImg(spec.src, "sil");
      sil.style.left = -w + "px";
      sil.style.setProperty("--w", w + "px");
      wash.appendChild(sil);
    } else {
      wash.classList.add("solid");
    }
    s.inner.appendChild(wash);
  }

  // subtitles over a video: subs = [{ from: s, to: s, text: "…" }, …]
  function addSubs(inner, vid, subs) {
    var box = document.createElement("div");
    box.className = "subs";
    inner.appendChild(box);
    vid.addEventListener("timeupdate", function () {
      var t = vid.currentTime, now = "";
      subs.forEach(function (c) { if (t >= c.from && t < c.to) now = c.text; });
      if (box.textContent !== now) box.textContent = now;
      box.style.visibility = now ? "visible" : "hidden";
    });
  }

  // write `shown` into a text, turning link phrases into links (once fully written)
  // and, if asked, the strike phrase into a span that can be crossed out
  function renderInto(inner, shown, beat, withStrike) {
    var marks = [];
    Object.keys(beat.links || {}).forEach(function (phrase) {
      var at = shown.indexOf(phrase);
      if (at >= 0) marks.push({ at: at, len: phrase.length, href: beat.links[phrase] });
    });
    (beat.bold || []).forEach(function (phrase) {
      var at = shown.indexOf(phrase);
      if (at >= 0) marks.push({ at: at, len: phrase.length, bold: true });
    });
    if (withStrike && beat.strike) {
      var sAt = shown.lastIndexOf(beat.strike);
      if (sAt >= 0) marks.push({ at: sAt, len: beat.strike.length, strike: true });
    }
    marks.sort(function (a, b) { return a.at - b.at; });
    inner.textContent = "";
    var pos = 0, strikeEl = null;
    marks.forEach(function (m) {
      if (m.at < pos) return;
      inner.appendChild(document.createTextNode(shown.slice(pos, m.at)));
      var el;
      if (m.href) {
        el = document.createElement("a");
        el.href = m.href; el.target = "_blank"; el.rel = "noopener";
      } else if (m.bold) {
        el = document.createElement("strong");
      } else {
        el = document.createElement("span");
        el.className = "strike";
        strikeEl = el;
      }
      el.textContent = shown.substr(m.at, m.len);
      inner.appendChild(el);
      pos = m.at + m.len;
    });
    inner.appendChild(document.createTextNode(shown.slice(pos)));
    return strikeEl;
  }

  // a little mouse cursor that glides onto the first link of a text, clicks twice, fades away
  // pixel-art arrow (black outline, white fill), drawn square by square
  var CURSOR_SVG = '<svg viewBox="0 0 11 17" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="1" height="1" fill="#000"/><rect x="0" y="1" width="1" height="1" fill="#000"/><rect x="1" y="1" width="1" height="1" fill="#000"/><rect x="0" y="2" width="1" height="1" fill="#000"/><rect x="1" y="2" width="1" height="1" fill="#FFF"/><rect x="2" y="2" width="1" height="1" fill="#000"/><rect x="0" y="3" width="1" height="1" fill="#000"/><rect x="1" y="3" width="1" height="1" fill="#FFF"/><rect x="2" y="3" width="1" height="1" fill="#FFF"/><rect x="3" y="3" width="1" height="1" fill="#000"/><rect x="0" y="4" width="1" height="1" fill="#000"/><rect x="1" y="4" width="1" height="1" fill="#FFF"/><rect x="2" y="4" width="1" height="1" fill="#FFF"/><rect x="3" y="4" width="1" height="1" fill="#FFF"/><rect x="4" y="4" width="1" height="1" fill="#000"/><rect x="0" y="5" width="1" height="1" fill="#000"/><rect x="1" y="5" width="1" height="1" fill="#FFF"/><rect x="2" y="5" width="1" height="1" fill="#FFF"/><rect x="3" y="5" width="1" height="1" fill="#FFF"/><rect x="4" y="5" width="1" height="1" fill="#FFF"/><rect x="5" y="5" width="1" height="1" fill="#000"/><rect x="0" y="6" width="1" height="1" fill="#000"/><rect x="1" y="6" width="1" height="1" fill="#FFF"/><rect x="2" y="6" width="1" height="1" fill="#FFF"/><rect x="3" y="6" width="1" height="1" fill="#FFF"/><rect x="4" y="6" width="1" height="1" fill="#FFF"/><rect x="5" y="6" width="1" height="1" fill="#FFF"/><rect x="6" y="6" width="1" height="1" fill="#000"/><rect x="0" y="7" width="1" height="1" fill="#000"/><rect x="1" y="7" width="1" height="1" fill="#FFF"/><rect x="2" y="7" width="1" height="1" fill="#FFF"/><rect x="3" y="7" width="1" height="1" fill="#FFF"/><rect x="4" y="7" width="1" height="1" fill="#FFF"/><rect x="5" y="7" width="1" height="1" fill="#FFF"/><rect x="6" y="7" width="1" height="1" fill="#FFF"/><rect x="7" y="7" width="1" height="1" fill="#000"/><rect x="0" y="8" width="1" height="1" fill="#000"/><rect x="1" y="8" width="1" height="1" fill="#FFF"/><rect x="2" y="8" width="1" height="1" fill="#FFF"/><rect x="3" y="8" width="1" height="1" fill="#FFF"/><rect x="4" y="8" width="1" height="1" fill="#FFF"/><rect x="5" y="8" width="1" height="1" fill="#FFF"/><rect x="6" y="8" width="1" height="1" fill="#FFF"/><rect x="7" y="8" width="1" height="1" fill="#FFF"/><rect x="8" y="8" width="1" height="1" fill="#000"/><rect x="0" y="9" width="1" height="1" fill="#000"/><rect x="1" y="9" width="1" height="1" fill="#FFF"/><rect x="2" y="9" width="1" height="1" fill="#FFF"/><rect x="3" y="9" width="1" height="1" fill="#FFF"/><rect x="4" y="9" width="1" height="1" fill="#FFF"/><rect x="5" y="9" width="1" height="1" fill="#FFF"/><rect x="6" y="9" width="1" height="1" fill="#FFF"/><rect x="7" y="9" width="1" height="1" fill="#FFF"/><rect x="8" y="9" width="1" height="1" fill="#FFF"/><rect x="9" y="9" width="1" height="1" fill="#000"/><rect x="0" y="10" width="1" height="1" fill="#000"/><rect x="1" y="10" width="1" height="1" fill="#FFF"/><rect x="2" y="10" width="1" height="1" fill="#FFF"/><rect x="3" y="10" width="1" height="1" fill="#FFF"/><rect x="4" y="10" width="1" height="1" fill="#FFF"/><rect x="5" y="10" width="1" height="1" fill="#FFF"/><rect x="6" y="10" width="1" height="1" fill="#000"/><rect x="7" y="10" width="1" height="1" fill="#000"/><rect x="8" y="10" width="1" height="1" fill="#000"/><rect x="9" y="10" width="1" height="1" fill="#000"/><rect x="10" y="10" width="1" height="1" fill="#000"/><rect x="0" y="11" width="1" height="1" fill="#000"/><rect x="1" y="11" width="1" height="1" fill="#FFF"/><rect x="2" y="11" width="1" height="1" fill="#FFF"/><rect x="3" y="11" width="1" height="1" fill="#000"/><rect x="4" y="11" width="1" height="1" fill="#FFF"/><rect x="5" y="11" width="1" height="1" fill="#FFF"/><rect x="6" y="11" width="1" height="1" fill="#000"/><rect x="0" y="12" width="1" height="1" fill="#000"/><rect x="1" y="12" width="1" height="1" fill="#FFF"/><rect x="2" y="12" width="1" height="1" fill="#000"/><rect x="4" y="12" width="1" height="1" fill="#000"/><rect x="5" y="12" width="1" height="1" fill="#FFF"/><rect x="6" y="12" width="1" height="1" fill="#FFF"/><rect x="7" y="12" width="1" height="1" fill="#000"/><rect x="0" y="13" width="1" height="1" fill="#000"/><rect x="1" y="13" width="1" height="1" fill="#000"/><rect x="4" y="13" width="1" height="1" fill="#000"/><rect x="5" y="13" width="1" height="1" fill="#FFF"/><rect x="6" y="13" width="1" height="1" fill="#FFF"/><rect x="7" y="13" width="1" height="1" fill="#000"/><rect x="0" y="14" width="1" height="1" fill="#000"/><rect x="5" y="14" width="1" height="1" fill="#000"/><rect x="6" y="14" width="1" height="1" fill="#FFF"/><rect x="7" y="14" width="1" height="1" fill="#FFF"/><rect x="8" y="14" width="1" height="1" fill="#000"/><rect x="5" y="15" width="1" height="1" fill="#000"/><rect x="6" y="15" width="1" height="1" fill="#FFF"/><rect x="7" y="15" width="1" height="1" fill="#FFF"/><rect x="8" y="15" width="1" height="1" fill="#000"/><rect x="6" y="16" width="1" height="1" fill="#000"/><rect x="7" y="16" width="1" height="1" fill="#000"/></svg>';
  // spots that together cover the screen (postcards "filling the page")
  var FILL_TALL = [[0.32, 0.17], [0.70, 0.36], [0.30, 0.56], [0.70, 0.74], [0.38, 0.90], [0.62, 0.10]];
  var FILL_WIDE = [[0.20, 0.30], [0.52, 0.22], [0.82, 0.34], [0.32, 0.76], [0.68, 0.72], [0.50, 0.50]];
  function fillSpot(k) {
    var v = viewport(), list = v.h > v.w ? FILL_TALL : FILL_WIDE, p = list[k % list.length];
    return { x: p[0] * v.w, y: p[1] * v.h };
  }

  // "cues": { "word": beat } → that beat plays the moment "word" has been typed
  function fireCues(beat, item, shown) {
    if (!beat.cues) return;
    item.fired = item.fired || {};
    var at = step - 1;
    Object.keys(beat.cues).forEach(function (word) {
      if (item.fired[word] || shown.indexOf(word) < 0) return;
      item.fired[word] = true;
      var next = beat.cues[word], v = viewport(), unit = Math.min(v.w, v.h);
      if (next.beside) {                                         // wait for the text to lay out, then sit next to the word
        later(function () {
          if (item.dead) return;
          var fb = besideSpot(item, next, word);
          var before = live.length;
          playBeat(next, fb.x, fb.y, at);
          var made = live[live.length - 1];
          if (made && live.length > before && fb.from) {      // pop out of the word
            made.el.style.setProperty("--fx", (fb.from.x - (made.x + made.el.offsetWidth / 2)) + "px");
            made.el.style.setProperty("--fy", (fb.from.y - (made.y + made.el.offsetHeight / 2)) + "px");
            made.el.classList.add("dealt");
          }
        }, 60);
        return;
      }
      var f;
      if (next.corner) {                                         // a pile in a bottom corner, on the side away from the text
        var B = bands(), box = item.el.getBoundingClientRect();
        if (!item.cornerSide) item.cornerSide = (box.left + box.width / 2) < v.w / 2 ? "right" : "left";
        var pw = mediaWidth(next.size || "m", next.ratio || 1.5, next.scale), ph = pw / (next.ratio || 1.5);
        next._fit = 1;
        // phones: the text is as wide as the screen, so the pile goes to the top or the bottom, away from it
        var topPile = v.h > v.w && (box.top + box.height / 2) > v.h / 2;
        // mostly on screen (the city name must be readable), just a corner sticking out
        f = { x: item.cornerSide === "left" ? pw * 0.46 : v.w - pw * 0.46,
              y: topPile ? B.t + ph * 0.52 : v.h - B.b - ph * 0.5 };
        f.x += (Math.random() * 2 - 1) * pw * 0.08; f.y += (Math.random() * 2 - 1) * ph * 0.14;
        next.tilt = Math.round((Math.random() * 2 - 1) * 12);
        playBeat(next, f.x, f.y, at);
        if (beat.onTop !== false) { toFront(item); item.el.classList.add("boxed"); }
        return;
      }
      if (next.fill != null) f = fillSpot(next.fill);      // cover the whole screen
      else if (next.free) f = freeSpotFor(next);
      else f = { x: item.x + item.el.offsetWidth / 2, y: item.y - unit * 0.2 };
      var j = next.jitter != null ? next.jitter : 0;      // scatter, so a pile looks tossed
      playBeat(next, f.x + (Math.random() * 2 - 1) * j * unit, f.y + (Math.random() * 2 - 1) * j * unit, at);
      if (beat.onTop !== false) {          // the text stays readable above
        live.forEach(function (it) { if (!it.dead && it.el.classList.contains("imsg")) toFront(it); });  // chat-bubble photos too
        toFront(item);
        item.el.classList.add("boxed");
      }
    });
  }

  // centre for a photo sitting right next to the last typed character (else above / below that line)
  function besideSpot(item, next, word) {
    next._fit = 1;
    var inner = item.el.querySelector(".inner"), v = viewport(), B = bands();
    var w = mediaWidth(next.size || "s", next.ratio || 1, next.scale), h = w / (next.ratio || 1);
    var walker = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT), node;
    var c = item.el.getBoundingClientRect();
    var bare = word.replace(/[.,!?;:]+$/, "");             // the final dot may live in another text node
    while ((node = walker.nextNode())) {
      var k = node.textContent.indexOf(word);
      if (k < 0) { k = node.textContent.indexOf(bare); if (k < 0) continue; word = bare; }
      var rg = document.createRange();
      rg.setStart(node, k + word.length - 1); rg.setEnd(node, k + word.length);
      var rs = rg.getClientRects(); if (rs.length) c = rs[rs.length - 1];
      break;
    }
    var box = item.el.getBoundingClientRect();
    var from = { x: c.left + c.width / 2, y: c.top + c.height / 2 };   // it flies out of the word
    var g = 16, room = v.w - EDGE - box.right - g;
    if (room < w && room >= w * 0.5) {               // a little tight: shrink the photo to fit beside the box
      next._fit = room / w; w = room; h = w / (next.ratio || 1);
    }
    var yMid = Math.min(v.h - B.b - 4 - h / 2, Math.max(B.t + 4 + h / 2, from.y - h * 0.15));
    if (box.right + g + w <= v.w - EDGE) return { x: box.right + g + w / 2, y: yMid, from: from };   // right of the text box
    // phones: no room beside the box → above it, at the right, then below
    var xr = v.w - EDGE - w / 2;
    if (box.top - g - h >= B.t + 4) return { x: xr, y: box.top - g - h / 2, from: from };
    return { x: xr, y: Math.min(v.h - B.b - 4 - h / 2, box.bottom + g + h / 2), from: from };
  }

  // centre for a group placed far from the deck's cards, somewhere random on the other side of the screen
  function nearDeckSpot(next) {
    var cards = live.filter(function (it) { return it.el.classList.contains("card") && !it.dead; });
    if (!cards.length) return null;
    var D = cards.reduce(function (a, it) {
      var r = it.el.getBoundingClientRect();
      return { l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) };
    }, { l: 1e9, t: 1e9, r: -1e9, b: -1e9 });
    D = { l: D.l, t: D.t, r: D.r, b: D.b };
    var v = viewport();
    var spec = next.photos ? next.photos[0] : next;
    var w = mediaWidth(next.size || "m", spec.ratio || 1), h = w / (spec.ratio || 1);
    var cx = (D.l + D.r) / 2, cy = (D.t + D.b) / 2;
    // aim at the mirror of the deck across the screen centre, pushed around at random
    var pref = {
      x: v.w - cx + (Math.random() * 2 - 1) * v.w * 0.18,
      y: v.h - cy + (Math.random() * 2 - 1) * v.h * 0.18
    };
    // reserve room for the tossed tilts, and never land on texts or other media (the deck, the video)
    var spot = clearSpot(w * 1.3, h * 1.2, textRects().concat(mediaRects(), [D]), pref, isPhone() ? 0.9 : 0.3);
    if (isPhone()) spot = spot || sideSpot(w, h);
    if (!spot) return null;
    next._fit = spot.scale;
    next._bleed = !!spot.bleed;
    return spot;
  }

  function maybeHint(item, inner, beat, delay) {
    if (item.hinted || !beat.links || beat.linkHint === false) return;
    if (!inner.querySelector("a")) return;          // the link isn't complete yet
    item.hinted = true;
    var at = step - 1;
    cursorHint(item, inner, delay, beat.hintThen && function (pt) {
      // things that pop out of the link when the little cursor "clicks" it
      beat.hintThen.forEach(function (next) { playBeat(next, pt.x, pt.y, at); });
    });
  }

  function cursorHint(item, inner, delay, onClick) {
    if (reduceMotion) return;
    later(function () {
      if (item.dead) return;
      var a = inner.querySelector("a");
      if (!a) return;
      var ir = item.el.getBoundingClientRect(), ar = a.getBoundingClientRect();
      var c = document.createElement("span");
      c.className = "cursor-hint";
      c.innerHTML = CURSOR_SVG;
      c.style.left = (ar.left - ir.left + ar.width * 0.55) + "px";
      c.style.top = (ar.top - ir.top + ar.height * 0.45) + "px";
      item.el.appendChild(c);
      setTimeout(function () { c.remove(); }, 3200);
      if (onClick) later(function () {
        if (!item.dead) onClick({ x: ar.left + ar.width / 2, y: ar.top + ar.height / 2 });
      }, 1230);
    }, delay);
  }

  // draw a line through one phrase of a text (after a short pause)
  function strikeOut(inner, full, beat) {
    var span = renderInto(inner, full, beat, true);
    if (!span) return;
    later(function () { span.classList.add("on"); }, reduceMotion ? 0 : (beat.strikeDelay || 600));
  }

  function buildText(beat) {
    var s = shell("text", beat.tilt);
    if (beat.style) s.el.classList.add(beat.style);
    if (beat.align) s.el.classList.add("align-" + beat.align);
    if (beat.color) s.el.classList.add("color-" + beat.color);
    if (beat.boxed) s.el.classList.add("boxed");
    if (beat.box === "light") s.el.classList.add("box-light");   // white box, violet text (on coloured pages)
    if (beat.lines) {
      // every line is in place from the start (so the size doesn't jump), just hidden
      (beat.text || "").split("\n").forEach(function (line) {
        var span = document.createElement("span");
        span.className = "line";
        span.textContent = line;
        s.inner.appendChild(span);
      });
    } else if (beat.words) {
      // every word is in place from the start (so the size doesn't jump), just hidden
      (beat.text || "").split(/(\s+)/).forEach(function (part) {
        if (/^\s+$/.test(part) || !part) { s.inner.appendChild(document.createTextNode(part)); return; }
        var span = document.createElement("span");
        span.className = "word";
        span.textContent = part;
        s.inner.appendChild(span);
      });
    } else if (beat.typing) {
      s.inner.textContent = "";
    } else {
      renderInto(s.inner, beat.text || "", beat, false);
    }
    return s;
  }

  // shrink postcard city names until they fit their photo (fonts differ in width)
  function fitNames(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".pc-name"), function (n) {
      var size = parseFloat(n.dataset.base) || parseFloat(n.style.fontSize);
      n.style.fontSize = size + "px";
      for (var k = 0; k < 40 && n.scrollWidth > n.clientWidth + 1; k++) {   // overflowing → smaller
        size *= 0.94;
        n.style.fontSize = size + "px";
      }
    });
  }
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener("loadingdone", function () { fitNames(stage); });
  }

  // add an element to the stage as a live, draggable item
  function addItem(el, x, y, diesAt, anchor) {
    el.style.visibility = "hidden";       // measure before showing
    stage.appendChild(el);
    if (el.classList.contains("postcard")) fitNames(el);
    var item = { el: el, x: 0, y: 0, diesAt: diesAt };
    el._item = item;
    live.push(item);
    if (anchor && anchor.ref) {
      // stick to another item: right below it, or right above it, aligned left
      var ref = anchor.ref, g = anchor.gap != null ? anchor.gap : 10;
      var refH = Math.max(ref.el.offsetHeight, ref.fh || 0);
      var ay = anchor.mode === "above" ? ref.y - el.offsetHeight - g
                                       : ref.y + refH + g;
      place(item, ref.x + (anchor.dx || 0), ay);
      if (anchor.mode !== "above" && item.y < ay - 1 && !ref.fixed) {
        // no room below: lift the item it hangs from, so they never overlap
        place(ref, ref.x, ref.y - (ay - item.y));
        place(item, ref.x + (anchor.dx || 0), ref.y + refH + g);
      }
    } else if (anchor === "topleft") place(item, x, y);
    else place(item, x - el.offsetWidth / 2, y - el.offsetHeight / 2); // centred on the tap
    toFront(item);
    el.style.visibility = "";
    return item;
  }

  // ======================================================================
  // Beat players — one per type
  // ======================================================================
  var players = {

    text: function (beat, x, y, diesAt, anchor) {
      // "into": this text takes the place of an earlier one (same spot)
      if (beat.into) {
        var old = live.filter(function (it) { return it.id === beat.into; })[0];
        if (old) {
          x = old.x; y = old.y; anchor = "topleft";
          removeItem(old, "fast");
        }
      }
      var fs = beat.typing ? finalSize(beat) : null;
      if (fs && !anchor) {
        // centre the FINAL text on the tap, then let it grow inside that box
        x = x - fs.w / 2; y = y - fs.h / 2; anchor = "topleft";
      }
      var s = buildText(beat);
      var item = addItem(s.el, x, y, diesAt, anchor);
      item.id = beat.id || beat.into;
      if (fs) {
        item.fw = fs.w; item.fh = fs.h;
        var keep = { x: item.x, y: item.y };
        s.el.style.minWidth = fs.w + "px"; s.el.style.minHeight = fs.h + "px";
        place(item, keep.x, keep.y);           // keep it on screen at its final size
        if (anchor && anchor.ref && anchor.mode !== "above" && item.y < keep.y - 1 && !anchor.ref.fixed)
          place(anchor.ref, anchor.ref.x, anchor.ref.y - (keep.y - item.y));   // lift what it hangs from
        s.el.style.minWidth = ""; s.el.style.minHeight = "";
      }
      if (!beat.typing && beat.strike) strikeOut(s.inner, beat.text || "", beat);
      if (!beat.typing) maybeHint(item, s.inner, beat, 400);
      if (beat.lines) {
        var lines = s.inner.querySelectorAll(".line");
        var lgap = reduceMotion ? 0 : (beat.speed || 650);
        Array.prototype.forEach.call(lines, function (lEl, n) {
          later(function () { lEl.classList.add("on"); }, n * lgap);
        });
      } else if (beat.words) {
        var words = s.inner.querySelectorAll(".word");
        var gap = reduceMotion ? 0 : (beat.speed || 380);
        Array.prototype.forEach.call(words, function (wEl, n) {
          later(function () { wEl.classList.add("on"); }, n * gap);
        });
      } else if (beat.typing) {
        // keep the tap point as the centre while the text grows
        var cx = x, cy = y, full = beat.text || "", i = 0;
        var chars = graphemes(full);          // whole characters, so emoji are never split
        // typeFrom: everything before that phrase is there at once, only the rest is typed
        var pause = 0;
        if (beat.typeFrom) {
          var from = full.indexOf(beat.typeFrom);
          if (from > 0) {
            i = graphemes(full.slice(0, from)).length;
            renderInto(s.inner, full.slice(0, from), beat, false);
            later(function () { maybeHint(item, s.inner, beat, 250); fireCues(beat, item, full.slice(0, from)); }, 0);
            pause = beat.typePause != null ? beat.typePause : TYPE_PAUSE; // breath before the typing
          }
        }
        var anchored = !!anchor; // stuck under/above something, or top-left: grow from there
        var speed = (beat.speed || TYPE_SPEED) * TYPE_FACTOR;   // all typing 15% faster
        s.inner.classList.add("caret");
        var typeNext = function () {
          if (item.dead) return;
          i++;
          var shownNow = chars.slice(0, i).join("");
          renderInto(s.inner, shownNow, beat, false);
          maybeHint(item, s.inner, beat, 150);
          fireCues(beat, item, shownNow);
          if (anchored) refit(item);
          else place(item, cx - s.el.offsetWidth / 2, cy - s.el.offsetHeight / 2);
          if (i < chars.length) later(typeNext, reduceMotion ? 0 : speed);
          else {
            later(function () { s.inner.classList.remove("caret"); }, beat.strike ? 0 : 1200);
            if (beat.strike) strikeOut(s.inner, full, beat);
            else renderInto(s.inner, full, beat, false);
            maybeHint(item, s.inner, beat, 300);
            playThen(beat, item);
          }
        };
        var wait = (pause || 0) + (beat.typeDelay || 0);
        if (wait && !reduceMotion) later(typeNext, wait); else typeNext();
      }
    },

    image: function (beat, x, y, diesAt, anchor) {
      var mel = buildMedia(beat, "image", "m", beat.tilt);
      if (beat.bubble) mel.classList.add("imsg");          // photo sent as an iMessage bubble
      var it = addItem(mel, x, y, diesAt, anchor);
      if (beat._bleed && !anchor) { it.bleed = true; place(it, x - mel.offsetWidth / 2, y - mel.offsetHeight / 2); }
      if (beat.bleed) {
        it.bleed = true;
        if (!anchor) place(it, x - it.el.offsetWidth / 2, y - it.el.offsetHeight / 2);
      }
    },

    video: function (beat, x, y, diesAt, anchor) {
      var vit = addItem(buildMedia(beat, "video", "m", beat.tilt), x, y, diesAt, anchor);
      if (beat._bleed && !anchor) { vit.bleed = true; place(vit, x - vit.el.offsetWidth / 2, y - vit.el.offsetHeight / 2); }
    },

    // one tap → several photos land in quick succession around the tap
    burst: function (beat, x, y, diesAt) {
      var photos = beat.photos || [];
      var keepLast = beat.keep === "last";
      var spread = beat.spread != null ? beat.spread : (keepLast ? 0.25 : 1);
      var v = viewport();
      var r = Math.min(v.w, v.h) * 0.22 * spread;
      var speed = reduceMotion ? 0 : (beat.speed || 140);
      var prev = null;

      var made = [];
      if (beat.vanish != null) {
        // once every photo has landed (+ a little pause), they all go away together
        later(function () {
          made.forEach(function (it) { removeItem(it, true); });
        }, photos.length * speed + (reduceMotion ? 600 : beat.vanish));
      }

      photos.forEach(function (spec, n) {
        later(function () {
          var a = Math.random() * Math.PI * 2;
          var d = n === 0 ? 0 : r * (0.4 + Math.random() * 0.6);
          var el = buildMedia(spec, "image", beat.size || "s",
            spec.tilt != null ? spec.tilt : randomTilt() * 1.6);
          el.classList.add("quick");
          var item = addItem(el, x + Math.cos(a) * d, y + Math.sin(a) * d, diesAt);
          if (keepLast && prev && !prev.dead) removeItem(prev, true);
          prev = item;
          made.push(item);
        }, n * speed);
      });
    },

    // photos slide up from below, one on top of the other (stop-motion),
    // then leave the same way, upwards
    stack: function (beat, x, y, diesAt) {
      var photos = beat.photos || [];
      var gap = reduceMotion ? 0 : (beat.interval || 900);
      var made = [];
      var how = beat._side === "above" ? "stack-up" : "stack-down";
      photos.forEach(function (spec, n) {
        later(function () {
          if (step >= diesAt) return; // the story already moved on
          var mess = beat.mess || 0;              // 0 = neat pile; 1 = tossed (bigger tilts, scattered)
          var tilt = spec.tilt != null ? spec.tilt
                   : mess ? (Math.random() * 2 - 1) * (4 + 6 * mess)
                   : (n === 0 ? 0 : (n % 2 ? 1 : -1) * (2 + Math.random() * 3));
          var el = buildMedia(Object.assign({ _fit: beat._fit }, spec), "image", beat.size || "m", tilt);
          el.classList.add("stacked");
          if (beat._side === "above") el.classList.add("from-top");
          var u = (parseFloat(el.style.width) || 200) * 0.06 * mess;   // scattered, but inside its reserved spot
          var it = addItem(el, x + (Math.random() * 2 - 1) * u, y + (Math.random() * 2 - 1) * u, diesAt);
          if (beat._bleed) { it.bleed = true; place(it, x - el.offsetWidth / 2, y - el.offsetHeight / 2); }
          it.leaveHow = how;                    // when its lifespan ends, it slides away
          it.group = made; it.idx = made.length;
          made.push(it);
        }, n * gap);
      });
      if (beat.leave != null) {
        var start = (photos.length - 1) * gap + (reduceMotion ? 800 : beat.leave);
        photos.forEach(function (_, n) {
          later(function () {
            var it = made[made.length - 1 - n];   // the top one goes first
            if (it) removeItem(it, how);
          }, start + n * (reduceMotion ? 0 : (beat.leaveInterval || 220)));
        });
      }
    },

    // ZINE — a stapled paper zine that opens and turns its pages by itself (tap it to keep flipping).
    // Leaf k: front = photo 2k (right page), back = photo 2k+1 (left page). Photo 0 is the cover.
    zine: function (beat, x, y, diesAt) {
      var photos = beat.photos || [];
      var nLeaves = Math.ceil(photos.length / 2);
      var v = viewport(), B = bands(), ratio = beat.pageRatio || 0.72;   // page width / height
      var availW = v.w - EDGE * 2, availH = (v.h - B.t - B.b) * (beat.height || 0.78);
      var pw = Math.min(availW / 2, availH * ratio, beat.maxPage || 360), ph = pw / ratio;
      var spot = clearSpot(pw * 2 + 24, ph + 24, textRects(), { x: x, y: y }, 0.55)
              || clearSpot(pw * 2 + 24, ph + 24, textRects(true), { x: x, y: y }, 0.55);   // may cover the chat
      var sc = spot ? spot.scale : 0.8;
      if (!spot) { var fb = freeSpot(pw * 2, ph, textRects(true)); spot = { x: fb.x, y: fb.y }; sc = Math.min(0.9, fb.scale); }
      pw = Math.round(pw * sc); ph = Math.round(ph * sc);

      var s = shell("zine", beat.tilt != null ? beat.tilt : -2);
      s.el.style.width = pw * 2 + "px"; s.el.style.height = ph + "px";
      s.el.style.setProperty("--pw", pw + "px");
      var book = document.createElement("div");
      book.className = "zine-book closed";
      s.inner.appendChild(book);
      var base = document.createElement("div");          // the inside of the back cover (right) under all leaves
      base.className = "zpage zbase";
      book.appendChild(base);

      function page(spec, side, k) {
        var p = document.createElement("div");
        p.className = "zface " + side;
        if (spec) {
          var cover = k === 0 || spec.bleed;                    // the cover and some pages are full-bleed
          var img = makeImg(spec.src, "zimg" + (cover ? " bleed" : ""));
          if (!cover) {                                         // printed slightly crooked, like a collage
            img.style.setProperty("--zt", ((Math.random() * 2 - 1) * 2.5).toFixed(1) + "deg");
            img.style.setProperty("--zx", ((Math.random() * 2 - 1) * 4).toFixed(1) + "%");
            img.style.setProperty("--zy", ((Math.random() * 2 - 1) * 4).toFixed(1) + "%");
          }
          p.appendChild(img);
        }
        return p;
      }
      var leaves = [];
      for (var k = 0; k < nLeaves; k++) {
        var leaf = document.createElement("div");
        leaf.className = "zleaf";
        leaf.style.zIndex = nLeaves - k;
        leaf.appendChild(page(photos[2 * k], "front", 2 * k));
        leaf.appendChild(page(photos[2 * k + 1], "back", 2 * k + 1));
        book.appendChild(leaf);
        leaves.push(leaf);
      }
      var staple = document.createElement("div");
      staple.className = "zstaples";
      book.appendChild(staple);
      s.el.setAttribute("role", "img");
      s.el.setAttribute("aria-label", beat.alt || "Zine of works");

      var it = addItem(s.el, spot.x, spot.y, diesAt);
      var turned = 0, flipMs = reduceMotion ? 0 : (beat.flip || 950);
      function flipTo(n) {
        turned = Math.max(0, Math.min(nLeaves, n));
        leaves.forEach(function (lf, i) {
          var done = i < turned, rest = done ? i + 1 : nLeaves - i;
          var moving = lf.classList.contains("turned") !== done;
          lf.classList.toggle("turned", done);
          if (moving) {                       // the turning leaf flies over everything, then settles
            lf.style.zIndex = nLeaves * 2;
            lf.classList.remove("turning"); void lf.offsetWidth; lf.classList.add("turning");
            setTimeout(function () { lf.style.zIndex = rest; lf.classList.remove("turning"); }, flipMs);
          } else lf.style.zIndex = rest;
        });
        book.classList.toggle("closed", turned === 0);
      }
      it.onTap = function () { flipTo(turned >= nLeaves ? 0 : turned + 1); };
      // opens and turns the pages by itself, stopping on the last full spread
      var auto = Math.max(1, nLeaves - 1), every = beat.interval || 1300;
      for (var n = 1; n <= auto; n++) (function (n) {
        later(function () { if (!it.dead && turned === n - 1) flipTo(n); }, (beat.delay0 || 700) + (n - 1) * every);
      })(n);
    },

    // CARDS — project covers on a wall; the "camera" glides from card to card, now and then
    // zooms out to show the whole wall and dives back in somewhere else. Each card has a pill caption.
    cards: function (beat, x, y, diesAt) {
      var list = beat.cards || [];
      if (!list.length) return;
      var v = viewport(), B = bands();
      var ratio = beat.ratio || 0.8;                         // card width / height
      var availH = v.h - B.t - B.b - 16;
      var winW = Math.min(v.w - EDGE * 2, beat.maxWidth || 1000);
      var cw = winW * (v.w > v.h ? 0.34 : 0.62), ch = cw / ratio, gap = Math.round(cw * 0.09);
      var winH = ch + gap * 2;
      var spot = clearSpot(winW, winH, textRects(), { x: x, y: y }, 0.5);
      if (!spot) { var fb = freeSpot(winW, winH, textRects()); spot = { x: fb.x, y: fb.y, scale: Math.min(fb.scale, 0.8) }; }
      var sc = Math.min(1, spot.scale || 1);
      winW *= sc; cw *= sc; ch = cw / ratio; gap = Math.round(gap * sc); winH = ch + gap * 2;

      var s = shell("cards", 0);
      s.el.style.width = winW + "px"; s.el.style.height = winH + "px";
      var wall = document.createElement("div");
      wall.className = "cards-wall";
      s.inner.appendChild(wall);
      var cols = beat.cols || Math.ceil(Math.sqrt(list.length * 1.6)), rows = Math.ceil(list.length / cols);
      var pos = [];
      list.forEach(function (c, i) {
        var col = i % cols, row = Math.floor(i / cols);
        var px = col * (cw + gap) + (row % 2 ? (cw + gap) / 2 : 0), py = row * (ch + gap);   // rows offset, like bricks
        pos.push({ x: px + cw / 2, y: py + ch / 2 });
        var card = document.createElement("div");
        card.className = "pcard";
        card.style.cssText = "left:" + px + "px;top:" + py + "px;width:" + cw + "px;height:" + ch + "px";
        card.appendChild(makeImg(c.src, "pcard-img"));
        var pill = document.createElement(c.url ? "a" : "div");
        pill.className = "pcard-pill";
        if (c.url) { pill.href = c.url; pill.target = "_blank"; pill.rel = "noopener"; }
        pill.innerHTML = '<span class="pcard-name"></span><span class="pcard-go" aria-hidden="true">→</span>';
        pill.querySelector(".pcard-name").textContent = c.title || "";
        card.appendChild(pill);
        wall.appendChild(card);
      });
      var wallW = cols * (cw + gap) + (cw + gap) / 2, wallH = rows * (ch + gap);
      s.el.setAttribute("role", "region");
      s.el.setAttribute("aria-label", beat.alt || "A few projects");
      var it = addItem(s.el, spot.x, spot.y, diesAt);

      var cur = 0, hops = 0;
      function look(i, zoom) {                     // put card i in the middle of the window
        var p = pos[i];
        var k = zoom || 1;
        // keep the wall covering the window: no empty space beside the first / last cards
        var tx = Math.min(gap / 2, Math.max(winW - wallW * k + gap / 2, winW / 2 - p.x * k));
        var ty = Math.min(gap, Math.max(winH - wallH * k, winH / 2 - p.y * k));
        wall.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + k + ")";
      }
      function overview() {                        // the whole wall, small
        var k = Math.min(winW / wallW, winH / wallH) * 0.95;
        wall.style.transform = "translate(" + (winW - wallW * k) / 2 + "px," + (winH - wallH * k) / 2 + "px) scale(" + k + ")";
      }
      wall.style.transition = "none"; look(0);
      void wall.offsetWidth; wall.style.transition = "";
      var every = reduceMotion ? 2600 : (beat.interval || 1100);
      function tick() {
        if (it.dead) return;
        hops++;
        if (hops % (beat.zoomEvery || 5) === 0) {
          overview();
          later(function () {
            if (it.dead) return;
            var next; do { next = Math.floor(Math.random() * list.length); } while (next === cur && list.length > 1);
            cur = next; look(cur); later(tick, every);
          }, every * 1.1);
          return;
        }
        var row = Math.floor(cur / cols), nxt = cur + 1;
        if (nxt >= list.length || Math.floor(nxt / cols) !== row) nxt = row * cols;   // wrap within the row
        cur = nxt; look(cur);
        later(tick, every);
      }
      later(tick, (beat.delay0 || 900));
      it.onTap = function () { cur = (cur + 1) % list.length; look(cur); };
    },

    // SLIDES — photos slide in from the right one after another, big and straight, on top of everything
    slides: function (beat, x, y, diesAt) {
      var photos = beat.photos || [];
      var v = viewport(), B = bands();
      var gap = reduceMotion ? 0 : (beat.interval || 650);
      var areaW = v.w - EDGE * 2, areaH = (v.h - B.t - B.b) * (beat.fill || 0.86);
      var cx = v.w / 2, cy = B.t + (v.h - B.t - B.b) / 2;
      photos.forEach(function (spec, n) {
        later(function () {
          if (step >= diesAt) return;
          var r = spec.ratio || 1, w = Math.min(areaW, areaH * r), h = w / r;
          var s = shell("slide", 0);
          s.el.style.width = Math.round(w) + "px"; s.el.style.height = Math.round(h) + "px";
          s.inner.appendChild(makeImg(spec.src, "pic"));
          addItem(s.el, cx, cy, diesAt);
        }, n * gap);
      });
    },

    // COLLAGE — full screen: the background is cut into 1–4 panels of project images that keep
    // changing fast, and a white card in front shows one project at a time (title + cover, links to it).
    collage: function (beat, x, y, diesAt) {
      var list = beat.cards || [];
      if (!list.length) return;
      var v = viewport(), B = bands();
      var el = document.createElement("div");
      el.className = "collage";
      el.style.top = B.t + "px"; el.style.bottom = B.b + "px";
      var bg = document.createElement("div"); bg.className = "collage-bg"; el.appendChild(bg);
      var card = document.createElement("a");
      card.className = "collage-card"; card.target = "_blank"; card.rel = "noopener";
      card.innerHTML = '<span class="collage-title"></span><img class="collage-img" alt="" draggable="false">';
      el.appendChild(card);
      stage.appendChild(el);
      var item = { el: el, x: 0, y: 0, diesAt: diesAt, fixed: true };
      el._item = item; el.style.zIndex = ++z; live.push(item);
      // the texts stay readable on top
      live.forEach(function (it) { if (!it.dead && it.el.classList.contains("text")) { toFront(it); it.el.classList.add("boxed"); } });

      // the card sits on the side away from the texts
      var H = v.h - B.t - B.b, tr = textRects(true), cx = v.w / 2, cy = H / 2;
      var cw = Math.min(v.w * (v.w > v.h ? 0.3 : 0.62), H * 0.62, 420);
      if (tr.length) {
        var t = tr[tr.length - 1], tx = (t.l + t.r) / 2, ty = (t.t + t.b) / 2 - B.t;
        if (v.w > v.h) cx = tx < v.w / 2 ? v.w * 0.7 : v.w * 0.3;
        else cy = ty < H / 2 ? H * 0.66 : H * 0.34;
      }
      card.style.width = cw + "px";
      card.style.left = (cx - cw / 2) + "px";
      card.style.setProperty("--cy", cy + "px");

      var LAYOUTS = [
        [[0, 0, 1, 1]],
        [[0, 0, .5, 1], [.5, 0, .5, 1]],
        [[0, 0, .5, 1], [.5, 0, .5, .5], [.5, .5, .5, .5]],
        [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]],
        [[0, 0, 1, .5], [0, .5, .5, .5], [.5, .5, .5, .5]],
        [[0, 0, .5, .5], [0, .5, .5, .5], [.5, 0, .5, 1]]
      ];
      var k = 0, shown = 0, lastLayout = -1;
      function pick() { return list[Math.floor(Math.random() * list.length)].src; }
      function shuffleBg() {
        var L; do { L = Math.floor(Math.random() * LAYOUTS.length); } while (L === lastLayout);
        lastLayout = L;
        bg.innerHTML = "";
        LAYOUTS[L].forEach(function (p) {
          var tile = makeImg(pick(), "collage-tile");
          tile.style.cssText = "left:" + p[0] * 100 + "%;top:" + p[1] * 100 + "%;width:" + p[2] * 100 + "%;height:" + p[3] * 100 + "%";
          bg.appendChild(tile);
        });
      }
      function showCard() {
        var c = list[k % list.length]; k++;
        card.querySelector(".collage-title").textContent = c.title || "";
        card.querySelector(".collage-img").src = c.src;
        if (c.url) card.href = c.url; else card.removeAttribute("href");
      }
      var bgEvery = reduceMotion ? 2000 : (beat.bgInterval || 520), cardEvery = reduceMotion ? 3000 : (beat.interval || 1600);
      shuffleBg(); showCard();
      (function loopBg() { later(function () { if (item.dead) return; shuffleBg(); loopBg(); }, bgEvery); })();
      (function loopCard() { later(function () { if (item.dead) return; showCard(); loopCard(); }, cardEvery); })();
      later(function () { playThen(beat, item); }, 0);
    },

    // LAPTOP — a realistic 3D laptop seen from above: the lid opens, the site scrolls down on the
    // screen (a long screenshot), then the lid closes again. Optional award ribbons on the screen.
    laptop: function (beat, x, y, diesAt) {
      var v = viewport(), B = bands();
      var H = v.h - B.t - B.b;
      var W = Math.min(v.w * (v.w > v.h ? (beat.share || 0.42) : 0.7), H * 0.75);   // laptop width
      var boxW = W * 1.45, boxH = W * 1.05;
      // the open lid rises above the box: reserve extra room on top
      var spot = clearSpot(boxW, boxH * 1.35, textRects(), { x: x, y: y }, 0.55);
      if (spot) spot.y += boxH * 0.17;
      if (!spot) { var fb = freeSpot(boxW, boxH, textRects()); spot = fb; }
      var sc = Math.min(1, spot.scale || 1); W *= sc; boxW *= sc; boxH *= sc;
      var D = W * 0.68;                                        // depth of the base = height of the lid
      var s = shell("laptop", 0);
      s.el.style.width = Math.round(boxW) + "px"; s.el.style.height = Math.round(boxH) + "px";
      s.el.style.setProperty("--W", W + "px"); s.el.style.setProperty("--D", D + "px");
      s.inner.innerHTML =
        '<div class="lt-rig">' +
          '<div class="lt-base"><div class="lt-keys"></div><div class="lt-pad"></div><div class="lt-front"></div></div>' +
          '<div class="lt-lid">' +
            '<div class="lt-shell"></div>' +
            '<div class="lt-display"><div class="lt-screen"><img class="lt-site" alt="" draggable="false"></div><div class="lt-ribbons"></div></div>' +
          '</div>' +
        '</div>';
      var img = s.inner.querySelector(".lt-site"), screen = s.inner.querySelector(".lt-screen");
      if (beat.profile) {                         // a simplified profile page drawn in HTML on the screen
        var P = beat.profile, html = '<div class="lp">' +
          '<div class="lp-head"><div class="lp-av">' + (P.avatar ? '<img src="' + P.avatar + '" alt="">' : (P.initials || "")) + '</div><div><div class="lp-name"></div><div class="lp-role"></div></div></div>' +
          '<div class="lp-stats">' + (P.stats || []).map(function (st) { return '<div><b>' + st[1] + '</b><span>' + st[0] + '</span></div>'; }).join("") + '</div>' +
          '<div class="lp-win"><div class="lp-grid" style="animation-duration:' + (P.scrollTime || 14) + 's">' +
            (P.covers || []).map(function (src) { return '<i style="background-image:url(&quot;' + src + '&quot;)"></i>'; }).join("") +
          '</div></div></div>';
        screen.innerHTML = html;
        screen.querySelector(".lp-name").textContent = P.name || "";
        screen.querySelector(".lp-role").textContent = P.role || "";
        screen.style.setProperty("--W", W + "px");
      } else img.src = beat.image;
      (beat.awards || []).forEach(function (a, i) {
        var r = document.createElement("span");
        r.className = "lt-ribbon"; r.textContent = a.label;
        r.style.background = a.bg; r.style.color = a.fg || "#FFFFFF";
        s.inner.querySelector(".lt-ribbons").appendChild(r);
      });
      s.el.setAttribute("role", "img");
      s.el.setAttribute("aria-label", beat.alt || "Laptop showing a website");
      var it = addItem(s.el, spot.x, spot.y, diesAt);
      var openAt = reduceMotion ? 0 : 400, openMs = reduceMotion ? 0 : 1300;
      var scrollMs = reduceMotion ? 0 : (beat.scrollTime || 6) * 1000;
      later(function () { s.el.classList.add("open"); }, openAt);
      if (beat.scroll === false) scrollMs = 0;
      later(function () {                                    // scroll the site to the bottom
        if (!scrollMs) return;                               // scroll: false → the site just sits there
        var travel = Math.max(0, img.offsetHeight - screen.clientHeight);
        img.style.transition = "transform " + scrollMs + "ms cubic-bezier(.45,0,.55,1)";
        img.style.transform = "translateY(" + (-travel) + "px)";
      }, openAt + openMs + 500);
      later(function () { s.el.classList.remove("open"); s.el.classList.add("closing"); },   // …and close it
            openAt + openMs + 500 + scrollMs + (beat.holdEnd || 900));
    },

    // FLICK — a neat pile of square photos; drag the top one away (or tap the pile) and it flies off
    flick: function (beat, x, y, diesAt) {
      var photos = beat.photos || [];
      var v = viewport(), B = bands();
      var w = mediaWidth(beat.size || "m", 1);
      var spot = clearSpot(w * 1.25, w * 1.25, textRects(), { x: v.w / 2, y: v.h / 2 }, 0.6) || { x: v.w / 2, y: (B.t + v.h - B.b) / 2, scale: 1 };
      w *= spot.scale || 1;
      var pile = [];
      photos.slice().reverse().forEach(function (spec, n) {      // the first photo ends up on top
        var s = shell("flick media", (Math.random() * 2 - 1) * 3);
        s.el.style.width = Math.round(w) + "px"; s.el.style.height = Math.round(w) + "px";
        if (spec.src) s.inner.appendChild(makeImg(spec.src, "pic")); else s.inner.style.background = spec.color || "#ddd";
        s.el.style.animationDelay = (n * 40) + "ms";
        var off = (photos.length - 1 - n) * 1.5;                   // a slightly offset pile
        var it = addItem(s.el, spot.x + off, spot.y + off, diesAt);
        it.flick = pile;
        it.onTap = function () {                                   // tap → the top photo flies away
          var top = pile[pile.length - 1];
          if (top) fling(top, (Math.random() < 0.5 ? -1 : 1) * 900, -200 - Math.random() * 300);
        };
        pile.push(it);
      });
      // it also goes by itself: one photo flies away every so often (the last one stays)
      (function auto() {
        later(function () {
          if (pile.length <= 1) return;
          var top = pile[pile.length - 1];
          if (!drag || drag.item !== top) fling(top, (Math.random() < 0.5 ? -1 : 1) * (700 + Math.random() * 400), (Math.random() * 2 - 1) * 400);
          auto();
        }, reduceMotion ? 2500 : (beat.interval || 1100));
      })();
    },

    // RECEIPT — a thermal-paper receipt that prints out; tap it and it crumples into a paper ball
    receipt: function (beat, x, y, diesAt) {
      var v = viewport(), B = bands();
      var text = beat.text || "", rows = text.replace(/\*\*/g, "").split("\n");
      var cols = rows.reduce(function (m, r) { return Math.max(m, Array.from(r).length); }, 0);
      // font size so the whole receipt fits the screen height (and width)
      var H = (v.h - B.t - B.b) * 0.92, W = v.w - EDGE * 2;
      var fs = Math.min(14, (H - 40) / (rows.length * 1.25), (W * (v.w > v.h ? 0.42 : 0.9) - 28) / (cols * 0.6));
      fs = Math.max(6, fs);
      var s = shell("receipt", beat.tilt != null ? beat.tilt : -3);
      var paper = document.createElement("pre");
      paper.className = "rc-paper";
      paper.style.fontSize = fs.toFixed(2) + "px";
      // a line wrapped in **…** is printed in bold
      text.split("\n").forEach(function (ln, i) {
        if (i) paper.appendChild(document.createTextNode("\n"));
        var m = ln.match(/^\*\*(.*)\*\*$/);
        if (m && m[1]) {                                   // the total: bigger, label left, amount right
          var b = document.createElement("b"); b.className = "rc-total";
          var parts = m[1].trim().split(/\s{2,}/);
          parts.forEach(function (p) { var sp = document.createElement("span"); sp.textContent = p; b.appendChild(sp); });
          paper.appendChild(b);
        }
        else if (/^ {3,}\S/.test(ln) && ln.trim().length < 26) {      // an indented line → centred
          var cl = document.createElement("span"); cl.className = "rc-center"; cl.textContent = ln.trim(); paper.appendChild(cl);
        }
        else paper.appendChild(document.createTextNode(ln));
      });
      s.inner.appendChild(paper);
      s.el.setAttribute("role", "img");
      s.el.setAttribute("aria-label", "Charity receipt: " + text.replace(/\*\*/g, "").replace(/[*\-]{4,}/g, " ").replace(/\s+/g, " ").trim());
      s.el.style.visibility = "hidden"; stage.appendChild(s.el);
      var w = s.el.offsetWidth, h = s.el.offsetHeight; s.el.remove(); s.el.style.visibility = "";
      var spot = clearSpot(w * 1.08, h * 1.02, textRects().concat(mediaRects()), { x: x, y: y }, 0.6) || freeSpot(w, h, textRects());
      if (spot.scale && spot.scale < 1) paper.style.fontSize = (fs * spot.scale).toFixed(2) + "px";
      var it = addItem(s.el, spot.x, spot.y, diesAt);
      // a little bin in the bottom corner, opposite the receipt
      var Bb = bands(), binW = 64, binX = spot.x < v.w / 2 ? v.w - binW - 18 : 18;
      var bin = document.createElement("div");
      bin.className = "rc-bin";
      bin.style.left = binX + "px"; bin.style.bottom = (Bb.b + 10) + "px";
      bin.innerHTML = '<svg viewBox="0 0 64 76" aria-hidden="true"><path d="M8 18h48l-5 52a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4z" fill="#FFFFFF" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M4 18h56M24 18v-6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6M24 30l2 34M32 30v34M40 30l-2 34" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>';
      bin.setAttribute("aria-hidden", "true");
      stage.appendChild(bin);
      var binItem = { el: bin, x: 0, y: 0, diesAt: diesAt, fixed: true };
      bin._item = binItem; bin.style.zIndex = ++z; live.push(binItem);
      it.bin = bin;
      it.onTap = function () { crumple(it); };                 // tap: crumples into a paper ball
      it.onDrop = function () {                                // dropped on the bin → in it goes
        if (!it.el.classList.contains("crumpled")) return;
        var a = it.el.getBoundingClientRect(), b = bin.getBoundingClientRect();
        if (a.right > b.left - 10 && a.left < b.right + 10 && a.bottom > b.top - 20 && a.top < b.bottom) toBin(it);
      };
    },

    // FLIPBOOK — an open magazine seen from above: it opens in a flash (no cover), then the
    // spreads flip by quickly, right page over to the left.
    flipbook: function (beat, x, y, diesAt) {
      var spreads = beat.spreads || [];
      if (!spreads.length) return;
      var v = viewport(), B = bands(), ratio = beat.ratio || 1.415;
      var H = v.h - B.t - B.b;
      var share = beat.share || 1;
      var w = Math.min(v.w * (v.w > v.h ? 0.62 : 0.94), H * 0.8 * ratio) * share, h = w / ratio;
      // a preferred side of the screen, so several magazines spread out
      var SIDES = { left: [0.22, 0.6], right: [0.78, 0.55], top: [0.6, 0.25], bottom: [0.45, 0.82], topleft: [0.25, 0.3], bottomright: [0.75, 0.8] };
      if (beat.side === "random") {                     // a side not used by another magazine right now
        var used = live.filter(function (it) { return !it.dead && it.side; }).map(function (it) { return it.side; });
        var free = Object.keys(SIDES).filter(function (k) { return used.indexOf(k) < 0; });
        beat._side2 = free[Math.floor(Math.random() * free.length)] || "left";
      }
      var sideKey = beat._side2 || beat.side;
      var pref = sideKey && SIDES[sideKey] ? { x: SIDES[sideKey][0] * v.w, y: B.t + SIDES[sideKey][1] * H } : { x: x, y: y };
      var avoid = textRects().concat(mediaRects());
      var spot = clearSpot(w * 1.06, h * 1.1, avoid, pref, 0.5)
              || clearSpot(w * 1.06, h * 1.1, avoid, pref, 0.3)
              || clearSpot(w * 1.06, h * 1.1, mediaRects(), pref, 0.3)      // at worst over a text, never over another magazine
              || { x: pref.x, y: pref.y, scale: 0.5 };
      if (isPhone() && (spot.scale || 1) < 0.8) {          // phones: big enough to see, at a side, over old texts if needed
        var ss = sideSpot(w, h, 0.04, beat.share && beat.share < 0.5 ? 0.42 : 0.6);
        if (ss) spot = ss;
      }
      if (spot.scale && spot.scale < 1) { w *= spot.scale; h = w / ratio; }
      var s = shell("flipbook media", beat.tilt != null ? beat.tilt : -2);
      s.el.style.width = Math.round(w) + "px"; s.el.style.height = Math.round(h) + "px";
      var L = document.createElement("div"), R = document.createElement("div");
      L.className = "fb-half fb-l"; R.className = "fb-half fb-r";
      s.inner.appendChild(L); s.inner.appendChild(R);
      var gutter = document.createElement("div"); gutter.className = "fb-gutter"; s.inner.appendChild(gutter);
      function bg(el, src, side) { el.style.backgroundImage = src ? 'url("' + src + '")' : "none"; el.style.backgroundPosition = side; }
      s.el.setAttribute("role", "img");
      s.el.setAttribute("aria-label", beat.alt || "Magazine pages flipping");
      var it = addItem(s.el, spot.x, spot.y, diesAt);
      it.side = sideKey; beat._side2 = null;
      var speed = reduceMotion ? 900 : (beat.flip || 230), pause = reduceMotion ? 900 : (beat.interval || 300);
      // a leaf turning: front = the old right page, back = the new left page
      function turn(fromSrc, toSrc, plainFront, done) {
        var leaf = document.createElement("div"); leaf.className = "fb-leaf";
        leaf.style.animationDuration = speed + "ms";
        leaf.style.setProperty("--fbd", speed + "ms");
        R.style.setProperty("--fbd", speed + "ms");
        R.classList.remove("under"); void R.offsetWidth; R.classList.add("under");
        var f = document.createElement("div"), k = document.createElement("div");
        f.className = "fb-face fb-front" + (plainFront ? " plain" : ""); k.className = "fb-face fb-back";
        if (!plainFront) bg(f, fromSrc, "right center");
        bg(k, toSrc, "left center");
        leaf.appendChild(f); leaf.appendChild(k); s.inner.appendChild(leaf);
        bg(R, toSrc, "right center");                      // the new right page is underneath
        later(function () { bg(L, toSrc, "left center"); leaf.remove(); done && done(); }, speed);
      }
      // opens: a plain cover flips open onto the first spread
      L.classList.add("blank"); bg(L, null);
      var i = 0;
      later(function () {
        L.classList.remove("blank");
        turn(null, spreads[0], true, function () {
          (function next() {
            if (it.dead) return;
            i++;
            if (i >= spreads.length) { if (beat.loop) i = 0; else return; }
            later(function () { if (!it.dead) turn(spreads[i - 1 < 0 ? spreads.length - 1 : i - 1], spreads[i], false, next); }, pause);
          })();
        });
      }, 450);
    },

    // LANYARD — an ID card on a lanyard swings in from the left, sweeping across the screen,
    // and settles hanging from the top. Tap it and it swings again.
    lanyard: function (beat, x, y, diesAt) {
      var v = viewport(), B = bands();
      var H = v.h - B.t - B.b, portrait = v.h > v.w;
      var cw = Math.min(portrait ? v.w * 0.62 : v.w * 0.24, 340);
      var ch = cw / (beat.ratio || 1.66);
      var strap = (portrait ? H * 0.22 : H * 0.34);
      var px = v.w * (portrait ? 0.5 : (beat.x || 0.7));
      var el = document.createElement("div");
      el.className = "lanyard";
      el.style.left = px + "px"; el.style.top = B.t + "px";
      el.style.setProperty("--cw", cw + "px"); el.style.setProperty("--strap", strap + "px");
      el.innerHTML = '<div class="ly-swing"><div class="ly-strap"></div><div class="ly-clip"><i></i></div>' +
                     '<div class="ly-card"><img alt="" draggable="false"></div></div>';
      el.querySelector("img").src = beat.src;
      el.setAttribute("role", "img"); el.setAttribute("aria-label", beat.alt || "ID card on a lanyard");
      stage.appendChild(el);
      var item = { el: el, x: 0, y: 0, diesAt: diesAt, fixed: true };
      el._item = item; el.style.zIndex = ++z; live.push(item);
      var sw = el.querySelector(".ly-swing");
      // where the card ends up at rest (not where it is mid-swing)
      item.obstacle = function () {
        return { l: px - cw / 2 - 12, t: B.t, r: px + cw / 2 + 12, b: B.t + strap + cw * 0.13 + ch + 16 };
      };
      item.leave = function () {                 // swings back out to the left, then goes
        sw.classList.remove("swing", "nudge"); sw.classList.add("out");
      };
      // tap → swing again
      el.addEventListener("pointerdown", function (e) {
        e.stopPropagation();
        sw.classList.remove("swing", "nudge"); void sw.offsetWidth; sw.classList.add("nudge");
      });
      sw.classList.add("swing");
    },

    // MAILICON — a little envelope pops up; tap it to write an email
    mailicon: function (beat, x, y, diesAt) {
      // pixel grid: . empty, o outline, p paper, f flap, h heart, w wing, s wing shade
      var G = [
        "os.................so",
        "oss...............sso",
        ".osss.ooooooooo.ssso.",
        "..ossooqqqqqqqoosso..",
        "...osopfpppppfposo...",
        "....ooppfkphfppoo....",
        ".....opphhhhhppod....",
        ".....oppphhhpppod....",
        ".....opppphppppod....",
        ".....ooeeeeeeeood....",
        "......ooooooooodd....",
        ".......ddddddddd....."
      ];
      var COL = { o: "#2A1A5E", p: "#FFF6E8", q: "#FFFFFF", e: "#EADFCB", f: "#D9C9B0", h: "#FF5500", k: "#FFB27A", s: "#CBB8FF", d: "rgba(42,26,94,.18)" };
      var cell = 6, rects = "", wingL = "", wingR = "";
      G.forEach(function (row, y) {
        row.split("").forEach(function (ch, x) {
          if (!COL[ch]) return;
          var r = '<rect x="' + x * cell + '" y="' + y * cell + '" width="' + cell + '" height="' + cell + '" fill="' + COL[ch] + '"/>';
          if (ch !== "d" && x < 5) wingL += r; else if (ch !== "d" && x > 15) wingR += r;
          else rects += r;
        });
      });
      var W = 21 * cell, H = G.length * cell;
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges" aria-hidden="true">' +
                '<g class="mi-wing mi-wl">' + wingL + '</g><g class="mi-wing mi-wr">' + wingR + '</g>' + rects + '</svg>';
      var s = shell("mailicon", 0);
      var a = document.createElement("a");
      a.className = "mi-link";
      a.href = "mailto:" + beat.email + (beat.subject ? "?subject=" + encodeURIComponent(beat.subject) : "");
      a.setAttribute("aria-label", "Write an email to " + beat.email);
      a.innerHTML = svg + '<span class="mi-note">write me!</span>';
      s.inner.appendChild(a);
      a.addEventListener("click", function () { s.el.classList.add("flyaway"); });
      var vv = viewport(), spot = clearSpot(200, 170, textRects().concat(mediaRects()), { x: vv.w * 0.7, y: vv.h * 0.55 }, 0.8) || { x: x, y: y };
      addItem(s.el, spot.x, spot.y, diesAt);
    },

    // AUDIOCARD — a photo with a mini audio player under it (time, progress bar, controls)
    audiocard: function (beat, x, y, diesAt) {
      var w = Math.round(mediaWidth(beat.size || "m", beat.ratio || 0.62, beat.scale) * (beat._fit || 1));
      var s = shell("audiocard media", beat.tilt != null ? beat.tilt : -2);
      s.el.style.width = w + "px";
      s.inner.innerHTML =
        '<img class="ac-photo" alt="" draggable="false">' +
        '<div class="ac-player">' +
          '<div class="ac-row"><span class="ac-now">0:00</span><span class="ac-bar"><i></i><b></b></span><span class="ac-left">-0:00</span></div>' +
          '<div class="ac-row ac-ctrl">' +
            '<button class="ac-btn ac-vol" type="button" aria-label="Mute"><svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
            '<span class="ac-dots">···</span>' +
            '<button class="ac-btn ac-rw" type="button" aria-label="Back 5 seconds"><svg viewBox="0 0 24 24"><path d="M11 6v12l-8-6zM21 6v12l-8-6z"/></svg></button>' +
            '<button class="ac-btn ac-play" type="button" aria-label="Play or pause"><svg class="i-pause" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg><svg class="i-play" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg></button>' +
            '<button class="ac-btn ac-ff" type="button" aria-label="Forward 5 seconds"><svg viewBox="0 0 24 24"><path d="M3 6v12l8-6zM13 6v12l8-6z"/></svg></button>' +
            '<span class="ac-sp"></span>' +
          '</div>' +
        '</div>';
      var img = s.inner.querySelector(".ac-photo"); img.src = beat.src;
      img.style.aspectRatio = String(beat.photoRatio || 0.8);   // known height before the image loads (placement)
      var au = new Audio(beat.audio); au.preload = "auto";
      var start = beat.startAt || 0;
      var now = s.inner.querySelector(".ac-now"), left = s.inner.querySelector(".ac-left");
      var fill = s.inner.querySelector(".ac-bar i"), knob = s.inner.querySelector(".ac-bar b");
      function fmt(t) { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ":" + ("0" + t % 60).slice(-2); }
      function draw() {
        var d = au.duration || 0, t = au.currentTime || 0, p = d ? t / d : 0;
        now.textContent = fmt(t); left.textContent = "-" + fmt(d - t);
        fill.style.width = (p * 100) + "%"; knob.style.left = (p * 100) + "%";
        s.el.classList.toggle("playing", !au.paused);
      }
      ["timeupdate", "play", "pause", "loadedmetadata", "ended"].forEach(function (ev) { au.addEventListener(ev, draw); });
      au.addEventListener("ended", function () { au.currentTime = start; draw(); });
      var raf; (function tick() { if (!au.paused) draw(); raf = requestAnimationFrame(tick); })();
      function play() { au.play().then(function () { s.el.classList.remove("needs-tap"); }).catch(function () { s.el.classList.add("needs-tap"); }); }
      s.inner.querySelector(".ac-play").addEventListener("click", function (e) { e.stopPropagation(); if (au.paused) play(); else au.pause(); });
      s.inner.querySelector(".ac-rw").addEventListener("click", function (e) { e.stopPropagation(); au.currentTime = Math.max(start, au.currentTime - 5); draw(); });
      s.inner.querySelector(".ac-ff").addEventListener("click", function (e) { e.stopPropagation(); au.currentTime = Math.min((au.duration || 0) - 0.1, au.currentTime + 5); draw(); });
      var vol = s.inner.querySelector(".ac-vol");
      vol.addEventListener("click", function (e) { e.stopPropagation(); au.muted = !au.muted; vol.classList.toggle("off", au.muted); });
      s.inner.querySelectorAll(".ac-btn").forEach(function (bt) { bt.addEventListener("pointerdown", function (e) { e.stopPropagation(); }); });
      s.el.setAttribute("aria-label", beat.alt || "Photo with audio");
      var it = addItem(s.el, x, y, diesAt);
      if (beat._bleed) { it.bleed = true; place(it, x - s.el.offsetWidth / 2, y - s.el.offsetHeight / 2); }
      it.onRemove = function () { au.pause(); cancelAnimationFrame(raf); };
      au.addEventListener("loadedmetadata", function () { au.currentTime = start; draw(); }, { once: true });
      try { au.currentTime = start; } catch (e) {}
      play();
    },

    // BURGERBOX — the real BUN × Ronin box in 3D (faces cut from the dieline): it drops in,
    // the lid swings open and a burger pops out and bobs. Tap it: the burger jumps again.
    burgerbox: function (beat, x, y, diesAt) {
      var v = viewport(), B = bands(), F = beat.faces || {};
      var L = Math.min(v.w * (v.w > v.h ? 0.28 : 0.58), 340) * (beat.scale || 1);
      var D = L * (beat.depth || 0.711), H = L * (beat.height || 0.395);
      var boxW = L * 1.35, boxH = L * 1.45;
      var spot = beat._spot || clearSpot(boxW, boxH, textRects().concat(mediaRects()), { x: x, y: y }, 0.6) || { x: x, y: y, scale: 1 };
      var k = Math.min(1, spot.scale || 1); L *= k; D *= k; H *= k; boxW *= k; boxH *= k;
      var s = shell("burgerbox media", 0);
      s.el.style.width = Math.round(boxW) + "px"; s.el.style.height = Math.round(boxH) + "px";
      s.el.style.setProperty("--L", L + "px"); s.el.style.setProperty("--D", D + "px"); s.el.style.setProperty("--H", H + "px");
      function face(cls, src) { return '<div class="bb-f ' + cls + '"' + (src ? ' style="background-image:url(&quot;' + src + '&quot;)"' : "") + '></div>'; }
      var burger =
        '<svg class="bb-burger" viewBox="0 0 200 150" aria-hidden="true">' +
          '<path d="M18 78c0-40 36-66 82-66s82 26 82 66z" fill="#F2A541" stroke="#1B1B1B" stroke-width="5" stroke-linejoin="round"/>' +
          '<g fill="#FFF3C4"><ellipse cx="70" cy="40" rx="5" ry="2.6" transform="rotate(-20 70 40)"/><ellipse cx="102" cy="30" rx="5" ry="2.6"/><ellipse cx="132" cy="42" rx="5" ry="2.6" transform="rotate(20 132 42)"/><ellipse cx="88" cy="56" rx="5" ry="2.6" transform="rotate(-10 88 56)"/><ellipse cx="118" cy="58" rx="5" ry="2.6" transform="rotate(12 118 58)"/></g>' +
          '<path d="M10 84c12-10 22 6 34-4s22 8 34-2 22 8 34-2 22 8 34-2 22 6 34 2v10H10z" fill="#7BC043" stroke="#1B1B1B" stroke-width="5" stroke-linejoin="round"/>' +
          '<path d="M16 96h168l-8 12H24z" fill="#FFD23F" stroke="#1B1B1B" stroke-width="5" stroke-linejoin="round"/>' +
          '<rect x="14" y="104" width="172" height="20" rx="10" fill="#8B4A2B" stroke="#1B1B1B" stroke-width="5"/>' +
          '<path d="M20 124h160c0 14-30 22-80 22s-80-8-80-22z" fill="#F2A541" stroke="#1B1B1B" stroke-width="5" stroke-linejoin="round"/>' +
        '</svg>';
      s.inner.innerHTML =
        '<div class="bb-scene"><div class="bb-box">' +
          face("bb-bottom", F.bottom) + face("bb-front", F.front) + face("bb-back", F.back) +
          face("bb-left", F.left) + face("bb-right", F.right) + face("bb-inner") +
          '<div class="bb-pop">' + burger + '</div>' +
          '<div class="bb-lid"><div class="bb-hinge">' + face("bb-top", F.top) + face("bb-lidin") + '</div></div>' +
        '</div></div>';
      s.el.setAttribute("role", "img");
      s.el.setAttribute("aria-label", beat.alt || "Burger box opening, a burger pops out");
      var it = addItem(s.el, spot.x, spot.y, diesAt);
      var pop = s.inner.querySelector(".bb-pop");
      later(function () { s.el.classList.add("open"); }, reduceMotion ? 0 : 900);
      it.onTap = function () { pop.classList.remove("jump"); void pop.offsetWidth; pop.classList.add("jump"); };
      return it;
    },

    // DECK — cards dealt from a point (x, y), fanning out in the free space nearby
    deck: function (beat, x, y, diesAt) {
      var cards = beat.cards || [];
      if (!cards.length) return;
      var n = cards.length, size = beat.size || "s";
      var r0 = cards[0].ratio || 1;
      var cw = mediaWidth(size, r0), ch = cw / r0;
      var phoneK = isPhone() ? 0.5 : 1;                         // phones: a smaller fan, room for the rest
      cw *= phoneK; ch = cw / r0;
      var offs = cw * (beat.fan != null ? beat.fan : 0.42);        // horizontal offset per card
      var bw = (cw + offs * (n - 1)) * 1.08, bh = ch * 1.22;     // room for the tilted cards
      var spot = clearSpot(bw, bh, textRects().concat(mediaRects()), { x: x, y: y }, isPhone() ? 0.7 : 0.3);
      if (!spot && isPhone()) spot = sideSpot(bw, bh, 0.05, 0.72);
      if (!spot) { var fb = freeSpot(bw, bh, textRects()); spot = { x: fb.x, y: fb.y, scale: Math.min(fb.scale, 0.6) }; }
      var sc = spot.scale, origin = { x: x, y: y };
      var gap = reduceMotion ? 0 : (beat.interval || 130);
      cards.forEach(function (spec, k) {
        later(function () {
          if (step >= diesAt) return;
          var mid = (n - 1) / 2, rel = k - mid;
          var tilt = spec.tilt != null ? spec.tilt : rel * (beat.spread || 7);
          var el = buildMedia(Object.assign({ _fit: sc * phoneK }, spec), "image", size, tilt);
          el.classList.add("card", "dealt");
          // centre of this card in the fan
          var cx = spot.x + rel * offs * sc, cy = spot.y + Math.abs(rel) * ch * 0.05 * sc;
          var it = addItem(el, cx, cy, diesAt);
          // fly in from the link
          el.style.setProperty("--fx", (origin.x - (it.x + el.offsetWidth / 2)) + "px");
          el.style.setProperty("--fy", (origin.y - (it.y + el.offsetHeight / 2)) + "px");
        }, k * gap);
      });
    },

    // MARQUEE — one word/phrase in the site font, stretched to the full screen height,
    // scrolling sideways forever. Taps go straight through it.
    marquee: function (beat, x, y, diesAt) {
      var el = document.createElement("div");
      el.className = "marquee";
      if (beat.color) el.classList.add("color-" + beat.color);
      var span = document.createElement("span");
      el.appendChild(span);
      stage.appendChild(el);
      var v = viewport();
      var stretch = (beat.stretch || 3.2) * (v.h > v.w ? 1.6 : 1);   // tall phone screens: even taller, narrower letters
      span.style.fontSize = (v.h / (0.72 * stretch)) * 0.96 + "px";   // capitals fill the height
      span.style.setProperty("--sy", stretch);
      // one endless line: "SPOILER ALERT SPOILER ALERT …" — measure one phrase (+ its space), repeat it
      var phrase = (beat.text || "") + "\u00a0";
      span.textContent = phrase;
      var unit = span.getBoundingClientRect().width, speed = beat.speed || 650;   // px per second
      var copies = Math.ceil((v.w * 2) / Math.max(1, unit)) + 2;
      span.textContent = new Array(copies + 1).join(phrase);
      var dir = beat.direction === "right" ? 1 : -1;
      span.style.setProperty("--from", (dir < 0 ? 0 : -unit) + "px");
      span.style.setProperty("--to", (dir < 0 ? -unit : 0) + "px");
      span.style.animationDuration = unit / speed + "s";   // one phrase per cycle → no seam
      var tw = unit;
      var item = { el: el, x: 0, y: 0, diesAt: diesAt, fixed: true };
      el._item = item;
      el.style.zIndex = ++z;
      live.push(item);
      // "then" starts when the whole phrase has come into view
      later(function () { playThen(beat, item); }, reduceMotion ? 300 : (tw / speed) * 1000);
    },

    // CODE — a column of text streaming line by line like code; it scrolls by itself.
    // Half the screen on wide screens (on the side away from the chat), full screen on phones,
    // always BEHIND the other things. Taps go through it.
    code: function (beat, x, y, diesAt) {
      var v = viewport(), wide = v.w > v.h && v.w > 700;
      var col = document.createElement("div");
      col.className = "codecol" + (wide ? " half" : " full");
      if (wide) {
        // the half of the screen with the least stuff on it (texts + chat)
        var load = { left: 0, right: 0 };
        textRects().forEach(function (r) {
          var a = (r.r - r.l) * (r.b - r.t), cx = (r.l + r.r) / 2;
          load[cx < v.w / 2 ? "left" : "right"] += a;
        });
        col.classList.add(load.left <= load.right ? "left" : "right");
      }
      var feed = document.createElement("div");
      feed.className = "codefeed";
      col.appendChild(feed);
      stage.appendChild(col);
      col.style.zIndex = 0;
      var item = { el: col, x: 0, y: 0, diesAt: diesAt, fixed: true };
      if (wide) item.obstacle = function () { var r = col.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      col._item = item;
      // texts that would sit on top of the code (unreadable) bow out; the chat stays
      var cr = col.getBoundingClientRect();
      if (beat.faint) col.classList.add("faint");
      live.slice().forEach(function (it) {
        if (beat.keepTexts) return;                        // keepTexts: the list runs behind the texts
        if (!it.el.classList.contains("text")) return;
        var r = it.el.getBoundingClientRect();
        if (r.left < cr.right && r.right > cr.left && r.top < cr.bottom && r.bottom > cr.top) removeItem(it);
      });
      live.push(item);

      var lines = beat.lines || [], speed = reduceMotion ? 0 : (beat.speed || 120), at = step;
      // "accel": the first lines at reading pace, then faster and faster, all done in about total ms
      var times = lines.map(function (_, n) { return n * speed; });
      if (beat.accel && !reduceMotion) {
        var A = beat.accel, after = A.after || 9, slow = A.slow || 420, total = A.total || 8000;
        var rest = Math.max(0, total - after * slow), k = lines.length - after, t = 0, acc = [];
        for (var q = 0; q < k; q++) acc.push(1 - q / Math.max(1, k));      // shrinking gaps
        var sum = acc.reduce(function (p, n) { return p + n; }, 0) || 1;
        times = lines.map(function (_, n) {
          if (n <= after) { t = n * slow; return t; }
          t += rest * acc[n - after - 1] / sum; return t;
        });
      }
      lines.forEach(function (line, n) {
        later(function () {
          if (item.dead) return;
          var el = document.createElement("div");
          if (line.indexOf("## ") === 0) { el.className = "c-head"; el.textContent = "// " + line.slice(3); }
          else {
            var m = line.match(/^(\d{4})\s+(.*)$/);
            if (m) { el.innerHTML = '<span class="c-year"></span> '; el.firstChild.textContent = m[1]; el.appendChild(document.createTextNode(m[2])); }
            else el.textContent = line;
          }
          feed.appendChild(el);
          // new lines come in at the BOTTOM and push the others up (from the very first line)
          feed.style.transform = "translateY(" + (col.clientHeight - feed.scrollHeight) + "px)";
          var cue = beat.cues && beat.cues[n];
          if (cue) {
            var f = cue.free ? freeSpotFor(cue) : { x: x, y: y };
            playBeat(cue, f.x, f.y, at);
          }
        }, times[n]);
      });
    },

    // BOOK — a real 3D book (front, back, spine, page edges) that spins in, then sways
    book: function (beat, x, y, diesAt) {
      var ratio = beat.ratio || 0.7;
      var w = Math.round(mediaWidth(beat.size || "s", ratio, beat.scale) * (beat._fit || 1)), h = Math.round(w / ratio);
      var d = Math.max(6, Math.round(w * (beat.depth || 0.09)));
      var s = shell("book media", beat.tilt != null ? beat.tilt : 0);
      s.el.style.width = w + "px"; s.el.style.height = h + "px";
      s.el.style.setProperty("--w", w + "px"); s.el.style.setProperty("--h", h + "px"); s.el.style.setProperty("--d", d + "px");
      s.el.style.setProperty("--spine", beat.spine || "#7a5533");
      s.el.style.setProperty("--rest", (beat.rest != null ? beat.rest : -28) + "deg");
      var b = document.createElement("div");
      b.className = "book3d";
      b.innerHTML = '<div class="bf front"></div><div class="bf back"></div><div class="bf spine"></div>' +
                    '<div class="bf pages-r"></div><div class="bf pages-t"></div><div class="bf pages-b"></div>';
      b.querySelector(".front").appendChild(makeImg(beat.front, "cover"));
      b.querySelector(".back").appendChild(makeImg(beat.back || beat.front, "cover"));
      s.inner.appendChild(b);
      var yr = null;
      if (beat.year) {                       // publication year above the book
        yr = document.createElement("span");
        yr.className = "book-year";
        yr.textContent = beat.year;
        s.el.appendChild(yr);
      }
      s.el.setAttribute("role", "img");
      s.el.setAttribute("aria-label", beat.alt || "Book");
      addItem(s.el, x, y, diesAt);
      if (yr) requestAnimationFrame(function () { nudgeYear(yr, s.el); });
    },

    // message bubbles that appear one by one, with "typing…" dots
    chat: function (beat, x, y, diesAt) {
      var s = shell("chat", beat.tilt != null ? beat.tilt : randomTilt() * 0.5);
      if (beat.title) {
        var head = document.createElement("div");
        head.className = "chat-title";
        head.textContent = beat.title;
        s.inner.appendChild(head);
      }
      var list = document.createElement("div");
      list.className = "chat-list";
      s.inner.appendChild(list);
      var anchorAt;
      if (beat.free) {
        // measure the finished conversation, then reserve a free spot for it
        (beat.messages || []).forEach(function (m) {
          var b = document.createElement("div");
          b.className = "bubble " + (m.from === "me" ? "me" : m.from === "note" ? "note" : "them");
          b.textContent = m.text || "";
          list.appendChild(b);
        });
        s.el.style.visibility = "hidden"; stage.appendChild(s.el);
        var cw = s.el.offsetWidth, chh = s.el.offsetHeight;
        s.el.remove(); s.el.style.visibility = ""; list.innerHTML = "";
        var spot = clearSpot(cw, chh, textRects().concat(mediaRects()), { x: x, y: y }, 1);
        if (spot) { x = spot.x - cw / 2; y = spot.y - chh / 2; anchorAt = "topleft"; }
      }
      var item = addItem(s.el, x, y, diesAt, anchorAt);

      var msgs = beat.messages || [];
      var t = reduceMotion ? 0 : 300;
      msgs.forEach(function (m) {
        var side = m.from === "me" ? "me" : m.from === "note" ? "note" : "them";
        var typing = reduceMotion || side === "note" ? 0 : (m.typing != null ? m.typing : CHAT_TYPING);

        // 1. typing dots
        later(function () {
          if (item.dead) return;
          var dots = document.createElement("div");
          dots.className = "bubble " + side + " dots";
          dots.innerHTML = "<i></i><i></i><i></i>";
          list.appendChild(dots);
          refit(item);
          // 2. swap dots for the message
          later(function () {
            if (item.dead) return;
            dots.classList.remove("dots");
            dots.textContent = m.text || "";
            refit(item);
          }, typing);
        }, t);

        t += typing + (reduceMotion ? 0 : (m.pause != null ? m.pause : CHAT_PAUSE));
      });
    }
  };

  // ======================================================================
  // Reveal / disappear
  // ======================================================================
  function popupOpen() {
    var m = document.getElementById("midalert"), v = document.getElementById("viewer");
    return (m && !m.hidden) || (v && !v.hidden);
  }
  function reveal(x, y) {
    if (popupOpen()) return;
    if (step >= STORY.length) { nudgeProgress(); return; }

    var beat = STORY[step];

    // a hanging card swings away first, then the page moves on
    if (beat.clear && !FAST) {
      var ly = live.filter(function (it) { return !it.dead && it.leave && !it.left; })[0];
      if (ly) { ly.left = true; ly.leave(); setTimeout(function () { reveal(x, y); }, reduceMotion ? 0 : 750); return; }
    }

    // a receipt on screen crumples into a ball first, then the page moves on
    if (beat.clear && !FAST) {
      var rc = live.filter(function (it) { return !it.dead && it.el.classList.contains("receipt"); })[0];
      if (rc) {                                              // crumple (if needed), into the bin, then move on
        var wasFlat = !rc.el.classList.contains("crumpled");
        if (wasFlat) crumple(rc);
        setTimeout(function () { toBin(rc, function () { setTimeout(function () { reveal(x, y); }, 150); }); }, wasFlat && !reduceMotion ? 700 : 0);
        return;
      }
    }
    taps[step] = { x: x, y: y };

    // "bg": change the whole background colour (stays until another bg or restart)
    if (beat.bg) setBg(beat.bg);

    // "wipe": a white panel sweeps left → right over everything, then the old things go
    if (beat.wipe && !FAST) {
      var old = live.slice(), Bw = bands();
      timers.forEach(clearTimeout); timers = [];
      var panel = document.createElement("div");
      panel.className = "wipe-panel";
      panel.style.top = Bw.t + "px"; panel.style.bottom = Bw.b + "px";
      panel.style.zIndex = ++z;
      panel.style.animationDuration = (beat.wipeMs || 650) + "ms";
      stage.appendChild(panel);
      setTimeout(function () {
        old.forEach(function (it) { if (!it.dead) { it.dead = true; it.el.remove(); var k = live.indexOf(it); if (k >= 0) live.splice(k, 1); } });
        panel.remove();
      }, (beat.wipeMs || 650) + 40);
    } else if (beat.wipe) { live.slice().forEach(function (it) { removeItem(it); }); timers.forEach(clearTimeout); timers = []; }

    // "clear": wipe the screen (intro included) before this beat
    if (beat.clear) {
      live.slice().forEach(function (it) { removeItem(it); });
      timers.forEach(clearTimeout);
      timers = [];
    }

    var anchorMain;
    if (beat.free && beat.type === "text") {
      // a text in the free space: measure its final size, find room around everything
      var fsz = finalSize(beat);
      var spot = clearSpot(fsz.w, fsz.h, textRects().concat(mediaRects()), { x: x, y: y }, 1)
              || freeSpot(fsz.w, fsz.h, textRects());
      x = spot.x - fsz.w / 2; y = spot.y - fsz.h / 2; anchorMain = "topleft";
    } else if (beat.free) { var fm = freeSpotFor(beat); x = fm.x; y = fm.y; } // keep clear of the texts
    playBeat(beat, x, y, step, anchorMain);
    var main = live[live.length - 1];

    // extra things that come with the same tap ("also"):
    //   below/above → stuck to the main item; otherwise offset from the tap
    var v = viewport(), unit = Math.min(v.w, v.h);
    // alsoShuffle: the "also" items from index `from` on come one at a time, in a random order
    var alsoList = (beat.also || []).slice();
    if (beat.alsoShuffle) {
      var S = beat.alsoShuffle, tail = alsoList.slice(S.from || 0);
      for (var q = tail.length - 1; q > 0; q--) { var r = Math.floor(Math.random() * (q + 1)), t = tail[q]; tail[q] = tail[r]; tail[r] = t; }
      alsoList = alsoList.slice(0, S.from || 0).concat(tail.map(function (e, n) {
        return Object.assign({}, e, { delay: (S.start || 1000) + n * (S.gap || 1400) });
      }));
    }
    alsoList.forEach(function (extra) {
      var off = extra.offset || [0, 0];
      var at = step;
      later(function () {
        if (extra.free) {
          var f1 = freeSpotFor(extra);
          playBeat(extra, f1.x, f1.y, at);
        } else if (extra.at) {
          playBeat(extra, extra.at[0] * v.w, extra.at[1] * v.h, at);
        } else if ((extra.below || extra.above) && main && !main.dead) {
          playBeat(extra, 0, 0, at, {
            mode: extra.above ? "above" : "below", ref: main, gap: extra.gap,
            dx: (extra.shift || 0) * unit
          });
        } else {
          playBeat(extra, x + off[0] * unit, y + off[1] * unit, at);
        }
      }, reduceMotion ? 0 : (extra.delay || 0));
    });

    step++;
    updateProgress();
    trackStep();
    preloadAhead();
    expire();
  }

  // ---------------------------------------------------------------------
  // FREE SPACE — so photos/videos never land on top of the texts.
  // Texts that are still typing count with their FINAL size.
  // ---------------------------------------------------------------------
  function finalSize(beat) {
    var s = buildText(Object.assign({}, beat, { typing: false, words: false, lines: false }));
    s.el.style.visibility = "hidden";
    stage.appendChild(s.el);
    var size = { w: s.el.offsetWidth, h: s.el.offsetHeight };
    s.el.remove();
    return size;
  }

  function textRects(skipChat) {
    var extra = live.filter(function (it) { return it.obstacle && !it.dead; }).map(function (it) { return it.obstacle(); });
    return extra.concat(live.filter(function (it) {
      return (it.el.classList.contains("text") || (!skipChat && it.el.classList.contains("chat"))) && !it.dead;
    }).map(function (it) {
      var w = Math.max(it.el.offsetWidth, it.fw || 0), h = Math.max(it.el.offsetHeight, it.fh || 0);
      return { l: it.x, t: it.y, r: it.x + w, b: it.y + h };
    }));
  }

  // the roomiest area around the texts that fits a w×h box: returns centre, scale, side
  function freeSpot(w, h, rects) {
    var v = viewport(), g = 16, BB = bands();
    if (!rects.length) return { x: v.w / 2, y: v.h / 2, scale: 1, side: "below" };
    var U = rects.reduce(function (a, r) {
      return { l: Math.min(a.l, r.l), t: Math.min(a.t, r.t), r: Math.max(a.r, r.r), b: Math.max(a.b, r.b) };
    });
    var areas = [
      { side: "below", l: EDGE, t: U.b + g, r: v.w - EDGE, b: v.h - BB.b - 4 },
      { side: "above", l: EDGE, t: BB.t + 4, r: v.w - EDGE, b: U.t - g },
      { side: "right", l: U.r + g, t: BB.t + 4, r: v.w - EDGE, b: v.h - BB.b - 4 },
      { side: "left",  l: EDGE, t: BB.t + 4, r: U.l - g, b: v.h - BB.b - 4 }
    ];
    var best = null;
    areas.forEach(function (a) {
      var aw = a.r - a.l, ah = a.b - a.t;
      if (aw <= 40 || ah <= 40) return;
      var sc = Math.min(1, aw / w, ah / h);
      if (!best || sc > best.scale + 0.001) best = { x: (a.l + a.r) / 2, y: (a.t + a.b) / 2, scale: sc, side: a.side };
    });
    return best || { x: v.w / 2, y: v.h / 2, scale: 1, side: "below" };
  }

  // "then": beats that start by themselves when a typed text has finished
  function playThen(beat, item) {
    var atNow = step;
    (beat.then || []).forEach(function (next) {
      if (next.advance) {
        // go on to the next beat by itself, unless the visitor already tapped on
        later(function () {
          if (step !== atNow) return;
          var v0 = viewport();
          reveal(v0.w / 2, v0.h / 2);
        }, reduceMotion ? 300 : (next.delay || 0));
        return;
      }
      later(function () {
        if (item.dead) return;
        var v = viewport(), unit = Math.min(v.w, v.h), x, y;
        if (next.below) { playBeat(next, 0, 0, step - 1, { mode: "below", ref: item, gap: next.gap }); return; }
        var nd = next.near === "deck" && nearDeckSpot(next);
        if (nd) { x = nd.x; y = nd.y; }
        else if (next.free) { var f0 = freeSpotFor(next); x = f0.x; y = f0.y; }
        else if (next.at) { x = next.at[0] * v.w; y = next.at[1] * v.h; }   // share of the screen
        else {                                                          // just below the text
          x = item.x + item.el.offsetWidth / 2;
          y = item.y + item.el.offsetHeight + unit * 0.35;
        }
        playBeat(next, x, y, step - 1); // counts as part of the tap that started it
      }, reduceMotion ? 0 : (next.delay || 0));
    });
  }

  function mediaRects() {
    return live.filter(function (it) {
      return it.el.classList.contains("media") && !it.dead;
    }).map(function (it) {
      var r = { l: it.x, t: it.y, r: it.x + it.el.offsetWidth, b: it.y + it.el.offsetHeight };
      var y = it.el.querySelector(".book-year");           // a book's year sits above it
      if (y) {
        var yr = y.getBoundingClientRect();
        r = { l: Math.min(r.l, yr.left), t: Math.min(r.t, yr.top), r: Math.max(r.r, yr.right), b: r.b };
      }
      return r;
    });
  }

  // avoid EVERYTHING on screen: scan the screen for the biggest size that fits
  // without touching any text or photo (falls back to the text-only method)
  // pref = the point it would like to be near (the tap, or the screen centre);
  // minScale = 1 for texts (they never shrink)
  function clearSpot(w, h, rects, pref, minScale) {
    var v = viewport(), m = 12, B = bands(), top = B.t + 4;
    v = { w: v.w, h: v.h - B.b + EDGE - 4 };      // stay above the bottom band
    pref = pref || { x: v.w / 2, y: v.h / 2 };
    for (var sc = 1; sc >= (minScale || 0.4) - 0.001; sc -= 0.05) {
      var bw = w * sc, bh = h * sc, best = null, bestD = Infinity;
      for (var y = top; y + bh <= v.h - EDGE; y += 12) {
        for (var x = EDGE; x + bw <= v.w - EDGE; x += 12) {
          var hit = rects.some(function (r) {
            return x < r.r + m && x + bw > r.l - m && y < r.b + m && y + bh > r.t - m;
          });
          if (hit) continue;
          var cx = x + bw / 2, cy = y + bh / 2;
          var d = (cx - pref.x) * (cx - pref.x) + (cy - pref.y) * (cy - pref.y);
          if (d < bestD) { bestD = d; best = { x: cx, y: cy, scale: sc, side: "below" }; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // keep a book's year label on screen and off the CV column / texts
  function nudgeYear(yr, el) {
    var r = yr.getBoundingClientRect(), vw = viewport().w, dx = 0;
    var self = el.getBoundingClientRect();
    textRects(true).forEach(function (o) {
      if (o.t > r.bottom || o.b < r.top) return;
      if (o.l < r.right && o.r > r.left) {
        if (o.l >= self.left) dx = Math.min(dx, o.l - r.right - 8);   // obstacle on the right
        else dx = Math.max(dx, o.r - r.left + 8);                     // obstacle on the left
      }
    });
    if (r.left + dx < 6) dx = 6 - r.left;
    if (r.right + dx > vw - 6) dx = vw - 6 - r.right;
    if (dx) yr.style.marginLeft = Math.round(dx) + "px";
  }

  function isPhone() { var v = viewport(); return v.h > v.w && v.w < 700; }
  var PHONE_MIN = 0.55;                      // phones: media never narrower than this share of the screen
  function sideSpot(w, h, off, maxShare) {
    off = off != null ? off : 0.15;
    var v = viewport(), B = bands();
    var texts = textRects(), media = mediaRects(), best = null;
    // the newest texts must stay readable; other media must not be covered
    var hot = texts.slice(-2), cold = texts.slice(0, -2);
    function ov(l, t, tw, th, r) { var ow = Math.min(l + tw, r.r) - Math.max(l, r.l), oh = Math.min(t + th, r.b) - Math.max(t, r.t); return ow > 0 && oh > 0 ? ow * oh : 0; }
    [maxShare || 0.55, 0.47, 0.4].forEach(function (share) {
      var tw = Math.min(w, v.w * share), k = tw / w, th = h * k;
      ["left", "right"].forEach(function (side) {
        var cx = side === "left" ? tw * 0.5 - tw * off : v.w - tw * 0.5 + tw * off;   // a bit off the edge
        for (var cy = B.t + th / 2 + 4; cy <= v.h - B.b - th / 2 - 4; cy += 12) {
          var l = cx - tw / 2, t = cy - th / 2, cost = 0;
          hot.forEach(function (r) { cost += ov(l, t, tw, th, r) * 30; });
          cold.forEach(function (r) { cost += ov(l, t, tw, th, r) * 3; });
          media.forEach(function (r) { cost += ov(l, t, tw, th, r) * 12; });
          cost += (1 - share) * 4000;                         // prefer bigger
          if (!best || cost < best.cost) best = { x: cx, y: cy, scale: k, cost: cost, bleed: off > 0.1, side: side };
        }
      });
    });
    return best;
  }
  function phoneFix(f, w, h) {               // too small, or on top of other media, on a phone? → a side spot
    if (!isPhone() || !f) return f;
    var v = viewport(), s = f.scale || 1, sw = w * s, sh = h * s;
    var l = f.x - sw / 2, t = f.y - sh / 2;
    var hits = mediaRects().some(function (r) {
      var ow = Math.min(l + sw, r.r) - Math.max(l, r.l), oh = Math.min(t + sh, r.b) - Math.max(t, r.t);
      return ow > 0 && oh > 0 && ow * oh > sw * sh * 0.08;
    });
    if (sw >= v.w * PHONE_MIN && !hits) return f;
    return sideSpot(w, h) || f;
  }

  function freeSpotFor(beat) {
    if (beat.phoneSize && isPhone()) beat.size = beat.phoneSize;   // phones: a smaller size for this one
    if (beat.type === "book") {
      var bw0 = mediaWidth(beat.size || "s", beat.ratio || 0.7, beat.scale), bh0 = bw0 / (beat.ratio || 0.7);
      var yfs = Math.min(96, Math.max(34, viewport().w * 0.095));       // the large text size
      yfs = Math.min(29, Math.max(19, viewport().w * 0.053));            // medium size
      var yearH = beat.year ? yfs * 2.3 : 0, yearW = beat.year ? yfs * (0.75 * String(beat.year).length + 1.1) : 0;
      var needW = Math.max(bw0 * 1.3, yearW + 30), needH = bh0 * 1.1 + yearH;
      // the other books (with their year labels), padded so they never touch even while turning
      var books = live.filter(function (it) { return !it.dead && it.el.classList.contains("book"); }).map(function (it) {
        var r = it.el.getBoundingClientRect(), pad = r.width * 0.25;
        return { l: r.left - pad, t: r.top - 60, r: r.right + pad, b: r.bottom + 10 };
      });
      var fb = clearSpot(needW, needH, textRects().concat(mediaRects(), books), null, 0.9)
            // no room? the book may overlap the chat, but never texts, the CV or the other book
            || clearSpot(needW, needH, textRects(true).concat(mediaRects(), books), null, 0.9)
            || clearSpot(needW, needH, textRects(true).concat(books), null, 0.6)
            || clearSpot(needW, needH, books, null, 0.5)                    // last resort: over a text, never over a book
            || freeSpot(bw0, bh0, textRects());
      if (yearH) fb.y += yearH / 2;            // the book sits below its year
      beat._fit = fb.scale;
      return fb;
    }
    var spec = beat.photos ? beat.photos[0] : beat;
    var ratio = spec.ratio || 1;
    var w = mediaWidth(beat.size || spec.size || "m", ratio, spec.scale);
    var h = w / ratio;
    var f = (beat.free === "all" && clearSpot(w * (beat.type === "stack" ? 1.3 : 1.08), h * (beat.type === "stack" ? 1.2 : 1.08),
                                              textRects().concat(mediaRects()), null, 0.2))
            || freeSpot(w, h, textRects());
    if (beat.free === "all") f = phoneFix(f, w, h);
    beat._fit = f.scale;
    beat._side = f.side === "left" || f.side === "right" ? "below" : f.side;
    beat._bleed = !!f.bleed;
    return f;
  }

  function playBeat(beat, x, y, atStep, anchor) {
    if (beat.phoneSize && isPhone()) beat.size = beat.phoneSize;
    var diesAt = beat.lifespan != null ? atStep + 1 + beat.lifespan : Infinity;
    var play = players[beat.type];
    if (play) play(beat, x, y, diesAt, anchor);
    else console.warn("Unknown beat type:", beat.type);
  }

  // things already on screen when the site opens (not counted in the progress)
  function showIntro() {
    var intro = window.INTRO;
    if (!intro || !intro.items) return;
    var v = viewport();
    var gap = intro.gap != null ? intro.gap : 10;
    var made = intro.items.map(function (beat) {
      playBeat(beat, 0, 0, 0, "topleft");
      return live[live.length - 1];
    });
    var total = made.reduce(function (h, it) { return h + it.el.offsetHeight; }, 0) + gap * (made.length - 1);
    // the "click anywhere" starburst goes in the white space under the intro: centre both together
    var hb = document.getElementById("hint"), hbH = hb ? hb.offsetHeight : 0, hbGap = hbH ? Math.max(18, v.h * 0.03) : 0;
    var B = bands(), y = intro.center ? B.t + (v.h - B.t - B.b - total - hbGap - hbH) / 2 : (intro.y || 0.1) * v.h;
    made.forEach(function (it) {
      var x = intro.center ? (v.w - it.el.offsetWidth) / 2 : (intro.x || 0.05) * v.w;
      place(it, x, y);
      y += it.el.offsetHeight + gap;
    });
    if (hb) hb.style.top = (y - gap + hbGap + hbH / 2) + "px";
  }

  // remove any item whose lifespan ran out
  function expire() {
    live.slice().forEach(function (item) {
      if (step >= item.diesAt) {
        if (item.leaveHow) {
          // stacked photos leave one after the other, the top one first
          var d = (item.group.length - 1 - item.idx) * (reduceMotion ? 0 : 220);
          item.diesAt = Infinity;
          later(function () { removeItem(item, item.leaveHow); }, d);
        } else removeItem(item);
      }
    });
  }

  // how = undefined (pop out) | true/"fast" (quick pop) | "stack" (slides up and away)
  function removeItem(item, how) {
    if (item.dead) return;
    if (item.onRemove) { try { item.onRemove(); } catch (e) {} }
    item.dead = true;
    live.splice(live.indexOf(item), 1);
    if (drag && drag.item === item) drag = null;
    var stackOut = how === "stack" || how === "stack-up" || how === "stack-down";
    var cls = how === "stack-down" ? "leaving-stack down" : stackOut ? "leaving-stack"
            : (how ? "leaving-fast" : "leaving");
    var ms = stackOut ? 700 : (how ? 200 : 340);
    cls.split(" ").forEach(function (c) { item.el.classList.add(c); });
    item.el.style.pointerEvents = "none";
    setTimeout(function () { item.el.remove(); }, reduceMotion ? 0 : ms);
  }

  function setBg(color) {
    if (color === "default") document.documentElement.style.removeProperty("--page");
    else document.documentElement.style.setProperty("--page", color);
    document.body.classList.toggle("dark-page", color !== "default");
  }

  // BACK: rebuild the screen as it was one step ago — replay the chapter quickly, from its last "clear"
  function goBack() {
    if (FAST || step <= 0) return;
    var target = step - 1;
    // a step that moved on by itself (then: advance) can't be stopped at: go one further back
    while (target > 0 && (STORY[target - 1].then || []).some(function (t) { return t.advance; })) target--;
    var start = 0, bgNow = "default";
    for (var i = 0; i < target; i++) { if (STORY[i].clear) start = i; if (STORY[i].bg) bgNow = STORY[i].bg; }
    restart();
    if (target === 0) return;
    setBg(bgNow);
    step = start;
    FAST = true;
    document.body.classList.add("fast");
    var v = viewport();
    (function ff() {
      if (step >= target) {
        setTimeout(function () { FAST = false; document.body.classList.remove("fast"); }, 400);
        updateProgress();
        return;
      }
      var p = taps[step] || { x: v.w / 2, y: v.h / 2 };
      reveal(p.x, p.y);
      setTimeout(ff, 120);
    })();
  }

  function restart() {
    setBg("default");
    timers.forEach(clearTimeout);
    timers = [];
    live.forEach(function (item) { item.dead = true; item.el.remove(); });
    live = [];
    step = 0;
    z = 1;
    tap = drag = null;
    updateProgress();
    showIntro();
  }

  // ======================================================================
  // Pointer handling (mouse + touch + pen, all the same code)
  // ======================================================================
  stage.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target.closest(".sound, a, .ac-btn")) return; // let buttons and links do their job
    var itemEl = e.target.closest(".item");

    // a second finger lands: cancel any pending tap (no accidental reveals)
    if (tap && tap.id !== e.pointerId) { tap = null; }

    if (itemEl && itemEl._item && !itemEl._item.dead) {
      // ---- start dragging an item ----
      if (drag) return; // one drag at a time
      var item = itemEl._item;
      toFront(item);
      drag = { id: e.pointerId, item: item, dx: e.clientX - item.x, dy: e.clientY - item.y, sx: e.clientX, sy: e.clientY };
      itemEl.classList.add("dragging");
      itemEl.setPointerCapture(e.pointerId);
      tap = null;
    } else if (!drag) {
      // ---- maybe a tap on empty canvas ----
      tap = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
    e.preventDefault();
  });

  stage.addEventListener("pointermove", function (e) {
    if (drag && drag.id === e.pointerId) {
      place(drag.item, e.clientX - drag.dx, e.clientY - drag.dy);
    } else if (tap && tap.id === e.pointerId) {
      if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP) tap = null; // a swipe, not a tap
    }
  });

  // RECEIPT: fold up, then swap the paper for a faceted paper ball (item shrinks to the ball)
  function paperBall(size) {
    var cx = size / 2, cy = size / 2, svg = "", P = [];
    // points on 3 rings + centre, jittered → many small creased facets, a fairly round outline
    var rings = [[0.47, 22], [0.33, 14], [0.18, 8]];
    rings.forEach(function (rg, ri) {
      for (var i = 0; i < rg[1]; i++) {
        var a = i / rg[1] * Math.PI * 2 + ri * 0.4 + (Math.random() - .5) * 0.25, r = size * rg[0] * (0.9 + Math.random() * 0.14);
        P.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, ring: ri, i: i, n: rg[1] });
      }
    });
    P.push({ x: cx + (Math.random() - .5) * 4, y: cy + (Math.random() - .5) * 4, ring: 3, i: 0, n: 1 });
    function ringPts(r) { return P.filter(function (p) { return p.ring === r; }); }
    function shade(x, y) {
      var dx = (x - size * 0.38) / size, dy = (y - size * 0.32) / size, d = Math.sqrt(dx * dx + dy * dy);
      var g = Math.round(253 - d * 95 - Math.random() * 26);
      return "rgb(" + g + "," + g + "," + (g - 4) + ")";
    }
    function tri(a, b, c) {
      var mx = (a.x + b.x + c.x) / 3, my = (a.y + b.y + c.y) / 3;
      svg += '<polygon points="' + [a, b, c].map(function (v) { return v.x.toFixed(1) + "," + v.y.toFixed(1); }).join(" ") +
             '" fill="' + shade(mx, my) + '" stroke="rgba(0,0,0,.07)" stroke-width=".5" stroke-linejoin="round"/>';
    }
    function nearest(p, list) { return list.slice().sort(function (A, B) { return Math.hypot(A.x - p.x, A.y - p.y) - Math.hypot(B.x - p.x, B.y - p.y); }); }
    for (var r = 0; r < 3; r++) {
      var outer = ringPts(r), inner = r < 2 ? ringPts(r + 1) : ringPts(3);
      outer.forEach(function (p, k) {
        var q = outer[(k + 1) % outer.length], a = nearest(p, inner)[0], b = nearest(q, inner)[0];
        tri(p, q, a); if (a !== b) tri(q, b, a);
      });
    }
    var outline = ringPts(0).map(function (v) { return v.x.toFixed(1) + "," + v.y.toFixed(1); }).join(" ");
    return '<svg class="rc-ball" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
           '<polygon points="' + outline + '" fill="rgb(222,220,214)"/>' + svg + '</svg>';
  }
  function crumple(it) {
    if (it.el.classList.contains("crumpled")) return;
    var paper = it.el.querySelector(".rc-paper");
    if (paper && !reduceMotion && paper.animate) {
      // like the reference: the paper is squeezed from the sides, pinched in the middle (a bow-tie),
      // twisted, then it snaps into a ball
      paper.style.transformOrigin = "50% 50%";
      paper.animate([
        { transform: "none", clipPath: "polygon(0 0, 100% 0, 100% 50%, 100% 100%, 0 100%, 0 50%)", filter: "brightness(1)" },
        { transform: "scale(.8, .62) rotate(-4deg)", clipPath: "polygon(0 0, 100% 0, 78% 50%, 100% 100%, 0 100%, 22% 50%)", filter: "brightness(.97)", offset: .35 },
        { transform: "scale(.5, .36) rotate(8deg) rotateY(35deg)", clipPath: "polygon(6% 0, 94% 4%, 58% 50%, 98% 96%, 4% 100%, 42% 50%)", filter: "brightness(.92)", offset: .7 },
        { transform: "scale(.22, .16) rotate(-15deg) rotateY(70deg)", clipPath: "polygon(20% 10%, 80% 8%, 55% 50%, 82% 92%, 18% 90%, 45% 50%)", filter: "brightness(.88)" }
      ], { duration: 420, easing: "cubic-bezier(.6,0,.3,1)", fill: "forwards" });
    }
    it.el.classList.add("crumpled");
    setTimeout(function () {
      if (it.dead) return;
      var r = it.el.getBoundingClientRect(), size = 74;
      var cx = r.left + r.width / 2, cy = r.top + r.height * 0.55;
      var inner = it.el.querySelector(".inner");
      inner.innerHTML = paperBall(size);
      it.el.style.width = size + "px"; it.el.style.height = size + "px";
      it.el.classList.add("balled");
      place(it, cx - size / 2, cy - size / 2);
    }, reduceMotion ? 0 : 400);
  }
  function toBin(it, done) {
    var b = it.bin && it.bin.getBoundingClientRect();
    if (!b || it.dead) { done && done(); return; }
    var el = it.el, tx = b.left + b.width / 2 - el.offsetWidth / 2, ty = b.top - el.offsetHeight * 0.2;
    it.dead = true;
    el.style.pointerEvents = "none";
    el.style.transition = reduceMotion ? "none" : "transform .55s cubic-bezier(.3,-0.35,.6,1)";
    el.style.transform = "translate3d(" + tx + "px," + ty + "px,0) rotate(220deg)";
    setTimeout(function () {
      el.style.transition = "transform .25s ease-in, opacity .25s";
      el.style.transform = "translate3d(" + tx + "px," + (b.top + b.height * 0.35) + "px,0) scale(.6)";
      el.style.opacity = "0";
      it.bin.classList.add("got");
    }, reduceMotion ? 0 : 560);
    setTimeout(function () { el.remove(); var k = live.indexOf(it); if (k >= 0) live.splice(k, 1); done && done(); }, reduceMotion ? 0 : 900);
  }

  // throw an item off the screen (with a spin), then forget it
  function fling(item, vx, vy) {
    if (item.dead) return;
    if (item.flick) { var i = item.flick.indexOf(item); if (i >= 0) item.flick.splice(i, 1); }
    item.dead = true;
    var el = item.el;
    el.style.pointerEvents = "none";
    el.style.transition = reduceMotion ? "none" : "transform .6s cubic-bezier(.2,.6,.3,1), opacity .6s";
    el.style.transform = "translate3d(" + (item.x + vx) + "px," + (item.y + vy) + "px,0) rotate(" + (vx > 0 ? 35 : -35) + "deg)";
    el.style.opacity = "0";
    setTimeout(function () { el.remove(); var k = live.indexOf(item); if (k >= 0) live.splice(k, 1); }, 650);
  }

  function endPointer(e, cancelled) {
    if (drag && drag.id === e.pointerId) {
      drag.item.el.classList.remove("dragging");
      // a tap (no real movement) on an item that reacts to taps, e.g. the zine turns a page
      var moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
      if (!cancelled && moved > TAP_SLOP && drag.item.onDrop) drag.item.onDrop();
      if (!cancelled && drag.item.onTap && moved <= TAP_SLOP) drag.item.onTap();
      else if (!cancelled && moved <= TAP_SLOP && !drag.item.flick) {     // a tap (not a drag) on a photo/magazine/etc → next
        var tp = { x: e.clientX, y: e.clientY };
        drag.item.el.classList.remove("dragging"); drag = null;
        reveal(tp.x, tp.y);
        return;
      }
      else if (!cancelled && drag.item.flick && moved > 60)        // a flick: keep going the same way, off screen
        fling(drag.item, (e.clientX - drag.sx) * 4, (e.clientY - drag.sy) * 4);
      drag = null;
      return; // ending a drag NEVER reveals anything
    }
    if (tap && tap.id === e.pointerId) {
      var t = tap;
      tap = null;
      if (!cancelled) reveal(t.x, t.y);
    }
  }
  stage.addEventListener("pointerup", function (e) { endPointer(e, false); });
  stage.addEventListener("pointercancel", function (e) { endPointer(e, true); });

  // stop the browser's own gestures/menus inside the canvas
  stage.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); }); // iOS pinch

  // ---- keyboard: Enter / Space reveals at a random spot ----
  stage.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      var v = viewport();
      reveal(v.w * (0.2 + Math.random() * 0.6), v.h * (0.2 + Math.random() * 0.6));
    }
  });

  // ---- controls ----
  restartBtn.addEventListener("click", function () {
    restart();
    stage.focus({ preventScroll: true });
  });
  if (nextBtn) nextBtn.addEventListener("click", function () {
    var v = viewport(), B = bands();
    reveal(v.w * (0.35 + Math.random() * 0.3), B.t + (v.h - B.t - B.b) * (0.35 + Math.random() * 0.3));
    stage.focus({ preventScroll: true });
  });
  document.getElementById("midalert-no").addEventListener("click", closeMid);
  document.getElementById("midalert-yes").addEventListener("click", function () { setTimeout(closeMid, 300); });
  document.getElementById("viewer-back").addEventListener("click", closeViewer);
  ["link-cv", "link-portfolio"].forEach(function (id) {
    var el = document.getElementById(id); if (!el) return;
    el.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;     // cmd-click: a real new tab
      e.preventDefault(); openViewer(id === "link-cv" ? "cv" : "site");
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!document.getElementById("viewer").hidden) closeViewer();
    else if (!document.getElementById("midalert").hidden) closeMid();
  });
  if (backBtn) backBtn.addEventListener("click", function () {
    goBack();
    stage.focus({ preventScroll: true });
  });

  // ---- keep everything on screen after rotate / resize ----
  var resizeTimer;
  function reclamp() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { live.forEach(refit); }, 60);
  }
  window.addEventListener("resize", reclamp);
  window.addEventListener("orientationchange", reclamp);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", reclamp);

  // preload every photo so it's ready the moment it's needed
  var kept = [];                                   // keep preloaded images alive until shown
  function img(src) { var i = new Image(); i.decoding = "async"; i.src = src; kept.push(i); if (kept.length > 400) kept.shift(); }
  function preload(list) {
    (list || []).forEach(function (b) {
      if (!b) return;
      if (b.src) img(b.src);
      if (b.reveal && b.reveal.mask) img(b.reveal.mask);
      preload(b.photos); preload(b.also); preload(b.then); preload(b.cards); preload(b.hintThen);
      if (b.front) { img(b.front); if (b.back) img(b.back); }
      if (b.spreads) b.spreads.forEach(img);
      if (b.faces) Object.keys(b.faces).forEach(function (k) { img(b.faces[k]); });
      if (b.cues && b.type === "code") preload(Object.keys(b.cues).map(function (k) { return b.cues[k]; }));
    });
  }
  // load only what's coming next (the next 3 steps), not the whole story at once
  var preloadedTo = -1;
  function preloadAhead() {
    var to = Math.min(STORY.length - 1, step + 3);
    for (var i = preloadedTo + 1; i <= to; i++) preload([STORY[i]]);
    preloadedTo = Math.max(preloadedTo, to);
  }
  preloadAhead();

  // contact links in the corner (hidden until filled in, in content.js → CONTACT)
  (function () {
    var cfg = window.CONTACT || {};
    var p = document.getElementById("link-portfolio"), m = document.getElementById("link-email");
    if (p && cfg.portfolio) { p.href = cfg.portfolio; p.hidden = false; }
    if (m && cfg.email) { m.href = "mailto:" + cfg.email; m.hidden = false; }
    var cv = document.getElementById("link-cv");
    if (cv && cfg.cv) { cv.href = cfg.cv; cv.hidden = false; }
  })();

  updateProgress();
  showIntro();
})();
