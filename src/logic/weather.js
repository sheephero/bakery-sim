// 한 주(7일)의 실제 날씨·사건과 "내일 예보"를 게임 시작 때 미리 정한다.
// 예보는 대체로 맞지만 가끔 틀리고, 어떤 사건은 예고 없이 찾아온다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  if (typeof require === 'function') {
    require('./config.js');
    require('./rng.js');
  }

  const getWeather = (id) => B.config.weather.find((w) => w.id === id);
  const getEvent = (id) => (id ? B.config.events.list.find((e) => e.id === id) : null);

  function generateWeek(seed) {
    const cfg = B.config;
    const rng = B.rng.derive(seed, 1); // 날씨 전용 난수 흐름
    const week = [];
    for (let d = 0; d < cfg.days; d++) {
      const weather = rng.weighted(cfg.weather, (w) => w.prob);
      const event = rng.chance(cfg.events.chance) ? rng.weighted(cfg.events.list, (e) => e.weight) : null;

      // 예보 날씨: forecastAccuracy 확률로 맞고, 아니면 다른 날씨를 말한다
      let forecastWeather = weather;
      if (!rng.chance(cfg.forecastAccuracy)) {
        const others = cfg.weather.filter((w) => w !== weather);
        forecastWeather = rng.weighted(others, (w) => w.prob);
      }
      // 사건 예고: 사건마다 미리 알려질 확률이 다르다 (소문은 갑자기 퍼진다)
      const forecastEvent = event && rng.chance(event.forecastChance) ? event : null;

      week.push({
        day: d,
        weather: weather.id,
        event: event ? event.id : null,
        forecast: { weather: forecastWeather.id, event: forecastEvent ? forecastEvent.id : null },
      });
    }
    return week;
  }

  B.weather = { generateWeek, getWeather, getEvent };
  if (typeof module !== 'undefined' && module.exports) module.exports = B.weather;
})();
