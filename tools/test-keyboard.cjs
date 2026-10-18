const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const ts = (()=>{try{return require('typescript');}catch{return require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript');}})();
const source = fs.readFileSync(path.join(__dirname, '../cocos/assets/scripts/BrowserKeyboard.ts'), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
const context = {exports: {}};
vm.runInNewContext(compiled, context);
const {BrowserKeyboard} = context.exports;

const host = new EventTarget();
const calls = [];
let blurs = 0;
const canvas = {focus(options) { page.activeElement = this; assert.equal(options.preventScroll, true); }};
const page = {hidden: false, activeElement: null, getElementById: id => id === 'GameCanvas' ? canvas : null};
const keyboard = new BrowserKeyboard(host, page, action => calls.push(action), () => blurs++);

function key(type, code, options = {}) {
    const event = new Event(type, {cancelable: true});
    Object.assign(event, {code, repeat: false, altKey: false, ctrlKey: false, metaKey: false, isComposing: false}, options);
    host.dispatchEvent(event);
    return event;
}
function tap(code) { const event = key('keydown', code); key('keyup', code); return event; }
function targetKey(code, target) {
    const event = new Event('keydown', {cancelable: true});
    Object.assign(event, {code, repeat: false});
    Object.defineProperty(event, 'target', {value: target});
    host.dispatchEvent(event);
    return event;
}

// Controls work from body/HUD focus, without the player clicking the canvas first.
assert.equal(tap('ArrowLeft').defaultPrevented, true);
tap('ArrowRight'); tap('Space');
assert.deepEqual(calls, ['left', 'right', 'jump']);

// One physical press produces one action, including before the browser marks repeats.
key('keydown', 'ArrowRight'); key('keydown', 'ArrowRight'); key('keydown', 'ArrowRight', {repeat: true});
key('keyup', 'ArrowRight'); tap('ArrowRight');
assert.deepEqual(calls.slice(3), ['right', 'right']);

// Losing focus without keyup must not leave directions or jump permanently held.
key('keydown', 'Space'); host.dispatchEvent(new Event('blur')); tap('Space');
assert.equal(blurs, 1);
assert.deepEqual(calls.slice(-2), ['jump', 'jump']);
key('keydown', 'ArrowLeft'); keyboard.reset(); tap('ArrowLeft');
assert.deepEqual(calls.slice(-2), ['left', 'left']);

// Canvas can regain focus after HUD replacement; a background page must not steal focus.
keyboard.focusCanvas(); assert.equal(page.activeElement, canvas);
page.hidden = true; page.activeElement = null; keyboard.focusCanvas(); assert.equal(page.activeElement, null);
page.hidden = false;

// Preserve browser shortcuts, text entry, IME composition and keyboard button activation.
const count = calls.length;
assert.equal(key('keydown', 'KeyA', {metaKey: true}).defaultPrevented, false);
assert.equal(key('keydown', 'ArrowLeft', {altKey: true}).defaultPrevented, false);
assert.equal(key('keydown', 'Space', {isComposing: true}).defaultPrevented, false);
const field = {closest: selector => selector.startsWith('input') ? {} : null};
assert.equal(targetKey('Space', field).defaultPrevented, false);
const button = {closest: selector => selector.startsWith('button') ? {} : null};
assert.equal(targetKey('Space', button).defaultPrevented, false);
assert.equal(targetKey('Enter', button).defaultPrevented, false);
assert.equal(calls.length, count);
tap('KeyP'); tap('Escape'); tap('Enter');
assert.deepEqual(calls.slice(-3), ['pause', 'pause', 'start']);

tap('ArrowDown'); tap('KeyS');
assert.deepEqual(calls.slice(-2), ['slide', 'slide']);

// Disposing/recreating a game must not keep old listeners or double-dispatch input.
keyboard.destroy(); const finalCount = calls.length;
assert.equal(tap('ArrowLeft').defaultPrevented, false);
host.dispatchEvent(new Event('blur'));
assert.equal(calls.length, finalCount); assert.equal(blurs, 1);
console.log('PASS: keyboard focus fallback, single dispatch, key release, lost-focus recovery, focus restoration, accessibility, cleanup.');
