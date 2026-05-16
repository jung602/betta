import { useMemo } from 'react'
import * as THREE from 'three'

export function useGradientTexture(
  topColor: string,
  bottomColor: string,
  size = 512
) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 0, size)
    gradient.addColorStop(0, topColor)
    gradient.addColorStop(1, bottomColor)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 4, size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }, [topColor, bottomColor, size])
}
