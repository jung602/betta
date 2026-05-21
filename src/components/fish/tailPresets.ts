export const TAIL_PRESETS = {
  plakat:     { rayCount: 12, spread: 130, length: 0.95, droop: 0,    branchDepth: 0, recession: 0,    doubled: false, lenShape: 'round',      label: 'Plakat' },
  delta:      { rayCount: 14, spread: 150, length: 1.30, droop: 0,    branchDepth: 0, recession: 0,    doubled: false, lenShape: 'flat',       label: 'Delta' },
  halfmoon:   { rayCount: 18, spread: 180, length: 1.40, droop: 0,    branchDepth: 0, recession: 0,    doubled: false, lenShape: 'flat',       label: 'Halfmoon' },
  crowntail:  { rayCount: 14, spread: 180, length: 1.45, droop: 0,    branchDepth: 0, recession: 0.40, doubled: false, lenShape: 'flat',       label: 'Crowntail' },
  rosetail:   { rayCount: 12, spread: 195, length: 1.25, droop: 0,    branchDepth: 2, recession: 0,    doubled: false, lenShape: 'flat',       label: 'Rosetail' },
  veiltail:   { rayCount: 14, spread: 130, length: 1.55, droop: 0.75, branchDepth: 0, recession: 0,    doubled: false, lenShape: 'asymmetric', label: 'Veiltail' },
  doubletail: { rayCount: 9,  spread: 65,  length: 1.20, droop: 0,    branchDepth: 0, recession: 0,    doubled: true,  lenShape: 'flat',       label: 'Doubletail' },
} as const

export type TailPresetKey = keyof typeof TAIL_PRESETS

export type TailPreset = typeof TAIL_PRESETS[TailPresetKey]
