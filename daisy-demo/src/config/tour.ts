// The home screen and the guided tour (D90, D91, D92): timings, the per-viewer storage key, the callout's
// geometry, and the tour's steps as data. Step copy is built from `TourFacts`, so every number and name in
// it comes from the code (src/ui/guide/facts.ts); no magic numbers outside src/config/.
import type { TabId } from '../state/store';
import type { ColorToken, LegendItem } from '../ui/kit/types';

/** Home screen (D90). Durations mirror `--dur-home` and `--dur-home-fade` in src/ui/tokens.css. */
export const HOME = {
  /** Leaving or reopening the home screen: the content lifts and fades while the map comes into focus. */
  transitionMs: 720,
  /** The same transition under reduced motion: a plain crossfade. */
  reducedTransitionMs: 200,
};

/** Guided tour (D91, D92). Px values are CSS pixels. */
export const TOUR = {
  /** localStorage key that remembers the tour was completed or skipped, per viewer. */
  storageKey: 'exowatt-demo.tour.v1',
  /** Space between a target and its ring, and between the ring and the callout. */
  holePadPx: 6,
  calloutGapPx: 14,
  /** The callout keeps this far inside the window. */
  edgePx: 16,
  /** An interactive step shows its tick this long before it moves on. */
  advanceDelayMs: 650,
  /** Time constant of the spotlight and callout gliding to a new step (0 under reduced motion). */
  glideMs: 90,
  /** Corner radius of a hole when its target has none. */
  holeRadiusPx: 12,
};

/**
 * A spotlight target: an element with this `data-tour` attribute (D93). `map` is the map stage, cut down to
 * the gap between the panels where the site is fit (`TOUR_INSETS`).
 */
export type TourTarget =
  | 'tabs'
  | 'map'
  | 'legend'
  | 'play'
  | 'steps'
  | 'speed'
  | 'fleet'
  | 'cost'
  | 'cost-card'
  | 'try-it'
  | 'tour'
  | 'brand'
  | 'player';

/** Targets that exist only once the viewer opens them (the cost card); a step shows without them. */
export const TOUR_OPTIONAL_TARGETS: readonly TourTarget[] = ['cost-card'];

/** Insets of a target's hole from its element's box, in CSS pixels. */
export const TOUR_INSETS: Partial<
  Record<TourTarget, { top: number; right: number; bottom: number; left: number }>
> = {
  /** The gap between the top row, both 320 px docks and the player bar, where the site is drawn. */
  map: { top: 76, right: 340, bottom: 172, left: 340 },
};

/** Something the viewer does in an interactive step; the tour moves on when they do it (Next still works). */
export type TourAction =
  /** A click inside the step's first target. */
  | { kind: 'click'; hint: string }
  /** The shell switches to this tab. */
  | { kind: 'tab'; tab: TabId; hint: string }
  /** The pointer rests on anything on the Build map that has a hover card. */
  | { kind: 'hover'; hint: string }
  /** A radio is failed or repaired on the Build map. */
  | { kind: 'radio'; hint: string };

export interface TourSwatch {
  token: ColorToken;
  shape: LegendItem['shape'];
  label: string;
}

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Spotlit elements; the callout sits beside the first (or `anchor`) and clear of all of them. */
  targets: TourTarget[];
  /** Place the callout beside this element instead of the first target. */
  anchor?: TourTarget;
  /** Spotlight the targets as one hole around them all (neighbors whose rings would touch). */
  merge?: boolean;
  /** The tab the step explains; entering the step switches to it. */
  tab: TabId;
  action?: TourAction;
  /** Story colors shown in the callout, with their meaning. */
  swatches?: TourSwatch[];
  /** Entering the step moves the walkthrough to "Your turn" (D94). */
  toYourTurn?: boolean;
}

/** The numbers and names the tour's copy states, read from the code (src/ui/guide/facts.ts). */
export interface TourFacts {
  /** The survey vehicle, as the Survey tab names it. */
  vehicle: string;
  acres: string;
  units: string;
  defaultVehicles: number;
  maxVehicles: number;
  /** Survey time on site with the default fleet, as the Survey tab formats it. */
  surveyHours: string;
  /** One survey UTV with its kit and drone, all in, as the cost card formats it. */
  utvKitUsd: string;
  slowestSpeed: string;
  fastestSpeed: string;
  normalSpeed: string;
  surveyTab: string;
  buildTab: string;
  buildStages: number;
  radios: number;
  robot: string;
  uplink: string;
  uplinkHops: number;
  failed: string;
  missedHellos: number;
}

/** The guided tour, in order: about a dozen short steps over both tabs (D91). */
export function tourSteps(f: TourFacts): TourStep[] {
  const fleet = `${f.defaultVehicles} ${f.vehicle}${f.defaultVehicles === 1 ? '' : 's'}`;
  return [
    {
      id: 'tabs',
      title: 'Two tabs, one site',
      body: `${f.surveyTab}: ${fleet}, each with lidar and a drone, scan the ${f.acres} acres over Starlink. ${f.buildTab}: the radio network goes up with the units and keeps the data moving when a radio fails.`,
      targets: ['tabs'],
      tab: 'survey',
    },
    {
      id: 'map',
      title: 'The map and its colors',
      body: `The whole site to scale: ${f.units} P3 units around the base pad at the center. Scroll to zoom and drag to pan. Each color means one thing in both tabs:`,
      targets: ['map', 'legend'],
      tab: 'survey',
      swatches: [
        { token: 'work', shape: 'dot', label: `Work in progress: ${f.vehicle}s, drones, paths` },
        { token: 'data', shape: 'line', label: 'Data moving, and its route' },
        { token: 'signal', shape: 'circle', label: 'Radio signal and coverage' },
        { token: 'fail', shape: 'cross', label: 'A failed or cut-off radio' },
      ],
    },
    {
      id: 'play',
      title: 'Play the walkthrough',
      body: 'Each tab is a short walkthrough. The caption above the controls says what is happening at each step.',
      targets: ['play'],
      anchor: 'player',
      tab: 'survey',
      action: { kind: 'click', hint: 'Press Play' },
    },
    {
      id: 'steps',
      title: 'Steps and speed',
      body: `Click any step to jump to it; the last one, Your turn, is where you take over. Speed runs from ${f.slowestSpeed} to ${f.fastestSpeed}, with ${f.normalSpeed} the designed pace.`,
      targets: ['steps', 'speed'],
      tab: 'survey',
    },
    {
      id: 'fleet',
      title: 'Plan the survey',
      body: `Set 1 to ${f.maxVehicles} ${f.vehicle}s and press Send. Each gets its own strip and a drone, online over its own Starlink. ${fleet} take ${f.surveyHours} h on site; more finish sooner.`,
      targets: ['fleet'],
      tab: 'survey',
    },
    {
      id: 'cost',
      title: 'What it costs',
      body: `The chip shows the cost from sourced prices only. Open it for the breakdown, for one survey ${f.vehicle} kitted out (${f.utvKitUsd} all in, drawn part by part), and to compare the other ways to do the job.`,
      targets: ['cost', 'cost-card'],
      tab: 'survey',
    },
    {
      id: 'switch',
      title: `Now, ${f.buildTab}`,
      body: 'The same site, built from the center out, with every machine online through a mesh of radios on the units.',
      targets: ['tabs'],
      tab: 'survey',
      action: { kind: 'tab', tab: 'build', hint: `Switch to ${f.buildTab}` },
    },
    {
      id: 'story',
      title: 'The story',
      body: `A section of the site goes up in ${f.buildStages} stages, ${f.radios} radios in all. Mid-build, a ${f.robot} sends its data via ${f.uplink}, ${f.uplinkHops} hops from the base. Radio ${f.failed} on its route fails; its neighbors miss ${f.missedHellos} hellos and reroute the data around it.`,
      targets: ['steps'],
      tab: 'build',
    },
    {
      id: 'hover',
      title: 'Hover for details',
      body: 'The section is now built, its data moving. Every radio, machine and unit has a card: what it is, what it is doing, and for a radio, its hops to the base and its queue.',
      targets: ['map'],
      tab: 'build',
      action: { kind: 'hover', hint: 'Hover the map' },
      toYourTurn: true,
    },
    {
      id: 'your-turn',
      title: 'Your turn',
      body: 'Click any radio to fail it, and again to repair it. The data reroutes live, and Reset repairs every radio.',
      targets: ['try-it', 'map'],
      tab: 'build',
      action: { kind: 'radio', hint: 'Click a radio' },
      toYourTurn: true,
    },
    {
      id: 'replay',
      title: 'That is the tour',
      body: 'Replay it any time from the ? button. The name at the top left opens the home page.',
      targets: ['tour', 'brand'],
      merge: true,
      tab: 'build',
    },
  ];
}
