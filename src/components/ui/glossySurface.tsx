export type GlossyTheme = 'blue' | 'fafafa'
export type GlossyVariant = 'pill' | 'circle'

const THEMES: Record<
  GlossyTheme,
  { bg: string; border: string; shadow: string; glowColor: string }
> = {
  blue: {
    bg: 'linear-gradient(180deg, #90C8E6 0%, #99EDFF 100%)',
    border: '1.5px solid rgba(100,160,255,0.35)',
    shadow:
      '-1px -1px 0px 0px rgba(255, 255, 255, 1), 1px 1px 1px 0px rgba(0, 0, 0, 0.1)',
    glowColor: 'rgba(153,237,255,0.85)',
  },
  fafafa: {
    bg: 'linear-gradient(180deg, #ececec 0%, #E0E0E0 100%)',
    border: '1.5px solid rgba(0,0,0,0.08)',
    shadow:
      '-1px -1px 0px rgba(255, 255, 255, 1), 1px 1px 0px rgba(0, 0, 0, 0.12), 2px 2px 4px rgba(255,255,255,0.8)',
    glowColor: 'rgba(224,224,224,0.95)',
  },
}

export function glossyStyles(theme: GlossyTheme) {
  return THEMES[theme]
}

export function GlossyHighlight({
  variant,
  theme = 'blue',
}: {
  variant: GlossyVariant
  theme?: GlossyTheme
}) {
  if (variant === 'circle') {
    return (
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '16%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '62%',
          height: '32%',
          marginTop: 2,
          marginBottom: 2,
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse 100% 100% at 50% 0%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 72%)',
          pointerEvents: 'none',
        }}
      />
    )
  }

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: '25%',
        left: '50%',
        transform: 'translate(-50%, -50%) perspective(100px) rotateX(20deg)',
        width: '85%',
        height: '40%',
        background: 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
        borderRadius: '100px',
        pointerEvents: 'none',
      }}
    />
  )
}

export function GlossyGlow({
  variant,
  theme = 'blue',
}: {
  variant: GlossyVariant
  theme?: GlossyTheme
}) {
  const glow = THEMES[theme].glowColor

  if (variant === 'circle') {
    return (
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '50%',
          transform: 'translate(-50%, 50%)',
          width: '55%',
          height: '28%',
          borderRadius: '50%',
          background: `radial-gradient(ellipse 100% 100% at 50% 100%, ${glow} 0%, rgba(255,255,255,0) 70%)`,
          pointerEvents: 'none',
        }}
      />
    )
  }

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        bottom: '-10%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        height: '40%',
        backgroundColor: theme === 'blue' ? '#99EDFF' : '#E0E0E0',
        borderRadius: '100px',
        filter: 'blur(10px)',
        pointerEvents: 'none',
      }}
    />
  )
}
