import type { SongModel } from "../types";

export type Language = "zh-CN" | "en";
export type TranslationParams = Readonly<Record<string, string | number>>;

export const LANGUAGE_STORAGE_KEY = "scoretokeys-kids.language";

export const ZH_CN_MESSAGES = {
  "meta.title": "小琴伴 (ScoreToKeys Kids)",
  "meta.description": "面向儿童钢琴初学者的乐谱校对、自动编配与同步跟弹工具。",
  "brand.name": "小琴伴 (ScoreToKeys Kids)",
  "brand.tagline": "读谱 · 校对 · 跟弹",
  "language.groupLabel": "语言",
  "language.chinese": "中文",
  "language.english": "EN",
  "language.switchToChinese": "切换到中文",
  "language.switchToEnglish": "切换到英文",
  "nav.workflow": "学习流程",
  "nav.review": "识谱校对",
  "nav.arrange": "智能编配",
  "nav.practice": "跟弹练习",
  "nav.export": "导出",
  "export.midiName": "MIDI",
  "export.midiDescription": "当前速度 · 双手演奏",
  "export.musicXmlName": "MusicXML",
  "export.musicXmlDescription": "双声部与指法",
  "export.jsonName": "JSON",
  "export.jsonDescription": "统一演奏时间线",
  "export.printName": "打印 / PDF",
  "export.printDescription": "打印彩色简谱",
  "export.fileNameFallback": "钢琴乐谱",
  "export.timelineSuffix": "演奏时间线",
  "export.speedSuffix": "{percent}%速度",
  "export.rightHandPart": "右手旋律",
  "export.leftHandPart": "左手伴奏",
  "hero.badge": "小琴伴 · 从乐谱到琴键",
  "hero.headingLead": "看得懂每个音，",
  "hero.headingEmphasis": "跟得上每根手指。",
  "hero.body":
    "AI 只提供可校对的初稿；确认后，谱面、声音、键盘动画和导出文件都来自同一份演奏数据。",
  "hero.principleReview": "先校对",
  "hero.principleLock": "可锁定",
  "hero.principleSync": "严格同步",
  "toast.sampleLoaded": "已载入识别结果，请对照原谱逐音校对。",
  "toast.sessionDeleted": "已从本次访问中删除这份上传乐谱。",
  "upload.untitled": "待识别乐谱",
  "toast.recognizingPages": "正在用两个识谱模型读取 {pages}…",
  "toast.recognitionNeedsReview":
    "已合并 {pages}；{notes} 存在模型分歧，需要人工确认。",
  "toast.recognitionComplete": "已合并 {pages} 并完成双模型核验。",
  "toast.allConfirmed": "已人工确认全部音符。",
  "toast.allConfirmedWithCount": "已人工确认全部音符，并清除 {items}。",
  "toast.measureFull": "当前小节已满，请先缩短或删除音符。",
  "toast.addedNoteRemoved": "已移除新增音符。",
  "toast.noteReset": "当前音符已恢复为初始识别结果。",
  "toast.noLowConfidence": "所有低置信度音符都已确认。",
  "toast.requireNote": "至少添加一个音符后才能生成教学谱。",
  "toast.unresolvedNotes": "仍需逐一确认：{notes}。",
  "toast.generationReady":
    "教学谱已生成：已校验开头 {measures}、{notes}，音频播放已就绪。",
  "toast.legacyAudioSettingsCleanupFailed":
    "旧版同步设置未能从浏览器删除；当前播放不会读取或使用这些设置。",
  "toast.fingeringRecomputed": "已重算未锁定指法；锁定项保持不变。",
  "toast.reharmonized": "已重新编配；锁定和弦保持不变。",
  "error.recognitionFallback": "双模型识谱服务失败。",
  "error.imageRead": "无法读取图片 {file}。",
  "error.fileCount": "请选择 1 到 4 张按乐谱顺序排列的图片。",
  "error.audioNotReady": "当前音频设备尚未就绪。请允许浏览器播放声音后重试。",
  "error.generationFallback": "教学谱生成失败，请重新校对后再试。",
  "error.noteLocation": "无法定位这个音符的演奏时间。",
  "error.a4MissingMeasure": "A4 页面引用了不存在的第 {number} 小节。",
  "error.exportFallback": "导出失败。",
  "error.technicalDetails": "技术详情",
  "app.setupConfirmed": "乐谱与指法已确认",
  "app.songSummary": "{measures} 小节 · {key} · {tempo} BPM",
  "app.editSetup": "编辑乐谱与指法",
  "score.step": "步骤 3 · 彩色教学谱",
  "score.heading": "谱面与演奏时间线一一对应",
  "score.layout": "版式",
  "score.layoutSource": "原稿 A4",
  "score.layoutPractice": "放大练习",
  "score.followOn": "自动跟随：开",
  "score.followResume": "继续跟随",
  "score.print": "打印 / PDF",
  "practice.step": "步骤 4 · 同步跟弹练习",
  "practice.rightHand": "右手",
  "practice.leftHand": "左手",
  "practice.waiting": "等待",
  "practice.finger": "{finger} 指",
  "transport.restart": "从头重新播放",
  "transport.stop": "停止播放",
  "transport.stopShort": "停止",
  "transport.pause": "暂停播放",
  "transport.play": "开始播放",
  "transport.progress": "演奏进度",
  "transport.pickupBeats": "含 {beats} 拍弱起",
  "practice.speed": "速度",
  "practice.voicesHint": "声部（校音时只听右手）",
  "practice.rightVoice": "右手",
  "practice.leftVoice": "左手伴奏",
  "practice.metronome": "节拍器",
  "practice.loopMeasure": "循环第 {number} 小节",
  "common.close": "关闭",
  "common.delete": "删除",
  "common.page": "第 {number} 页",
  "common.pageCount.one": "{count} 页",
  "common.pageCount.other": "{count} 页",
  "common.noteCount.one": "{count} 个音符",
  "common.noteCount.other": "{count} 个音符",
  "common.measureCount.one": "{count} 个小节",
  "common.measureCount.other": "{count} 个小节",
  "common.reviewItemCount.one": "{count} 处待确认项",
  "common.reviewItemCount.other": "{count} 处待确认项",
  "common.disputedNoteCount.one": "{count} 个分歧音符",
  "common.disputedNoteCount.other": "{count} 个分歧音符",
  "common.lowConfidenceNoteCount.one": "{count} 个低置信度音符",
  "common.lowConfidenceNoteCount.other": "{count} 个低置信度音符",
  "music.measure": "第 {number} 小节",
  "music.measureShort": "小节 {number}",
  "music.pickup": "弱起小节",
  "music.keyMajor": "{key} 大调",
  "music.rightHandShort": "右",
  "source.step": "步骤 1 · 识谱与人工校对",
  "source.heading": "先对照原谱，再生成教学材料",
  "source.confirmed": "✓ 已人工确认",
  "source.pending": "待人工确认",
  "source.sampleTabs": "示例乐谱",
  "source.staffNotation": "五线谱",
  "source.numberedNotation": "数字简谱",
  "source.manualNotation": "手动输入",
  "source.reviewable": "可逐音校对",
  "source.uploadReading": "正在识别…",
  "source.uploadButton": "上传乐谱图片",
  "source.uploadHint": "可按顺序选择 1–4 张",
  "source.fileInputLabel": "选择 1 到 4 张乐谱图片",
  "source.sessionLibraryLabel": "本次访问上传的乐谱",
  "source.sessionTitle": "本次访问的乐谱",
  "source.sessionHint": "仅保存在当前页面内；刷新或关闭后自动清空。",
  "source.songCount.one": "{count} 份",
  "source.songCount.other": "{count} 份",
  "source.statusReading": "识别中",
  "source.statusError": "需要处理",
  "source.statusReady": "可继续校对",
  "source.deleteSong": "删除《{title}》",
  "source.queueTitle": "确认页面顺序",
  "source.queueHint": "第 1 页在最上方；调整好顺序后再开始识别。",
  "source.moveUp": "上移",
  "source.moveDown": "下移",
  "source.remove": "移除",
  "source.movePageUp": "将第 {number} 页上移",
  "source.movePageDown": "将第 {number} 页下移",
  "source.removePage": "移除第 {number} 页",
  "source.readerBusy": "双模型识谱中…",
  "source.startReading": "开始识别 {pages}",
  "source.previewTitle": "原始乐谱与校对谱",
  "source.zoom": "缩放",
  "source.imageAlt": "《{title}》原始乐谱第 {number} 页",
  "source.recognitionProgress":
    "OpenAI 与 Gemini 正在分别识谱；完成后将由裁决模型合并结果。",
  "source.reviewScoreTitle": "可点击校对谱",
  "source.reviewScoreHint": "待确认导航和音符选择都会自动定位到这里",
  "source.confidence": "综合置信度",
  "source.readersVerified": "✦ 双识谱模型已核验",
  "source.manualReview": "人工转录 · 待逐音复核",
  "source.details": "识别与演奏说明",
  "source.pendingNotes": "处待确认音符",
  "source.pendingHint": "“上一个 / 下一个”只定位橙色待确认音符",
  "source.previous": "← 上一个",
  "source.next": "下一个 →",
  "source.confirmAll": "✓ 一键确认全部音符",
  "source.noPending": "没有待确认音符",
  "source.noPendingHint": "无需逐音操作；如需修改，请直接点击中间谱面中的音符。",
  "source.editor": "音符校对器",
  "source.confirmCurrent": "确认当前音符",
  "source.reset": "复位",
  "source.addNote": "＋ 添加音符",
  "source.pitch": "音高",
  "source.rest": "休止符",
  "source.lowerOctave": "降低八度",
  "source.raiseOctave": "升高八度",
  "source.duration": "时值",
  "source.lyrics": "歌词 / 提示",
  "source.optional": "可留空",
  "source.rightFingering": "右手指法",
  "source.lock": "锁定",
  "source.recognitionConfidence": "识别置信度",
  "source.confirmNote": "确认本音",
  "source.emptyMeasure": "这个小节还没有音符。点击“添加音符”开始手动校对。",
  "source.generating": "正在生成教学谱",
  "source.generationProgress": "教学谱生成进度",
  "source.generationAlignment":
    "正在对齐乐谱、音频、动态音符和琴键；全部通过后才会进入弹奏页。",
  "source.generationFailed": "教学谱尚未生成",
  "source.confirmBusy": "正在校验，请稍候…",
  "source.reconfirm": "重新确认当前校对结果",
  "source.confirmGenerate": "确认校对，生成双手教学谱",
  "generation.validating-score": "检查乐谱结构与人工校对结果",
  "generation.building-timeline": "生成指法、伴奏与统一时间线",
  "generation.verifying-opening": "校验开头小节的音符、动画与琴键",
  "generation.preparing-audio": "准备当前设备的音频输出",
  "generation.finalizing": "复核音频排程并整理教学谱",
  "generation.ready": "校验完成，正在打开教学谱",
  "duration.sixteenth": "十六分音符 · ¼ 拍",
  "duration.eighth": "八分音符 · ½ 拍",
  "duration.quarter": "四分音符 · 1 拍",
  "duration.dottedQuarter": "附点四分音符 · 1½ 拍",
  "duration.half": "二分音符 · 2 拍",
  "duration.dottedHalf": "附点二分音符 · 3 拍",
  "duration.whole": "全音符 · 4 拍",
  "arrangement.step": "步骤 2 · 可解释的自动编配",
  "arrangement.heading": "适合儿童小手 · 入门难度",
  "arrangement.fingeringBadge": "连贯手位指法",
  "arrangement.harmonyBadge": "调内和弦规则",
  "arrangement.lockedTitle": "编配预览已锁定",
  "arrangement.lockedBody": "请先完成原谱校对并确认，避免错误音符进入后续输出。",
  "arrangement.leftPattern": "左手伴奏型",
  "arrangement.sharedTimeline": "所有模式都由同一条和弦时间线生成",
  "arrangement.mode.root.title": "单根音",
  "arrangement.mode.root.description": "每小节只弹一次根音",
  "arrangement.mode.root-fifth.title": "根音 + 五度",
  "arrangement.mode.root-fifth.description": "交替弹奏，节拍更稳",
  "arrangement.mode.block.title": "柱式和弦",
  "arrangement.mode.block.description": "三个和弦音同时弹",
  "arrangement.mode.arpeggio.title": "分解和弦",
  "arrangement.mode.arpeggio.description": "按固定八分音符型弹奏",
  "arrangement.chordProgression": "和弦进行",
  "arrangement.chordHint": "点击小节后可替换并锁定",
  "arrangement.reharmonize": "↻ 重新编配",
  "arrangement.locked": "已锁定",
  "arrangement.replaceChord": "替换和弦",
  "arrangement.lockMeasure": "锁定本小节",
  "arrangement.rightFingering": "右手推荐指法",
  "arrangement.rightFingeringHint": "已规划连贯手位；人工锁定的指法不会被覆盖。",
  "arrangement.recompute": "↻ 重算未锁定指法",
  "score.measureRegion": "{measure}",
  "score.chordLocked": " · 已锁",
  "score.rest": "休止符",
  "score.noteDetails": "{pitch} · 置信度 {confidence}%",
  "score.leftHand": "左手",
  "score.ariaLabel": "A4 竖版数字简谱",
  "score.eyebrow": "小琴伴 · 校对后生成",
  "score.continued": "续页",
  "score.legendRight": "右手旋律与指法",
  "score.legendLeft": "左手伴奏",
  "score.legendPending": "待人工确认",
  "keyboard.rightHand": "右手",
  "keyboard.leftHand": "左手",
  "keyboard.finger": "{number} 指",
  "keyboard.waiting": "等待演奏",
  "keyboard.currentKey": "当前琴键 {pitch}",
  "player.confirmFirst": "请先确认识别结果，再开始练习。",
  "player.noOutput": "右手、左手和节拍器均已关闭，没有可播放的声部。",
  "player.audioFallback": "浏览器音频初始化失败。",
} as const;

export type TranslationKey = keyof typeof ZH_CN_MESSAGES;

export const EN_MESSAGES: Readonly<Record<TranslationKey, string>> = {
  "meta.title": "小琴伴 (ScoreToKeys Kids)",
  "meta.description":
    "A child-friendly tool for checking sheet music, arranging it, and practicing with synchronized piano guidance.",
  "brand.name": "小琴伴 (ScoreToKeys Kids)",
  "brand.tagline": "Read · Check · Play",
  "language.groupLabel": "Language",
  "language.chinese": "中文",
  "language.english": "EN",
  "language.switchToChinese": "Switch to Chinese",
  "language.switchToEnglish": "Switch to English",
  "nav.workflow": "Learning steps",
  "nav.review": "Check the score",
  "nav.arrange": "Build the arrangement",
  "nav.practice": "Practice",
  "nav.export": "Export",
  "export.midiName": "MIDI",
  "export.midiDescription": "Current speed · both hands",
  "export.musicXmlName": "MusicXML",
  "export.musicXmlDescription": "Two parts with fingering",
  "export.jsonName": "JSON",
  "export.jsonDescription": "Unified performance timeline",
  "export.printName": "Print / PDF",
  "export.printDescription": "Print the color numbered score",
  "export.fileNameFallback": "piano-score",
  "export.timelineSuffix": "performance-timeline",
  "export.speedSuffix": "{percent}pct",
  "export.rightHandPart": "Right-hand melody",
  "export.leftHandPart": "Left-hand accompaniment",
  "hero.badge": "ScoreToKeys Kids · From Score to Keys",
  "hero.headingLead": "Read every note. ",
  "hero.headingEmphasis": "Follow every finger.",
  "hero.body":
    "AI provides a draft you can check. Once confirmed, the score, sound, keyboard animation, and exports all use the same performance data.",
  "hero.principleReview": "Check first",
  "hero.principleLock": "Lock choices",
  "hero.principleSync": "Stay in sync",
  "toast.sampleLoaded": "Recognition results loaded. Check each note against the source score.",
  "toast.sessionDeleted": "This uploaded score was removed from the current visit.",
  "upload.untitled": "Score waiting to be read",
  "toast.recognizingPages": "Two score readers are reading {pages}…",
  "toast.recognitionNeedsReview":
    "Merged {pages}; {notes} have model disagreements and need your review.",
  "toast.recognitionComplete": "Merged {pages} and completed two-model verification.",
  "toast.allConfirmed": "All notes are now confirmed.",
  "toast.allConfirmedWithCount": "All notes are confirmed; {items} cleared.",
  "toast.measureFull": "This measure is full. Shorten or delete a note first.",
  "toast.addedNoteRemoved": "The added note was removed.",
  "toast.noteReset": "This note was restored to the original recognition result.",
  "toast.noLowConfidence": "All low-confidence notes are already confirmed.",
  "toast.requireNote": "Add at least one note before generating the teaching score.",
  "toast.unresolvedNotes": "Individual review is still needed for {notes}.",
  "toast.generationReady":
    "Teaching score ready: checked the opening {measures} and {notes}. Audio playback is ready.",
  "toast.legacyAudioSettingsCleanupFailed":
    "Old sync settings could not be deleted from this browser. Playback no longer reads or uses them.",
  "toast.fingeringRecomputed": "Unlocked fingering was recalculated; locked choices were kept.",
  "toast.reharmonized": "The arrangement was rebuilt; locked chords were kept.",
  "error.recognitionFallback": "The two-model score-reading service failed.",
  "error.imageRead": "Could not read image {file}.",
  "error.fileCount": "Choose 1–4 images in score order.",
  "error.audioNotReady":
    "The current audio device is not ready. Allow browser audio, then try again.",
  "error.generationFallback": "Could not generate the teaching score. Check the score and try again.",
  "error.noteLocation": "Could not find this note on the performance timeline.",
  "error.a4MissingMeasure": "The A4 page references missing measure {number}.",
  "error.exportFallback": "Export failed.",
  "error.technicalDetails": "Technical details",
  "app.setupConfirmed": "Score and fingering confirmed",
  "app.songSummary": "{measures} measures · {key} · {tempo} BPM",
  "app.editSetup": "Edit score and fingering",
  "score.step": "STEP 3 · COLOR TEACHING SCORE",
  "score.heading": "Every note matches the performance timeline",
  "score.layout": "Layout",
  "score.layoutSource": "Source A4",
  "score.layoutPractice": "Large practice view",
  "score.followOn": "Auto-follow: on",
  "score.followResume": "Resume follow",
  "score.print": "Print / PDF",
  "practice.step": "STEP 4 · SYNCHRONIZED PRACTICE",
  "practice.rightHand": "Right hand",
  "practice.leftHand": "Left hand",
  "practice.waiting": "Waiting",
  "practice.finger": "finger {finger}",
  "transport.restart": "Play from the beginning",
  "transport.stop": "Stop playback",
  "transport.stopShort": "Stop",
  "transport.pause": "Pause playback",
  "transport.play": "Start playback",
  "transport.progress": "Playback position",
  "transport.pickupBeats": "{beats}-beat pickup",
  "practice.speed": "Speed",
  "practice.voicesHint": "Parts (use right hand only when checking pitch)",
  "practice.rightVoice": "Right hand",
  "practice.leftVoice": "Left-hand accompaniment",
  "practice.metronome": "Metronome",
  "practice.loopMeasure": "Loop measure {number}",
  "common.close": "Close",
  "common.delete": "Delete",
  "common.page": "Page {number}",
  "common.pageCount.one": "{count} page",
  "common.pageCount.other": "{count} pages",
  "common.noteCount.one": "{count} note",
  "common.noteCount.other": "{count} notes",
  "common.measureCount.one": "{count} measure",
  "common.measureCount.other": "{count} measures",
  "common.reviewItemCount.one": "{count} review item",
  "common.reviewItemCount.other": "{count} review items",
  "common.disputedNoteCount.one": "{count} disputed note",
  "common.disputedNoteCount.other": "{count} disputed notes",
  "common.lowConfidenceNoteCount.one": "{count} low-confidence note",
  "common.lowConfidenceNoteCount.other": "{count} low-confidence notes",
  "music.measure": "Measure {number}",
  "music.measureShort": "M. {number}",
  "music.pickup": "Pickup measure",
  "music.keyMajor": "{key} major",
  "music.rightHandShort": "R",
  "source.step": "STEP 1 · READ AND CHECK",
  "source.heading": "Check the source score before making teaching materials",
  "source.confirmed": "✓ Manually confirmed",
  "source.pending": "Needs confirmation",
  "source.sampleTabs": "Sample scores",
  "source.staffNotation": "Staff notation",
  "source.numberedNotation": "Numbered notation (jianpu)",
  "source.manualNotation": "Manual entry",
  "source.reviewable": "Check note by note",
  "source.uploadReading": "Reading…",
  "source.uploadButton": "Upload score images",
  "source.uploadHint": "Choose 1–4 images in page order",
  "source.fileInputLabel": "Choose one to four score images",
  "source.sessionLibraryLabel": "Scores uploaded during this visit",
  "source.sessionTitle": "Scores from this visit",
  "source.sessionHint": "Kept only on this page; refreshing or closing clears them.",
  "source.songCount.one": "{count} score",
  "source.songCount.other": "{count} scores",
  "source.statusReading": "Reading",
  "source.statusError": "Needs attention",
  "source.statusReady": "Ready to review",
  "source.deleteSong": "Delete “{title}”",
  "source.queueTitle": "Check the page order",
  "source.queueHint": "Page 1 goes first. Reorder the pages before recognition.",
  "source.moveUp": "Move up",
  "source.moveDown": "Move down",
  "source.remove": "Remove",
  "source.movePageUp": "Move page {number} up",
  "source.movePageDown": "Move page {number} down",
  "source.removePage": "Remove page {number}",
  "source.readerBusy": "Two score readers are working…",
  "source.startReading": "Read {pages}",
  "source.previewTitle": "Source score and checked score",
  "source.zoom": "Zoom",
  "source.imageAlt": "Page {number} of the source score for “{title}”",
  "source.recognitionProgress":
    "OpenAI and Gemini are reading independently. A judge will merge their results.",
  "source.reviewScoreTitle": "Clickable review score",
  "source.reviewScoreHint": "Review navigation and note selection will move here automatically",
  "source.confidence": "Overall confidence",
  "source.readersVerified": "✦ Verified by two score readers",
  "source.manualReview": "Manual transcription · check each note",
  "source.details": "Recognition and performance notes",
  "source.pendingNotes": "notes to review",
  "source.pendingHint": "Previous / Next moves only between orange review notes",
  "source.previous": "← Previous",
  "source.next": "Next →",
  "source.confirmAll": "✓ Confirm all notes",
  "source.noPending": "No notes need confirmation",
  "source.noPendingHint": "To make a change, select a note in the middle score.",
  "source.editor": "Note checker",
  "source.confirmCurrent": "Confirm this note",
  "source.reset": "Reset",
  "source.addNote": "＋ Add note",
  "source.pitch": "Pitch",
  "source.rest": "Rest",
  "source.lowerOctave": "Down one octave",
  "source.raiseOctave": "Up one octave",
  "source.duration": "Duration",
  "source.lyrics": "Lyric / cue",
  "source.optional": "Optional",
  "source.rightFingering": "Right-hand fingering",
  "source.lock": "Lock",
  "source.recognitionConfidence": "Recognition confidence",
  "source.confirmNote": "Confirm note",
  "source.emptyMeasure": "This measure has no notes yet. Select “Add note” to enter one.",
  "source.generating": "Generating the teaching score",
  "source.generationProgress": "Teaching-score generation progress",
  "source.generationAlignment":
    "Aligning the score, audio, animated notes, and keys. Practice opens only after every check passes.",
  "source.generationFailed": "Teaching score not generated",
  "source.confirmBusy": "Checking—please wait…",
  "source.reconfirm": "Confirm these edits again",
  "source.confirmGenerate": "Confirm review and generate a two-hand teaching score",
  "generation.validating-score": "Checking score structure and manual review",
  "generation.building-timeline": "Building fingering, accompaniment, and one timeline",
  "generation.verifying-opening": "Checking opening notes, animation, and keys",
  "generation.preparing-audio": "Preparing audio on this device",
  "generation.finalizing": "Rechecking audio scheduling and finishing the score",
  "generation.ready": "Checks passed; opening the teaching score",
  "duration.sixteenth": "Sixteenth note · ¼ beat",
  "duration.eighth": "Eighth note · ½ beat",
  "duration.quarter": "Quarter note · 1 beat",
  "duration.dottedQuarter": "Dotted quarter note · 1½ beats",
  "duration.half": "Half note · 2 beats",
  "duration.dottedHalf": "Dotted half note · 3 beats",
  "duration.whole": "Whole note · 4 beats",
  "arrangement.step": "STEP 2 · EXPLAINABLE ARRANGEMENT",
  "arrangement.heading": "Beginner level · made for small hands",
  "arrangement.fingeringBadge": "Smooth hand-position fingering",
  "arrangement.harmonyBadge": "Chords from the home key",
  "arrangement.lockedTitle": "Arrangement preview locked",
  "arrangement.lockedBody":
    "Check and confirm the source score first so mistakes do not enter later output.",
  "arrangement.leftPattern": "Left-hand pattern",
  "arrangement.sharedTimeline": "Every pattern uses the same chord timeline",
  "arrangement.mode.root.title": "Root note",
  "arrangement.mode.root.description": "Play one root note per measure",
  "arrangement.mode.root-fifth.title": "Root + fifth",
  "arrangement.mode.root-fifth.description": "Alternate notes for a steady pulse",
  "arrangement.mode.block.title": "Block chord",
  "arrangement.mode.block.description": "Play all three chord tones together",
  "arrangement.mode.arpeggio.title": "Arpeggio",
  "arrangement.mode.arpeggio.description": "Use a steady eighth-note pattern",
  "arrangement.chordProgression": "Chord progression",
  "arrangement.chordHint": "Select a measure to replace or lock its chord",
  "arrangement.reharmonize": "↻ Rebuild chords",
  "arrangement.locked": "Locked",
  "arrangement.replaceChord": "Replace chord",
  "arrangement.lockMeasure": "Lock this measure",
  "arrangement.rightFingering": "Suggested right-hand fingering",
  "arrangement.rightFingeringHint":
    "Hand positions are planned for smooth movement; locked fingering will not change.",
  "arrangement.recompute": "↻ Recalculate unlocked fingering",
  "score.measureRegion": "{measure}",
  "score.chordLocked": " · locked",
  "score.rest": "Rest",
  "score.noteDetails": "{pitch} · {confidence}% confidence",
  "score.leftHand": "Left hand",
  "score.ariaLabel": "Portrait A4 numbered score",
  "score.eyebrow": "ScoreToKeys Kids · Generated after review",
  "score.continued": "continued",
  "score.legendRight": "Right-hand melody and fingering",
  "score.legendLeft": "Left-hand accompaniment",
  "score.legendPending": "Needs manual review",
  "keyboard.rightHand": "Right hand",
  "keyboard.leftHand": "Left hand",
  "keyboard.finger": "finger {number}",
  "keyboard.waiting": "Waiting to play",
  "keyboard.currentKey": "Current key: {pitch}",
  "player.confirmFirst": "Confirm the recognition result before practicing.",
  "player.noOutput": "Right hand, left hand, and metronome are all off, so there is nothing to play.",
  "player.audioFallback": "Browser audio could not start.",
};

export const TRANSLATIONS: Readonly<
  Record<Language, Readonly<Record<TranslationKey, string>>>
> = {
  "zh-CN": ZH_CN_MESSAGES,
  en: EN_MESSAGES,
};

export function isLanguage(value: unknown): value is Language {
  return value === "zh-CN" || value === "en";
}

export function resolveLanguage(
  storedLanguage: string | null,
  browserLanguage = "",
): Language {
  if (isLanguage(storedLanguage)) return storedLanguage;
  return browserLanguage.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function translate(
  language: Language,
  key: TranslationKey,
  params: TranslationParams = {},
): string {
  return TRANSLATIONS[language][key].replace(
    /\{([A-Za-z][A-Za-z0-9]*)\}/g,
    (placeholder, name: string) =>
      Object.prototype.hasOwnProperty.call(params, name)
        ? String(params[name])
        : placeholder,
  );
}

export function extractPlaceholders(message: string): string[] {
  return [...message.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)]
    .map((match) => match[1])
    .sort();
}

export function formatAccidentals(value: string): string {
  return value.replaceAll("bb", "𝄫").replaceAll("#", "♯").replaceAll("b", "♭");
}

interface LocalizedSongFields {
  title?: string;
  subtitle: string;
  suggestedTempo?: string;
  source: {
    coverage: string;
    attribution: string;
    recognizer: string;
    notes: readonly string[];
  };
}

const BUILT_IN_SONG_PRESENTATIONS: Readonly<
  Record<"happy" | "labor", Readonly<Record<Language, LocalizedSongFields>>>
> = {
  happy: {
    "zh-CN": {
      title: "如果感到幸福你就拍拍手",
      subtitle: "传统童谣 · 儿童钢琴入门曲",
      suggestedTempo: "♩ = 92 · 活泼地",
      source: {
        coverage: "完整旋律 · 8 小节加弱起",
        attribution: "传统童谣",
        recognizer: "自动识别与逐音校对",
        notes: [
          "调号识别为 F 大调，拍号为 4/4。",
          "已按原谱低音区逐音复核，不再使用首版高八度近似旋律。",
          "第 5 小节 “know it” 对应的两个 D 音按原图记为 D4，不套用其他传统版本的高八度写法。",
        ],
      },
    },
    en: {
      title: "If You're Happy and You Know It",
      subtitle: "Traditional children's song · beginner piano study",
      suggestedTempo: "♩ = 92 · Lively",
      source: {
        coverage: "Complete melody · 8 measures plus pickup",
        attribution: "Traditional melody",
        recognizer: "Automatic recognition with note-by-note review",
        notes: [
          "Recognized in F major with a 4/4 time signature.",
          "Every note was checked in the source register; the earlier octave-up approximation is no longer used.",
          "The two D notes under “know it” in measure 5 remain D4 as printed rather than following higher-octave variants.",
        ],
      },
    },
  },
  labor: {
    "zh-CN": {
      title: "劳动最光荣",
      subtitle: "原谱降 B 大调 · 动画片《小猫钓鱼》主题歌",
      suggestedTempo: "♩ = 118 · 活泼、愉快、健康地",
      source: {
        coverage: "完整页面 · 35 小节",
        attribution: "动画片《小猫钓鱼》主题歌",
        recognizer: "人工转录与独立整页复核",
        notes: [
          "原图调号为 1=♭B；谱面、播放、键盘和导出均保留原调，不使用外部版本改写。",
          "参考页面只用于速度参考（约 ♩=118），不会覆盖原谱的调号、八度或音序。",
          "已根据数字、点位、下划线、连线和歌词中心位置独立复核全部 35 小节。",
          "附点按实际时值记谱；只有数字正上方的圆点表示高八度。",
        ],
      },
    },
    en: {
      title: "Labor Is Most Glorious",
      subtitle: "Original key: B♭ major · theme from the animated film The Kitten Goes Fishing",
      suggestedTempo: "♩ = 118 · Lively, cheerful, and bright",
      source: {
        coverage: "Complete page · 35 measures",
        attribution: "Theme from the animated film The Kitten Goes Fishing",
        recognizer: "Manual transcription with an independent full-page review",
        notes: [
          "The source key is 1=B♭. The score, playback, keyboard, and exports preserve that key instead of substituting an outside arrangement.",
          "The reference page is used only for tempo guidance (about ♩=118), never to overwrite the source key, octave, or note order.",
          "All 35 measures were independently checked against the numerals, dots, underlines, arcs, and lyric alignment.",
          "Rhythmic dots are represented by their duration; only a dot directly above a numeral marks the upper octave.",
        ],
      },
    },
  },
};

const MANUAL_SONG_PRESENTATION: Readonly<Record<Language, LocalizedSongFields>> = {
  "zh-CN": {
    subtitle: "手动校对模式",
    source: {
      coverage: "尚未识别",
      attribution: "本次访问中的临时图片",
      recognizer: "识谱服务尚未返回结果",
      notes: [
        "请对照原谱逐音检查自动识别结果。",
        "可以添加、删除、修改或复位任意音符。",
      ],
    },
  },
  en: {
    subtitle: "Manual review mode",
    source: {
      coverage: "Not recognized yet",
      attribution: "Temporary images from this visit",
      recognizer: "The score-reading service has not returned a result",
      notes: [
        "Check every recognized note against the source score.",
        "You can add, delete, edit, or reset any note.",
      ],
    },
  },
};

export function localizeSongPresentation(
  song: SongModel,
  language: Language,
): SongModel {
  const builtIn =
    song.id === "happy" || song.id === "labor"
      ? BUILT_IN_SONG_PRESENTATIONS[song.id][language]
      : null;
  const fields = builtIn ?? (song.id.startsWith("manual-")
    ? MANUAL_SONG_PRESENTATION[language]
    : null);
  if (!fields) return song;
  const usesGenericManualTitle =
    song.id.startsWith("manual-") &&
    (song.title === "待识别乐谱" ||
      song.title === "待校对的新乐谱" ||
      song.title === "Score waiting to be read");

  return {
    ...song,
    title: usesGenericManualTitle
      ? translate(language, "upload.untitled")
      : fields.title ?? song.title,
    subtitle: fields.subtitle,
    suggestedTempo: fields.suggestedTempo ?? song.suggestedTempo,
    source: {
      ...song.source,
      coverage: fields.source.coverage,
      attribution: fields.source.attribution,
      recognizer: fields.source.recognizer,
      notes: [...fields.source.notes],
    },
  };
}

const PRODUCT_ERROR_KEYS: Readonly<Record<string, TranslationKey>> = {
  AUDIO_DEVICE_NOT_READY: "error.audioNotReady",
  GENERATION_FAILED: "error.generationFallback",
  RECOGNITION_FAILED: "error.recognitionFallback",
  PLAYER_CONFIRM_REQUIRED: "player.confirmFirst",
  PLAYER_NO_OUTPUT: "player.noOutput",
  AUDIO_INIT_FAILED: "player.audioFallback",
  RECOGNITION_FILE_COUNT: "error.fileCount",
  RECOGNITION_RESPONSE_FAILED: "error.recognitionFallback",
  EXPORT_FAILED: "error.exportFallback",
};

const EN_ERROR_EXACT: Readonly<Record<string, string>> = {
  "每行小节数必须至少为 1。": "Each score system must contain at least one measure.",
  "速度必须是大于 0 的有限数值。": "Tempo must be a positive finite number.",
  "拍号必须使用有效的正整数拍数和 2 的幂次拍值。":
    "The time signature needs a positive beat count and a power-of-two beat unit.",
  "音符起始位置必须是非负有限数值。": "A note start must be a non-negative finite value.",
  "音符时值必须是大于 0 的有限数值。": "A note duration must be a positive finite value.",
  "音高超出标准钢琴范围。": "A pitch is outside the standard piano range.",
  "音高必须是整数，指法必须是 1 到 5 的整数。":
    "Pitch must be an integer, and fingering must be an integer from 1 to 5.",
  "同一音符不能同时标记延音线和圆滑线。":
    "One note cannot begin both a tie and a slur.",
  "识别置信度必须位于 0 到 1 之间。": "Recognition confidence must be between 0 and 1.",
  "教学谱没有可检查的小节。": "The teaching score has no measures to check.",
  "开头小节没有可播放的右手音频。":
    "The opening measures contain no playable right-hand audio.",
  "当前浏览器不支持 Web Audio，无法播放声音。":
    "This browser does not support Web Audio, so playback is unavailable.",
  "无法导出：演奏事件超出乐谱总时长。":
    "Export failed: a performance event extends beyond the score.",
  "来源谱行不能完整且唯一地映射全部小节。":
    "Source systems must map every measure exactly once.",
  "请选择 1 到 4 张按乐谱顺序排列的图片。":
    "Choose 1–4 images in score order.",
  "多模型识别服务返回失败。": "The two-model score-reading service returned an error.",
  "上传内容超过 52 MB 限制。": "The upload exceeds the 52 MB limit.",
  "API 路径不存在。": "The requested API route does not exist.",
  "开发服务器响应失败。": "The development server could not respond.",
  "识别服务失败。": "The score-reading service failed.",
  "图片必须是 PNG、JPEG、GIF 或 WebP。": "Images must be PNG, JPEG, GIF, or WebP.",
  "单张图片必须大于 0 且不超过 12 MB。":
    "Each image must be larger than 0 bytes and no more than 12 MB.",
  "每首曲子必须上传 1 到 4 张按顺序排列的图片。":
    "Upload 1–4 images for each piece, in page order.",
  "图片页码必须从 1 开始连续排列。": "Image page numbers must be consecutive from 1.",
  "OpenAI Reader 没有返回结构化结果。":
    "The OpenAI score reader did not return structured results.",
  "Gemini Reader 没有返回结构化结果。":
    "The Gemini score reader did not return structured results.",
  "Reader 返回了无效音符或时值证据。":
    "A score reader returned invalid note or duration evidence.",
  "Reader 返回的八度点没有可靠的数字对齐证据。":
    "A score reader returned an octave dot without reliable numeral alignment.",
  "Reader 返回的时值与下划线、附点或延长线证据不一致。":
    "A score reader returned a duration that conflicts with underline, dot, or sustain-mark evidence.",
  "模型结果没有完整且唯一地覆盖所有上传页面。":
    "The model results do not cover every uploaded page exactly once.",
  "Judge 没有返回任何乐谱页面。": "The judge did not return any score pages.",
  "当前规范谱面尚不支持混合五线谱/简谱页面，请分别上传。":
    "Mixed staff-notation and numbered-notation pages are not supported yet; upload them separately.",
  "Judge 返回了无法定位到乐谱事件的 unresolved 标识。":
    "The judge returned an unresolved marker that does not match a score event.",
  "服务端缺少 OPENAI_API_KEY 或 GEMINI_API_KEY。":
    "The server is missing OPENAI_API_KEY or GEMINI_API_KEY.",
};

const ZH_ERROR_EXACT: Readonly<Record<string, string>> = {
  "Tempo must be a positive finite number.": "速度必须是大于 0 的有限数值。",
  "Playback speed must be a positive finite number.": "播放速度必须是大于 0 的有限数值。",
};

interface ErrorPattern {
  pattern: RegExp;
  format: (match: RegExpMatchArray) => string;
}

const EN_ERROR_PATTERNS: readonly ErrorPattern[] = [
  {
    pattern: /^无法读取图片 (.+)。$/,
    format: (match) => `Could not read image ${match[1]}.`,
  },
  {
    pattern: /^第 (.+) 小节编号重复。$/,
    format: (match) => `Measure ${match[1]} has a duplicate number.`,
  },
  {
    pattern: /^第 (.+) 小节长度必须是大于 0 的有限数值。$/,
    format: (match) => `Measure ${match[1]} must have a positive finite duration.`,
  },
  {
    pattern: /^音符标识 (.+) 重复。$/,
    format: (match) => `Note identifier ${match[1]} is duplicated.`,
  },
  {
    pattern: /^第 (.+) 小节的音符超出小节长度。$/,
    format: (match) => `A note extends beyond measure ${match[1]}.`,
  },
  {
    pattern: /^无法解析原始简谱音符 (.+)。$/,
    format: (match) => `Could not parse source numbered-notation note ${match[1]}.`,
  },
  {
    pattern: /^音符 (.+) 与实际播放音高不一致。$/,
    format: (match) => `Note ${match[1]} does not match its playback pitch.`,
  },
  {
    pattern: /^第 (.+) 小节存在重叠音符；当前模型只接受单声部简谱。$/,
    format: (match) =>
      `Measure ${match[1]} contains overlapping notes; the current numbered-score model supports one melodic voice.`,
  },
  {
    pattern: /^第 (.+) 小节末尾有 (.+) 拍空白，将按休止处理。$/,
    format: (match) =>
      `Measure ${match[1]} has ${match[2]} empty beat(s) at the end; they will be treated as rests.`,
  },
  {
    pattern: /^第 (.+) 小节的连音必须连接到紧邻的同音高音符。$/,
    format: (match) =>
      `The tie in measure ${match[1]} must connect directly to the next note of the same pitch.`,
  },
  {
    pattern: /^第 (.+) 小节的圆滑线必须连接到紧邻音符。$/,
    format: (match) => `The slur in measure ${match[1]} must connect to the next note.`,
  },
  {
    pattern: /^演奏事件标识 (.+) 重复。$/,
    format: (match) => `Performance-event identifier ${match[1]} is duplicated.`,
  },
  {
    pattern: /^第 (.+) 小节存在越界或无效的演奏时间。$/,
    format: (match) => `Measure ${match[1]} contains invalid or out-of-range performance timing.`,
  },
  {
    pattern: /^第 (.+) 小节存在无效的音高、指法或力度。$/,
    format: (match) => `Measure ${match[1]} contains an invalid pitch, fingering, or velocity.`,
  },
  {
    pattern: /^演奏事件 (.+) 不在对应小节范围内。$/,
    format: (match) => `Performance event ${match[1]} falls outside its measure.`,
  },
  {
    pattern: /^右手演奏事件 (.+) 缺少谱面来源。$/,
    format: (match) => `Right-hand performance event ${match[1]} has no source-score note.`,
  },
  {
    pattern: /^休止事件 (.+) 不应生成右手发声事件。$/,
    format: (match) => `Rest event ${match[1]} must not create a sounding right-hand event.`,
  },
  {
    pattern: /^谱面事件 (.+) 必须且只能生成一个右手演奏事件。$/,
    format: (match) => `Score event ${match[1]} must create exactly one right-hand performance event.`,
  },
  {
    pattern: /^谱面事件 (.+) 与演奏时间线不一致。$/,
    format: (match) => `Score event ${match[1]} does not match the performance timeline.`,
  },
  {
    pattern: /^演奏时间线引用了不存在的谱面事件 (.+)。$/,
    format: (match) => `The performance timeline references missing score event ${match[1]}.`,
  },
  {
    pattern: /^第 (.+) 小节的锁定和弦 (.+) 不属于当前调性。$/,
    format: (match) => `Locked chord ${match[2]} in measure ${match[1]} is outside the current key.`,
  },
  {
    pattern: /^找不到第 (.+) 小节的时间范围。$/,
    format: (match) => `Could not find the timeline span for measure ${match[1]}.`,
  },
  {
    pattern: /^休止符 (.+) 被错误转换为右手声音。$/,
    format: (match) => `Rest ${match[1]} was incorrectly converted into right-hand audio.`,
  },
  {
    pattern: /^音符 (.+) 没有唯一对应的右手演奏事件。$/,
    format: (match) => `Note ${match[1]} does not have exactly one matching right-hand event.`,
  },
  {
    pattern: /^音符 (.+) 的谱面与演奏起点不一致。$/,
    format: (match) => `Note ${match[1]} starts at different times in the score and performance.`,
  },
  {
    pattern: /^音符 (.+) 的音高或时值与演奏事件不一致。$/,
    format: (match) => `Note ${match[1]} has a pitch or duration mismatch in the performance.`,
  },
  {
    pattern: /^音符 (.+) 无法驱动键盘和谱面动画。$/,
    format: (match) => `Note ${match[1]} cannot activate the keyboard and score animation.`,
  },
  {
    pattern: /^音符 (.+) 不在实际音频排程窗口中。$/,
    format: (match) => `Note ${match[1]} is missing from the actual audio schedule.`,
  },
  {
    pattern: /^无法导出：(.+)$/,
    format: (match) => `Export failed: ${localizeTechnicalError(match[1], "en")}`,
  },
  {
    pattern: /^时值 (.+) 拍无法以 (.+) divisions 精确导出。$/,
    format: (match) =>
      `A duration of ${match[1]} beat(s) cannot be exported exactly with ${match[2]} divisions.`,
  },
  {
    pattern: /^无法导出 MIDI 音高 (.+)$/,
    format: (match) => `Could not export MIDI pitch ${match[1]}.`,
  },
  {
    pattern: /^无法解析音名：?(.+)$/,
    format: (match) => `Could not parse pitch name ${match[1]}.`,
  },
  {
    pattern: /^无法解析简谱(?:音高|音符)：?(.+)$/,
    format: (match) => `Could not parse numbered-notation pitch ${match[1]}.`,
  },
  {
    pattern: /^A4 (?:布局|页面)引用了不存在的第 (.+) 小节。$/,
    format: (match) => `The A4 layout references missing measure ${match[1]}.`,
  },
  {
    pattern: /^第 (.+) 小节的音符时值总和不等于小节长度。$/,
    format: (match) => `The note durations in measure ${match[1]} do not fill the measure.`,
  },
];

export function localizeTechnicalError(
  message: string,
  language: Language,
): string {
  if (message.startsWith("IMAGE_READ_FAILED:")) {
    return translate(language, "error.imageRead", {
      file: message.slice("IMAGE_READ_FAILED:".length),
    });
  }
  const productKey = PRODUCT_ERROR_KEYS[message];
  if (productKey) return translate(language, productKey);

  if (language === "en") {
    const exact = EN_ERROR_EXACT[message];
    if (exact) return exact;
    for (const rule of EN_ERROR_PATTERNS) {
      const match = message.match(rule.pattern);
      if (match) return rule.format(match);
    }
    return /[\u3400-\u9fff]/u.test(message)
      ? `${translate(language, "error.technicalDetails")}: ${message}`
      : message;
  }

  const exact = ZH_ERROR_EXACT[message];
  if (exact) return exact;
  return /[\u3400-\u9fff]/u.test(message)
    ? message
    : `${translate(language, "error.technicalDetails")}：${message}`;
}
