/* =============================================================================
 * BottomLine · src/app.js
 * -----------------------------------------------------------------------------
 * Global state manager — the single source of truth.
 * ========================================================================== */
(function () {
  'use strict';

  const APP_VERSION = '1.16.0';
  const STORAGE_KEY = 'buttonline:v1';
  const LEGACY_KEY = 'dopamine-quest:v2';
  const BACKUP_KEY = STORAGE_KEY + ':backup';
  const QUARANTINE_KEY = STORAGE_KEY + ':quarantine';
  const PREFS_KEY = 'buttonline:player';

  const OVERLOAD_LIMIT = 4;
  const MAX_CUSTOM_LANES = 2;
  const XP_PER_TASK = 100;
  const XP_PER_LEVEL = 500;
  const FEED_CAP = 30;
  const DEFAULT_TIMER_MIN = 20;
  const DEFAULT_MEAL_COST = 130;

  const CUSTOM_LANE_PRESETS = [
    { emoji: '🧭', color: 'teal' },
    { emoji: '🎨', color: 'sky' },
  ];

  const LANE_THEME = {
    red:    { bar: '#FF4D6D', soft: 'rgba(255,77,109,.12)',  ink: '#FF9EB1' },
    green:  { bar: '#34D399', soft: 'rgba(52,211,153,.12)',  ink: '#8FF0C8' },
    gold:   { bar: '#FFD166', soft: 'rgba(255,209,102,.12)', ink: '#FFE3A3' },
    purple: { bar: '#C084FC', soft: 'rgba(192,132,252,.12)', ink: '#DDB8FF' },
    teal:   { bar: '#2DD4BF', soft: 'rgba(45,212,191,.12)',  ink: '#99F6E4' },
    sky:    { bar: '#60A5FA', soft: 'rgba(96,165,250,.12)',  ink: '#BFDBFE' },
  };

  const ROUTES = [
    { lane: 'meteors',  rx: /(ריסק זמני|רצף פנסיוני|ביטוח בריאות|קרן פנסיה|פוליסה|חוב|חשבון|insur|pension|premium|policy|debt|deadline|coverage|bill)/i },
    { lane: 'wealth',   rx: /(בקשת החזר|חברת ביטוח|טופס 161|החזר כספי|מכתב שחרור|כסף|refund|claim|reimburs|rebate|cash ?back|money)/i },
    { lane: 'lifeline', rx: /(בישול|ארוחה בבית|ארוחה|אימון|ניקיון|נקיון|ניקיונות|נקיונות|קניות|התארגנות|cook|meal|dinner|workout|clean|gym|grocer)/i },
  ];
  ROUTES.unshift({
    lane: 'health',
    rx: /שיניים|שינן|רופא|רופאה|מרפאה|קופת חולים|בדיקת|בדיקות|דם|חיסון|תרופ|מרשם|משקפיים|אופטומטר|תור ל|כושר|אימון|dentist|doctor|clinic|blood|checkup|vaccine|pharmacy|gym/i,
  });

  const routeLane = (title) => {
    const hit = ROUTES.find((r) => r.rx.test(title));
    return hit ? hit.lane : 'chaos';
  };

  const LEGACY_HYDRATE_TEXTS = new Set([
    'צור קשר עם הסוכן / open the portal', 'חתום דיגיטלית על הטופס הנדרש', 'הגדר הוראת קבע / hit send ✅',
    'פתח את פורטל חברת הביטוח', 'צלם / צרף את הקבלות', 'שלח את בקשת ההחזר ✅',
    'בחר מתכון קל אחד', 'שים את כל המצרכים על השיש', 'בשל והגש 🍽️',
    'פתח את מה שצריך (חוק 2 הדקות)', 'עשה רק את החתיכה הראשונה', 'סמן וזהו ✅',
  ]);

  function setHtmlPreserving(root, html) {
    const keyOf = (el) => {
      if (el.id) return '#' + el.id;
      const parts = [el.tagName.toLowerCase()];
      for (const a of el.attributes) {
        if (a.name.indexOf('data-') === 0 &&
            a.name !== 'data-action' && a.name !== 'data-enter-action' && a.name !== 'data-change-action') {
          parts.push('[' + a.name + (a.value ? '="' + a.value + '"' : '') + ']');
        }
      }
      return parts.length > 1 ? parts.join('') : null;
    };
    const snap = [];
    root.querySelectorAll('input, textarea, select').forEach((el) => {
      const k = keyOf(el);
      if (!k) return;
      snap.push({
        k, v: el.value,
        chk: el.type === 'checkbox' ? el.checked : null,
        foc: document.activeElement === el,
        s: el.selectionStart, e: el.selectionEnd,
      });
    });
    root.innerHTML = html;
    snap.forEach((d) => {
      let el = null;
      try { el = root.querySelector(d.k); } catch (err) { el = null; }
      if (!el) return;
      if (d.chk !== null) el.checked = d.chk;
      else if (typeof d.v === 'string') el.value = d.v;
      if (d.foc) {
        el.focus();
        try { if (d.s != null && el.setSelectionRange) el.setSelectionRange(d.s, d.e); } catch (err) {}
      }
    });
  }

  const uid = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const todayKey = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const monthKey = () => todayKey().slice(0, 7);
  const todayDMY = () => { const p = todayKey().split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const fmtClock = (ms) => {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  };
  const escapeHtml = (s = '') =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function stepRow(task, step, scope) {
    const id = scope + '-step-' + step.id;
    return (
      '<li class="step flex items-center gap-2.5 text-start">' +
      '<input type="checkbox" id="' + id + '" data-change-action="step-toggle"' +
      ' data-task-id="' + task.id + '" data-step-id="' + step.id + '" data-refocus-id="' + id + '"' +
      (step.done ? ' checked' : '') + '>' +
      '<label for="' + id + '" dir="auto" class="text-sm ' + (step.done ? 'line-through opacity-40' : '') + '">' +
      escapeHtml(step.text) + '</label></li>'
    );
  }

  function seedState() {
    const lanes = [
      { id: 'meteors',  name: 'משימות דדליין',  emoji: '🚨', color: 'red',    custom: false, collapsed: false },
      { id: 'lifeline', name: 'משימות לנפש',     emoji: '🌱', color: 'green',  custom: false, collapsed: false },
      { id: 'health',   name: 'משימות בריאות',   emoji: '🩺', color: 'teal',   custom: false, collapsed: false },
      { id: 'wealth',   name: 'משימות ערך',      emoji: '💰', color: 'gold',   custom: false, collapsed: false },
      { id: 'chaos',    name: 'משימות מזמזמות',  emoji: '🪰', color: 'purple', custom: false, collapsed: false },
    ];
    return {
      version: 3,
      xp: { total: 0, level: 1 },
      points: {}, pointsMonth: {},
      household: { members: [], mealCost: DEFAULT_MEAL_COST, name: null },
      savedTotal: 0, savedMonth: 0,
      routines: [],
      routineLog: { date: todayKey(), done: {} },
      sprint: null,
      season: { month: monthKey(), hall: [] },
      streak: { date: todayKey(), count: 0, best: 0 },
      feed: [], lanes, tasks: [],
    };
  }

  const defaultPrefs = () => ({
    memberId: null, sound: true, stealth: false,
    timerMinutes: DEFAULT_TIMER_MIN, focusTaskId: null,
  });
  let prefs = defaultPrefs();

  function loadPrefs() {
    try {
      const raw = sessionStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        prefs.memberId = typeof p.memberId === 'string' ? p.memberId.slice(0, 40) : null;
        prefs.sound = p.sound !== false;
        prefs.stealth = p.stealth === true;
        const m = Number(p.timerMinutes);
        prefs.timerMinutes = Number.isFinite(m) ? clamp(Math.round(m), 1, 120) : DEFAULT_TIMER_MIN;
        prefs.focusTaskId = typeof p.focusTaskId === 'string' ? p.focusTaskId : null;
      }
    } catch (e) {}
  }
  function savePrefs() {
    try { sessionStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {}
  }
  function setPrefs(patch) { Object.assign(prefs, patch); savePrefs(); emit(); }
  const currentMember = () =>
    state ? state.household.members.find((m) => m.id === prefs.memberId) || null : null;
  const playerName = () => { const m = currentMember(); return m ? m.name : 'אורח'; };

  let memoryOnly = false;
  function readRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { memoryOnly = true; return null; }
  }
  function writeRaw(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function parse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function sanitize(candidate) {
    const LEGACY_LANE_NAMES = {
      'The Deadline Meteors': 'משימות דדליין', 'The Lifeline Routines': 'משימות לנפש',
      'The Wealth Reclaimers': 'משימות ערך', 'The Chaos Mosquitos': 'משימות מזמזמות',
      'מטאורי הדדליין': 'משימות דדליין', 'שגרת החיים': 'משימות לנפש',
      'רווחה נפשית': 'משימות לנפש', 'משיבי הכסף': 'משימות ערך', 'יתושי הכאוס': 'משימות מזמזמות',
    };
    if (!candidate || typeof candidate !== 'object') return null;
    const seed = seedState();
    const out = {
      version: 3, xp: { total: 0, level: 1 }, points: {}, pointsMonth: {},
      household: { members: [], mealCost: DEFAULT_MEAL_COST, name: null },
      savedTotal: 0, savedMonth: 0, routines: [],
      routineLog: { date: todayKey(), done: {} }, sprint: null,
      season: { month: monthKey(), hall: [] },
      streak: { date: todayKey(), count: 0, best: 0 },
      feed: [], lanes: [], tasks: [],
    };

    const xp = candidate.xp || {};
    out.xp.total = Number.isFinite(+xp.total) ? Math.max(0, Math.floor(+xp.total)) : 0;
    out.xp.level = Math.floor(out.xp.total / XP_PER_LEVEL) + 1;

    const hhc = candidate.household || {};
    const mc = Number(hhc.mealCost);
    out.household.mealCost = Number.isFinite(mc) ? Math.min(5000, Math.max(1, Math.round(mc))) : DEFAULT_MEAL_COST;
    out.household.name = typeof hhc.name === 'string' && hhc.name.trim() ? hhc.name.trim().slice(0, 18) : null;
    out.savedTotal = Number.isFinite(+candidate.savedTotal) ? Math.max(0, Math.floor(+candidate.savedTotal)) : 0;
    out.savedMonth = Number.isFinite(+candidate.savedMonth) ? Math.max(0, Math.floor(+candidate.savedMonth)) : out.savedTotal;
    const seenMember = new Set();
    (Array.isArray(hhc.members) ? hhc.members : []).forEach((m) => {
      if (!m || typeof m !== 'object' || out.household.members.length >= 8) return;
      const id = typeof m.id === 'string' && m.id ? m.id.slice(0, 40) : uid();
      if (seenMember.has(id)) return;
      const name = typeof m.name === 'string' ? m.name.trim().slice(0, 18) : '';
      if (!name) return;
      seenMember.add(id);
      out.household.members.push({
        id, name, role: ['adult', 'child', 'pet'].includes(m.role) ? m.role : 'adult',
        emoji: typeof m.emoji === 'string' && m.emoji ? m.emoji.slice(0, 4) : '🙂',
        lastSeen: Number.isFinite(+m.lastSeen) ? Math.max(0, +m.lastSeen) : 0,
      });
    });

    if (!out.household.members.length) {
      const ln = (candidate.season && candidate.season.names) || {};
      const lp = candidate.points || {};
      const legacySignal =
        (typeof ln.A === 'string' && ln.A) || (typeof ln.B === 'string' && ln.B) ||
        (+lp.A > 0) || (+lp.B > 0) ||
        (Array.isArray(candidate.tasks) && candidate.tasks.some((t) => t && (t.doneByKey === 'A' || t.doneByKey === 'B')));
      if (legacySignal) {
        [['A', '🫐', 'שותף א׳'], ['B', '🍑', 'שותף ב׳']].forEach((pair) => {
          out.household.members.push({
            id: pair[0], name: (typeof ln[pair[0]] === 'string' && ln[pair[0]]) ? ln[pair[0]].slice(0, 18) : pair[2],
            role: 'adult', emoji: pair[1], lastSeen: 0,
          });
        });
      }
    }

    const memberIds = new Set(out.household.members.map((m) => m.id));
    const cp = candidate.points || {};
    Object.keys(cp).forEach((k) => {
      if (memberIds.has(k) && Number.isFinite(+cp[k])) out.points[k] = Math.max(0, Math.floor(+cp[k]));
    });

    const cpm = candidate.pointsMonth;
    if (cpm && typeof cpm === 'object') {
      Object.keys(cpm).forEach((k) => {
        if (memberIds.has(k) && Number.isFinite(+cpm[k])) out.pointsMonth[k] = Math.max(0, Math.floor(+cpm[k]));
      });
    } else { out.pointsMonth = Object.assign({}, out.points); }

    const seenRt = new Set();
    (Array.isArray(candidate.routines) ? candidate.routines : []).forEach((r) => {
      if (!r || typeof r !== 'object' || out.routines.length >= 20) return;
      const id = typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : uid();
      if (seenRt.has(id)) return;
      const title = typeof r.title === 'string' ? r.title.trim().slice(0, 120) : '';
      if (!title) return;
      seenRt.add(id);
      out.routines.push({
        id, title,
        time: typeof r.time === 'string' && /^\d{1,2}:\d{2}$/.test(r.time) ? r.time : null,
        assigneeId: typeof r.assigneeId === 'string' && memberIds.has(r.assigneeId) ? r.assigneeId : null,
        saves: r.saves === true,
      });
    });
    const rl = candidate.routineLog || {};
    out.routineLog.date = typeof rl.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rl.date) ? rl.date : todayKey();
    const rdone = rl.done && typeof rl.done === 'object' ? rl.done : {};
    Object.keys(rdone).forEach((rid) => {
      if (!seenRt.has(rid)) return;
      const rec = rdone[rid];
      if (!rec || typeof rec !== 'object') return;
      out.routineLog.done[rid] = {
        by: typeof rec.by === 'string' ? rec.by.slice(0, 18) : null,
        byId: typeof rec.byId === 'string' ? rec.byId.slice(0, 40) : null,
        ts: Number.isFinite(+rec.ts) ? +rec.ts : Date.now(),
        saved: Number.isFinite(+rec.saved) ? Math.max(0, Math.round(+rec.saved)) : 0,
      };
    });

    const spc = candidate.sprint;
    if (spc && typeof spc === 'object' && typeof spc.id === 'string') {
      const totalMs = +spc.totalMs, endsAt = +spc.endsAt, leftMs = +spc.leftMs;
      const validTotal = Number.isFinite(totalMs) && totalMs >= 60000 && totalMs <= 7200000;
      const fresh = spc.running === true
        ? (Number.isFinite(endsAt) && endsAt > Date.now() - 21600000)
        : (Number.isFinite(leftMs) && leftMs > 0);
      if (validTotal && fresh) {
        out.sprint = {
          id: spc.id.slice(0, 40), taskId: typeof spc.taskId === 'string' ? spc.taskId.slice(0, 40) : null,
          by: typeof spc.by === 'string' ? spc.by.slice(0, 18) : null,
          byId: typeof spc.byId === 'string' ? spc.byId.slice(0, 40) : null,
          taskTitle: typeof spc.taskTitle === 'string' ? spc.taskTitle.slice(0, 80) : null,
          running: spc.running === true, endsAt: spc.running === true ? endsAt : 0,
          totalMs, leftMs: spc.running === true ? 0 : Math.min(leftMs, 7200000),
        };
      }
    }

    const se = candidate.season || {};
    out.season.month = typeof se.month === 'string' && /^\d{4}-\d{2}$/.test(se.month) ? se.month : monthKey();
    const seenMonth = new Set();
    (Array.isArray(se.hall) ? se.hall : []).forEach((h) => {
      if (!h || typeof h !== 'object' || typeof h.month !== 'string') return;
      const m = h.month.slice(0, 7);
      if (seenMonth.has(m) || out.season.hall.length >= 24) return;
      seenMonth.add(m);
      const legacyChamp = h.champion === 'A' || h.champion === 'B' ? h.champion : null;
      const championId = typeof h.championId === 'string' ? h.championId.slice(0, 40) : legacyChamp;
      let score = Number.isFinite(+h.score) ? Math.max(0, Math.floor(+h.score)) : 0;
      if (!score && h.points && championId && Number.isFinite(+h.points[championId])) {
        score = Math.max(0, Math.floor(+h.points[championId]));
      }
      out.season.hall.push({
        month: m, championId, name: typeof h.name === 'string' ? h.name.slice(0, 18) : null,
        score, saved: Number.isFinite(+h.saved) ? Math.max(0, Math.floor(+h.saved)) : 0,
      });
    });

    const st = candidate.streak || {};
    out.streak.best = Number.isFinite(+st.best) ? Math.max(0, Math.floor(+st.best)) : 0;
    if (st.date === todayKey() && Number.isFinite(+st.count)) out.streak.count = Math.max(0, Math.floor(+st.count));

    const cleanFeedText = (raw) => String(raw)
      .replace(/\s*\(\+\d+ XP[^)]*\)/g, '')
      .replace(' destroyed: \u201C', ' · \u201E')
      .replace(' un-destroyed \u201C', ' · ביטול \u201E')
      .replace(/\u201D!?/g, '"')
      .replace(/ sent hype .*/, '')
      .replace(/ נחסכו(?=$|\s*·)/, '')
      .trim();
    out.feed = (Array.isArray(candidate.feed) ? candidate.feed : [])
      .filter((f) => f && typeof f === 'object' && typeof f.text === 'string')
      .slice(0, FEED_CAP)
      .map((f) => ({
        id: typeof f.id === 'string' ? f.id : uid(),
        ts: Number.isFinite(+f.ts) ? +f.ts : Date.now(),
        text: cleanFeedText(f.text).slice(0, 200),
        emoji: typeof f.emoji === 'string' ? f.emoji.slice(0, 4) : '💥',
      }));

    const seenLane = new Set();
    let customs = 0;
    (Array.isArray(candidate.lanes) ? candidate.lanes : []).forEach((l) => {
      if (!l || typeof l !== 'object') return;
      const id = typeof l.id === 'string' && l.id ? l.id : uid();
      if (seenLane.has(id)) return;
      const isCustom = l.custom === true;
      if (isCustom && customs >= MAX_CUSTOM_LANES) return;
      if (isCustom) customs += 1;
      seenLane.add(id);
      out.lanes.push({
        id, name: typeof l.name === 'string' && l.name.trim() ? l.name.trim().slice(0, 40) : 'Untitled lane',
        emoji: typeof l.emoji === 'string' && l.emoji ? l.emoji.slice(0, 4) : '📌',
        color: LANE_THEME[l.color] ? l.color : 'teal', custom: isCustom, collapsed: l.collapsed === true,
      });
    });
    if (out.lanes.filter((l) => !l.custom).length === 0) {
      out.lanes = seed.lanes.concat(out.lanes.filter((l) => l.custom));
    }
    seed.lanes.forEach((core, idx) => {
      if (!out.lanes.some((l) => l.id === core.id)) out.lanes.splice(Math.min(idx, out.lanes.length), 0, Object.assign({}, core));
    });

    const laneIds = new Set(out.lanes.map((l) => l.id));
    const fallbackLane = out.lanes[0].id;
    const seenTask = new Set();
    (Array.isArray(candidate.tasks) ? candidate.tasks : []).forEach((tk) => {
      if (!tk || typeof tk !== 'object') return;
      const id = typeof tk.id === 'string' && tk.id ? tk.id : uid();
      if (seenTask.has(id)) return;
      const title = typeof tk.title === 'string' ? tk.title.trim().slice(0, 200) : '';
      if (!title) return;
      seenTask.add(id);
      const steps = (Array.isArray(tk.steps) ? tk.steps : [])
        .map((s) =>
          s && typeof s === 'object' && typeof s.text === 'string' && s.text
            ? { id: typeof s.id === 'string' && s.id ? s.id : uid(), text: s.text.slice(0, 140), done: s.done === true }
            : null
        ).filter(Boolean).filter((st) => st.done || !LEGACY_HYDRATE_TEXTS.has(st.text));
      out.tasks.push({
        id, laneId: laneIds.has(tk.laneId) ? tk.laneId : fallbackLane, title, steps,
        assigneeId: typeof tk.assigneeId === 'string' && memberIds.has(tk.assigneeId) ? tk.assigneeId : null,
        done: tk.done === true,
        doneBy: typeof tk.doneBy === 'string' ? tk.doneBy.slice(0, 18) : null,
        doneById: typeof (tk.doneById || tk.doneByKey) === 'string' ? String(tk.doneById || tk.doneByKey).slice(0, 40) : null,
        createdAt: Number.isFinite(+tk.createdAt) ? +tk.createdAt : Date.now(),
        completedAt: Number.isFinite(+tk.completedAt) ? +tk.completedAt : null,
        savings: Number.isFinite(+tk.savings) ? Math.max(0, Math.round(+tk.savings)) : null,
        savedAmount: Number.isFinite(+tk.savedAmount) ? Math.max(0, Math.round(+tk.savedAmount)) : null,
        calendarDate: typeof tk.calendarDate === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(tk.calendarDate) ? tk.calendarDate : null,
      });
    });

    out.lanes.forEach((l) => { if (LEGACY_LANE_NAMES[l.name]) l.name = LEGACY_LANE_NAMES[l.name]; });
    return out;
  }

  function loadState() {
    let rawMain = readRaw(STORAGE_KEY);
    if (!rawMain) {
      const legacy = readRaw(LEGACY_KEY);
      if (legacy) {
        rawMain = legacy;
        writeRaw(STORAGE_KEY, legacy);
        try {
          localStorage.removeItem(LEGACY_KEY);
          localStorage.removeItem(LEGACY_KEY + ':backup');
          localStorage.removeItem(LEGACY_KEY + ':quarantine');
        } catch (e) {}
      }
    }
    const main = sanitize(parse(rawMain));
    if (main) { writeRaw(BACKUP_KEY, JSON.stringify(main)); return { state: main, source: 'main' }; }
    if (rawMain) writeRaw(QUARANTINE_KEY, rawMain);
    const backup = sanitize(parse(readRaw(BACKUP_KEY)));
    if (backup) return { state: backup, source: 'backup' };
    return { state: seedState(), source: rawMain ? 'reset' : 'fresh' };
  }

  let lastLoadedRaw = null;
  function persist() {
    if (memoryOnly) return;
    const rawOut = JSON.stringify(state);
    lastLoadedRaw = rawOut;
    if (!writeRaw(STORAGE_KEY, rawOut)) {
      memoryOnly = true;
      toast('⚠️ Browser storage is blocked — changes live in this tab only.');
    }
  }

  let state = null;
  const listeners = new Set();
  function getState() { return state; }
  function getPrefs() { return prefs; }
  function subscribe(fn) { listeners.add(fn); }

  function rollover(s) {
    if (s.streak.date !== todayKey()) { s.streak.date = todayKey(); s.streak.count = 0; }
    if (s.routineLog.date !== todayKey()) {
      s.routineLog.date = todayKey(); s.routineLog.done = {}; s.points = {};
    }
  }

  function update(mutator) {
    rollover(state);
    mutator(state);
    persist();
    emit();
    if (App.sync) App.sync.notifyStateChanged();
  }

  function reloadFromStorage() {
    const raw = readRaw(STORAGE_KEY);
    if (raw !== null && raw === lastLoadedRaw) return;
    lastLoadedRaw = raw;
    const res = loadState();
    state = res.state;
    emit();
  }

  function emit() {
    let refocusKey = null;
    const ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.refocusId) refocusKey = ae.dataset.refocusId;
    listeners.forEach((fn) => { try { fn(state); } catch (err) { console.error('[render]', err); } });
    if (refocusKey) {
      const sel = (window.CSS && CSS.escape) ? CSS.escape(refocusKey) : refocusKey;
      const el = document.querySelector('[data-refocus-id="' + sel + '"]');
      if (el) el.focus();
    }
  }

  const laneTasks = (s, laneId) => s.tasks.filter((t) => t.laneId === laneId && !t.done);
  const priorityTasks = (s) => s.lanes.flatMap((l) => laneTasks(s, l.id));
  const isOverloaded = (t) => !t.done && Array.isArray(t.steps) && t.steps.length > OVERLOAD_LIMIT;
  const baseTitle = (title) => title.replace(/ · Part \d+$/, '');
  const focusedTask = (s) => s.tasks.find((t) => t.id === prefs.focusTaskId && !t.done) || null;

  function pushFeed(s, emoji, text) {
    s.feed.unshift({ id: uid(), ts: Date.now(), emoji, text: text.slice(0, 200) });
    if (s.feed.length > FEED_CAP) s.feed.length = FEED_CAP;
  }

  function rewardPayload(task, lane, s) {
    const kind = lane ? ({ meteors: 'meteors', lifeline: 'lifeline', health: 'lifeline', wealth: 'wealth' }[lane.id] || 'chaos') : 'chaos';
    return { kind, xp: XP_PER_TASK, savings: null, title: task.title, by: playerName(), laneColor: lane ? lane.color : 'purple' };
  }

  const actions = {

    clearFeed() {
      update((s) => { s.feed = []; });
    },

    addTask(laneId, title, opts) {
      const o = opts || {};
      const clean = String(title || '').trim().slice(0, 200);
      if (!clean) return null;
      let created = null;
      update((s) => {
        const targetId = o.autoRoute ? routeLane(clean) : laneId;
        const lane = s.lanes.find((l) => l.id === targetId) || s.lanes.find((l) => l.id === 'chaos') || s.lanes[0];
        created = {
          id: uid(), laneId: lane.id, title: clean, steps: [],
          done: false, doneBy: null, doneById: null, createdAt: Date.now(), completedAt: null,
          savings: null, savedAmount: null, assigneeId: null, calendarDate: null,
        };
        s.tasks.push(created);
      });
      if (created && !prefs.focusTaskId) setPrefs({ focusTaskId: created.id });
      return created;
    },

    completeTask(taskId, localOpts) {
      let payload = null;
      update((s) => {
        const t = s.tasks.find((x) => x.id === taskId && !x.done);
        if (!t) return;
        const me = currentMember();
        t.done = true; t.doneBy = playerName(); t.doneById = me ? me.id : null; t.completedAt = Date.now();
        if (s.sprint && s.sprint.taskId === t.id) s.sprint = null;
        s.streak.count += 1; s.streak.best = Math.max(s.streak.best, s.streak.count);
        const lane = s.lanes.find((l) => l.id === t.laneId);
        payload = rewardPayload(t, lane, s);
        const leaderId = (st) => {
          const humans = st.household.members.filter((m) => m.role !== 'pet');
          if (!humans.length) return null;
          const max = Math.max.apply(null, humans.map((m) => st.points[m.id] || 0));
          if (max <= 0) return null;
          const tops = humans.filter((m) => (st.points[m.id] || 0) === max);
          return tops.length === 1 ? tops[0].id : null;
        };
        if (me && me.role !== 'pet') {
          const before = leaderId(s);
          s.points[me.id] = (s.points[me.id] || 0) + 1;
          s.pointsMonth[me.id] = (s.pointsMonth[me.id] || 0) + 1;
          const after = leaderId(s);
          if (after && after !== before) {
            payload.leadId = after;
            const lm = s.household.members.find((m) => m.id === after);
            payload.leadName = lm ? lm.name : null;
          }
        }
        if (payload.savings) {
          s.savedTotal += payload.savings; s.savedMonth += payload.savings;
          t.savedAmount = payload.savings; payload.savedTotal = s.savedMonth;
        }
        const prevLevel = s.xp.level;
        s.xp.total += payload.xp;
        s.xp.level = Math.floor(s.xp.total / XP_PER_LEVEL) + 1;
        payload.levelUp = s.xp.level > prevLevel ? s.xp.level : null;
        pushFeed(s, '💥', playerName() + ' · „' + trunc(t.title, 60) + '"' + (payload.savings ? ' · ₪' + payload.savings : ''));
        if (payload.levelUp) pushFeed(s, '🏆', 'רמה ' + payload.levelUp + '!');
      });
      if (!payload) return null;
      if (prefs.focusTaskId === taskId) { setPrefs({ focusTaskId: null }); actions.pickNextFocus(); }
      if (prefs.focusTaskId === taskId) {
        const next = priorityTasks(state)[0];
        setPrefs({ focusTaskId: next ? next.id : null });
      }
      if (App.fx) App.fx.reward(payload, localOpts || {});
      if (App.sync) App.sync.send({ type: 'reward', payload });
      toast('✨ „' + escapeHtml(trunc(payload.title, 40)) + '" בוצע!', {
        actionLabel: 'Undo', onAction: () => actions.undoComplete(taskId),
      });
      return payload;
    },

    undoComplete(taskId) {
      update((s) => {
        const t = s.tasks.find((x) => x.id === taskId && x.done);
        if (!t) return;
        t.done = false; t.doneBy = null;
        if (t.doneById && Number.isFinite(+s.points[t.doneById])) {
          s.points[t.doneById] = Math.max(0, s.points[t.doneById] - 1);
          s.pointsMonth[t.doneById] = Math.max(0, (s.pointsMonth[t.doneById] || 0) - 1);
        }
        t.doneById = null;
        if (t.savedAmount) {
          s.savedTotal = Math.max(0, s.savedTotal - t.savedAmount);
          s.savedMonth = Math.max(0, s.savedMonth - t.savedAmount);
          t.savedAmount = null;
        }
        t.completedAt = null;
        s.streak.count = Math.max(0, s.streak.count - 1);
        s.xp.total = Math.max(0, s.xp.total - XP_PER_TASK);
        s.xp.level = Math.floor(s.xp.total / XP_PER_LEVEL) + 1;
        pushFeed(s, '↩️', playerName() + ' · ביטול „' + trunc(t.title, 50) + '"');
      });
      setPrefs({ focusTaskId: taskId });
    },

    editTask(taskId, patch) {
      let movedTo = null;
      update((s) => {
        const t = s.tasks.find((x) => x.id === taskId);
        if (!t) return;
        if (typeof patch.title === 'string') { const clean = patch.title.trim().slice(0, 200); if (clean) t.title = clean; }
        if (Array.isArray(patch.steps)) {
          t.steps = patch.steps.map((ps) => {
            const st = t.steps.find((x) => x.id === ps.id);
            if (!st) return null;
            const text = String(ps.text || '').trim().slice(0, 140);
            return text ? { id: st.id, text, done: st.done } : null;
          }).filter(Boolean);
        }
        if (patch.laneId && patch.laneId !== t.laneId && s.lanes.some((l) => l.id === patch.laneId)) {
          t.laneId = patch.laneId;
          movedTo = s.lanes.find((l) => l.id === patch.laneId);
        }
      });
      return movedTo;
    },

    assignTask(taskId, memberId) {
      update((s) => {
        const t = s.tasks.find((x) => x.id === taskId && !x.done);
        if (!t) return;
        const valid = s.household.members.some((m) => m.id === memberId && m.role !== 'pet');
        t.assigneeId = valid && t.assigneeId !== memberId ? memberId : null;
      });
    },

    setTaskDate(taskId, dateStr) {
      let ok = false;
      const clean = String(dateStr || '').trim();
      update((s) => {
        const t = s.tasks.find((x) => x.id === taskId && !x.done);
        if (!t) return;
        if (!clean) { t.calendarDate = null; ok = true; return; }
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) { t.calendarDate = clean; ok = true; }
      });
      return ok;
    },

    sprintStart() {
      const me = currentMember();
      if (!me || me.role === 'pet') { toast('התחברו בשם 🙂'); return false; }
      let ok = false, busy = false, unassigned = false;
      update((s) => {
        if (s.sprint) { busy = true; return; }
        const t = focusedTask(s);
        if (!t || !t.assigneeId) { unassigned = true; return; }
        const owner = s.household.members.find((m) => m.id === t.assigneeId);
        s.sprint = {
          id: uid(), by: owner ? owner.name : null, byId: t.assigneeId, taskId: t.id,
          taskTitle: trunc(t.title, 80), running: true,
          endsAt: Date.now() + prefs.timerMinutes * 60000, totalMs: prefs.timerMinutes * 60000, leftMs: 0,
        };
        ok = true;
      });
      if (unassigned) toast('⏱ שייכו את המשימה לבן בית — ואז GO');
      if (busy) toast('⏱ ספרינט כבר רץ — ↺ קודם');
      return ok;
    },

    sprintToggle() {
      const me = currentMember();
      let denied = false;
      update((s) => {
        const sp = s.sprint;
        if (!sp) return;
        if (!me || me.role === 'pet') { denied = true; return; }
        if (sp.running) { sp.leftMs = Math.max(0, sp.endsAt - Date.now()); sp.running = false; sp.endsAt = 0; }
        else { sp.endsAt = Date.now() + Math.max(1000, sp.leftMs); sp.running = true; sp.leftMs = 0; }
      });
      if (denied) toast('התחברו בשם כדי לשלוט בשעון ⏱');
    },

    sprintReset() {
      const me = currentMember();
      let denied = false;
      update((s) => {
        const sp = s.sprint;
        if (!sp) return;
        if (!me || me.role === 'pet') { denied = true; return; }
        s.sprint = null;
      });
      if (denied) toast('התחברו בשם כדי לשלוט בשעון ⏱');
    },

    sprintAdjust(deltaMin) {
      const me = currentMember();
      let denied = false;
      update((s) => {
        const sp = s.sprint;
        if (!sp) return;
        if (!me || me.role === 'pet') { denied = true; return; }
        const d = (Number(deltaMin) || 0) * 60000;
        if (sp.running) {
          const left = clamp(sp.endsAt - Date.now() + d, 60000, 7200000);
          sp.endsAt = Date.now() + left;
          sp.totalMs = Math.max(60000, Math.max(sp.totalMs + d, left));
        } else {
          sp.leftMs = clamp(sp.leftMs + d, 60000, 7200000);
          sp.totalMs = Math.max(60000, Math.max(sp.totalMs + d, sp.leftMs));
        }
      });
      if (denied) toast('התחברו בשם כדי לשלוט בשעון ⏱');
    },

    setRoutines(list) {
      update((s) => {
        s.routines = [];
        (Array.isArray(list) ? list : []).slice(0, 20).forEach((r) => {
          const title = String(r && r.title || '').trim().slice(0, 120);
          if (!title) return;
          const time = typeof (r && r.time) === 'string' && /^\d{1,2}:\d{2}$/.test(r.time.trim()) ? r.time.trim() : null;
          s.routines.push({
            id: uid(), title, time,
            assigneeId: r && typeof r.assigneeId === 'string' && s.household.members.some((m) => m.id === r.assigneeId) ? r.assigneeId : null,
            saves: !!(r && r.saves),
          });
        });
        if (s.routines.length) pushFeed(s, '☀️', 'רוטינות היומיום של הבית הוגדרו (' + s.routines.length + ')');
      });
      return state.routines.length;
    },

    addRoutine(r) {
      let added = null;
      update((s) => {
        if (s.routines.length >= 20) return;
        const title = String(r && r.title || '').trim().slice(0, 120);
        if (!title) return;
        const time = typeof (r && r.time) === 'string' && /^\d{1,2}:\d{2}$/.test(r.time.trim()) ? r.time.trim() : null;
        added = {
          id: uid(), title, time,
          assigneeId: r && typeof r.assigneeId === 'string' && s.household.members.some((m) => m.id === r.assigneeId) ? r.assigneeId : null,
          saves: !!(r && r.saves),
        };
        s.routines.push(added);
      });
      return added;
    },

    editRoutine(id, patch) {
      let ok = false;
      update((s) => {
        const r = s.routines.find((x) => x.id === id);
        if (!r) return;
        const title = String(patch && patch.title || '').trim().slice(0, 120);
        if (!title) return;
        r.title = title;
        const tm = typeof (patch && patch.time) === 'string' ? patch.time.trim() : '';
        r.time = /^\d{1,2}:\d{2}$/.test(tm) ? tm : null;
        r.saves = !!(patch && patch.saves);
        r.assigneeId = patch && typeof patch.assigneeId === 'string' &&
          s.household.members.some((m) => m.id === patch.assigneeId) ? patch.assigneeId : null;
        ok = true;
      });
      return ok;
    },

    deleteRoutine(id) {
      update((s) => {
        const i = s.routines.findIndex((x) => x.id === id);
        if (i < 0) return;
        delete s.routineLog.done[id];
        s.routines.splice(i, 1);
      });
    },

    toggleRoutine(id, localOpts) {
      let payload = null, unchecked = false;
      update((s) => {
        const r = s.routines.find((x) => x.id === id);
        if (!r) return;
        const me = currentMember();
        const rec = s.routineLog.done[id];
        if (rec) {
          delete s.routineLog.done[id];
          if (rec.byId && Number.isFinite(+s.points[rec.byId])) {
            s.points[rec.byId] = Math.max(0, s.points[rec.byId] - 1);
            s.pointsMonth[rec.byId] = Math.max(0, (s.pointsMonth[rec.byId] || 0) - 1);
          }
          s.xp.total = Math.max(0, s.xp.total - XP_PER_TASK);
          s.xp.level = Math.floor(s.xp.total / XP_PER_LEVEL) + 1;
          if (rec.saved) { s.savedTotal = Math.max(0, s.savedTotal - rec.saved); s.savedMonth = Math.max(0, s.savedMonth - rec.saved); }
          s.streak.count = Math.max(0, s.streak.count - 1);
          unchecked = true;
          return;
        }
        const saved = r.saves ? (s.household.mealCost || DEFAULT_MEAL_COST) : 0;
        s.routineLog.done[id] = { by: playerName(), byId: me && me.role !== 'pet' ? me.id : null, ts: Date.now(), saved };
        if (me && me.role !== 'pet') { s.points[me.id] = (s.points[me.id] || 0) + 1; s.pointsMonth[me.id] = (s.pointsMonth[me.id] || 0) + 1; }
        s.streak.count += 1; s.streak.best = Math.max(s.streak.best, s.streak.count);
        const prevLevel = s.xp.level;
        s.xp.total += XP_PER_TASK; s.xp.level = Math.floor(s.xp.total / XP_PER_LEVEL) + 1;
        if (saved) { s.savedTotal += saved; s.savedMonth += saved; }
        payload = {
          kind: r.saves ? 'lifeline' : 'chaos', routine: true, xp: XP_PER_TASK,
          savings: saved || null, savedTotal: saved ? s.savedMonth : null,
          title: r.title, by: playerName(), levelUp: s.xp.level > prevLevel ? s.xp.level : null,
        };
        pushFeed(s, saved ? '💰' : '☀️', playerName() + ' ✓ „' + trunc(r.title, 50) + '"' + (saved ? ' · ₪' + saved : ''));
      });
      if (payload) {
        if (App.fx) App.fx.reward(payload, localOpts || {});
        if (App.sync) App.sync.send({ type: 'reward', payload });
        toast('☀️ „' + escapeHtml(trunc(payload.title, 40)) + '" ✓ +1 נק׳' +
          (payload.savings ? ' · <b>₪' + payload.savings + '</b> נחסכו (החודש ₪' + payload.savedTotal + ') 💰' : ''), {
          actionLabel: 'ביטול', onAction: () => actions.toggleRoutine(id),
        });
      } else if (unchecked) { toast('↩️ הסימון בוטל — הנקודה וה-XP הוחזרו.'); }
      return !!payload;
    },

    deleteTask(taskId) {
      let removed = null;
      update((s) => {
        const i = s.tasks.findIndex((x) => x.id === taskId);
        if (i < 0) return;
        removed = { task: s.tasks.splice(i, 1)[0], index: i };
      });
      if (removed && prefs.focusTaskId === taskId) {
        const next = priorityTasks(state)[0];
        setPrefs({ focusTaskId: next ? next.id : null });
      }
      return removed;
    },

    restoreTask(task, index) {
      update((s) => {
        if (s.tasks.some((x) => x.id === task.id)) return;
        s.tasks.splice(clamp(index, 0, s.tasks.length), 0, task);
      });
      if (!prefs.focusTaskId && !task.done) setPrefs({ focusTaskId: task.id });
    },

    setFocus(taskId) {
      const t = state.tasks.find((x) => x.id === taskId && !x.done);
      if (t) setPrefs({ focusTaskId: t.id });
    },

    pickNextFocus() {
      const next = priorityTasks(state)[0];
      if (next) setPrefs({ focusTaskId: next.id });
      return !!next;
    },

    skipFocus() {
      const list = priorityTasks(state);
      if (list.length <= 1) { toast('Only this quest left — tiny start? 💪'); return; }
      const i = list.findIndex((t) => t.id === prefs.focusTaskId);
      setPrefs({ focusTaskId: list[(i + 1) % list.length].id });
    },

    toggleStep(taskId, stepId) {
      update((s) => {
        const t = s.tasks.find((x) => x.id === taskId);
        if (!t) return;
        const st = t.steps.find((x) => x.id === stepId);
        if (!st) return;
        st.done = !st.done;
        if (!t.done && t.steps.length && t.steps.every((x) => x.done)) {
          toast('✅ All steps ticked — smash DESTROY for the reward!');
        }
      });
    },

    addStep(taskId, text) {
      const clean = String(text || '').trim().slice(0, 140);
      if (!clean) return 0;
      let len = 0;
      update((s) => {
        const t = s.tasks.find((x) => x.id === taskId);
        if (!t) return;
        t.steps.push({ id: uid(), text: clean, done: false });
        len = t.steps.length;
      });
      return len;
    },

    splitTask(taskId) {
      let ok = false;
      update((s) => {
        const i = s.tasks.findIndex((x) => x.id === taskId);
        if (i < 0) return;
        const t = s.tasks[i];
        if (t.done || t.steps.length <= OVERLOAD_LIMIT) return;
        const cut = Math.ceil(t.steps.length / 2);
        const part2 = {
          id: uid(), laneId: t.laneId, title: baseTitle(t.title) + ' · Part 2', steps: t.steps.slice(cut),
          done: false, doneBy: null, doneById: null, createdAt: Date.now(), completedAt: null,
          savings: null, savedAmount: null, assigneeId: t.assigneeId, calendarDate: null,
        };
        t.title = baseTitle(t.title) + ' · Part 1';
        t.steps = t.steps.slice(0, cut);
        s.tasks.splice(i + 1, 0, part2);
        pushFeed(s, '✂️', playerName() + ' split a heavy quest into Part 1 + Part 2');
        ok = true;
      });
      return ok;
    },

    toggleLane(laneId) {
      update((s) => { const l = s.lanes.find((x) => x.id === laneId); if (l) l.collapsed = !l.collapsed; });
    },

    addLane(name) {
      const clean = String(name || '').trim().slice(0, 24);
      if (!clean) return null;
      let lane = null;
      update((s) => {
        const customs = s.lanes.filter((l) => l.custom).length;
        if (customs >= MAX_CUSTOM_LANES) return;
        const preset = CUSTOM_LANE_PRESETS[customs];
        lane = { id: uid(), name: clean, emoji: preset.emoji, color: preset.color, custom: true, collapsed: false };
        s.lanes.push(lane);
      });
      return lane;
    },

    removeLane(laneId) {
      let moved = 0;
      update((s) => {
        const i = s.lanes.findIndex((l) => l.id === laneId && l.custom);
        if (i < 0) return;
        s.tasks.forEach((t) => { if (t.laneId === laneId) { t.laneId = 'chaos'; moved += 1; } });
        s.lanes.splice(i, 1);
      });
      return moved;
    },

    sendHype(emoji, sfx) {
      if (!['❤️', '🔥', '🌸'].includes(emoji)) return;
      if (App.fx) App.fx.play('blip');
      if (App.sync) App.sync.send({ type: 'hype', emoji, sfx, by: playerName() });
      update((s) => pushFeed(s, emoji, playerName()));
    },

    sendNote(text) {
      const clean = String(text || '').trim().slice(0, 120);
      if (!clean) return false;
      const me = currentMember();
      if (!me || me.role === 'pet') { toast('התחברו בשם כדי לשלוח פתק 🙂'); return false; }
      update((s) => pushFeed(s, '💬', me.name + ': ' + clean));
      if (App.sync) App.sync.send({ type: 'note', by: me.name, text: clean });
      if (App.fx) App.fx.play('blip');
      return true;
    },

    setupHousehold(rows, mealCost, famName) {
      const pools = { adult: ['👨', '👩'], child: ['👦', '👧'], pet: ['🐶'] };
      const used = { adult: 0, child: 0, pet: 0 };
      let ok = false;
      update((s) => {
        const members = [];
        (Array.isArray(rows) ? rows : []).slice(0, 8).forEach((r) => {
          const name = String(r && r.name || '').trim().slice(0, 18);
          const role = r && ['adult', 'child', 'pet'].includes(r.role) ? r.role : 'adult';
          if (!name) return;
          members.push({ id: uid(), name, role, emoji: pools[role][used[role]++ % pools[role].length], lastSeen: 0 });
        });
        if (!members.some((m) => m.role !== 'pet')) return;
        s.household.members = members;
        const mcv = Number(mealCost);
        s.household.mealCost = Number.isFinite(mcv) && mcv > 0 ? Math.min(5000, Math.max(1, Math.round(mcv))) : DEFAULT_MEAL_COST;
        s.household.name = typeof famName === 'string' && famName.trim() ? famName.trim().slice(0, 18) : null;
        s.points = {};
        pushFeed(s, '🏠', 'משק הבית הוקם: ' + members.map((m) => m.emoji + ' ' + m.name).join(' · '));
      });
      ok = state.household.members.length > 0;
      return ok;
    },

    loginMember(memberId) {
      const m = state.household.members.find((x) => x.id === memberId);
      if (!m || m.role === 'pet') return null;
      const since = m.lastSeen || 0;
      const added = state.tasks.filter((t) => t.createdAt > since && t.doneById !== m.id);
      const doneList = state.tasks.filter((t) => t.done && t.completedAt > since && t.doneById !== m.id);
      setPrefs({ memberId: m.id });
      update((s) => { const mm = s.household.members.find((x) => x.id === m.id); if (mm) mm.lastSeen = Date.now(); });
      if (App.sync) App.sync.pingPresence();
      return {
        name: m.name, emoji: m.emoji, addedCount: added.length,
        added: added.slice(0, 3).map((t) => t.title),
        doneCount: doneList.length, done: doneList.slice(0, 3).map((t) => ({ title: t.title, by: t.doneBy })),
      };
    },

    logoutMember() { setPrefs({ memberId: null }); if (App.sync) App.sync.pingPresence(); },
    toggleStealth() { setPrefs({ stealth: !prefs.stealth }); return prefs.stealth; },
    toggleSound() { setPrefs({ sound: !prefs.sound }); return prefs.sound; },
    setTimerMinutes(min) { setPrefs({ timerMinutes: clamp(Math.round(min), 1, 120) }); },
  };

  let seasonBusy = false;
  function checkSeason() {
    if (seasonBusy || !state) return;
    if (state.season.month === monthKey()) return;
    seasonBusy = true;
    let ceremony = null;
    update((s) => {
      if (s.season.month === monthKey()) return;
      const humans = s.household.members.filter((m) => m.role !== 'pet');
      const total = Object.keys(s.pointsMonth).reduce((a, k) => a + (s.pointsMonth[k] || 0), 0);
      let champion = null;
      if (humans.length && total > 0) {
        const max = Math.max.apply(null, humans.map((m) => s.pointsMonth[m.id] || 0));
        const tops = humans.filter((m) => (s.pointsMonth[m.id] || 0) === max && max > 0);
        if (tops.length === 1) champion = tops[0];
      }
      if (total > 0) {
        if (!s.season.hall.some((h) => h.month === s.season.month)) {
          s.season.hall.unshift({
            month: s.season.month, championId: champion ? champion.id : null,
            name: champion ? champion.name : null,
            score: champion ? (s.pointsMonth[champion.id] || 0) : 0, saved: s.savedMonth,
          });
          if (s.season.hall.length > 24) s.season.hall.length = 24;
        }
        ceremony = {
          championId: champion ? champion.id : null, name: champion ? champion.name : null,
          score: champion ? (s.pointsMonth[champion.id] || 0) : 0, newMonth: monthKey(),
        };
        pushFeed(s, '🏆', champion
          ? champion.name + ' הוכתר/ה אלוף/ת החודש! (' + (s.pointsMonth[champion.id] || 0) + ' נק׳)'
          : 'תיקו חודשי — כתר משותף 🤝');
      }
      if (s.savedMonth > 0) pushFeed(s, '💰', 'החודש נחסכו ₪' + s.savedMonth + ' · במצבר: ₪' + s.savedTotal);
      s.savedMonth = 0; s.points = {}; s.pointsMonth = {};
      s.tasks = s.tasks.filter((t) => !t.done);
      s.season.month = monthKey();
    });
    seasonBusy = false;
    if (ceremony) {
      if (App.fx && App.fx.ceremony) App.fx.ceremony(ceremony);
      if (App.sync) App.sync.send({ type: 'ceremony', payload: ceremony });
    }
  }

  function touchLastSeen() {
    const m = currentMember();
    if (!m || memoryOnly) return;
    const mm = state.household.members.find((x) => x.id === m.id);
    if (mm) { mm.lastSeen = Date.now(); persist(); }
  }

  const handlers = Object.create(null);
  function on(name, fn) { handlers[name] = fn; }

  function bindDelegation() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const fn = handlers[el.dataset.action];
      if (fn) fn(el, e);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const el = e.target.closest('[data-enter-action]');
      if (!el) return;
      const fn = handlers[el.dataset.enterAction];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change-action]');
      if (!el) return;
      const fn = handlers[el.dataset.changeAction];
      if (fn) fn(el, e);
    });
  }

  function bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      const a = document.activeElement;
      const typing = (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || (a && a.isContentEditable);
      if (typing) return;
      if (e.key === '/') { e.preventDefault(); if (App.components.BrainDump) App.components.BrainDump.focus(); }
      else if (e.key === 'h' || e.key === 'H') { actions.toggleStealth(); }
    });
  }

  function renderHeader(s) {
    rollover(s);
    const root = document.getElementById('xp-root');
    if (root) {
      const today = todayDMY();
      const calToday = s.tasks.filter((t) => t.calendarDate === today);
      const rtTotal = s.routines.length + calToday.length;
      const rtDone = s.routines.filter((r) => s.routineLog.done[r.id]).length + calToday.filter((t) => t.done).length;
      const pct = rtTotal ? Math.round((rtDone / rtTotal) * 100) : 0;
      const humans = s.household.members.filter((m) => m.role !== 'pet');
      let board = '';
      if (humans.length) {
        const max = Math.max.apply(null, humans.map((m) => s.points[m.id] || 0));
        const tops = humans.filter((m) => (s.points[m.id] || 0) === max && max > 0);
        const leadId = tops.length === 1 ? tops[0].id : null;
        humans.sort((a, b) => (s.points[b.id] || 0) - (s.points[a.id] || 0));
        board =
          '<div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm mb-2.5">' +
          (leadId ? '<span class="bar-ico" style="font-size:1.1rem" title="מוביל/ת היום">👑</span>' : '') +
          humans.map((m) =>
            '<span dir="auto" class="' + (m.id === leadId ? 'font-extrabold' : 'font-bold') + '">' +
            '<span class="bar-ico">' + escapeHtml(m.emoji) + '</span> ' + escapeHtml(m.name) +
            (m.id === prefs.memberId ? ' (אני)' : '') + ': ' + (s.points[m.id] || 0) + ' נק׳</span>'
          ).join('<span style="color:var(--dim)">⚔️</span>') +
          '<span style="color:var(--dim)">·</span>' +
          '<span class="font-bold" style="color:#E8A25C;text-shadow:0 0 6px rgba(232,162,92,.75)"><span class="bar-ico">' +
          '<span class="coin-icon"><svg viewBox="0 0 24 24" width="100%" height="100%"><defs><radialGradient id="bch" cx="35%" cy="30%"><stop offset="0%" stop-color="#FFE8C2"/><stop offset="45%" stop-color="#CD7F32"/><stop offset="100%" stop-color="#5C3A14"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#bch)" stroke="#4A2E0F" stroke-width="1"/><circle cx="12" cy="12" r="9" fill="none" stroke="#4A2E0F" stroke-width="0.5" stroke-dasharray="1 0.8" opacity="0.6"/><rect x="9.2" y="9.2" width="5.6" height="5.6" fill="#0F1524" stroke="#4A2E0F" stroke-width="0.8"/><path d="M6 8.5a8 8 0 0 1 5-3.2" fill="none" stroke="#FFF3DC" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/></svg></span></span> חיסכון מצטבר: ₪' + s.savedTotal + '</span>' +
          '</div>';
      }
      root.innerHTML =
        board +
        (rtTotal
          ? '<div class="flex items-baseline justify-between mb-1.5" dir="rtl">' +
            '<span class="text-xs font-bold uppercase tracking-widest" style="color:var(--dim)">☀️ רוטינות היום</span>' +
            '<span class="text-xs font-semibold" dir="rtl" style="color:var(--dim)">' + rtDone + '/' + rtTotal + '</span></div>' +
            '<div class="xp-track"><div class="xp-fill" style="width:' + pct + '%"><div class="xp-shine"></div></div></div>'
          : '');
    }
    const soundBtn = document.getElementById('sound-btn');
    if (soundBtn) { soundBtn.textContent = prefs.sound ? '🔊' : '🔇'; soundBtn.setAttribute('aria-pressed', String(prefs.sound)); }
    const stealthBtn = document.getElementById('stealth-btn');
    if (stealthBtn) { stealthBtn.textContent = prefs.stealth ? '🪄' : '🙈'; stealthBtn.setAttribute('aria-pressed', String(prefs.stealth)); }
    document.body.classList.toggle('stealth', prefs.stealth);
    document.title = '🕹️ BottomLine';
  }

  function toast(message, opts) {
    const o = opts || {};
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast pop-in';
    el.setAttribute('role', 'status'); el.setAttribute('dir', 'auto');
    const span = document.createElement('span');
    span.className = 'flex-1'; span.innerHTML = message;
    el.appendChild(span);
    let timeoutId = null;
    const cleanup = () => { clearTimeout(timeoutId); el.classList.add('toast-out'); setTimeout(() => el.remove(), 220); };
    if (o.actionLabel) {
      const btn = document.createElement('button');
      btn.className = 'toast-btn'; btn.textContent = o.actionLabel;
      btn.addEventListener('click', () => { cleanup(); if (o.onAction) o.onAction(); });
      el.appendChild(btn);
    }
    root.appendChild(el);
    while (root.children.length > 3) root.firstChild.remove();
    timeoutId = setTimeout(cleanup, o.timeout || 4500);
  }

  function init() {
    loadPrefs();
    const res = loadState();
    state = res.state;
    if (prefs.memberId && !state.household.members.some((m) => m.id === prefs.memberId && m.role !== 'pet')) {
      prefs.memberId = null; savePrefs();
    }
    if (!prefs.focusTaskId || !state.tasks.some((t) => t.id === prefs.focusTaskId && !t.done)) {
      const first = priorityTasks(state)[0];
      prefs.focusTaskId = first ? first.id : null;
      savePrefs();
    }
    bindDelegation();
    bindShortcuts();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { rollover(state); checkSeason(); emit(); } });
    setInterval(() => {
      const before = state.routineLog.date;
      rollover(state);
      if (state.routineLog.date !== before) { persist(); emit(); }
      touchLastSeen();
      checkSeason();
    }, 60000);
    window.addEventListener('beforeunload', touchLastSeen);

    App.on('step-toggle', (el) => actions.toggleStep(el.dataset.taskId, el.dataset.stepId));
    App.on('toggle-sound', () => { actions.toggleSound(); });
    App.on('toggle-stealth', () => {
      const on_ = actions.toggleStealth();
      if (on_) toast('🙈 Stealth mode — just you and one quest, floating in space.');
    });

    if (App.sync) App.sync.init();
    ['RewardFX', 'FocusGate', 'TaskLanes', 'CoopHud', 'Routines', 'BrainDump', 'FrostView'].forEach((name) => {
      const c = App.components[name];
      if (c && typeof c.mount === 'function') c.mount();
      else console.warn('[boot] component missing:', name);
    });
    subscribe(renderHeader);

    const verEl = document.getElementById('app-version');
    if (verEl) verEl.textContent = 'BottomLine v' + APP_VERSION;

    persist(); emit(); checkSeason();

    if (res.source === 'backup') toast('🛟 Main save was unreadable — restored your backup.');
    else if (res.source === 'reset') toast('⚠️ Saved data was unreadable — fresh start (old copy kept in quarantine).');
    if (memoryOnly) toast('⚠️ Browser storage is blocked — changes won’t survive closing this tab.');
  }

  const App = {
    components: {}, fx: null, sync: null, actions, on, getState, getPrefs, setPrefs,
    playerName, currentMember, focusedTask, reloadFromStorage, subscribe, emit, toast,
    laneTasks, priorityTasks, isOverloaded, LANE_THEME,
    constants: { APP_VERSION, OVERLOAD_LIMIT, MAX_CUSTOM_LANES, XP_PER_TASK, XP_PER_LEVEL, STORAGE_KEY },
    utils: { uid, escapeHtml, clamp, todayKey, monthKey, todayDMY, trunc, stepRow, fmtClock, setHtmlPreserving },
  };
  window.App = App;
  document.addEventListener('DOMContentLoaded', init);
})();
