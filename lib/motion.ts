/**
 * Spring tiers (Fluid Functionalism). The bigger the thing that moves, the slower
 * the spring. Never hand-write a duration: reach for a tier. Exits are plain tweens
 * one tier quicker, so a dismissal reads crisp instead of replaying the entrance.
 */
export const spring = {
  /** Hover, fades, tooltips, focus rings */
  fast: { type: 'spring', duration: 0.08, bounce: 0, exit: { duration: 0.06, ease: 'easeIn' } },
  /** Dropdowns, tabs, panels that must land exactly (critically damped) */
  moderate: { type: 'spring', duration: 0.16, bounce: 0, exit: { duration: 0.12, ease: 'easeIn' } },
  /** Dialogs, drawers, large surfaces */
  slow: { type: 'spring', duration: 0.24, bounce: 0.12, exit: { duration: 0.16, ease: 'easeIn' } },
  /**
   * Map camera (zoom into a state and back). A camera move travels the whole
   * frame, so it needs more time than a panel to read as one continuous motion:
   * an iOS/macOS-style spring with a soft settle. The one deliberate addition
   * to the three tiers above, reserved for full-frame camera moves.
   */
  camera: { type: 'spring', visualDuration: 0.55, bounce: 0.1, exit: { duration: 0.3, ease: 'easeInOut' } },
} as const;
