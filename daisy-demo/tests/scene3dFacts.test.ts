import { describe, expect, it } from 'vitest';
import { RadioBuild } from '../src/engine/playModel';
import { PLAY_GRAPH, PLAY_MODEL, PLAY_TIMELINE, simAt } from '../src/state/build';
import { sceneAt } from '../src/ui/build/scene';
import { cornerFacts, radioStatus } from '../src/ui/scene3d/cornerFacts';
import { featuredRadio } from '../src/ui/scene3d/featured';

// D121, D123, D124: the radio the pin flies to, and what the 3D view says about it and its four beams.

const yourTurn = PLAY_TIMELINE.yourTurnS + 1;
const built = sceneAt(PLAY_MODEL, PLAY_GRAPH, PLAY_TIMELINE, simAt([], yourTurn).result, yourTurn);
const featured = featuredRadio(PLAY_MODEL);
const byLabel = (label: string) => PLAY_MODEL.radios.findIndex((r) => r.label === label);

describe('the featured radio (D121)', () => {
  it('is C4-3, built in the first stage, and not the radio that fails in the walkthrough', () => {
    const r = PLAY_MODEL.radios[featured];
    expect(r.label).toBe('C4-3');
    expect(r.stage).toBe(0);
    expect(featured).not.toBe(PLAY_TIMELINE.failedRadio);
  });
});

describe('cornerFacts (D123, D124)', () => {
  it('names the module, its unit and its status as the map words it', () => {
    const f = cornerFacts(PLAY_MODEL, PLAY_GRAPH, built, featured);
    expect(f.label).toBe('C4-3');
    expect(f.unitNumber).toBe(PLAY_MODEL.radios[featured].unitId + 1);
    expect(f.status).toBe('online');
    const hops = built.network.routing.hops[featured];
    expect(f.statusLine).toBe(`Online · ${hops} ${hops === 1 ? 'hop' : 'hops'} to the base`);
  });

  it('gives four beams, both ways down the lane and the column, each to its neighbor radio', () => {
    const f = cornerFacts(PLAY_MODEL, PLAY_GRAPH, built, featured);
    expect(f.beams.map((b) => b.key)).toEqual(['+lane', '-lane', '+col', '-col']);
    expect(f.beams.map((b) => [b.title, b.detail, b.linked])).toEqual([
      ['Down the lane', 'North to C4-4, 57 m', true],
      ['Down the lane', 'South to C4-2, 57 m', true],
      ['Down the column', 'East to C5-3, 63 m', true],
      ['Down the column', 'West to C3-3, 63 m', true],
    ]);
    expect(f.beams.map((b) => b.neighbor)).toEqual(['C4-4', 'C4-2', 'C5-3', 'C3-3'].map(byLabel));
  });

  it('says where a beam runs off the section, and where a neighbor has no link', () => {
    const corner = cornerFacts(PLAY_MODEL, PLAY_GRAPH, built, byLabel('C0-0'));
    expect(corner.beams.find((b) => b.key === '-lane')?.detail).toBe('South · edge of the section');
    expect(corner.beams.find((b) => b.key === '-col')?.detail).toBe('West · edge of the section');
    expect(corner.beams.find((b) => b.key === '-col')?.neighbor).toBeNull();

    // With C4-4 failed, its link from C4-3 is down.
    const failed = new Uint8Array(built.failed);
    failed[byLabel('C4-4')] = 1;
    const links = built.network.links.filter(
      ([a, b]) => a !== byLabel('C4-4') && b !== byLabel('C4-4'),
    );
    const scene = { ...built, failed, network: { ...built.network, links } };
    const north = cornerFacts(PLAY_MODEL, PLAY_GRAPH, scene, featured).beams[0];
    expect(north.linked).toBe(false);
    expect(north.detail).toBe('North to C4-4, 57 m · no link');
  });

  it('reads a failed radio, and one waiting for power, as the hover card does', () => {
    const failed = new Uint8Array(built.failed);
    failed[featured] = 1;
    const down = { ...built, failed };
    expect(radioStatus(down, featured)).toBe('failed');
    expect(cornerFacts(PLAY_MODEL, PLAY_GRAPH, down, featured).statusLine).toBe(
      'Failed · no signal',
    );

    const radioBuild = new Uint8Array(built.radioBuild);
    radioBuild[featured] = RadioBuild.Placed;
    const waiting = { ...built, radioBuild };
    expect(radioStatus(waiting, featured)).toBe('waiting');
    expect(cornerFacts(PLAY_MODEL, PLAY_GRAPH, waiting, featured).statusLine).toBe(
      'Waiting for power · not on yet',
    );
  });
});
