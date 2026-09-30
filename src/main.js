// 게임 시작점: 글꼴이 준비된 뒤 Phaser 게임을 만들고, 창 크기에 맞춰 정수 배율로 확대한다.
(function () {
  const B = globalThis.Bakery;
  const W = 320;
  const H = 180;

  // 정수 배율(1배, 2배, 3배...)만 써서 픽셀이 번지거나 일그러지지 않게 한다
  function fit(game) {
    const zoom = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
    game.scale.setZoom(zoom);
  }

  function start() {
    const game = new Phaser.Game({
      // 파일을 직접 열면(file://) 브라우저가 WebGL 로 그림을 올리는 것을 막으므로 Canvas 로 그린다. 서버·배포 환경은 자동(WebGL)
      type: location.protocol === 'file:' ? Phaser.CANVAS : Phaser.AUTO,
      width: W,
      height: H,
      parent: 'game',
      backgroundColor: '#1c1d3b',
      pixelArt: true, // 확대할 때 번짐 방지(antialias 꺼짐 + 정수 좌표)
      roundPixels: true,
      banner: false,
      loader: { imageLoadType: 'HTMLImageElement' }, // 그림을 <img> 방식으로 읽는다(index.html 더블클릭 실행에서 XHR 이 막히는 것을 피함)
      scale: { mode: Phaser.Scale.NONE },
      // 순서가 곧 그리는 순서: 뒤에 있을수록 위에 그려진다(Overlay 가 맨 위)
      scene: [B.BootScene, B.TitleScene, B.NightScene, B.LedgerScene, B.DayScene, B.EveningScene, B.ResultScene, B.GameOverScene, B.TutorialScene, B.OverlayScene],
      callbacks: { postBoot: (g) => fit(g) },
    });
    window.addEventListener('resize', () => fit(game));
    B.game = game;
  }

  // 소리 조작(어느 화면에서나): 첫 키 입력으로 소리를 켜고, M 음소거, - / + 음량
  window.addEventListener('keydown', (e) => {
    B.sfx.unlock();
    const k = e.key;
    if (k !== 'm' && k !== 'M' && k !== '-' && k !== '=' && k !== '+') return;
    if (k === 'm' || k === 'M') B.sfx.toggleMute();
    else B.sfx.volume(k === '-' ? -0.1 : 0.1);
    B.game?.scene.getScene('Overlay')?.toast(B.sfx.status());
  });

  // 글꼴 3종을 먼저 불러온다. 2초 안에 안 되면 그냥 시작한다(기본 글꼴로 대체)
  const fonts = ['8px Galmuri7', '10px Galmuri9', '12px Galmuri11'].map((f) => document.fonts.load(f, '가나다0123'));
  Promise.race([Promise.all(fonts), new Promise((r) => setTimeout(r, 2000))]).then(start, start);
})();
