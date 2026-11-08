// The numbers and names the home screen and the tour state, read from the code (D91): the site, the survey
// fleet, the player's speeds, the tab names and the Build tab's failure scenario.
import { ROUTING, SITE, UI } from '../../config/defaults';
import { PLAY } from '../../config/play';
import { SURVEY } from '../../config/survey';
import type { TourFacts } from '../../config/tour';
import { getSiteModel } from '../../state/model';
import { PLAY_MODEL, PLAY_TIMELINE } from '../../state/build';
import { TABS, type TabId } from '../../state/store';
import { speedLabel } from '../player/speed';
import { formatHours, formatInt, formatTimes, formatUsd } from '../survey/format';
import { utvKitCost } from '../survey/utvKit';
import { whyUtv } from '../survey/whyUtv';
import { PRICING } from '../../engine/pricing';
import { getSurveyPlan } from '../../state/survey';

/** The survey vehicle as the Survey tab names it (its stepper, legend and hover cards, D84). */
export const SURVEY_VEHICLE = 'UTV';

const tabLabel = (id: TabId) => TABS.find((t) => t.value === id)?.label ?? id;

let facts: TourFacts | null = null;

export function tourFacts(): TourFacts {
  if (facts) return facts;
  const { scenario, failedRadio, watchedRadio } = PLAY_TIMELINE;
  facts = {
    vehicle: SURVEY_VEHICLE,
    acres: formatInt(SITE.areaAcres),
    units: formatInt(getSiteModel().site.count),
    defaultVehicles: SURVEY.defaultVehicles,
    maxVehicles: SURVEY.maxVehicles,
    surveyHours: formatHours(getSurveyPlan(SURVEY.defaultVehicles).finishH),
    utvKitUsd: formatUsd(utvKitCost(PRICING.pricing).totalUsd),
    dogSpeedUp: formatTimes(whyUtv(PRICING.pricing).comparison.speedUp),
    slowestSpeed: speedLabel(Math.min(...UI.player.speeds)),
    fastestSpeed: speedLabel(Math.max(...UI.player.speeds)),
    normalSpeed: speedLabel(UI.player.normalSpeed),
    surveyTab: tabLabel('survey'),
    buildTab: tabLabel('build'),
    buildStages: PLAY_MODEL.stages.length,
    radios: PLAY_MODEL.radios.length,
    robot: PLAY.equipment.kinds[scenario.robot.glyph].name.toLowerCase(),
    uplink: PLAY_MODEL.radios[watchedRadio].label,
    uplinkHops: scenario.route.length - 1,
    failed: PLAY_MODEL.radios[failedRadio].label,
    missedHellos: ROUTING.missedHellosToDown,
  };
  return facts;
}
