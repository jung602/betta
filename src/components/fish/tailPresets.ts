export const TAIL_PRESETS = {
  plakat:     { rayCount: 12, spread: 130, length: 0.95, droop: 0,    branchDepth: 0, recession: 0,    doubled: false, lenShape: 'round',      label: '플라캇' },
  delta:      { rayCount: 14, spread: 150, length: 1.30, droop: 0,    branchDepth: 0, recession: 0,    doubled: false, lenShape: 'flat',       label: '델타' },
  halfmoon:   { rayCount: 18, spread: 180, length: 1.40, droop: 0,    branchDepth: 0, recession: 0,    doubled: false, lenShape: 'flat',       label: '하프문' },
  crowntail:  { rayCount: 14, spread: 180, length: 1.45, droop: 0,    branchDepth: 0, recession: 0.40, doubled: false, lenShape: 'flat',       label: '크라운테일' },
  rosetail:   { rayCount: 12, spread: 195, length: 1.25, droop: 0,    branchDepth: 2, recession: 0,    doubled: false, lenShape: 'flat',       label: '로즈테일' },
  veiltail:   { rayCount: 14, spread: 130, length: 1.55, droop: 0.75, branchDepth: 0, recession: 0,    doubled: false, lenShape: 'asymmetric', label: '베일테일' },
  doubletail: { rayCount: 9,  spread: 65,  length: 1.20, droop: 0,    branchDepth: 0, recession: 0,    doubled: true,  lenShape: 'flat',       label: '더블테일' },
} as const

export type TailPresetKey = keyof typeof TAIL_PRESETS

export type TailPreset = typeof TAIL_PRESETS[TailPresetKey]
