/* Task 8 — two self-checking tests.
   The statements, options and key tables are plain HTML; this file turns them into forms.
   Without it the tests stay readable as a printed sheet. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var uid = 0;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function joinNames(list) {
    if (list.length < 2) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }
  function scrollTo(node) {
    node.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  }

  // phone layout of the key tables: each cell gets the name of its column
  $$('.key-table').forEach(function (table) {
    var heads = $$('thead th', table).map(function (th) { return clean(th.textContent); });
    $$('tbody tr', table).forEach(function (tr) {
      $$('th, td', tr).forEach(function (cell, i) { if (i > 0 && heads[i]) cell.setAttribute('data-label', heads[i]); });
    });
  });

  // moves the text of a list item into a paragraph with its number in front
  function numbered(li, textNode, cls) {
    var p = textNode || el('p', cls);
    if (!textNode) { while (li.firstChild) p.appendChild(li.firstChild); li.appendChild(p); }
    var wrap = el('span');
    while (p.firstChild) wrap.appendChild(p.firstChild);
    p.appendChild(el('span', 'q-num', li.getAttribute('data-q') + '.'));
    p.appendChild(wrap);
    p.id = 'quiz-q-' + (++uid);
    return p;
  }

  function radio(cls, name, value) {
    var label = el('label', cls);
    var input = el('input');
    input.type = 'radio'; input.name = name; input.value = value;
    label.appendChild(input);
    label.appendChild(el('span'));
    return label;
  }

  function bars(rows, max) {
    var ul = el('ul', 'bars');
    rows.forEach(function (r) {
      var li = el('li', r.cls || '');
      var label = el('span', 'bar-label', r.label);
      if (r.tag) { label.appendChild(document.createTextNode(' ')); label.appendChild(el('em', 'bar-tag', r.tag)); }
      var track = el('span', 'bar-track');
      var fill = el('i', 'bar-fill');
      fill.style.setProperty('--w', Math.round(r.value / max * 100) + '%');
      track.appendChild(fill);
      li.appendChild(label); li.appendChild(track);
      li.appendChild(el('span', 'bar-val', r.value + ' / ' + max));
      ul.appendChild(li);
    });
    return ul;
  }

  function setUp(form, opts) {
    var box = $('[data-result]', form);
    var test = form.closest('.test') || form.parentNode;
    var items = opts.items;

    function clearMarks() {
      $$('.is-yours', test).forEach(function (tr) { tr.classList.remove('is-yours'); });
    }
    function show(nodes, warning) {
      box.textContent = '';
      box.classList.toggle('is-warning', !!warning);
      nodes.forEach(function (n) { box.appendChild(n); });
      box.hidden = false;
    }

    form.addEventListener('change', function (e) {
      var li = e.target.closest('li[data-q]');
      if (li) li.classList.remove('is-missing');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearMarks();
      var missing = items.filter(function (li) {
        var empty = !$('input:checked', li);
        li.classList.toggle('is-missing', empty);
        return empty;
      });
      if (missing.length) {
        show([el('p', '', missing.length === 1
          ? 'One ' + opts.noun + ' has no answer yet. It is marked above.'
          : missing.length + ' ' + opts.noun + 's have no answer yet. They are marked above.')], true);
        scrollTo(missing[0]);
        var first = $('input', missing[0]);
        if (first) first.focus({ preventScroll: true });
        return;
      }
      show(opts.result(test), false);
      box.setAttribute('tabindex', '-1');
      box.focus({ preventScroll: true });
      scrollTo(box);
    });

    form.addEventListener('reset', function () {
      items.forEach(function (li) { li.classList.remove('is-missing'); });
      clearMarks();
      box.hidden = true;
      box.textContent = '';
      box.classList.remove('is-warning');
    });

    form.classList.add('quiz-enhanced');
  }

  /* ------------------------------------------------ Test 1: five keys */

  var keysForm = $('form[data-quiz="keys"]');
  if (keysForm) {
    var scale = $$('.scale-legend span', keysForm).map(function (s) { return clean(s.textContent).replace(/^\d+\s*·\s*/, ''); });
    if (scale.length !== 4) scale = ['Never', 'Sometimes', 'Often', 'Always'];
    var keyItems = $$('.quiz-items li[data-q]', keysForm);
    keyItems.forEach(function (li) {
      var p = numbered(li, null, 'q-text');
      var group = el('div', 'choices');
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-labelledby', p.id);
      scale.forEach(function (word, v) {
        var label = radio('choice-btn', 'keys-q' + li.getAttribute('data-q'), String(v));
        var face = $('span', label);
        face.appendChild(el('b', '', String(v)));
        face.appendChild(document.createTextNode(' ' + word));
        group.appendChild(label);
      });
      li.appendChild(group);
    });

    setUp(keysForm, {
      items: keyItems,
      noun: 'statement',
      result: function (test) {
        var groups = $$('.quiz-group', keysForm).map(function (fs) {
          var sum = 0, n = 0;
          $$('input:checked', fs).forEach(function (i) { sum += Number(i.value); n += 1; });
          return { label: clean($('legend', fs).textContent), value: sum, max: n * 3 };
        });
        var total = groups.reduce(function (a, g) { return a + g.value; }, 0);
        var max = groups.reduce(function (a, g) { return a + g.max; }, 0);
        var perKey = groups[0].max;

        var level = null;
        $$('.key-table tr[data-level]', test).forEach(function (tr) {
          var m = clean($('th', tr).textContent).match(/(\d+)\D+(\d+)/);
          if (m && total >= Number(m[1]) && total <= Number(m[2])) level = tr;
        });

        var hi = Math.max.apply(null, groups.map(function (g) { return g.value; }));
        var lo = Math.min.apply(null, groups.map(function (g) { return g.value; }));
        var top = groups.filter(function (g) { return g.value === hi; });
        var low = groups.filter(function (g) { return g.value === lo; });

        var out = [el('p', 'res-kicker', 'Your result')];
        var main = el('p', 'res-main');
        var score = el('span', 'res-score', String(total));
        score.appendChild(el('small', '', ' / ' + max));
        main.appendChild(score);
        if (level) {
          level.classList.add('is-yours');
          var cells = $$('td', level);
          main.appendChild(el('span', 'res-level', clean(cells[0].textContent)));
          out.push(main);
          out.push(el('p', 'res-text', clean(cells[1].textContent)));
        } else {
          out.push(main);
        }

        var summary = el('p', 'res-text');
        if (hi === lo) {
          summary.textContent = 'All five keys have the same score: ' + hi + ' of ' + perKey + '.';
        } else {
          summary.appendChild(document.createTextNode((top.length > 1 ? 'Strongest keys: ' : 'Strongest key: ')));
          summary.appendChild(el('b', '', joinNames(top.map(function (g) { return g.label; }))));
          summary.appendChild(document.createTextNode((low.length > 1 ? '. Weakest keys: ' : '. Weakest key: ')));
          summary.appendChild(el('b', '', joinNames(low.map(function (g) { return g.label; }))));
          summary.appendChild(document.createTextNode(low.length > 1 ? '. These are the qualities to train first.' : '. This is the quality to train first.'));
        }
        out.push(summary);

        out.push(bars(groups.map(function (g) {
          var isTop = hi !== lo && g.value === hi, isLow = hi !== lo && g.value === lo;
          return { label: g.label, value: g.value, cls: isTop ? 'is-top' : isLow ? 'is-low' : '', tag: isTop ? 'strongest' : isLow ? 'weakest' : '' };
        }), perKey));
        return out;
      }
    });
  }

  /* ------------------------------------------ Test 2: style of a leader */

  var styleForm = $('form[data-quiz="style"]');
  if (styleForm) {
    var sitItems = $$('.situations > li[data-q]', styleForm);
    sitItems.forEach(function (li) {
      var p = numbered(li, $('.sit', li));
      var list = $('.options', li);
      list.setAttribute('role', 'radiogroup');
      list.setAttribute('aria-labelledby', p.id);
      $$('li', list).forEach(function (opt) {
        var label = radio('opt', 'style-q' + li.getAttribute('data-q'), opt.getAttribute('data-style'));
        var face = $('span', label);
        var text = el('span');
        while (opt.firstChild) text.appendChild(opt.firstChild);
        face.appendChild(text);
        opt.appendChild(label);
      });
    });

    setUp(styleForm, {
      items: sitItems,
      noun: 'situation',
      result: function (test) {
        var rows = $$('.key-table tr[data-style]', test);
        var heads = $$('.key-table thead th', test).map(function (th) { return clean(th.textContent); });
        var styles = rows.map(function (tr) {
          var code = tr.getAttribute('data-style');
          var cells = $$('td', tr);
          return {
            code: code, row: tr,
            label: clean($('th', tr).textContent),
            strong: clean(cells[0].textContent), risk: clean(cells[1].textContent),
            value: $$('input:checked', styleForm).filter(function (i) { return i.value === code; }).length
          };
        });
        var total = sitItems.length;
        var hi = Math.max.apply(null, styles.map(function (s) { return s.value; }));
        var top = styles.filter(function (s) { return s.value === hi; });
        var mixed = top.length > 1;

        var out = [el('p', 'res-kicker', 'Your style')];
        var main = el('p', 'res-main');
        main.appendChild(el('span', 'res-level', mixed
          ? 'Mixed: ' + joinNames(top.map(function (s) { return s.label; }))
          : top[0].label));
        out.push(main);
        if (mixed) out.push(el('p', 'res-text', joinNames(top.map(function (s) { return s.label; })) + ' have the same number of answers (' + hi + ' of ' + total + '), so you mix these styles.'));
        top.forEach(function (s) {
          s.row.classList.add('is-yours');
          var p = el('p', 'res-text');
          if (mixed) { p.appendChild(el('b', '', s.label + '. ')); }
          p.appendChild(el('b', '', (heads[1] || 'Strong side') + ': '));
          p.appendChild(document.createTextNode(s.strong + ' '));
          p.appendChild(el('b', '', (heads[2] || 'Risk') + ': '));
          p.appendChild(document.createTextNode(s.risk));
          out.push(p);
        });
        out.push(bars(styles.map(function (s) {
          return { label: s.label, value: s.value, cls: s.value === hi ? 'is-top' : '', tag: !mixed && s.value === hi ? 'your style' : '' };
        }), total));
        return out;
      }
    });
  }
})();
