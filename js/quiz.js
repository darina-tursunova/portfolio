/* Small helpers for the task sheets.
   Task 8: phone layout of the tables in the test cards.
   Task 3: True/False and Fact/Opinion self-checks.
   Without this file the lists and tables stay readable as a printed sheet. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var uid = 0;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
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

  /* ------------------- Task 3: True/False and Fact/Opinion self-checks */
  // The statements are a plain list in the HTML (the key is in <details> below it).
  // Here each statement gets two buttons; the answer is shown only after a click.

  var KINDS = {
    tf: { title: 'Try it: true or false?', options: [['true', 'True'], ['false', 'False']] },
    fo: { title: 'Try it: fact or opinion?', options: [['fact', 'Fact'], ['opinion', 'Opinion']] }
  };

  $$('ol.quiz-tf, ol.quiz-fo').forEach(function (list) {
    var kind = KINDS[list.classList.contains('quiz-tf') ? 'tf' : 'fo'];
    var lis = $$('li[data-answer]', list);
    if (!lis.length) return;
    var total = lis.length, right = 0, done = 0;
    var names = {};
    kind.options.forEach(function (o) { names[o[0]] = o[1]; });

    var wrap = el('div', 'sq');
    var head = el('div', 'sq-head');
    var score = el('p', 'sq-score');
    var scoreNum = el('b', '', '0');
    score.setAttribute('role', 'status');
    score.setAttribute('aria-label', 'Score: 0 of ' + total);
    score.appendChild(scoreNum);
    score.appendChild(document.createTextNode(' / ' + total));
    var reset = el('button', 'sq-reset', 'Reset');
    reset.type = 'button';
    head.appendChild(el('p', 'sq-title', kind.title));
    head.appendChild(score);
    head.appendChild(reset);
    var end = el('p', 'sq-end');
    end.hidden = true;
    list.parentNode.insertBefore(wrap, list);
    wrap.appendChild(head); wrap.appendChild(list); wrap.appendChild(end);

    function paint() {
      scoreNum.textContent = String(right);
      score.setAttribute('aria-label', 'Score: ' + right + ' of ' + total);
      end.hidden = done < total;
      if (done >= total) end.textContent = 'Done: ' + right + ' of ' + total + ' correct. The full key for the teacher is below.';
    }

    var items = lis.map(function (li, i) {
      // the key leaves the page source of the widget and lives only here
      var answer = li.getAttribute('data-answer'), explain = li.getAttribute('data-explain') || '';
      li.removeAttribute('data-answer'); li.removeAttribute('data-explain');
      li.setAttribute('data-q', String(i + 1));
      var p = numbered(li, null, 'sq-text');
      var group = el('div', 'sq-btns');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-labelledby', p.id);
      var fb = el('p', 'sq-fb');
      fb.setAttribute('aria-live', 'polite');
      fb.hidden = true;
      var buttons = kind.options.map(function (o) {
        var b = el('button', 'sq-btn', o[1]);
        b.type = 'button'; b.value = o[0];
        b.setAttribute('aria-pressed', 'false');
        group.appendChild(b);
        return b;
      });
      li.appendChild(group); li.appendChild(fb);

      var item = { answered: false };
      item.clear = function () {
        item.answered = false;
        li.classList.remove('is-right', 'is-wrong');
        buttons.forEach(function (b) { b.disabled = false; b.className = 'sq-btn'; b.setAttribute('aria-pressed', 'false'); });
        fb.hidden = true; fb.textContent = '';
      };
      group.addEventListener('click', function (e) {
        var b = e.target.closest('.sq-btn');
        if (!b || item.answered) return;
        item.answered = true;
        var ok = b.value === answer;
        done += 1; if (ok) right += 1;
        li.classList.add(ok ? 'is-right' : 'is-wrong');
        b.setAttribute('aria-pressed', 'true');
        b.classList.add(ok ? 'is-right' : 'is-wrong');
        buttons.forEach(function (o) {
          if (o === b) return;
          o.disabled = true;
          if (!ok && o.value === answer) o.classList.add('is-answer');
        });
        fb.textContent = '';
        fb.appendChild(el('b', '', ok ? 'Right. ' : 'Not quite: ' + names[answer].toLowerCase() + '. '));
        fb.appendChild(document.createTextNode(explain));
        fb.hidden = false;
        paint();
      });
      return item;
    });

    reset.addEventListener('click', function () {
      right = 0; done = 0;
      items.forEach(function (it) { it.clear(); });
      paint();
    });
  });
})();
