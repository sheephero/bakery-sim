// 봇(bot): 사람 대신 게임을 하는 프로그램. 화면 없이 수천 판을 돌려 균형을 확인하는 개발용 도구.
// 봇은 "밤에 어떤 빵을 몇 판 구울지"만 정한다. 굽기 타이밍 실력은 모든 봇이 같다고 가정한다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  if (typeof require === 'function') {
    require('../logic/config.js');
    require('../logic/rng.js');
    require('../logic/weather.js');
    require('../logic/sim.js');
    require('../logic/log.js');
    require('../logic/report.js');
  }

  const cfg = () => B.config;
  const batchesFor = (units, bread) => Math.max(0, Math.round(units / bread.batchSize));
  const oldUnits = (view, id) => view.oldStock[id]; // 내일 하루 더 팔 수 있는 어제 남은 빵

  // 무작정: 날씨도 기록도 안 보고 매일 빵마다 3판씩 굽는다
  const reckless = {
    name: '무작정',
    decide() {
      const plan = {};
      for (const b of cfg().breads) plan[b.id] = 3;
      return plan;
    },
  };

  // 감으로: 기록은 안 보고, 예보만 보고 사람이 직관으로 정하는 규칙.
  // 기본 3판. 비 오면 -1, 주말이면 +1, 좋은 사건이면 +1, 안 좋은 사건이면 -1. 남은 빵은 조금 감안.
  const hunch = {
    name: '감으로',
    decide(view) {
      const c = view.cond;
      let adj = 0;
      if (c.weather === 'rain') adj -= 1;
      if (c.weekday >= 5) adj += 1;
      const ev = B.weather.getEvent(c.event);
      if (ev) adj += ev.mult > 1 ? 1 : -1;
      const plan = {};
      for (const b of cfg().breads) plan[b.id] = Math.max(1, 3 + adj - Math.floor(oldUnits(view, b.id) / b.batchSize));
      return plan;
    },
  };

  // 기록·예보 참고: 장부실 기록에서 규칙을 배우고, 내일 예보를 넣어 예상한 만큼 굽는다
  function makeInformed(margin) {
    return {
      name: '기록·예보 참고',
      decide(view) {
        const units = B.log.predictUnits(view.log, view.cond);
        if (!units) return hunch.decide(view); // 기록이 부족하면 감으로
        const plan = {};
        for (const b of cfg().breads) plan[b.id] = batchesFor(units[b.id] * (1 + margin) - oldUnits(view, b.id) * 0.8, b);
        return plan;
      },
    };
  }

  // 기준(oracle): 게임 공식(config)을 아는 봇. "이보다 잘하기는 어렵다"는 상한선을 재는 용도.
  // 예보 날씨는 믿고 쓴다(실제 날씨는 모른다).
  function makeOracle(margin) {
    return {
      name: '기준(공식을 아는 봇)',
      decide(view) {
        const c = cfg();
        const w = B.weather.getWeather(view.cond.weather);
        const ev = B.weather.getEvent(view.cond.event);
        const expCust = c.customers.base * c.customers.dayMult[view.cond.weekday] * w.mult * (ev ? ev.mult : 1);
        const upc = 1 + c.customers.qty2Chance;
        const weight = {};
        let total = 0;
        for (const b of c.breads) {
          weight[b.id] = b.popularity * (w.pref[b.id] || 1) * (ev ? ev.pref[b.id] || 1 : 1);
          total += weight[b.id];
        }
        const plan = {};
        for (const b of c.breads) plan[b.id] = batchesFor(expCust * upc * (weight[b.id] / total) * (1 + margin) - oldUnits(view, b.id) * 0.8, b);
        return plan;
      },
    };
  }

  const DEFAULT_SKILL = { perfect: 0.3, good: 0.55 }; // 나머지 15%는 탄다

  // 봇이 한 판(7일)을 끝까지 플레이한다. log를 넘기면 기록이 누적된다(판 사이 학습).
  function playGame(bot, seed, opts = {}) {
    const skill = opts.skill || DEFAULT_SKILL;
    const log = opts.log || B.log.createLog();
    const game = B.sim.createGame(seed);
    const timingRng = B.rng.derive(seed, 999); // 굽기 타이밍 결과용 난수
    const botRng = B.rng.derive(seed, 777);
    let prev = null;

    while (!game.over) {
      const f = B.sim.getForecast(game);
      const oldStock = {};
      for (const b of cfg().breads) oldStock[b.id] = game.stock[b.id].old + game.stock[b.id].oldP;
      const plan = bot.decide({
        day: game.day,
        money: game.money,
        oldStock,
        cond: { weekday: f.weekday, weather: f.weather, event: f.event },
        prev,
        log,
        rng: botRng,
      });

      // 한 판씩 돌아가며 굽는다(돈이 모자라면 뒤쪽 빵이 못 구워진다)
      const remain = { ...plan };
      let progress = true;
      while (progress) {
        progress = false;
        for (const b of cfg().breads) {
          if (remain[b.id] > 0 && B.sim.canBake(game, b.id)) {
            const r = timingRng.next();
            const quality = r < skill.perfect ? 'perfect' : r < skill.perfect + skill.good ? 'good' : 'burnt';
            B.sim.bakeBatch(game, b.id, quality);
            remain[b.id]--;
            progress = true;
          }
        }
      }

      const report = B.sim.openShop(game);
      B.log.addRecord(log, report);
      prev = report;
      B.sim.nextNight(game);
    }
    return { game, report: B.report.buildReport(game), log };
  }

  B.bots = { reckless, hunch, makeInformed, makeOracle, playGame, DEFAULT_SKILL };
  if (typeof module !== 'undefined' && module.exports) module.exports = B.bots;
})();
