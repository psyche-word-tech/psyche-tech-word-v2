import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  console.log("SUPABASE_URL exists:", !!process.env.COZE_SUPABASE_URL);
  console.log("SERVICE_KEY exists:", !!process.env.COZE_SUPABASE_SERVICE_ROLE_KEY);
  
  const supabase = createClient(
    process.env.COZE_SUPABASE_URL!,
    process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data, error } = await supabase
    .from("words_a")
    .select("id, word, example_image_url")
    .order("id")
    .limit(5);
  
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Data:", data?.map((w: any) => ({ id: w.id, word: w.word, hasImage: !!w.example_image_url })));
  }
}

main().catch(console.error);
