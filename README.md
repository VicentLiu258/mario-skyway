# Mario Skyway · 马力欧云间跑酷

用 Blender 建模、Cocos Creator 3.8.8 制作的三车道 3D 跑酷试玩项目。

当前版本：**1.1.0 · 冒险升级**。新增 3 段递进关卡、4 位可选角色、下滑、连击、护盾、回复道具和通关评级。保留并验证了 1.0.1 的开局键盘焦点修复，另外修复 HTML 菜单点击被误识别为画布手势的问题。

## 这次新增

| 角色 | 特长 |
|---|---|
| 马力欧 | 均衡手感，每拾取 30 枚金币回复 1 格生命 |
| 路易吉 | 更高跳跃与更长滞空 |
| 奇诺比奥 | 更快换道，更大的金币拾取范围 |
| 瓦力欧 | 4 格生命，换道稍慢 |

四个角色均为真实 3D 模型。新角色提供独立 `.blend`、`.glb` 和游戏 glTF 资源；路易吉与瓦力欧在原角色结构上调整比例、配色与帽徽，奇诺比奥使用独立的蘑菇帽、背心和身体造型。

| 关卡 | 长度 | 核心挑战 |
|---|---|---|
| 蘑菇花园 | 400 米 | 跟随金币换道、踩栗宝宝、整排砖块跳跃 |
| 管道工厂 | 400 米 | 水管组合与低横梁下滑 |
| 熔岩城堡 | 400 米 | 火焰横杆、跳跃与下滑连续组合 |

可从任意关卡起跑。闯关模式抵达 1200 米世界终点结算（从城堡出发只需跑 400 米）；无尽模式会循环三种场景，并提高速度上限。关卡以 10 排障碍为一个节奏段，包含换道、强制动作、恢复段和金币补给区。障碍有提前提示与距离标记；下滑横梁不能靠高跳越过。

## 立即试玩

双击本目录的 **启动试玩.command**。浏览器会自动打开本机试玩地址，保持终端窗口开启即可游玩。关闭终端或按 Ctrl+C 停止服务。

如果 macOS 没有直接运行脚本，可在终端进入本目录后执行：

```sh
python3 tools/serve.py
```

默认使用 `127.0.0.1:8765`，端口占用时自动选择后续端口。只监听本机，不会对公网开放。静态游戏文件可在 `cocos/build/web-desktop` 找到；请通过 HTTP 服务访问，不要直接双击 index.html。

## 操作与玩法

| 操作 | 键盘 | 触屏 |
|---|---|---|
| 左右换道 | ← → / A D | 左右滑动或屏幕按钮 |
| 跳跃 | 空格 / ↑ / W | 上滑、轻点画面或 ↑ 按钮 |
| 下滑 | ↓ / S | 下滑手势或 ↓ 按钮 |
| 开始 / 重开 | 空格 / Enter | 开始冒险 / 再跑一次 |
| 暂停 / 继续 | P / Esc | 右上角暂停按钮 |
| 音效开关 | 右上角音符按钮 | 同左 |

- 三条跑道；砖块、水管、栗宝宝、低横梁、火焰横杆等障碍。
- 跳过障碍或换道避开。下落时踩中栗宝宝可弹起并获得 3 枚金币；在当前跑道成功跃过 / 滑过障碍额外获得 25 分。
- 下滑持续 0.85 秒，只能在地面发动；跳跃会取消下滑。起跳输入有 0.14 秒落地缓冲。
- 金币连续拾取（间隔不超过 3 秒）形成连击，第 10 枚起为 2 倍金币分，第 20 枚起为 3 倍；受击中断连击。
- 星光道具提供 6 秒无敌，蓝色护盾抵挡一次伤害，红色补给回复一格生命。道具出现在恢复段。
- 本局任务：收集 60 枚金币并完成 8 次技巧避障，奖励 500 分与 1 格生命，每局仅奖励一次。
- 通关保底 1 星；收集 60 枚金币、无伤通关各额外获得 1 星。护盾成功抵挡不计受伤。
- 总分 = 本次跑过的距离 + 金币连击分 + 技巧分 + 任务分；通关时每格剩余生命额外奖励 200 分。
- 最佳成绩按模式、起点分别保存在浏览器本地。不会与旧版 1.0 的记录混用。
- 闯关速度由 12 m/s 增长到最高 22 m/s；无尽模式从 14 m/s 起步，最高 24 m/s。后段起跑直接采用相应难度。
- 切到后台自动暂停，点击继续恢复。开始、重开、继续、选角或音效操作后无需再点画面即可使用键盘。
- 触屏按钮、真实画布手势与 HTML 菜单操作相互隔离；不再把菜单的鼠标松开误当作跳跃 / 开始。

## 模型文件

- `blender/Mario.blend`：完整可编辑源文件，包含角色、棚拍场景、灯光和相机。
- `blender/Mario.glb`：便于其他软件导入的单文件静态模型。
- `cocos/assets/resources/mario/Mario.gltf` + `Mario.bin`：Cocos 实际使用的模型。
- `blender/Luigi.blend`、`Wario.blend`、`Toad.blend`：新增角色可编辑模型，对应目录同时有 GLB。
- `blender/create_cast.py`：批量重新生成新增角色与游戏资源。
- `previews/Mario-studio.png`：1400 × 1400 棚拍预览。
- `blender/create_mario.py`：可重新生成模型的 Blender Python 脚本。

角色约 2.6 万顶点，24 个按材质与关节合并的网格。采用物件父子层级关节，包含 Body、Head、Arm_L/R、Leg_L/R。Blender 时间轴 1–25 帧带有简易跑步循环；游戏根据这些关节实时摆动手脚。该模型是刚性分件动画模型，没有蒙皮骨骼和面部表情系统。GLB/glTF 输出静态初始姿势，动画由 Blender 时间轴或游戏脚本驱动。

## 在 Cocos 中继续编辑

1. 在 Cocos Dashboard 中导入 `cocos` 文件夹，用 **Cocos Creator 3.8.8** 打开。
2. 打开 `assets/scenes/Skyway.scene`，点击预览运行。
3. `MarioRunner.ts` 负责世界、角色控制、碰撞、界面、计分、音效和循环；`RunnerRules.ts` 负责角色参数、关卡编排、速度、跳跃和碰撞规则；`BrowserKeyboard.ts` 负责浏览器按键路由。
4. 游戏场景在运行时由脚本生成。编辑器中只看到管理节点属于正常情况，预览后会生成完整场景。
5. 构建平台选择 **Web Desktop**，主场景选择 Skyway。自定义网页模板位于 `build-templates/web-desktop`。

新增角色与原角色一样使用物件关节动画，没有蒙皮骨骼。角色比例不同但障碍碰撞范围一致，避免体型造成隐性难度。

当前交付为本地浏览器试玩版。HUD 使用 HTML/CSS，声音使用 Web Audio；若发布原生 App 或微信小游戏，需要把界面和音效层移植为 Cocos 原生组件。

## 重新构建

```sh
/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator \
  --project "$PWD/cocos" \
  --build "configPath=$PWD/cocos/build-config.json"
```

Cocos 命令行成功返回码为 **36**。

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python "$PWD/blender/create_mario.py"
/Applications/Blender.app/Contents/MacOS/Blender --background --python "$PWD/blender/create_cast.py"
node tools/test-rules.cjs
node tools/test-keyboard.cjs
```

模型、场景与合成音效由本项目代码生成，不依赖外部下载素材。角色为马力欧同人练习，未使用任天堂游戏原始模型或音频。

## 技术参考

- [Cocos 官方：glTF 模型](https://docs.cocos.com/creator/3.8/manual/en/asset/model/glTF.html)
- [Cocos 官方：命令行发布](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html)

## GitHub / Vercel 发布

源码仓库：`VicentLiu258/mario-skyway`（私有）。网站目标：`https://mario.aiboomprompt.com`。

`web/` 保存已在本机用 Cocos Creator 构建的静态运行文件，Vercel 执行 `node tools/verify-web.cjs` 校验 SHA-256 清单后发布该目录。云端无需安装 Cocos 或 Blender，编辑器缓存、日志和本机配置不进入仓库。

更新流程：

1. 修改 Blender 模型或 `cocos/assets/scripts` 源码，在 Cocos Creator 3.8.8 中重新构建 Web Desktop。
2. 在仓库根目录运行 `npm ci` 和 `npm test`。
3. 运行 `npm run prepare:web`、`npm run build`，同步新的运行文件与清单。
4. 提交并推送 `main`，Vercel Git 集成自动构建并更新线上版本。

`web/` 不包含源码映射文件；可编辑源文件保存在私有 GitHub 仓库。根域名仍由 GoDaddy 管理，游戏只使用 `mario` 子域名。
