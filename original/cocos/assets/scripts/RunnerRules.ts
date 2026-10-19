export const LANE = 2.4;
export const JUMP_SPEED = 10.6;
export const GRAVITY = 23;
export const WORLD_LENGTH = 400;
export const SLIDE_DURATION = .85;
export const ROW_GAP = 20;
export const CHARACTERS = [
    { id: 'Pip', name: 'Pip', tag: 'The all-round courier', skill: 'Recover one heart for every 30 stamps collected', color: '#e78d55', badge: 'P', jump: 10.6, turn: 15, magnet: .8, hearts: 3, path: 'couriers/Pip/Pip' },
    { id: 'Moss', name: 'Moss', tag: 'The high jumper', skill: 'Higher jumps and a little more time in the air', color: '#4b9b82', badge: 'M', jump: 11.8, turn: 15, magnet: .8, hearts: 3, path: 'couriers/Moss/Moss' },
    { id: 'Kite', name: 'Kite', tag: 'The quick collector', skill: 'Faster lane changes and a wider stamp pickup range', color: '#498eb5', badge: 'K', jump: 10.6, turn: 23, magnet: 1.5, hearts: 3, path: 'couriers/Kite/Kite' },
    { id: 'Rook', name: 'Rook', tag: 'The sturdy explorer', skill: 'Four hearts with a steadier, slower lane change', color: '#8a77aa', badge: 'R', jump: 10.6, turn: 12, magnet: .8, hearts: 4, path: 'couriers/Rook/Rook' },
];
export const WORLDS = [
    { name: 'Bloomway', english: 'BLOOMWAY', hint: 'Follow the stamps. Jump over the parcel walls.', road: '#ead7aa', grass: '#73bd68', sky: '#abdae0', accent: '#398761' },
    { name: 'Copperworks', english: 'COPPERWORKS', hint: 'Slide under sorting beams. Dodge the cargo stacks.', road: '#acbec2', grass: '#549a97', sky: '#99c6d0', accent: '#287b93' },
    { name: 'Ember Ridge', english: 'EMBER RIDGE', hint: 'Jump the heat vents. Read the jump-slide rhythm.', road: '#776e85', grass: '#cf694a', sky: '#d9a7a0', accent: '#bd573f' },
    { name: 'Frostpass', english: 'FROSTPASS', hint: 'Weave through ice crystals and slide under bridges.', road: '#c5e5ed', grass: '#e5f5f4', sky: '#acd2e9', accent: '#457eae' },
    { name: 'Amber Dunes', english: 'AMBER DUNES', hint: 'Dodge the cacti. Ruin beams and steps alternate.', road: '#e8c18a', grass: '#cf9b61', sky: '#f1d6b0', accent: '#ae7440' },
    { name: 'Starbridge', english: 'STARBRIDGE', hint: 'The final delivery: fast jumps, slides, and lane changes.', road: '#aaa5d1', grass: '#7775ac', sky: '#545b91', accent: '#7661ba' },
];
export const FINISH_DISTANCE = WORLD_LENGTH * WORLDS.length;
export type RowPlan = { lanes: number[]; safe: number; kind: string; action: 'run'|'jump'|'slide'; bonus: boolean };
export function worldAt(distance: number, endless = false): number {
    return endless ? Math.floor(Math.max(0, distance) / WORLD_LENGTH) % WORLDS.length : Math.min(WORLDS.length - 1, Math.floor(Math.max(0, distance) / WORLD_LENGTH));
}
export function runSpeed(distance: number, endless = false): number {
    return Math.min(endless ? 24 : 22, 12 + distance / 100 + (endless ? 2 : 0));
}
export function jumpStep(y: number, vy: number, dt: number): [number, number] {
    const next = y + vy * dt - .5 * GRAVITY * dt * dt;
    return next <= 0 ? [0, 0] : [next, vy - GRAVITY * dt];
}
export function overlaps(x: number, y: number, lane: number, z: number, height: number): boolean {
    return Math.abs(x - lane * LANE) < .78 && Math.abs(z) < .78 && y < height - .08;
}
export function hazardHit(kind: string, x: number, y: number, lane: number, z: number, sliding: boolean): boolean {
    if (kind === 'gate') return Math.abs(x - lane * LANE) < .78 && Math.abs(z) < .78 && !(sliding && y < .05);
    return overlaps(x, y, lane, z, (kind === 'cargo' || kind === 'cactus') ? 1.65 : kind === 'fire' ? 1.05 : (kind === 'crate' || kind === 'ice') ? .96 : .9);
}
export function pattern(index: number, world = 0): RowPlan {
    // Ten-row phrases retain recovery rows. Alternate phrases mirror the slalom
    // so a 400 m chapter has two distinct arrangements without blind random walls.
    const phrase = index % 10, mirror = Math.floor(index / 10) % 2 ? -1 : 1;
    const routes = [
        [-1,0,1,0,-1,0,1,0,-1,0], [1,0,-1,0,1,0,-1,0,1,0],
        [-1,0,1,0,1,0,-1,0,1,0], [1,0,-1,0,-1,0,1,0,-1,0],
        [-1,1,0,-1,0,1,0,-1,1,0], [1,0,-1,0,1,0,-1,0,1,0],
    ];
    const safe = routes[world][phrase] * mirror, bonus = phrase === 9;
    if (bonus) return { lanes: [], safe: 0, kind: 'coin', action: 'run', bonus };
    const jumps = [[3],[3],[3,7],[3,7],[2,6],[1,5]][world];
    const slides = [[],[5],[1,5],[1,5],[4,8],[3,7]][world];
    if (jumps.includes(phrase)) return { lanes: [-1,0,1], safe: 0,
        kind: world === 2 || world === 5 ? 'fire' : world === 3 ? 'ice' : 'crate', action: 'jump', bonus };
    if (slides.includes(phrase)) return { lanes: [-1,0,1], safe: 0, kind: 'gate', action: 'slide', bonus };
    const occupied = [-1,0,1].filter(l => l !== safe);
    const kind = world === 3 ? 'ice' : world === 4 ? 'cactus' : phrase === 2 || phrase === 6 ? 'drone' : world === 0 && phrase === 0 ? 'crate' : 'cargo';
    return { lanes: world === 0 && phrase < 2 ? [occupied[phrase]] : occupied, safe, kind, action: 'run', bonus };

}
export function comboMultiplier(chain: number): number { return Math.min(3, 1 + Math.floor(chain / 10)); }

// Rigid-part animation: preserve every mesh's scale; bend at hip/shoulder pivots.
export function slideBlend(current: number, sliding: boolean, dt: number): number {
    const target = sliding ? 1 : 0;
    const next = current + (target - current) * (1 - Math.exp(-dt * (sliding ? 30 : 20)));
    return Math.abs(next - target) < .001 ? target : next;
}
export function slidePose(blend: number) {
    return { body: -82 * blend, head: 8 * blend, leftLeg: -86 * blend,
        rightLeg: -78 * blend, arm: 22 * blend, spread: 14 * blend,
        bodyDrop: .50 * blend, legDrop: .48 * blend };
}
