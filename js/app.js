/* Compass & Route — presentation controls, task sheets, reveal.
   No dependencies. Everything on the page is readable without this file. */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var slides = $$('#deck > .slide');
  var hud = $('.hud');
  var deckMode = window.matchMedia('(min-width: 1024px) and (min-height: 560px)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  var current = 0;        // index of the slide on screen
  var openSheet = null;   // the sheet element that is open, or null
  var opener = null;      // the link that opened it (focus returns here)
  var savedY = null;      // scroll position of the deck behind the sheet (null = top of the current slide)
  var navLock = 0;        // while a programmatic scroll runs, ignore scroll-derived index

  /* ---------------------------------------------------------------- deck */

  function slideTop(i) { return Math.round(slides[i].getBoundingClientRect().top + window.pageYOffset); }

  function indexFromScroll() {
    var line = window.innerHeight * 0.4, found = 0;
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].getBoundingClientRect().top <= line) found = i;
    }
    return found;
  }

  function slideIndexById(id) {
    for (var i = 0; i < slides.length; i++) if (slides[i].id === id) return i;
    return -1;
  }

  function setHash(id) {
    if (location.hash === '#' + id) return;
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* some file:// setups */ }
  }

  function updateHud() {
    var s = slides[current];
    $('.hud-count b', hud).textContent = current + 1;
    $('.hud-count span', hud).textContent = slides.length;
    $('.hud-title', hud).textContent = s.getAttribute('data-title') || '';
    $('[data-nav="prev"]', hud).disabled = current === 0;
    $('[data-nav="next"]', hud).disabled = current === slides.length - 1;
    hud.style.setProperty('--p', (current / (slides.length - 1)).toFixed(3));
    hud.style.setProperty('--needle', Math.round(current * 360 / slides.length) + 'deg');
    if (!openSheet) setHash(s.id);
  }

  function go(i, instant) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    current = i;
    updateHud();
    var smooth = !instant && !reduced.matches;
    navLock = Date.now() + (smooth ? 900 : 120);
    window.scrollTo({ top: slideTop(i), behavior: smooth ? 'smooth' : 'auto' });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (openSheet) { spySteps(); return; }
      if (Date.now() < navLock) return;
      var i = indexFromScroll();
      if (i !== current) { current = i; updateHud(); }
    });
  }, { passive: true });

  window.addEventListener('resize', function () {
    if (!openSheet && deckMode.matches) go(current, true);
  });

  function toggleFullscreen() {
    var el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) { var p = req.call(el); if (p && p.catch) p.catch(function () {}); }
    }
  }

  hud.addEventListener('click', function (e) {
    var b = e.target.closest('[data-nav]');
    if (!b) return;
    var k = b.getAttribute('data-nav');
    if (k === 'prev') go(current - 1);
    else if (k === 'next') go(current + 1);
    else if (k === 'fs') toggleFullscreen();
  });

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target, tag = t && t.tagName;
    // typing fields keep their keys; radio buttons and checkboxes (the tests in Task 8) do not block Esc and F
    var choice = tag === 'INPUT' && /^(radio|checkbox)$/i.test(t.type || '');
    if ((tag === 'INPUT' && !choice) || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    var key = e.key;
    if (choice && !openSheet) return; // outside a sheet the arrows and Space belong to the radio group

    if (key === 'f' || key === 'F' || key === 'а' || key === 'А') { e.preventDefault(); toggleFullscreen(); return; }

    if (openSheet) {
      if (key === 'Escape') { e.preventDefault(); closeSheet(); }
      return; // arrows, space, PageUp/Down scroll the sheet as usual
    }
    if (key === ' ' || key === 'Spacebar') {
      if (tag === 'A' || tag === 'BUTTON') return; // let Space press the focused control
      e.preventDefault(); go(current + (e.shiftKey ? -1 : 1)); return;
    }
    if (key === 'ArrowRight' || key === 'PageDown') { e.preventDefault(); go(current + 1); }
    else if (key === 'ArrowLeft' || key === 'PageUp') { e.preventDefault(); go(current - 1); }
    else if (key === 'Home') { e.preventDefault(); go(0); }
    else if (key === 'End') { e.preventDefault(); go(slides.length - 1); }
  });

  /* -------------------------------------------------------------- sheets */

  function isSheet(el) { return !!el && el.classList.contains('sheet'); }

  function moduleSlideOf(sheet) {
    var i = slideIndexById('module-' + sheet.getAttribute('data-module'));
    return i >= 0 ? i : slideIndexById('contents');
  }

  function showSheet(sheet, from) {
    if (!openSheet) {
      savedY = window.pageYOffset;
      opener = from || null;
    } else if (openSheet !== sheet) {
      // previous / next task: "Back" now leads to the module of the new task
      openSheet.classList.remove('is-open');
      current = moduleSlideOf(sheet);
      savedY = null;
      opener = null;
    }
    openSheet = sheet;
    stepPin = null;
    root.classList.add('sheet-open');
    sheet.classList.add('is-open');
    window.scrollTo(0, 0);
    if (location.hash !== '#' + sheet.id) {
      try { history.pushState(null, '', '#' + sheet.id); } catch (e) { /* ignore */ }
    }
    var target = $('.sheet-close', sheet);
    if (target) target.focus({ preventScroll: true });
    spySteps();
  }

  function closeSheet(keepFocus) {
    if (!openSheet) return;
    var sheet = openSheet;
    openSheet = null;
    sheet.classList.remove('is-open');
    root.classList.remove('sheet-open');
    navLock = Date.now() + 150;
    window.scrollTo(0, deckMode.matches || savedY === null ? slideTop(current) : savedY);
    updateHud();
    if (!keepFocus) {
      var back = opener && document.contains(opener) ? opener : $('a[href="#' + sheet.id + '"]', slides[current]);
      if (back) back.focus({ preventScroll: true });
    }
    opener = null;
    savedY = null;
  }

  // which of the four blocks is being read
  // The reading line starts just under the top bar and moves down the screen as the sheet is
  // scrolled, so a short first block is not skipped and the last block is reached at the end.
  // A step that was just clicked stays marked until the reader scrolls away from it.
  var stepPin = null; // { i: index of the clicked step, until: time the scroll may still run, y: where it stopped }
  function spySteps() {
    if (!openSheet) return;
    var blocks = $$('.block', openSheet), active = 0;
    var vh = window.innerHeight, y = window.pageYOffset;
    var bar = $('.sheet-bar', openSheet);
    var top = bar ? bar.getBoundingClientRect().bottom : 0;
    var margin = Math.max(56, vh * 0.12);
    var room = document.documentElement.scrollHeight - vh;
    var progress = room > 4 ? Math.max(0, Math.min(1, y / room)) : 0;
    var line = top + margin + progress * Math.max(0, vh - top - 2 * margin);
    blocks.forEach(function (b, i) { if (b.getBoundingClientRect().top <= line) active = i; });
    if (stepPin) {
      if (Date.now() < stepPin.until) { stepPin.y = y; active = stepPin.i; }
      else if (stepPin.y !== null && Math.abs(y - stepPin.y) < 40) active = stepPin.i;
      else stepPin = null;
    }
    $$('.steps a', openSheet).forEach(function (a, i) {
      if (i === active) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
  }

  // one router for clicks, the Back button of the browser and the first load
  function route(hash, opts) {
    opts = opts || {};
    var id = '';
    try { id = decodeURIComponent((hash || '').replace(/^#/, '')); } catch (e) { id = ''; }
    if (!id) { if (openSheet) closeSheet(true); return; }
    var si = slideIndexById(id);
    if (si >= 0) {
      var from = openSheet;
      if (from) { current = si; savedY = null; closeSheet(true); }
      go(si, opts.instant || !!from || (!deckMode.matches && opts.initial));
      if (from && !opts.instant) {
        // "Back to Module N": put the focus on the card of the task we came from
        var card = $('a[href="#' + from.id + '"]', slides[si]);
        if (card) card.focus({ preventScroll: true });
      }
      return;
    }
    var el = document.getElementById(id);
    if (isSheet(el)) {
      if (opts.initial) {
        // opened by a direct link: put the deck on the slide this sheet belongs to
        current = moduleSlideOf(el);
        window.scrollTo(0, slideTop(current));
      }
      showSheet(el, opts.from);
      return;
    }
    if (el) {
      var host = el.closest('.sheet');
      var direct = !!(host && opts.initial && host !== openSheet);
      if (direct) {
        // a direct link to a part of a sheet: "Back" leads to the module of that task
        current = moduleSlideOf(host);
        window.scrollTo(0, slideTop(current));
      }
      if (host && host !== openSheet) showSheet(host, opts.from);
      if (host) el.scrollIntoView({ behavior: reduced.matches || opts.initial ? 'auto' : 'smooth', block: 'start' });
      if (direct) {
        // the layout settles after load: go to that part once more
        window.addEventListener('load', function () {
          if (openSheet === host) { el.scrollIntoView({ block: 'start' }); spySteps(); }
        });
      }
    }
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute('href');
    if (hash.length < 2) return;
    e.preventDefault();
    if (a.classList.contains('skip')) {
      var main = $('#deck');
      main.focus({ preventScroll: true });
      if (deckMode.matches) go(current, true); else main.scrollIntoView();
      return;
    }
    if (a.classList.contains('sheet-close')) { closeSheet(); return; }
    var stepList = openSheet && a.closest('.steps');
    if (stepList) {
      stepPin = { i: $$('a', stepList).indexOf(a), until: Date.now() + (reduced.matches ? 150 : 1100), y: window.pageYOffset };
      route(hash, { from: a });
      spySteps();
      return;
    }
    route(hash, { from: a });
  });

  window.addEventListener('popstate', function () { route(location.hash, { instant: true }); });

  /* ------------------------------------- module slides: progress dots */

  $$('.progress[data-total]').forEach(function (p) {
    var done = parseInt(p.getAttribute('data-done'), 10) || 0;
    var total = parseInt(p.getAttribute('data-total'), 10) || 0;
    if (!total) return;
    var dots = document.createElement('span');
    dots.className = 'progress-dots';
    dots.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < total; i++) {
      var d = document.createElement('i');
      if (i >= done) d.className = 'todo';
      dots.appendChild(d);
    }
    p.insertBefore(dots, p.firstChild);
  });

  /* ------------------------------------------- essay: live word count */

  $$('.essay').forEach(function (essay) {
    var out = $('[data-wordcount]', essay);
    if (!out) return;
    var n = 0;
    $$('p', essay).forEach(function (p) {
      if (p.contains(out)) return;
      var words = p.textContent.replace(/[–—]/g, ' ').match(/[A-Za-z0-9À-ɏ]+(?:['’-][A-Za-z0-9À-ɏ]+)*/g);
      n += words ? words.length : 0;
    });
    out.textContent = n + ' words';
  });

  /* ------------------------------------- rubric: level switch on a phone */

  $$('.rubric--analytic').forEach(function (table) {
    var heads = $$('thead th', table).slice(1);
    var box = document.createElement('div');
    box.className = 'level-switch';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Level to show');
    var label = document.createElement('p');
    label.textContent = 'Level, % · tap one to see it alone';
    var row = document.createElement('div');
    box.appendChild(label); box.appendChild(row);
    var buttons = [];
    function set(v) {
      if (v) table.setAttribute('data-show', v); else table.removeAttribute('data-show');
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.value === v)); });
    }
    heads.forEach(function (th, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.value = String(i + 1);
      b.textContent = th.textContent.replace(/\s*%/, '');
      row.appendChild(b); buttons.push(b);
    });
    var all = document.createElement('button');
    all.type = 'button'; all.value = ''; all.textContent = 'All';
    row.appendChild(all); buttons.push(all);
    row.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) set(b.value);
    });
    var wrap = document.createElement('div');
    wrap.className = 'rubric-wrap';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(box); wrap.appendChild(table);
    set(''); // start with all four levels, stacked
  });

  /* ------------------------------------- task 7: print the memo alone */

  $$('[data-print-memo]').forEach(function (button) {
    button.addEventListener('click', function () {
      // one landscape page with nothing but the memo (see "print-memo" in the print styles)
      var page = document.createElement('style');
      page.textContent = '@page { size: A4 landscape; margin: 8mm; }';
      document.head.appendChild(page);
      root.classList.add('print-memo');
      var done = function () {
        root.classList.remove('print-memo');
        if (page.parentNode) page.parentNode.removeChild(page);
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      window.print();
    });
  });

  /* -------------------------------------------------------------- reveal */

  var revealables = $$('[data-reveal], .toc-map');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }
  // printing shows everything at once
  window.addEventListener('beforeprint', function () {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  });

  /* ---------------------------------------------------------------- init */

  hud.hidden = false;
  if (location.hash.length > 1) {
    route(location.hash, { initial: true, instant: true });
    if (!openSheet) { current = indexFromScroll(); }
  } else {
    current = indexFromScroll();
  }
  updateHud();
  // the browser may restore or adjust scroll after load
  window.addEventListener('load', function () {
    if (openSheet) {
      // a sheet opened by a direct link starts at its top
      // (the browser may jump to the anchor while the sheet is still sliding in, a few pixels low)
      var direct = openSheet;
      var toTop = function () {
        if (openSheet === direct && location.hash === '#' + direct.id && window.pageYOffset < 48) window.scrollTo(0, 0);
        spySteps();
      };
      toTop();
      setTimeout(toTop, 450);
      return;
    }
    if (location.hash.length > 1 && slideIndexById(location.hash.slice(1)) >= 0) go(slideIndexById(location.hash.slice(1)), true);
    else { current = indexFromScroll(); updateHud(); }
  });
})();
