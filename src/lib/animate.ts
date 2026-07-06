import { animate } from 'animejs'

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Fade-and-rise entrance, capped at 150ms per the design rules. */
export function enter(el: Element | null): void {
  if (!el || reducedMotion()) return
  animate(el, {
    opacity: [0, 1],
    translateY: [6, 0],
    duration: 140,
    ease: 'outQuad',
  })
}

/** Quick horizontal shake for wrong answers. */
export function shake(el: Element | null): void {
  if (!el || reducedMotion()) return
  animate(el, {
    translateX: [0, -5, 5, -3, 0],
    duration: 150,
    ease: 'inOutQuad',
  })
}
