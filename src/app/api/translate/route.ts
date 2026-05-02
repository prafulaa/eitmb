import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const SYSTEM_PROMPT = `You are a world-class corporate communications expert, specialized in translating highly technical software/IT issues into calm, reassuring business language for non-technical clients and executives. 

  RULES:
  1. NEVER use technical jargon (e.g., API, DNS, Server, CORS, Repository, PR) in your output.
  2. Frame delays or bugs as 'minor technical roadblocks', 'security adjustments', or 'routine synchronization processes'.
  3. Keep it brief: 2 to 4 sentences maximum.
  4. Always sound in control, competent, and solutions-oriented. 
  
  Example Input: 'The AWS S3 bucket permissions are misconfigured causing a 403 forbidden error on image uploads.'
  Example Output: 'We are currently adjusting some security settings on our storage network to ensure your files remain perfectly safe. Image uploads will be paused momentarily while we finalize the update, but we expect it to be resolved shortly.'`;

export async function POST(request: Request) {
  try {
    const { text, tone } = await request.json();
    const supabase = await createClient();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // 1. Check Authentication
    const { data: { user } } = await supabase.auth.getUser();
    
    let isPro = false;
    let usageCount = 0;

    if (user) {
      // 2. Fetch User Profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("usage_count, is_pro")
        .eq("id", user.id)
        .single();

      if (profile) {
        isPro = profile.is_pro;
        usageCount = profile.usage_count;
      }

      // 3. Check Limits
      if (!isPro && usageCount >= 3) {
        return NextResponse.json({ error: "Limit reached. Please upgrade to Pro." }, { status: 403 });
      }
    } else {
      // For Guests, we'll let the client handle the 3-use limit via localStorage for now
      // but in a "complete" project, we'd ideally require login.
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

    if (!apiKey) {
      return NextResponse.json({ error: "Configuration error." }, { status: 500 });
    }

    // 4. Call DeepSeek API
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Please translate the following technical issue using a ${tone} tone:\n\n${text}` }
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to generate translation." }, { status: 500 });
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    // 5. Update Usage in DB if user is logged in
    if (user) {
      await supabase
        .from("profiles")
        .update({ usage_count: usageCount + 1 })
        .eq("id", user.id);
    }

    return NextResponse.json({ result });

  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
