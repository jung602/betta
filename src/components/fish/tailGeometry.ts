export interface FinShape {
  rayCount: number
  spread: number
  length: number
  droop: number
  branchDepth: number
  recession: number
  doubled: boolean
  lenShape: string
}

function lengthFn(t: number, shape: string) {
  if (shape === 'round') return 0.85 + 0.15 * Math.sin(t * Math.PI)
  if (shape === 'asymmetric') return 1.0 - 0.45 * t
  if (shape === 'asymmetricReverse') return 0.55 + 0.45 * t
  return 1.0
}

function makeRay(angle: number, len: number, droop: number, segs: number) {
  const pts: { x: number; y: number }[] = []
  for (let s = 0; s <= segs; s++) {
    const t = s / segs
    const r = len * t
    pts.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r - droop * t * t * len * 0.5,
    })
  }
  return pts
}

function branchRay(
  ray: { x: number; y: number }[],
  depth: number,
  splitT: number,
  spread: number,
): { x: number; y: number }[][] {
  if (depth === 0) return [ray]
  const splitIdx = Math.max(2, Math.floor(ray.length * splitT))
  if (splitIdx >= ray.length - 2) return [ray]
  const trunk = ray.slice(0, splitIdx + 1)
  const tipPt = ray[ray.length - 1], split = ray[splitIdx]
  const dx = tipPt.x - split.x, dy = tipPt.y - split.y
  const remainLen = Math.sqrt(dx * dx + dy * dy)
  const baseAng = Math.atan2(dy, dx)
  const out: { x: number; y: number }[][] = []
  for (let k = 0; k < 2; k++) {
    const sign = k === 0 ? -1 : 1
    const newAng = baseAng + sign * spread
    const segs = ray.length - 1 - splitIdx
    const tailPts: { x: number; y: number }[] = []
    for (let s = 1; s <= segs; s++) {
      const r = remainLen * (s / segs)
      tailPts.push({
        x: split.x + Math.cos(newAng) * r,
        y: split.y + Math.sin(newAng) * r,
      })
    }
    const child = branchRay(trunk.concat(tailPts), depth - 1, 0.7, spread * 0.6)
    for (const c of child) out.push(c)
  }
  return out
}

export function generateTail(p: FinShape) {
  const halfSpread = (p.spread * Math.PI / 180) / 2
  const fans = p.doubled
    ? [
        { centerAng: halfSpread + 0.13, halfSpread },
        { centerAng: -(halfSpread + 0.13), halfSpread },
      ]
    : [{ centerAng: 0, halfSpread }]

  const allRays: { x: number; y: number }[][] = []
  const memTris: number[] = []

  for (const fan of fans) {
    const fanRays: { x: number; y: number }[][] = []
    for (let i = 0; i < p.rayCount; i++) {
      const rc = p.rayCount as number
      const t = rc === 1 ? 0.5 : i / (rc - 1)
      const ang = fan.centerAng - fan.halfSpread + t * 2 * fan.halfSpread
      const len = p.length * lengthFn(t, p.lenShape)
      const ray = makeRay(ang, len, p.droop, 22)
      const branches = branchRay(ray, p.branchDepth, 0.6, 0.13)
      for (const b of branches) fanRays.push(b)
    }
    for (const r of fanRays) allRays.push(r)
    for (let i = 0; i < fanRays.length - 1; i++) {
      const a = fanRays[i], b = fanRays[i + 1]
      const minLen = Math.min(a.length, b.length)
      const limit = Math.floor(minLen * (1 - p.recession))
      for (let j = 0; j < limit - 1; j++) {
        memTris.push(
          a[j].x, a[j].y, 0, b[j].x, b[j].y, 0, a[j + 1].x, a[j + 1].y, 0,
          b[j].x, b[j].y, 0, b[j + 1].x, b[j + 1].y, 0, a[j + 1].x, a[j + 1].y, 0,
        )
      }
    }
  }
  return { rays: allRays, membrane: memTris }
}
