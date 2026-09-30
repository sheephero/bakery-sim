// 손님 기록(장부실의 데이터). 하루가 끝날 때마다 쌓이고, 판이 끝나도 남는다.
// 플레이어(와 봇)는 이 기록만 보고 "내일 손님이 몇 명쯤 올지" 예상한다.
// 주의: 정답 공식(config)은 보지 않고, 관찰한 기록에서 규칙을 스스로 찾아낸다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  if (typeof require === 'function') require('./config.js');

  const MAX_RECORDS = 200; // 저장 용량 제한 (최근 것만 유지)
  const MIN_FIT = 3; // 예상을 시작하는 최소 기록 수

  // JSON으로 저장·복원할 수 있는 단순 구조
  const createLog = () => ({ records: [] });

  // 하루 결과(openShop의 반환값)에서 플레이어가 실제로 볼 수 있는 것만 뽑아 기록한다
  function addRecord(log, report) {
    log.records.push({
      weekday: report.weekday,
      weather: report.weather,
      event: report.event || null,
      customers: report.arrivals,
      wantedUnits: { ...report.wantedUnits },
      soldUnits: { ...report.soldUnits },
      missedUnits: { ...report.missedUnits },
    });
    if (log.records.length > MAX_RECORDS) log.records.splice(0, log.records.length - MAX_RECORDS);
    return log;
  }

  // 조건(요일·날씨·사건)별 곱셈 모델을 기록에 맞춰 찾는다.
  //   손님 수 ≈ 전체평균 × 요일계수 × 날씨계수 × 사건계수
  // 교대로 평균을 맞추는 방법(alternating fit)을 쓴다. 기록이 적으면 계수를 1쪽으로 당긴다(과신 방지).
  function fit(log) {
    const rec = log.records;
    if (rec.length < MIN_FIT) return null;
    const keyOf = { weekday: (r) => String(r.weekday), weather: (r) => r.weather, event: (r) => r.event || 'none' };
    const factors = { weekday: {}, weather: {}, event: {} };
    for (const dim of Object.keys(keyOf)) for (const r of rec) factors[dim][keyOf[dim](r)] = 1;
    const mean = rec.reduce((s, r) => s + r.customers, 0) / rec.length;

    for (let iter = 0; iter < 12; iter++) {
      for (const dim of Object.keys(keyOf)) {
        const num = {};
        const den = {};
        const cnt = {};
        for (const r of rec) {
          let others = mean;
          for (const d2 of Object.keys(keyOf)) if (d2 !== dim) others *= factors[d2][keyOf[d2](r)];
          const k = keyOf[dim](r);
          num[k] = (num[k] || 0) + r.customers;
          den[k] = (den[k] || 0) + others;
          cnt[k] = (cnt[k] || 0) + 1;
        }
        for (const k of Object.keys(num)) {
          const raw = num[k] / den[k];
          factors[dim][k] = 1 + (raw - 1) * (cnt[k] / (cnt[k] + 2)); // 표본이 적으면 1쪽으로
        }
      }
    }
    return { mean, factors };
  }

  // 조건 cond = { weekday, weather, event } 일 때 예상 손님 수. 기록이 부족하면 null.
  function predictCustomers(log, cond) {
    const m = fit(log);
    if (!m) return null;
    const f = m.factors;
    const wd = f.weekday[String(cond.weekday)] ?? 1;
    const we = f.weather[cond.weather] ?? 1;
    const ev = f.event[cond.event || 'none'] ?? 1;
    return m.mean * wd * we * ev;
  }

  // 손님 한 명당 평균 몇 개를 사려고 하는지
  function unitsPerCustomer(log) {
    let units = 0;
    let cust = 0;
    for (const r of log.records) {
      cust += r.customers;
      for (const id of Object.keys(r.wantedUnits)) units += r.wantedUnits[id];
    }
    return cust > 0 ? units / cust : 1.3;
  }

  // 빵별 인기 비율(합 1). 사건 → 날씨 → 전체 순으로, 기록이 충분한 조건을 쓴다.
  function predictShares(log, cond) {
    const ids = B.config.breads.map((b) => b.id);
    const pools = [];
    if (cond.event) pools.push(log.records.filter((r) => r.event === cond.event));
    pools.push(log.records.filter((r) => r.weather === cond.weather && !r.event));
    pools.push(log.records);
    const pool = pools.find((p) => p.length >= 3) || log.records;
    const total = {};
    let sum = 0;
    for (const id of ids) total[id] = 0;
    for (const r of pool) for (const id of ids) {
      total[id] += r.wantedUnits[id] || 0;
      sum += r.wantedUnits[id] || 0;
    }
    const shares = {};
    for (const id of ids) shares[id] = sum > 0 ? total[id] / sum : 1 / ids.length;
    return shares;
  }

  // 빵별 내일 예상 개수. 기록이 부족하면 null.
  function predictUnits(log, cond) {
    const c = predictCustomers(log, cond);
    if (c === null) return null;
    const upc = unitsPerCustomer(log);
    const shares = predictShares(log, cond);
    const out = {};
    for (const id of Object.keys(shares)) out[id] = c * upc * shares[id];
    return out;
  }

  // 장부실 화면용 요약: 조건별 평균 손님 수와 기록 수
  function stats(log) {
    const groups = { byWeather: {}, byWeekday: {}, byEvent: {} };
    const add = (g, k, v) => {
      g[k] = g[k] || { n: 0, sum: 0 };
      g[k].n++;
      g[k].sum += v;
    };
    for (const r of log.records) {
      add(groups.byWeather, r.weather, r.customers);
      add(groups.byWeekday, String(r.weekday), r.customers);
      add(groups.byEvent, r.event || 'none', r.customers);
    }
    const finish = (g) => {
      for (const k of Object.keys(g)) g[k] = { n: g[k].n, avg: g[k].sum / g[k].n };
      return g;
    };
    return {
      days: log.records.length,
      byWeather: finish(groups.byWeather),
      byWeekday: finish(groups.byWeekday),
      byEvent: finish(groups.byEvent),
    };
  }

  B.log = { createLog, addRecord, fit, predictCustomers, predictShares, predictUnits, unitsPerCustomer, stats, MIN_FIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = B.log;
})();
