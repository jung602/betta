import * as THREE from 'three'

// ── Fish scaling ──
export const FISH_SCALE = 0.05
export const BODY_SCALE = 1.3
export const TAIL_SCALE = 0.8

// ── Fin size multipliers ──
export const PECTORAL_SCALE = 1.5
export const DORSAL_SCALE = 1.5
export const ANAL_SCALE = 2.5

// ── Movement ──
export const MAX_SPEED = 0.0875
export const MIN_SPEED = 0.03
export const WALL_MARGIN = 0.075
export const WALL_STRENGTH = 0.00625

export const ARRIVE_MAX_SPEED = 0.125
export const ARRIVE_MAX_FORCE = 0.0075
export const ARRIVE_RADIUS = 0.0875

export const MAX_HEADING_DELTA = 0.15
export const MAX_ANG_VEL = 0.06

// ── Wave animation ──
export const WAVE_AMP = 1
export const WAVE_SPEED = 3.2
export const WAVE_K = 5.5
export const BODY_WAVE_AMP = 0.08

// ── Body shape ──
export const BODY_RADIUS_X = 0.7
export const BODY_RADIUS_Y = 0.25
export const BODY_RADIUS_Z = 0.18
export const BODY_CENTER_X = -0.7
export const BODY_CENTER_Y = 0.03

// ── Fin positions ──
export const PECTORAL_X = -0.95
export const PECTORAL_Y = -0.05
export const PECTORAL_Z = 0.17

export const DORSAL_X = -0.65
export const DORSAL_Y = 0.25

export const ANAL_X = -0.15
export const ANAL_Y = -0.05

export const TAIL_X = -0.15
export const TAIL_Y = -0.08

// ── Fin presets (fixed, don't change with tail type) ──
export const PECTORAL_FIN = {
  rayCount: 5, spread: 80, length: 0.3, droop: 0,
  branchDepth: 0, recession: 0, doubled: false, lenShape: 'round',
}

export const DORSAL_FIN = {
  rayCount: 8, spread: 100, length: 0.35, droop: 0.3,
  branchDepth: 0, recession: 0, doubled: false, lenShape: 'asymmetric',
}

export const ANAL_FIN = {
  rayCount: 8, spread: 90, length: 0.3, droop: 0.3,
  branchDepth: 0, recession: 0, doubled: false, lenShape: 'asymmetricReverse',
}

// ── Reusable temp vectors (avoid GC) ──
export const _acc = new THREE.Vector3()
export const _desired = new THREE.Vector3()
export const _steer = new THREE.Vector3()
export const _wall = new THREE.Vector3()
export const _tmp = new THREE.Vector3()
export const _lookMat = new THREE.Matrix4()
export const _up = new THREE.Vector3(0, 1, 0)
export const _origin = new THREE.Vector3(0, 0, 0)
export const _targetQuat = new THREE.Quaternion()

// ── Color references ──
export const _lerpColor = new THREE.Color()
