# 1.1.0 发布记录

- 正式地址：https://mario.aiboomprompt.com
- 源码：https://github.com/VicentLiu258/mario-skyway（私有）
- 发布平台：Vercel，生产分支 `main`。
- DNS：GoDaddy，`mario` CNAME 指向 `dbfbb66ee2d0d72b.vercel-dns-017.com`。

## 验证

- Cocos Creator 3.8.8 构建成功；131 个发布文件的 SHA-256 校验通过。
- 规则测试完成 825411 项断言，包括 96 条完整模拟路线；键盘路由回归通过。
- 正式 HTTPS 页面加载 1.1.0，四位角色资源加载完成，浏览器无错误日志。
- 在线实测空格开局、左右换道、空格跳跃、P 暂停，以及工厂关卡按钮开局后的 ↓ 下滑。
- 确认奇诺比奥最终模型的帽子与面部正常显示。

## 后续维护

按 README 的流程重新构建 Cocos、同步 `web/`，再推送 `main`。提交作者应对应连接到 Vercel 的 GitHub 账号；本仓库使用 `VicentLiu258` 的 GitHub 隐私邮箱作为本地 Git 配置，不改变其他项目的全局 Git 设置。
