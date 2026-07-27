/* =============================================================================
 * ButtonLine · src/sync.js
 * -----------------------------------------------------------------------------
 * SyncEngine — real-time couple synchronization (optimistic, millisecond-fast).
 *
 * TRANSPORT (current): "Local Link"
 *   • BroadcastChannel between browser windows/tabs on the SAME machine
 *   • window 'storage' events as a universal fallback
 *   • Shared state itself lives in localStorage (see app.js) — a partner's
 *     write triggers 'state-changed' here → we re-read and repaint instantly.
 *
 * TRANSPORT (future, pluggable): an online channel (e.g. Supabase Realtime)
 *   can be swapped in behind the same send()/handle() seam to sync two
 *   different computers. Not added yet — external services need approval.
 *
 * Message types:
 *   state-changed              → partner mutated shared state; re-read storage
 *   reward   {payload}         → play the category FX matrix on this screen too
 *   hype     {emoji,sfx,by}    → partner sent cheer; float it across my screen
 *   ceremony {payload}         → monthly champion crowned; show it here too
 *   presence {name,focus,bye}  → heartbeat for the HUD (online dot + their quest)
 * ========================================================================== */
(function () {
  'use strict';

  const CHANNEL = 'buttonline:link';
  const PING_KEY = 'buttonline:ping'; // storage-event fallback mailbox
  const tabId = App.utils.uid();

  let chan = null;
  const peers = Object.create(null); // tabId → { name, focus, ts }
  let heartbeatId = null;

  /* ------------------------------ transport ------------------------------- */
  function send(msg) {
    msg.from = tabId;
    msg.ts = Date.now();
    if (chan) {
      try { chan.postMessage(msg); } catch (e) { /* channel closed */ }
    }
    // Fallback mailbox: fires 'storage' in every OTHER window on this machine.
    try { localStorage.setItem(PING_KEY, JSON.stringify(msg)); } catch (e) { /* fine */ }
    // Cloud relay: same message, other devices.
    if (cloudChan && cloudState === 'on') {
      try { cloudChan.send({ type: 'broadcast', event: 'msg', payload: msg }); } catch (e) { /* fine */ }
    }
  }

  function handle(msg) {
    if (!msg || msg.from === tabId) return;
    switch (msg.type) {
      case 'state-changed':
        App.reloadFromStorage();
        break;
      case 'reward':
        if (App.fx && msg.payload) App.fx.reward(msg.payload, { remote: true });
        break;
      case 'note':
        App.toast('💬 <b>' + App.utils.escapeHtml(msg.by || '') + '</b>: ' + App.utils.escapeHtml(msg.text || ''));
        if (App.fx) App.fx.play('blip');
        break;
      case 'hype':
        if (App.fx) App.fx.hype(msg.emoji, msg.sfx, { remote: true, by: msg.by });
        break;
      case 'ceremony':
        if (App.fx && App.fx.ceremony) App.fx.ceremony(msg.payload);
        break;
      case 'presence':
        if (msg.bye) { delete peers[msg.from]; }
        else peers[msg.from] = { memberId: msg.memberId || null, name: msg.name, focus: msg.focus, v: msg.v || null, ts: msg.ts };
        if (App.components.CoopHud) App.components.CoopHud.paintPresence();
        break;
    }
  }

  /* ------------------------------ presence -------------------------------- */
  function pingPresence(bye) {
    const t = App.focusedTask(App.getState());
    send({
      type: 'presence',
      memberId: App.getPrefs().memberId,
      name: App.playerName(),
      focus: t ? App.utils.trunc(t.title, 60) : null,
      v: App.constants.APP_VERSION,
      bye: bye === true || undefined,
    });
  }

  /* All household members currently online in OTHER windows (fresh < 9s). */
  function onlineMembers() {
    const now = Date.now();
    const mine = App.getPrefs().memberId;
    const seen = Object.create(null);
    const out = [];
    Object.keys(peers).forEach((id) => {
      const p = peers[id];
      if (now - p.ts >= 9000) return;
      if (!p.memberId || p.memberId === mine || seen[p.memberId]) return;
      seen[p.memberId] = 1;
      out.push({ memberId: p.memberId, name: p.name, focus: p.focus, v: p.v || null });
    });
    return out;
  }

  /* ------------------------------ cloud link ------------------------------- */
  /* Values come ONLY from the user's local src/config.js — never via chat.
   * Empty config ⇒ Local Link only. Full config ⇒ cross-device sync:
   *   events  → realtime broadcast channel (same handle() path as local)
   *   state   → public.boards row {id: roomCode, state, writer, updated_at}
   *             debounced upsert on change · postgres_changes apply on remote
   *             writes · one pull at boot = cross-device catch-up.            */
  const CLOUD_CFG_KEY = 'buttonline:cloud';
  let cfg = { url: '', key: '', room: '' };
  function getCloudCfg() {
    const f = window.BUTTONLINE_CONFIG || {};
    let l = {};
    try { l = JSON.parse(localStorage.getItem(CLOUD_CFG_KEY) || '{}') || {}; } catch (e) { /* fine */ }
    return {
      url: String(f.supabaseUrl || l.url || '').trim().replace(/\/$/, ''),
      key: String(f.supabaseKey || l.key || '').trim(),
      room: String(f.roomCode || l.room || '').trim(),
    };
  }
  /* Validates + stores the trio locally (this machine only). Returns error text or null. */
  function saveCloudConfig(v) {
    const url = String(v.url || '').trim().replace(/\/$/, '');
    const key = String(v.key || '').trim();
    const room = String(v.room || '').trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) return 'הכתובת צריכה להיראות כמו https://xxxx.supabase.co';
    if (/secret/i.test(key)) return '⛔ זה מפתח סודי (secret) — אסור! חפש את ה-Publishable key.';
    if (!(key.indexOf('sb_publishable_') === 0 || key.indexOf('eyJ') === 0)) return 'המפתח צריך להתחיל ב-sb_publishable_';
    if (room.length < 12) return 'קוד־הבית קצר מדי — לחץ 🎲 לייצור קוד חזק';
    try { localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify({ url, key, room })); }
    catch (e) { return 'אחסון הדפדפן חסום'; }
    return null;
  }

  let cloud = null;
  let cloudChan = null;
  let cloudState = 'off'; // off | loading | on | error
  let cloudErr = '';
  let pushTimer = null;

  const cloudConfigured = () => { const c = getCloudCfg(); return !!(c.url && c.key && c.room); };
  function cloudStatus() { return { state: cloudState, error: cloudErr }; }

  function cloudFail(msg) {
    cloudState = 'error';
    cloudErr = String(msg || 'שגיאה').slice(0, 140);
    App.toast('☁️⚠️ הענן לא מחובר — ' + App.utils.escapeHtml(cloudErr));
    if (App.components.CoopHud) App.components.CoopHud.paintPresence();
  }

  function initCloud() {
    if (!cloudConfigured()) return;
    cfg = getCloudCfg();
    cloudState = 'loading';
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload = () => { try { connectCloud(); } catch (e) { cloudFail(e.message); } };
    s.onerror = () => cloudFail('אין חיבור רשת לטעינת ספריית הענן');
    document.head.appendChild(s);
  }

  function connectCloud() {
    cloud = window.supabase.createClient(cfg.url, cfg.key);

    cloudChan = cloud.channel('bl:' + cfg.room);
    cloudChan.on('broadcast', { event: 'msg' }, (p) => handle(p.payload));
    cloudChan.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        cloudState = 'on';
        App.toast('☁️ הענן מחובר — סנכרון בין מכשירים פעיל!');
        if (App.components.CoopHud) App.components.CoopHud.paintPresence();
        pingPresence();
        pullBoard();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        cloudFail('ערוץ הזמן־אמת נכשל (' + status + ')');
      }
    });

    cloud.channel('bl-db:' + cfg.room)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'boards', filter: 'id=eq.' + cfg.room },
        (payload) => {
          const row = payload.new;
          if (row && row.writer !== tabId && row.state) applyRemote(row.state);
        })
      .subscribe();
  }

  function applyRemote(stateObj) {
    try { localStorage.setItem(App.constants.STORAGE_KEY, JSON.stringify(stateObj)); }
    catch (e) { /* storage blocked — reload still refreshes memory state */ }
    App.reloadFromStorage();
  }

  function pullBoard() {
    cloud.from('boards').select('state,writer').eq('id', cfg.room).maybeSingle()
      .then((res) => {
        if (res.error) {
          const m = res.error.message || '';
          if ((res.error.code || '') === '42P01' || /does not exist|Could not find the table|schema cache/i.test(m)) {
            cloudFail('טבלת boards עוד לא קיימת — זה הצעד הבא שלנו יחד');
          } else cloudFail(m);
          return;
        }
        if (res.data && res.data.state) applyRemote(res.data.state); // cloud catch-up
        else pushBoard(); // first device here — publish my board
      });
  }

  function pushBoard() {
    if (!cloud || cloudState !== 'on') return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      let raw = null;
      try { raw = localStorage.getItem(App.constants.STORAGE_KEY); } catch (e) { /* blocked */ }
      if (!raw) return;
      let obj = null;
      try { obj = JSON.parse(raw); } catch (e) { return; }
      cloud.from('boards')
        .upsert({ id: cfg.room, state: obj, writer: tabId, updated_at: new Date().toISOString() })
        .then((res) => { if (res.error) cloudFail(res.error.message); });
    }, 400);
  }

  /* -------------------------------- init ---------------------------------- */
  function init() {
    if ('BroadcastChannel' in window) {
      chan = new BroadcastChannel(CHANNEL);
      chan.onmessage = (e) => handle(e.data);
    }
    window.addEventListener('storage', (e) => {
      if (e.key === PING_KEY && e.newValue) {
        let msg = null;
        try { msg = JSON.parse(e.newValue); } catch (err) { /* ignore */ }
        // BroadcastChannel already delivered it where available; the mailbox
        // matters when the channel is missing.
        if (msg && !chan) handle(msg);
      } else if (e.key === App.constants.STORAGE_KEY && !chan) {
        App.reloadFromStorage(); // partner wrote state; no channel → storage event
      }
    });

    pingPresence();
    heartbeatId = setInterval(pingPresence, 3000);
    initCloud();
    window.addEventListener('beforeunload', () => {
      clearInterval(heartbeatId);
      pingPresence(true);
    });
  }

  App.sync = {
    init,
    send,
    pingPresence,
    onlineMembers,
    notifyStateChanged() { send({ type: 'state-changed' }); pushBoard(); },
    cloudStatus,
    getCloudCfg,
    saveCloudConfig,
  };
})();
