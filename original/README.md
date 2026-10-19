# Cloudpost Dash · 云邮远征

An original 3D courier runner created for AIBoomPrompt. Four animal/robot couriers carry parcels across six sky routes. Switch lanes, jump, slide, collect postal stamps, and chase a high score.

Version: **1.0.0**. Public demo: [Cloudpost Dash](https://mario.aiboomprompt.com/cloudpost/).

## Original cast and routes

| Courier | Perk |
|---|---|
| Pip, the orange rabbit | One heart restored per 30 stamps |
| Moss, the green frog | Higher jumps and longer airtime |
| Kite, the blue bird | Faster lane changes and wider pickups |
| Rook, the purple robot | Four hearts and steadier lane changes |

The six routes are Bloomway, Copperworks, Ember Ridge, Frostpass, Amber Dunes and Starbridge. Each is 400 metres; a full delivery is 2,400 metres. Players can select any starting route or play an endless loop.

All four character models were newly generated from the included Blender script. The scene uses new post boxes, cargo stacks, sorting drones and postal-stamp pickups. The character meshes have no downloaded textures or third-party character assets. The Cocos runtime is third-party software; its MIT notice is included in `THIRD_PARTY_LICENSES.txt`.

## Controls

- Left/right arrows or A/D: switch lanes.
- Space, up arrow or W: jump; Space also starts a delivery.
- Down arrow or S: slide.
- P: pause/resume. Esc can also pause without preventing the browser/platform's own Esc handling.
- Touch: swipe in four directions, tap to jump, or use the screen buttons.

## Editable files

- `blender/create_couriers.py`: reproducible original model generation.
- `blender/Pip.blend`, `Moss.blend`, `Kite.blend`, `Rook.blend`: editable models.
- `blender/Cloudpost_Cast.blend`: character presentation scene.
- `cocos/assets/scripts/CloudpostRunner.ts`: game and UI.
- `cocos/assets/scripts/RunnerRules.ts`: routes, abilities and collision rules.
- `cocos/assets/scripts/PlayablesBridge.ts`: platform lifecycle and save integration.
- `previews/`: rendered standing and sliding character previews.

The named Body/Head/arm/leg pivots animate rigid parts. Sliding preserves mesh proportions and moves/rotates the joints; the models are not skinned skeletons.

## Build, test and package

Open `cocos/` in Cocos Creator 3.8.8, or run:

```sh
/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project "$PWD/cocos" --build "configPath=$PWD/cocos/build-config.json"
```

Creator returns exit code 36 on successful builds.

```sh
npm ci
npm test
python3 tools/prepare_web.py
node tools/verify-web.cjs
python3 tools/package_playables.py
python3 tools/test_bundle.py
python3 tools/serve_playables.py
```

`web/` is the ordinary Cocos output for reproducible packaging. The packager creates `dist/playables/` and `dist/cloudpost-dash-playables.zip`. It renames only actual native asset files with unsupported characters and maps their final request URLs through Cocos' public transform pipeline; asset UUIDs remain unchanged.

The ZIP has `index.html` at its root and contains only runtime assets and the runtime license notice. Source maps, Blender sources and application contact details are excluded. The source-delivery ZIP is a different artifact and must not be uploaded as the Playables runtime.

The parent project's publish script deploys the exact Playables candidate at `/cloudpost/` alongside the previous browser prototype.

## YouTube integration and validation status

- Official SDK loads before game code. The loading screen acknowledges the first frame; the enabled main menu acknowledges game readiness.
- YouTube audio state controls audio output; SDK pause/resume freezes/releases the Cocos director and preserves a separate manual pause.
- In Playables, progress uses SDK cloud saves exclusively. Load failure prevents overwriting cloud data; writes are serialized. One global high-score dimension matches the stored maximum of the route records.
- In an ordinary browser, scores use a separate local `cloudpost-v1` save. The fully usable UI is English.
- Local checks passed: 192 full route simulations, real four-character sliding geometry, keyboard routing, SDK failure/mute/pause/save tests, legal bundle paths, size limits, and a real 400 m Starbridge run under the documented CSP (Moss: 71 stamps, 8 skill dodges, no hits, 3 stars).

These checks are **not YouTube certification**. The official test-suite page did not expose a runnable test interface in this session. Actual YouTube web/app ingestion, Android and iOS testing, licensing/onboarding and certification remain subject to portal access and the platform review.

The public interest form is an initial consideration request, not an approval. An existing application is being prepared for an appended Cloudpost Dash entry; final submission requires the applicant's confirmation of the exact content and licensing authority. No review outcome or response date is guaranteed.
