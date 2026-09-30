// 준비 화면: 그림 파일을 불러오고 애니메이션을 등록한 뒤 타이틀로 넘어간다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});

  const IMAGES = ['bg_day', 'bg_night', 'bread_loaf', 'bread_croissant', 'bread_cake', 'fx_sparkle', 'hud_money', 'oven', 'timing_bar', 'timing_cursor', 'tag_sale'];
  const SHEETS = { bubbles: [28, 18], coin: [10, 10], icon_weather: [14, 14], grade: [26, 26] };
  B.CUSTOMER_TYPES = 5; // customer1 ~ customer5 (머리색·셔츠색이 다른 손님)
  for (let n = 1; n <= B.CUSTOMER_TYPES; n++) SHEETS['customer' + n] = [24, 36];

  B.BootScene = class BootScene extends Phaser.Scene {
    constructor() {
      super('Boot');
    }
    preload() {
      this.failed = [];
      this.load.on('loaderror', (file) => this.failed.push(file.key)); // 파일 하나라도 못 읽으면 안내한다
      for (const k of IMAGES) this.load.image(k, 'assets/sprites/' + k + '.png');
      for (const [k, [w, h]] of Object.entries(SHEETS)) this.load.spritesheet(k, 'assets/sprites/' + k + '.png', { frameWidth: w, frameHeight: h });
    }
    create() {
      if (this.failed.length) {
        this.add.text(160, 90, '그림 파일을 불러오지 못했어요.\n웹 서버로 열었는지 확인해 주세요.\n(' + this.failed.join(', ') + ')', { fontFamily: 'Galmuri9', fontSize: '10px', color: '#fff7e8', align: 'center' }).setOrigin(0.5);
        return;
      }
      const a = this.anims;
      const gen = (key, s, e) => a.generateFrameNumbers(key, { start: s, end: e });
      // 손님 종류마다 같은 동작 이름 뒤에 번호를 붙여 등록한다: walk1, think3 ...
      for (let n = 1; n <= B.CUSTOMER_TYPES; n++) {
        const k = 'customer' + n;
        a.create({ key: 'walk' + n, frames: gen(k, 0, 3), frameRate: 8, repeat: -1 });
        a.create({ key: 'think' + n, frames: gen(k, 4, 5), frameRate: 3, repeat: -1 });
        a.create({ key: 'happy' + n, frames: gen(k, 6, 7), frameRate: 5, repeat: -1 });
        a.create({ key: 'sad' + n, frames: gen(k, 8, 8), frameRate: 1, repeat: -1 });
      }
      a.create({ key: 'coin', frames: gen('coin', 0, 3), frameRate: 12, repeat: -1 });
      document.getElementById('msg').style.display = 'none'; // "불러오는 중" 문구 숨김
      this.scene.launch('Overlay'); // 소리 안내 화면은 게임 내내 맨 위에 떠 있는다
      this.scene.start('Title');
    }
  };
})();
