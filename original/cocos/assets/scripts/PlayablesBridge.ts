/** YouTube Playables integration, kept independent of Cocos for lifecycle testing. */
export interface PlayablesStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export interface YouTubePlayablesSdk {
    readonly IN_PLAYABLES_ENV: boolean;
    game: {
        firstFrameReady(): void;
        gameReady(): void;
        loadData(): Promise<string>;
        saveData(data: string): Promise<void>;
    };
    engagement: { sendScore(score: {value: number}): Promise<void> };
    system: {
        isAudioEnabled(): boolean;
        onAudioEnabledChange(callback: (enabled: boolean) => void): () => void;
        onPause(callback: () => void): () => void;
        onResume(callback: () => void): () => void;
    };
}

export interface PlayablesHooks {
    /** Freeze the director, input and audio; retain the player's own pause state. */
    pause?(): void;
    /** Release only the platform pause. Do not clear a player-selected pause. */
    resume?(): void;
    audioChange?(enabled: boolean): void;
}

interface PlayablesHost {
    ytgame?: YouTubePlayablesSdk;
    localStorage?: PlayablesStorage;
    /** The HTML loading screen may already have acknowledged the first frame. */
    __cloudpostFirstFrameReady?: boolean;
}

interface SaveData {
    schema: 'cloudpost-v1';
    scoreRecords: Record<string, number>;
    globalBest: number;
}

const SAVE_KEY = 'cloudpost-v1';
const MAX_RECORDS = 128;
const MAX_SAVE_BYTES = 64 * 1024;

export class PlayablesBridge {
    private readonly host: PlayablesHost;
    private readonly hooks: PlayablesHooks;
    private storage?: PlayablesStorage;
    private sdk?: YouTubePlayablesSdk;
    private initialization?: Promise<void>;
    private initialized = false;
    private disposed = false;
    private platform = false;
    private platformPaused = false;
    private audio = true;
    private canSave = false;
    private firstFrameSent = false;
    private gameReadyRequested = false;
    private gameReadySent = false;
    private records: Record<string, number> = Object.create(null) as Record<string, number>;
    private best = 0;
    private revision = 0;
    private persistedRevision = 0;
    private persistedBest = 0;
    private lastSentScore = 0;
    private saveQueue: Promise<void> = Promise.resolve();
    private unregister: Array<() => void> = [];

    constructor(host: object | null, localStorage?: PlayablesStorage, hooks: PlayablesHooks = {}) {
        this.host = (host || {}) as PlayablesHost;
        this.storage = localStorage;
        this.hooks = hooks;
        this.detectEnvironment();
    }

    get inPlayables(): boolean { return this.platform; }
    get paused(): boolean { return this.platformPaused; }
    get audioEnabled(): boolean { return this.audio; }
    /** Matches the single score dimension submitted to YouTube. */
    get globalBest(): number { return this.best; }

    initialize(): Promise<void> {
        if (this.disposed) return Promise.resolve();
        if (!this.initialization) {
            // Install the shared promise before registrations can synchronously fire.
            this.initialization = Promise.resolve().then(() => this.load()).catch(() => {
                this.canSave = false;
                this.initialized = true;
                this.notifyGameReady();
            });
        }
        return this.initialization;
    }

    /** Call only once a visible loading frame or game frame has been drawn. */
    firstFrameReady(): void {
        if (this.disposed || this.firstFrameSent) return;
        if (!this.initialization) this.detectEnvironment();
        if (!this.platform || !this.sdk) return;
        if (this.host.__cloudpostFirstFrameReady === true) {
            this.firstFrameSent = true;
        } else {
            try {
                this.sdk.game.firstFrameReady();
                this.firstFrameSent = true;
                this.host.__cloudpostFirstFrameReady = true;
            } catch { return; }
        }
        this.notifyGameReady();
    }

    /** Call after removing the loading screen and enabling the main menu. */
    gameReady(): void {
        if (this.disposed) return;
        this.gameReadyRequested = true;
        void this.initialize();
        this.notifyGameReady();
    }

    getBest(key: string): number { return this.records[key] || 0; }

    async recordBest(key: string, score: number): Promise<void> {
        if (this.disposed || !this.validKey(key) || !Number.isFinite(score) || score < 0) return;
        await this.initialize();
        if (this.disposed) return;
        const value = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(score));
        if (value <= this.getBest(key)) return;
        if (!Object.prototype.hasOwnProperty.call(this.records, key) && Object.keys(this.records).length >= MAX_RECORDS) return;
        this.records[key] = value;
        this.best = Math.max(this.best, value);
        this.revision++;
        await this.save();
    }

    /** Serializes writes; an older request can never complete after a newer write. */
    async save(): Promise<void> {
        await this.initialize();
        if (this.disposed || !this.canSave) return;
        this.saveQueue = this.saveQueue.then(() => this.persist()).catch(() => {
            // SDK/storage failures must not terminate a game or reject event callbacks.
        });
        await this.saveQueue;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        for (const unsubscribe of this.unregister.splice(0)) {
            try { unsubscribe(); } catch { /* Cleanup is best effort. */ }
        }
    }

    private detectEnvironment(): void {
        try {
            this.sdk = this.host.ytgame;
            this.platform = this.sdk?.IN_PLAYABLES_ENV === true;
        } catch {
            this.sdk = undefined;
            this.platform = false;
        }
        // Fail silent while the platform's initial mute state has not been read.
        if (this.platform) this.audio = false;
    }

    private async load(): Promise<void> {
        this.detectEnvironment();
        if (this.platform && this.sdk) {
            const sdk = this.sdk;
            try { this.audio = sdk.system.isAudioEnabled() === true; } catch { this.audio = false; }
            this.emitAudio();
            this.subscribe(() => sdk.system.onAudioEnabledChange(enabled => {
                if (this.disposed) return;
                this.audio = enabled === true;
                this.emitAudio();
            }));
            this.subscribe(() => sdk.system.onPause(() => {
                if (this.disposed || this.platformPaused) return;
                this.platformPaused = true;
                this.callHook(() => this.hooks.pause?.());
                // The platform provides a short final flush window on exit.
                void this.save();
            }));
            this.subscribe(() => sdk.system.onResume(() => {
                if (this.disposed || !this.platformPaused) return;
                this.platformPaused = false;
                this.callHook(() => this.hooks.resume?.());
                // Retry score delivery deferred during the platform's pause window.
                void this.save();
            }));
            try {
                const raw = await sdk.game.loadData();
                if (!this.disposed) this.canSave = this.restore(raw);
            } catch {
                // Never replace a cloud save when its load failed. In-memory play is safe.
                this.canSave = false;
            }
        } else {
            try {
                // Do not even access host.localStorage in the Playables environment.
                this.storage = this.storage || this.host.localStorage;
                this.canSave = this.restore(this.storage?.getItem(SAVE_KEY) || '');
            } catch {
                this.canSave = false;
            }
        }
        if (this.disposed) return;
        this.initialized = true;
        this.firstFrameSent = this.firstFrameSent || this.host.__cloudpostFirstFrameReady === true;
        this.notifyGameReady();
    }

    private restore(raw: string): boolean {
        if (!raw) return true;
        try {
            const data: unknown = JSON.parse(raw);
            if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
            const saved = data as Partial<SaveData>;
            if (saved.schema !== SAVE_KEY || !saved.scoreRecords || typeof saved.scoreRecords !== 'object' || Array.isArray(saved.scoreRecords)) return false;
            for (const key of Object.keys(saved.scoreRecords)) {
                const value = saved.scoreRecords[key];
                if (!this.validKey(key) || !Number.isSafeInteger(value) || value < 0) continue;
                if (Object.keys(this.records).length >= MAX_RECORDS) break;
                this.records[key] = value;
                this.best = Math.max(this.best, value);
            }
            // Derive rather than trust globalBest so saved/UI/submitted records agree.
            this.persistedBest = this.best;
            return true;
        } catch {
            // Preserve malformed or newer cloud data instead of silently erasing it.
            return false;
        }
    }

    private async persist(): Promise<void> {
        if (this.disposed || !this.canSave) return;
        if (this.revision !== this.persistedRevision) {
            const revision = this.revision;
            const best = this.best;
            const data: SaveData = {schema: SAVE_KEY, scoreRecords: {...this.records}, globalBest: best};
            const raw = JSON.stringify(data);
            // UTF-16 length is a conservative byte bound for this ASCII-only payload.
            if (raw.length * 2 > MAX_SAVE_BYTES) return;
            if (this.platform && this.sdk) await this.sdk.game.saveData(raw);
            else if (this.storage) this.storage.setItem(SAVE_KEY, raw);
            else return;
            this.persistedRevision = revision;
            this.persistedBest = best;
        }
        if (!this.disposed && !this.platformPaused && this.platform && this.sdk && this.persistedBest > this.lastSentScore) {
            const score = this.persistedBest;
            await this.sdk.engagement.sendScore({value: score});
            this.lastSentScore = score;
        }
    }

    private notifyGameReady(): void {
        if (this.disposed || !this.initialized || !this.firstFrameSent || !this.gameReadyRequested || this.gameReadySent || !this.platform || !this.sdk) return;
        try {
            this.sdk.game.gameReady();
            this.gameReadySent = true;
        } catch { /* A later explicit readiness notification may retry. */ }
    }

    private subscribe(register: () => () => void): void {
        try {
            const unsubscribe = register();
            if (typeof unsubscribe === 'function') this.unregister.push(unsubscribe);
        } catch { /* A failed optional SDK callback must not stop startup. */ }
    }

    private emitAudio(): void { this.callHook(() => this.hooks.audioChange?.(this.audio)); }
    private callHook(callback: () => void): void { try { callback(); } catch { /* Keep SDK callbacks safe. */ } }
    private validKey(key: string): boolean {
        return typeof key === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,95}$/.test(key) && key !== 'constructor' && key !== 'prototype';
    }
}
