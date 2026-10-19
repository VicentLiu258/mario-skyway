# YouTube Playables 申请准备

核对日期：2026-10-19。状态：**资料草稿，未提交意向申请，未取得上架批准**。

## 当前可用材料

- 可玩演示：https://mario.aiboomprompt.com/
- 版本：1.2.0；Cocos Creator 3.8.8 / WebGL。
- 六个主题关卡、四位角色、2400 米闯关与无尽模式；键盘、触屏按钮和滑动操作。
- 英文玩法介绍、待填申请人信息和技术审查结果保存在 `application-draft.json`。这些是预备资料，并非已确认的第二页表单字段。
- `web/` 共 131 个文件，未压缩 17,625,137 字节，ZIP 估算 6,052,343 字节，最大单文件 3,133,824 字节。此估算不能替代平台测试套件的首屏传输测量。

## 提交前需要确认

官方意向表要求提交者拥有游戏及其内容的权利，并有权许可该内容。当前 README 标为马力欧同人练习，使用马力欧、路易吉、奇诺比奥、瓦力欧的角色形象与名称。授权尚未确认，不能据此填写拥有全部权利的声明。先确认发行授权，或制作原创角色、名称和主题表达的上架版本。

申请人的个人/工作室名称及联系邮箱仍待提供。不得使用从其他账号或项目推断出的联系信息，也不得虚构发行主体或授权证明。

## 正式认证前的工程工作

1. 在游戏代码前加载官方 Playables SDK，并按实际渲染和交互就绪时机通知平台。
2. 接入 SDK 的暂停、恢复和音频状态；当前网页的焦点/可见性处理不等于平台适配。
3. 在 Playables 环境用云存档替代当前本地最佳成绩存储；若上报分数，明确一种一致的最高分维度。
4. 补全英文玩法界面，目前主界面为中文及部分英文标题。
5. 为 Playables 生成专用资源包。现有 Cocos 输出有 86 个文件名包含 `@`，需要在保证引用一致的前提下适配文件名要求。
6. 完成官方测试套件及 YouTube 网页、Android、iOS 环境验证；准备最终游戏缩略图、简介和开发者资料。

当前普通网页版本不是 YouTube 认证包，不应直接把完整源码交付 ZIP 作为游戏资源包上传。

## 官方流程与入口

先提交可玩游戏的意向申请，等待筛选和联系；发布门户目前需要邀请及已接入 Playables 的频道权限。邀请后再完成资源上传、平台测试和认证。提交意向表不代表获得回复或批准。

- [项目介绍与申请入口](https://developers.google.com/youtube/gaming/playables)
- [官方意向表与权利声明](https://docs.google.com/forms/d/e/1FAIpQLSdvdQ0lgIq2369aemj1O6w8R8FwGn9O5ARRGODDDUbVINCRJQ/viewform)
- [发布门户](https://developers.google.com/youtube/gaming/playables/developer_portal)
- [集成要求](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration)
- [语言要求](https://developers.google.com/youtube/gaming/playables/certification/requirements_i18n_l10n)
- [性能、体积与文件要求](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability)

申请表中的权利确认、协议及最终提交内容须由申请人核实；此目录不包含授权结论或对审核结果的保证。
