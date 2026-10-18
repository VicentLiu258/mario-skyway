export const LANE = 2.4;
export const JUMP_SPEED = 10.6;
export const GRAVITY = 23;
export const WORLD_LENGTH = 400;
export const FINISH_DISTANCE = WORLD_LENGTH * 3;
export const ROW_GAP = 20;
export const CHARACTERS = [
    { id: 'Mario', name: '马力欧', tag: '均衡冒险家', skill: '每收集 30 枚金币回复 1 格生命', color: '#e95043', badge: 'M', jump: 10.6, turn: 15, magnet: .8, hearts: 3, path: 'mario/Mario/Mario' },
    { id: 'Luigi', name: '路易吉', tag: '高跳专家', skill: '跳得更高，滞空更久，轻松越过水管', color: '#288c52', badge: 'L', jump: 11.8, turn: 15, magnet: .8, hearts: 3, path: 'characters/Luigi/Luigi' },
    { id: 'Toad', name: '奇诺比奥', tag: '灵巧拾币手', skill: '更快换道 · 更大的金币拾取范围', color: '#258eae', badge: '●', jump: 10.6, turn: 23, magnet: 1.5, hearts: 3, path: 'characters/Toad/Toad' },
    { id: 'Wario', name: '瓦力欧', tag: '强壮挑战者', skill: '4 格生命 · 换道稍慢，容错更高', color: '#8962ab', badge: 'W', jump: 10.6, turn: 12, magnet: .8, hearts: 4, path: 'characters/Wario/Wario' },
];
export const WORLDS = [
    { name: '蘑菇花园', english: 'GREEN GARDEN', hint: '追随金币换道，遇到整排砖块就起跳', road: '#ead7aa', grass: '#73bd68', sky: '#abdae0', accent: '#398761' },
    { name: '管道工厂', english: 'PIPE WORKS', hint: '蓝色横梁要下滑，绿色水管要跳过或绕行', road: '#acbec2', grass: '#549a97', sky: '#99c6d0', accent: '#287b93' },
    { name: '熔岩城堡', english: 'LAVA CASTLE', hint: '火焰横杆要跳跃，连续组合考验反应', road: '#776e85', grass: '#cf694a', sky: '#d9a7a0', accent: '#bd573f' },
];
export type RowPlan = { lanes: number[]; safe: number; kind: string; action: 'run'|'jump'|'slide'; bonus: boolean };
export function worldAt(distance: number, endless = false): number {
    return endless ? Math.floor(Math.max(0, distance) / WORLD_LENGTH) % 3 : Math.min(2, Math.floor(Math.max(0, distance) / WORLD_LENGTH));
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
    return overlaps(x, y, lane, z, kind === 'pipe' ? 1.65 : kind === 'fire' ? 1.05 : kind === 'crate' ? .96 : .9);
}
export function pattern(index: number, world = 0): RowPlan {
    // Authored eight-row phrases: lane reading → action → recovery → reward.
    const phrase = index % 10;
    const safe = [-1, 0, 1, 0, -1, 0, 1, 0, -1, 1][phrase];
    const bonus = phrase === 9;
    if (bonus) return { lanes: [], safe: 0, kind: 'coin', action: 'run', bonus };
    if (phrase === 3 || (world === 2 && phrase === 7))
        return { lanes: [-1, 0, 1], safe: 0, kind: world === 2 ? 'fire' : 'crate', action: 'jump', bonus };
    if (world > 0 && (phrase === 5 || (world === 2 && phrase === 1)))
        return { lanes: [-1, 0, 1], safe: 0, kind: 'gate', action: 'slide', bonus };
    const occupied = [-1, 0, 1].filter(l => l !== safe);
    return { lanes: world === 0 && phrase < 2 ? [occupied[phrase]] : occupied,
        safe, kind: phrase === 2 || phrase === 6 ? 'goomba' : world === 0 && phrase === 0 ? 'crate' : 'pipe', action: 'run', bonus };
}
export function comboMultiplier(chain: number): number { return Math.min(3, 1 + Math.floor(chain / 10)); }
