/* =============================================================================
 * ButtonLine · src/components/RewardFX.js
 * -----------------------------------------------------------------------------
 * The High-Fidelity Audio-Visual Reward Engine.
 * One full-screen canvas + one flash overlay + the Web Audio API — no asset
 * files, works offline, respects prefers-reduced-motion and the sound toggle.
 *
 * Matrices (also triggered remotely by the partner via SyncEngine):
 *   🌱 lifeline → cascading coin SFX · 💰 treasure drop bursts into 🪙 coins ·
 *                 “+₪120 Saved!” + “+100 XP” neon-green floats
 *   🚨 meteors  → heavy vault-lock clunk + sci-fi shield hum · holographic
 *                 forcefield ring sweeps the screen, disintegrating red
 *                 meteors into sparkling dust
 *   💰 wealth   → retro cash-register “cha-ching!” + money-counter ticks ·
 *                 green bill rain + 👛 wallet swells with a gold ring
 *   🪰 chaos    → comic “POP!” zap · the card shatters into glass shards /
 *                 poofs into cartoon smoke
 *   🏆 level-up → 8-bit fanfare + synchronized fullscreen particle storm
 * ========================================================================== */
(function () {
  'use strict';

  const reducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================ AUDIO ENGINE =============================== */
  let actx = null;
  let noiseBuf = null;

  function ac() {
    if (!App.getPrefs().sound) return null;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function noise(c) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  }
  function tone(freq, o) {
    o = o || {};
    const c = ac(); if (!c) return;
    const t = c.currentTime + (o.at || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + (o.dur || 0.3));
    const dur = o.dur || 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.peak || 0.14, t + (o.attack || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noiseHit(o) {
    o = o || {};
    const c = ac(); if (!c) return;
    const t = c.currentTime + (o.at || 0);
    const src = noise(c);
    const f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.value = o.freq || 1800;
    f.Q.value = o.q || 1;
    const g = c.createGain();
    const dur = o.dur || 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.peak || 0.2, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t); src.stop(t + dur + 0.05);
  }

  const SFX = {
    blip() { tone(560, { dur: 0.08, peak: 0.09 }); tone(790, { at: 0.05, dur: 0.08, peak: 0.08 }); },
    timeup() { tone(659, { dur: 0.5, peak: 0.12 }); tone(523, { at: 0.18, dur: 0.7, peak: 0.12 }); tone(392, { at: 0.36, dur: 1.0, peak: 0.1 }); },

    /* 🌱 supermarket register drawer springs open → cascading coins */
    coins() {
      noiseHit({ freq: 260, q: 1, dur: 0.14, filter: 'lowpass', peak: 0.22 });      // drawer thunk
      noiseHit({ at: 0.05, freq: 1600, q: 3, dur: 0.09, peak: 0.1 });               // slide rattle
      tone(1568, { at: 0.1, dur: 0.35, type: 'triangle', peak: 0.12 });             // register ding!
      for (let i = 0; i < 14; i++) {
        const at = i * 0.045 + Math.random() * 0.03;
        tone(2400 + Math.random() * 2200, { at, dur: 0.09, type: 'triangle', peak: 0.06 });
        noiseHit({ at: at + 0.01, freq: 5200, q: 8, dur: 0.05, peak: 0.05 });
      }
      tone(1318, { at: 0.65, dur: 0.4, type: 'triangle', peak: 0.08 });
    },

    /* 🚨 heavy vault lock clunk → heroic sci-fi shield hum */
    vault() {
      tone(120, { dur: 0.22, glide: 42, peak: 0.3 });                 // heavy thud
      noiseHit({ freq: 2400, q: 2, dur: 0.06, peak: 0.22 });          // metal clack
      noiseHit({ at: 0.12, freq: 900, q: 3, dur: 0.1, peak: 0.16 }); // bolt seats
      tone(70,  { at: 0.28, dur: 1.1, type: 'sawtooth', glide: 130, attack: 0.25, peak: 0.09 }); // shield hum
      tone(140, { at: 0.32, dur: 1.0, type: 'sawtooth', glide: 262, attack: 0.3,  peak: 0.05 });
      tone(1046,{ at: 0.5,  dur: 0.6, type: 'triangle', peak: 0.05 }); // heroic sheen
    },

    /* 💰 retro cash-register “cha-ching!” + rapid money-counter */
    chaching() {
      tone(1567, { dur: 0.35, type: 'triangle', peak: 0.14 });        // cha
      tone(2093, { at: 0.09, dur: 0.5, type: 'triangle', peak: 0.13 }); // ching!
      noiseHit({ at: 0.16, freq: 300, q: 1, dur: 0.15, filter: 'lowpass', peak: 0.2 }); // drawer
      for (let i = 0; i < 12; i++) noiseHit({ at: 0.34 + i * 0.03, freq: 3800, q: 6, dur: 0.025, peak: 0.05 }); // counter
    },

    /* 🪰 comic POP! + tiny futuristic zap */
    pop() {
      tone(880, { dur: 0.09, type: 'square', glide: 180, peak: 0.16 });
      noiseHit({ freq: 2600, q: 1.5, dur: 0.05, peak: 0.14 });
      tone(1400, { at: 0.05, dur: 0.1, type: 'sawtooth', glide: 200, peak: 0.05 });
    },

    /* 🏆 8-bit level-up fanfare */
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.16, type: 'square', peak: 0.09 }));
      [1046, 1318, 1568].forEach((f, i) => tone(f, { at: 0.4 + i * 0.07, dur: 0.3, type: 'square', peak: 0.08 }));
      tone(2093, { at: 0.62, dur: 0.6, type: 'square', peak: 0.07 });
    },

    hype() { tone(720, { dur: 0.07, type: 'square', peak: 0.08 }); tone(1080, { at: 0.05, dur: 0.09, type: 'square', peak: 0.07 }); },

    /* 🏆 triumphant 16-bit retro victory anthem */
    anthem() {
      [[523, 0], [659, 0.12], [784, 0.24], [1046, 0.36], [784, 0.5], [1046, 0.62], [1318, 0.74], [1568, 0.9]]
        .forEach((n) => tone(n[0], { at: n[1], dur: 0.18, type: 'square', peak: 0.09 }));
      tone(2093, { at: 1.12, dur: 0.8, type: 'square', peak: 0.08 });
      tone(1046, { at: 1.12, dur: 0.8, type: 'triangle', peak: 0.06 });
      noiseHit({ at: 1.12, freq: 6200, q: 4, dur: 0.3, peak: 0.05 });
    },
  };
  function play(name) { (SFX[name] || SFX.blip)(); }

  /* ============================ CANVAS ENGINE ============================== */
  let canvas = null, ctx = null, rafId = null;
  let parts = [];   // {kind:'rect'|'dot'|'text'|'shard'|'meteor', ...physics}
  let rings = [];   // expanding forcefield rings {x,y,r,vr,max,color}

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  function setupCanvas() {
    canvas = document.getElementById('fx-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(W() * dpr);
      canvas.height = Math.floor(H() * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
  }

  function kick() { if (!rafId && ctx) rafId = requestAnimationFrame(step); }
  function add(p) { parts.push(p); kick(); }

  function step() {
    ctx.clearRect(0, 0, W(), H());

    /* rings first (behind particles) */
    rings = rings.filter((r) => r.r < r.max);
    for (const r of rings) {
      r.r += r.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - r.r / r.max) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 6;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 26;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      /* forcefield disintegrates meteors it touches */
      for (const p of parts) {
        if (p.kind === 'meteor' && !p.dead) {
          const dx = p.x - r.x, dy = p.y - r.y;
          if (Math.abs(Math.sqrt(dx * dx + dy * dy) - r.r) < 26) {
            p.dead = true;
            sparkleDust(p.x, p.y);
          }
        }
      }
    }

    parts = parts.filter((p) => p.life > 0 && !p.dead);
    for (const p of parts) {
      p.vy += (p.g !== undefined ? p.g : 0.16);
      p.vx *= 0.988; p.vy *= 0.996;
      p.x += p.vx; p.y += p.vy;
      if (p.kind === 'ribbon') { // streamers wave as they cascade
        p.x += Math.sin((p.life + (p.phase || 0)) * 0.14) * 1.3;
        p.rot = Math.sin((p.life + (p.phase || 0)) * 0.09) * 0.9;
      } else {
        p.rot = (p.rot || 0) + (p.vr || 0);
      }
      p.life -= 1;
      const a = Math.min(1, p.life / (p.fade || 30)) * (p.alpha || 1);

      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === 'rect') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.kind === 'ribbon') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.18, -p.size, p.size * 0.36, p.size * 2);
      } else if (p.kind === 'dot') {
        ctx.fillStyle = p.color;
        if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 14; }
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'meteor') {
        ctx.fillStyle = '#FF4D6D';
        ctx.shadowColor = '#FF4D6D'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a * 0.4;
        ctx.fillRect(-2, -p.size * 4, 4, p.size * 4); // trail
      } else if (p.kind === 'text') {
        ctx.font = (p.weight || 800) + ' ' + p.size + 'px "Bricolage Grotesque", Heebo, sans-serif';
        ctx.textAlign = 'center';
        if (p.glow) { ctx.shadowColor = p.color || '#fff'; ctx.shadowBlur = 18; }
        ctx.fillStyle = p.color || '#fff';
        ctx.fillText(p.text, 0, 0);
      } else if (p.kind === 'shard') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.8, p.size * 0.6);
        ctx.lineTo(-p.size * 0.8, p.size * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (parts.length || rings.length) rafId = requestAnimationFrame(step);
    else { rafId = null; ctx.clearRect(0, 0, W(), H()); }
  }

  /* ------------------------------ spawners -------------------------------- */
  function confetti(x, y, n, colors) {
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const spd = 5 + Math.random() * 9;
      add({
        kind: Math.random() < 0.6 ? 'rect' : 'dot',
        x, y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        size: 4 + Math.random() * 6,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        life: 80 + Math.random() * 50,
      });
    }
  }
  function sparkleDust(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      add({ kind: 'dot', x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, g: 0.03,
            size: 1.5 + Math.random() * 2, color: '#99F6E4', glow: true, life: 34 });
    }
  }
  function floatText(x, y, text, color, size) {
    add({ kind: 'text', x, y, vx: 0, vy: -1.4, g: -0.012, text, color, glow: true,
          size: size || 26, life: 95, fade: 40 });
  }

  /* 🌱 treasure chest drop → coin burst + savings float */
  function fxTreasure(savings, xp) {
    const x = W() / 2, land = H() * 0.42;
    add({ kind: 'text', x, y: -50, vx: 0, vy: 7, g: 0.3, text: '💰', size: 64, life: 26, fade: 6 });
    /* burst fires as the falling bag's life ends (~420 ms at 60 fps) */
    setTimeout(() => {
      if (reducedMotion()) return;
      for (let i = 0; i < 22; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
        const s = 4 + Math.random() * 7;
        add({ kind: 'text', x, y: land, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
              text: '🪙', size: 18 + Math.random() * 12, life: 70, vr: (Math.random() - 0.5) * 0.2 });
      }
      add({ kind: 'dot', x, y: land, vx: 0, vy: 0, g: 0, size: 30, color: '#FFD166',
            glow: true, life: 14, fade: 14, alpha: 0.55 });
      if (savings) floatText(x, land - 60, '‎+₪' + savings + ' נחסכו!', '#34D399', 32);
      floatText(x, land - 24, '+' + xp + ' ✨', '#8FF0C8', 22);
    }, 420);
  }

  /* 🚨 red threat meteors + sweeping holographic forcefield */
  function fxForcefield() {
    for (let i = 0; i < 8; i++) {
      add({ kind: 'meteor', x: Math.random() * W(), y: -30 - Math.random() * 200,
            vx: (Math.random() - 0.5) * 1.5, vy: 3.2 + Math.random() * 2.4, g: 0.02,
            size: 6 + Math.random() * 6, life: 260 });
    }
    setTimeout(() => {
      rings.push({ x: W() / 2, y: H() * 0.55, r: 10, vr: 16, max: Math.max(W(), H()) * 0.75, color: '#2DD4BF' });
      rings.push({ x: W() / 2, y: H() * 0.55, r: 4, vr: 13, max: Math.max(W(), H()) * 0.7, color: '#7DD3FC' });
      kick();
      flash('shield');
      floatText(W() / 2, H() * 0.4, '🛡️ הכיסוי מאובטח!', '#99F6E4', 30);
    }, 380);
  }

  /* 💰 green bill rain + wallet swelling with a gold ring */
  function fxBillRain(xp) {
    for (let i = 0; i < 26; i++) {
      add({ kind: 'rect', x: Math.random() * W(), y: -20 - Math.random() * 260,
            vx: Math.sin(i) * 0.8, vy: 2 + Math.random() * 2.2, g: 0.015,
            size: 16 + Math.random() * 8, color: i % 3 ? '#34D399' : '#8FF0C8',
            rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.12, life: 190, fade: 50 });
    }
    const wx = W() / 2, wy = H() * 0.45;
    add({ kind: 'text', x: wx, y: wy, vx: 0, vy: -0.15, g: 0, text: '👛', size: 58, life: 110, fade: 30 });
    rings.push({ x: wx, y: wy, r: 26, vr: 3.4, max: 190, color: '#FFD166' });
    kick();
    floatText(wx, wy - 66, '💸 הכסף בדרך חזרה לחשבון!', '#FFE3A3', 26);
    floatText(wx, wy - 34, '+' + xp + ' ✨', '#FFD166', 20);
  }

  /* 🪰 glass shatter from the card's rectangle (or a center poof remotely) */
  function fxShatter(rect) {
    const r = rect || { x: W() / 2 - 120, y: H() * 0.5 - 40, w: 240, h: 80 };
    for (let i = 0; i < 18; i++) {
      add({ kind: 'shard',
            x: r.x + Math.random() * r.w, y: r.y + Math.random() * r.h,
            vx: (Math.random() - 0.5) * 7, vy: -2 - Math.random() * 4, g: 0.28,
            size: 5 + Math.random() * 8, color: i % 2 ? '#DDB8FF' : '#C084FC',
            rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, life: 60 });
    }
    for (let i = 0; i < 8; i++) {
      add({ kind: 'dot', x: r.x + r.w / 2, y: r.y + r.h / 2,
            vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 2, g: -0.02,
            size: 8 + Math.random() * 10, color: 'rgba(200,200,220,.5)', life: 36, fade: 36 });
    }
    floatText(r.x + r.w / 2, r.y, 'POP! 💨', '#DDB8FF', 24);
  }

  /* 🏆 synchronized fullscreen particle storm */
  function storm(level) {
    flash('level');
    play('fanfare');
    if (!reducedMotion()) {
      const colors = ['#FF4D6D', '#FFD166', '#34D399', '#C084FC', '#2DD4BF', '#60A5FA'];
      confetti(W() * 0.25, H() * 0.35, 90, colors);
      confetti(W() * 0.75, H() * 0.35, 90, colors);
      confetti(W() * 0.5, H() * 0.2, 110, colors);
      floatText(W() / 2, H() * 0.32, 'רמה ' + level + '!', '#FFD166', 46);
    }
    App.toast('🏆 <b>רמה ' + level + '</b>!');
  }

  function flash(kind) {
    const o = document.getElementById('flash-overlay');
    if (!o) return;
    o.className = kind;
    requestAnimationFrame(() => o.classList.add('on'));
    setTimeout(() => o.classList.remove('on'), 650);
  }

  /* 🏆 Monthly Crown Ceremony — fires once per month per window. */
  const crownedMonths = Object.create(null);
  const RIBBON_COLORS = ['#FF4D6D', '#FFD166', '#34D399', '#C084FC', '#2DD4BF', '#60A5FA', '#FF8A3D'];

  function stormWave() {
    for (let i = 0; i < 10; i++) {
      add({ kind: 'ribbon', x: Math.random() * W(), y: -40 - Math.random() * 120,
            vx: (Math.random() - 0.5) * 1.4, vy: 2.4 + Math.random() * 2.4, g: 0.03,
            size: 14 + Math.random() * 12, color: RIBBON_COLORS[i % RIBBON_COLORS.length],
            phase: Math.random() * 60, life: 200, fade: 46 });
    }
    confetti(Math.random() * W(), -10, 12, RIBBON_COLORS);
    add({ kind: 'text', text: '👑', x: Math.random() * W(), y: -30,
          vx: (Math.random() - 0.5) * 1, vy: 2 + Math.random() * 2, g: 0.05,
          size: 22 + Math.random() * 12, vr: (Math.random() - 0.5) * 0.15, life: 180, fade: 40 });
  }

  function ceremony(payload) {
    if (!payload || !payload.newMonth || crownedMonths[payload.newMonth]) return;
    crownedMonths[payload.newMonth] = true;

    play('anthem');
    flash('gold');
    let stormId = null;
    if (!reducedMotion()) {
      stormWave();
      stormId = setInterval(stormWave, 420); // continuous cascading storm
    }

    const escName = App.utils.escapeHtml(payload.name || '');
    const ov = document.createElement('div');
    ov.className = 'ceremony-overlay';
    ov.innerHTML =
      '<div class="card neon pop-in p-8 md:p-12 text-center max-w-xl mx-4" style="--lane:#FFD166" dir="rtl">' +
      '<div class="trophy-spin" aria-hidden="true">🏆</div>' +
      '<h2 class="font-display text-2xl md:text-3xl font-extrabold mt-3">אלוף ה-ButtonLine החודשי הוכתר!</h2>' +
      (payload.championId
        ? '<div class="my-4"><span class="champ-frame champ-aura font-display text-3xl md:text-4xl font-extrabold" dir="auto">👑 ' + escName + '</span></div>' +
          '<p class="text-xl font-bold tabular-nums" dir="ltr">' + payload.score + ' נק׳</p>'
        : '<div class="font-display text-2xl md:text-3xl font-extrabold my-4">🤝 תיקו — כתר משותף!</div>') +
      '<p class="mt-6 text-sm leading-relaxed" style="color:var(--dim)">חודש חדש התחיל. הקרב על ה-ButtonLine מתאפס עכשיו.<br>' +
      'האלוף הנוכחי: <b style="color:#FFD166">' + (payload.championId ? escName : 'משותף 🤝') + '</b></p>' +
      '<button class="btn-soft mt-7">פותחים עידן חדש ▶</button></div>';

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      if (stormId) clearInterval(stormId);
      ov.remove();
      App.toast('🌅 חודש חדש — הלוח נקי, הקרב חוזר מ־0:0!');
    };
    ov.addEventListener('click', close);
    setTimeout(close, 14000);
    document.body.appendChild(ov);
  }

  /* ============================ PUBLIC MATRIX ============================== */
  /* payload: {kind, xp, savings, title, by, levelUp} · opts: {rect, remote}   */
  function reward(payload, opts) {
    const o = opts || {};
    const rm = reducedMotion();
    switch (payload.kind) {
      case 'lifeline':
        play('coins');
        if (!rm) fxTreasure(payload.savings, payload.xp);
        if (payload.savings && !(payload.routine && !o.remote)) {
          App.toast('💰 „' + App.utils.escapeHtml(App.utils.trunc(payload.title, 40)) + '" חסכה לכם <b>₪' + payload.savings + '</b>' +
            (payload.savedTotal ? ' · החודש: <b>₪' + payload.savedTotal + '</b>' : ''));
        }
        break;
      case 'meteors':
        play('vault');
        if (!rm) fxForcefield();
        App.toast('🛡️ הכיסוי הרפואי והפנסיוני מאובטח! חסמתם קטסטרופה פיננסית.');
        break;
      case 'wealth':
        play('chaching');
        if (!rm) fxBillRain(payload.xp);
        App.toast('💰 הכסף בדרך חזרה לחשבון! (החזר מבוקש)');
        break;
      default: /* chaos */
        play('pop');
        if (!rm) fxShatter(o.rect || null);
        break;
    }
    if (o.remote) {
      App.toast(payload.routine
        ? '☀️ <b>' + App.utils.escapeHtml(payload.by || '') + '</b> סימן/ה: „' +
          App.utils.escapeHtml(App.utils.trunc(payload.title, 44)) + '" ✓'
        : '💥 <b>' + App.utils.escapeHtml(payload.by || '') + '</b> · „' +
          App.utils.escapeHtml(App.utils.trunc(payload.title, 44)) + '"');
    }
    if (payload.leadName) {
      const mine = App.getPrefs().memberId === payload.leadId;
      App.toast(mine
        ? '⚔️ עלית להובלה! 🔥 תשמור/תשמרי על הקצב.'
        : '⚔️ <b>' + App.utils.escapeHtml(payload.leadName) + '</b> עולה להובלה — רדפו!');
    }
    if (payload.levelUp) setTimeout(() => storm(payload.levelUp), 500);
  }

  /* Hype & Cheer: physics-based emojis shooting across the screen. */
  function hype(emoji, sfx, opts) {
    const o = opts || {};
    play(sfx || 'hype');
    if (!reducedMotion()) {
      const fromLeft = Math.random() < 0.5;
      for (let i = 0; i < 6; i++) {
        add({ kind: 'text',
              x: fromLeft ? -30 : W() + 30,
              y: H() * (0.3 + Math.random() * 0.4),
              vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 5),
              vy: -3 - Math.random() * 3, g: 0.12,
              text: emoji, size: 26 + Math.random() * 16,
              vr: (Math.random() - 0.5) * 0.2, life: 120, fade: 30 });
      }
    }
    if (o.remote) App.toast('📣 ' + App.utils.escapeHtml(o.by || 'Partner') + ' sends ' + emoji);
  }

  function mount() { setupCanvas(); }

  App.fx = { reward, hype, play, ceremony };
  App.components.RewardFX = { mount };
})();
