import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const MAX_PAGES = 4;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_PITCH_CLASSES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const dotSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    position: { type: "string", enum: ["above", "below"] },
    horizontalOffset: { type: "number" },
    verticalGap: { type: "number" },
    diameter: { type: "number" },
  },
  required: ["position", "horizontalOffset", "verticalGap", "diameter"],
};

const eventSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pitchToken: { type: ["string", "null"] },
    pitchName: { type: ["string", "null"] },
    durationBeats: { type: "number" },
    lyric: { type: ["string", "null"] },
    confidence: { type: "number" },
    tieToNext: { type: "boolean" },
    slurToNext: { type: "boolean" },
    evidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        digit: { type: ["integer", "null"] },
        octaveShift: { type: "integer" },
        octaveDots: { type: "array", items: dotSchema },
        underlineCount: { type: "integer" },
        durationDotCount: { type: "integer" },
        sustainDashCount: { type: "integer" },
        observedSymbols: { type: "array", items: { type: "string" } },
        rationale: { type: "string" },
      },
      required: [
        "digit",
        "octaveShift",
        "octaveDots",
        "underlineCount",
        "durationDotCount",
        "sustainDashCount",
        "observedSymbols",
        "rationale",
      ],
    },
  },
  required: [
    "pitchToken",
    "pitchName",
    "durationBeats",
    "lyric",
    "confidence",
    "tieToNext",
    "slurToNext",
    "evidence",
  ],
};

export const SCORE_READER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    notation: { type: "string", enum: ["jianpu", "staff", "mixed"] },
    key: { type: "string" },
    tonicPitch: { type: "string" },
    tempo: { type: "number" },
    timeSignature: {
      type: "object",
      additionalProperties: false,
      properties: {
        beats: { type: "integer" },
        beatType: { type: "integer" },
      },
      required: ["beats", "beatType"],
    },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          pageNumber: { type: "integer" },
          measures: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                sourceMeasureNumber: { type: ["integer", "null"] },
                systemNumber: { type: "integer" },
                durationBeats: { type: "number" },
                events: { type: "array", items: eventSchema },
              },
              required: [
                "sourceMeasureNumber",
                "systemNumber",
                "durationBeats",
                "events",
              ],
            },
          },
        },
        required: ["pageNumber", "measures"],
      },
    },
    unresolvedEvents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          pageNumber: { type: "integer" },
          pageMeasureIndex: { type: "integer" },
          eventIndex: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["pageNumber", "pageMeasureIndex", "eventIndex", "reason"],
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "subtitle",
    "notation",
    "key",
    "tonicPitch",
    "tempo",
    "timeSignature",
    "pages",
    "unresolvedEvents",
    "notes",
  ],
};

const READER_PROMPT = `You are an expert optical music reader. Read every supplied page as one ordered score.
Return only the requested schema. Preserve page order and every measure/event.
Number visible score systems from 1 on each page and assign every measure its systemNumber.
For numbered notation, distinguish octave dots from duration dots geometrically:
- an octave dot must be centered over/under its owning digit;
- a right-side midline dot is a duration dot;
- reject scan specks and broken slur/beam fragments as dots.
Count underline levels per digit, not per beamed group. Classify same-pitch arcs as ties and
different-pitch arcs as slurs. Align lyrics by glyph center and allow untexted melisma notes.
Use quarter-note beats. For jianpu set pitchToken (for example 3' or 5,) and pitchName=null.
For staff notation set pitchName (for example Bb4) and pitchToken=null.
The tonicPitch must include an absolute octave. If the page does not state one, choose a
comfortable child-keyboard register and reduce confidence on octave-ambiguous events.
Every pageNumber must match the supplied PAGE label.`;

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("图片必须是 PNG、JPEG、GIF 或 WebP。");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("单张图片必须大于 0 且不超过 12 MB。");
  }
  return { mimeType: match[1], base64: match[2], bytes };
}

export function validatePages(pages) {
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > MAX_PAGES) {
    throw new Error("每首曲子必须上传 1 到 4 张按顺序排列的图片。");
  }
  return pages.map((page, index) => {
    if (!page || page.pageNumber !== index + 1 || typeof page.dataUrl !== "string") {
      throw new Error("图片页码必须从 1 开始连续排列。");
    }
    const parsed = parseDataUrl(page.dataUrl);
    return {
      pageNumber: index + 1,
      fileName: String(page.fileName || `page-${index + 1}`),
      ...parsed,
    };
  });
}

function extractOpenAIJson(response) {
  const text = response.output_text;
  if (!text) throw new Error("OpenAI Reader 没有返回结构化结果。");
  return JSON.parse(text);
}

function extractGeminiJson(response) {
  const text = response.output_text;
  if (!text) throw new Error("Gemini Reader 没有返回结构化结果。");
  return JSON.parse(text);
}

async function readWithOpenAI(pages, apiKey, model) {
  const client = new OpenAI({ apiKey });
  const content = [{ type: "input_text", text: READER_PROMPT }];
  for (const page of pages) {
    content.push({ type: "input_text", text: `PAGE ${page.pageNumber}: ${page.fileName}` });
    content.push({
      type: "input_image",
      image_url: `data:${page.mimeType};base64,${page.base64}`,
      detail: "high",
    });
  }
  const response = await client.responses.create({
    model,
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "score_reader",
        strict: true,
        schema: SCORE_READER_SCHEMA,
      },
    },
  });
  return extractOpenAIJson(response);
}

async function readWithGemini(pages, apiKey, model) {
  const client = new GoogleGenAI({ apiKey });
  const input = [{ type: "text", text: READER_PROMPT }];
  for (const page of pages) {
    input.push({ type: "text", text: `PAGE ${page.pageNumber}: ${page.fileName}` });
    input.push({ type: "image", data: page.base64, mime_type: page.mimeType });
  }
  const response = await client.interactions.create({
    model,
    input,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: SCORE_READER_SCHEMA,
    },
  });
  return extractGeminiJson(response);
}

async function judgeWithOpenAI(pages, readerA, readerB, apiKey, model) {
  const client = new OpenAI({ apiKey });
  const content = [
    {
      type: "input_text",
      text:
        `${READER_PROMPT}\nYou are now the judge. Compare both independent candidates against ` +
        `the source pages. Resolve each disagreement from visual evidence. Lower confidence below ` +
        `0.9 whenever evidence remains ambiguous.\nREADER A:\n${JSON.stringify(readerA)}\n` +
        `READER B:\n${JSON.stringify(readerB)}`,
    },
  ];
  for (const page of pages) {
    content.push({ type: "input_text", text: `PAGE ${page.pageNumber}: ${page.fileName}` });
    content.push({
      type: "input_image",
      image_url: `data:${page.mimeType};base64,${page.base64}`,
      detail: "high",
    });
  }
  const response = await client.responses.create({
    model,
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "score_judge",
        strict: true,
        schema: SCORE_READER_SCHEMA,
      },
    },
  });
  return extractOpenAIJson(response);
}

function pitchNameToMidi(name) {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
  if (!match) throw new Error(`无法解析音名 ${name}。`);
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + NATURAL_PITCH_CLASSES[match[1]] + accidental;
}

function degreeToMidi(token, tonicMidi) {
  const match = /^([1-7])([',]*)$/.exec(token);
  if (!match) throw new Error(`无法解析简谱音符 ${token}。`);
  const octaveMarks = match[2];
  const octaveShift =
    [...octaveMarks].filter((mark) => mark === "'").length -
    [...octaveMarks].filter((mark) => mark === ",").length;
  return tonicMidi + MAJOR_SCALE[Number(match[1]) - 1] + octaveShift * 12;
}

function validateEvidence(event) {
  const evidence = event.evidence;
  if (!evidence || !Number.isFinite(event.durationBeats) || event.durationBeats <= 0) {
    throw new Error("Reader 返回了无效音符或时值证据。");
  }
  if (event.pitchToken !== null) {
    const expectedDots = Math.abs(evidence.octaveShift);
    if (
      evidence.octaveDots.length !== expectedDots ||
      evidence.octaveDots.some(
        (dot) =>
          Math.abs(dot.horizontalOffset) > 0.35 ||
          dot.verticalGap < 0.05 ||
          dot.verticalGap > 1.25 ||
          dot.diameter < 0.08 ||
          dot.diameter > 0.45,
      )
    ) {
      throw new Error("Reader 返回的八度点没有可靠的数字对齐证据。");
    }
    const baseDuration = 1 / 2 ** evidence.underlineCount;
    const dottedMultiplier =
      evidence.durationDotCount === 0 ? 1 : evidence.durationDotCount === 1 ? 1.5 : 1.75;
    const evidencedDuration = baseDuration * dottedMultiplier + evidence.sustainDashCount;
    if (Math.abs(evidencedDuration - event.durationBeats) > 0.0001) {
      throw new Error("Reader 返回的时值与下划线、附点或延长线证据不一致。");
    }
  }
}

function musicalFingerprint(candidate) {
  return JSON.stringify({
    key: candidate.key,
    tonicPitch: candidate.tonicPitch,
    tempo: candidate.tempo,
    timeSignature: candidate.timeSignature,
    pages: candidate.pages?.map((page) => ({
      pageNumber: page.pageNumber,
      measures: page.measures.map((measure) => ({
        systemNumber: measure.systemNumber,
        durationBeats: measure.durationBeats,
        events: measure.events.map((event) => ({
          pitchToken: event.pitchToken,
          pitchName: event.pitchName,
          durationBeats: event.durationBeats,
          lyric: event.lyric,
          tieToNext: event.tieToNext,
          slurToNext: event.slurToNext,
        })),
      })),
    })),
  });
}

function validateCandidatePageCoverage(candidate, expectedPageCount) {
  const pageNumbers = candidate.pages
    ?.map((page) => page.pageNumber)
    .sort((left, right) => left - right);
  const expected = Array.from({ length: expectedPageCount }, (_, index) => index + 1);
  if (JSON.stringify(pageNumbers) !== JSON.stringify(expected)) {
    throw new Error("模型结果没有完整且唯一地覆盖所有上传页面。");
  }
}

export function candidateToSong(
  candidate,
  sourceId = `recognized-${Date.now()}`,
  verificationStatus = "judge-confirmed",
  expectedPageCount = candidate?.pages?.length ?? 0,
) {
  if (!candidate || !Array.isArray(candidate.pages) || candidate.pages.length === 0) {
    throw new Error("Judge 没有返回任何乐谱页面。");
  }
  validateCandidatePageCoverage(candidate, expectedPageCount);
  if (candidate.notation === "mixed") {
    throw new Error("当前规范谱面尚不支持混合五线谱/简谱页面，请分别上传。");
  }
  const tonicMidi = pitchNameToMidi(candidate.tonicPitch);
  const unresolvedKeys = new Set(
    (candidate.unresolvedEvents ?? []).map(
      (item) => `${item.pageNumber}:${item.pageMeasureIndex}:${item.eventIndex}`,
    ),
  );
  const orderedEntries = [...candidate.pages]
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .flatMap((page) =>
      page.measures.map((measure, pageMeasureIndex) => ({
        pageNumber: page.pageNumber,
        pageMeasureIndex,
        measure,
      })),
    );
  const actualEventKeys = new Set(
    orderedEntries.flatMap(({ pageNumber, pageMeasureIndex, measure }) =>
      measure.events.map(
        (_, eventIndex) => `${pageNumber}:${pageMeasureIndex}:${eventIndex}`,
      ),
    ),
  );
  const invalidUnresolvedKey = [...unresolvedKeys].find(
    (key) => !actualEventKeys.has(key),
  );
  if (invalidUnresolvedKey) {
    throw new Error("Judge 返回了无法定位到乐谱事件的 unresolved 标识。");
  }
  const measures = orderedEntries.map(
    ({ pageNumber, pageMeasureIndex, measure }, measureIndex) => {
    let offsetBeats = 0;
    const events = measure.events.map((event, eventIndex) => {
      validateEvidence(event);
      const midi =
        event.pitchToken !== null
          ? degreeToMidi(event.pitchToken, tonicMidi)
          : event.pitchName !== null
            ? pitchNameToMidi(event.pitchName)
            : null;
      const scoreEvent = {
        id: `${sourceId}-m${measureIndex + 1}-n${eventIndex + 1}`,
        offsetBeats,
        durationBeats: event.durationBeats,
        midi,
        sourcePitchToken: event.pitchToken ?? undefined,
        lyric: event.lyric ?? undefined,
        confidence: unresolvedKeys.has(
          `${pageNumber}:${pageMeasureIndex}:${eventIndex}`,
        )
          ? Math.min(0.5, event.confidence)
          : Math.max(0, Math.min(1, event.confidence)),
        tieToNext: event.tieToNext || undefined,
        slurToNext: event.slurToNext || undefined,
      };
      offsetBeats += event.durationBeats;
      return scoreEvent;
    });
    if (Math.abs(offsetBeats - measure.durationBeats) > 0.0001) {
      throw new Error(`第 ${measureIndex + 1} 小节的音符时值总和不等于小节长度。`);
    }
    return {
      id: `${sourceId}-m${measureIndex + 1}`,
      number: measureIndex + 1,
      durationBeats: measure.durationBeats,
      events,
    };
    },
  );
  const layoutSystems = [];
  const pageBreakBeforeSystem = [];
  let previousSystemKey = "";
  let previousPage = 0;
  orderedEntries.forEach(({ pageNumber, measure }, measureIndex) => {
    const systemKey = `${pageNumber}:${measure.systemNumber}`;
    if (systemKey !== previousSystemKey) {
      if (previousPage > 0 && pageNumber !== previousPage) {
        pageBreakBeforeSystem.push(layoutSystems.length);
      }
      layoutSystems.push([]);
      previousSystemKey = systemKey;
      previousPage = pageNumber;
    }
    layoutSystems.at(-1).push(measureIndex + 1);
  });
  return {
    id: sourceId,
    title: candidate.title || "识别乐谱",
    subtitle: candidate.subtitle || "多模型识别结果",
    key: candidate.key,
    tonicMidi,
    timeSignature: candidate.timeSignature,
    tempo: candidate.tempo,
    suggestedTempo: `♩ = ${candidate.tempo}`,
    measures,
    source: {
      imagePath: "",
      notation: candidate.notation === "staff" ? "staff" : "jianpu",
      overallConfidence:
        measures.flatMap((measure) => measure.events).reduce(
          (sum, event) => sum + event.confidence,
          0,
        ) / Math.max(1, measures.flatMap((measure) => measure.events).length),
      coverage: `完整识别 ${candidate.pages.length} 页，${measures.length} 小节`,
      attribution: "用户上传乐谱",
      recognizer: "OpenAI Reader + Gemini Reader + OpenAI Judge",
      verificationStatus:
        unresolvedKeys.size > 0 ? "unresolved" : verificationStatus,
      notes: [
        ...candidate.notes,
        "多页图片按上传顺序合并；低于 90% 的音符必须人工确认。",
        ...[...(candidate.unresolvedEvents ?? [])].map(
          (item) =>
            `第 ${item.pageNumber} 页第 ${item.pageMeasureIndex + 1} 小节第 ${item.eventIndex + 1} 音：${item.reason}`,
        ),
      ],
      layoutSystems,
      pageBreakBeforeSystem,
    },
  };
}

export async function recognizeScore(pagesInput, env = process.env) {
  const pages = validatePages(pagesInput);
  if (!env.OPENAI_API_KEY || !env.GEMINI_API_KEY) {
    throw new Error("服务端缺少 OPENAI_API_KEY 或 GEMINI_API_KEY。");
  }
  const openAIReaderModel = env.OPENAI_READER_MODEL || "gpt-5.6";
  const openAIJudgeModel = env.OPENAI_JUDGE_MODEL || openAIReaderModel;
  const geminiReaderModel = env.GEMINI_READER_MODEL || "gemini-3.7-flash";
  const [readerA, readerB] = await Promise.all([
    readWithOpenAI(pages, env.OPENAI_API_KEY, openAIReaderModel),
    readWithGemini(pages, env.GEMINI_API_KEY, geminiReaderModel),
  ]);
  validateCandidatePageCoverage(readerA, pages.length);
  validateCandidatePageCoverage(readerB, pages.length);
  const readersAgree =
    musicalFingerprint(readerA) === musicalFingerprint(readerB);
  const judged = readersAgree
    ? { ...readerA, unresolvedEvents: [] }
    : await judgeWithOpenAI(
        pages,
        readerA,
        readerB,
        env.OPENAI_API_KEY,
        openAIJudgeModel,
      );
  const status =
    judged.unresolvedEvents?.length > 0
      ? "unresolved"
      : readersAgree
        ? "reader-agreed"
        : "judge-confirmed";
  return {
    song: candidateToSong(judged, `recognized-${Date.now()}`, status, pages.length),
    verification: {
      status,
      pageCount: pages.length,
      readers: [openAIReaderModel, geminiReaderModel],
      judge: readersAgree ? null : openAIJudgeModel,
      unresolvedCount: judged.unresolvedEvents?.length ?? 0,
    },
  };
}
