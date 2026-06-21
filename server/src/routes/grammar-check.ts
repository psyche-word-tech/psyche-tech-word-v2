import { Router } from "express";
import { LLMClient, Config } from "coze-coding-dev-sdk";

const router = Router();

interface GrammarIssue {
  title: string;
  message: string;
  replacements: string[];
}

// ============ LanguageTool API（专业语法检测，免费开源）============
async function callLanguageTool(text: string): Promise<{ isCorrect: boolean; issues: GrammarIssue[] }> {
  const params = new URLSearchParams();
  params.append("text", text);
  params.append("language", "en-US");
  params.append("enabledOnly", "false");

  const response = await fetch("https://api.languagetool.org/api/v2/check", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LanguageTool API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as any;
  const matches = data.matches || [];

  const issues: GrammarIssue[] = matches.map((match: any) => {
    const replacements = (match.replacements || []).map((r: any) => r.value).slice(0, 3);
    // 将 LanguageTool 的英文 message 翻译/优化为中文解释
    const title = translateRuleCategory(match.rule?.category?.id || match.rule?.id || "语法错误");
    const message = buildChineseExplanation(match);
    return { title, message, replacements };
  });

  return {
    isCorrect: issues.length === 0,
    issues: issues.slice(0, 8)
  };
}

function translateRuleCategory(categoryId: string): string {
  const map: Record<string, string> = {
    "GRAMMAR": "语法错误",
    "TYPOS": "拼写错误",
    "CASING": "大小写错误",
    "COLLOQUIALISMS": "口语表达",
    "CONFUSED_WORDS": "易混淆词",
    "CREATIVE_WRITING": "写作建议",
    "MISC": "其他问题",
    "PLAIN_ENGLISH": "简明英语",
    "PUNCTUATION": "标点错误",
    "REDUNDANCY": "冗余表达",
    "SEMANTICS": "语义错误",
    "STYLE": "风格建议",
    "TYPOGRAPHY": "排版问题",
    "WIKIPEDIA": "专有名词",
    "AGREEMENT_ERROR": "主谓一致",
    "ARTICLES": "冠词错误",
    "PREPOSITIONS": "介词错误",
    "TENSES": "时态错误",
    "PASSIVE_VOICE": "被动语态",
    "WORDINESS": "冗长表达",
  };
  return map[categoryId] || "语法问题";
}

function buildChineseExplanation(match: any): string {
  const enMsg = match.message || "";
  const shortMsg = match.shortMessage || "";
  const context = match.context?.text || "";
  const offset = match.offset || 0;
  const length = match.length || 0;
  const wrongWord = context.slice(offset, offset + length);

  // 构建中文解释
  let explanation = enMsg;

  // 常见错误的中文映射
  const translations: Record<string, string> = {
    "Possible spelling mistake": "可能存在拼写错误",
    "Possible agreement error": "可能存在主谓一致错误",
    "Did you mean": "你是否想表达",
    "Consider using": "建议使用",
    "Possible typo": "可能存在打字错误",
    "This word is normally not capitalized": "此单词通常不需要大写",
    "This sentence does not start with an uppercase letter": "句子首字母需要大写",
    "Use a comma before": "在...之前需要使用逗号",
    "Two consecutive dots": "出现了两个连续的句号",
    "Missing space": "缺少空格",
    "Extra space": "多余的空格",
  };

  for (const [en, zh] of Object.entries(translations)) {
    if (enMsg.includes(en)) {
      explanation = zh + "。";
      break;
    }
  }

  if (wrongWord) {
    explanation += ` 检测到问题词："${wrongWord}"`;
  }

  if (shortMsg && shortMsg !== enMsg && shortMsg.length < 50) {
    explanation += `（${shortMsg}）`;
  }

  return explanation;
}

// ============ 规则引擎：基础语法检测（作为 fallback）============
function ruleBasedGrammarCheck(text: string): { isCorrect: boolean; issues: GrammarIssue[] } {
  const issues: GrammarIssue[] = [];
  const lowerText = text.toLowerCase();

  // 1. be + 动词原形（非进行时）
  const beVerbPattern = /\b(i|you|we|they)\s+(am|are|is)\s+(go|eat|play|watch|read|write|speak|learn|study|work|live|love|like|hate|want|need|see|hear|feel|know|think|believe|understand|remember|forget|help|make|take|give|tell|say|talk|walk|run|jump|swim|dance|sing|cook|clean|wash|open|close|start|stop|try|use|find|lose|win|lose|buy|sell|pay|cost|spend|send|get|become|seem|look|sound|taste|smell|appear|happen|matter)\b/g;
  let match;
  while ((match = beVerbPattern.exec(lowerText)) !== null) {
    const subject = match[1];
    const beVerb = match[2];
    const verb = match[3];
    const originalVerb = text.slice(match.index + match[0].indexOf(verb), match.index + match[0].indexOf(verb) + verb.length);
    issues.push({
      title: "主谓不一致 / 时态错误",
      message: `"${subject} ${beVerb} ${verb}" 中，be动词后面不能直接接动词原形（除非是现在进行时 ${beVerb} ${verb}ing 或被动语态 ${beVerb} ${verb}ed）。请检查时态或动词形式。`,
      replacements: [
        `${subject} ${verb}s`,
        `${subject} ${verb}ed`,
        `${subject} ${beVerb} ${originalVerb}ing`,
        `${subject} will ${verb}`
      ].filter((v, i, a) => a.indexOf(v) === i)
    });
  }

  // 2. 第三人称单数 + don't
  const thirdPersonDont = /\b(he|she|it)\s+don't\b/gi;
  while ((match = thirdPersonDont.exec(text)) !== null) {
    issues.push({
      title: "主谓不一致",
      message: `第三人称单数（he/she/it）应使用 "doesn't" 而不是 ""。`,
      replacements: [text.slice(match.index, match.index + match[0].length).replace(/don't/i, "doesn't")]
    });
  }

  // 3. 第一/二人称 + 动词三单
  const pluralVerbS = /\b(i|you|we|they)\s+(goes|plays|eats|watches|reads|writes|speaks|learns|studies|works|lives|loves|likes|hates|wants|needs|sees|hears|feels|knows|thinks|believes|understands|remembers|forgets|helps|makes|takes|gives|tells|says|talks|walks|runs|jumps|swims|dances|sings|cooks|cleans|washes|opens|closes|starts|stops|tries|uses|finds|loses|wins|buys|sells|pays|spends|sends|gets|becomes|seems|looks|sounds|tastes|smells|appears|happens|matters)\b/gi;
  while ((match = pluralVerbS.exec(text)) !== null) {
    const subject = match[1].toLowerCase();
    const verb = match[2].toLowerCase();
    const baseVerb = verb.replace(/es$/, "").replace(/s$/, "");
    issues.push({
      title: "主谓不一致",
      message: `主语 "${subject}" 是第一/二人称或复数，谓语动词不应加 -s/-es。`,
      replacements: [`${subject} ${baseVerb}`]
    });
  }

  // 4. yesterday + 现在时
  const yesterdayPresent = /\byesterday\b[^.!?]*\b(go|eat|play|watch|read|write|speak|learn|study|work|live|love|like|hate|want|need|see|hear|feel|know|think|believe|understand|remember|forget|help|make|take|give|tell|say|talk|walk|run|jump|swim|dance|sing|cook|clean|wash|open|close|start|stop|try|use|find|lose|win|buy|sell|pay|spend|send|get|become|seem|look|sound|taste|smell|appear|happen|matter|am|are|is|have|has|do|does)\b/gi;
  while ((match = yesterdayPresent.exec(text)) !== null) {
    const verb = match[1].toLowerCase();
    if (["am", "are", "is", "have", "has", "do", "does"].includes(verb)) {
      issues.push({
        title: "时态错误",
        message: `"yesterday" 表示过去时间，应使用过去时态。`,
        replacements: ["yesterday... was/were/had/did..."]
      });
    } else {
      issues.push({
        title: "时态错误",
        message: `"yesterday" 表示过去时间，谓语动词应使用过去式。`,
        replacements: ["yesterday... " + verb + "ed / " + verb + "（不规则变化）"]
      });
    }
  }

  // 5. tomorrow + 过去时
  const tomorrowPast = /\btomorrow\b[^.!?]*\b(went|ate|played|watched|read|wrote|spoke|learned|studied|worked|lived|loved|liked|hated|wanted|needed|saw|heard|felt|knew|thought|believed|understood|remembered|forgot|helped|made|took|gave|told|said|talked|walked|ran|jumped|swam|danced|sang|cooked|cleaned|washed|opened|closed|started|stopped|tried|used|found|lost|won|bought|sold|paid|spent|sent|got|became|seemed|looked|sounded|tasted|smelled|appeared|happened|mattered|was|were|had|did)\b/gi;
  while ((match = tomorrowPast.exec(text)) !== null) {
    issues.push({
      title: "时态错误",
      message: `"tomorrow" 表示将来时间，应使用将来时态或一般现在时。`,
      replacements: ["tomorrow... will + 动词原形 / be going to + 动词原形"]
    });
  }

  // 6. 冠词 a/an 错误：a + 元音
  const aVowel = /\ba\s+([aeiou][a-z]*)\b/gi;
  while ((match = aVowel.exec(text)) !== null) {
    const word = match[1];
    if (!word.match(/^u[nlrs]/i)) {
      issues.push({
        title: "冠词错误",
        message: `元音音素开头的单词前应使用 "an" 而不是 "a"。`,
        replacements: [`an ${word}`]
      });
    }
  }

  // 7. 冠词 an + 辅音
  const anConsonant = /\ban\s+([^aeiou\s][a-z]*)\b/gi;
  while ((match = anConsonant.exec(text)) !== null) {
    const word = match[1];
    issues.push({
      title: "冠词错误",
      message: `辅音音素开头的单词前应使用 "a" 而不是 "an"。`,
      replacements: [`a ${word}`]
    });
  }

  // 8. go school / come school 缺少介词
  const goSchool = /\b(go|come)\s+(school|college|university|hospital|church|prison)\b/gi;
  while ((match = goSchool.exec(text)) !== null) {
    const verb = match[1];
    const place = match[2];
    issues.push({
      title: "介词缺失",
      message: `表示去某地时，${verb} 后应加介词 "to"。`,
      replacements: [`${verb} to ${place}`]
    });
  }

  // 9. She have / He have / It have
  const sheHave = /\b(she|he|it)\s+have\b/gi;
  while ((match = sheHave.exec(text)) !== null) {
    const subject = match[1].toLowerCase();
    issues.push({
      title: "主谓不一致",
      message: `第三人称单数 "${subject}" 应搭配 "has" 而不是 "have"。`,
      replacements: [`${subject} has`]
    });
  }

  // 10. They has / We has / You has
  const theyHas = /\b(they|we|you)\s+has\b/gi;
  while ((match = theyHas.exec(text)) !== null) {
    const subject = match[1].toLowerCase();
    issues.push({
      title: "主谓不一致",
      message: `复数主语 "${subject}" 应搭配 "have" 而不是 "has"。`,
      replacements: [`${subject} have`]
    });
  }

  // 11. very + 比较级
  const veryCompare = /\bvery\s+(better|worse|more|most|less|least|bigger|smaller|taller|shorter|faster|slower|stronger|weaker|older|younger|newer|older|hotter|colder|warmer|cooler|cheaper|more expensive|happier|sadder|angrier|busier|easier|harder|earlier|later|closer|farther|further|deeper|higher|lower|wider|narrower|longer|shorter|heavier|lighter|thicker|thinner|cleaner|dirtier|brighter|darker|quieter|louder|safer|more dangerous|healthier|sicker|richer|poorer|prettier|uglier)\b/gi;
  while ((match = veryCompare.exec(text)) !== null) {
    issues.push({
      title: "修饰语错误",
      message: `"very" 不能修饰比较级或最高级，应使用 "much" 或 "far"。`,
      replacements: [match[0].replace(/very/i, "much")]
    });
  }

  // 12. 双重否定
  const doubleNegative = /\b(don't|doesn't|didn't|can't|couldn't|won't|wouldn't|shouldn't|mustn't|haven't|hasn't|hadn't|isn't|aren't|wasn't|weren't|nobody|nothing|nowhere|no one|neither|nor)\b[^.!?]*\b(nothing|nobody|nowhere|no one|neither|nor|never|no)\b/gi;
  while ((match = doubleNegative.exec(text)) !== null) {
    issues.push({
      title: "双重否定",
      message: `英语中双重否定会造成语义混乱，应只保留一个否定词。`,
      replacements: ["建议改为单重否定表达"]
    });
  }

  // 13. its/it's 混淆
  const itsIts = /\bits\s+(is|was|has|not|going|coming|done|been|being)\b/gi;
  while ((match = itsIts.exec(text)) !== null) {
    issues.push({
      title: "拼写/用法错误",
      message: `"its" 是所有格代词，表示"它的"。如果是 "it is" 的缩写，应使用 "it's"。`,
      replacements: [match[0].replace(/its/i, "it's")]
    });
  }

  // 14. very + 动词原形
  const veryVerb = /\bvery\s+(like|love|hate|enjoy|prefer|want|need|know|think|believe|understand|remember|forget|agree|disagree)\b/gi;
  while ((match = veryVerb.exec(text)) !== null) {
    const verb = match[1].toLowerCase();
    issues.push({
      title: "修饰语错误",
      message: `"very" 不能直接修饰动词 "${verb}"。应使用 "I ${verb} ... very much" 或 "I really ${verb}" 的结构。`,
      replacements: [`I really ${verb}`, `I ${verb} it very much`]
    });
  }

  // 15. more + 比较级
  const moreComparative = /\bmore\s+(taller|shorter|bigger|smaller|faster|slower|stronger|weaker|older|younger|newer|hotter|colder|warmer|cooler|cheaper|happier|sadder|angrier|busier|easier|harder|earlier|later|closer|farther|further|deeper|higher|lower|wider|narrower|longer|heavier|lighter|thicker|thinner|cleaner|dirtier|brighter|darker|quieter|louder|safer|healthier|sicker|richer|poorer|prettier|uglier|better|worse)\b/gi;
  while ((match = moreComparative.exec(text)) !== null) {
    const word = match[1].toLowerCase();
    issues.push({
      title: "比较级错误",
      message: `"${word}" 本身已是比较级，不能与 "more" 连用（双重比较级）。直接使用 "${word}" 即可，或用 "much ${word}" 加强语气。`,
      replacements: [word, `much ${word}`]
    });
  }

  // 16. have/has + 过去式
  const havePast = /\b(have|has|had)\s+(went|did|saw|took|came|gave|knew|began|drank|drove|ate|fell|flew|forgot|got|hid|held|kept|left|lost|made|meant|met|paid|ran|said|sat|slept|spoke|spent|stood|swam|taught|told|thought|understood|woke|wrote|brought|bought|caught|fought|taught|thought|sought)\b/gi;
  while ((match = havePast.exec(text)) !== null) {
    const aux = match[1].toLowerCase();
    const wrongVerb = match[2].toLowerCase();
    const pastPartMap: Record<string, string> = {
      went: "gone", did: "done", saw: "seen", took: "taken", came: "come",
      gave: "given", knew: "known", began: "begun", drank: "drunk",
      drove: "driven", ate: "eaten", fell: "fallen", flew: "flown",
      forgot: "forgotten", got: "gotten/got", hid: "hidden", held: "held",
      kept: "kept", left: "left", lost: "lost", made: "made", meant: "meant",
      met: "met", paid: "paid", ran: "run", said: "said", sat: "sat",
      slept: "slept", spoke: "spoken", spent: "spent", stood: "stood",
      swam: "swum", taught: "taught", told: "told", thought: "thought",
      understood: "understood", woke: "woken", wrote: "written",
      brought: "brought", bought: "bought", caught: "caught",
      fought: "fought", sought: "sought"
    };
    const correct = pastPartMap[wrongVerb] || `${wrongVerb}ed`;
    issues.push({
      title: "时态错误",
      message: `完成时态 (${aux}) 后应使用过去分词，而不是过去式 "${wrongVerb}"。`,
      replacements: [`${aux} ${correct}`]
    });
  }

  // 17. There have/has
  const thereHave = /\bthere\s+(have|has)\b/gi;
  while ((match = thereHave.exec(text)) !== null) {
    issues.push({
      title: "句型错误",
      message: `"There be" 句型表示"存在有"，不能用 "have/has"。应使用 "There is/are"。`,
      replacements: ["There is", "There are"]
    });
  }

  // 18. am/is/are + 动词原形
  const beVerbBase = /\b(am|is|are|was|were)\s+(agree|disagree|like|love|hate|want|need|know|think|believe|understand|remember|forget|prefer|enjoy|hope|wish)\b/gi;
  while ((match = beVerbBase.exec(text)) !== null) {
    const verb = match[2].toLowerCase();
    issues.push({
      title: "动词用法错误",
      message: `"${verb}" 是实义动词，不需要加 be 动词。直接说 "I ${verb}" 即可。`,
      replacements: [verb]
    });
  }

  // 19. 情态动词 + 动词s形式
  const modalVerbS = /\b(can|could|will|would|shall|should|may|might|must|need)\s+([a-z]+)s\b/gi;
  while ((match = modalVerbS.exec(text)) !== null) {
    const modal = match[1].toLowerCase();
    const verb = match[2].toLowerCase();
    const nonVerbs = ["let", "thi", "hi", "wa", "ha", "do", "doe", "i", "wa", "i"];
    if (!nonVerbs.includes(verb) && verb.length > 1) {
      issues.push({
        title: "情态动词用法错误",
        message: `情态动词 "${modal}" 后必须接动词原形，不能加 "s"。`,
        replacements: [`${modal} ${verb}`]
      });
    }
  }

  // 20. want to / need to / like to + 动词s形式
  const toVerbS = /\b(want|need|like|love|hate|prefer|begin|start|try|learn|forget|remember)\s+to\s+([a-z]+)s\b/gi;
  while ((match = toVerbS.exec(text)) !== null) {
    const verb = match[2].toLowerCase();
    const nonVerbs = ["thi", "hi", "wa", "ha", "do", "doe", "i"];
    if (!nonVerbs.includes(verb) && verb.length > 1) {
      issues.push({
        title: "不定式错误",
        message: `"to" 后应接动词原形，不能加 "s"。`,
        replacements: [`to ${verb}`]
      });
    }
  }

  // 21. don't/doesn't/didn't + 动词s形式
  const notVerbS = /\b(don't|doesn't|didn't|can't|couldn't|won't|wouldn't|shouldn't|mustn't|haven't|hasn't|hadn't|isn't|aren't|wasn't|weren't)\s+([a-z]+)s\b/gi;
  while ((match = notVerbS.exec(text)) !== null) {
    const verb = match[2].toLowerCase();
    const nonVerbs = ["thi", "hi", "wa", "ha", "do", "doe", "i", "wa"];
    if (!nonVerbs.includes(verb) && verb.length > 1) {
      issues.push({
        title: "动词形式错误",
        message: `助动词/情态动词否定式后应接动词原形，不能加 "s"。`,
        replacements: [verb]
      });
    }
  }

  // 22. let + 主语 + 动词原形
  const letVerbS = /\blet\s+\w+\s+([a-z]{2,})s\b/gi;
  while ((match = letVerbS.exec(text)) !== null) {
    const verb = match[1].toLowerCase();
    issues.push({
      title: "使役动词用法错误",
      message: `"let" 后的宾语补足语应使用动词原形。`,
      replacements: [verb]
    });
  }

  return {
    isCorrect: issues.length === 0,
    issues: issues.slice(0, 5)
  };
}

// ============ OpenAI API 调用 ============
async function callOpenAI(text: string): Promise<{ isCorrect: boolean; issues: GrammarIssue[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 OPENAI_API_KEY");
  }

  const systemPrompt = `你是一位专业的英语老师。请全面检测用户输入的英文句子，包括语法和逻辑两个方面。

检测要求：
1. **语法检测**：检查主谓一致、时态、冠词、介词、词序等语法问题
2. **逻辑检测**：检查语义是否合理、表达是否通顺、是否符合英语表达习惯
3. 给出中文解释（问题类型 + 详细说明）
4. 提供修正建议

请按以下JSON格式返回结果（不要包含任何其他内容）：
{
  "isCorrect": true/false,
  "issues": [
    {
      "title": "问题类型",
      "message": "详细的中文解释",
      "replacements": ["建议的修正"]
    }
  ]
}

只返回JSON，不要有其他解释文字。`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请检测以下英文句子的语法：\n${text}` }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || "";

  let result;
  try {
    result = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("OpenAI返回格式错误");
    }
  }

  return result;
}

// ============ 主路由 ============
router.post("/", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "缺少文本内容" });
    }

    let result: { isCorrect: boolean; issues: GrammarIssue[] } | null = null;
    let usedMethod = "";
    let errorLog = "";

    // 1. 优先使用 LanguageTool（专业语法检测引擎，免费）
    try {
      result = await callLanguageTool(text);
      usedMethod = "languagetool";
    } catch (ltError: any) {
      errorLog = `LanguageTool failed: ${ltError.message}; `;

      // 2. 尝试 LLMClient（沙箱环境）
      try {
        const config = new Config();
        const client = new LLMClient(config);

        const messages = [
          {
            role: "system" as const,
            content: `你是一位专业的英语老师。请全面检测用户输入的英文句子，包括语法和逻辑两个方面。

检测要求：
1. **语法检测**：检查主谓一致、时态、冠词、介词、词序等语法问题
2. **逻辑检测**：检查语义是否合理、表达是否通顺、是否符合英语表达习惯
3. 给出中文解释（问题类型 + 详细说明）
4. 提供修正建议

请按以下JSON格式返回结果（不要包含任何其他内容）：
{
  "isCorrect": true/false,
  "issues": [
    {
      "title": "问题类型（如：主谓不一致、时态错误、逻辑错误、表达不当等）",
      "message": "详细的中文解释",
      "replacements": ["建议的修正单词、短语或完整句子"]
    }
  ]
}

只返回JSON，不要有其他解释文字。`
          },
          {
            role: "user" as const,
            content: `请检测以下英文句子的语法：\n${text}`
          }
        ];

        const response = await client.invoke(messages, {
          model: "doubao-seed-2-0-lite-260215",
          temperature: 0.3
        });

        try {
          result = JSON.parse(response.content);
        } catch {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("AI返回格式错误");
          }
        }
        usedMethod = "llm";
      } catch (llmError: any) {
        errorLog += `LLMClient failed: ${llmError.message}; `;

        // 3. 尝试 OpenAI API
        try {
          result = await callOpenAI(text);
          usedMethod = "openai";
        } catch (openaiError: any) {
          errorLog += `OpenAI failed: ${openaiError.message}; `;

          // 4. 回退到规则引擎
          result = ruleBasedGrammarCheck(text);
          usedMethod = "rule";
        }
      }
    }

    res.json({
      success: true,
      text,
      ...result,
      _method: usedMethod,
      ...(usedMethod === "rule" ? { _note: "当前使用基础规则检测，结果可能不够全面。" } : {})
    });

  } catch (error: any) {
    console.error("Grammar check error:", error.message);
    res.status(500).json({
      error: "语法检测失败，请稍后重试",
      details: error.message
    });
  }
});

export default router;
