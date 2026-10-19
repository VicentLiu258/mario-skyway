System.register([], function (_export, _context) {
  "use strict";

  var cc, Application;
  function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
  function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
  function _toPrimitive(input, hint) { if (_typeof(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
  return {
    setters: [],
    execute: function () {
      _export("Application", Application = /*#__PURE__*/function () {
        function Application() {
          _classCallCheck(this, Application);
          this.settingsPath = 'src/settings.json';
          this.showFPS = false;
        }
        _createClass(Application, [{
          key: "init",
          value: function init(engine) {
            cc = engine;
            /* Cloudpost Playables native filename redirects: Cocos public transformPipeline. */
            var cloudpostNativePathMap = {"assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71@2ca62.bin":"assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71-2ca62.bin","assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71@48832.bin":"assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71-48832.bin","assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71@81d61.bin":"assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71-81d61.bin","assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71@825ed.bin":"assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71-825ed.bin","assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71@8e3f9.bin":"assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71-8e3f9.bin","assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71@a65aa.bin":"assets/resources/native/0c/0c838dd2-679d-4f51-b6b5-e472f9626b71-a65aa.bin","assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c@41ac8.bin":"assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c-41ac8.bin","assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c@41e5c.bin":"assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c-41e5c.bin","assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c@597d3.bin":"assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c-597d3.bin","assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c@7544b.bin":"assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c-7544b.bin","assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c@7869b.bin":"assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c-7869b.bin","assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c@e6662.bin":"assets/resources/native/44/441a95fc-17ca-445a-9347-e3f0df8dda4c-e6662.bin","assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09@0842b.bin":"assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09-0842b.bin","assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09@181b3.bin":"assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09-181b3.bin","assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09@88b23.bin":"assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09-88b23.bin","assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09@c172e.bin":"assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09-c172e.bin","assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09@c6e33.bin":"assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09-c6e33.bin","assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09@e8415.bin":"assets/resources/native/73/73a51ef0-2c3e-475a-80b2-ef23dbbabc09-e8415.bin","assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180@2ca62.bin":"assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180-2ca62.bin","assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180@2f6d1.bin":"assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180-2f6d1.bin","assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180@8c573.bin":"assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180-8c573.bin","assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180@9883f.bin":"assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180-9883f.bin","assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180@ae664.bin":"assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180-ae664.bin","assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180@e8415.bin":"assets/resources/native/c7/c71d5649-881a-47bb-aa25-55da249d8180-e8415.bin"};
            cc.assetManager.transformPipeline.append(function (task) {
              var items = task.output = task.input;
              for (var i = 0; i < items.length; i++) {
                var item = items[i];
                if (!item || typeof item.url !== 'string') continue;
                var url = item.url;
                var query = url.search(/[?#]/);
                var path = query < 0 ? url : url.slice(0, query);
                var suffix = query < 0 ? '' : url.slice(query);
                for (var original in cloudpostNativePathMap) {
                  if (!Object.prototype.hasOwnProperty.call(cloudpostNativePathMap, original)) continue;
                  var offset = path.length - original.length;
                  if (offset < 0 || (offset > 0 && path.charAt(offset - 1) !== '/')) continue;
                  if (path.slice(offset) !== original) continue;
                  item.url = path.slice(0, offset) + cloudpostNativePathMap[original] + suffix;
                  break;
                }
              }
              return null;
            });
            if (window.cloudpostBoot) window.cloudpostBoot('Preparing the sky routes…', 45);
            cc.game.onPostBaseInitDelegate.add(this.onPostInitBase.bind(this));
            cc.game.onPostSubsystemInitDelegate.add(this.onPostSystemInit.bind(this));
          }
        }, {
          key: "onPostInitBase",
          value: function onPostInitBase() {
            // cc.settings.overrideSettings('assets', 'server', '');
            // do custom logic
          }
        }, {
          key: "onPostSystemInit",
          value: function onPostSystemInit() {
            // do custom logic
          }
        }, {
          key: "start",
          value: function start() {
            return cc.game.init({
              debugMode: false ? cc.DebugMode.INFO : cc.DebugMode.ERROR,
              settingsPath: this.settingsPath,
              overrideSettings: {
                // assets: {
                //      preloadBundles: [{ bundle: 'main', version: 'xxx' }],
                // }
                profiling: {
                  showFPS: this.showFPS
                }
              }
            }).then(function () {
              return cc.game.run();
            });
          }
        }]);
        return Application;
      }());
    }
  };
});