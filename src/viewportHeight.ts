/** 모바일 브라우저에서 주소창·상태바를 제외한 실제 보이는 높이를 --app-height 로 동기화 */
export function setupViewportHeight() {
  const root = document.documentElement

  const sync = () => {
    const h = window.visualViewport?.height ?? window.innerHeight
    root.style.setProperty('--app-height', `${Math.round(h)}px`)
  }

  sync()
  window.addEventListener('resize', sync)
  window.addEventListener('orientationchange', sync)
  window.visualViewport?.addEventListener('resize', sync)
  window.visualViewport?.addEventListener('scroll', sync)
}
