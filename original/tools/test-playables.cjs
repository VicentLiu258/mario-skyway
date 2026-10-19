const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const ts = (() => { try { return require('typescript'); } catch { return require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript'); } })();
const file = path.join(__dirname, '../cocos/assets/scripts/PlayablesBridge.ts');
const program = ts.createProgram([file], {strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS});
const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {getCanonicalFileName: f => f, getCurrentDirectory: () => __dirname, getNewLine: () => '\n'}));
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
const context = {exports: {}};
vm.runInNewContext(compiled, context);
const {PlayablesBridge} = context.exports;
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}
function snapshot(records) {
    return JSON.stringify({schema: 'cloudpost-v1', scoreRecords: records, globalBest: Math.max(0, ...Object.values(records))});
}
function storage(raw = null) {
    return {raw, reads: 0, writes: 0, getItem(key) { assert.equal(key, 'cloudpost-v1'); this.reads++; return this.raw; }, setItem(key, value) { assert.equal(key, 'cloudpost-v1'); this.writes++; this.raw = value; }};
}
function fake(options = {}) {
    const calls = [];
    const listeners = {audio: new Set(), pause: new Set(), resume: new Set()};
    let removed = 0;
    function subscribe(kind, callback) {
        listeners[kind].add(callback);
        return () => { if (listeners[kind].delete(callback)) removed++; };
    }
    const sdk = {
        IN_PLAYABLES_ENV: true,
        game: {
            firstFrameReady() { calls.push(['firstFrame']); if (options.firstFrameError) throw Error('first frame'); },
            gameReady() { calls.push(['gameReady']); if (options.readyError) throw Error('ready'); },
            async loadData() { calls.push(['load']); return options.load ? options.load() : (options.raw || ''); },
            async saveData(raw) { calls.push(['save', JSON.parse(raw)]); if (options.save) await options.save(raw); },
        },
        engagement: {async sendScore(score) { calls.push(['score', score.value]); if (options.score) await options.score(score); }},
        system: {
            isAudioEnabled() { if (options.audioError) throw Error('audio'); return options.audio !== false; },
            onAudioEnabledChange(callback) { return subscribe('audio', callback); },
            onPause(callback) { return subscribe('pause', callback); },
            onResume(callback) { return subscribe('resume', callback); },
        },
    };
    const host = {ytgame: sdk};
    Object.defineProperty(host, 'localStorage', {get() { throw Error('Platform accessed forbidden localStorage'); }});
    return {sdk, host, calls, listeners, get removed() { return removed; }, emit(kind, value) { for (const callback of listeners[kind]) callback(value); }};
}

(async () => {
    // A normal browser persists independent route records without SDK calls.
    const local = storage(snapshot({'campaign:0': 120, 'endless:0': 700}));
    const browser = new PlayablesBridge({localStorage: local});
    await browser.initialize();
    assert.equal(browser.inPlayables, false);
    assert.equal(browser.getBest('campaign:0'), 120);
    assert.equal(browser.globalBest, 700);
    await browser.recordBest('campaign:0', 150.9);
    await browser.recordBest('campaign:3', 300);
    await browser.recordBest('endless:0', 500);
    assert.equal(browser.getBest('campaign:0'), 150);
    assert.equal(browser.getBest('campaign:3'), 300);
    assert.equal(browser.globalBest, 700);
    const restored = new PlayablesBridge({localStorage: local});
    await restored.initialize();
    assert.equal(restored.getBest('campaign:0'), 150);
    assert.equal(restored.getBest('campaign:3'), 300);
    assert.equal(local.reads, 2);
    const writes = local.writes;
    await browser.recordBest('__proto__', 100000);
    await browser.recordBest('constructor', 100000);
    await browser.recordBest('campaign:0', NaN);
    await browser.recordBest('campaign:0', -10);
    assert.equal(local.writes, writes);

    // Loading gates readiness and saving; readiness ordering is explicit and idempotent.
    const pendingLoad = deferred();
    const delayed = fake({load: () => pendingLoad.promise, audio: false});
    const audioChanges = [];
    const bridge = new PlayablesBridge(delayed.host, undefined, {audioChange: value => audioChanges.push(value)});
    bridge.gameReady();
    bridge.gameReady();
    const progressDuringLoad = bridge.recordBest('campaign:0', 90);
    await tick();
    assert.deepEqual(delayed.calls.map(c => c[0]), ['load']);
    assert.equal(bridge.audioEnabled, false);
    bridge.firstFrameReady();
    bridge.firstFrameReady();
    assert.deepEqual(delayed.calls.map(c => c[0]), ['load', 'firstFrame']);
    pendingLoad.resolve(snapshot({'campaign:0': 500, 'campaign:2': 40}));
    await progressDuringLoad;
    assert.equal(bridge.getBest('campaign:0'), 500, 'a late cloud load must win over a lower score earned during loading');
    assert.deepEqual(delayed.calls.map(c => c[0]), ['load', 'firstFrame', 'gameReady']);
    bridge.gameReady();
    assert.equal(delayed.calls.filter(c => c[0] === 'gameReady').length, 1);
    delayed.emit('audio', true);
    delayed.emit('audio', false);
    assert.deepEqual(audioChanges, [false, true, false]);
    assert.equal(bridge.audioEnabled, false);
    await bridge.recordBest('campaign:0', 600);
    await bridge.recordBest('endless:0', 900);
    assert.equal(bridge.globalBest, 900);
    assert.deepEqual(delayed.calls.filter(c => c[0] === 'score').map(c => c[1]), [600, 900]);
    for (const [i, call] of delayed.calls.entries()) {
        if (call[0] !== 'score') continue;
        const save = delayed.calls.slice(0, i).filter(c => c[0] === 'save').at(-1)[1];
        assert.equal(save.globalBest, call[1], 'YouTube score must match a successfully persisted best');
        assert.equal(save.globalBest, Math.max(...Object.values(save.scoreRecords)));
    }
    assert.equal(delayed.host.__cloudpostFirstFrameReady, true);

    // The HTML loading screen may have called firstFrameReady before Cocos starts.
    const html = fake();
    html.host.__cloudpostFirstFrameReady = true;
    const htmlBridge = new PlayablesBridge(html.host);
    await htmlBridge.initialize();
    htmlBridge.firstFrameReady();
    htmlBridge.gameReady();
    assert.deepEqual(html.calls.map(c => c[0]), ['load', 'gameReady']);
    const order = fake();
    const orderBridge = new PlayablesBridge(order.host);
    await orderBridge.initialize();
    orderBridge.gameReady();
    assert.deepEqual(order.calls.map(c => c[0]), ['load']);
    orderBridge.firstFrameReady();
    assert.deepEqual(order.calls.map(c => c[0]), ['load', 'firstFrame', 'gameReady']);

    // Platform pause freezes first, then flushes; only a corresponding resume unfreezes.
    const lifecycle = [];
    const life = fake();
    const lifeBridge = new PlayablesBridge(life.host, undefined, {
        pause() { lifecycle.push(['pause', lifeBridge.paused]); },
        resume() { lifecycle.push(['resume', lifeBridge.paused]); },
    });
    await lifeBridge.initialize();
    life.emit('resume');
    life.emit('pause');
    life.emit('pause');
    assert.equal(lifeBridge.paused, true);
    life.emit('resume');
    life.emit('resume');
    assert.deepEqual(lifecycle, [['pause', true], ['resume', false]]);
    lifeBridge.dispose();
    lifeBridge.dispose();
    assert.equal(life.removed, 3);
    life.emit('pause');
    life.emit('audio', false);
    assert.equal(lifecycle.length, 2);
    const countBeforeDispose = life.calls.length;
    await lifeBridge.recordBest('campaign:0', 900);
    lifeBridge.firstFrameReady();
    lifeBridge.gameReady();
    assert.equal(life.calls.length, countBeforeDispose);

    // Failed cloud loads and unrecognized saves never overwrite existing remote data.
    for (const options of [{load: async () => { throw Error('offline'); }}, {raw: 'bad json'}, {raw: JSON.stringify({schema: 'cloudpost-v9', scoreRecords: {foo: 999}})}]) {
        const failed = fake(options);
        const failedBridge = new PlayablesBridge(failed.host);
        await failedBridge.initialize();
        await failedBridge.recordBest('campaign:0', 500);
        await failedBridge.save();
        assert.equal(failedBridge.getBest('campaign:0'), 500);
        assert.equal(failed.calls.filter(c => c[0] === 'save' || c[0] === 'score').length, 0);
    }

    // Concurrent writes are serialized; a slow older write cannot restore stale records.
    const firstSave = deferred();
    let savesStarted = 0;
    let savesActive = 0;
    let maxActive = 0;
    let finalCloud;
    const concurrent = fake({save: async raw => {
        savesStarted++;
        savesActive++;
        maxActive = Math.max(maxActive, savesActive);
        if (savesStarted === 1) await firstSave.promise;
        finalCloud = JSON.parse(raw);
        savesActive--;
    }});
    const concurrentBridge = new PlayablesBridge(concurrent.host);
    await concurrentBridge.initialize();
    const writeOne = concurrentBridge.recordBest('campaign:0', 10);
    await tick();
    const writeTwo = concurrentBridge.recordBest('campaign:0', 30);
    const writeThree = concurrentBridge.recordBest('campaign:4', 20);
    await tick();
    assert.equal(savesStarted, 1);
    firstSave.resolve();
    await Promise.all([writeOne, writeTwo, writeThree]);
    assert.equal(maxActive, 1);
    assert.equal(finalCloud.scoreRecords['campaign:0'], 30);
    assert.equal(finalCloud.scoreRecords['campaign:4'], 20);
    assert.equal(finalCloud.globalBest, 30);
    assert.equal(concurrent.calls.filter(c => c[0] === 'score').at(-1)[1], 30);
    assert.ok(JSON.stringify(finalCloud).length * 2 < 65536);

    // A platform pause permits the final save, but defers other network work.
    const pausedWrite = deferred();
    const pauseNetwork = fake({save: () => pausedWrite.promise});
    const pauseNetworkBridge = new PlayablesBridge(pauseNetwork.host);
    await pauseNetworkBridge.initialize();
    const pauseProgress = pauseNetworkBridge.recordBest('campaign:0', 300);
    await tick();
    pauseNetwork.emit('pause');
    pausedWrite.resolve();
    await pauseProgress;
    await tick();
    assert.equal(pauseNetwork.calls.filter(c => c[0] === 'save').length, 1);
    assert.equal(pauseNetwork.calls.filter(c => c[0] === 'score').length, 0);
    pauseNetwork.emit('resume');
    await tick();
    assert.equal(pauseNetwork.calls.filter(c => c[0] === 'score').at(-1)[1], 300);

    // Save and score failures resolve safely and retry on the next flush.
    let failSave = true;
    let failScore = true;
    const retry = fake({save: async () => { if (failSave) throw Error('save offline'); }, score: async () => { if (failScore) throw Error('score offline'); }});
    const retryBridge = new PlayablesBridge(retry.host);
    await retryBridge.initialize();
    await retryBridge.recordBest('campaign:0', 200);
    assert.equal(retry.calls.filter(c => c[0] === 'score').length, 0);
    failSave = false;
    await retryBridge.save();
    failScore = false;
    await retryBridge.save();
    assert.equal(retry.calls.filter(c => c[0] === 'save').length, 2);
    assert.equal(retry.calls.filter(c => c[0] === 'score').length, 2);
    assert.equal(retry.calls.filter(c => c[0] === 'score').at(-1)[1], 200);

    // Teardown while loading prevents delayed registrations, readiness and writes.
    const late = deferred();
    const abandoned = fake({load: () => late.promise});
    const abandonedBridge = new PlayablesBridge(abandoned.host);
    abandonedBridge.gameReady();
    abandonedBridge.firstFrameReady();
    const initializing = abandonedBridge.initialize();
    await tick();
    abandonedBridge.dispose();
    late.resolve('');
    await initializing;
    assert.equal(abandoned.removed, 3);
    assert.equal(abandoned.calls.filter(c => c[0] === 'gameReady').length, 0);

    // Missing local storage, thrown mute state and callback hooks do not break startup.
    const unavailable = new PlayablesBridge({get localStorage() { throw Error('storage disabled'); }});
    await unavailable.initialize();
    await unavailable.recordBest('campaign:0', 15);
    assert.equal(unavailable.globalBest, 15);
    const muted = fake({audioError: true});
    const mutedBridge = new PlayablesBridge(muted.host, undefined, {audioChange() { throw Error('hook failed'); }, pause() { throw Error('hook failed'); }});
    await mutedBridge.initialize();
    assert.equal(mutedBridge.audioEnabled, false);
    muted.emit('pause');
    assert.equal(mutedBridge.paused, true);

    console.log('PASS: Playables strict types, readiness order, cloud-only saves, route/global scores, mute, pause/resume, serialized writes, retry safety and disposal.');
})().catch(error => { console.error(error); process.exitCode = 1; });
