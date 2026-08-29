# ScoreToKeys Kids

ScoreToKeys Kids 把儿童乐谱转换为可校对、可打印、可播放和可跟练的电子琴教学材料。

当前 `0.1.0` 是正式项目基础版本，由已验证的 POC 迁移而来：

- 原图与结构化乐谱并排校对；
- 音高、时值、歌词、指法和和弦编辑及锁定；
- 动态规划右手指法和可解释左手伴奏；
- 统一演奏时间线、Web Audio、键盘和双手指示；
- 使用可听音频输出时钟同步谱面与动画；
- 来源感知的 A4 页面计划、原稿版式和放大练习版式；
- 按谱行自动跟随，并允许用户手动暂停跟随；
- MIDI、MusicXML、JSON 和浏览器 PDF；
- 多模型识别契约、差异、确定性校验和 Judge 编排基础。

## 运行

```powershell
Set-Location 'C:\hannahlocal\Workspaces\scoretokeys-kids'
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:4173`。

```powershell
npm test
npm run build
npm run check
npm run preview
```

如果 npm Registry 的 TLS 握手失败，但 `unpkg.com` 可访问：

```powershell
$env:UNPKG_IGNORE_LOCK = '1'
npm run bootstrap:unpkg
Remove-Item Env:\UNPKG_IGNORE_LOCK
```

后备安装器会逐文件验证 unpkg 元数据中的 SHA-256，不会关闭 TLS 或证书校验。

## 当前识别边界

两张 `input` 测试图仍使用经过人工校对的开发 fixture。页面会明确显示 fixture 状态，不会把它们伪装成 GPT-5.5、Gemini 3.1 Pro Preview 和 GPT-5.6 Sol 的在线识别结果。

当前代码已经建立模型角色、候选 schema、独立 Reader、确定性校验、差异和 Judge 的核心契约；供应商 API、服务端密钥、任务持久化和真实图片预处理将在下一里程碑接入。未知图片目前进入人工校对模式。

`input/` 中的本地测试图片不随公开仓库分发。若要显示内置校对样例的原稿预览，请在本地自行提供对应图片；缺少图片不影响结构化乐谱、播放、跟练和导出功能。

## 文档

- [产品需求与技术方案](docs/PRODUCT_REQUIREMENTS.md)
- [开发手册](docs/ScoreToKeys-Kids-开发手册.md)
- [当前实现状态](docs/IMPLEMENTATION_STATUS.md)
