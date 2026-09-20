# 小琴伴 (ScoreToKeys Kids) 开发手册

> 文档版本：0.1  
> 更新日期：2026-08-19  
> 适用范围：`C:\hannahlocal\Workspaces\scoretokeys-kids` 正式项目  
> 状态：初稿；描述当前正式项目基础，并给出多模型识别和 A4 教学谱的后续开发约束。

## 1. 文档关系

产品需求和验收标准以以下文件为准：

```text
C:\Users\luden\OneDrive - Microsoft\MySharedWorkspaces\Temp\
  儿童电子琴学习工具-需求与技术方案.md
```

仓库文档分工：

- `README.md`：最短运行说明、当前实现边界和依赖安装方法；
- 本手册：架构、数据契约、模型编排、开发流程和质量门禁；
- `src/core/poc.test.ts`：当前可执行的领域规则和导出回归；
- 需求文档：产品范围、优先级和最终验收标准。

若文档发生冲突，按“需求文档 → 本手册 → README → 代码注释”的顺序处理，并在同一次变更中修正文档差异。

## 2. 当前实现与目标系统

必须明确区分已经实现的能力和目标能力，不能把 fixture 或人工处理描述成在线模型服务。

| 领域 | 当前实现 | 正式 MVP 目标 |
|---|---|---|
| 图片识别 | 两张测试图对应 `src/data/samples.ts` 中的开发期 fixture | GPT-5.5 与 Gemini 独立识别、GPT-5.6 Sol 裁决、程序校验和人工兜底 |
| 未知图片 | 进入空白手动校对模式 | 经过预处理、多尺度裁剪和多模型流水线 |
| 置信度 | fixture 字段，用于演示低置信度工作流 | 基于模型一致度、视觉证据、规则和确认来源计算 |
| 乐谱布局 | 已建立来源感知 A4 页面计划，测试曲按原谱行分组 | 完整 SVG 排版约束、视觉回归和稳定 PDF/PNG |
| 播放跟随 | 已按谱行自动跟随，并允许用户暂停跟随 | 跨页预滚动、可访问性和完整浏览器回归 |
| 音频 | Web Audio 合成器 | 可替换 SoundFont；继续使用统一时间线和可听输出时钟 |
| 导出 | MIDI、MusicXML、JSON、浏览器打印 PDF | 增加稳定 A4 PDF/PNG、WAV/MP3 和 MP4 |
| 数据存储 | React 内存状态 | 版本化项目、识别证据、人工修改和审计记录 |

当前正式项目由已验证的 POC 迁移而来，已经具备以下闭环：

```text
原图校对
→ 标准乐曲模型
→ 指法与左手伴奏
→ 统一事件时间线
→ 乐谱、音频、键盘动画和导出
```

## 3. 环境与运行

### 3.1 前置条件

- Windows；
- Node.js `20.19+`，当前开发环境验证版本为 Node `24.19.0`；
- npm；
- Chrome 或 Chromium 内核浏览器；
- 项目目录：`C:\hannahlocal\Workspaces\scoretokeys-kids`。

### 3.2 安装

```powershell
Set-Location 'C:\hannahlocal\Workspaces\scoretokeys-kids'
npm install
```

如果访问 npm Registry 时发生 TLS 握手失败，但 `unpkg.com` 可访问：

```powershell
npm run bootstrap:unpkg
```

`scripts/install-from-unpkg.mjs` 会：

- 使用固定的直接依赖版本解析传递依赖；
- 按 unpkg 元数据逐文件下载；
- 校验每个文件的 SHA-256；
- 创建 `node_modules\.bin` 启动包装；
- 把解析结果写入 `unpkg-lock.json`；
- 保留 TLS 和证书校验。

该脚本是网络故障后备方案，不是通用 npm 替代品。修改 `package.json` 后必须重新生成并审查 `unpkg-lock.json`。

### 3.3 常用命令

```powershell
npm run dev
npm test
npm run build
npm run preview
```

- 开发和预览地址均为 `http://127.0.0.1:4173`；
- `npm test` 使用 esbuild 把 TypeScript 测试打包到系统临时目录，再调用 `node:test`；
- `npm run build` 依次执行 TypeScript 构建检查和 Vite 生产构建；
- `dist` 是生成物，不应手动编辑。

## 4. 项目结构

```text
scoretokeys-kids\
├─ input\                         测试输入；被 Vite 作为 publicDir
├─ docs\
│  ├─ ScoreToKeys-Kids-开发手册.md
│  └─ IMPLEMENTATION_STATUS.md
├─ scripts\
│  ├─ install-from-unpkg.mjs     依赖后备安装器
│  └─ run-tests.mjs              TypeScript 测试入口
├─ src\
│  ├─ App.tsx                    页面状态、流程编排、播放和导出入口
│  ├─ types.ts                   当前领域类型
│  ├─ data\
│  │  └─ samples.ts              两张测试谱的可追溯 fixture
│  ├─ components\
│  │  ├─ SourceReview.tsx        原图对照、校对和确认
│  │  ├─ ArrangementPanel.tsx    指法、和弦和伴奏模式
│  │  ├─ JianpuScore.tsx         彩色数字简谱
│  │  └─ PianoKeyboard.tsx       键盘及左右手指示
│  ├─ core\
│  │  ├─ model.ts                小节跨度、布局分组和基础校验
│  │  ├─ theory.ts               音名、MIDI、简谱及和弦理论
│  │  ├─ arrangement.ts          指法、和声及左手时间线
│  │  ├─ audio.ts                Web Audio 调度与可听输出时钟
│  │  ├─ exporters.ts            MIDI、MusicXML 和 JSON 导出
│  │  └─ poc.test.ts             当前领域回归测试
│  ├─ recognition\                多模型契约、差异、校验与编排
│  ├─ layout\                     A4 布局计划、来源谱行和测试
│  ├─ hooks\
│  │  └─ usePracticePlayer.ts    播放、暂停、跳转、循环和视觉位置
│  ├─ main.tsx
│  └─ styles.css
├─ package.json
├─ unpkg-lock.json
└─ vite.config.ts
```

## 5. 当前前端数据流

```text
SAMPLE_SONGS / 用户编辑
        ↓
SongModel
        ├─ harmonize()
        ├─ recommendFingering()
        └─ buildPerformanceTimeline()
                    ↓
            PerformanceEvent[]
        ┌───────────┼──────────────┐
        ↓           ↓              ↓
 JianpuScore    PianoSynth     Exporters
        ↓           ↓              ↓
 谱面高亮      Web Audio      MIDI/XML/JSON
        └───────────┴──────────────┘
             usePracticePlayer
```

关键约束：

- `SongModel` 是音乐语义的唯一来源；
- `PerformanceEvent[]` 是声音、键盘、手指和播放位置的唯一演奏时间线；
- 导出器不得重新推断旋律或和弦；
- UI 编辑必须先更新领域模型，再重新生成派生数据；
- 人工锁定的指法和和弦不能被重新计算覆盖；
- 休止符不进入可发声事件，但必须保留在乐谱模型和导出中。

## 6. 目标总体架构

正式系统需要把浏览器、模型编排和确定性音乐核心分开：

```text
浏览器
  上传、校对、编配、练习、A4 展示
                  │
                  ▼
应用后端
  文件存储、任务状态、权限、审计、版本
                  │
                  ▼
识别编排服务
  图像预处理与布局分析
       ├─ Reader A：GPT-5.5
       └─ Reader B：Gemini 3.1 Pro Preview
                  │
          标准化、差异和规则校验
                  │
       Judge C：GPT-5.6 Sol（仅分歧）
                  │
          人工确认或显式 unresolved
                  ▼
确定性音乐核心
  标准乐曲模型、指法、和声、时间线、导出
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
   A4 SVG/PDF   音频/MIDI   动画/MP4
```

浏览器不能保存供应商 API Key。模型调用、重试、回退、缓存和审计均位于服务端。

## 7. 数据模型与契约

### 7.1 当前领域模型

`src/types.ts` 中的核心对象包括：

- `SongModel`；
- `MeasureModel`；
- `ScoreEvent`；
- `ChordAssignment`；
- `PerformanceEvent`；
- `MeasureSpan`；
- `ValidationIssue`。

当前以 MIDI 整数表示绝对音高，以 `durationBeats` 表示时值。正式模型还应保存记谱拼写，例如 B♭ 与 A♯，避免只保存 MIDI 后丢失来源写法。

### 7.2 目标识别证据模型

以下接口用于说明字段边界，不代表已经实现：

```ts
type VerificationStatus =
  | "reader-agreed"
  | "judge-confirmed"
  | "manual-confirmed"
  | "unresolved";

interface SourceRegion {
  page: number;
  systemId: string;
  measureId: string;
  bbox: { x: number; y: number; width: number; height: number };
  imageHash: string;
  cropHash: string;
}

interface CandidateEvent {
  candidateId: string;
  sourceEventId: string;
  midi: number | null;
  pitchSpelling?: string;
  offsetBeats: number;
  durationBeats: number;
  lyric?: string;
  evidence: string[];
  sourceRegion: SourceRegion;
}

interface RecognitionDecision {
  readerA: CandidateEvent | null;
  readerB: CandidateEvent | null;
  ruleIssues: string[];
  judgeChoice?: "reader-a" | "reader-b" | "new-candidate";
  status: VerificationStatus;
  confirmedEvent?: CandidateEvent;
}
```

要求：

- Reader 的原始响应不可覆盖；
- 标准化候选与原始候选分开保存；
- `confirmedEvent` 只有在规则允许并产生明确确认来源后才能存在；
- `unresolved` 不能被转换成空小节、默认音符或成功状态；
- 人工修改生成新版本，不能改写历史证据。

### 7.3 目标布局模型

```ts
interface LayoutPlan {
  pageSize: "A4";
  mode: "source-faithful" | "practice";
  pages: LayoutPage[];
}

interface LayoutPage {
  pageNumber: number;
  systems: LayoutSystem[];
}

interface LayoutSystem {
  id: string;
  sourceRegion?: SourceRegion;
  measureIds: string[];
  lyricLines: string[];
  widthWeights: number[];
  preferredBreakAfter: boolean;
}
```

布局对象只描述页面结构，不复制音乐事件。音符通过稳定 ID 关联到 `SongModel`。

### 7.4 单位和稳定性

- 音高：MIDI 整数加记谱拼写；
- 时间：输入阶段尽量使用整数 ticks 或有理数，UI 可转换为 beat 小数；
- 坐标：同时保存原图像素和 `0–1` 归一化坐标；
- 页面：A4 使用毫米或统一 SVG `viewBox`；
- ID：导入后稳定，重新排版不能改变事件 ID；
- schema：每份持久化数据必须包含 `schemaVersion`。

## 8. 多模型识别协议

### 8.1 角色与设置

| 角色 | 模型 | 目标配置 |
|---|---|---|
| Reader A | GPT-5.5 | `long_context`、`xhigh` reasoning |
| Reader B | Gemini 3.1 Pro Preview | `long_context`、最高可用 thinking |
| Reader B 成本回退 | Gemini 3.7 Flash | 平台支持的最高稳定设置 |
| Judge C | GPT-5.6 Sol | `long_context`、`max` reasoning |
| 校验/导出实现者 | GPT-5.3 Codex | `xhigh` reasoning |
| 独立代码复核 | MAI-Code-1.1-Flash | 最高可用设置 |

配置原则：

- 能力探测后再设置，不向不支持的模型传递无效参数；
- 记录实际生效配置，不能只记录期望配置；
- 最大上下文是容量上限，请求仍应保持聚焦；
- Preview 模型升级后必须重跑金标；
- 模型不可用时显式使用配置过的回退，不能静默降为单模型。

### 8.2 Reader 输入

两个 Reader 获得相同类型的输入，但请求相互独立：

1. 原始整页图片或 PDF 页面；
2. 去倾斜、裁边和增强后的页面；
3. 当前谱行高清裁剪；
4. 当前小节高清裁剪；
5. 调号、拍号等仅来自可见页面的上下文；
6. 严格 JSON Schema；
7. “忠实转录、不得按熟悉旋律修正”的指令。

Reader B 不能看到 Reader A 的输出、解释、置信度或错误。

### 8.3 Reader 输出

每个符号至少输出：

- 事件顺序和小节；
- 谱号、调号、拍号；
- 音高、八度、时值、附点、连音和休止；
- 歌词及其对应音符；
- 图像区域和可见依据；
- `unknown` 或候选集合；
- 页面、谱行和小节覆盖统计。

禁止：

- 为缺失字段填入听起来合理的默认值；
- 把音乐合理性当成图像证据；
- 遗漏无法识别的小节却返回完整成功；
- 只返回一个不可追溯的总置信度。

### 8.4 标准化和差异

Reader 输出先经过确定性标准化：

- 统一 beat、tick 和时值单位；
- 保留等音拼写，同时用 MIDI 比较绝对音高；
- 统一弱起和小节编号；
- 区分延音、重复音和休止；
- 对歌词做 Unicode 和空白标准化，但保留原始文本；
- 把坐标转换到相同页面空间。

差异至少分为：

- 漏事件或多事件；
- 音级分歧；
- 八度分歧；
- 时值或起点分歧；
- 休止、附点、连音和临时记号分歧；
- 歌词文本或对齐分歧；
- 小节、谱行或页面覆盖分歧；
- 来源版式分歧。

八度、小节覆盖和末尾休止属于高风险，即使两个 Reader 一致，也可以由规则强制复核。

### 8.5 Judge

Judge 只接收差异小节及必要上下文：

- 原始谱行和小节裁剪；
- Reader A、Reader B 的标准化结果和原始证据；
- 确定性规则报告；
- 前后各一个小节，但不能提供网络旋律作为默认答案。

Judge 必须返回选择、依据坐标和是否仍需人工确认。它不能用第三个猜测掩盖无法辨认的图像。

### 8.6 确认门禁

```text
A/B 一致 + 确定性规则通过
    → reader-agreed

A/B 分歧或高风险
    → Judge

Judge 有充分图像依据 + 规则通过
    → judge-confirmed

其余情况
    → unresolved → 人工确认
```

模型数量不是正确性的证明。任何无法解释的成功结果都应视为失败。

## 9. 确定性校验

### 9.1 音乐结构

- 每小节占用时值与拍号一致；
- 弱起、变拍和末尾休止显式表示；
- 音符起点、终点不越过小节；
- MIDI 音高在目标键盘或标准钢琴范围内；
- 谱号、调号、临时记号和记谱拼写一致；
- 简谱上下点、五线位置与八度相符；
- 连音、附点和延音不能丢失；
- 歌词音节与发音事件对齐；
- 整页每个谱行和小节均被覆盖。

### 9.2 风险提示

以下检查只能生成警告，不能自动改谱：

- 重复乐句不一致；
- 异常大跳；
- 调式外音；
- 和弦不匹配；
- 与授权参考谱或已知旋律不同。

产品必须同时显示“原图读谱”和“参考版本差异”，由用户选择。

### 9.3 编配

- 根音加五度模式必须使用和弦真实根音和纯五度，不能从转位数组按位置猜测；
- 和弦转位必须保持和弦音集合；
- 伴奏不能越过显式尾部休止；
- 乐句结束需要可解释的终止处理；
- 锁定和弦和指法不能被重算覆盖；
- 每个伴奏事件必须关联来源和弦及小节。

### 9.4 导出往返

正式实现需要为 MusicXML、MIDI 和 JSON 建立语义摘要：

```text
eventId
start
duration
pitch
hand
voice
finger
measure
chord
```

导出后重新解析并比较摘要。允许格式层差异，不允许音乐语义差异。

## 10. 校对工作流

推荐状态机：

```text
uploaded
→ preprocessing
→ recognizing
→ comparing
→ requires_review
→ confirmed
→ arranged
→ playable
→ exported
```

错误状态必须包含阶段、可重试性和原因。`requires_review` 之前不能编配、播放或导出。

校对界面至少提供：

- 原图整页、谱行和小节联动定位；
- A/B/Judge 差异热区；
- 按八度、音高、时值、歌词、休止和覆盖问题筛选；
- 采用 A、采用 B、采用 Judge 或人工录入；
- 原始候选和裁决依据；
- 已确认事件锁定；
- 撤销、重做和版本历史。

用户确认是领域事件，必须写入确认人、时间、前后值和来源，而不是只改变 React 临时状态。

## 11. A4 教学谱

### 11.1 布局原则

- 输出为重新生成的 SVG，不把输入图片当成最终谱面；
- 页面为 A4，打印尺寸 `210 mm × 297 mm`；
- 来源谱行、小节分组和歌词断行是优先软约束；
- 内容完整、可读、无重叠是硬约束；
- 固定“每行四小节”只作为没有来源布局时的回退；
- 空间不足时增加页面，不通过极端缩放解决；
- 歌词、指法、和弦和左手提示分别占用明确轨道。

### 11.2 两种模式

**原稿版式模式**

- 尽量保持原始谱行数量；
- 保持小节所属谱行；
- 保持歌词行和段落；
- 允许为教学标记做有限垂直扩展。

**放大练习模式**

- 提高音符、指法和歌词尺寸；
- 可以增加谱行和页面；
- 只在小节边界换行；
- 避免拆开短乐句和歌词词组。

### 11.3 布局算法

建议流程：

1. 从来源分析生成 `LayoutPlan`；
2. 测量标题、元数据、谱行、歌词和教学轨道；
3. 按来源行分配小节宽度权重；
4. 检测单个小节和整行的最小可读宽度；
5. 必要时在合法小节边界重排或增加页面；
6. 运行溢出、遮挡、歌词截断和页面边界检查；
7. 为每个事件输出 SVG 元素 ID 和位置。

布局函数应尽量纯净、确定，并支持相同输入产生相同输出。

### 11.4 自动跟随

播放层维护：

```text
eventId → measureId → systemId → pageId → element
```

规则：

- 每帧只更新高亮，不每帧滚动；
- 当前事件进入谱行末段或即将跨行时预滚动；
- 当前谱行停在视口上方约三分之一；
- 手动滚动、缩放、点击谱面时暂停跟随；
- 显示“继续跟随”按钮；
- seek、loop 和恢复播放后定位到当前事件；
- 打印模式禁用所有滚动；
- `prefers-reduced-motion` 下缩短或取消平滑动画。

## 12. 指法、和声与伴奏

`src/core/arrangement.ts` 当前使用动态规划推荐右手指法，并根据调内和弦、旋律匹配及前后连接选择和声。

开发规则：

- 算法必须确定、可测试；
- 模型可以提出建议和解释，不能直接替代核心算法；
- 儿童手型、成人手型和难度参数应进入成本函数；
- 锁定事件是硬约束；
- 伴奏模式共享同一和弦定义；
- 单音和根音加五度从和弦根音音级计算，不依赖转位数组顺序；
- 所有模式都要尊重尾部休止；
- 重新编配后必须重新生成时间线和所有派生导出。

## 13. 统一时间线与音频

### 13.1 时间线

`PerformanceEvent` 是演奏事实，包含：

- `startBeat`；
- `durationBeats`；
- `midi`；
- `hand`；
- `finger`；
- `voice`；
- `velocity`；
- `measureNumber`；
- 可选 `chord` 和来源事件 ID。

谱面、播放器、键盘、手部和导出只能消费这条时间线。

### 13.2 Web Audio 时钟

`src/core/audio.ts` 预调度音符，并返回基于音频输出的播放位置。优先使用 `AudioContext.getOutputTimestamp()`；不可用时使用 `outputLatency` 或 `baseLatency` 从 `currentTime` 回推可听位置。

不得恢复为独立的 `performance.now()` 动画时钟。后者会忽略声卡和蓝牙延迟，并在后台标签页或系统繁忙时漂移。

2026-09-20 按用户指定的 `0829` 播放链恢复：`PianoSynth.prepare()` 只恢复 AudioContext 并确认其运行状态，不创建预热音、不采样等待稳定；`schedule()` 等待恢复完成，以 `currentTime + 0.05` 为所有声部和节拍器的共同起点。50 ms 是排程余量，不是设备延迟补偿。

`AudioPlaybackClock.getPositionBeat()` 返回唯一播放位置。输出时间戳有效时直接投影其时间，不再对该结果施加 `currentTime - outputLatency` 的额外上限；时间戳不可用时才使用延迟字段回推。`usePracticePlayer` 每帧读取该位置，并沿用约 28 ms 的画面更新间隔；这一间隔只限制绘制频率，不承担音乐计时。暂停恢复、配置变化、谱面、琴键、指法、进度、读数及自动跟随共用同一拍位。

首次呈现由 `AudioPlaybackClock.sample()` 一次读取 `positionBeat` 与 `outputStarted`。`schedule()` 返回后继续保持 `starting`，直到浏览器输出时钟到达 `baseTime`；不能仅因排程完成就进入 `playing`，否则起点处的音符和琴键会先亮。首次放行时同步提交当前采样拍位，不重新从 `fromBeat` 计时；之后保持原有时钟和绘制节奏。等待输出时仍保留可取消的启动状态，暂停、停止、seek、重播或配置变化不能被旧帧重新激活。`outputStarted` 仅表示浏览器报告的时间边界，不是最终扬声器声学到达的测量。

保留启动代次取消、停止/seek 边界安全、点击音符播放和从头播放；也保留 `getSecondsPerBeat`、`buildAudioEventWindows`、弱起、连音与音符包络修正。生成进度和开头小节的一致性门禁仍然存在，但不再检查输出时钟稳定性或弹出校准窗口。不要把整个旧版 App 覆盖回来。

`src/core/audioCalibration.ts` 现在仅用于删除旧 `scoretokeys-kids.audio-calibration.v1`、`v2`、`v3` 设置；没有解析、读取、写入或应用补偿的接口。启动清理只操作这三个键，不影响语言或其他数据。删除失败会提示，但旧值仍不会影响当前播放。旧标签页须完整刷新，释放之前的 AudioContext 和内存状态。

手动校准、麦克风诊断、测试扫频和独立呈现延迟已退出当前播放路径。浏览器时间戳和主机回环仍不能独立验证最终扬声器与显示器的到达时间；恢复实现基线不能被表述为用户端音画问题已经修复。不要用 LLM 推测或包含隐藏录音缓冲的往返测量重新生成播放偏移。

### 13.3 播放控制

- 播放、暂停、停止和 seek 必须取消旧调度；
- 配置变化时从当前 beat 重新调度；
- 循环边界同时作用于声音、视觉和自动滚动；
- 调速只改变 beat 到秒的映射，不改变 MIDI 音高；
- 全部声部和节拍器关闭时明确报错。

## 14. 导出

### 14.1 当前实现

- MIDI：双通道左右手、速度、拍号和音符事件；
- MusicXML：左右手声部、和弦、指法、休止和基础时值；
- JSON：歌曲元数据、小节跨度、和弦及时间线；
- PDF：浏览器打印。

### 14.2 目标实现

- A4 PDF/PNG 使用与屏幕相同的 `LayoutPlan`；
- WAV/MP3 由时间线和 SoundFont 离线渲染；
- MP4 使用固定帧率渲染同一播放时钟，再与音频合成；
- 导出任务保存 schema、渲染器和模型版本；
- 失败时返回错误，不提供旧文件或空文件下载。

## 15. 测试策略

### 15.1 当前测试

`src/core/poc.test.ts` 当前覆盖：

- 连续 beat 时间线；
- 超长编辑保留并报错；
- 谱行分组；
- 两首 fixture 的完整性和拍数；
- 指法锁定；
- 和弦覆盖和左手模式；
- 根音加五度语义；
- 末尾休止；
- Web Audio 可听时钟；
- MIDI、MusicXML 和 JSON。

运行：

```powershell
npm test
npm run build
```

### 15.2 目标测试分层

1. **单元测试**：音高、时值、布局、差异、校验和导出；
2. **fixture 测试**：固定图片、模型响应和人工金标；
3. **契约测试**：各模型输出是否符合 schema；
4. **往返测试**：MusicXML/MIDI 导出再解析；
5. **浏览器集成测试**：确认、播放、seek、循环和跟随；
6. **视觉回归**：A4 页面、歌词、指法和小节无重叠；
7. **音画同步测试**：不同输出延迟和速度下的位置误差；
8. **模型评测**：逐音、八度、时值、歌词和覆盖指标。

### 15.3 金标集

初始金标集不少于 50 个小节，并覆盖：

- 五线谱和数字简谱；
- 高低八度和临时记号；
- 弱起、附点、连音和休止；
- 多谱行和末尾小节；
- 中英文歌词；
- 清晰扫描和可控的轻度倾斜、缩放或压缩。

分别报告：

- 音高准确率；
- 八度准确率；
- 时值准确率；
- 歌词字符和对齐准确率；
- 小节及整页覆盖；
- Reader 分歧率；
- Judge 解决率；
- 人工复核率；
- 自动确认区域的静默错误数。

发布回归中，自动确认区域出现未报告错误即视为失败。Reader 原始准确率和自动确认覆盖率必须分开统计，不能通过把全部内容交给人工来伪造高准确率。

## 16. 开发流程

每项变更遵循：

1. 将需求映射到可测量行为；
2. 找到唯一领域来源和所有派生表面；
3. 先增加或更新最小覆盖测试；
4. 实现根因修复；
5. 运行目标测试和 TypeScript/Vite 构建；
6. 对布局、交互或音画同步进行真实浏览器验证；
7. 更新需求、开发手册或 README；
8. 清理临时浏览器 profile、截图和生成物；
9. 记录模型、提示词、schema 和金标变化。

禁止：

- 为通过测试而删除正确的测试；
- 用 `any`、静默 fallback 或空结果绕过类型和错误；
- 根据熟悉旋律直接改 fixture，却不保留来源差异；
- 只验证页面显示而不验证播放和导出；
- 把模型输出直接写入已人工确认的数据；
- 在源码或前端配置中提交 API Key。

## 17. 模型与提示词版本管理

正式系统需要模型注册表，至少记录：

```text
role
provider
model
release/status
context tier
reasoning/thinking level
prompt version
schema version
fallback
enabled policy
```

提示词视为版本化代码：

- 与 schema 和金标测试一起评审；
- 修改后必须比较旧版和新版指标；
- Reader A/B 的任务约束对称；
- Judge 提示词不能默认偏向某个 Reader；
- 模型升级不能自动覆盖旧识别结果；
- 相同输入可以通过哈希重用同模型、同提示词、同预处理版本的缓存。

GPT-5.3 Codex 和 MAI Code 可以独立提出实现或审查结果，但确定性测试优先于模型判断。GPT-5.6 Sol 只裁决测试无法表达的语义分歧。

## 18. 错误处理与可观测性

每个后台任务记录：

- `traceId`、项目、输入哈希和阶段；
- 模型、实际配置、耗时、重试和回退；
- 页面、谱行、小节及事件数量；
- Reader 一致、分歧、Judge 和人工确认数量；
- 校验错误和警告；
- 导出版本和摘要；
- 用户可理解的错误码。

错误返回必须明确区分：

- 文件不支持；
- 图片预处理失败；
- 模型不可用或被组织策略禁止；
- schema 无效；
- 页面覆盖不完整；
- Judge 无法确认；
- 人工确认尚未完成；
- 布局溢出；
- 音频或导出失败。

不能捕获所有异常后返回“识别成功但结果为空”。

## 19. 隐私、安全与版权

- 上传到多个模型供应商前取得用户同意；
- 只发送乐谱及必要裁剪，不发送无关页面和儿童个人信息；
- API Key 只存在于后端秘密存储；
- 使用 HTTPS、最小权限和可配置保留期；
- 支持删除原图、裁剪、模型响应、缓存和导出；
- 记录供应商、区域、模型和数据处理策略；
- 企业部署尊重管理员模型策略；
- 内置和公开演示只使用公版、授权或原创内容；
- 不把用户上传乐谱自动加入共享训练或示例集。

## 20. 交付阶段

### 阶段零：金标与协议

- 识别 schema；
- 50+ 小节金标；
- 模型盲测；
- 差异和校验报告；
- 来源布局协议。

### 阶段一：识别闭环

- 后端上传和任务状态；
- 预处理与多尺度裁剪；
- Reader A/B；
- 标准化和差异；
- Judge；
- 人工校对和版本。

### 阶段二：A4 教学谱

- `LayoutPlan`；
- A4 SVG；
- 两种布局模式；
- PDF/PNG；
- 谱行自动跟随。

### 阶段三：编配和练习

- 扩展指法参数；
- 分级左手；
- SoundFont；
- 范围循环；
- MIDI 键盘跟弹。

### 阶段四：离线媒体

- WAV/MP3；
- 帧级动画渲染；
- MP4；
- 导出任务和往返校验。

## 21. 常见问题

### npm Registry TLS 握手失败

在确认 `unpkg.com` 可访问后运行：

```powershell
npm run bootstrap:unpkg
```

不要关闭 TLS 或证书校验。

### 4173 端口被占用

先确认是否已有本项目的 Vite 服务。不要按进程名批量终止浏览器或 Node；只终止已确认属于本项目的具体 PID，或临时修改 `vite.config.ts` 后记录端口变化。

### 页面仍显示旧内容

确认 `npm run build` 生成的新资源哈希已经由预览服务返回，再使用 `Ctrl+F5`。不要用旧截图代替运行时验证。

### 声音和动画不同步

先完整刷新旧标签页，确认页面没有校准入口且旧 `v1` / `v2` / `v3` 设置不再参与播放。检查谱面、琴键和进度是否共用 `AudioPlaybackClock.getPositionBeat()`，启动是否只等待 `resume()` 后进行 50 ms 提前排程，以及暂停、停止和 seek 是否取消了旧 oscillator。按冷启动、重播、暂停恢复和点击音符分别对照，不要修改歌曲拍位或继续增加固定偏移。实际录音须按音高和事件顺序配对，不能贪心匹配最近的一拍；主机 loopback 与屏幕采样仅说明主机边界内的结果，不能代替用户终端的最终听觉和显示验收。

### 乐谱听起来像多了一个音

分别检查：

- `0` 是否只是简谱休止；
- 左手是否在休止期间继续发声；
- 根音加五度是否产生额外起音；
- 音频时间线是否包含屏幕谱没有的事件；
- 导出摘要是否与屏幕时间线一致。

## 22. 完成定义

一项功能只有同时满足以下条件才算完成：

- 对应需求已明确；
- 类型和 schema 已更新；
- 正常、边界和错误路径有测试；
- `npm test` 通过；
- `npm run build` 通过；
- 用户可见行为经过真实浏览器验证；
- 音乐模型、时间线、屏幕和导出保持一致；
- 模型结果有来源、版本和确认状态；
- 不确定结果不会伪装成成功；
- A4 布局无重叠、截断或越界；
- 临时文件和进程已清理；
- 相关文档同步更新。
