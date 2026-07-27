/* =============================================================================
 * BottomLine · src/components/CoopHud.js
 * -----------------------------------------------------------------------------
 * The household panel:
 *   • First-run setup wizard (centered RTL overlay): הרכב משפחתי → שמות —
 *     couple / couple+pet / couple+kids / custom rows (adult|child|pet, ≤8)
 *   • Login by name: the roster is remembered; each window picks its member
 *   • THE CATCH-UP RULE (universal): every login shows what happened while
 *     away — tasks added + tasks completed (and by whom) — then stamps lastSeen
 *   • Live presence for every online member + Hype bar ☕🔥📣
 *   • Battle feed, team-remaining counter, 🏛️ היכל התהילה
 * ========================================================================== */
(function () {
  'use strict';

  const esc = (s) => App.utils.escapeHtml(s);
  const ui = {
    hallOpen: false,
    setupStep: null,       // null | 'comp' | 'names' | 'routines'
    rows: [],              // draft [{name, role}]
    rtRows: [],            // draft [{time, title, saves}]
  };
  let setupRoot = null;
  let presenceIntId = null;

  const ROLE_META = {
    adult: { label: 'מבוגר/ת', emoji: '🧑' },
    child: { label: 'ילד/ה', emoji: '🧒' },
    pet:   { label: 'חיית מחמד', emoji: '🐶' },
  };
  const COMPS = [
    { id: 'couple',     label: '👫 זוג',              rows: [{ role: 'adult' }, { role: 'adult' }] },
    { id: 'couplePet',  label: '🐶 זוג + חיית מחמד', rows: [{ role: 'adult' }, { role: 'adult' }, { role: 'pet' }] },
    { id: 'coupleKids', label: '👨‍👩‍👧 זוג + ילדים',     rows: [{ role: 'adult' }, { role: 'adult' }, { role: 'child' }, { role: 'child' }] },
    { id: 'custom',     label: '🧩 הרכב מותאם',       rows: [{ role: 'adult' }, { role: 'adult' }] },
  ];

  const fmtTime = (ts) =>
    new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });

  /* ========================= setup wizard (overlay) ======================== */
  function readDraftNames() {
    if (!setupRoot) return;
    setupRoot.querySelectorAll('[data-hh-name]').forEach((inp) => {
      const i = Number(inp.dataset.hhName);
      if (ui.rows[i]) ui.rows[i].name = inp.value;
    });
  }
  function readDraftRoutines() {
    if (!setupRoot) return;
    ui.rtRows.forEach((r, i) => {
      const t = setupRoot.querySelector('[data-hh-rt-time="' + i + '"]');
      const n = setupRoot.querySelector('[data-hh-rt-title="' + i + '"]');
      const sv = setupRoot.querySelector('[data-hh-rt-saves="' + i + '"]');
      if (t) r.time = t.value;
      if (n) r.title = n.value;
      if (sv) r.saves = sv.checked;
    });
  }

  function wizardTpl() {
    if (ui.setupStep === 'comp') {
      return (
        '<div class="card neon frost-card" style="--lane:#7DD3FC" dir="rtl">' +
        '<h2 class="font-display text-xl md:text-2xl font-extrabold">🏠 ברוכים הבאים ל-BottomLine</h2>' +
        '<p class="text-sm mt-1 mb-5" style="color:var(--dim)">שלב 1 מתוך 3</p>' +
        '<div class="comp-grid">' +
        COMPS.map((c) => '<button data-action="hh-comp" data-comp="' + c.id + '" class="btn-soft text-base">' + c.label + '</button>').join('') +
        '</div>' +
        '<p class="cloud-link" style="color:var(--dim)">כבר הקמתם את הבית במחשב אחר? ' +
        '<button data-action="cloud-open" class="underline" style="color:var(--focus)">התחברו לענן שלו ☁️</button>' +
        ' — הלוח יירד לכאן לבד.</p>' +
        '</div>'
      );
    }
    if (ui.setupStep === 'routines') {
      return (
        '<div class="card neon frost-card" style="--lane:#34D399" dir="rtl">' +
        '<h2 class="font-display text-xl md:text-2xl font-extrabold">☀️ רוטינות היומיום</h2>' +
        '<p class="text-sm mt-1 mb-4" style="color:var(--dim)">שלב 3 מתוך 3</p>' +
        '<div class="space-y-2">' +
        ui.rtRows.map((r, i) =>
          '<div class="flex items-center gap-2">' +
          '<input dir="ltr" data-hh-rt-time="' + i + '" class="inp !p-2 text-sm" style="max-width:5.5rem" placeholder="06:00" maxlength="5" value="' + esc(r.time || '') + '">' +
          '<input dir="auto" data-hh-rt-title="' + i + '" class="inp !p-2 text-sm flex-1" placeholder="למשל: טיול עם הכלב" maxlength="120" value="' + esc(r.title || '') + '">' +
          '<label class="flex items-center gap-1 text-xs whitespace-nowrap" style="color:var(--dim)" title="ארוחה ביתית — חוסכת כסף"><span class="coin-icon"><svg viewBox="0 0 24 24" width="100%" height="100%"><defs><radialGradient id="bcr" cx="35%" cy="30%"><stop offset="0%" stop-color="#FFE8C2"/><stop offset="45%" stop-color="#CD7F32"/><stop offset="100%" stop-color="#5C3A14"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#bcr)" stroke="#4A2E0F" stroke-width="1"/><circle cx="12" cy="12" r="9" fill="none" stroke="#4A2E0F" stroke-width="0.5" stroke-dasharray="1 0.8" opacity="0.6"/><rect x="9.2" y="9.2" width="5.6" height="5.6" fill="#0F1524" stroke="#4A2E0F" stroke-width="0.8"/><path d="M6 8.5a8 8 0 0 1 5-3.2" fill="none" stroke="#FFF3DC" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/></svg></span><input type="checkbox" data-hh-rt-saves="' + i + '"' + (r.saves ? ' checked' : '') + '></label>' +
          '<button data-action="hh-rt-remove" data-idx="' + i + '" class="icon-btn" aria-label="הסרה">✕</button>' +
          '</div>'
        ).join('') +
        '</div>' +
        '<button data-action="hh-rt-add" class="mini-btn mt-3">＋ רוטינה</button>' +
        '<div class="mt-5 flex items-center gap-3">' +
        '<button data-action="hh-rt-save" class="btn-soft" style="background:var(--focus);color:var(--void);border-color:var(--focus)">סיימנו ◀</button>' +
        '<button data-action="hh-rt-skip" class="btn-soft">דלגו לעכשיו</button>' +
        '</div></div>'
      );
    }
    /* names step */
    return (
      '<div class="card neon frost-card" style="--lane:#7DD3FC" dir="rtl">' +
      '<h2 class="font-display text-xl md:text-2xl font-extrabold">🏠 מי גר בבית?</h2>' +
      '<p class="text-sm mt-1 mb-4" style="color:var(--dim)">שלב 2 מתוך 3</p>' +
      '<div class="mb-3">' +
      '<label class="block text-xs mb-1" style="color:var(--dim)">שם המשפחה (לתצוגה)</label>' +
      '<input dir="auto" data-hh-family class="inp" placeholder="למשל: יוחנן" maxlength="18">' +
      '</div>' +
      '<div class="space-y-2">' +
      ui.rows.map((r, i) =>
        '<div class="flex items-center gap-2">' +
        '<span class="text-lg" title="' + ROLE_META[r.role].label + '">' + ROLE_META[r.role].emoji + '</span>' +
        '<input dir="auto" data-hh-name="' + i + '" data-enter-action="hh-save" data-refocus-id="hh-name-' + i + '" ' +
        'class="inp flex-1" placeholder="שם — ' + ROLE_META[r.role].label + '" maxlength="18" value="' + esc(r.name || '') + '">' +
        '<button data-action="hh-row-remove" data-idx="' + i + '" class="icon-btn" aria-label="הסרה">✕</button>' +
        '</div>'
      ).join('') +
      '</div>' +
      '<div class="mt-4">' +
      '<label class="block text-xs mb-1" style="color:var(--dim)">כמה עולה לכם ארוחה משפחתית מחוץ לבית? (תכף תראו כמה כסף תרוויחו כשתוותרו עליה) ' +
      '<span class="coin-icon"><svg viewBox="0 0 24 24" width="100%" height="100%"><defs><radialGradient id="bcw" cx="35%" cy="30%"><stop offset="0%" stop-color="#FFE8C2"/><stop offset="45%" stop-color="#CD7F32"/><stop offset="100%" stop-color="#5C3A14"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#bcw)" stroke="#4A2E0F" stroke-width="1"/><circle cx="12" cy="12" r="9" fill="none" stroke="#4A2E0F" stroke-width="0.5" stroke-dasharray="1 0.8" opacity="0.6"/><rect x="9.2" y="9.2" width="5.6" height="5.6" fill="#0F1524" stroke="#4A2E0F" stroke-width="0.8"/><path d="M6 8.5a8 8 0 0 1 5-3.2" fill="none" stroke="#FFF3DC" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/></svg></span></label>' +
      '<input dir="rtl" inputmode="numeric" data-hh-mealcost data-enter-action="hh-save" class="inp" placeholder="לדוגמה: 150 ₪" maxlength="4">' +
      '</div>' +
      '<div class="mt-3 flex flex-wrap gap-1.5">' +
      '<button data-action="hh-row-add" data-role="adult" class="mini-btn">＋ מבוגר/ת</button>' +
      '<button data-action="hh-row-add" data-role="child" class="mini-btn">＋ ילד/ה</button>' +
      '<button data-action="hh-row-add" data-role="pet" class="mini-btn">＋ חיית מחמד</button>' +
      '</div>' +
      '<div class="mt-5 flex items-center gap-3">' +
      '<button data-action="hh-save" class="btn-soft" style="background:var(--focus);color:var(--void);border-color:var(--focus)">להתחיל לשחק ◀</button>' +
      '<button data-action="hh-back" class="btn-soft">→ חזרה</button>' +
      '</div></div>'
    );
  }

  function paintWizard() {
    if (!ui.setupStep) {
      if (setupRoot) { setupRoot.remove(); setupRoot = null; }
      return;
    }
    if (!setupRoot) {
      setupRoot = document.createElement('div');
      setupRoot.className = 'frost-overlay setup-overlay';
      document.body.appendChild(setupRoot);
    }
    App.utils.setHtmlPreserving(setupRoot, wizardTpl());
  }

  /* ========================= catch-up digest overlay ======================= */
  function showCatchup(d) {
    const ov = document.createElement('div');
    ov.className = 'frost-overlay';
    const addedLines = d.added.map((t) => '<div class="feed-item" dir="auto">🆕 ' + esc(t) + '</div>').join('');
    const doneLines = d.done.map((x) =>
      '<div class="feed-item" dir="auto">✅ ' + esc(x.title) + ' <span style="color:var(--dim)">· ע״י ' + esc(x.by || '') + '</span></div>'
    ).join('');
    ov.innerHTML =
      '<div class="card neon pop-in p-6 md:p-8 max-w-lg w-[92vw]" style="--lane:#FFD166" dir="rtl">' +
      '<h2 class="font-display text-xl font-extrabold">' + esc(d.emoji) + ' ברוך שובך, ' + esc(d.name) + '!</h2>' +
      '<p class="text-sm mt-1 mb-4" style="color:var(--dim)">תמונת מצב מאז הביקור האחרון:</p>' +
      ((d.addedCount + d.doneCount === 0)
        ? '<p class="text-sm">שקט מוחלט — שום דבר לא השתנה. 🌬️</p>'
        : '<p class="text-sm font-bold mb-2">🆕 ' + d.addedCount + ' משימות נוספו · ✅ ' + d.doneCount + ' הושלמו</p>' +
          '<div class="space-y-2 max-h-[44vh] overflow-y-auto pe-1">' + addedLines + doneLines +
          ((d.addedCount > 3 || d.doneCount > 3) ? '<p class="text-xs" style="color:var(--dim)">…ועוד. הפירוט המלא ב-❄️ מבט על.</p>' : '') +
          '</div>') +
      '<button class="btn-soft mt-5">יאללה, לשחק ◀</button></div>';
    const close = () => ov.remove();
    ov.addEventListener('click', close);
    setTimeout(close, 14000);
    document.body.appendChild(ov);
  }

  /* ===================== cloud settings panel (☁️) ======================== */
  let cloudRoot = null;
  function paintCloudPanel(open) {
    if (!open) { if (cloudRoot) { cloudRoot.remove(); cloudRoot = null; } return; }
    const c = App.sync && App.sync.getCloudCfg ? App.sync.getCloudCfg() : { url: '', key: '', room: '' };
    if (!cloudRoot) {
      cloudRoot = document.createElement('div');
      cloudRoot.className = 'frost-overlay';
      document.body.appendChild(cloudRoot);
    }
    App.utils.setHtmlPreserving(cloudRoot,
      '<div class="card neon p-6 md:p-8 max-w-lg w-[92vw]" style="--lane:#7DD3FC" dir="rtl">' +
      '<h2 class="font-display text-xl font-extrabold">☁️ חיבור ענן</h2>' +
      '<label class="block text-xs mb-1" style="color:var(--dim)">1 · כתובת הפרויקט (Project URL)</label>' +
      '<input dir="ltr" data-cloud-url class="inp mb-3" placeholder="https://xxxx.supabase.co" value="' + esc(c.url) + '">' +
      '<label class="block text-xs mb-1" style="color:var(--dim)">2 · מפתח Publishable (לעולם לא secret ⛔)</label>' +
      '<input dir="ltr" data-cloud-key class="inp mb-3" placeholder="sb_publishable_..." value="' + esc(c.key) + '">' +
      '<label class="block text-xs mb-1" style="color:var(--dim)">3 · קוד־בית (זהה בכל המחשבים)</label>' +
      '<div class="flex gap-2 mb-4">' +
      '<input dir="ltr" data-cloud-room class="inp flex-1" placeholder="לחץ 🎲 לייצור" value="' + esc(c.room) + '">' +
      '<button data-action="cloud-genroom" class="btn-soft" title="ייצור קוד חזק">🎲</button>' +
      '</div>' +
      '<div class="flex items-center gap-3">' +
      '<button data-action="cloud-save" class="btn-soft" style="background:var(--focus);color:var(--void);border-color:var(--focus)">שמור והתחבר ☁️</button>' +
      '<button data-action="cloud-close" class="btn-ghost">סגור</button>' +
      '</div></div>');
  }

  function genRoom() {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    const bytes = new Uint8Array(20);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(bytes) : bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
    let out = 'bl-';
    bytes.forEach((b) => { out += alphabet[b % alphabet.length]; });
    return out;
  }

  /* ============================== templates ================================ */
  function loginTpl(state) {
    const humans = state.household.members.filter((m) => m.role !== 'pet');
    const pets = state.household.members.filter((m) => m.role === 'pet');
    return (
      '<div class="card p-5" dir="rtl">' +
      '<p class="font-display font-bold text-lg">👋 מי מתחבר?</p>' +
      '<div class="grid gap-2">' +
      humans.map((m) =>
        '<button data-action="member-login" data-id="' + m.id + '" class="btn-soft text-start" dir="auto">' +
        esc(m.emoji) + ' ' + esc(m.name) + '</button>'
      ).join('') +
      '</div>' +
      (pets.length
        ? '<p class="text-xs mt-3" style="color:var(--dim)" dir="auto">בבית גם: ' + pets.map((p) => esc(p.emoji) + ' ' + esc(p.name)).join(' · ') + '</p>'
        : '') +
      '</div>'
    );
  }

  function presenceTpl(state) {
    const me = App.currentMember();
    const online = App.sync ? App.sync.onlineMembers() : [];
    const cs = App.sync && App.sync.cloudStatus ? App.sync.cloudStatus() : { state: 'off' };
    const cloudLine =
      cs.state === 'on' ? '<p class="text-xs mt-1" style="color:#34D399">☁️ ענן מחובר — מסונכרן בין מכשירים</p>'
      : cs.state === 'loading' ? '<p class="text-xs mt-1" style="color:var(--dim)">☁️ מתחבר לענן…</p>'
      : cs.state === 'error' ? '<p class="text-xs mt-1" dir="auto" style="color:#FFD166">☁️ ' + esc(cs.error) + '</p>'
      : '';
    return (
      '<div class="card p-5" data-presence dir="rtl">' +
      '<div class="flex items-center justify-between gap-2">' +
      '<p class="text-xs font-bold uppercase tracking-widest" style="color:var(--dim)">הבית המחובר</p>' +
      (online.length
        ? '<span class="text-xs" style="color:#34D399"><span class="online-dot"></span> ' + online.length + ' מחוברים</span>'
        : '<span class="text-xs" style="color:var(--dim)"><span class="offline-dot"></span> רק אני כרגע</span>') +
      '</div>' +
      cloudLine +
      '<div class="mt-3 flex items-center gap-2 text-sm">' +
      '<span style="color:var(--dim)">אני:</span>' +
      '<b dir="auto">' + esc(me ? me.emoji + ' ' + me.name : '') + '</b>' +
      '<button data-action="member-logout" class="icon-btn" title="החלפת משתמש">⇄</button>' +
      '</div>' +
      (online.length
        ? online.map((p) =>
            '<div class="mt-3 rounded-xl border border-line p-3" style="background:var(--panel2)">' +
            '<p class="text-sm" dir="auto"><b>' + esc(p.name || '') + '</b>' +
            (p.v && p.v !== App.constants.APP_VERSION
              ? ' <span class="text-[10px]" style="color:#FFD166">· גרסה ' + esc(p.v) + ' ⚠️ (לעדכן)</span>'
              : '') +
            ' מרוכז/ת עכשיו ב:</p>' +
            '<p dir="auto" class="text-sm mt-1" style="color:var(--focus)">🎯 ' + (p.focus ? esc(p.focus) : 'בוחר/ת קווסט…') + '</p>' +
            '</div>'
          ).join('')
        : '') +
      '<div class="mt-3 flex items-center gap-2">' +
      '<button data-action="hype-send" data-emoji="❤️" title="לב" class="hype-btn">❤️</button>' +
      '<button data-action="hype-send" data-emoji="🔥" title="אש" class="hype-btn">🔥</button>' +
      '<button data-action="hype-send" data-emoji="🌸" title="פרחים" class="hype-btn">🌸</button>' +
      '<input dir="auto" data-note-input data-enter-action="note-send" class="inp !p-2 text-sm flex-1" placeholder="💬 פתק לבית…" maxlength="120">' +
      '</div>' +
      '</div>'
    );
  }

  function feedTpl(state) {
    const remaining = App.priorityTasks(state).length;
    const hall = state.season.hall;
    return (
      '<div class="card p-5" dir="rtl">' +
      '<div class="flex items-center justify-between gap-2 mb-1">' +
      '<p dir="auto" class="text-sm font-bold">🗺️ נותר לצוות: ' + remaining + '</p>' +
      '<button data-action="hall-toggle" class="icon-btn" aria-pressed="' + String(ui.hallOpen) + '" title="היכל התהילה">🏛️</button>' +
      '</div>' +
      '<p class="text-xs font-bold uppercase tracking-widest mb-3" style="color:var(--dim)">⚡ פיד הקרב החי</p>' +
      (state.feed.length
        ? '<div class="space-y-2 max-h-72 overflow-y-auto pe-1">' +
          state.feed.map((f) =>
            '<div class="feed-item" dir="auto">' + esc(f.emoji) + ' ' + esc(f.text) +
            '<span class="block text-[10px] mt-0.5" style="color:var(--dim)">' + fmtTime(f.ts) + '</span></div>'
          ).join('') + '</div>'
        : '<p class="text-sm italic" style="color:var(--dim)">עוד אין הרג. ה-💥 הראשון כותב היסטוריה.</p>') +
      (ui.hallOpen
        ? '<div class="mt-3 pt-3" style="border-top:1px solid var(--line)">' +
          '<p dir="auto" class="text-xs font-bold uppercase tracking-widest mb-2" style="color:var(--dim)">🏛️ היכל התהילה</p>' +
          (hall.length
            ? '<div class="space-y-2 max-h-48 overflow-y-auto pe-1">' +
              hall.map((h) =>
                '<div class="feed-item" dir="auto">' +
                (h.championId ? '👑 ' + esc(h.name || '') : '🤝 תיקו') +
                ' · ' + esc(h.month) + (h.championId ? ' · ' + h.score + ' נק׳' : '') +
                (h.saved ? ' · 💰 ₪' + h.saved : '') + '</div>'
              ).join('') + '</div>'
            : '<p class="text-sm italic" style="color:var(--dim)">עוד אין אלופים — סיימו חודש! 🌱</p>') +
          '</div>'
        : '') +
      '</div>'
    );
  }

  function render(state) {
    const root = document.getElementById('hud-root');
    if (!root) return;
    const hasHousehold = state.household.members.length > 0;

    if (!hasHousehold) {
      if (!ui.setupStep) ui.setupStep = 'comp';
      App.utils.setHtmlPreserving(root, '<div class="space-y-4">' +
        '<div class="card p-5" dir="rtl"><p class="text-sm" style="color:var(--dim)">🏠 מקימים את משק הבית…</p></div>' +
        feedTpl(state) + '</div>');
    } else if (!App.getPrefs().memberId) {
      ui.setupStep = null;
      App.utils.setHtmlPreserving(root, '<div class="space-y-4">' + loginTpl(state) + feedTpl(state) + '</div>');
    } else {
      ui.setupStep = null;
      App.utils.setHtmlPreserving(root, '<div class="space-y-4">' + presenceTpl(state) + feedTpl(state) + '</div>');
    }
    paintWizard();
  }

  /* Cheap presence-only repaint (called by SyncEngine on heartbeat msgs). */
  function paintPresence() {
    const a = document.activeElement;
    const typingHere = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || '') &&
      (function () {
        const hud = document.getElementById('hud-root');
        return (hud && hud.contains(a)) || (setupRoot && setupRoot.contains(a));
      })();
    if (typingHere) return; // NEVER repaint under someone's fingers — dots can wait
    render(App.getState());
  }

  /* =============================== actions ================================= */
  function mount() {
    App.on('hh-comp', (el) => {
      const c = COMPS.find((x) => x.id === el.dataset.comp) || COMPS[0];
      ui.rows = c.rows.map((r) => ({ name: '', role: r.role }));
      ui.setupStep = 'names';
      paintWizard();
      const first = document.querySelector('[data-hh-name="0"]');
      if (first) first.focus();
    });

    App.on('hh-back', () => { readDraftNames(); ui.setupStep = 'comp'; paintWizard(); });

    App.on('hh-row-add', (el) => {
      readDraftNames();
      if (ui.rows.length >= 8) { App.toast('עד 8 בני בית 🙂'); return; }
      ui.rows.push({ name: '', role: el.dataset.role || 'adult' });
      paintWizard();
      const inp = document.querySelector('[data-hh-name="' + (ui.rows.length - 1) + '"]');
      if (inp) inp.focus();
    });

    App.on('hh-row-remove', (el) => {
      readDraftNames();
      ui.rows.splice(Number(el.dataset.idx), 1);
      paintWizard();
    });

    App.on('hh-save', () => {
      readDraftNames();
      const named = ui.rows.filter((r) => (r.name || '').trim());
      if (!named.some((r) => r.role !== 'pet')) {
        App.toast('צריך לפחות שם אחד של מבוגר/ת או ילד/ה 🙂');
        return;
      }
      const mcEl = document.querySelector('[data-hh-mealcost]');
      const famEl = document.querySelector('[data-hh-family]');
      if (App.actions.setupHousehold(named, mcEl ? mcEl.value : undefined, famEl ? famEl.value : undefined)) {
        ui.rtRows = [{ time: '', title: '', saves: false }];
        ui.setupStep = 'routines';
        paintWizard();
        App.fx.play('blip');
        const first = document.querySelector('[data-hh-rt-title="0"]');
        if (first) first.focus();
      }
    });

    App.on('hh-rt-add', () => {
      readDraftRoutines();
      if (ui.rtRows.length >= 20) { App.toast('עד 20 רוטינות 🙂'); return; }
      ui.rtRows.push({ time: '', title: '', saves: false });
      paintWizard();
      const inp = document.querySelector('[data-hh-rt-title="' + (ui.rtRows.length - 1) + '"]');
      if (inp) inp.focus();
    });

    App.on('hh-rt-remove', (el) => {
      readDraftRoutines();
      ui.rtRows.splice(Number(el.dataset.idx), 1);
      paintWizard();
    });

    App.on('hh-rt-save', () => {
      readDraftRoutines();
      const named = ui.rtRows.filter((r) => (r.title || '').trim());
      const n = named.length ? App.actions.setRoutines(named) : 0;
      ui.setupStep = null;
      paintWizard();
      App.fx.play('blip');
      App.toast('🏠 משק הבית מוכן' + (n ? ' + ' + n + ' רוטינות ☀️' : '') + ' — עכשיו כל אחד מתחבר בשם שלו!');
    });

    App.on('hh-rt-skip', () => {
      ui.setupStep = null;
      paintWizard();
      App.toast('🏠 משק הבית מוכן — רוטינות אפשר להוסיף בכל רגע דרך ＋ בכרטיס ☀️.');
    });

    App.on('member-login', (el) => {
      const digest = App.actions.loginMember(el.dataset.id);
      if (!digest) return;
      App.fx.play('blip');
      showCatchup(digest); // THE universal catch-up rule
    });

    App.on('member-logout', () => { App.actions.logoutMember(); });

    App.on('hype-send', (el) => {
      App.actions.sendHype(el.dataset.emoji);
    });

    App.on('note-send', () => {
      const inp = document.querySelector('[data-note-input]');
      if (!inp) return;
      if (App.actions.sendNote(inp.value)) {
        const fresh = document.querySelector('[data-note-input]') || inp; // re-rendered node
        fresh.value = '';
      }
    });

    App.on('cloud-open', () => { paintCloudPanel(true); });
    App.on('cloud-close', () => { paintCloudPanel(false); });
    App.on('cloud-genroom', () => {
      const inp = document.querySelector('[data-cloud-room]');
      if (inp) { inp.value = genRoom(); inp.focus(); }
      App.fx.play('blip');
    });
    App.on('cloud-save', () => {
      const g = (sel) => { const el = document.querySelector(sel); return el ? el.value : ''; };
      const err = App.sync.saveCloudConfig({
        url: g('[data-cloud-url]'), key: g('[data-cloud-key]'), room: g('[data-cloud-room]'),
      });
      if (err) { App.toast('⚠️ ' + esc(err)); return; }
      App.toast('☁️ נשמר! מתחבר מחדש…');
      setTimeout(() => location.reload(), 900);
    });

    App.on('hall-toggle', () => {
      ui.hallOpen = !ui.hallOpen;
      render(App.getState());
    });

    presenceIntId = setInterval(paintPresence, 4000); // refresh the online dots
    window.addEventListener('beforeunload', () => clearInterval(presenceIntId));

    App.subscribe(render);
  }

  App.components.CoopHud = { mount, paintPresence };
})();
