import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';

const FONT = {
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01111'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
  J: ['00111','00010','00010','00010','10010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'],
  X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  Z: ['11111','00001','00010','00100','01000','10000','11111'],
  0: ['01110','10001','10011','10101','11001','10001','01110'],
  1: ['00100','01100','00100','00100','00100','00100','01110'],
  2: ['01110','10001','00001','00010','00100','01000','11111'],
  3: ['11110','00001','00001','01110','00001','00001','11110'],
  4: ['00010','00110','01010','10010','11111','00010','00010'],
  5: ['11111','10000','10000','11110','00001','00001','11110'],
  6: ['01110','10000','10000','11110','10001','10001','01110'],
  7: ['11111','00001','00010','00100','01000','01000','01000'],
  8: ['01110','10001','10001','01110','10001','10001','01110'],
  9: ['01110','10001','10001','01111','00001','00001','01110'],
  '$': ['00100','01111','10100','01110','00101','11110','00100'],
  '.': ['00000','00000','00000','00000','00000','01100','01100'],
  '/': ['00001','00010','00010','00100','01000','01000','10000'],
  '>': ['10000','01000','00100','00010','00100','01000','10000'],
  '<': ['00001','00010','00100','01000','00100','00010','00001'],
  ':': ['00000','01100','01100','00000','01100','01100','00000'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  '[': ['01110','01000','01000','01000','01000','01000','01110'],
  ']': ['01110','00010','00010','00010','00010','00010','01110'],
  '+': ['00000','00100','00100','11111','00100','00100','00000'],
  '=': ['00000','00000','11111','00000','11111','00000','00000'],
  '_': ['00000','00000','00000','00000','00000','00000','11111'],
  '(': ['00010','00100','01000','01000','01000','00100','00010'],
  ')': ['01000','00100','00010','00010','00010','00100','01000'],
  ',': ['00000','00000','00000','00000','00110','00100','01000'],
  '#': ['01010','11111','01010','01010','11111','01010','00000'],
  '@': ['01110','10001','10111','10101','10111','10000','01110'],
};

export const PALETTE = [
  [10, 14, 20],
  [235, 241, 248],
  [248, 81, 73],
  [63, 185, 80],
  [210, 153, 34],
  [88, 166, 255],
  [108, 117, 125],
  [35, 42, 51],
];

export function createCanvas(width, height, color = 0) {
  return { width, height, pixels: new Uint8Array(width * height).fill(color) };
}

export function fillRect(canvas, x, y, width, height, color) {
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  const right = Math.min(canvas.width, x + width);
  const bottom = Math.min(canvas.height, y + height);
  for (let row = top; row < bottom; row += 1) {
    canvas.pixels.fill(color, row * canvas.width + left, row * canvas.width + right);
  }
}

export function drawText(canvas, text, x, y, { color = 1, scale = 2 } = {}) {
  let cursor = x;
  for (const raw of text.toUpperCase()) {
    const glyph = FONT[raw];
    assert.ok(glyph, `deterministic GIF font does not contain ${JSON.stringify(raw)}`);
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] === '1') {
          fillRect(canvas, cursor + column * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cursor += 6 * scale;
  }
  return cursor;
}

function word(value) {
  return [value & 0xff, (value >> 8) & 0xff];
}

function bytes(value) {
  return [...Buffer.from(value, 'ascii')];
}

function packCodes(codes) {
  const output = [];
  let accumulator = 0;
  let bits = 0;
  for (const { code, size } of codes) {
    accumulator |= code << bits;
    bits += size;
    while (bits >= 8) {
      output.push(accumulator & 0xff);
      accumulator >>= 8;
      bits -= 8;
    }
  }
  if (bits) output.push(accumulator & 0xff);
  return output;
}

function lzwCompressedStream(pixels, minimumCodeSize) {
  const clear = 1 << minimumCodeSize;
  const end = clear + 1;
  const rawCodes = [clear];
  let transitions = new Map();
  let nextCode = end + 1;

  if (pixels.length > 0) {
    let prefix = pixels[0];
    for (let index = 1; index < pixels.length; index += 1) {
      const pixel = pixels[index];
      const key = prefix * 256 + pixel;
      const known = transitions.get(key);
      if (known !== undefined) {
        prefix = known;
        continue;
      }
      rawCodes.push(prefix);
      if (nextCode < 4096) {
        transitions.set(key, nextCode);
        nextCode += 1;
      } else {
        rawCodes.push(clear);
        transitions = new Map();
        nextCode = end + 1;
      }
      prefix = pixel;
    }
    rawCodes.push(prefix);
  }
  rawCodes.push(end);

  const codes = [];
  let codeSize = minimumCodeSize + 1;
  let decoderNextCode = end + 1;
  let hasPrevious = false;

  for (const code of rawCodes) {
    codes.push({ code, size: codeSize });
    if (code === clear) {
      codeSize = minimumCodeSize + 1;
      decoderNextCode = end + 1;
      hasPrevious = false;
    } else if (code !== end) {
      if (hasPrevious && decoderNextCode < 4096) {
        decoderNextCode += 1;
        if (decoderNextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
      }
      hasPrevious = true;
    }
  }
  return packCodes(codes);
}

function subBlocks(data) {
  const output = [];
  for (let offset = 0; offset < data.length; offset += 255) {
    const block = data.slice(offset, offset + 255);
    output.push(block.length, ...block);
  }
  output.push(0);
  return output;
}

export function encodeGif({ width, height, frames, palette = PALETTE, loop = 0 }) {
  assert.ok(width > 0 && height > 0 && frames.length > 0);
  assert.ok(palette.length > 0 && palette.length <= 256 && (palette.length & (palette.length - 1)) === 0);
  const colorBits = Math.max(2, Math.ceil(Math.log2(palette.length)));
  const tableSize = 1 << colorBits;
  const output = [
    ...bytes('GIF89a'), ...word(width), ...word(height),
    0x80 | ((colorBits - 1) << 4) | (colorBits - 1), 0, 0,
  ];
  for (let index = 0; index < tableSize; index += 1) {
    output.push(...(palette[index] ?? [0, 0, 0]));
  }
  output.push(
    0x21, 0xff, 0x0b, ...bytes('NETSCAPE2.0'), 0x03, 0x01, ...word(loop), 0,
  );
  for (const frame of frames) {
    assert.equal(frame.pixels.length, width * height);
    const compressed = lzwCompressedStream(frame.pixels, colorBits);
    output.push(
      0x21, 0xf9, 0x04, 0x00, ...word(frame.delay), 0, 0,
      0x2c, ...word(0), ...word(0), ...word(width), ...word(height), 0,
      colorBits,
    );
    for (const value of subBlocks(compressed)) output.push(value);
  }
  output.push(0x3b);
  return Buffer.from(output);
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

export function encodePng(canvas, palette = PALETTE) {
  assert.equal(canvas.pixels.length, canvas.width * canvas.height);
  assert.ok(palette.length > 0 && palette.length <= 256);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header.set([8, 3, 0, 0, 0], 8);
  const rows = Buffer.alloc((canvas.width + 1) * canvas.height);
  for (let row = 0; row < canvas.height; row += 1) {
    const outputOffset = row * (canvas.width + 1);
    rows[outputOffset] = 0;
    rows.set(canvas.pixels.subarray(row * canvas.width, (row + 1) * canvas.width), outputOffset + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('PLTE', Buffer.from(palette.flat())),
    pngChunk('IDAT', deflateSync(rows, { level: 9 })),
    pngChunk('IEND'),
  ]);
}
