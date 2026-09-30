// 소리: 파일 없이 브라우저의 Web Audio 로 직접 합성한다(저작권 문제 없음).
// 브라우저는 사용자가 키를 누르기 전에는 소리를 못 내게 막으므로, 첫 키 입력 때 unlock() 으로 켠다.
// 소리가 막힌 환경에서는 조용히 무음으로 동작한다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  const KEY = 'bakery-sim.audio';

  let ctx = null;
  let master = null;
  let vol = 0.7;
  let mute = false;
  let track = null;
  let timer = null;
  let step = 0;
  try {
    const s = JSON.parse(globalThis.localStorage.getItem(KEY));
    if (s) {
      vol = typeof s.vol === 'number' ? s.vol : vol;
      mute = !!s.mute;
    }
  } catch (e) {
    /* 저장소를 못 써도 기본값으로 진행 */
  }
  const save = () => {
    try {
      globalThis.localStorage.setItem(KEY, JSON.stringify({ vol, mute }));
    } catch (e) {
      /* 무시 */
    }
  };
  const apply = () => {
    if (master) master.gain.value = mute ? 0 : vol * 0.5;
  };

  // 음 하나: 주파수 f(Hz)를 dur 초 동안, 점점 작아지게. to 가 있으면 그 주파수로 미끄러진다
  function tone(f, t0, dur, type = 'square', v = 0.2, to) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // 효과음: [주파수, 시작 지연(초), 길이(초), 파형, 음량, 미끄러질 주파수]
  const SFX = {
    click: [[660, 0, 0.05]],
    tick: [[440, 0, 0.03, 'square', 0.1]],
    coin: [[988, 0, 0.07], [1319, 0.07, 0.2]],
    perfect: [[523, 0, 0.09], [659, 0.09, 0.09], [784, 0.18, 0.09], [1047, 0.27, 0.35]],
    good: [[523, 0, 0.09], [784, 0.09, 0.22]],
    burnt: [[196, 0, 0.4, 'sawtooth', 0.15, 90]],
    sad: [[392, 0, 0.15, 'triangle'], [330, 0.15, 0.15, 'triangle'], [262, 0.3, 0.3, 'triangle']],
    bell: [[1568, 0, 0.5, 'sine', 0.15], [2093, 0.03, 0.6, 'sine', 0.1]], // 가게 문 종소리
  };

  // 배경음: 음표 배열(0 = 쉼표)을 8분음표 간격으로 되풀이한다
  const SONGS = {
    day: { bpm: 126, notes: [523, 659, 784, 659, 880, 784, 659, 523, 587, 698, 880, 698, 784, 659, 587, 0] }, // 통통 튀는 낮
    night: { bpm: 72, notes: [262, 0, 330, 0, 392, 0, 330, 0, 294, 0, 349, 0, 440, 0, 349, 0] }, // 차분한 밤
  };
  function startLoop() {
    clearInterval(timer);
    if (!ctx || !track) return;
    const s = SONGS[track];
    step = 0;
    timer = setInterval(() => {
      if (mute || ctx.state !== 'running') return;
      const f = s.notes[step++ % s.notes.length];
      if (f) tone(f, ctx.currentTime, 0.28, 'triangle', 0.09);
    }, 30000 / s.bpm);
  }

  B.sfx = {
    unlock() {
      try {
        if (ctx) {
          if (ctx.state === 'suspended') ctx.resume();
          return;
        }
        ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
        master = ctx.createGain();
        master.connect(ctx.destination);
        apply();
        startLoop();
      } catch (e) {
        ctx = null; // 소리를 못 쓰는 환경: 무음으로 진행
      }
    },
    play(name) {
      if (!ctx || mute) return;
      const now = ctx.currentTime;
      for (const [f, dt, d, type, v, to] of SFX[name]) tone(f, now + dt, d, type, v, to);
    },
    music(name) {
      if (name === track) return;
      track = name;
      startLoop();
    },
    toggleMute() {
      mute = !mute;
      apply();
      save();
    },
    volume(d) {
      vol = Math.min(1, Math.max(0, Math.round((vol + d) * 10) / 10));
      mute = false;
      apply();
      save();
    },
    status: () => (mute ? '소리 끔' : '소리 켬 · 음량 ' + Math.round(vol * 100) + '%'),
  };
})();
