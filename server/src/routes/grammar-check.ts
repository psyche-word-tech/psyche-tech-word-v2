import { Router } from "express";
import { LLMClient, Config } from "coze-coding-dev-sdk";
import nlp from "compromise";

const router = Router();

// Grammar check endpoint
router.post("/", async (req, res): Promise<void> => {
  try {
    const { text, language = "en-US" } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing text field" });
      return;
    }

    const result = await checkGrammar(text, language);
    res.json(result);
  } catch (error) {
    console.error("Grammar check error:", error);
    res.status(500).json({ error: "Grammar check failed" });
  }
});

interface GrammarIssue {
  title: string;
  message: string;
  replacements?: string[];
}

interface GrammarResult {
  isCorrect: boolean;
  issues: GrammarIssue[];
  originalText: string;
  correctedText?: string;
}

// ============ 主检测入口 ============
async function checkGrammar(text: string, language: string): Promise<GrammarResult> {
  // 1. 尝试调用 LanguageTool（无需 API Key，生产环境可用）
  const ltResult = await callLanguageTool(text, language);
  if (ltResult && (ltResult.issues.length > 0 || ltResult.isCorrect)) {
    return ltResult;
  }

  // 2. fallback: LLMClient（沙箱环境可用）
  const llmResult = await callLLM(text, language);
  if (llmResult) {
    return llmResult;
  }

  // 3. fallback: OpenAI（如果配置了 API Key）
  const openaiResult = await callOpenAI(text, language);
  if (openaiResult) {
    return openaiResult;
  }

  // 4. fallback: 规则引擎（本地，无依赖）
  return ruleBasedGrammarCheck(text);
}

// ============ LanguageTool（免费开源语法检测引擎）============
async function callLanguageTool(text: string, language: string): Promise<GrammarResult | null> {
  try {
    const ltLang = language.startsWith("zh") ? "zh-CN" : "en-US";

    const response = await globalThis.fetch("https://api.languagetool.org/api/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        text,
        language: ltLang,
        enabledOnly: "false",
      }).toString(),
    });

    if (!response.ok) {
      console.error("LanguageTool API error:", response.status, response.statusText);
      return null;
    }

    const data: any = await response.json();
    const issues: GrammarIssue[] = [];

    for (const match of data.matches || []) {
      const shortMsg = match.shortMessage || match.message || "";
      const replacements = (match.replacements || []).slice(0, 3).map((r: any) => r.value);

      // 将英文错误信息翻译为中文
      const title = translateLTMessage(shortMsg, match.rule?.id);
      const message = translateLTMessage(match.message || "", match.rule?.id);

      issues.push({
        title,
        message,
        replacements: replacements.length > 0 ? replacements : undefined,
      });
    }

    return {
      isCorrect: issues.length === 0,
      issues,
      originalText: text,
      correctedText: issues.length > 0 ? generateCorrectedText(text, data.matches) : undefined,
    };
  } catch (error) {
    console.error("LanguageTool error:", error);
    return null;
  }
}

// LanguageTool 错误信息翻译
function translateLTMessage(msg: string, ruleId?: string): string {
  const translations: Record<string, string> = {
    "UPPERCASE_SENTENCE_START": "句子首字母应大写",
    "COMMA_PARENTHESIS_WHITESPACE": "标点符号前后空格使用不当",
    "DOUBLE_PUNCTUATION": "重复标点符号",
    "MORFOLOGIK_RULE_EN_US": "拼写错误",
    "TOO_LONG_SENTENCE": "句子过长，建议拆分",
    "HE_VERB_AGR": "主谓不一致",
    "AGREEMENT_POSTPONED_ADJ": "形容词与名词不一致",
    "ARTICLE_ADJECTIVE_OF": "冠词使用不当",
  };

  // 规则级别翻译
  if (ruleId && translations[ruleId]) {
    return translations[ruleId];
  }

  // 关键词匹配翻译
  if (msg.includes("Possible spelling mistake")) return "可能存在拼写错误";
  if (msg.includes("Did you mean")) return msg; // 保留建议
  if (msg.includes("agreement")) return "主谓不一致";
  if (msg.includes("tense")) return "时态错误";
  if (msg.includes("article")) return "冠词使用不当";
  if (msg.includes("preposition")) return "介词使用不当";
  if (msg.includes("comma")) return "逗号使用不当";
  if (msg.includes("capitalization")) return "大小写错误";
  if (msg.includes("wordiness")) return "表达冗长，建议简化";
  if (msg.includes("passive voice")) return "建议使用主动语态";
  if (msg.includes("Possible typo")) return "可能存在打字错误";

  // 默认返回原始信息（如果已经比较简短）
  return msg.length > 80 ? msg.substring(0, 80) + "..." : msg;
}

function generateCorrectedText(text: string, matches: any[]): string {
  let corrected = text;
  // 从后向前替换，避免位置偏移
  const sorted = [...matches].sort((a, b) => b.offset - a.offset);
  for (const match of sorted) {
    if (match.replacements && match.replacements.length > 0) {
      const before = corrected.slice(0, match.offset);
      const after = corrected.slice(match.offset + match.length);
      corrected = before + match.replacements[0].value + after;
    }
  }
  return corrected;
}

// ============ LLMClient（沙箱环境内置）============
async function callLLM(text: string, _language: string): Promise<GrammarResult | null> {
  try {
    const config = new Config();
    const client = new LLMClient(config);
    const messages = [
      {
        role: "system" as const,
        content:
          'You are a professional English grammar checker. Analyze the text for grammar, syntax, and style errors. Return ONLY a JSON object with this exact structure: {"isCorrect": boolean, "issues": [{"title": "brief Chinese title", "message": "detailed Chinese explanation", "replacements": ["suggestion1", "suggestion2"]}], "correctedText": "the corrected version"}. If no errors, return {"isCorrect": true, "issues": []}.',
      },
      {
        role: "user" as const,
        content: `Check this English text for grammar errors:\n\n"${text}"`,
      },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-2-0-lite-260215",
      temperature: 0.1,
    });

    const content = response.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result: any = JSON.parse(jsonMatch[0]);
      return {
        isCorrect: result.isCorrect ?? result.issues.length === 0,
        issues: result.issues || [],
        originalText: text,
        correctedText: result.correctedText,
      };
    }
    return null;
  } catch (error) {
    console.error("LLMClient error:", error);
    return null;
  }
}

// ============ OpenAI（需要配置 API Key）============
async function callOpenAI(text: string, _language: string): Promise<GrammarResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await globalThis.fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'You are a professional English grammar checker. Analyze the text for grammar, syntax, and style errors. Return ONLY a JSON object with this exact structure: {"isCorrect": boolean, "issues": [{"title": "brief Chinese title", "message": "detailed Chinese explanation", "replacements": ["suggestion1"]}], "correctedText": "corrected version"}.',
          },
          {
            role: "user",
            content: `Check this English text:\n\n"${text}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status);
      return null;
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result: any = JSON.parse(jsonMatch[0]);
      return {
        isCorrect: result.isCorrect ?? result.issues.length === 0,
        issues: result.issues || [],
        originalText: text,
        correctedText: result.correctedText,
      };
    }
    return null;
  } catch (error) {
    console.error("OpenAI error:", error);
    return null;
  }
}

// ============ 增强版规则引擎（使用 compromise NLP）============
function ruleBasedGrammarCheck(text: string): GrammarResult {
  const issues: GrammarIssue[] = [];
  const doc = nlp(text);

  // 1. 句子首字母大写
  checkCapitalization(doc, text, issues);

  // 2. 主谓一致（第三人称单数）
  checkSubjectVerbAgreement(doc, issues);

  // 3. 不可数名词加复数
  checkUncountableNouns(doc, issues);

  // 4. 比较级用法
  checkComparative(doc, issues);

  // 5. there/their/they're 混淆
  checkThereTheirTheyre(text, issues);

  // 6. 介词冗余
  checkPrepositionRedundancy(doc, issues);

  // 7. 冗余表达
  checkWordiness(doc, issues);

  // 8. 连续逗号
  checkDoublePunctuation(text, issues);

  // 9. 大小写一致性
  checkInconsistentCapitalization(text, issues);

  // 10. 冠词使用
  checkArticleUsage(doc, issues);

  // 11. 间接疑问句语序
  checkIndirectQuestion(text, issues);

  // 12. 虚拟语气
  checkSubjunctive(text, issues);

  // 12.5 及物动词后代词格
  checkObjectPronoun(doc, issues);

  // 13. 介词后动词形式
  checkPrepositionVerbForm(doc, issues);

  // 14. 比较级后代词格
  checkComparativePronoun(text, issues);

  // 15. since/for + 时间段
  checkSinceFor(text, issues);

  // 16. suggest/insist + 虚拟语气
  checkSuggestInsistSubjunctive(text, issues);

  // 17. 反身代词
  checkReflexivePronoun(doc, text, issues);

  // 18. 定语从句关系代词（使用 compromise）
  checkRelativeClause(doc, issues);

  // 19. 形容词/副词混淆
  checkAdjectiveAdverb(doc, issues);

  // 20. 时态一致性
  checkTenseConsistency(doc, issues);

  const correctedText = issues.length > 0 ? generateSimpleCorrection(text, issues) : undefined;

  return {
    isCorrect: issues.length === 0,
    issues,
    originalText: text,
    correctedText,
  };
}

// ============ 具体规则实现 ============

function checkCapitalization(doc: any, text: string, issues: GrammarIssue[]) {
  const sentences = doc.sentences().json();
  for (const sent of sentences) {
    const firstWord = sent.text.trim().split(/\s+/)[0];
    if (firstWord && /^[a-z]/.test(firstWord)) {
      issues.push({
        title: "首字母大写",
        message: `句子 "${sent.text.trim().substring(0, 30)}..." 的首字母应大写。`,
        replacements: [firstWord.charAt(0).toUpperCase() + firstWord.slice(1)],
      });
    }
  }
}

function checkSubjectVerbAgreement(doc: any, issues: GrammarIssue[]) {
  const sentences = doc.sentences().json();
  for (const sent of sentences) {
    const sentenceDoc = nlp(sent.text);

    // 检查第三人称单数主语 + 动词原形
    const thirdPersonSubjects = sentenceDoc.match("#Pronoun|#Noun").json();
    const verbs = sentenceDoc.verbs().json();

    for (const subj of thirdPersonSubjects) {
      const word = subj.text?.toLowerCase() || "";
      if (["he", "she", "it"].includes(word)) {
        for (const v of verbs) {
          const verbForms = v.verb || {};
          if (verbForms.infinitive && !verbForms.thirdPerson && !verbForms.past) {
            const verbText = v.text?.toLowerCase() || "";
            if (!verbText.endsWith("s") && !verbText.endsWith("es")) {
              issues.push({
                title: "主谓不一致",
                message: `主语 "${subj.text}" 是第三人称单数，动词 "${v.text}" 应使用第三人称单数形式。`,
                replacements: [`${verbForms.infinitive}s`],
              });
            }
          }
        }
      }
    }
  }
}

function checkUncountableNouns(doc: any, issues: GrammarIssue[]) {
  const uncountable = [
    "advice", "information", "news", "furniture", "equipment",
    "luggage", "baggage", "bread", "rice", "money",
  ];

  for (const noun of uncountable) {
    const pattern = new RegExp(`\\b${noun}s\\b`, "gi");
    const matches = doc.text().match(pattern);
    if (matches) {
      for (const match of matches) {
        issues.push({
          title: "不可数名词",
          message: `"${match}" 是不可数名词，不能加复数形式。应使用 "${noun}" 或 "pieces of ${noun}"。`,
          replacements: [noun, `pieces of ${noun}`],
        });
      }
    }
  }
}

function checkComparative(doc: any, issues: GrammarIssue[]) {
  const comparativePatterns = [
    { pattern: /\bmore\s+(good|bad|far|little|much|many)\b/gi, msg: "good/bad/far/little/much/many 的比较级是不规则变化" },
    { pattern: /\bmost\s+(good|bad|far|little|much|many)\b/gi, msg: "good/bad/far/little/much/many 的最高级是不规则变化" },
  ];

  for (const { pattern, msg } of comparativePatterns) {
    const matches = doc.text().match(pattern);
    if (matches) {
      for (const match of matches) {
        issues.push({
          title: "比较级错误",
          message: `${msg}: "${match}"。`,
          replacements: undefined,
        });
      }
    }
  }
}

function checkThereTheirTheyre(text: string, issues: GrammarIssue[]) {
  const patterns = [
    { regex: /\bthere\s+(is|are|was|were)\s+([a-z]+)\s+\2\b/gi, msg: "there/their/they're 混淆", replacement: "their" },
  ];

  for (const { regex, msg } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      issues.push({
        title: "易混淆词",
        message: `${msg}: "${match[0]}"。`,
        replacements: undefined,
      });
    }
  }
}

function checkPrepositionRedundancy(doc: any, issues: GrammarIssue[]) {
  const redundant = [
    { pattern: /\benter\s+into\b/gi, correct: "enter" },
    { pattern: /\breturn\s+back\b/gi, correct: "return" },
    { pattern: /\brepeat\s+again\b/gi, correct: "repeat" },
    { pattern: /\bmeet\s+together\b/gi, correct: "meet" },
    { pattern: /\bcombine\s+together\b/gi, correct: "combine" },
  ];

  for (const { pattern, correct } of redundant) {
    const matches = doc.text().match(pattern);
    if (matches) {
      for (const match of matches) {
        issues.push({
          title: "冗余表达",
          message: `"${match}" 存在冗余，应简化为 "${correct}"。`,
          replacements: [correct],
        });
      }
    }
  }
}

function checkWordiness(doc: any, issues: GrammarIssue[]) {
  const wordy = [
    { pattern: /\bdue\s+to\s+the\s+fact\s+that\b/gi, concise: "because" },
    { pattern: /\bin\s+spite\s+of\s+the\s+fact\s+that\b/gi, concise: "although" },
    { pattern: /\bin\s+the\s+event\s+that\b/gi, concise: "if" },
    { pattern: /\bat\s+this\s+point\s+in\s+time\b/gi, concise: "now" },
    { pattern: /\bin\s+order\s+to\b/gi, concise: "to" },
    { pattern: /\bwith\s+regard\s+to\b/gi, concise: "about" },
    { pattern: /\bin\s+the\s+near\s+future\b/gi, concise: "soon" },
  ];

  for (const { pattern, concise } of wordy) {
    const matches = doc.text().match(pattern);
    if (matches) {
      for (const match of matches) {
        issues.push({
          title: "表达冗长",
          message: `"${match}" 表达冗长，建议简化为 "${concise}"。`,
          replacements: [concise],
        });
      }
    }
  }
}

function checkDoublePunctuation(text: string, issues: GrammarIssue[]) {
  if (/,\s*,/.test(text)) {
    issues.push({
      title: "连续逗号",
      message: "检测到连续逗号，请删除多余的逗号。",
      replacements: undefined,
    });
  }
}

function checkInconsistentCapitalization(text: string, issues: GrammarIssue[]) {
  const common = ["iPhone", "iPad", "eBay", "WordPress", "JavaScript", "TypeScript"];
  for (const word of common) {
    const wrong = word.toLowerCase();
    const regex = new RegExp(`\\b${wrong}\\b`, "gi");
    const matches = text.match(regex);
    if (matches && matches.some(m => m !== word)) {
      issues.push({
        title: "大小写不一致",
        message: `"${wrong}" 的正确写法是 "${word}"。`,
        replacements: [word],
      });
    }
  }
}

function checkArticleUsage(doc: any, issues: GrammarIssue[]) {
  const text = doc.text();
  // a + 元音音素
  const aVowel = /\ba\s+([aeiouAEIOU][a-zA-Z]*)\b/g;
  let match;
  while ((match = aVowel.exec(text)) !== null) {
    const word = match[1].toLowerCase();
    // 排除以 u 开头但发 /ju:/ 音的词
    if (!word.startsWith("uni") && !word.startsWith("use") && !word.startsWith("euro")) {
      issues.push({
        title: "冠词使用不当",
        message: `"a ${match[1]}" 应改为 "an ${match[1]}"（元音音素前用 an）。`,
        replacements: [`an ${match[1]}`],
      });
    }
  }

  // an + 辅音音素
  const anConsonant = /\ban\s+([^aeiouAEIOU\s][a-zA-Z]*)\b/g;
  while ((match = anConsonant.exec(text)) !== null) {
    const word = match[1].toLowerCase();
    if (!word.startsWith("hour") && !word.startsWith("hon") && !word.startsWith("heir")) {
      issues.push({
        title: "冠词使用不当",
        message: `"an ${match[1]}" 应改为 "a ${match[1]}"（辅音音素前用 a）。`,
        replacements: [`a ${match[1]}`],
      });
    }
  }
}

// 11. 间接疑问句语序
function checkIndirectQuestion(text: string, issues: GrammarIssue[]) {
  const patterns = [
    { regex: /\b(know|wonder|understand|remember|forget|ask|tell|explain|guess|imagine)\s+(?:me\s+)?(?:that\s+)?who\s+is\s+(\w+)/gi, msg: "间接疑问句中应用陈述语序" },
    { regex: /\b(know|wonder|understand|remember|forget|ask|tell|explain|guess|imagine)\s+(?:me\s+)?(?:that\s+)?what\s+is\s+(\w+)/gi, msg: "间接疑问句中应用陈述语序" },
    { regex: /\b(know|wonder|understand|remember|forget|ask|tell|explain|guess|imagine)\s+(?:me\s+)?(?:that\s+)?where\s+is\s+(\w+)/gi, msg: "间接疑问句中应用陈述语序" },
    { regex: /\b(know|wonder|understand|remember|forget|ask|tell|explain|guess|imagine)\s+(?:me\s+)?(?:that\s+)?when\s+is\s+(\w+)/gi, msg: "间接疑问句中应用陈述语序" },
    { regex: /\b(know|wonder|understand|remember|forget|ask|tell|explain|guess|imagine)\s+(?:me\s+)?(?:that\s+)?why\s+is\s+(\w+)/gi, msg: "间接疑问句中应用陈述语序" },
    { regex: /\b(know|wonder|understand|remember|forget|ask|tell|explain|guess|imagine)\s+(?:me\s+)?(?:that\s+)?how\s+is\s+(\w+)/gi, msg: "间接疑问句中应用陈述语序" },
  ];

  for (const { regex, msg } of patterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        issues.push({
          title: "间接疑问句语序错误",
          message: `${msg}: "${match}"。应改为陈述语序（如 who he is 而非 who is he）。`,
          replacements: undefined,
        });
      }
    }
  }
}

// 12. 虚拟语气
function checkSubjunctive(text: string, issues: GrammarIssue[]) {
  const subjunctivePatterns = [
    { regex: /\bif\s+i\s+was\b/gi, correct: "if I were", msg: "虚拟语气中，if I/he/she/it 后面应使用 were 而不是 was" },
    { regex: /\bif\s+he\s+was\b/gi, correct: "if he were", msg: "虚拟语气中，if I/he/she/it 后面应使用 were 而不是 was" },
    { regex: /\bif\s+she\s+was\b/gi, correct: "if she were", msg: "虚拟语气中，if I/he/she/it 后面应使用 were 而不是 was" },
    { regex: /\bif\s+it\s+was\b/gi, correct: "if it were", msg: "虚拟语气中，if I/he/she/it 后面应使用 were 而不是 was" },
    { regex: /\bi\s+wish\s+i\s+was\b/gi, correct: "I wish I were", msg: "wish 后的从句表示与事实相反，应使用 were" },
    { regex: /\bi\s+wish\s+he\s+was\b/gi, correct: "I wish he were", msg: "wish 后的从句表示与事实相反，应使用 were" },
  ];

  for (const { regex, correct, msg } of subjunctivePatterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        issues.push({
          title: "虚拟语气错误",
          message: `${msg}: "${match}"。应改为 "${correct}"。`,
          replacements: [correct],
        });
      }
    }
  }
}

// 12.5 及物动词后代词应使用宾格
function checkObjectPronoun(doc: any, issues: GrammarIssue[]) {
  const transitiveVerbs = ["like", "love", "hate", "see", "watch", "hear", "help", "tell", "ask", "give", "show", "find", "meet", "know", "believe", "remember", "want", "need", "call", "visit", "thank", "trust", "support", "understand", "follow", "join", "leave", "send", "bring", "teach"];
  const objectPronouns: Record<string, string> = {
    he: "him", she: "her", i: "me", we: "us", they: "them",
    who: "whom",
  };

  const text = doc.text();
  for (const verb of transitiveVerbs) {
    const regex = new RegExp(`\\b${verb}\\s+(he|she|i|we|they|who)\\b`, "gi");
    let match;
    while ((match = regex.exec(text)) !== null) {
      const wrong = match[1].toLowerCase();
      const correct = objectPronouns[wrong];
      if (correct) {
        issues.push({
          title: "代词格错误",
          message: `动词 "${verb}" 是及物动词，后面应使用宾格代词。"${match[1]}" 应改为 "${correct}"。`,
          replacements: [correct],
        });
      }
    }
  }
}

// 13. 介词后动词应使用动名词
function checkPrepositionVerbForm(doc: any, issues: GrammarIssue[]) {
  const text = doc.text();
  const preps = ["of", "in", "on", "at", "for", "with", "about", "without", "after", "before", "by", "from", "to"];

  for (const prep of preps) {
    // 介词 + 动词原形（排除特定短语如 "used to", "have to"）
    const regex = new RegExp(`\\b${prep}\\s+([a-z]+)(?:\\s|$|[^a-z])`, "gi");
    let match;
    while ((match = regex.exec(text)) !== null) {
      const verb = match[1].toLowerCase();
      // 排除 be 动词和常见例外
      if (verb === "be" || verb === "do" || verb === "have") continue;
      // 检查 compromise 中该词是否为动词
      const vDoc = nlp(verb);
      if (vDoc.verbs().out("array").length > 0) {
        const gerund = verb.endsWith("e") ? verb.slice(0, -1) + "ing" : verb + "ing";
        issues.push({
          title: "介词后动词形式错误",
          message: `介词 "${prep}" 后应使用动名词形式，"${verb}" 应改为 "${gerund}"。`,
          replacements: [gerund],
        });
      }
    }
  }
}

// 14. 比较级 than/as 后代词应使用宾格
function checkComparativePronoun(text: string, issues: GrammarIssue[]) {
  const patterns = [
    { regex: /\bthan\s+(I|he|she|we|they)\s+(?:is|are|was|were|do|does|did|have|has|had)\b/gi, correct: "him/her/them/us/me", msg: "than/as 后比较对象应使用宾格" },
    { regex: /\bas\s+(?:old|young|tall|short|big|small|fast|slow|good|bad)\s+as\s+(I|he|she|we|they)\b/gi, correct: "me/him/her/us/them", msg: "as...as 后应使用宾格" },
  ];

  for (const { regex, msg } of patterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        issues.push({
          title: "代词格错误",
          message: `${msg}: "${match}"。`,
          replacements: undefined,
        });
      }
    }
  }
}

// 15. since/for + 时间段混淆
function checkSinceFor(text: string, issues: GrammarIssue[]) {
  const patterns = [
    { regex: /\bsince\s+(\d+)\s+(years?|months?|weeks?|days?|hours?|minutes?)\b/gi, msg: "since 后应接时间点（如 2020, last year），时间段应用 for" },
    { regex: /\bfor\s+(\d{4}|last\s+|next\s+|this\s+|yesterday|tomorrow|today)\b/gi, msg: "for 后应接时间段，时间点应用 since" },
  ];

  for (const { regex, msg } of patterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        issues.push({
          title: "since/for 混淆",
          message: `${msg}: "${match}"。`,
          replacements: undefined,
        });
      }
    }
  }
}

// 16. suggest/insist/demand + 虚拟语气
function checkSuggestInsistSubjunctive(text: string, issues: GrammarIssue[]) {
  const patterns = [
    { regex: /\bsuggest\s+(?:me\s+|him\s+|her\s+|them\s+|us\s+)?to\s+([a-z]+)/gi, msg: "suggest 后不接 to do，应使用 suggest that... (should) do 或 suggest doing" },
    { regex: /\binsist\s+(?:me\s+|him\s+|her\s+|them\s+|us\s+)?to\s+([a-z]+)/gi, msg: "insist 后不接 to do，应使用 insist that... (should) do 或 insist on doing" },
    { regex: /\bdemand\s+(?:me\s+|him\s+|her\s+|them\s+|us\s+)?to\s+([a-z]+)/gi, msg: "demand 后不接 to do，应使用 demand that... (should) do" },
  ];

  for (const { regex, msg } of patterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        issues.push({
          title: "虚拟语气动词用法错误",
          message: `${msg}: "${match}"。`,
          replacements: undefined,
        });
      }
    }
  }
}

// 17. 反身代词与主语不匹配
function checkReflexivePronoun(doc: any, text: string, issues: GrammarIssue[]) {
  const patterns = [
    { regex: /\bI\b.*?\b(himself|herself|itself|themselves)\b/gi, msg: "反身代词应与主语 I 匹配为 myself" },
    { regex: /\b(he|she)\b.*?\b(myself|ourselves|themselves)\b/gi, msg: "反身代词应与主语匹配为 himself/herself" },
    { regex: /\b(they)\b.*?\b(myself|yourself|himself|herself|itself)\b/gi, msg: "反身代词应与主语 they 匹配为 themselves" },
  ];

  for (const { regex, msg } of patterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        issues.push({
          title: "反身代词错误",
          message: `${msg}: "${match}"。`,
          replacements: undefined,
        });
      }
    }
  }
}

// 18. 定语从句关系代词（使用 compromise 识别名词类型）
function checkRelativeClause(doc: any, issues: GrammarIssue[]) {
  const text = doc.text();

  // 使用 compromise 获取所有名词
  const nouns = doc.nouns().out("array") as string[];

  for (const noun of nouns) {
    const nounLower = noun.toLowerCase();
    // 检查该名词后是否跟了 who
    const whoPattern = new RegExp(`\\b${nounLower}\\s+who\\b`, "gi");
    const whichPattern = new RegExp(`\\b${nounLower}\\s+which\\b`, "gi");

    if (whoPattern.test(text)) {
      // compromise 可以判断名词是否为人
      const nounDoc = nlp(noun);
      const isPerson = nounDoc.people().out("array").length > 0;
      if (!isPerson) {
        issues.push({
          title: "定语从句关系代词错误",
          message: `非人先行词 "${noun}" 应使用 which/that 引导定语从句，而非 who。`,
          replacements: [`${noun} which`, `${noun} that`],
        });
      }
    }

    if (whichPattern.test(text)) {
      const nounDoc = nlp(noun);
      const isPerson = nounDoc.people().out("array").length > 0;
      if (isPerson) {
        issues.push({
          title: "定语从句关系代词错误",
          message: `人作为先行词 "${noun}" 应使用 who/that 引导定语从句，而非 which。`,
          replacements: [`${noun} who`, `${noun} that`],
        });
      }
    }
  }
}

// 19. 形容词/副词混淆
function checkAdjectiveAdverb(doc: any, issues: GrammarIssue[]) {
  const text = doc.text();
  const adjAdvPairs: Record<string, string> = {
    quick: "quickly", slow: "slowly", careful: "carefully",
    bad: "badly", good: "well", hard: "hard",
    easy: "easily", happy: "happily", sad: "sadly",
    angry: "angrily", quiet: "quietly", loud: "loudly",
    clear: "clearly", recent: "recently", sudden: "suddenly",
    immediate: "immediately", frequent: "frequently", rare: "rarely",
    usual: "usually", normal: "normally", proper: "properly",
    real: "really", true: "truly", exact: "exactly",
    complete: "completely", total: "totally", absolute: "absolutely",
    actual: "actually", definite: "definitely", certain: "certainly",
    possible: "possibly", probable: "probably", likely: "likely",
  };

  // 遍历文本中的形容词-动词组合
  for (const [adj, adv] of Object.entries(adjAdvPairs)) {
    // 动词 + 形容词（错误）
    const pattern = new RegExp(`\\b(drive|speak|write|read|run|walk|talk|work|study|think|act|move|eat|sleep|play|sing|dance|look|sound|smell|taste|feel)\\s+${adj}\\b`, "gi");
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const verb = match.split(/\s+/)[0].toLowerCase();
        // 排除感官动词 + 形容词（这些是合法的：look good, sound nice, taste sweet）
        const senseVerbs = ["look", "sound", "smell", "taste", "feel", "appear", "seem", "become", "get", "grow", "turn", "remain", "stay", "keep"];
        if (senseVerbs.includes(verb)) continue;

        // 排除 be 动词
        if (verb === "be" || verb === "am" || verb === "is" || verb === "are" || verb === "was" || verb === "were") continue;

        issues.push({
          title: "形容词/副词混淆",
          message: `动词 "${verb}" 应使用副词修饰，而不是形容词。`,
          replacements: [`${verb} ${adv}`],
        });
      }
    }
  }
}

// 20. 时态一致性
function checkTenseConsistency(doc: any, issues: GrammarIssue[]) {
  const sentences = doc.sentences().json();
  for (const sent of sentences) {
    const sentDoc = nlp(sent.text);
    const verbs = sentDoc.verbs().json();

    if (verbs.length >= 2) {
      const tenses = verbs.map((v: any) => {
        const tags = v.tags || [];
        if (tags.includes("PastTense")) return "past";
        if (tags.includes("PresentTense")) return "present";
        if (tags.includes("FutureTense")) return "future";
        return "unknown";
      }).filter((t: string) => t !== "unknown");

      const unique = [...new Set(tenses)];
      if (unique.length > 1 && tenses.length >= 2) {
        // 只报告明显的时态混合（过去+现在）
        if (unique.includes("past") && unique.includes("present")) {
          issues.push({
            title: "时态不一致",
            message: `句子中混合使用了不同时态，建议保持时态一致。`,
            replacements: undefined,
          });
        }
      }
    }
  }
}

function generateSimpleCorrection(text: string, issues: GrammarIssue[]): string {
  let corrected = text;
  // 简单的替换逻辑（实际应基于位置精确替换）
  return corrected;
}

export default router;
