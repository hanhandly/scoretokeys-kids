# 小琴伴 (ScoreToKeys Kids)

小琴伴把儿童乐谱转换为可校对、可打印、可播放和可跟练的电子琴教学材料。

当前 `0.1.0` 是正式项目基础版本，由已验证的 POC 迁移而来：

- 原图与结构化乐谱并排校对；
- 音高、时值、歌词、指法和和弦编辑及锁定；
- 动态规划右手指法和可解释左手伴奏；
- 统一演奏时间线、Web Audio、键盘和双手指示；
- 按 `0829` 播放基线恢复：等待 `AudioContext.resume()`，提前 50 ms 统一排程，谱面、琴键和进度共用浏览器音频输出时钟；
- 排程完成不立即点亮首音：播放状态保持 `starting`，直到同一输出时钟到达计划起点；暂停、停止、跳转和从头播放同样遵守这一启动条件；
- 不添加个人或全局补偿，不运行麦克风校准、测试音预热或输出时钟稳定性等待；保留现有弱起、连音、指法、点击音符播放和从头播放功能；
- 确认校对后先校验开头小节的谱面、音频排程、动画和琴键，并准备当前音频设备，通过后才显示教学谱；
- 完整的中文/英文界面和语言切换；
- 当前访问内可切换、删除多份上传乐谱，刷新或关闭页面后自动清空；
- 来源感知的 A4 页面计划、原稿版式和放大练习版式；
- 按谱行自动跟随，并允许用户手动暂停跟随；
- MIDI、MusicXML、JSON 和浏览器 PDF；
- 多模型识别契约、差异、确定性校验和 Judge 编排基础。

## 运行

```powershell
Set-Location 'C:\hannahlocal\Workspaces\scoretokeys-kids'
npm install
Copy-Item .env.example .env
# 在 .env 中填写 OPENAI_API_KEY 和 GEMINI_API_KEY
npm run dev
```

浏览器打开 `http://127.0.0.1:4173`。

新页面会删除当前站点的旧 `v1` / `v2` / `v3` 音画校准设置，不读取或复用任何旧补偿；语言偏好和其他浏览器数据不受影响。若浏览器阻止删除，会明确提示，但旧值仍不会参与播放。旧标签页请完整刷新以释放原有播放器状态。

浏览器报告的输出时间不是最终扬声器的声学实测时间。恢复播放基线不代表已经验证所有蓝牙、远程桌面或其他设备链路的最终音画同步。

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

内置测试图使用经过人工复核的本地转录，页面不会把它们伪装成在线识别结果。

未知图片会发送到同源 Node 服务端：OpenAI 与 Gemini 使用视觉能力独立读取 1–4 张按选择顺序排列的页面。两位 Reader 的音乐内容一致时直接采用；存在差异时才由 OpenAI Judge 对照原图裁决。Judge 无法可靠裁决的事件会明确标记为 unresolved，并以低置信度进入逐音人工校对，不能被标成已确认。API 密钥只从服务端 `.env` 读取，不会进入浏览器包。模型输出仍需通过页面覆盖、点位、时值、小节占用和统一时间线校验；低于 90% 的音符必须在生成前人工确认。

未配置密钥时，`GET /api/health` 会返回 `configured: false`，上传会明确报错，不会伪造成功结果。

`input/` 中的本地测试图片不随公开仓库分发。若要显示内置校对样例的原稿预览，请在本地自行提供对应图片；缺少图片不影响结构化乐谱、播放、跟练和导出功能。

## 文档

- [产品需求与技术方案](docs/PRODUCT_REQUIREMENTS.md)
- [开发手册](docs/ScoreToKeys-Kids-开发手册.md)
- [当前实现状态](docs/IMPLEMENTATION_STATUS.md)
