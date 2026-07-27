/* =============================================================================
 * ButtonLine · src/components/FocusGate.js
 * -----------------------------------------------------------------------------
 * The 1-Task Focus Gate — a clean hero panel: ONE quest + ONE household clock.
 *   • SHARED sprint: the clock lives in synced state (s.sprint). Start on any
 *     screen → the same countdown ticks on every screen (drift-free: absolute
 *     endsAt, each window ticks locally). Owner controls −5/＋5 · pause · reset;
 *     everyone else watches with an "⏱ <name>" tag. Finished sprints can be
 *     cleared by anyone; TIME! celebrates on all screens at once.
 *   • No sprint yet: −/＋ tune the default minutes (5–120), Start ▶ launches.
 *   • "שגר משימה 🚀" ignites the sprint for the member selected above the
 *     clock; completion lives on the lane-card circle (full reward matrix).
 * ========================================================================== */
(function () {
  'use strict';

  const esc = (s) => App.utils.escapeHtml(s);
  const fmt = (ms) => App.utils.fmtClock(ms);
  const CIRC = 2 * Math.PI * 88; // r = 88 in a 200×200 viewBox

  let lastCelebrated = null; // sprint id whose TIME! already fired in this window
  let intId = null;

  /* Derived view of the shared clock. */
  function sprintView(state) {
    const sp = state.sprint;
    if (!sp) return null;
    const left = sp.running ? Math.max(0, sp.endsAt - Date.now()) : Math.max(0, sp.leftMs);
    return {
      sp,
      left,
      frac: sp.totalMs ? left / sp.totalMs : 0,
      mine: App.getPrefs().memberId === sp.byId,
      finished: left <= 0,
    };
  }

  /* Repaint clock visuals from CURRENT state (no full re-render). */
  function paint() {
    const root = document.getElementById('focus-root');
    if (!root) return;
    const clock = root.querySelector('[data-clock]');
    const ring = root.querySelector('[data-ring]');
    const note = root.querySelector('[data-timer-note]');
    const owner = root.querySelector('[data-sprint-owner]');
    const toggle = root.querySelector('[data-timer-toggle]');
    const card = document.getElementById('focus-card');
    if (!clock || !ring) return;

    const v = sprintView(App.getState());

    if (!v) {
      clock.textContent = fmt(App.getPrefs().timerMinutes * 60000);
      ring.style.strokeDasharray = CIRC;
      ring.style.strokeDashoffset = 0;
      if (note) note.textContent = '';
      if (owner) owner.textContent = '';
      if (toggle) toggle.textContent = '▶';
      if (card) card.classList.remove('time-up', 't-warn', 't-low');
      return;
    }

    clock.textContent = fmt(v.left);
    ring.style.strokeDasharray = CIRC;
    ring.style.strokeDashoffset = CIRC * (1 - v.frac);
    if (card) {
      card.classList.toggle('t-low', v.frac <= 0.1 && !v.finished);
      card.classList.toggle('t-warn', v.frac > 0.1 && v.frac <= 0.25);
      card.classList.toggle('time-up', v.finished);
    }
    if (note) note.textContent = v.finished ? 'הזמן תם! 🎉' : v.sp.running ? '' : '⏸';
    if (owner) owner.textContent = '⏱ ' + (v.sp.by || '');
    if (toggle) toggle.textContent = v.sp.running ? '⏸' : '▶';

    /* TIME! — fires once per sprint, on EVERY screen (the clock is shared). */
    if (v.finished && v.sp.running && lastCelebrated !== v.sp.id) {
      lastCelebrated = v.sp.id;
      App.fx.play('timeup');
    }
  }

  /* The shared clock column (used with a quest AND over the All-clear state). */
  function timerColumnTpl(state, task) {
    const v = sprintView(state);
    const humans = state.household.members.filter((m) => m.role !== 'pet');
    return (
      '<div class="shrink-0 flex flex-col items-center gap-5">' +
      (task && !v
        ? '<select data-change-action="task-assign-select" data-task-id="' + task.id + '" class="assignee-select" dir="rtl" aria-label="מי מבצע">' +
          '<option value=""' + (task.assigneeId ? '' : ' selected') + '>👤 מי מבצע?</option>' +
          humans.map((m) =>
            '<option value="' + m.id + '"' + (task.assigneeId === m.id ? ' selected' : '') + '>' + esc(m.emoji + ' ' + m.name) + '</option>'
          ).join('') +
          '</select>'
        : '') +
      '<div class="flex items-center gap-4 md:gap-5" dir="ltr">' +
      '<button data-action="timer-minus" class="chip-btn text-base" aria-label="פחות 5 דקות">−5</button>' +
      '<div class="relative h-60 w-60 md:h-64 md:w-64">' +
      '<svg viewBox="0 0 200 200" class="h-full w-full -rotate-90" aria-hidden="true">' +
      '<defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#FF3D71"/><stop offset=".55" stop-color="#FF8A3D"/><stop offset="1" stop-color="#FFC53D"/>' +
      '</linearGradient></defs>' +
      '<circle cx="100" cy="100" r="88" class="ring-track"/>' +
      '<circle cx="100" cy="100" r="88" class="ring-fill" data-ring/>' +
      '</svg>' +
      '<div class="absolute inset-0 grid place-items-center"><div class="text-center">' +
      '<div class="font-display text-5xl font-extrabold tabular-nums" data-clock aria-live="off"></div>' +
      '<div class="text-[10px] uppercase tracking-widest mt-1" style="color:var(--dim)" data-timer-note></div>' +
      '<div dir="auto" class="text-xs font-bold mt-0.5" style="color:#FF8A3D" data-sprint-owner></div>' +
      '</div></div></div>' +
      '<button data-action="timer-plus" class="chip-btn text-base" aria-label="עוד 5 דקות">＋5</button>' +
      '</div>' +
      (v
        ? '<div class="flex gap-2">' +
          (v.finished ? '' : '<button data-action="timer-toggle" data-timer-toggle class="btn-soft">⏸</button>') +
          '<button data-action="timer-reset" class="btn-soft">↺</button>' +
          '</div>'
        : '') +
      (task
        ? '<div class="flex gap-4">' +
          (v ? '' : '<button data-action="mission-launch" class="btn-mission">שגר משימה 🚀</button>') +
          '<button data-action="focus-skip" class="btn-mission">דילוג ↷</button>' +
          '</div>'
        : '') +
      '</div>'
    );
  }

  /* ============================== templates ================================ */
  function emptyTpl(state) {
    return (
      '<div class="p-10 md:p-14 text-center" id="focus-card">' +
      '<p class="font-display text-3xl md:text-4xl font-extrabold">הכול נקי ✨</p>' +
      (state.sprint
        ? '<div class="mt-6 flex justify-center">' + timerColumnTpl(state, task) + '</div>'
        : '') +
      '<div class="mt-6 flex justify-center gap-3 flex-wrap">' +
      '<button data-action="focus-pick" class="btn-soft">🎯 המשימה הבאה</button>' +
      '</div>' +
      '</div>'
    );
  }

  /* LIVE-MISSION LAW (Dario): the zone below the clock renders ONLY while the
   * shared sprint is alive — fed by the sprint itself (one source of truth, the
   * SAME on every screen). No sprint → the zone is completely empty. */
  function missionZoneTpl(state) {
    const sp = state.sprint;
    if (!sp) return '';
    const live = sp.taskId ? state.tasks.find((t) => t.id === sp.taskId && !t.done) : null;
    const lane = live ? state.lanes.find((l) => l.id === live.laneId) : null;
    const theme = App.LANE_THEME[lane ? lane.color : 'teal'] || App.LANE_THEME.teal;
    const doneSteps = live ? live.steps.filter((x) => x.done).length : 0;
    return (
      '<div class="w-full text-center min-w-0">' +
      (lane
        ? '<span class="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold" style="background:' + theme.soft + ';color:' + theme.ink + ';border:1px solid ' + theme.bar + '40">' +
          esc(lane.emoji + ' ' + lane.name) + '</span>'
        : '') +
      '<h2 dir="auto" class="font-display mt-4 text-3xl md:text-5xl font-extrabold leading-tight">' +
      esc(live ? live.title : (sp.taskTitle || '')) + '</h2>' +
      (live && live.steps.length
        ? '<ul class="mt-6 space-y-2.5 max-w-xl mx-auto">' +
          live.steps.map((x) => App.utils.stepRow(live, x, 'g')).join('') + '</ul>' +
          '<p class="mt-2.5 text-sm" style="color:var(--dim)">' + doneSteps + '/' + live.steps.length + '</p>'
        : '') +
      '</div>'
    );
  }

  function render(state) {
    const root = document.getElementById('focus-root');
    if (!root) return;
    const task = App.focusedTask(state);

    if (!task && !state.sprint) { root.innerHTML = emptyTpl(state); paint(); return; }

    const theme = App.LANE_THEME.teal;
    root.innerHTML =
      '<div class="relative py-4 md:py-8" id="focus-card" style="--lane:' + theme.bar + '">' +
      '<div class="flex flex-col items-center gap-7 relative">' +
      timerColumnTpl(state, task) +
      missionZoneTpl(state) +
      '</div></div>';

    paint();
  }

  /* =============================== actions ================================= */
  function mount() {

    App.on('mission-launch', () => {
      const t = App.focusedTask(App.getState());
      if (!t) return;
      if (!t.assigneeId) { App.toast('⏱ בחרו בן בית מעל השעון — ואז שיגור'); return; }
      if (App.actions.sprintStart()) App.fx.play('blip');
    });

    App.on('task-assign-select', (el) => {
      App.actions.assignTask(el.dataset.taskId, el.value || null);
      App.fx.play('blip');
    });

    App.on('focus-skip', () => { App.actions.skipFocus(); App.fx.play('blip'); });

    App.on('focus-pick', () => {
      if (!App.actions.pickNextFocus()) App.toast('💭 Brain Dump');
    });

    App.on('timer-toggle', () => {
      const sp = App.getState().sprint;
      if (sp) App.actions.sprintToggle();
      else if (App.actions.sprintStart()) App.fx.play('blip');
    });

    App.on('timer-reset', () => {
      lastCelebrated = null;
      App.actions.sprintReset();
    });

    App.on('timer-minus', () => {
      const sp = App.getState().sprint;
      if (sp) { App.actions.sprintAdjust(-5); return; }
      const m = App.utils.clamp(App.getPrefs().timerMinutes - 5, 5, 120);
      App.actions.setTimerMinutes(m);
      App.fx.play('blip');
    });

    App.on('timer-plus', () => {
      const sp = App.getState().sprint;
      if (sp) { App.actions.sprintAdjust(5); return; }
      const m = App.utils.clamp(App.getPrefs().timerMinutes + 5, 5, 120);
      App.actions.setTimerMinutes(m);
      App.fx.play('blip');
    });

    intId = setInterval(paint, 250); // shared clock ticks locally, drift-free
    window.addEventListener('beforeunload', () => clearInterval(intId));

    App.subscribe(render);
  }

  App.components.FocusGate = { mount };
})();
