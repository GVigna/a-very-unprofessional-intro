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

  function later(fn, ms) {
    var id = setTimeout(function () {
      timers.splice(timers.indexOf(id), 1);
      fn();
    }, ms);
    timers.push(id);
  }

  function randomTilt() { return (Math.random() * 2 - 1) * MAX_TILT; }

  // Keep an item fully on screen.
  function clamp(item, x, y) {
    var v = viewport();
    var w = item.el.offsetWidth, h = item.el.offsetHeight;
    var maxX = Math.max(EDGE, v.w - w - EDGE);
    var maxY = Math.max(EDGE, v.h - h - EDGE);
    return {
      x: Math.min(Math.max(x, EDGE), maxX),
      y: Math.min(Math.max(y, EDGE), maxY)
    };
  }

  function place(item, x, y) {
    var p = clamp(item, x, y);
    item.x = p.x;
    item.y = p.y;
    item.el.style.transform = "translate3d(" + p.x + "px," + p.y + "px,0)";
  }

  // re-clamp after an item changed size (typing text, growing chat)
  function refit(item) { if (!item.dead) place(item, item.x, item.y); }

  function toFront(item) { item.el.style.zIndex = ++z; }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function updateProgress() {
    progress.textContent = pad(step) + "/" + pad(STORY.length);
  }

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
    var maxH = v.h * 0.7; // tall items must also fit the height (landscape phones!)
    if (w / ratio > maxH) w = maxH * ratio;
    return Math.round(w);
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

    if (spec.src && kind === "video") {
      s.el.classList.add("photo", "clip");
      var vid = document.createElement("video");
      vid.src = spec.src;
      if (spec.poster) vid.poster = spec.poster;
      vid.muted = true; vid.defaultMuted = true;          // never any sound
      vid.loop = spec.loop !== false; vid.autoplay = !reduceMotion;   // loop: false → plays once, stops on the last frame
      vid.playsInline = true;
      vid.setAttribute("muted", ""); vid.setAttribute("playsinline", "");
      vid.preload = "auto";
      vid.className = "pic";
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
  function maybeHint(item, inner, beat, delay) {
    if (item.hinted || !beat.links || beat.linkHint === false) return;
    if (!inner.querySelector("a")) return;          // the link isn't complete yet
    item.hinted = true;
    cursorHint(item, inner, delay);
  }

  function cursorHint(item, inner, delay) {
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

  // add an element to the stage as a live, draggable item
  function addItem(el, x, y, diesAt, anchor) {
    el.style.visibility = "hidden";       // measure before showing
    stage.appendChild(el);
    var item = { el: el, x: 0, y: 0, diesAt: diesAt };
    el._item = item;
    live.push(item);
    if (anchor && anchor.ref) {
      // stick to another item: right below it, or right above it, aligned left
      var ref = anchor.ref, g = anchor.gap != null ? anchor.gap : 10;
      var ay = anchor.mode === "above" ? ref.y - el.offsetHeight - g
                                       : ref.y + ref.el.offsetHeight + g;
      place(item, ref.x + (anchor.dx || 0), ay);
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
      var s = buildText(beat);
      var item = addItem(s.el, x, y, diesAt, anchor);
      item.id = beat.id || beat.into;
      if (beat.typing) {
        var fs = finalSize(beat);
        item.fw = fs.w; item.fh = fs.h;
        if (anchor) place(item, item.x, item.y); // keep it on screen at its final size
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
        // typeFrom: everything before that phrase is there at once, only the rest is typed
        var pause = 0;
        if (beat.typeFrom) {
          var from = full.indexOf(beat.typeFrom);
          if (from > 0) {
            i = from;
            renderInto(s.inner, full.slice(0, from), beat, false);
            later(function () { maybeHint(item, s.inner, beat, 250); }, 0);
            pause = beat.typePause != null ? beat.typePause : TYPE_PAUSE; // breath before the typing
          }
        }
        var anchored = !!anchor; // stuck under/above something, or top-left: grow from there
        var speed = beat.speed || TYPE_SPEED;
        s.inner.classList.add("caret");
        var typeNext = function () {
          if (item.dead) return;
          i++;
          renderInto(s.inner, full.slice(0, i), beat, false);
          maybeHint(item, s.inner, beat, 150);
          if (anchored) refit(item);
          else place(item, cx - s.el.offsetWidth / 2, cy - s.el.offsetHeight / 2);
          if (i < full.length) later(typeNext, reduceMotion ? 0 : speed);
          else {
            later(function () { s.inner.classList.remove("caret"); }, beat.strike ? 0 : 1200);
            if (beat.strike) strikeOut(s.inner, full, beat);
            else renderInto(s.inner, full, beat, false);
            maybeHint(item, s.inner, beat, 300);
            playThen(beat, item);
          }
        };
        if (pause && !reduceMotion) later(typeNext, pause); else typeNext();
      }
    },

    image: function (beat, x, y, diesAt, anchor) {
      addItem(buildMedia(beat, "image", "m", beat.tilt), x, y, diesAt, anchor);
    },

    video: function (beat, x, y, diesAt, anchor) {
      addItem(buildMedia(beat, "video", "m", beat.tilt), x, y, diesAt, anchor);
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
          var tilt = spec.tilt != null ? spec.tilt : (n === 0 ? 0 : (n % 2 ? 1 : -1) * (2 + Math.random() * 3));
          var el = buildMedia(Object.assign({ _fit: beat._fit }, spec), "image", beat.size || "m", tilt);
          el.classList.add("stacked");
          if (beat._side === "above") el.classList.add("from-top");
          var it = addItem(el, x, y, diesAt);
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
      var item = addItem(s.el, x, y, diesAt);

      var msgs = beat.messages || [];
      var t = reduceMotion ? 0 : 300;
      msgs.forEach(function (m) {
        var side = m.from === "me" ? "me" : "them";
        var typing = reduceMotion ? 0 : (m.typing != null ? m.typing : CHAT_TYPING);

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
  function reveal(x, y) {
    if (step >= STORY.length) { nudgeProgress(); return; }

    var beat = STORY[step];

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
    (beat.also || []).forEach(function (extra) {
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

  function textRects() {
    return live.filter(function (it) {
      return it.el.classList.contains("text") && !it.dead;
    }).map(function (it) {
      var w = Math.max(it.el.offsetWidth, it.fw || 0), h = Math.max(it.el.offsetHeight, it.fh || 0);
      return { l: it.x, t: it.y, r: it.x + w, b: it.y + h };
    });
  }

  // the roomiest area around the texts that fits a w×h box: returns centre, scale, side
  function freeSpot(w, h, rects) {
    var v = viewport(), g = 16;
    if (!rects.length) return { x: v.w / 2, y: v.h / 2, scale: 1, side: "below" };
    var U = rects.reduce(function (a, r) {
      return { l: Math.min(a.l, r.l), t: Math.min(a.t, r.t), r: Math.max(a.r, r.r), b: Math.max(a.b, r.b) };
    });
    var areas = [
      { side: "below", l: EDGE, t: U.b + g, r: v.w - EDGE, b: v.h - EDGE },
      { side: "above", l: EDGE, t: EDGE + 30, r: v.w - EDGE, b: U.t - g },
      { side: "right", l: U.r + g, t: EDGE + 30, r: v.w - EDGE, b: v.h - EDGE },
      { side: "left",  l: EDGE, t: EDGE + 30, r: U.l - g, b: v.h - EDGE }
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
    (beat.then || []).forEach(function (next) {
      later(function () {
        if (item.dead) return;
        var v = viewport(), unit = Math.min(v.w, v.h), x, y;
        if (next.free) { var f0 = freeSpotFor(next); x = f0.x; y = f0.y; }
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
      return { l: it.x, t: it.y, r: it.x + it.el.offsetWidth, b: it.y + it.el.offsetHeight };
    });
  }

  // avoid EVERYTHING on screen: scan the screen for the biggest size that fits
  // without touching any text or photo (falls back to the text-only method)
  // pref = the point it would like to be near (the tap, or the screen centre);
  // minScale = 1 for texts (they never shrink)
  function clearSpot(w, h, rects, pref, minScale) {
    var v = viewport(), m = 12, top = EDGE + 40;
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

  function freeSpotFor(beat) {
    var spec = beat.photos ? beat.photos[0] : beat;
    var ratio = spec.ratio || 1;
    var w = mediaWidth(beat.size || spec.size || "m", ratio, spec.scale);
    var h = w / ratio;
    var f = (beat.free === "all" && clearSpot(w, h, textRects().concat(mediaRects())))
            || freeSpot(w, h, textRects());
    beat._fit = f.scale;
    beat._side = f.side;
    return f;
  }

  function playBeat(beat, x, y, atStep, anchor) {
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
    var y = intro.center ? (v.h - total) / 2 : (intro.y || 0.1) * v.h;
    made.forEach(function (it) {
      var x = intro.center ? (v.w - it.el.offsetWidth) / 2 : (intro.x || 0.05) * v.w;
      place(it, x, y);
      y += it.el.offsetHeight + gap;
    });
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

  function restart() {
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
    if (e.target.closest(".sound, a")) return; // let buttons and links do their job
    var itemEl = e.target.closest(".item");

    // a second finger lands: cancel any pending tap (no accidental reveals)
    if (tap && tap.id !== e.pointerId) { tap = null; }

    if (itemEl && itemEl._item && !itemEl._item.dead) {
      // ---- start dragging an item ----
      if (drag) return; // one drag at a time
      var item = itemEl._item;
      toFront(item);
      drag = { id: e.pointerId, item: item, dx: e.clientX - item.x, dy: e.clientY - item.y };
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

  function endPointer(e, cancelled) {
    if (drag && drag.id === e.pointerId) {
      drag.item.el.classList.remove("dragging");
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
  function preload(list) {
    (list || []).forEach(function (b) {
      if (b.src) new Image().src = b.src;
      if (b.reveal && b.reveal.mask) new Image().src = b.reveal.mask;
      preload(b.photos); preload(b.also); preload(b.then);
    });
  }
  preload(STORY);

  updateProgress();
  showIntro();
})();
