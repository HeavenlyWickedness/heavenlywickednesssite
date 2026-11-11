(function () {
  var doc = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Header turns solid once you leave the opening.
  var hdr = document.querySelector(".hdr");
  function onScroll() { if (hdr) hdr.classList.toggle("is-solid", window.scrollY > window.innerHeight * 0.6); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // Full screen menu with focus handling and Escape to close.
  var btn = document.querySelector(".menu-btn");
  var menu = document.getElementById("menu");
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close Menu" : "Open Menu");
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    menu.querySelectorAll("a").forEach(function (a) { a.tabIndex = open ? 0 : -1; });
    if (open) { var f = menu.querySelector("a"); if (f) setTimeout(function () { f.focus(); }, 50); }
    else btn.focus();
  }
  if (btn && menu) {
    menu.querySelectorAll("a").forEach(function (a) { a.tabIndex = -1; });
    btn.addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
    document.addEventListener("keydown", function (e) {
      if (!document.body.classList.contains("menu-open")) return;
      if (e.key === "Escape") { setMenu(false); return; }
      if (e.key === "Tab") {
        var items = [btn].concat([].slice.call(menu.querySelectorAll("a")));
        var i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
  }

  // Threshold: slow dissolve between stills. Later stills load only after the page is up.
  var slides = [].slice.call(document.querySelectorAll(".slide"));
  if (slides.length) {
    requestAnimationFrame(function () { slides[0].classList.add("is-on"); });
    if (!reduce && slides.length > 1) {
      window.addEventListener("load", function () {
        slides.forEach(function (s) {
          if (s.dataset.srcset) { s.srcset = s.dataset.srcset; s.removeAttribute("data-srcset"); }
        });
        var i = 0;
        setInterval(function () {
          if (document.hidden) return;
          slides[i].classList.remove("is-on");
          i = (i + 1) % slides.length;
          slides[i].classList.add("is-on");
        }, 9000);
      });
    }
  }

  // Slow reveals on scroll.
  var targets = document.querySelectorAll("[data-reveal], .scene");
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add("is-in"); });
  }

  // Product gallery
  document.querySelectorAll("[data-gallery]").forEach(function (gal) {
    var main = gal.querySelector("[data-gallery-main]");
    gal.querySelectorAll("[data-gallery-thumb]").forEach(function (b) {
      b.addEventListener("click", function () {
        main.srcset = b.getAttribute("data-srcset");
        main.alt = b.querySelector("img").alt;
        gal.querySelectorAll("[data-gallery-thumb]").forEach(function (x) { x.removeAttribute("aria-current"); });
        b.setAttribute("aria-current", "true");
      });
    });
  });

  // Size and ship-to pickers. Each size and region pair has its own Stripe Payment Link.
  document.querySelectorAll("[data-buy-box]").forEach(function (root) {
    var buy = root.querySelector("[data-buy]");
    var price = document.querySelector("[data-price]");
    var sizes = root.querySelectorAll("[data-size]");
    var regions = root.querySelectorAll("[data-region]");
    function region() {
      var r = root.querySelector("[data-region][aria-pressed='true']");
      return (r && r.getAttribute("data-region")) || "us";
    }
    function selectedSize() {
      return root.querySelector("[data-size][aria-pressed='true']:not([disabled])") || root.querySelector("[data-size]:not([disabled])");
    }
    function apply() {
      var src = selectedSize() || buy;
      var href = src.getAttribute("data-link-" + region());
      if (href) buy.setAttribute("href", href);
      var sz = selectedSize();
      if (price && sz && sz.dataset.amount) price.textContent = sz.dataset.amount;
    }
    sizes.forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.disabled) return;
        sizes.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        apply();
      });
    });
    regions.forEach(function (b) {
      b.addEventListener("click", function () {
        regions.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        apply();
      });
    });
    apply();
  });

  // Forms with no backend yet show the live site success copy.
  document.querySelectorAll("form[data-local-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) { e.preventDefault(); form.classList.add("is-success"); });
  });

  // Gazette: full article folds open beneath the quote.
  document.querySelectorAll("[data-gazette-toggle]").forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute("aria-controls"));
    var label = btn.querySelector("[data-gazette-label]");
    if (!panel) return;
    function set(open) {
      panel.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      label.textContent = open ? "Close the article" : "Read the full article";
      if (open) panel.removeAttribute("inert"); else panel.setAttribute("inert", "");
      panel.setAttribute("aria-hidden", open ? "false" : "true");
    }
    set(false);
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") !== "true";
      set(open);
      if (open) setTimeout(function () {
        // Bring the start of the article up to the lower part of the screen, keeping the image in view.
        var y = panel.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.8;
        if (y > window.scrollY + 8) window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
      }, 200);
    });
  });

  // Cast sequence: the section pins and scroll drives each actor in turn.
  // f runs 0..n as you scroll; actor i wipes in around f = i, then bleeds into colour and is named.
  (function () {
    var sec = document.querySelector("[data-cast]");
    if (!sec) return;
    var frames = [].slice.call(sec.querySelectorAll("[data-cast-frame]"));
    var ticks = [].slice.call(sec.querySelectorAll("[data-cast-go]"));
    var now = sec.querySelector("[data-cast-now]");
    var track = sec.querySelector(".cast-track");
    var n = frames.length;
    if (reduce || !n || !track) {
      frames.forEach(function (f) { f.classList.add("is-named"); });
      return;
    }
    sec.classList.add("is-seq");
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function ease(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    var vh = 1, top = 0, ticking = false, last = -1, inView = false;
    function measure() {
      vh = sec.querySelector(".cast-pin").offsetHeight || window.innerHeight;
      top = track.getBoundingClientRect().top + window.scrollY;
    }
    function render() {
      ticking = false;
      var f = clamp((window.scrollY - top) / vh, -1, n);
      var cur = 0;
      frames.forEach(function (fr, i) {
        var w = i === 0 ? 1 : ease(i - 0.3, i + 0.12, f);
        var next = i + 1 < n ? ease(i + 0.7, i + 1.12, f) : 0;
        var c = ease(i + (i === 0 ? -0.05 : 0.12), i + 0.62, f);
        if (w > 0.5) cur = i;
        fr.style.setProperty("--w", w.toFixed(4));
        fr.style.setProperty("--g", (1 - c).toFixed(3));
        fr.style.setProperty("--b", (1 - next * 0.55).toFixed(3));
        fr.style.setProperty("--s", (1.07 - 0.07 * ease(i - 0.3, i + 0.9, f)).toFixed(4));
        fr.classList.toggle("is-off", w <= 0 || next >= 1);
        fr.classList.toggle("is-named", f > i + 0.18 && f < i + 0.95 || (i === n - 1 && f > i + 0.18));
        if (ticks[i]) ticks[i].firstChild.style.setProperty("--p", clamp(f - i + 0.3, 0, 1).toFixed(3));
      });
      if (cur !== last) {
        last = cur;
        if (now) now.textContent = (cur < 9 ? "0" : "") + (cur + 1);
        ticks.forEach(function (t, i) { if (i === cur) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current"); });
      }
      var r = sec.querySelector(".cast-pin").getBoundingClientRect();
      var pinned = r.top <= 1 && r.bottom >= vh - 1;
      document.body.classList.toggle("in-cast", pinned);
    }
    function onScrollCast() { if (!ticking && inView) { ticking = true; requestAnimationFrame(render); } }
    measure(); render();
    window.addEventListener("scroll", onScrollCast, { passive: true });
    window.addEventListener("resize", function () { measure(); render(); });
    window.addEventListener("load", function () { measure(); render(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        inView = en[0].isIntersecting;
        if (inView) { measure(); render(); } else document.body.classList.remove("in-cast");
      }, { rootMargin: "50% 0px 50% 0px" }).observe(track);
    } else inView = true;
    function go(i) { measure(); window.scrollTo({ top: top + (i + 0.55) * vh, behavior: "smooth" }); }
    ticks.forEach(function (t, i) { t.addEventListener("click", function () { go(i); }); });
    // Arrow keys step through actors while a cast control has focus.
    sec.addEventListener("keydown", function (e) {
      if (!e.target.closest || !e.target.closest(".cast-ticks")) return;
      var i = ticks.indexOf(e.target);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); i = Math.min(n - 1, i + 1); ticks[i].focus(); go(i); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); i = Math.max(0, i - 1); ticks[i].focus(); go(i); }
    });
  })();

  // Background clip: loads only near the viewport, silent and looping. Reduced motion keeps the still.
  document.querySelectorAll("[data-lazy-video]").forEach(function (v) {
    if (reduce) return;
    function start() {
      var srcs = [].slice.call(v.querySelectorAll("source"));
      var small = window.matchMedia("(max-width: 900px)").matches;
      srcs.forEach(function (s) {
        var m = s.getAttribute("media");
        if ((m && !small) || (!m && small)) { s.remove(); return; }
        s.removeAttribute("media");
        s.src = s.getAttribute("data-src");
      });
      v.muted = true;
      v.load();
      v.addEventListener("playing", function () { v.classList.add("is-playing"); }, { once: true });
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
    if (!("IntersectionObserver" in window)) { start(); return; }
    var started = false;
    new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (e.isIntersecting && !started) { started = true; start(); }
        else if (started) { if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); }
      });
    }, { rootMargin: "300px 0px" }).observe(v);
  });

})();
