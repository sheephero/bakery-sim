// 낮 화면(영업): 손님이 걸어와 진열장 앞에서 고민하고, 사거나 아쉬워하며 돌아간다. 플레이어는 구경한다.
// 규칙은 sim.openShop() 이 미리 계산해 둔 "손님별 기록(timeline)"을 그대로 재생하는 것뿐이다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  const { ui, strings: S } = B;
  const cfg = B.config;

  const SPEEDS = [1, 3, 8]; // F 키로 바꾸는 재생 속도
  const WALK_SPEED = 55; // 손님이 걷는 속도(px/초)
  const FEET_Y = 68; // 손님 그림의 y (발이 바닥선에 닿는 높이)

  const breadIndex = (id) => cfg.breads.findIndex((b) => b.id === id);

  B.DayScene = class DayScene extends Phaser.Scene {
    constructor() {
      super('Day');
    }

    create() {
      const s = (this.s = B.session);
      const game = s.game;
      this.speedIdx = 0;
      this.paused = false;
      this.done = 0;
      this.next = 0;
      this.ended = false;

      this.add.image(0, 0, 'bg_day').setOrigin(0, 0);
      this.view = ui.viewStock(game); // 영업 전 진열 상태 (openShop 이 재고를 갱신하기 전에 저장)
      this.case = new ui.Case(this);
      this.case.set(this.view);

      // 하루 영업을 미리 계산한다. 화면은 이 결과를 보여 주기만 한다.
      const report = B.sim.openShop(game);
      s.report = report;
      this.timeline = report.timeline;
      this.moneyShown = game.money - report.revenue; // 영업 전 잔고에서 시작해 팔릴 때마다 올라간다
      this.hud = new ui.Hud(this, this.moneyShown);

      // 왼쪽 위 안내(어두운 이름표 위에 흰 글자: 배경 그림과 겹쳐도 잘 읽힌다)
      ui.tag(this, 2, 2, 108, 28, 59);
      ui.text(this, 7, 5, S.open(S.weekday[report.day]), { size: 9, color: 'white', depth: 60 });
      this.speedText = ui.text(this, 7, 18, '', { size: 7, color: 'gd', depth: 60 });
      ui.tag(this, 2, 104, 176, 13, 59);
      ui.text(this, 6, 106, S.speedKeys, { size: 7, color: 'white', depth: 60 });
      this.standing = []; // 지금 진열장 앞에 서 있는(또는 오고 있는) 손님들의 x 좌표
      this.updateSpeedText();

      this.pauseObjs = [ui.dim(this, 0.6, 100), ui.text(this, 160, 76, S.paused, { size: 11, color: 'white', ox: 0.5, depth: 101 }), ui.text(this, 160, 96, S.pausedKeys, { size: 9, color: 'white', ox: 0.5, depth: 101 })];
      this.pauseObjs.forEach((o) => o.setVisible(false));

      ui.onKeys(this, ['F'], () => this.changeSpeed());
      ui.onKeys(this, ['P'], () => this.togglePause());
      ui.onKeys(this, ['ESC'], () => {
        if (this.paused && !this.s.overlay) this.toTitle();
      });
      ui.onKeys(this, ['ENTER'], () => this.skip());

      // 하루가 대략 25~30초 걸리도록 손님 사이 간격을 정한다
      this.interval = Phaser.Math.Clamp(26000 / Math.max(1, this.timeline.length), 220, 650);
      // Phaser 는 같은 화면 객체를 다시 쓰기 때문에 시간 배율이 저절로 초기화되지 않는다.
      // 그래서 시작할 때 1배로 되돌리고, 떠날 때도 원래대로 돌려 놓는다. (전날 빨리감기 속도가 남는 버그 방지)
      this.applySpeed();
      ui.fadeIn(this);
      B.sfx.music('day');
      B.sfx.play('bell'); // 가게 문 여는 종소리
      // 첫날은 튜토리얼이 뜨는 동안 영업 시간을 멈춰 둔다
      if (game.day === 0 && B.tutorial(this, 'day1')) {
        this.paused = true;
        this.applySpeed();
        this.events.once('overlayclosed', () => {
          this.paused = false;
          this.applySpeed();
        });
      }
      this.events.once('shutdown', () => {
        this.time.timeScale = 1;
        this.tweens.timeScale = 1;
        this.anims.globalTimeScale = 1;
      });
      this.time.delayedCall(600, () => this.spawnNext());
    }

    // ── 손님 ────────────────────────────────────────────────
    spawnNext() {
      if (this.next >= this.timeline.length) {
        this.checkEnd();
        return;
      }
      this.spawn(this.timeline[this.next++]);
      this.time.delayedCall(this.interval, () => this.spawnNext());
    }

    // 이 손님이 서서 고민할 자리(진열장 앞 x 좌표): 산 빵이 있는 구역, 못 샀으면 찾던 구역
    spotFor(entry) {
      let x;
      if (entry.bought.length) {
        const t = entry.bought[0];
        x = ui.Case.spotX(t.slot, breadIndex(t.bread));
      } else if (entry.zone === 'discount') x = ui.Case.spotX('old', 0);
      else if (entry.zone === 'premium') x = ui.Case.spotX('freshP', 0);
      else x = ui.Case.spotX('fresh', breadIndex(entry.want));
      // 이미 서 있는 손님과 가장 멀리 떨어진 자리를 고른다(한 곳에 뭉치지 않게)
      let best = x;
      let bestGap = -1;
      for (let i = 0; i < 8; i++) {
        const cand = Phaser.Math.Clamp(x + Phaser.Math.Between(-34, 34), 14, 306);
        const gap = this.standing.length ? Math.min(...this.standing.map((t) => Math.abs(t - cand))) : 99;
        if (gap > bestGap) {
          bestGap = gap;
          best = cand;
        }
      }
      this.standing.push(best);
      return best;
    }

    spawn(entry) {
      const spot = this.spotFor(entry);
      const fromLeft = spot < 160 ? Math.random() < 0.75 : Math.random() < 0.25; // 가까운 쪽에서 오는 경우가 많다
      const startX = fromLeft ? -14 : 334;
      const shadow = this.add.ellipse(12, 34, 18, 4, ui.num('fl2'));
      const n = Phaser.Math.Between(1, B.CUSTOMER_TYPES); // 손님 종류(머리색·셔츠색)를 무작위로
      const sprite = this.add.sprite(0, 0, 'customer' + n, 0).setOrigin(0, 0);
      const bubble = this.add.image(8, -26, 'bubbles', 0).setOrigin(0, 0).setVisible(false);
      const box = this.add.container(startX - 12, FEET_Y, [shadow, sprite, bubble]).setDepth(10);
      const c = { entry, box, sprite, bubble, spot, n };

      sprite.play('walk' + n).setFlipX(!fromLeft);
      this.tweens.add({
        targets: box,
        x: spot - 12,
        duration: Math.max(500, (Math.abs(spot - startX) / WALK_SPEED) * 1000),
        onComplete: () => this.think(c),
      });
    }

    think(c) {
      c.sprite.setFlipX(false).play('think' + c.n);
      c.bubble.setFrame(0).setVisible(true); // "..." 고민하는 말풍선
      this.time.delayedCall(Phaser.Math.Between(700, 1200), () => this.decide(c));
    }

    decide(c) {
      const e = c.entry;
      if (e.outcome === 'left') {
        this.sad(c, 800, () => this.leave(c));
      } else if (e.outcome === 'substituted') {
        // 원하는 빵이 없어서 잠깐 아쉬워하다가 다른 빵을 산다
        this.sad(c, 550, () => this.buy(c));
      } else {
        this.buy(c);
      }
    }

    sad(c, ms, next) {
      B.sfx.play('sad');
      c.bubble.setFrame(1); // 아쉬워하는 말풍선
      c.sprite.play('sad' + c.n);
      this.time.delayedCall(ms, next);
    }

    buy(c) {
      const e = c.entry;
      // 진열장 개수 줄이기
      for (const t of e.bought) {
        const key = t.slot === 'fresh' ? 'regular' : t.slot === 'freshP' ? 'premium' : 'discount';
        this.view[key][breadIndex(t.bread)] -= t.n;
      }
      this.case.set(this.view);
      B.sfx.play('coin');
      // 잔고 올리기 + 떠오르는 금액
      this.moneyShown += e.revenue;
      this.hud.setMoney(this.moneyShown);
      const pop = ui.text(this, c.box.x + 24, FEET_Y - 4, '+' + e.revenue.toLocaleString('en-US'), { size: 7, color: 'gd2', ox: 0.5, depth: 30 });
      // 움직이는 동안에도 정수 좌표만 쓰게 한다(반 픽셀이면 번진다)
      this.tweens.add({ targets: pop, y: pop.y - 16, alpha: 0, duration: 900, onUpdate: () => (pop.y = Math.round(pop.y)), onComplete: () => pop.destroy() });
      const coin = this.add.sprite(c.box.x + 18, FEET_Y + 4, 'coin').setDepth(30).play('coin');
      this.tweens.add({ targets: coin, y: coin.y - 22, alpha: 0, duration: 700, onUpdate: () => (coin.y = Math.round(coin.y)), onComplete: () => coin.destroy() });

      c.bubble.setFrame(2); // 하트 말풍선
      c.sprite.play('happy' + c.n);
      this.time.delayedCall(700, () => this.leave(c));
    }

    leave(c) {
      const at = this.standing.indexOf(c.spot);
      if (at >= 0) this.standing.splice(at, 1); // 자리를 비운다
      c.bubble.setVisible(false);
      const toLeft = Math.random() < 0.5;
      c.sprite.setFlipX(toLeft).play('walk' + c.n);
      this.tweens.add({
        targets: c.box,
        x: toLeft ? -30 : 340,
        duration: Math.max(600, (Math.abs(c.box.x - (toLeft ? -30 : 340)) / WALK_SPEED) * 1000),
        onComplete: () => {
          c.box.destroy();
          this.done++;
          this.checkEnd();
        },
      });
    }

    // 손님이 다 오고 다 돌아갔으면 저녁 정산으로
    checkEnd() {
      if (this.ended) return;
      if (this.next >= this.timeline.length && this.done >= this.timeline.length) {
        this.ended = true;
        this.time.delayedCall(900, () => this.scene.start('Evening'));
      }
    }

    // ── 조작 ────────────────────────────────────────────────
    updateSpeedText() {
      const v = SPEEDS[this.speedIdx];
      this.speedText.setText('손님 ' + this.timeline.length + '명 · 속도 x' + v);
    }
    applySpeed() {
      const v = this.paused ? 0 : SPEEDS[this.speedIdx];
      this.time.timeScale = v;
      this.tweens.timeScale = v;
      this.anims.globalTimeScale = v;
    }
    changeSpeed() {
      if (this.paused || this.s.overlay) return;
      this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
      this.applySpeed();
      this.updateSpeedText();
    }
    togglePause() {
      if (this.s.overlay) return;
      this.paused = !this.paused;
      this.pauseObjs.forEach((o) => o.setVisible(this.paused));
      this.applySpeed();
    }
    skip() {
      if (this.paused || this.ended || this.s.overlay) return;
      this.ended = true;
      this.scene.start('Evening'); // 잔고와 진열장은 정산 화면에서 최종 상태로 보인다
    }
    toTitle() {
      this.ended = true;
      this.scene.start('Title');
    }
  };
})();
