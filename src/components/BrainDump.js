/* =============================================================================
 * ButtonLine · src/components/BrainDump.js
 * -----------------------------------------------------------------------------
 * The sticky bottom capture bar — zero-friction thought disposal:
 *   • Type (or voice-dump 🎤 where the browser supports it) → Enter
 *   • Auto-routing evaluates Hebrew/English keywords → the right lane
 *   • Auto-hydration attaches 3 predefined micro-steps instantly
 *   • A toast tells you which lane caught it; the mind stays empty
 * ========================================================================== */
(function () {
  'use strict';

  const esc = (s) => App.utils.escapeHtml(s);
  let recognizing = false;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function render() {
    const root = document.getElementById('brain-dump-root');
    if (!root) return;
    App.utils.setHtmlPreserving(root,
      '<div class="fixed bottom-0 inset-x-0 z-40 px-4 pb-4 pt-8 pointer-events-none" ' +
      'style="background:linear-gradient(to top, rgba(9,13,22,.95) 40%, transparent)">' +
      '<div class="mx-auto max-w-3xl pointer-events-auto">' +
      '<div class="card neon flex items-center gap-2 p-2 pl-4 shadow-lift" style="--lane:#7DD3FC">' +
      '<span class="text-xl" aria-hidden="true">🧠</span>' +
      '<input id="dump-input" dir="auto" data-enter-action="dump-add" data-refocus-id="dump-input" ' +
      'class="inp flex-1 !border-0 !bg-transparent !p-2" ' +
      'placeholder="מה בראש? זרקו לכאן…" maxlength="200" ' +
      'aria-label="Brain dump a task">' +
      (SR ? '<button data-action="voice-dump" class="icon-btn text-lg" title="Voice dump" aria-pressed="' + String(recognizing) + '">' + (recognizing ? '🔴' : '🎤') + '</button>' : '') +
      '<button data-action="dump-add" class="enter-key" dir="ltr">Enter ⏎</button>' +
      '</div></div></div>');
  }

  function input() { return document.getElementById('dump-input'); }

  function dump() {
    const inp = input();
    if (!inp) return;
    const v = inp.value.trim();
    if (!v) { inp.focus(); return; }
    const created = App.actions.addTask(null, v, { autoRoute: true });
    if (created) {
      const lane = App.getState().lanes.find((l) => l.id === created.laneId);
      App.fx.play('blip');
      App.toast(lane ? esc(lane.emoji) + ' נותב אל <b>' + esc(lane.name) + '</b>' : 'נקלט ✅');
    }
    const fresh = document.getElementById('dump-input') || inp; // node was re-rendered
    fresh.value = '';
    fresh.focus();
  }

  function voiceDump() {
    if (!SR || recognizing) return;
    let rec = null;
    try {
      rec = new SR();
    } catch (e) { App.toast('🎤 Voice input isn’t available in this browser.'); return; }
    rec.lang = /^he/i.test(navigator.language || '') ? 'he-IL' : (navigator.language || 'en-US');
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognizing = true;
    render();
    rec.onresult = (e) => {
      const text = e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '';
      const inp = input();
      if (inp && text) { inp.value = text; dump(); }
    };
    rec.onerror = () => { App.toast('🎤 Couldn’t hear that — typing works always.'); };
    rec.onend = () => { recognizing = false; render(); };
    try { rec.start(); } catch (e) { recognizing = false; render(); }
  }

  function mount() {
    render(); // static bar — no re-render on state changes, keeps typing safe
    App.on('dump-add', dump);
    if (SR) App.on('voice-dump', voiceDump);
  }

  App.components.BrainDump = {
    mount,
    focus() {
      const inp = input();
      if (inp) { inp.focus(); inp.scrollIntoView({ behavior: 'smooth', block: 'end' }); }
    },
  };
})();
