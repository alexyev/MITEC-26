// The Build map's "Take me there" pin (D121): the radio it flies to and where it sits. In the main bundle;
// the 3D view's own settings are in scene3d.ts, which loads with the view (D120).

export const CORNER_PIN = {
  /**
   * The radio the pin flies to: cell (4, 3), north of the base pad, whose radio is built in the first
   * stage, so the pin shows early in the build, and is not the walkthrough's failure.
   */
  featuredCell: { col: 4, row: 3 },
  /** Gap between the radio and the pin, in CSS pixels. */
  gapPx: 14,
};
