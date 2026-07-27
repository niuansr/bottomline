/* =============================================================================
 * BottomLine · src/components/Routines.js
 * ========================================================================== */
(function () {
  'use strict';

  const esc = (s) => App.utils.escapeHtml(s);
  const ui = { addOpen: false, editing: null, armed: Object.create(null), quietSnap: null, wasAllDone: false };
  const rerender = () => render(App.getState());

  function arm(key) {
    if (ui.armed[key]) return true;
    ui.armed[key] = setTimeout(() => { delete ui.armed[key]; rerender(); }, 3000);
    rerender();
    return false;
  }
  function disarm(key) { if (ui.armed[key]) clearTimeout(ui.armed[key]); delete ui.armed[key]; }

  function todayDMY() {
    if (App.utils.todayDMY) return App.utils.todayDMY();
    const p = App.utils.todayKey().split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function sorted(routines) {
    return routines.slice().sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });
  }

  function rowTpl(r, state) {
    const assignee = r.assigneeId ? state.household.members.find((m) => m.id === r.assigneeId) : null;
    const armed = !!ui.armed['rt:' + r.id];
    const boxId = 'rt-' + r.id;
    return (
      '<div class="step rt-row" data-rt-row="' + r.id + '">' +
      '<input type="checkbox" id="' + boxId + '" data-change-action="routine-toggle" data-id="' + r.id + '">' +
      '<span class="rt-time' + (r.time ? '' : ' rt-time-empty') + '" dir="ltr">' + (r.time ? esc(r.time) : '') + '</span>' +
      '<label for="' + boxId + '" dir="auto" class="rt-title">' + esc(r.title) + (r.saves ? ' <span class="coin-icon"><svg viewBox="0 0 24 24" width="100%" height="100%"><defs><radialGradient id="bcg" cx="35%" cy="30%"><stop offset="0%" stop-color="#FFE8C2"/><stop offset="45%" stop-color="#CD7F32"/><stop offset="100%" stop-color="#5C3A14"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#bcg)" stroke="#4A2E0F" stroke-width="1"/><circle cx="12" cy="12" r="9" fill="none" stroke="#4A2E0F" stroke-width="0.5" stroke-dasharray="1 0.8" opacity="0.6"/><rect x="9.2" y="9.2" width="5.6" height="5.6" fill="#0F1524" stroke="#4A2E0F" stroke-width="0.8"/><path d="M6 8.5a8 8 0 0 1 5-3.2" fill="none" stroke="#FFF3DC" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/></svg></span>' : '') + '</label>' +
      '<span></span>' +
      (assignee ? '<span class="text-base leading-none" title="' + esc(assignee.name) + '">' + esc(assignee.emoji) + '</span>' : '<span></span>') +
      '<button data-action="routine-edit-open" data-id="' + r.id + '" class="icon-btn text-xs" aria-label="עריכת רוטינה">✏️</button>' +
      '<button data-action="routine-del" data-id="' + r.id + '" class="icon-btn text-xs' + (armed ? ' mini-danger' : '') + '" aria-label="מחיקת רוטינה">' + (armed ? 'בטוח?' : '✕') + '</button>' +
      '</div>'
    );
  }

  function calRowTpl(t, state) {
    const assignee = t.assigneeId ? state.household.members.find((m) => m.id === t.assigneeId) : null;
    const boxId = 'cal-' + t.id;
    return (
      '<div class="step rt-row" data-rt-row="cal-' + t.id + '">' +
      '<input type="checkbox" id="' + boxId + '" data-change-action="cal-task-toggle" data-id="' + t.id + '">' +
      '<span class="rt-time rt-time-empty"></span>' +
      '<label for="' + boxId + '" dir="auto" class="rt-title">' + esc(t.title) + '</label>' +
      '<span class="text-base leading-none" title="משימה מהיומן">📅</span>' +
      (assignee ? '<span class="text-base leading-none" title="' + esc(assignee.name) + '">' + esc(assignee.emoji) + '</span>' : '<span></span>') +
      '<span></span><span></span>' +
      '</div>'
    );
  }

  function editRowTpl(r, state) {
    const humans = state.household.members.filter((m) => m.role !== 'pet');
    return (
      '<div class="rt-form space-y-2" style="background:var(--panel)" data-rt-editing="' + r.id + '">' +
      '<div class="flex gap-2">' +
      '<input dir="auto" data-rte-title data-enter-action="routine-edit-save" data-id="' + r.id + '" data-refocus-id="rte-' + r.id + '" class="inp !p-2 text-sm flex-1" maxlength="120" value="' + esc(r.title) + '">' +
      '<input dir="ltr" data-rte-time class="inp !p-2 text-sm" style="max-width:5.5rem" placeholder="16:00" maxlength="5" value="' + esc(r.time || '') + '">' +
      '</div>' +
      '<div class="flex items-center gap-3 flex-wrap">' +
      '<label class="flex items-center gap-1.5 text-xs" style="color:var(--dim)"><span class="coin-icon"><svg viewBox="0 0 24 24" width="100%" height="100%"><defs><radialGradient id="bcg" cx="35%" cy="30%"><stop offset="0%" stop-color="#FFE8C2"/><stop offset="45%" stop-color="#CD7F32"/><stop offset="100%" stop-color="#5C3A14"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#bcg)" stroke="#4A2E0F" stroke-width="1"/><circle cx="12" cy="12" r="9" fill="none" stroke="#4A2E0F" stroke-width="0.5" stroke-dasharray="1 0.8" opacity="0.6"/><rect x="9.2" y="9.2" width="5.6" height="5.6" fill="#0F1524" stroke="#4A2E0F" stroke-width="0.8"/><path d="M6 8.5a8 8 0 0 1 5-3.2" fill="none" stroke="#FFF3DC" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/></svg></span><input type="checkbox" data-rte-saves class="!w-4 !h-4"' + (r.saves ? ' checked' : '') + '></label>' +
      '<select data-rte-assignee class="inp !p-1.5 text-xs" style="max-width:9rem">' +
      '<option value="">🏠</option>' +
      humans.map((m) => '<option value="' + m.id + '"' + (r.assigneeId === m.id ? ' selected' : '') + '>' + esc(m.emoji + ' ' + m.name) + '</option>').join('') +
      '</select>' +
      '<button data-action="routine-edit-save" data-id="' + r.id + '" class="mini-btn mini-accent" style="--lane:#34D399">💾</button>' +
      '<button data-action="routine-edit-cancel" class="mini-btn">ביטול</button>' +
      '</div></div>'
    );
  }

  function addFormTpl(state) {
    const humans = state.household.members.filter((m) => m.role !== 'pet');
    return (
      '<div class="mt-3 rt-form space-y-2">' +
      '<div class="flex gap-2">' +
      '<input dir="auto" data-rt-title data-enter-action="routine-add-save" data-refocus-id="rt-new-title" class="inp !p-2 text-sm flex-1" placeholder="שם הרוטינה…" maxlength="120">' +
      '<input dir="ltr" data-rt-time class="inp !p-2 text-sm" style="max-width:5.5rem" placeholder="16:00" maxlength="5" aria-label="שעה (רשות)">' +
      '</div>' +
      '<div class="flex items-center gap-3 flex-wrap">' +
      '<label class="flex items-center gap-1.5 text-xs" style="color:var(--dim)"><input type="checkbox" data-rt-saves class="!w-4 !h-4"> <span class="coin-icon"><svg viewBox="0 0 24 24" width="100%" height="100%"><defs><radialGradient id="bcg" cx="35%" cy="30%"><stop offset="0%" stop-color="#FFE8C2"/><stop offset="45%" stop-color="#CD7F32"/><stop offset="100%" stop-color="#5C3A14"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#bcg)" stroke="#4A2E0F" stroke-width="1"/><circle cx="12" cy="12" r="9" fill="none" stroke="#4A2E0F" stroke-width="0.5" stroke-dasharray="1 0.8" opacity="0.6"/><rect x="9.2" y="9.2" width="5.6" height="5.6" fill="#0F1524" stroke="#4A2E0F" stroke-width="0.8"/><path d="M6 8.5a8 8 0 0 1 5-3.2" fill="none" stroke="#FFF3DC" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/></svg></span> חוסכת כסף (ארוחה ביתית)</label>' +
      '<select data-rt-assignee class="inp !p-1.5 text-xs" style="max-width:9rem" aria-label="למי הרוטינה">' +
      '<option value="">🏠 כל הבית</option>' +
      humans.map((m) => '<option value="' + m.id + '">' + esc(m.emoji + ' ' + m.name) + '</option>').join('') +
      '</select>' +
      '<button data-action="routine-add-save" class="mini-btn mini-accent" style="--lane:#34D399">שמור</button>' +
      '<button data-action="routine-add-cancel" class="mini-btn">ביטול</button>' +
      '</div></div>'
    );
  }

  function quietTpl(state) {
    return (
      '<div class="card neon p-6 text-center relative" style="--lane:#34D399" dir="rtl">' +
      (!ui.addOpen
        ? '<button data-action="routine-add-open" class="icon-btn absolute top-3 start-3" title="הוספת רוטינה">＋</button>'
        : '') +

      '<div style="font-size:2.2rem;line-height:1">🌕</div>' +
      '<p class="text-sm font-bold mt-2" style="color:#8FF0C8">הכל סומן להיום, נתראה מחר</p>' +
      (ui.addOpen ? '<div class="mt-3 text-start">' + addFormTpl(state) + '</div>' : '') +
      '</div>'
    );
  }

  function render(state) {
    const root = document.getElementById('routines-root');
    if (!root) return;
    if (!state.household.members.length) { root.innerHTML = ''; return; }

    const today = todayDMY();
    /* 🌕 E.4 v2 — the quiet-day snapshot dissolves at midnight (new day, clean slate). */
    if (ui.quietSnap && ui.quietSnap.date !== today) { ui.quietSnap = null; ui.wasAllDone = false; }

    /* While a quiet session lives, only the snapshot set counts — routines added
       after entering 🌕 stay off today's board until tomorrow (E.4 v2 §3, §6). */
    const base = ui.quietSnap
      ? state.routines.filter((r) => ui.quietSnap.ids.indexOf(r.id) !== -1)
      : state.routines;
    const all = sorted(base);
    const logFresh = state.routineLog.date === App.utils.todayKey();
    const remainingRoutines = all.filter((r) => !(logFresh && state.routineLog.done[r.id]));
    const calTasks = state.tasks.filter((t) => t.calendarDate === today);
    const remainingCal = calTasks.filter((t) => !t.done);

    const totalCount = all.length + calTasks.length;
    const remainingCount = remainingRoutines.length + remainingCal.length;
    const allDone = totalCount > 0 && remainingCount === 0;

    /* 🌕 Crossing into quiet — photograph today's set once + wipe the feed (E.5). */
    if (allDone && !ui.wasAllDone) {
      ui.wasAllDone = true;
      if (!ui.quietSnap) ui.quietSnap = { date: today, ids: all.map((r) => r.id) };
      App.actions.clearFeed();
    } else if (!allDone) {
      ui.wasAllDone = false;
    }

    if (allDone) { App.utils.setHtmlPreserving(root, quietTpl(state)); return; }

    App.utils.setHtmlPreserving(root,
      '<div class="card neon p-5" style="--lane:#34D399" dir="rtl">' +
      '<div class="flex items-center justify-between gap-2 mb-2.5">' +
      '<p class="font-display text-base font-extrabold">☀️ רוטינות היום</p>' +
      '<span class="flex items-center gap-2">' +
      (totalCount ? '<span class="rt-pill">נשארו ' + remainingCount + '</span>' : '') +
      (!ui.addOpen ? '<button data-action="routine-add-open" class="icon-btn" title="הוספת רוטינה">＋</button>' : '') +
      '</span></div>' +
      (totalCount
        ? '<div class="space-y-0.5">' +
          remainingRoutines.map((r) => (ui.editing === r.id ? editRowTpl(r, state) : rowTpl(r, state))).join('') +
          remainingCal.map((t) => calRowTpl(t, state)).join('') +
          '</div>'
        : '') +
      (ui.addOpen ? addFormTpl(state) : '') +
      '</div>');
  }

  function mount() {
    App.on('routine-toggle', (el) => {
      const row = el.closest('[data-rt-row]');
      let rect = null;
      if (row) { const r = row.getBoundingClientRect(); rect = { x: r.left, y: r.top, w: r.width, h: r.height }; }
      App.actions.toggleRoutine(el.dataset.id, { rect });
    });
    App.on('cal-task-toggle', (el) => {
      const id = el.dataset.id;
      const row = el.closest('[data-rt-row]');
      let rect = null;
      if (row) { const r = row.getBoundingClientRect(); rect = { x: r.left, y: r.top, w: r.width, h: r.height }; }
      App.actions.completeTask(id, { rect });
    });
    App.on('routine-add-open', () => {
      ui.addOpen = true; rerender();
      const t = document.querySelector('[data-rt-title]');
      if (t) t.focus();
    });
    App.on('routine-add-cancel', () => { ui.addOpen = false; rerender(); });
    App.on('routine-add-save', () => {
      const g = (sel) => document.querySelector(sel);
      const title = g('[data-rt-title]');
      if (!title || !title.value.trim()) { if (title) title.focus(); return; }

      const added = App.actions.addRoutine({
        title: title.value,
        time: g('[data-rt-time]') ? g('[data-rt-time]').value : null,
        saves: g('[data-rt-saves]') ? g('[data-rt-saves]').checked : false,
        assigneeId: g('[data-rt-assignee]') ? g('[data-rt-assignee]').value || null : null,
      });
      if (added) {
        App.fx.play('blip');
        ui.addOpen = false;
        App.toast('☀️ „' + esc(App.utils.trunc(added.title, 40)) + '" נוספה');
        rerender();
      } else { App.toast('עד 20 רוטינות 🙂'); }
    });
    App.on('routine-edit-open', (el) => {
      ui.editing = el.dataset.id; ui.addOpen = false; rerender();
      const t = document.querySelector('[data-rte-title]');
      if (t) { t.focus(); t.select(); }
    });
    App.on('routine-edit-cancel', () => { ui.editing = null; rerender(); });
    App.on('routine-edit-save', (el) => {
      const id = el.dataset.id;
      const box = document.querySelector('[data-rt-editing="' + id + '"]');
      if (!box) { ui.editing = null; rerender(); return; }
      const g = (sel) => box.querySelector(sel);
      const ok = App.actions.editRoutine(id, {
        title: g('[data-rte-title]') ? g('[data-rte-title]').value : '',
        time: g('[data-rte-time]') ? g('[data-rte-time]').value : '',
        saves: g('[data-rte-saves]') ? g('[data-rte-saves]').checked : false,
        assigneeId: g('[data-rte-assignee]') ? g('[data-rte-assignee]').value || null : null,
      });
      ui.editing = null;
      if (ok) { App.fx.play('blip'); App.toast('💾 הרוטינה עודכנה.'); }
      else { App.toast('⚠️ שם הרוטינה לא יכול להיות ריק.'); rerender(); }
    });
    App.on('routine-del', (el) => {
      const id = el.dataset.id;
      const key = 'rt:' + id;
      if (!arm(key)) return;
      disarm(key);
      App.actions.deleteRoutine(id);
      App.toast('🗑 הרוטינה הוסרה.');
    });
    App.subscribe(render);
  }

  App.components.Routines = { mount };
})();

