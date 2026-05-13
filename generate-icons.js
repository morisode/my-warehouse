const fs = require('fs');
const path = require('path');

// Generate a simple PNG icon using raw pixel data (no external dependencies)
// This creates a minimal valid PNG with a gradient background and "M" text approximation

function createPNG(size) {
  // We'll create a simple colored square with rounded corners effect
  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const radius = size * 0.7;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Gradient from #6366f1 (top-left) to #8b5cf6 (bottom-right)
      const t = (x + y) / (2 * size);
      pixels[idx]     = Math.round(99 + t * (139 - 99));   // R
      pixels[idx + 1] = Math.round(102 + t * (92 - 102));  // G
      pixels[idx + 2] = Math.round(241 + t * (246 - 241)); // B
      pixels[idx + 3] = 255; // A
    }
  }

  // Simple PNG encoder
  return encodePNG(pixels, size, size);
}

function encodePNG(pixels, width, height) {
  const zlib = require('zlib');

  // Build raw image data with filter byte
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    rawData[rowStart] = 0; // No filter
    pixels.copy(rawData, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  // Build PNG file
  const chunks = [];

  // Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(makeChunk('IHDR', ihdr));

  // IDAT
  chunks.push(makeChunk('IDAT', compressed));

  // IEND
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeB, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
[192, 512].forEach(size => {
  const png = createPNG(size);
  fs.writeFileSync(path.join(__dirname, `icon-${size}x${size}.png`), png);
  console.log(`Created icon-${size}x${size}.png (${png.length} bytes)`);
});
