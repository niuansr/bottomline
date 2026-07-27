/* =============================================================================
 * BottomLine · src/components/TaskLanes.js
 * -----------------------------------------------------------------------------
 * The quest lanes:
 *   • 4 constitutional lanes + up to 2 custom slots — spacious neon cards
 *     (🚨 pulsing fire glow · 💰 golden shimmer float)
 *   • Collapse toggles, quick-add per lane, metaphor flavor lines
 *   • Quest cards: destroy / focus / 🪄 break-it-down / ＋ step /
 *     armed two-click delete with Undo (nothing dies by accident)
 *   • Anti-Overload Split Gate: >4 steps ⇒ flag + 1-click “Split ×2”
 *   • 📅 calendar-date picker + 👤 quick assignee picker (v1.15.0)
 * ========================================================================== */
(function () {
  'use strict';

  const esc = (s) => App.utils.escapeHtml(s);

  const ui = {
    addStepFor: null,
    editing: null,
    laneIdx: 0,
    slideDir: null,
    armed: Object.create(null),
    newLaneOpen: false,
    dateFor: null,
    assignFor: null,
  };

  const rerender = () => render(App.getState());

  function arm(key) {
    if (ui.armed[key]) return true;
    ui.armed[key] = setTimeout(() => { delete ui.armed[key]; rerender(); }, 3000);
    rerender();
    return false;
  }
  function disarm(key) {
    if (ui.armed[key]) clearTimeout(ui.armed[key]);
    delete ui.armed[key];
  }

  /* ============================== templates ================================ */
  function editTpl(t, state) {
    return (
      '<article data-card-id="' + t.id + '" class="task-card rounded-xl border border-line p-4" ' +
      'style="background:var(--panel2); border-inline-start:4px solid var(--lane)">' +
      '<p class="text-xs font-bold mb-2" style="color:var(--lane-ink)">✏️ Edit quest</p>' +
      '<input dir="auto" data-edit-title data-enter-action="task-edit-save" data-task-id="' + t.id + '" ' +
      'data-refocus-id="edit-title-' + t.id + '" class="inp mb-2" value="' + esc(t.title) + '" maxlength="200" aria-label="Quest name">' +
      t.steps.map((s) =>
        '<input dir="auto" data-edit-step data-step-id="' + s.id + '" data-enter-action="task-edit-save" ' +
        'data-task-id="' + t.id + '" class="inp mb-1.5 text-sm" value="' + esc(s.text) + '" maxlength="140" ' +
        'placeholder="empty = remove this step" aria-label="Sub-step">'
      ).join('') +
      '<label class="block text-xs mt-1 mb-1" style="color:var(--dim)">Lane (category override):</label>' +
      '<select data-edit-lane class="inp mb-3">' +
      state.lanes.map((l) =>
        '<option value="' + l.id + '"' + (l.id === t.laneId ? ' selected' : '') + '>' +
        esc(l.emoji + ' ' + l.name) + '</option>'
      ).join('') +
      '</select>' +
      '<div class="flex gap-1.5">' +
      '<button data-action="task-edit-save" data-task-id="' + t.id + '" class="mini-btn mini-accent">💾 שמור</button>' +
      '<button data-action="task-edit-cancel" class="mini-btn">Cancel</button>' +
      '</div></article>'
    );
  }

  function datePopoverTpl(t) {
    return (
      '<div class="mt-2 p-2 rounded-lg border border-line" style="background:var(--panel2)">' +
      '<input dir="ltr" data-date-input data-enter-action="task-date-save" data-task-id="' + t.id + '" ' +
      'data-refocus-id="datepick-' + t.id + '" class="inp text-sm" placeholder="20/05/2026" maxlength="10" ' +
      'value="' + esc(t.calendarDate || '') + '">' +
      '<div class="flex gap-1.5 mt-1.5">' +
      '<button data-action="task-date-save" data-task-id="' + t.id + '" class="mini-btn mini-accent">📅 שמור ליומן</button>' +
      (t.calendarDate
        ? '<button data-action="task-date-clear" data-task-id="' + t.id + '" class="mini-btn">✕ הסר</button>'
        : '') +
      '<button data-action="task-date-cancel" class="mini-btn">Cancel</button>' +
      '</div></div>'
    );
  }

  function assignPopoverTpl(t, state) {
    const humans = state.household.members.filter((m) => m.role !== 'pet');
    if (!humans.length) {
      return '<div class="mt-2 p-2 rounded-lg border border-line text-xs" style="background:var(--panel2);color:var(--dim)">אין עדיין בני בית מוגדרים.</div>';
    }
    return (
      '<div class="mt-2 p-2 rounded-lg border border-line" style="background:var(--panel2)">' +
      '<div class="flex flex-wrap gap-1.5">' +
      humans.map((m) =>
        '<button data-action="task-assign-pick" data-task-id="' + t.id + '" data-member-id="' + m.id + '" ' +
        'class="mini-btn' + (t.assigneeId === m.id ? ' mini-accent' : '') + '" dir="auto">' +
        esc(m.emoji) + ' ' + esc(m.name) + '</button>'
      ).join('') +
      '</div></div>'
    );
  }

  function cardTpl(t, state) {
    if (ui.editing === t.id) return editTpl(t, state);
    const focused = App.getPrefs().focusTaskId === t.id;
    const overload = App.isOverloaded(t);
    const doneSteps = t.steps.filter((s) => s.done).length;
    const armed = !!ui.armed['task:' + t.id];
    const fresh = Date.now() - t.createdAt < 800;
    const assignee = t.assigneeId ? state.household.members.find((m) => m.id === t.assigneeId) : null;

    return (
      '<article data-card-id="' + t.id + '" class="task-card group relative rounded-xl border p-4 transition ' +
      'hover:-translate-y-0.5' +
      (focused ? ' neon' : ' border-line') +
      (fresh ? ' slide-in' : '') +
      '" style="background:var(--panel2); border-inline-start:4px solid var(--lane)">' +
      '<div class="flex items-start gap-3">' +
      '<button data-action="task-complete" data-task-id="' + t.id + '" class="tick" aria-label="Destroy quest" title="Destroy (+100 XP)"></button>' +
      '<div class="flex-1 min-w-0">' +
      '<p dir="auto" class="font-medium leading-snug text-[0.95rem]">' + esc(t.title) +
      (focused
        ? ' <span class="ms-1 align-middle text-[10px] font-bold rounded-full px-1.5 py-0.5" style="background:var(--lane-soft);color:var(--lane-ink)">🎯 בשער שלי</span>'
        : '') +
      '</p>' +
      (overload
        ? '<p class="overload-chip pulse-attn">🧠 ' + t.steps.length + ' steps — too heavy for one brain-slot</p>'
        : '') +
      (t.steps.length
        ? '<ul class="mt-2.5 space-y-1.5">' + t.steps.map((s) => App.utils.stepRow(t, s, 'l')).join('') + '</ul>' +
          '<p class="mt-1 text-[11px]" style="color:var(--dim)">' + doneSteps + '/' + t.steps.length + '</p>'
        : '') +
      (ui.addStepFor === t.id
        ? '<div class="mt-2 flex gap-1.5">' +
          '<input dir="auto" data-enter-action="task-step-save" data-task-id="' + t.id + '" data-refocus-id="stepnew-' + t.id + '" class="inp flex-1 text-sm" placeholder="Tiny step…" maxlength="140">' +
          '<button data-action="task-step-save" data-task-id="' + t.id + '" class="btn-soft text-xs">הוסף</button></div>'
        : '') +
      (ui.dateFor === t.id ? datePopoverTpl(t) : '') +
      (ui.assignFor === t.id ? assignPopoverTpl(t, state) : '') +
      '<div class="mt-3 flex flex-wrap items-center gap-1.5">' +
      (overload ? '<button data-action="task-split" data-task-id="' + t.id + '" class="mini-btn mini-accent">✂️ פיצול ×2</button>' : '') +
      '<button data-action="task-edit-open" data-task-id="' + t.id + '" class="mini-btn">✏️</button>' +
      '<button data-action="task-date-open" data-task-id="' + t.id + '" class="mini-btn ' + (t.calendarDate ? 'ind-on' : 'ind-off') + '">📅</button>' +
      '<button data-action="task-assign-open" data-task-id="' + t.id + '" class="mini-btn ' + (assignee ? 'ind-on' : 'ind-off') + '">👤</button>' +
      '<button data-action="task-step-open" data-task-id="' + t.id + '" class="mini-btn">＋ step</button>' +
      '<button data-action="task-delete" data-task-id="' + t.id + '" class="mini-btn' + (armed ? ' mini-danger' : '') + '">' + (armed ? 'Sure? 🗑' : '🗑') + '</button>' +
      '</div></div></div></article>'
    );
  }

  function laneTpl(lane, state) {
    const theme = App.LANE_THEME[lane.color] || App.LANE_THEME.teal;
    const tasks = App.laneTasks(state, lane.id);
    const armed = !!ui.armed['lane:' + lane.id];
    const skin = lane.id === 'meteors' && tasks.length ? ' fire-glow'
               : lane.id === 'wealth' ? ' gold-shimmer' : '';

    return (
      '<section class="lane card neon overflow-hidden' + (lane.collapsed ? ' collapsed' : '') + skin + '" ' +
      'style="--lane:' + theme.bar + ';--lane-soft:' + theme.soft + ';--lane-ink:' + theme.ink + '">' +
      '<header class="flex items-center gap-2 px-4 py-3.5" style="background:' + theme.soft + '">' +
      '<button data-action="lane-toggle" data-lane-id="' + lane.id + '" class="lane-chev" aria-expanded="' + String(!lane.collapsed) + '" title="Collapse / expand">▾</button>' +
      '<h3 class="font-display font-bold text-[1.05rem] flex-1 truncate" style="color:' + theme.ink + '">' + esc(lane.emoji) + ' ' + esc(lane.name) + '</h3>' +
      '<span class="count-pill" style="background:' + theme.bar + '">' + tasks.length + '</span>' +
      (lane.custom
        ? '<button data-action="lane-remove" data-lane-id="' + lane.id + '" class="icon-btn' + (armed ? ' mini-danger' : '') + '" title="Remove lane (its quests move to 🪰 Chaos)">' + (armed ? 'Sure?' : '✕') + '</button>'
        : '') +
      '</header>' +
      '<div class="lane-body"><div class="lane-inner px-4 pb-4 pt-3 space-y-3">' +
      (tasks.length
        ? tasks.map((t) => cardTpl(t, state)).join('')
        : '') +
      '<div class="flex gap-2 pt-1">' +
      '<input dir="auto" data-enter-action="lane-add" data-lane-id="' + lane.id + '" data-lane-input="' + lane.id + '" data-refocus-id="lane-input-' + lane.id + '" class="inp flex-1" placeholder="＋ משימה חדשה לקטגוריה…" maxlength="200">' +
      '<button data-action="lane-add" data-lane-id="' + lane.id + '" class="btn-soft">הוסף</button>' +
      '</div></div></div></section>'
    );
  }

  function addLaneTpl(state) {
    const customs = state.lanes.filter((l) => l.custom).length;
    const max = App.constants.MAX_CUSTOM_LANES;
    if (customs >= max) {
      return '<div class="rounded-2xl border-2 border-dashed border-line grid place-items-center p-6 text-sm text-center" style="color:var(--dim)">✨ ' + max + '/' + max + '</div>';
    }
    if (!ui.newLaneOpen) {
      return (
        '<button data-action="lane-new-open" class="rounded-2xl border-2 border-dashed border-line p-6 text-sm font-semibold transition text-center w-full hover:border-[color:var(--focus)]" style="color:var(--dim)">' +
        '＋ New lane<span class="block text-xs font-normal mt-1">' + customs + '/' + max + ' custom slots used</span></button>'
      );
    }
    return (
      '<div class="rounded-2xl border-2 border-dashed border-line p-5 space-y-2.5">' +
      '<p class="text-sm font-semibold">Name your lane</p>' +
      '<div class="flex gap-2">' +
      '<input dir="auto" data-enter-action="lane-new-create" data-new-lane-input class="inp flex-1" placeholder="למשל: פרויקטים גדולים" maxlength="24">' +
      '<button data-action="lane-new-create" class="btn-soft">Create</button></div>' +
      '<button data-action="lane-new-cancel" class="text-xs underline" style="color:var(--dim)">cancel</button></div>'
    );
  }

  function render(state) {
    const root = document.getElementById('lanes-root');
    if (!root) return;
    const slides = state.lanes.map((l) => ({ type: 'lane', lane: l }));
    slides.push({ type: 'add' });
    ui.laneIdx = Math.max(0, Math.min(ui.laneIdx, slides.length - 1));

    const cur = slides[ui.laneIdx];
    const inner = cur.type === 'lane'
      ? laneTpl(cur.lane, state)
      : '<div class="max-w-md mx-auto">' + addLaneTpl(state) + '</div>';
    const dirCls = ui.slideDir === 'next' ? ' enter-left' : ui.slideDir === 'prev' ? ' enter-right' : '';
    ui.slideDir = null;

    App.utils.setHtmlPreserving(root,
      '<div class="relative max-w-3xl mx-auto">' +
      '<button data-action="lane-next" dir="ltr" class="nav-arrow nav-side-left" aria-label="הקטגוריה הבאה">◀</button>' +
      '<button data-action="lane-prev" dir="ltr" class="nav-arrow nav-side-right" aria-label="הקטגוריה הקודמת">▶</button>' +
      '<div class="px-12 md:px-14"><div class="' + dirCls.trim() + '">' + inner + '</div></div>' +
      '</div>' +
      '<div class="mt-4 flex justify-center gap-2">' +
      slides.map((s, i) =>
        '<button data-action="lane-goto" data-idx="' + i + '" class="lane-dot' + (i === ui.laneIdx ? ' lane-dot-on' : '') + '" ' +
        'aria-label="' + (s.type === 'lane' ? esc(s.lane.name) : 'New lane') + '">' +
        (s.type === 'lane' ? esc(s.lane.emoji) : '＋') + '</button>'
      ).join('') +
      '</div>');
  }

  /* =============================== actions ================================= */
  function readLaneInput(laneId) {
    return document.querySelector('[data-lane-input="' + laneId + '"]');
  }

  function mount() {
    const go = (delta) => {
      const len = App.getState().lanes.length + 1;
      ui.slideDir = delta > 0 ? 'next' : 'prev';
      ui.laneIdx = (ui.laneIdx + delta + len) % len;
      rerender();
      App.fx.play('blip');
    };
    App.on('lane-prev', () => go(-1));
    App.on('lane-next', () => go(1));
    App.on('lane-goto', (el) => {
      const i = Number(el.dataset.idx);
      if (!Number.isFinite(i) || i === ui.laneIdx) return;
      ui.slideDir = i > ui.laneIdx ? 'next' : 'prev';
      ui.laneIdx = i;
      rerender();
    });
    document.addEventListener('keydown', (e) => {
      const a = document.activeElement;
      const typing = (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || (a && a.isContentEditable);
      if (typing) return;
      if (e.key === 'ArrowRight') go(-1);
      else if (e.key === 'ArrowLeft') go(1);
    });

    App.on('lane-toggle', (el) => App.actions.toggleLane(el.dataset.laneId));

    App.on('lane-add', (el) => {
      const laneId = el.dataset.laneId;
      const inp = el.tagName === 'INPUT' ? el : readLaneInput(laneId);
      if (!inp) return;
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      App.actions.addTask(laneId, v);
      App.fx.play('blip');
      const again = readLaneInput(laneId);
      if (again) { again.value = ''; again.focus(); }
    });

    App.on('task-complete', (el) => {
      const id = el.dataset.taskId;
      const card = el.closest('[data-card-id]');
      let rect = null;
      if (card) {
        const r = card.getBoundingClientRect();
        rect = { x: r.left, y: r.top, w: r.width, h: r.height };
        card.classList.add('shattering');
      }
      App.actions.completeTask(id, { rect });
    });

    App.on('task-focus', (el) => {
      App.actions.setFocus(el.dataset.taskId);
      App.fx.play('blip');
      const gate = document.getElementById('focus-root');
      if (gate) gate.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    App.on('task-split', (el) => {
      if (App.actions.splitTask(el.dataset.taskId)) {
        App.fx.play('blip');
        App.toast('✂️ Split into Part 1 + Part 2 — feather-light now.');
      }
    });

    App.on('task-step-open', (el) => {
      const id = el.dataset.taskId;
      ui.addStepFor = ui.addStepFor === id ? null : id;
      rerender();
      const inp = document.querySelector('[data-refocus-id="stepnew-' + id + '"]');
      if (inp) inp.focus();
    });

    App.on('task-step-save', (el) => {
      const id = el.dataset.taskId;
      const inp = el.tagName === 'INPUT' ? el : document.querySelector('[data-refocus-id="stepnew-' + id + '"]');
      if (!inp) return;
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      const len = App.actions.addStep(id, v);
      if (len === App.constants.OVERLOAD_LIMIT + 1) {
        App.toast('🧠 ' + len + ' צעדים — כבד! ✂️ הפיצול מוכן.');
      }
      const again = document.querySelector('[data-refocus-id="stepnew-' + id + '"]');
      if (again) { again.value = ''; again.focus(); }
    });

    App.on('task-edit-open', (el) => {
      ui.editing = el.dataset.taskId;
      ui.addStepFor = null;
      ui.dateFor = null;
      ui.assignFor = null;
      rerender();
      const inp = document.querySelector('[data-refocus-id="edit-title-' + ui.editing + '"]');
      if (inp) inp.focus();
    });

    App.on('task-edit-cancel', () => { ui.editing = null; rerender(); });

    App.on('task-edit-save', (el) => {
      const id = el.dataset.taskId;
      const card = document.querySelector('[data-card-id="' + id + '"]');
      if (!card) { ui.editing = null; rerender(); return; }
      const title = card.querySelector('[data-edit-title]');
      const laneSel = card.querySelector('[data-edit-lane]');
      const steps = Array.from(card.querySelectorAll('[data-edit-step]'))
        .map((i) => ({ id: i.dataset.stepId, text: i.value }));
      ui.editing = null;
      const movedTo = App.actions.editTask(id, {
        title: title ? title.value : undefined,
        steps,
        laneId: laneSel ? laneSel.value : undefined,
      });
      App.fx.play('blip');
      App.toast(movedTo
        ? '💾 נשמר — הועבר אל ' + esc(movedTo.emoji) + ' <b>' + esc(movedTo.name) + '</b>'
        : '💾 Quest updated.');
    });

    App.on('task-date-open', (el) => {
      const id = el.dataset.taskId;
      ui.dateFor = ui.dateFor === id ? null : id;
      ui.assignFor = null;
      rerender();
      const inp = document.querySelector('[data-refocus-id="datepick-' + id + '"]');
      if (inp) inp.focus();
    });

    App.on('task-date-save', (el) => {
      const id = el.dataset.taskId;
      const inp = el.tagName === 'INPUT' ? el : document.querySelector('[data-date-input][data-task-id="' + id + '"]');
      const v = inp ? inp.value.trim() : '';
      if (v && !/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
        App.toast('⚠️ פורמט תאריך: 20/05/2026');
        return;
      }
      const ok = App.actions.setTaskDate(id, v);
      if (ok) {
        ui.dateFor = null;
        App.fx.play('blip');
        App.toast(v
          ? 'שים לב: המשימה שויכה ליומן המשפחתי. במידה והמשימה תבוצע בדשבורד, היא תימחק גם מהיומן המשפחתי'
          : '📅 התאריך הוסר.');
        rerender();
      }
    });

    App.on('task-date-clear', (el) => {
      const id = el.dataset.taskId;
      App.actions.setTaskDate(id, '');
      ui.dateFor = null;
      App.toast('📅 התאריך הוסר.');
      rerender();
    });

    App.on('task-date-cancel', () => { ui.dateFor = null; rerender(); });

    App.on('task-assign-open', (el) => {
      const id = el.dataset.taskId;
      ui.assignFor = ui.assignFor === id ? null : id;
      ui.dateFor = null;
      rerender();
    });

    App.on('task-assign-pick', (el) => {
      const id = el.dataset.taskId;
      const memberId = el.dataset.memberId;
      App.actions.assignTask(id, memberId);
      ui.assignFor = null;
      App.fx.play('blip');
      rerender();
    });

    App.on('task-delete', (el) => {
      const id = el.dataset.taskId;
      const key = 'task:' + id;
      if (!arm(key)) return;
      disarm(key);
      const res = App.actions.deleteTask(id);
      if (res) {
        App.toast('🗑 Deleted “' + esc(App.utils.trunc(res.task.title, 40)) + '”', {
          actionLabel: 'Undo',
          onAction: () => App.actions.restoreTask(res.task, res.index),
        });
      }
    });

    App.on('lane-new-open', () => {
      ui.newLaneOpen = true;
      rerender();
      const inp = document.querySelector('[data-new-lane-input]');
      if (inp) inp.focus();
    });

    App.on('lane-new-cancel', () => { ui.newLaneOpen = false; rerender(); });

    App.on('lane-new-create', (el) => {
      const inp = el.tagName === 'INPUT' ? el : document.querySelector('[data-new-lane-input]');
      if (!inp) return;
      const v = inp.value.trim();
      if (!v) { inp.focus(); App.toast('Give the lane a short name 🙂'); return; }
      const lane = App.actions.addLane(v);
      if (lane) {
        ui.newLaneOpen = false;
        ui.slideDir = 'next';
        ui.laneIdx = App.getState().lanes.findIndex((l) => l.id === lane.id);
        App.fx.play('blip');
        App.toast(esc(lane.emoji) + ' Lane “' + esc(lane.name) + '” is ready!');
        rerender();
      }
    });

    App.on('lane-remove', (el) => {
      const id = el.dataset.laneId;
      const key = 'lane:' + id;
      if (!arm(key)) return;
      disarm(key);
      const moved = App.actions.removeLane(id);
      App.toast('Lane removed' + (moved ? ' — ' + moved + ' quest(s) moved to 🪰 Chaos' : '') + '.');
    });

    App.subscribe(render);
  }

  App.components.TaskLanes = { mount };
})();

