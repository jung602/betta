// Photoshop .abr (v6 sampled) 브러시 팁 비트맵을 grayscale PNG로 추출
// 사용: node scripts/extract_abr.mjs "<abr path>" "<out dir>"
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const abrPath = process.argv[2]
const outDir = process.argv[3] || 'public/icon'

const buf = fs.readFileSync(abrPath)
let p = 0
const u8 = () => buf.readUInt8(p++)
const u16 = () => { const v = buf.readUInt16BE(p); p += 2; return v }
const u32 = () => { const v = buf.readUInt32BE(p); p += 4; return v }
const i32 = () => { const v = buf.readInt32BE(p); p += 4; return v }

const version = u16()
const subversion = u16()
console.log('ABR version', version, 'subversion', subversion)

if (version !== 6) {
  console.error('이 스크립트는 ABR v6만 지원합니다.')
  process.exit(1)
}

// 8BIM 블록 순회 → samp 데이터 영역 찾기
let sampStart = -1
let sampEnd = -1
while (p + 12 <= buf.length) {
  const sig = buf.toString('latin1', p, p + 4)
  if (sig !== '8BIM') break
  p += 4
  const key = buf.toString('latin1', p, p + 4)
  p += 4
  const len = u32()
  const dataStart = p
  if (key === 'samp') {
    sampStart = dataStart
    sampEnd = dataStart + len
  }
  p = dataStart + len
  if (len % 2 === 1) p++ // even padding (안전)
}

if (sampStart < 0) {
  console.error('samp 섹션을 찾지 못했습니다.')
  process.exit(1)
}

console.log('samp range', sampStart, sampEnd, 'len', sampEnd - sampStart)

// PackBits(RLE) 디코드 (PSD 방식)
function unpackBits(src, srcStart, srcEnd, expected) {
  const out = Buffer.alloc(expected)
  let s = srcStart
  let o = 0
  while (o < expected && s < srcEnd) {
    let n = src.readInt8(s++)
    if (n >= 0) {
      const count = n + 1
      for (let i = 0; i < count && o < expected && s < srcEnd; i++) out[o++] = src[s++]
    } else if (n !== -128) {
      const count = 1 - n
      const val = src[s++]
      for (let i = 0; i < count && o < expected; i++) out[o++] = val
    }
  }
  return out
}

// grayscale 8-bit PNG 인코더
function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'latin1')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}
function writeGrayPng(file, width, height, gray) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 0 // grayscale
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0
    gray.copy(raw, y * (width + 1) + 1, y * width, y * width + width)
  }
  const idat = zlib.deflateSync(raw)
  fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]))
}

fs.mkdirSync(outDir, { recursive: true })

// samp 내부 브러시 순회
p = sampStart
let idx = 0
while (p + 4 <= sampEnd) {
  const brushLen = u32()
  if (brushLen <= 0 || p + brushLen > sampEnd + 4) break
  const brushStart = p
  const brushEnd = p + brushLen

  // 브러시 ID(파스칼 문자열) 건너뛰기
  const idLen = u8()
  p += idLen

  // 헤더 위치가 가변적이라 사각형(top,left,bottom,right)을 스캔으로 탐색
  let found = null
  for (let q = p; q < brushEnd - 14; q++) {
    const top = buf.readInt32BE(q)
    const left = buf.readInt32BE(q + 4)
    const bottom = buf.readInt32BE(q + 8)
    const right = buf.readInt32BE(q + 12)
    const depth = buf.readUInt16BE(q + 16)
    const comp = buf.readUInt8(q + 18)
    const w = right - left
    const h = bottom - top
    if (
      top >= 0 && left >= 0 && w > 8 && h > 8 && w < 4000 && h < 4000 &&
      (depth === 8 || depth === 16) && (comp === 0 || comp === 1)
    ) {
      found = { top, left, bottom, right, w, h, depth, comp, dataStart: q + 19 }
      break
    }
  }

  if (found) {
    const { w, h, depth, comp, dataStart } = found
    let gray
    if (comp === 0) {
      gray = Buffer.from(buf.subarray(dataStart, dataStart + w * h))
    } else {
      // RLE: 행별 카운트(2바이트) * h, 이후 압축 데이터
      let s = dataStart
      const counts = []
      for (let y = 0; y < h; y++) { counts.push(buf.readUInt16BE(s)); s += 2 }
      gray = Buffer.alloc(w * h)
      for (let y = 0; y < h; y++) {
        const rowEnd = s + counts[y]
        const row = unpackBits(buf, s, rowEnd, w)
        row.copy(gray, y * w)
        s = rowEnd
      }
    }
    const outFile = path.join(outDir, `marker${idx}.png`)
    writeGrayPng(outFile, w, h, gray)
    console.log(`brush #${idx}: ${w}x${h} depth=${depth} comp=${comp} -> ${outFile}`)
    idx++
  } else {
    console.log(`brush #${idx}: 비트맵 헤더 탐색 실패 (len=${brushLen})`)
  }

  // 다음 브러시 (4바이트 정렬)
  let next = brushEnd
  while (next % 4 !== 0) next++
  p = next
}

console.log('완료: 추출', idx, '개')
