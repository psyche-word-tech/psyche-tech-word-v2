import "dotenv/config";
import { LLMClient, Config } from "coze-coding-dev-sdk";
import { createClient } from "@supabase/supabase-js";

const config = new Config();
const client = new LLMClient(config);

const supabaseUrl = process.env.COZE_SUPABASE_URL!;
const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateExamples() {
  // 获取前50个单词（按id升序）
  const { data: words, error } = await supabase
    .from("words_a")
    .select("id, word, meaning")
    .order("id", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Database error:", error.message);
    return;
  }

  if (!words || words.length === 0) {
    console.log("No words found.");
    return;
  }

  console.log(`Found ${words.length} words to process`);

  for (const word of words) {
    try {
      const prompt = `为以下单词生成一个英文例句和中文翻译。

单词: ${word.word}
释义: ${word.meaning}

请按以下格式返回（不要加引号）：
例句: [英文例句]
翻译: [中文翻译]

严格要求：
- 例句必须是"主谓宾"（SVO）句型，即：主语 + 谓语动词 + 宾语
- 例句长度控制在6-12个单词
- 例句要自然、地道，能准确体现单词含义
- 中文翻译要准确、通顺`;

      const response = await client.invoke(
        [{ role: "user", content: prompt }],
        { model: "doubao-seed-1-6-lite-251015", temperature: 0.3 }
      );

      const content = response.content;

      // 解析例句和翻译
      const exampleMatch = content.match(/例句:\s*(.+?)(?=翻译:|$)/s);
      const translationMatch = content.match(/翻译:\s*(.+)/s);

      if (exampleMatch && translationMatch) {
        const example = exampleMatch[1].trim().replace(/^["']|["']$/g, "");
        const translation = translationMatch[1].trim().replace(/^["']|["']$/g, "");

        const { error: updateError } = await supabase
          .from("words_a")
          .update({ example, example_translation: translation })
          .eq("id", word.id);

        if (updateError) {
          console.error(`✗ ${word.word}: Update error -`, updateError.message);
        } else {
          console.log(`✓ ${word.word}: ${example}`);
        }
      } else {
        console.log(`✗ ${word.word}: Failed to parse response`);
        console.log("  Response:", content);
      }
    } catch (error: any) {
      console.error(`✗ ${word.word}: Error -`, error.message || error);
    }

    // 避免请求过快
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("Done!");
}

generateExamples().catch(console.error);
