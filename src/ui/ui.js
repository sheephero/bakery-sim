// 여러 화면(Scene)이 함께 쓰는 UI 도구: 글자, 판, 진열장, 잔고 표시.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  const { CASE, HUD } = B.layout;
  const pal = B.pal;

  const hex = (name) => pal[name]; // '#rrggbb' 글자 색
  const num = (name) => parseInt(pal[name].slice(1), 16); // 0xrrggbb 그래픽 색

  // 갈무리 글꼴은 이름의 숫자와 "깨끗하게 그려지는 크기"가 다르다. (실측: 안티앨리어싱이 없는 크기)
  //   Galmuri7 → 8px, Galmuri9 → 10px, Galmuri11 → 12px.  다른 크기로 그리면 가장자리가 번진다.
  const FONT_PX = { 7: 8, 9: 10, 11: 12 };

  // 글자 만들기. size: 7 | 9 | 11 (글꼴 종류. 실제 크기는 위 표를 따른다)
  // 픽셀 글꼴은 좌표가 반 픽셀만 어긋나도 번진다. 그래서 (x, y)를 "기준점"으로 두고, 실제 위치는 항상 정수로 맞춘다.
  //   ox/oy: 0 = 왼쪽/위 기준, 0.5 = 가운데, 1 = 오른쪽/아래 기준.  글자를 바꾸거나 확대해도 자동으로 다시 맞춘다.
  //   위치를 옮기고 싶으면 setPosition 대신 t.at(x, y) 를 쓴다.
  function text(scene, x, y, str, opts = {}) {
    const size = opts.size || 9;
    const t = scene.add.text(0, 0, str, {
      fontFamily: 'Galmuri' + size,
      fontSize: FONT_PX[size] + 'px',
      color: hex(opts.color || 'ol'),
      align: opts.align || 'left',
      lineSpacing: opts.lineSpacing || 2,
      wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined, // 긴 문장은 이 폭에서 줄바꿈
    });
    const ox = opts.ox ?? 0;
    const oy = opts.oy ?? 0;
    let ax = x;
    let ay = y;
    const snap = () => t.setPosition(Math.round(ax - t.displayWidth * ox), Math.round(ay - t.displayHeight * oy));
    t.at = (nx, ny) => {
      ax = nx;
      ay = ny;
      snap();
      return t;
    };
    const setText = t.setText;
    t.setText = (s) => {
      setText.call(t, s);
      snap();
      return t;
    };
    const setScale = t.setScale;
    t.setScale = (...a) => {
      setScale.apply(t, a);
      snap();
      return t;
    };
    if (opts.depth !== undefined) t.setDepth(opts.depth);
    snap();
    return t;
  }

  // 나무 테두리 판 (도트 생성 도구의 panel()과 같은 모양). 반환: Graphics
  function panel(scene, x, y, w, h, depth) {
    const g = scene.add.graphics();
    g.fillStyle(num('ol')).fillRect(x, y, w, h);
    g.fillStyle(num('wd2')).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(num('wl1')).fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle(num('white')).fillRect(x + 3, y + 3, w - 6, 1);
    g.fillStyle(num('gd2'));
    for (const [px, py] of [[4, 4], [w - 5, 4], [4, h - 5], [w - 5, h - 5]]) g.fillRect(x + px, y + py, 1, 1);
    if (depth !== undefined) g.setDepth(depth);
    return g;
  }

  // 어두운 작은 이름표(잔고 표시와 같은 모양). 밝은 배경 위에서도 글자가 잘 읽히게 깐다
  function tag(scene, x, y, w, h, depth) {
    const g = scene.add.graphics();
    g.fillStyle(num('ol')).fillRect(x, y, w, h);
    g.fillStyle(num('nt1')).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(num('nt2')).fillRect(x + 1, y + 1, w - 2, 1);
    if (depth !== undefined) g.setDepth(depth);
    return g;
  }

  // 화면 전체를 어둡게(덮개). 일시정지·장부실 같은 겹치는 화면에서 쓴다
  function dim(scene, alpha, depth) {
    const g = scene.add.graphics();
    g.fillStyle(num('ol'), alpha).fillRect(0, 0, 320, 180);
    if (depth !== undefined) g.setDepth(depth);
    return g;
  }

  // 게임 진행 상태(진열장에 보이는 개수). 일반 칸 / 프리미엄존 / 할인존
  function viewStock(game) {
    const breads = B.config.breads;
    return {
      regular: breads.map((b) => game.stock[b.id].fresh),
      premium: breads.map((b) => game.stock[b.id].freshP),
      discount: breads.map((b) => game.stock[b.id].old + game.stock[b.id].oldP),
    };
  }

  // 진열장: 빵 그림과 개수판. set(view)로 개수가 바뀔 때마다 다시 그린다.
  class Case {
    constructor(scene) {
      this.scene = scene;
      this.gfx = scene.add.graphics();
      const breads = B.config.breads;
      this.regularIcons = breads.map((b) => [0, 1, 2].map(() => scene.add.image(0, 0, 'bread_' + b.id).setOrigin(0, 0).setVisible(false)));
      this.zoneIcons = { premium: [], discount: [] };
      this.sparkles = [];
      for (const key of ['premium', 'discount']) {
        this.zoneIcons[key] = breads.map((b) => scene.add.image(0, 0, 'bread_' + b.id).setOrigin(0, 0).setVisible(false));
      }
      this.sparkles = breads.map(() => scene.add.image(0, 0, 'fx_sparkle').setOrigin(0, 0).setVisible(false));
      // 개수 글자: 일반 3 + 프리미엄 3 + 할인 3
      this.counts = [];
      for (let i = 0; i < 9; i++) this.counts.push(text(scene, 0, 0, '0', { size: 7, ox: 0.5, oy: 0.5 }));
    }
    set(view) {
      const g = this.gfx;
      g.clear();
      const plate = (x, w) => {
        g.fillStyle(num('ol')).fillRect(x, CASE.plateY, w, 10);
        g.fillStyle(num('white')).fillRect(x + 1, CASE.plateY + 1, w - 2, 8);
      };
      let ci = 0;
      const put = (x, w, n) => {
        plate(x, w);
        const t = this.counts[ci++];
        t.setText(String(n)).setColor(hex(n === 0 ? 'rd' : 'ol')).at(x + w / 2, CASE.plateY + 5);
      };
      view.regular.forEach((n, i) => {
        const z = CASE.regular[i];
        const cx = z.x + z.w / 2;
        const icons = n > 0 ? Math.min(3, Math.ceil(n / 4)) : 0; // 개수가 많을수록 그림을 더 쌓는다(최대 3)
        this.regularIcons[i].forEach((im, k) => im.setVisible(k < icons).setPosition(cx - 24 + k * 16, CASE.iconY));
        put(cx - 11, 22, n);
      });
      for (const key of ['premium', 'discount']) {
        const zone = CASE[key];
        view[key].forEach((n, i) => {
          const x = zone.x + 2 + i * 19; // 세 종류를 한 줄로 섞어 놓는다
          this.zoneIcons[key][i].setVisible(n > 0).setPosition(x, CASE.iconY);
          if (key === 'premium') this.sparkles[i].setVisible(n > 0).setPosition(x + 11, CASE.iconY - 2);
          put(x, 17, n);
        });
      }
    }
    // 화면에서 손님이 빵을 집어 갈 때 쓰는 구역 가운데 x 좌표
    static spotX(slot, breadIndex) {
      if (slot === 'freshP') return CASE.premium.x + CASE.premium.w / 2;
      if (slot === 'old' || slot === 'oldP') return CASE.discount.x + CASE.discount.w / 2;
      const z = CASE.regular[breadIndex];
      return z.x + z.w / 2;
    }
    destroy() {
      this.gfx.destroy();
    }
  }

  // 오른쪽 위 잔고 표시. setMoney(값, 바로반영?) 하면 숫자가 올라가거나 내려가며 색이 잠깐 바뀐다.
  class Hud {
    constructor(scene, money) {
      this.scene = scene;
      this.value = money;
      scene.add.image(HUD.x, HUD.y, 'hud_money').setOrigin(0, 0).setDepth(50);
      this.label = text(scene, HUD.x + HUD.w - 5, HUD.y + 4, B.strings.won(money).replace('원', ''), { color: 'gd', ox: 1 }).setDepth(51);
    }
    setMoney(target, instant) {
      const prev = this.value;
      this.value = target;
      this.scene.tweens.killTweensOf(this);
      if (instant || prev === target) {
        this.shown = target;
        this.label.setText(target.toLocaleString('en-US')).setColor(hex('gd'));
        return;
      }
      this.label.setColor(hex(target > prev ? 'gr' : 'rd')); // 늘면 초록, 줄면 빨강
      this.shown = prev;
      this.scene.tweens.add({
        targets: this,
        shown: target,
        duration: 350,
        onUpdate: () => this.label.setText(Math.round(this.shown).toLocaleString('en-US')),
        onComplete: () => this.label.setText(target.toLocaleString('en-US')).setColor(hex('gd')),
      });
    }
  }

  // 반짝임 터뜨리기: 별 n개가 사방으로 퍼지며 사라진다 (완벽하게 구웠을 때 등)
  function burst(scene, x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = scene.add.image(x, y, 'fx_sparkle').setDepth(80);
      scene.tweens.add({
        targets: s,
        x: x + Math.round(Math.cos(a) * 28),
        y: y + Math.round(Math.sin(a) * 22),
        alpha: 0,
        duration: 550,
        onUpdate: () => s.setPosition(Math.round(s.x), Math.round(s.y)), // 정수 좌표만(번짐 방지)
        onComplete: () => s.destroy(),
      });
    }
  }

  // 화면이 어두운 밤색에서 부드럽게 밝아지며 시작
  const fadeIn = (scene) => scene.cameras.main.fadeIn(220, 28, 29, 59);

  // 키 하나에 동작 연결. names: ['ENTER', 'SPACE'] 처럼 Phaser 키 이름
  function onKeys(scene, names, fn) {
    for (const n of names) scene.input.keyboard.on('keydown-' + n, fn);
  }

  B.ui = { hex, num, text, panel, tag, dim, viewStock, Case, Hud, onKeys, burst, fadeIn };
})();
