// 도트 그리기 도구: 이미지(Img) 한 장에 점·사각형·타원을 찍고, 자동 외곽선·확대를 해 준다.
const PAL = require('./palette');

const rgb = (name) => {
  const h = PAL[name];
  if (!h) throw new Error('팔레트에 없는 색: ' + name);
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};

class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h * 4); // 처음엔 전부 투명
  }
  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  // 점 하나 찍기. 색 이름이 null이면 아무것도 안 함, 'clear'면 지우기
  set(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!c || !this.inside(x, y)) return this;
    const i = (y * this.w + x) * 4;
    if (c === 'clear') {
      this.d[i + 3] = 0;
      return this;
    }
    const [r, g, b] = rgb(c);
    this.d[i] = r;
    this.d[i + 1] = g;
    this.d[i + 2] = b;
    this.d[i + 3] = 255; // 반투명 없이 완전 불투명만 사용(도트는 경계가 딱 떨어져야 한다)
    return this;
  }
  opaque(x, y) {
    return this.inside(x, y) && this.d[(y * this.w + x) * 4 + 3] > 0;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }
  // 타원 채우기. colorOf(x, y, dx, dy)가 색 이름을 돌려준다(그림자 넣을 때 사용)
  ellipse(cx, cy, rx, ry, colorOf) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, typeof colorOf === 'string' ? colorOf : colorOf(x, y, dx, dy));
      }
    }
    return this;
  }
  // 다른 이미지를 (dx, dy)에 붙이기. 투명한 부분은 건너뛴다
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.d[i + 3] === 0) continue;
        const tx = dx + x;
        const ty = dy + y;
        if (!this.inside(tx, ty)) continue;
        const j = (ty * this.w + tx) * 4;
        this.d[j] = src.d[i];
        this.d[j + 1] = src.d[i + 1];
        this.d[j + 2] = src.d[i + 2];
        this.d[j + 3] = 255;
      }
    }
    return this;
  }
  // 자동 외곽선: 불투명 픽셀의 상하좌우 이웃이 투명이면 그 자리에 외곽선 색을 찍는다.
  // 모든 스프라이트가 같은 1px 외곽선을 갖게 되어 화풍이 통일된다.
  outline(c = 'ol') {
    const snap = new Img(this.w, this.h);
    snap.d.set(this.d);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (snap.opaque(x, y)) continue;
        if (snap.opaque(x - 1, y) || snap.opaque(x + 1, y) || snap.opaque(x, y - 1) || snap.opaque(x, y + 1)) this.set(x, y, c);
      }
    }
    return this;
  }
  flipH() {
    const out = new Img(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const s = (y * this.w + x) * 4;
        const t = (y * this.w + (this.w - 1 - x)) * 4;
        for (let k = 0; k < 4; k++) out.d[t + k] = this.d[s + k];
      }
    return out;
  }
  // 정수 배 확대(최근접 이웃): 픽셀이 번지지 않고 네모 그대로 커진다
  scale(n) {
    const out = new Img(this.w * n, this.h * n);
    for (let y = 0; y < out.h; y++)
      for (let x = 0; x < out.w; x++) {
        const s = (Math.floor(y / n) * this.w + Math.floor(x / n)) * 4;
        const t = (y * out.w + x) * 4;
        for (let k = 0; k < 4; k++) out.d[t + k] = this.d[s + k];
      }
    return out;
  }
  // 프레임 여러 장을 가로로 이어 붙인 스프라이트 시트 만들기
  static sheet(frames) {
    const out = new Img(frames.reduce((s, f) => s + f.w, 0), Math.max(...frames.map((f) => f.h)));
    let x = 0;
    for (const f of frames) {
      out.blit(f, x, 0);
      x += f.w;
    }
    return out;
  }
  // 배경색을 깔고 싶을 때(미리보기용)
  fill(c) {
    return this.rect(0, 0, this.w, this.h, c);
  }
}

// 3x5 숫자 글꼴(개수 표시용). 한글 등 글자는 나중에 Phaser 글꼴로 처리한다.
const FONT = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '%': ['101', '001', '010', '100', '101'],
  x: ['000', '101', '010', '101', '000'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  ',': ['000', '000', '000', '010', '100'],
};
function text(img, str, x, y, c) {
  for (const ch of String(str)) {
    const g = FONT[ch];
    if (g) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '1') img.set(x + i, y + j, c);
    x += 4;
  }
}
const textWidth = (str) => String(str).length * 4 - 1;

module.exports = { Img, text, textWidth };
