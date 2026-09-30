// 도트 스프라이트 생성 스크립트. 실행: node tools/gen-sprites.js
// 결과: assets/sprites/*.png (게임에서 쓰는 조각), assets/preview/*.png (4배 확대 미리보기)
// 나중에 직접 그린 PNG로 바꾸려면 assets/sprites/의 같은 이름 파일만 덮어쓰면 된다.
const fs = require('fs');
const path = require('path');
const { Img, text, textWidth } = require('./pixel');
const { encode } = require('./png');
const { CASE, HUD, TIMING } = require('../src/layout.js'); // 좌표·구간은 게임 화면과 같은 원본을 쓴다

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'sprites');
const PREVIEW = path.join(ROOT, 'assets', 'preview');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PREVIEW, { recursive: true });
const save = (dir, name, img) => fs.writeFileSync(path.join(dir, name + '.png'), encode(img.w, img.h, img.d));

// ───────────────── 빵 3종 (16x16, 좌상단에서 빛이 온다) ─────────────────

// 식빵: 봉우리가 둘인 식빵 단면. 껍질(테두리) 안에 하얀 속살
function loaf() {
  const im = new Img(16, 16);
  const mask = (x, y) => {
    const bump = (cx) => Math.hypot(x + 0.5 - cx, y + 0.5 - 6) <= 3.7;
    if (y < 6 && (bump(5.6) || bump(10.4))) return true; // 위쪽 두 봉우리
    return y >= 5 && y <= 13 && x >= 2 && x <= 13; // 몸통
  };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!mask(x, y)) continue;
      const edge = !mask(x - 1, y) || !mask(x + 1, y) || !mask(x, y - 1) || !mask(x, y + 1);
      if (edge) {
        // 껍질: 아래쪽은 가장 어둡고, 오른쪽은 중간, 위·왼쪽은 밝게(빛 방향)
        if (!mask(x, y + 1)) im.set(x, y, 'cu3');
        else if (!mask(x + 1, y)) im.set(x, y, 'cu2');
        else im.set(x, y, 'cu1');
      } else {
        im.set(x, y, (x * 5 + y * 3) % 7 === 0 ? 'cr2' : 'cr1'); // 속살 + 기공 점
      }
    }
  }
  im.set(4, 3, 'cr2').set(5, 3, 'cr2'); // 왼쪽 위 하이라이트
  return im.outline();
}

// 크루아상: 마디 5개가 이어진 초승달. 가운데 마디가 가장 크다
function croissant() {
  const im = new Img(16, 16);
  const segs = [
    [3.2, 11.0, 2.5],
    [12.8, 11.0, 2.5],
    [4.6, 7.4, 3.2],
    [11.4, 7.4, 3.2],
    [8, 5.8, 4.0],
  ];
  for (const [cx, cy, r] of segs) {
    im.ellipse(cx, cy, r, r, (x, y, dx, dy) => {
      const d = Math.hypot(dx, dy);
      const t = (dx + dy) / 1.4; // 빛 방향(좌상단)과의 거리
      if (d > 0.72 && (dx > 0.15 || dy > 0.3)) return 'cu3'; // 아래·오른쪽 테두리를 어둡게 → 마디 구분선
      if (t < -0.5) return 'cr2';
      if (t < 0.1) return 'cu1';
      return 'cu2';
    });
  }
  return im.outline();
}

// 케이크: 딸기 생크림 케이크. 스펀지·크림 층·분홍 프로스팅·딸기
function cake() {
  const im = new Img(16, 16);
  im.rect(2, 9, 12, 6, 'cr2'); // 스펀지
  im.rect(2, 9, 12, 1, 'cr1');
  im.rect(2, 12, 12, 1, 'white'); // 크림 층
  im.rect(2, 14, 12, 1, 'cu1'); // 바닥 가장자리
  im.rect(13, 9, 1, 6, 'cu1'); // 오른쪽 그림자
  im.rect(2, 6, 12, 3, 'pk1'); // 프로스팅
  im.rect(2, 8, 12, 1, 'pk2');
  im.rect(3, 6, 4, 1, 'white'); // 프로스팅 하이라이트
  for (const x of [4, 8, 11]) im.set(x, 9, 'pk1').set(x, 10, 'pk1'); // 흘러내린 크림
  im.ellipse(8, 4.2, 2.6, 2.3, (x, y, dx, dy) => (dx + dy > 0.5 ? 'pk3' : 'rd')); // 딸기
  im.set(7, 3, 'white'); // 딸기 광택
  im.set(8, 1, 'gr').set(7, 2, 'gr').set(9, 2, 'gr2'); // 딸기 잎
  return im.outline();
}

// 프리미엄 반짝임(별) 7x7
function sparkle() {
  const im = new Img(7, 7);
  for (let i = 1; i <= 5; i++) im.set(3, i, 'gd').set(i, 3, 'gd');
  im.set(3, 0, 'gd2').set(3, 6, 'gd2').set(0, 3, 'gd2').set(6, 3, 'gd2');
  im.set(3, 3, 'white').set(2, 2, 'gd').set(4, 4, 'gd');
  return im;
}

// 할인 태그 "30%" 15x9
function saleTag() {
  const im = new Img(15, 9);
  im.rect(1, 1, 13, 7, 'rd');
  im.rect(1, 7, 13, 1, 'pk3');
  text(im, '30%', 2, 2, 'white');
  return im.outline();
}

// ───────────────── 손님 (24x36, 정면) ─────────────────
// 손님 5종: 머리색과 셔츠색만 다르다 (팔레트 32색 안에서 조합)
const STYLES = [
  { hair: 'wd3', shirt: ['sh1', 'sh2'] },
  { hair: 'ol', shirt: ['rd', 'pk3'] },
  { hair: 'cu3', shirt: ['gd', 'gd2'] },
  { hair: 'nt1', shirt: ['pk2', 'pk3'] },
  { hair: 'wd2', shirt: ['gr', 'gr2'] },
];
// pose: walk(4프레임) | think(2) | happy(2) | sad(1)
function customer(pose, f, st = STYLES[0]) {
  const im = new Img(24, 36);
  const walk = pose === 'walk';
  let y0 = 0; // 몸 전체의 위아래 움직임
  if (walk) y0 = [0, -1, 0, -1][f];
  if (pose === 'happy') y0 = f ? -3 : 0;
  if (pose === 'sad') y0 = 1;
  const ground = 33 + (pose === 'happy' ? y0 : 0); // 발바닥 위치
  const lift = walk ? [[2, 0], [0, 0], [0, 2], [0, 0]][f] : [0, 0]; // 걸을 때 발을 드는 높이 [왼, 오른]

  // 다리와 신발
  [[8, 0], [13, 1]].forEach(([x, side]) => {
    const foot = ground - lift[side];
    const top = 27 + y0;
    if (foot - 2 >= top) im.rect(x, top, 3, foot - 2 - top + 1, 'nt3');
    im.rect(x, foot - 1, 3, 2, 'wd3');
  });
  // 몸통(셔츠)
  im.rect(8, 19 + y0, 8, 8, st.shirt[0]);
  im.rect(15, 19 + y0, 1, 8, st.shirt[1]);
  im.rect(8, 26 + y0, 8, 1, st.shirt[1]);
  // 팔: 걸을 때는 다리와 엇갈리게 흔든다
  const swing = walk ? [1, 0, -1, 0][f] : 0;
  const arm = (x, dy, raised) => {
    if (raised === 'up') {
      im.rect(x, 10 + y0, 3, 9, st.shirt[0]);
      im.rect(x, 8 + y0, 3, 2, 'sn1');
    } else {
      im.rect(x, 20 + y0 + dy, 3, 6, st.shirt[0]);
      im.rect(x, 26 + y0 + dy, 3, 2, 'sn1');
    }
  };
  if (pose === 'happy') {
    arm(5, 0, 'up');
    arm(16, 0, 'up');
  } else if (pose === 'think') {
    arm(5, 0, null);
    // 오른손을 턱에 대고 고민하는 자세
    im.rect(16, 20 + y0, 3, 3, st.shirt[0]);
    im.rect(13, 21 + y0, 6, 3, st.shirt[0]);
    im.rect(12, 17 + y0, 3, 4, 'sn1');
  } else {
    arm(5, swing, null);
    arm(16, -swing, null);
  }
  // 머리
  im.rect(5, 5 + y0, 14, 11, 'sn1');
  im.rect(6, 4 + y0, 12, 1, 'sn1');
  im.rect(6, 16 + y0, 12, 1, 'sn1');
  // 머리카락(어두운 갈색): 윗부분과 양옆
  im.rect(6, 3 + y0, 12, 1, st.hair);
  im.rect(5, 4 + y0, 14, 5, st.hair);
  im.rect(5, 9 + y0, 2, 5, st.hair);
  im.rect(17, 9 + y0, 2, 5, st.hair);
  im.rect(7, 9 + y0, 4, 1, st.hair); // 앞머리 왼쪽
  im.rect(14, 9 + y0, 3, 1, st.hair); // 앞머리 오른쪽
  im.rect(7, 10 + y0, 10, 1, 'cu1'); // 앞머리 그림자
  // 표정
  const ey = 11 + y0;
  if (pose === 'happy') {
    for (const x of [8, 15]) im.set(x - 1, ey + 1, 'ol').set(x, ey, 'ol').set(x + 1, ey + 1, 'ol'); // ^ ^ 웃는 눈
    im.rect(10, 14 + y0, 4, 2, 'ol').set(11, 15 + y0, 'pk2'); // 벌린 입
  } else if (pose === 'sad') {
    im.rect(8, ey, 1, 2, 'ol').rect(15, ey, 1, 2, 'ol');
    im.set(7, ey - 1, 'ol').set(16, ey - 1, 'ol'); // 처진 눈썹
    im.set(10, 15 + y0, 'ol').set(11, 14 + y0, 'ol').set(12, 14 + y0, 'ol').set(13, 15 + y0, 'ol'); // ∩ 입
    im.set(8, ey + 2, 'gl2').set(8, ey + 3, 'gl2'); // 눈물
  } else {
    im.rect(8, ey, 1, 2, 'ol').rect(15, ey, 1, 2, 'ol');
    im.rect(11, 14 + y0, 2, 1, 'ol');
  }
  im.set(7, 13 + y0, 'pk1').set(16, 13 + y0, 'pk1'); // 볼터치
  return im.outline();
}

const customerFrames = (st) => [
  ...[0, 1, 2, 3].map((f) => customer('walk', f, st)),
  ...[0, 1].map((f) => customer('think', f, st)),
  ...[0, 1].map((f) => customer('happy', f, st)),
  customer('sad', 0, st),
];
const CUSTOMER_FRAMES = customerFrames(STYLES[0]); // 미리보기용(첫 번째 손님)

// ───────────────── 말풍선 (28x18) ─────────────────
function bubble(kind) {
  const im = new Img(28, 18);
  im.rect(1, 1, 26, 13, 'white');
  for (const [x, y] of [[1, 1], [26, 1], [1, 13], [26, 13]]) im.set(x, y, 'clear'); // 모서리 둥글게
  im.rect(6, 14, 4, 1, 'white').rect(6, 15, 2, 1, 'white'); // 꼬리(왼쪽 아래)
  if (kind === 'think') {
    for (const x of [8, 13, 18]) im.rect(x, 7, 2, 2, 'nt3'); // ... 고민 중
  } else if (kind === 'sad') {
    im.rect(9, 4, 1, 3, 'nt3').rect(17, 4, 1, 3, 'nt3'); // 눈
    im.set(9, 7, 'gl2').set(9, 8, 'gl2'); // 눈물
    im.set(10, 11, 'nt3').set(11, 10, 'nt3').set(12, 10, 'nt3').set(13, 10, 'nt3').set(14, 10, 'nt3').set(15, 11, 'nt3'); // 아쉬운 입
  } else if (kind === 'heart') {
    const rows = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
    rows.forEach((r, j) => [...r].forEach((v, i) => v === '1' && im.set(10 + i, 4 + j, 'rd')));
    im.set(11, 5, 'white');
  }
  return im.outline();
}

// 동전 4프레임(회전). 폭이 8→6→3→6으로 변한다
function coin(f) {
  const im = new Img(10, 10);
  const w = [8, 6, 3, 6][f];
  im.ellipse(5, 5, w / 2, 4, (x, y, dx, dy) => (dx + dy > 0.4 ? 'gd2' : 'gd'));
  if (w > 4) im.set(4 - (f === 1 || f === 3 ? 0 : 1), 3, 'white');
  return im.outline();
}

// 날씨 아이콘 12x12: 맑음 / 흐림 / 비
function weatherIcon(kind) {
  const im = new Img(14, 14);
  const cloud = (ox, oy) => {
    im.ellipse(5 + ox, 7 + oy, 3, 2.6, 'white').ellipse(9 + ox, 6.5 + oy, 3.4, 3.4, 'white').rect(3 + ox, 8 + oy, 8, 2, 'white');
    im.rect(3 + ox, 9 + oy, 8, 1, 'gl2'); // 구름 아래 그림자
    return im;
  };
  if (kind === 'sunny') {
    im.ellipse(7, 7, 3.6, 3.6, (x, y, dx, dy) => (dx + dy > 0.5 ? 'gd2' : 'gd'));
    for (const [x, y] of [[7, 1], [7, 12], [1, 7], [12, 7], [3, 3], [11, 3], [3, 11], [11, 11]]) im.set(x, y, 'gd');
    return im;
  }
  if (kind === 'cloudy') {
    cloud(0, 1);
    return im.outline();
  }
  cloud(0, -1);
  im.outline();
  for (const [x, y] of [[4, 11], [7, 12], [10, 11]]) im.set(x, y, 'sk1').set(x, y + 1, 'sk1');
  return im;
}

// ───────────────── 밤 굽기 도구 ─────────────────
function oven() {
  const im = new Img(64, 52);
  im.rect(24, 0, 16, 10, 'wd3').rect(24, 0, 16, 2, 'wd2'); // 굴뚝
  im.rect(4, 10, 56, 40, 'cu2'); // 벽돌 몸체
  for (let y = 10; y < 50; y += 6) {
    im.rect(4, y, 56, 1, 'cu3'); // 가로 줄눈
    for (let x = 4 + ((y / 6) % 2) * 6; x < 60; x += 12) im.rect(x, y, 1, 6, 'cu3'); // 세로 줄눈(엇갈리게)
  }
  im.rect(4, 10, 56, 1, 'cu1'); // 윗면 하이라이트
  im.ellipse(32, 28, 16, 9, 'ol').rect(16, 28, 32, 18, 'ol'); // 아치형 입구
  im.rect(18, 40, 28, 5, 'gd2'); // 불빛
  for (const [x, h] of [[22, 4], [27, 6], [32, 5], [37, 6], [41, 3]]) im.rect(x, 40 - h, 3, h, 'gd').rect(x + 1, 40 - h + 1, 1, h - 1, 'white');
  im.rect(18, 37, 28, 2, 'wd1'); // 굽는 판
  for (const x of [23, 32, 41]) im.ellipse(x, 35, 4, 2.4, (px, py, dx, dy) => (dy > 0.2 ? 'cu2' : 'cu1'));
  im.rect(2, 48, 60, 4, 'wd2').rect(2, 48, 60, 1, 'wd1'); // 받침
  return im.outline();
}

// 타이밍 바: 빨강(탐) | 노랑(좋음) | 초록(완벽) | 노랑 | 빨강. 132px
function timingBar() {
  const im = new Img(136, 16);
  im.rect(0, 0, 136, 16, 'ol');
  // 구간 폭·색은 src/layout.js 의 TIMING 에서 가져온다(게임이 판정할 때 쓰는 값과 같다)
  let x = 0;
  const zones = TIMING.zones.map((z) => {
    const r = [x, z.w, z.color, z.quality];
    x += z.w;
    return r;
  });
  for (const [zx, w, c] of zones) im.rect(2 + zx, 2, w, 12, c);
  for (const [zx, w] of zones) im.rect(2 + zx, 2, w, 1, 'white'); // 윗줄 광택
  for (const [zx, w, , q] of zones) if (q === 'perfect') im.rect(2 + zx, 2, 1, 12, 'gr2').rect(2 + zx + w - 1, 2, 1, 12, 'gr2'); // 완벽 구간 경계
  for (const [x, y] of [[0, 0], [135, 0], [0, 15], [135, 15]]) im.set(x, y, 'clear'); // 모서리 둥글게
  return im;
}
function cursorSprite() {
  const im = new Img(7, 20);
  im.rect(2, 1, 3, 18, 'white');
  return im.outline();
}
// 창 틀(패널)
function panel(w, h) {
  const im = new Img(w, h);
  im.rect(0, 0, w, h, 'ol');
  im.rect(1, 1, w - 2, h - 2, 'wd2');
  im.rect(3, 3, w - 6, h - 6, 'wl1');
  im.rect(3, 3, w - 6, 1, 'white');
  im.rect(3, h - 4, w - 6, 1, 'wl2');
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) im.set(x, y, 'clear');
  for (const [x, y] of [[4, 4], [w - 5, 4], [4, h - 5], [w - 5, h - 5]]) im.set(x, y, 'gd2'); // 모서리 못
  return im;
}

// ───────────────── 가게 배경 (320x180, 계산대 시점) ─────────────────
const THEMES = {
  day: { wall: 'wl1', wains: 'wl2', trim: 'wd1', stripe: 'wl2', sky: 'sk1', floor: 'fl1', seam: 'fl2' },
  night: { wall: 'nt2', wains: 'nt1', trim: 'wd3', stripe: 'nt1', sky: 'nt1', floor: 'nt1', seam: 'nt2' },
};
const cfg = require('../src/logic/config.js'); // 가격 등은 게임 설정에서 그대로 가져온다


function shop(theme) {
  const T = THEMES[theme];
  const night = theme === 'night';
  const im = new Img(320, 180);
  // 벽
  im.rect(0, 0, 320, 98, T.wall);
  for (let x = 8; x < 320; x += 16) im.rect(x, 0, 1, 68, T.stripe); // 줄무늬 벽지
  im.rect(0, 68, 320, 3, T.trim);
  im.rect(0, 71, 320, 27, T.wains);
  for (let x = 0; x < 320; x += 40) im.rect(x, 74, 1, 21, T.trim); // 아래 벽 널판
  // 밤 조명: 램프와 은은한 빛(체크 무늬 점묘 = dither)
  if (night) {
    for (const cx of [120, 220]) {
      for (let y = 0; y < 44; y++) for (let x = cx - 34; x <= cx + 34; x++) {
        const dx = (x - cx) / 34;
        const dy = (y - 10) / 34;
        if (dx * dx + dy * dy <= 1 && (x + y) % 2 === 0) im.set(x, y, 'nt3');
      }
      im.rect(cx, 0, 1, 8, 'ol').rect(cx - 5, 8, 11, 4, 'gd2').rect(cx - 6, 12, 13, 1, 'gd2').rect(cx - 2, 13, 5, 2, 'gd');
    }
  }
  // 창문
  im.rect(18, 62, 92, 5, 'wd1').rect(18, 66, 92, 1, 'wd3'); // 창턱
  im.rect(22, 12, 84, 52, 'wd2');
  im.rect(26, 16, 76, 44, T.sky);
  if (!night) {
    im.ellipse(88, 28, 6, 6, (x, y, dx, dy) => (dx + dy > 0.5 ? 'gd2' : 'gd')); // 해
    im.ellipse(48, 30, 9, 4, 'white').ellipse(56, 27, 6, 4, 'white'); // 구름
    im.rect(40, 32, 22, 2, 'white');
  } else {
    im.ellipse(86, 28, 6, 6, 'gd').ellipse(89, 26, 5, 5, T.sky); // 초승달
    for (const [x, y] of [[36, 24], [50, 42], [70, 22], [96, 46], [42, 50], [78, 40]]) im.set(x, y, 'white');
  }
  im.rect(62, 16, 4, 44, 'wd2').rect(26, 36, 76, 3, 'wd2'); // 창살
  im.rect(22, 12, 84, 1, 'wd1');
  // 걸린 간판(빵 그림)
  im.rect(146, 0, 1, 10, 'ol').rect(174, 0, 1, 10, 'ol');
  im.rect(138, 10, 44, 26, 'wd3').rect(140, 12, 40, 22, 'wd2').rect(140, 12, 40, 2, 'wd1');
  im.blit(croissant(), 152, 15);
  // 벽 선반과 시계
  im.rect(206, 52, 100, 4, 'wd1').rect(206, 56, 100, 2, 'wd3');
  im.blit(loaf(), 216, 36).blit(croissant(), 244, 36).blit(cake(), 272, 36);
  // 시계는 왼쪽으로 옮겼다(오른쪽 위는 잔고 표시 자리)
  const CX = 200;
  const CY = 26;
  im.ellipse(CX, CY, 9, 9, 'white').ellipse(CX, CY, 7.4, 7.4, 'wl1');
  im.rect(CX, CY - 6, 1, 7, 'ol').rect(CX, CY, 5, 1, 'ol'); // 시계 바늘
  for (let a = 0; a < 360; a += 30) im.set(CX + Math.round(8 * Math.sin((a * Math.PI) / 180)), CY - Math.round(8 * Math.cos((a * Math.PI) / 180)), 'ol'); // 눈금
  // 바닥
  im.rect(0, 98, 320, 26, T.floor);
  for (let r = 0; r < 3; r++) {
    const y = 98 + r * 9;
    im.rect(0, y, 320, 1, T.seam);
    for (let x = (r % 2) * 16; x < 320; x += 32) im.rect(x, y, 1, 9, T.seam);
  }
  im.rect(0, 98, 320, 2, night ? 'nt2' : 'fl2'); // 벽 아래 그림자
  // 계산대 윗면 (양옆은 옆면으로 채워서 화면 전체가 빈틈없이 불투명하게)
  im.rect(0, 118, 320, 4, 'wd1').rect(0, 118, 320, 1, 'cu1').rect(0, 122, 320, 2, 'wd3');
  im.rect(0, 124, 320, 56, 'wd3');
  im.rect(10, 124, 300, 1, 'wd1');
  // 진열장 유리 안쪽: 구역마다 뒷배경 색이 다르다(프리미엄=금빛, 할인=분홍)
  im.rect(14, 126, 292, 42, 'wl1');
  im.rect(CASE.premium.x, 126, CASE.premium.w, 42, 'cr2');
  im.rect(CASE.discount.x, 126, CASE.discount.w, 42, 'pk1');
  for (const k of [44, 124, 204, 300]) for (let i = 0; i < 40; i++) im.set(k - i, 126 + i, 'white').set(k - i + 1, 126 + i, 'white'); // 유리 반사
  im.rect(14, 126, 292, 1, 'wl2');
  for (const z of CASE.regular.slice(1)) im.rect(z.x, 127, 1, 40, 'wl2'); // 일반 칸 구분선
  im.rect(14, 154, 292, 2, 'wd2').rect(14, 156, 292, 1, 'wd3'); // 진열 선반
  im.rect(14, 168, 292, 2, 'wd3');
  for (const x of [CASE.premium.x - 4, CASE.discount.x - 4]) im.rect(x, 126, 4, 42, 'wd3').rect(x, 126, 1, 42, 'wd2'); // 구역 기둥
  // 구역 이름표: 일반 칸은 정가, 프리미엄은 +20%, 할인은 -30%
  const board = (x, w, bg, fg, str) => {
    im.rect(x, 127, w, 9, 'ol').rect(x + 1, 128, w - 2, 7, bg);
    text(im, str, x + Math.floor((w - textWidth(str)) / 2), 129, fg);
  };
  CASE.regular.forEach((z, i) => board(z.x + z.w / 2 - 12, 24, 'wd1', 'white', String(cfg.breads[i].price)));
  board(CASE.premium.x + 14, 30, 'gd', 'ol', '+20%');
  board(CASE.discount.x + 14, 30, 'rd', 'white', '-30%');
  // 아래 받침
  im.rect(10, 170, 300, 10, 'wd2').rect(10, 170, 300, 2, 'wd3');
  for (let i = 0; i < 3; i++) im.rect(10 + i * 100, 172, 2, 8, 'wd3').rect(14 + i * 100, 174, 92, 1, 'wd1');
  return im;
}

// 개수판(작은 흰 판). 0이면 빨간 숫자 = 품절
function plate(w, count) {
  const p = new Img(w, 10);
  p.rect(0, 0, w, 10, 'ol').rect(1, 1, w - 2, 8, 'white');
  const s = String(count);
  text(p, s, Math.floor((w - textWidth(s)) / 2), 2, count === 0 ? 'rd' : 'ol');
  return p;
}

// 등급 메달 26x26: S/A/B/C/D. 글자는 5x7 도트를 2배로 키워서 찍는다(글꼴을 억지로 키우면 번지므로 직접 그린다)
const GRADE_GLYPH = {
  S: ['.1111', '1....', '1....', '.111.', '....1', '....1', '1111.'],
  A: ['.111.', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
  B: ['1111.', '1...1', '1...1', '1111.', '1...1', '1...1', '1111.'],
  C: ['.1111', '1....', '1....', '1....', '1....', '1....', '.1111'],
  D: ['1111.', '1...1', '1...1', '1...1', '1...1', '1...1', '1111.'],
};
const GRADE_COLOR = { S: ['gd', 'gd2'], A: ['gr', 'gr2'], B: ['sh1', 'sh2'], C: ['wd1', 'wd2'], D: ['pk2', 'pk3'] };
function gradeBadge(letter) {
  const im = new Img(26, 26);
  const [main, shade] = GRADE_COLOR[letter];
  im.ellipse(13, 13, 12, 12, (x, y, dx, dy) => (dx + dy > 0.55 ? shade : main)); // 메달 (오른쪽 아래가 어둡다)
  GRADE_GLYPH[letter].forEach((row, j) => [...row].forEach((v, i) => v === '1' && im.rect(8 + i * 2, 6 + j * 2, 2, 2, 'ol')));
  return im.outline();
}

// 진열장 채우기(미리보기용). 게임에서는 같은 좌표로 Phaser가 실시간으로 그린다.
//   stock.regular  = [식빵, 크루아상, 케이크] 개수 (일반 칸: 칸마다 한 종류)
//   stock.premium  = [식빵, 크루아상, 케이크] 개수 (프리미엄존: 세 종류가 섞여 있음)
//   stock.discount = [식빵, 크루아상, 케이크] 개수 (할인존: 세 종류가 섞여 있음)
function fillCase(im, stock, breads) {
  stock.regular.forEach((n, i) => {
    const z = CASE.regular[i];
    const cx = z.x + z.w / 2;
    const icons = n > 0 ? Math.min(3, Math.ceil(n / 4)) : 0; // 개수가 많을수록 그림을 더 많이 쌓는다(최대 3)
    for (let k = 0; k < icons; k++) im.blit(breads[i], cx - 24 + k * 16, CASE.iconY);
    im.blit(plate(22, n), cx - 11, CASE.plateY);
  });
  for (const [zone, key] of [[CASE.premium, 'premium'], [CASE.discount, 'discount']]) {
    stock[key].forEach((n, i) => {
      const x = zone.x + 2 + i * 19; // 세 종류를 한 줄로 섞어 놓는다
      if (n > 0) {
        im.blit(breads[i], x, CASE.iconY);
        if (key === 'premium') im.blit(sparkle(), x + 11, CASE.iconY - 2); // 프리미엄 표시
      }
      im.blit(plate(17, n), x, CASE.plateY);
    });
  }
}

// 오른쪽 위 잔고 표시(HUD). 동전 아이콘이 있는 어두운 판 — 밤·낮 어느 배경 위에서도 읽힌다.
function hudMoney() {
  const im = new Img(HUD.w, HUD.h);
  im.rect(0, 0, HUD.w, HUD.h, 'ol').rect(1, 1, HUD.w - 2, HUD.h - 2, 'nt1').rect(1, 1, HUD.w - 2, 1, 'nt2');
  for (const [x, y] of [[0, 0], [HUD.w - 1, 0], [0, HUD.h - 1], [HUD.w - 1, HUD.h - 1]]) im.set(x, y, 'clear');
  im.blit(coin(0), 3, 3);
  return im;
}
// 금액 글자를 판 위에 오른쪽 정렬로 찍는다(미리보기용). color: 'gd'(평소) / 'gr'(증가) / 'rd'(감소)
function drawMoney(im, amount, color = 'gd') {
  const s = amount.toLocaleString('en-US');
  text(im, s, HUD.x + HUD.w - 5 - textWidth(s), HUD.y + 6, color);
}

// ───────────────── 조립·저장 ─────────────────
const B = { loaf: loaf(), croissant: croissant(), cake: cake() };
save(OUT, 'bread_loaf', B.loaf);
save(OUT, 'bread_croissant', B.croissant);
save(OUT, 'bread_cake', B.cake);
save(path.join(ROOT, 'assets'), 'favicon', B.croissant); // 브라우저 탭 아이콘(크루아상)
save(OUT, 'fx_sparkle', sparkle());
save(OUT, 'tag_sale', saleTag());
STYLES.forEach((st, i) => save(OUT, 'customer' + (i + 1), Img.sheet(customerFrames(st)))); // 24x36 프레임 9장: walk 0-3, think 4-5, happy 6-7, sad 8
const bubbles = ['think', 'sad', 'heart'].map(bubble);
save(OUT, 'bubbles', Img.sheet(bubbles)); // 28x18 프레임 3장
save(OUT, 'coin', Img.sheet([0, 1, 2, 3].map(coin))); // 10x10 프레임 4장
save(OUT, 'grade', Img.sheet(['S', 'A', 'B', 'C', 'D'].map(gradeBadge))); // 26x26 프레임 5장: S A B C D
save(OUT, 'icon_weather',Img.sheet(['sunny', 'cloudy', 'rain'].map(weatherIcon))); // 14x14 프레임 3장
save(OUT, 'oven', oven());
save(OUT, 'timing_bar', timingBar());
save(OUT, 'timing_cursor', cursorSprite());
const bgDay = shop('day');
const bgNight = shop('night');
save(OUT, 'bg_day', bgDay);
save(OUT, 'bg_night', bgNight);
save(OUT, 'hud_money', hudMoney());
const BREADS = [B.loaf, B.croissant, B.cake];
// 예시 재고: 일반 칸은 칸마다 한 종류, 프리미엄존·할인존은 세 종류가 섞여 있다(할인존 크루아상은 품절)
const DEMO_STOCK = { regular: [12, 8, 5], premium: [3, 2, 1], discount: [4, 0, 2] };
// 빵과 잔고가 채워진 배경(preview.html에서 사용)
function stocked(bg, money) {
  const im = new Img(320, 180);
  im.blit(bg, 0, 0);
  fillCase(im, DEMO_STOCK, BREADS);
  im.blit(hudMoney(), HUD.x, HUD.y);
  drawMoney(im, money);
  return im;
}
save(PREVIEW, 'stocked_day', stocked(bgDay, 187400));
save(PREVIEW, 'stocked_night', stocked(bgNight, 187400));

// 미리보기 1: 낮 영업 장면
{
  const im = stocked(bgDay, 187400);
  for (const x of [60, 144, 236]) im.ellipse(x + 12, 102, 9, 2, 'fl2'); // 손님 발 아래 바닥 그림자
  im.blit(CUSTOMER_FRAMES[4], 144, 68); // 고민하는 손님
  im.blit(bubbles[0], 152, 42);
  im.blit(CUSTOMER_FRAMES[0], 60, 68); // 걸어오는 손님
  im.blit(CUSTOMER_FRAMES[6], 236, 68); // 기뻐하는 손님
  im.blit(bubbles[2], 242, 42);
  save(PREVIEW, 'preview_day', im.scale(4));
}
// 미리보기 2: 밤 굽기 화면
{
  const im = stocked(bgNight, 187400); // 밤에도 진열장에 남은 빵과 잔고가 보인다
  im.blit(panel(200, 96), 114, 22); // 오른쪽에 좁게 → 왼쪽 창(달)과 램프가 보인다
  im.blit(oven(), 124, 40);
  const chips = [[B.loaf, '3'], [B.croissant, '2'], [B.cake, '1']]; // 오늘 구운 결과 요약
  chips.forEach(([b, n], i) => {
    im.blit(b, 206, 32 + i * 16);
    text(im, 'x' + n, 225, 38 + i * 16, 'ol');
  });
  im.blit(sparkle(), 218, 32); // 식빵 중 프리미엄이 있다는 표시
  im.blit(timingBar(), 146, 96);
  im.blit(cursorSprite(), 146 + 2 + 66, 93); // 커서가 초록(완벽) 구간 근처
  save(PREVIEW, 'preview_night', im.scale(4));
}
// 미리보기 3: 스프라이트 모음(1x 배치 후 4배 확대)
{
  const im = new Img(320, 180).fill('wl2');
  let x = 8;
  for (const b of [B.loaf, B.croissant, B.cake]) {
    im.blit(b, x, 8);
    x += 20;
  }
  im.blit(sparkle(), x, 12);
  im.blit(saleTag(), x + 10, 10);
  im.blit(Img.sheet([0, 1, 2, 3].map(coin)), x + 30, 10);
  im.blit(Img.sheet(['sunny', 'cloudy', 'rain'].map(weatherIcon)), 150, 10);
  im.blit(Img.sheet(bubbles), 8, 34);
  im.blit(Img.sheet(CUSTOMER_FRAMES), 8, 60);
  im.blit(oven(), 8, 104);
  im.blit(timingBar(), 80, 110);
  im.blit(cursorSprite(), 200, 106);
  save(PREVIEW, 'preview_sheet', im.scale(4));
}
console.log('완료: assets/sprites, assets/preview 에 PNG를 만들었습니다.');
