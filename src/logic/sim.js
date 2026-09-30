// 하루 진행 규칙(시뮬레이션 엔진). 화면과 무관하게 순수 계산만 한다.
// 흐름: createGame → [밤: bakeBatch 반복 → 낮: openShop → 저녁: nextNight] × 7일
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  if (typeof require === 'function') {
    require('./config.js');
    require('./rng.js');
    require('./weather.js');
  }

  const cfg = () => B.config;
  const breadOf = (id) => cfg().breads.find((b) => b.id === id);
  const SLOTS = ['fresh', 'freshP', 'old', 'oldP']; // 새 빵 / 새 빵(프리미엄) / 하루 지난 빵 / 하루 지난 빵(프리미엄)

  // 빵 한 개의 판매가. 프리미엄은 +20%, 하루 지난 빵은 30% 할인
  function priceOf(bread, slot) {
    const c = cfg();
    const premium = slot === 'freshP' || slot === 'oldP';
    const old = slot === 'old' || slot === 'oldP';
    return Math.round(bread.price * (premium ? c.premiumRate : 1) * (old ? c.dayOldRate : 1));
  }

  const batchCost = (bread) => bread.batchSize * bread.unitCost;
  const minBatchCost = () => Math.min(...cfg().breads.map(batchCost));

  function emptyStock() {
    const stock = {};
    for (const b of cfg().breads) stock[b.id] = { fresh: 0, freshP: 0, old: 0, oldP: 0 };
    return stock;
  }
  const stockTotal = (game) =>
    cfg().breads.reduce((s, b) => s + SLOTS.reduce((t, k) => t + game.stock[b.id][k], 0), 0);

  function freshTonight() {
    return { cost: 0, perfect: 0, good: 0, burnt: 0, burntCost: 0 };
  }

  // 새 판 시작. 첫날은 밤에서 시작한다.
  function createGame(seed) {
    return {
      seed,
      day: 0, // 0 = 월요일
      phase: 'night', // night(굽기) → evening(정산) → night ...
      money: cfg().startMoney,
      startMoney: cfg().startMoney,
      week: B.weather.generateWeek(seed), // 실제 날씨·사건·예보를 미리 정해 둔다
      stock: emptyStock(),
      reports: [], // 하루하루의 결과(장부)
      tonight: freshTonight(),
      over: false,
      overReason: null, // 'finished'(7일 완료) | 'bankrupt'(파산)
    };
  }

  // 내일(=지금 밤 다음 날)의 예보. 플레이어가 밤에 보는 정보.
  function getForecast(game) {
    if (game.day >= cfg().days) return null;
    const f = game.week[game.day].forecast;
    return { day: game.day, weekday: game.day, weather: f.weather, event: f.event };
  }

  // 판 하나 굽기. 재료비는 굽는 순간 나간다. quality: 'perfect' | 'good' | 'burnt'
  function bakeBatch(game, breadId, quality) {
    if (game.over || game.phase !== 'night') return { ok: false, reason: 'phase' };
    if (!['perfect', 'good', 'burnt'].includes(quality)) return { ok: false, reason: 'quality' };
    const bread = breadOf(breadId);
    if (!bread) return { ok: false, reason: 'bread' };
    const cost = batchCost(bread);
    if (game.money < cost) return { ok: false, reason: 'money' }; // 재료비 부족
    game.money -= cost;
    game.tonight.cost += cost;
    game.tonight[quality]++;
    if (quality === 'perfect') game.stock[breadId].freshP += bread.batchSize;
    else if (quality === 'good') game.stock[breadId].fresh += bread.batchSize;
    else game.tonight.burntCost += cost; // 탄 판은 버린다 (재료비만 손해)
    return { ok: true, cost, quality };
  }

  const canBake = (game, breadId) =>
    !game.over && game.phase === 'night' && game.money >= batchCost(breadOf(breadId));

  // 진열장은 5구역: 일반 3칸(fresh) + 프리미엄존(freshP) + 할인존(old, oldP). 손님 성향에 따라 먼저 찾는 구역이 다르다.
  function zoneOf(r) {
    const b = cfg().behavior;
    if (r < b.bargainHunter) return 'discount';
    if (r < b.bargainHunter + b.premiumSeeker) return 'premium';
    return 'regular';
  }

  // 그날의 손님 목록을 미리 만든다. 씨앗이 고정이라 플레이어가 무엇을 굽든 같은 손님이 온다.
  function generateCustomers(game, day) {
    const c = cfg();
    const w = B.weather.getWeather(game.week[day].weather);
    const ev = B.weather.getEvent(game.week[day].event);
    const rng = B.rng.derive(game.seed, 100 + day);

    const expected = c.customers.base * c.customers.dayMult[day] * w.mult * (ev ? ev.mult : 1);
    const count = Math.max(0, Math.round(expected * (1 + rng.range(-c.customers.spread, c.customers.spread))));

    const weight = {};
    for (const b of c.breads) weight[b.id] = b.popularity * (w.pref[b.id] || 1) * (ev ? ev.pref[b.id] || 1 : 1);

    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        want: rng.weighted(c.breads, (b) => weight[b.id]).id,
        qty: rng.chance(c.customers.qty2Chance) ? 2 : 1,
        zone: zoneOf(rng.next()), // 어느 구역부터 찾는 손님인지
        rSwitch: rng.next(), // 원하던 종류가 없을 때 바꿀지
        rSub: rng.next(), // 원하는 빵이 없을 때 다른 빵을 살지
        rSubPick: rng.next(), // 어떤 다른 빵을 살지
      });
    }
    return list;
  }

  // 이 손님이 살 수 있는 진열 종류(순서대로). 먼저 찾는 구역 → (확률적으로) 다른 구역
  function slotOrder(cust) {
    let primary;
    let fallback;
    if (cust.zone === 'discount') {
      primary = ['oldP', 'old']; // 할인존(섞여 있음)
      fallback = ['fresh', 'freshP'];
    } else if (cust.zone === 'premium') {
      primary = ['freshP', 'fresh']; // 프리미엄존에 없으면 일반 칸의 같은 빵은 산다
      fallback = ['oldP', 'old'];
    } else {
      primary = ['fresh']; // 일반 칸
      fallback = ['old', 'oldP', 'freshP']; // 없으면 할인존 → 프리미엄존 순
    }
    return cust.rSwitch < cfg().behavior.switchChance ? primary.concat(fallback) : primary;
  }

  // 재고에서 최대 qty개를 꺼낸다. 꺼낸 내역을 돌려준다.
  function takeUnits(game, breadId, slots, qty) {
    const bread = breadOf(breadId);
    const taken = [];
    let left = qty;
    for (const slot of slots) {
      if (left <= 0) break;
      const n = Math.min(left, game.stock[breadId][slot]);
      if (n > 0) {
        game.stock[breadId][slot] -= n;
        left -= n;
        taken.push({ bread: breadId, slot, n, price: priceOf(bread, slot) });
      }
    }
    return taken;
  }

  const hasStock = (game, breadId, slots) => slots.some((s) => game.stock[breadId][s] > 0);

  // 손님 한 명 응대. 화면 연출용 기록(outcome 등)을 만든다.
  function serveCustomer(game, cust) {
    const slots = slotOrder(cust);
    const wantBread = breadOf(cust.want);
    let bought = takeUnits(game, cust.want, slots, cust.qty);
    let outcome = 'bought';
    const gotWanted = bought.reduce((s, t) => s + t.n, 0);

    if (gotWanted === 0) {
      // 원하는 빵이 없다 → 아쉬워하고, 다른 빵을 사거나 그냥 나간다
      outcome = 'left';
      if (cust.rSub < cfg().behavior.substitute) {
        const others = cfg().breads.filter((b) => b.id !== cust.want && hasStock(game, b.id, slots));
        if (others.length) {
          const total = others.reduce((s, b) => s + b.popularity, 0);
          let r = cust.rSubPick * total;
          let pick = others[others.length - 1];
          for (const b of others) {
            r -= b.popularity;
            if (r < 0) {
              pick = b;
              break;
            }
          }
          bought = takeUnits(game, pick.id, slots, 1);
          outcome = 'substituted';
        }
      }
    } else if (gotWanted < cust.qty) {
      outcome = 'partial'; // 일부만 사감
    }

    const revenue = bought.reduce((s, t) => s + t.n * t.price, 0);
    const shortfall = outcome === 'substituted' || outcome === 'left' ? cust.qty : cust.qty - gotWanted;
    const missedRevenue = Math.max(0, shortfall * wantBread.price - (outcome === 'substituted' ? revenue : 0));
    return { want: cust.want, qty: cust.qty, zone: cust.zone, outcome, bought, revenue, shortfall, missedRevenue };
  }

  // 낮: 가게를 열고 하루 영업. 결과(장부)를 돌려준다.
  function openShop(game) {
    if (game.over || game.phase !== 'night') return null;
    const c = cfg();
    const day = game.day;
    const info = game.week[day];
    const customers = generateCustomers(game, day);

    const r = {
      day,
      weekday: day,
      weather: info.weather,
      event: info.event,
      forecast: info.forecast,
      arrivals: customers.length,
      wantedUnits: {},
      soldUnits: {},
      revenueByBread: {},
      missedUnits: {},
      leftover: {},
      wasteUnits: {},
      revenue: 0,
      missedCustomers: 0,
      missedRevenue: 0,
      wasteCost: 0,
      bakeCost: game.tonight.cost,
      perfect: game.tonight.perfect,
      good: game.tonight.good,
      burnt: game.tonight.burnt,
      burntCost: 0,
      timeline: [], // 손님별 연출 기록
    };
    for (const b of c.breads) {
      r.wantedUnits[b.id] = 0;
      r.soldUnits[b.id] = 0;
      r.revenueByBread[b.id] = 0;
      r.missedUnits[b.id] = 0;
    }

    for (const cust of customers) {
      const res = serveCustomer(game, cust);
      r.timeline.push(res);
      r.wantedUnits[cust.want] += cust.qty;
      r.revenue += res.revenue;
      r.missedRevenue += res.missedRevenue;
      r.missedUnits[cust.want] += res.shortfall;
      if (res.outcome === 'left') r.missedCustomers++;
      for (const t of res.bought) {
        r.soldUnits[t.bread] += t.n;
        r.revenueByBread[t.bread] += t.n * t.price;
      }
    }

    // 하루 끝: 하루 지난 빵이 남으면 버리고, 새 빵이 남으면 내일 30% 할인 빵이 된다
    for (const b of c.breads) {
      const s = game.stock[b.id];
      const waste = s.old + s.oldP;
      r.wasteUnits[b.id] = waste;
      r.wasteCost += waste * b.unitCost;
      r.leftover[b.id] = s.fresh + s.freshP;
      game.stock[b.id] = { fresh: 0, freshP: 0, old: s.fresh, oldP: s.freshP };
    }
    r.burntCost = game.tonight.burntCost; // 탄 판에 들어간 재료비(손해)

    game.money += r.revenue;
    r.profit = r.revenue - r.bakeCost; // 오늘의 순이익 = 매출 − 재료비
    r.moneyEnd = game.money;
    game.reports.push(r);
    game.phase = 'evening';
    return r;
  }

  // 파산: 팔 빵이 하나도 없고, 가장 싼 한 판도 구울 돈이 없다
  const isBankrupt = (game) => stockTotal(game) === 0 && game.money < minBatchCost();

  // 저녁 정산이 끝나고 다음 밤으로. 7일이 끝났거나 파산이면 게임 종료.
  function nextNight(game) {
    if (game.over || game.phase !== 'evening') return game;
    game.day++;
    if (game.day >= cfg().days) {
      game.over = true;
      game.overReason = 'finished';
    } else if (isBankrupt(game)) {
      game.over = true;
      game.overReason = 'bankrupt';
    } else {
      game.phase = 'night';
      game.tonight = freshTonight();
    }
    return game;
  }

  const profitOf = (game) => game.money - game.startMoney;

  B.sim = {
    SLOTS,
    breadOf,
    priceOf,
    batchCost,
    minBatchCost,
    createGame,
    getForecast,
    bakeBatch,
    canBake,
    generateCustomers,
    openShop,
    serveCustomer,
    nextNight,
    isBankrupt,
    profitOf,
    stockTotal,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = B.sim;
})();
