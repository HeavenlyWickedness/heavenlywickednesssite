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

  // Cast portraits: desktop hover/focus fills the viewport; touch opens a lightbox.
  (function () {
    var figures = [].slice.call(document.querySelectorAll("[data-cast]"));
    if (!figures.length) return;
    var stage = document.querySelector(".cast-stage");
    if (!stage) return;
    var pics = [].slice.call(stage.querySelectorAll(".cast-stage-pic"));
    var nameEl = stage.querySelector(".cast-stage-name");
    var roleEl = stage.querySelector(".cast-stage-role");
    var closeBtn = stage.querySelector(".cast-stage-close");
    var on = 0;
    var gen = 0;
    var closeTimer = 0;
    var hoverable = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    figures.forEach(function (fig) {
      var src = fig.getAttribute("data-cast-src");
      if (src) { var pre = new Image(); pre.src = src; }
    });

    function stageSrc(fig) {
      var tall = window.innerHeight > window.innerWidth * 1.15;
      var portrait = fig.getAttribute("data-cast-src-portrait");
      if (tall && portrait) return portrait;
      return fig.getAttribute("data-cast-src");
    }
    function applyPos(img, fig) {
      var pos = fig.getAttribute("data-cast-pos") || "50% 22%";
      // Portrait sources are already framed 3:4; use center.
      if (img.getAttribute("src") && img.getAttribute("src").indexOf("-thumb-") !== -1) pos = "center center";
      img.style.objectPosition = pos;
    }
    function show(fig) {
      clearTimeout(closeTimer);
      var src = stageSrc(fig);
      var name = fig.getAttribute("data-cast-name") || "";
      var role = fig.getAttribute("data-cast-role") || "";
      nameEl.textContent = name;
      roleEl.textContent = role;
      document.body.classList.add("cast-on");
      var cur = pics[on];
      if (cur.getAttribute("src") === src && cur.classList.contains("is-on")) { applyPos(cur, fig); return; }
      var token = ++gen;
      var next = 1 - on;
      var img = pics[next];
      function reveal() {
        if (token !== gen) return;
        pics[on].classList.remove("is-on");
        img.classList.add("is-on");
        on = next;
      }
      img.alt = name + (role ? " as " + role : "");
      if (img.getAttribute("src") === src && img.complete && img.naturalWidth) {
        applyPos(img, fig);
        reveal();
        return;
      }
      var done = false;
      function go() {
        if (done || token !== gen) return;
        done = true;
        reveal();
      }
      img.onload = go;
      img.onerror = go;
      img.src = src;
      applyPos(img, fig);
      if (img.complete && img.naturalWidth) go();
    }

    function hide() {
      clearTimeout(closeTimer);
      gen += 1;
      document.body.classList.remove("cast-on", "cast-lightbox");
      pics.forEach(function (p) { p.classList.remove("is-on"); });
    }

    function scheduleHide() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        if (!document.body.classList.contains("cast-lightbox")) hide();
      }, 60);
    }

    figures.forEach(function (fig) {
      fig.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "touch") return;
        if (document.body.classList.contains("cast-lightbox")) return;
        if (!hoverable && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
        show(fig);
      });
      fig.addEventListener("pointerleave", function (e) {
        if (document.body.classList.contains("cast-lightbox")) return;
        var rt = e.relatedTarget;
        if (rt && rt.closest && rt.closest("[data-cast]")) return;
        scheduleHide();
      });
      fig.addEventListener("focusin", function () { show(fig); });
      fig.addEventListener("focusout", function (e) {
        if (document.body.classList.contains("cast-lightbox")) return;
        var rt = e.relatedTarget;
        if (rt && rt.closest && rt.closest("[data-cast]")) return;
        scheduleHide();
      });
      fig.addEventListener("click", function (e) {
        if (hoverable && e.pointerType !== "touch") return;
        e.preventDefault();
        document.body.classList.add("cast-lightbox");
        show(fig);
      });
      fig.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          document.body.classList.add("cast-lightbox");
          show(fig);
        }
      });
    });

    function closeLightbox() { hide(); }
    if (closeBtn) closeBtn.addEventListener("click", function (e) { e.stopPropagation(); closeLightbox(); });
    stage.addEventListener("click", function () {
      if (document.body.classList.contains("cast-lightbox")) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (document.body.classList.contains("cast-on") || document.body.classList.contains("cast-lightbox")) closeLightbox();
    });
    var sx = 0, sy = 0;
    stage.addEventListener("touchstart", function (e) {
      if (!document.body.classList.contains("cast-lightbox")) return;
      sx = e.changedTouches[0].clientX;
      sy = e.changedTouches[0].clientY;
    }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      if (!document.body.classList.contains("cast-lightbox")) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 48 || Math.abs(dy) > 48) closeLightbox();
    }, { passive: true });
  })();

})();
