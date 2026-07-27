/* =============================================================================
 * BottomLine · src/components/FrostView.js
 * -----------------------------------------------------------------------------
 * ❄️ כְּפוֹר פרספקטיבה — the Frost Perspective.
 * One click freezes the dashboard noise behind an ice overlay and shows a
 * dual-column, native-RTL master overview for ADHD alignment:
 *   ✅ משימות שבוצעו — this month's kills, chronological, each stamped with
 *      the avatar + name of the partner who executed it
 *   ⏳ משימות שלא נעשו — every remaining quest across all lanes, unified,
 *      so nothing is "out of sight, out of mind"
 * Live: while frozen, partner activity still streams into the lists.
 * Close: ✕ button, backdrop click, or Esc.
 * ========================================================================== */
(function () {
  'use strict';

  const esc = (s) => App.utils.escapeHtml(s);
  const ui = { open: false };
  let root = null;

  const fmtWhen = (ts) =>
    new Date(ts).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' · ' +
    new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });

  function doneThisMonth(state) {
    const mk = App.utils.monthKey();
    return state.tasks
      .filter((t) => t.done && t.completedAt &&
        (new Date(t.completedAt).getFullYear() + '-' + String(new Date(t.completedAt).getMonth() + 1).padStart(2, '0')) === mk)
      .sort((a, b) => a.completedAt - b.completedAt);
  }

  function doneRow(t, state) {
    const m = state.household.members.find((x) => x.id === t.doneById);
    const av = m ? m.emoji : '👤';
    return (
      '<div class="feed-item flex items-start gap-2" dir="auto">' +
      '<span class="text-lg leading-none">' + esc(av) + '</span>' +
      '<span class="flex-1 min-w-0">' +
      '<b>' + esc(t.doneBy || '') + '</b> · ' + esc(t.title) +
      '<span class="block text-[10px] mt-0.5" style="color:var(--dim)">' + fmtWhen(t.completedAt) + '</span>' +
      '</span></div>'
    );
  }

  function pendingRow(t, lane) {
    return (
      '<div class="feed-item" dir="auto">' + (lane ? esc(lane.emoji) + ' ' : '') + esc(t.title) +
      (lane ? '<span class="block text-[10px] mt-0.5" style="color:var(--dim)">' + esc(lane.name) + '</span>' : '') +
      '</div>'
    );
  }

  /* הספק: per-member productivity (today / this month) + household totals. */
  function statsStrip(state) {
    const today = App.utils.todayKey();
    const isToday = (ts) => { if (!ts) return false; const d = new Date(ts); return (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')) === today; };
    const humans = state.household.members.filter((m) => m.role !== 'pet');
    if (!humans.length) return '';
    let hhToday = 0, hhMonth = 0;
    const chips = humans.map((m) => {
      const mineDone = state.tasks.filter((t) => t.done && t.doneById === m.id);
      const d = mineDone.filter((t) => isToday(t.completedAt)).length;
      const mo = state.points[m.id] || 0; // 1 task = 1 point ⇒ month throughput
      hhToday += d; hhMonth += mo;
      return '<span class="feed-item" dir="auto">' + esc(m.emoji) + ' <b>' + esc(m.name) + '</b> · היום ' + d + ' · החודש ' + mo + '</span>';
    }).join('');
    return (
      '<div class="flex flex-wrap gap-2 mb-4">' + chips +
      '<span class="feed-item" dir="auto" style="border-color:#FFD166">🏠 <b>כל הבית</b> · היום ' + hhToday + ' · החודש ' + hhMonth + ' · 💰 מצבר: ₪' + state.savedTotal + '</span>' +
      '</div>'
    );
  }

  function render(state) {
    if (!ui.open) {
      if (root) { root.remove(); root = null; }
      return;
    }
    const done = doneThisMonth(state);
    const laneOrder = {};
    state.lanes.forEach((l, i) => { laneOrder[l.id] = i; });
    const pending = state.tasks
      .filter((t) => !t.done)
      .slice()
      .sort((a, b) => (laneOrder[a.laneId] - laneOrder[b.laneId]) || (a.createdAt - b.createdAt));
    const laneOf = (t) => state.lanes.find((l) => l.id === t.laneId);

    if (!root) {
      root = document.createElement('div');
      root.className = 'frost-overlay';
      root.setAttribute('data-action', 'frost-close');
      document.body.appendChild(root);
    }
    root.innerHTML =
      '<div class="card neon frost-card" style="--lane:#7DD3FC" dir="rtl">' +
      '<div class="flex items-center gap-3 mb-1">' +
      '<h2 class="font-display text-xl md:text-2xl font-extrabold flex-1">❄️ מבט על / כְּפוֹר פרספקטיבה</h2>' +
      '<button data-action="frost-close" class="icon-btn text-lg" aria-label="סגירה">✕</button>' +
      '</div>' +
      '<p class="text-sm mb-5" style="color:var(--dim)">' +
      '<b style="color:#8FF0C8">' + done.length + ' נעשו</b> · <b style="color:#FF9EB1">' + pending.length + ' נותרו</b> החודש.</p>' +
      statsStrip(state) +
      '<div class="grid gap-5 md:grid-cols-2">' +

      '<section>' +
      '<p class="text-xs font-bold uppercase tracking-widest mb-2" style="color:#8FF0C8">✅ משימות שבוצעו · ' + done.length + '</p>' +
      (done.length
        ? '<div class="space-y-2 max-h-[52vh] overflow-y-auto pe-1">' + done.map(function(t){return doneRow(t,state)}).join('') + '</div>'
        : '<p class="text-sm italic" style="color:var(--dim)">עוד לא הושמדו משימות החודש 🌱</p>') +
      '</section>' +

      '<section>' +
      '<p class="text-xs font-bold uppercase tracking-widest mb-2" style="color:#FF9EB1">⏳ משימות שלא נעשו · ' + pending.length + '</p>' +
      (pending.length
        ? '<div class="space-y-2 max-h-[52vh] overflow-y-auto pe-1">' +
          pending.map((t) => pendingRow(t, laneOf(t))).join('') + '</div>'
        : '<p class="text-sm italic" style="color:var(--dim)">הכול נקי! ✨</p>') +
      '</section>' +

      '</div></div>';
  }

  function open() {
    ui.open = true;
    render(App.getState());
    App.fx.play('blip');
  }
  function close() {
    if (!ui.open) return;
    ui.open = false;
    render(App.getState());
  }

  function mount() {
    App.on('frost-open', open);
    /* Backdrop click closes; clicks inside the card bubble up to the backdrop
       element but their target differs — ignore those. The ✕ button closes. */
    App.on('frost-close', (el, e) => {
      if (el.classList.contains('frost-overlay') && e.target !== el) return;
      close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ui.open) close();
    });
    App.subscribe(render); // live updates while frozen
  }

  App.components.FrostView = { mount };
})();