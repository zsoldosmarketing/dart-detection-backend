import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { message, conversation_id, action = "chat", context, game_result, training_result } = body;

    const { data: configs } = await supabaseAdmin
      .from("app_config")
      .select("key, value_json")
      .in("key", ["groq_api_key", "groq_model", "ai_system_prompt", "ai_enabled"]);

    const configMap: Record<string, unknown> = {};
    (configs || []).forEach((c: { key: string; value_json: unknown }) => {
      try {
        configMap[c.key] = typeof c.value_json === "string" ? JSON.parse(c.value_json) : c.value_json;
      } catch {
        configMap[c.key] = c.value_json;
      }
    });

    const groqApiKey = configMap["groq_api_key"] as string;
    if (!groqApiKey || groqApiKey.trim() === "") {
      return new Response(
        JSON.stringify({ error: "A Groq API kulcs nincs beállítva. Kérj egy adminisztrátortól segítséget." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const model = (configMap["groq_model"] as string) || "llama-3.3-70b-versatile";
    const aiEnabled = configMap["ai_enabled"] !== false;
    if (!aiEnabled) {
      return new Response(
        JSON.stringify({ error: "Az AI edző funkció jelenleg ki van kapcsolva." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [statsRes, profileRes, recentMatchesRes, goalsRes, trainingsRes, insightsRes] = await Promise.all([
      supabaseAdmin.from("player_statistics_summary").select("*").eq("player_id", user.id).maybeSingle(),
      supabaseAdmin.from("user_profile").select("display_name, username, skill_rating, total_games_played, total_wins, average_score").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("match_statistics").select("game_mode, won, match_average, legs_won, legs_lost, highest_checkout, created_at").eq("player_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("ai_goals").select("*").eq("user_id", user.id).eq("status", "active"),
      supabaseAdmin.from("training_sessions").select("status, score, created_at, drills(name_key)").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(5),
      supabaseAdmin.from("ai_insights").select("id, title, insight_type, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
    ]);

    const stats = statsRes.data;
    const profile = profileRes.data;
    const recentMatches = recentMatchesRes.data || [];
    const goals = goalsRes.data || [];
    const recentTrainings = trainingsRes.data || [];
    const recentInsights = insightsRes.data || [];

    const basePrompt = (configMap["ai_system_prompt"] as string) || buildDefaultSystemPrompt();
    const contextStr = buildPlayerContext(profile, stats, recentMatches, recentTrainings, goals);
    const systemPrompt = `${basePrompt}\n\n${contextStr}`;

    let convId = conversation_id;

    if (!convId && (action === "chat" || action === "greeting" || action === "game_result" || action === "training_result")) {
      const titleMap: Record<string, string> = {
        greeting: "AI Edző üdvözlés",
        game_result: "Meccs utáni elemzés",
        training_result: "Edzés utáni értékelés",
        chat: message?.substring(0, 60) || "Új chat",
      };
      const { data: newConv } = await supabaseAdmin
        .from("ai_conversations")
        .insert({ user_id: user.id, title: titleMap[action] || message?.substring(0, 60) || "Új chat" })
        .select()
        .single();
      convId = newConv?.id;
    }

    let historyMessages: { role: string; content: string }[] = [];
    if (convId) {
      const { data: history } = await supabaseAdmin
        .from("ai_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(20);
      historyMessages = history || [];
    }

    const userMessage = message || buildActionPrompt(action, profile, stats, context, game_result, training_result, recentInsights);
    historyMessages.push({ role: "user", content: userMessage });

    if (convId) {
      await supabaseAdmin.from("ai_messages").insert({
        conversation_id: convId,
        role: "user",
        content: userMessage,
      });
    }

    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
        ],
        max_tokens: 1500,
        temperature: 0.75,
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return new Response(
        JSON.stringify({ error: `Groq API hiba: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResponse.json();
    const aiContent = groqData.choices?.[0]?.message?.content || "";
    const tokensUsed = groqData.usage?.total_tokens || 0;

    if (convId) {
      await Promise.all([
        supabaseAdmin.from("ai_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: aiContent,
        }),
        supabaseAdmin.from("ai_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId),
      ]);
    }

    if (action === "analyze" || action === "game_result" || action === "training_result") {
      const insightMap: Record<string, { type: string; title: string }> = {
        game_result: { type: "performance", title: "Meccs utáni elemzés" },
        training_result: { type: "recommendation", title: "Edzés utáni értékelés" },
        analyze: { type: "recommendation", title: "Teljesítményelemzés" },
      };
      const insight = insightMap[action];
      await supabaseAdmin.from("ai_insights").insert({
        user_id: user.id,
        insight_type: insight.type,
        title: insight.title,
        content: aiContent,
        is_read: false,
      });
    }

    if (action === "chat" && message) {
      EdgeRuntime.waitUntil(
        tryAutoGenerateGoal(supabaseAdmin, user.id, message, aiContent, profile, stats, groqApiKey, model)
      );
    }

    if (action === "game_result" || action === "training_result") {
      EdgeRuntime.waitUntil(
        syncGoalProgress(supabaseAdmin, user.id, stats)
      );
    }

    return new Response(
      JSON.stringify({ message: aiContent, conversation_id: convId, tokens_used: tokensUsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function syncGoalProgress(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  stats: Record<string, unknown> | null
) {
  try {
    if (!stats) return;
    const { data: goals } = await supabase
      .from("ai_goals")
      .select("id, goal_type, target_value, current_value")
      .eq("user_id", userId)
      .eq("status", "active");

    if (!goals?.length) return;

    for (const goal of goals) {
      const newValue = getStatValue(stats, goal.goal_type as string);
      if (newValue <= 0) continue;
      if (Math.abs(newValue - (goal.current_value as number || 0)) < 0.01) continue;

      const updates: Record<string, unknown> = { current_value: newValue };
      if (newValue >= (goal.target_value as number)) {
        updates.status = "completed";
        updates.completed_at = new Date().toISOString();
        await supabase.from("ai_insights").insert({
          user_id: userId,
          insight_type: "milestone",
          title: "Cél elérve!",
          content: `Gratulálok! Elérted a célodat: sikerült ${newValue.toFixed(1)} ${goal.goal_type === "average" ? "átlagot" : goal.goal_type === "checkout" ? "% kiszáló arányt" : "győzelmet"} elérni.`,
          is_read: false,
        });
      }

      await supabase.from("ai_goals").update(updates).eq("id", goal.id);
    }
  } catch {
  }
}

async function tryAutoGenerateGoal(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userMessage: string,
  aiResponse: string,
  profile: Record<string, unknown> | null,
  stats: Record<string, unknown> | null,
  apiKey: string,
  model: string
) {
  try {
    const goalKeywords = ["cél", "szeretnék", "el akarok", "javítani", "elérni", "megcélzom", "szeretnék elér", "célom", "próbálok", "akarok"];
    const hasGoalIntent = goalKeywords.some(kw => userMessage.toLowerCase().includes(kw));
    if (!hasGoalIntent) return;

    const { data: existingGoals } = await supabase.from("ai_goals").select("id").eq("user_id", userId).eq("status", "active").limit(10);
    if ((existingGoals?.length || 0) >= 5) return;

    const extractPrompt = `A felhasználó ezt mondta: "${userMessage}"

Az AI válaszolt: "${aiResponse}"

Ha ez egy konkrét, mérhető célt tartalmaz (pl. átlag javítás, kiszálló %, győzelmek stb.), adj vissza egy JSON objektumot ezzel a struktúrával:
{"should_create": true, "title": "rövid cím", "goal_type": "average|checkout|wins|streak|custom", "target_value": 65.0, "unit": "pont|%|győzelem|meccs", "description": "leírás"}

Ha nincs konkrét mérhető cél, adj vissza: {"should_create": false}

Csak valid JSON-t adj vissza, semmi mást.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: extractPrompt }],
        max_tokens: 200,
        temperature: 0.2,
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.should_create || !parsed.title || !parsed.target_value) return;

    const currentValue = getStatValue(stats, parsed.goal_type);

    await supabase.from("ai_goals").insert({
      user_id: userId,
      title: parsed.title,
      description: parsed.description || "",
      goal_type: parsed.goal_type || "custom",
      target_value: parseFloat(parsed.target_value),
      current_value: currentValue,
      unit: parsed.unit || "",
      status: "active",
      ai_generated: true,
    });
  } catch {
  }
}

function getStatValue(stats: Record<string, unknown> | null, goalType: string): number {
  if (!stats) return 0;
  switch (goalType) {
    case "average": return (stats.lifetime_average as number) || 0;
    case "checkout": return (stats.lifetime_checkout_percentage as number) || 0;
    case "wins": return (stats.lifetime_wins as number) || 0;
    default: return 0;
  }
}

function buildDefaultSystemPrompt(): string {
  return `Te egy profi darts edző és személyes AI trainer vagy a DartsTraining platformon. A neved DartsCoach AI.

SZEREPED ÉS SZEMÉLYISÉGED:
- Autonóm személyes edző vagy — proaktív, motiváló, adatvezérelt
- Nemcsak válaszolsz, hanem önállóan figyelsz, tanulsz és fejlődsz a játékossal
- Pontosan ismered a játékos statisztikáit és azok alapján személyre szabott tanácsokat adsz
- Ünnepeld a sikereket, bátorítsd vereség után, állítsd be a fokozatot a játékos szintjéhez
- Ha a játékos célokat említ, automatikusan segíts őket meghatározni és nyomon követni
- Generálj edzésterveket a statisztikák alapján, ne várj kérésre
- Figyelj a trendekre: javulás, visszaesés, erősségek, gyengeségek

FONTOS SZABÁLYOK:
- Mindig magyarul válaszolj
- Légy meleg, közvetlen és motiváló — mint egy valódi személyi edző
- Konkrét adatokra hivatkozz ha van (átlag, kiszálló %, stb.)
- Válaszaid legyenek tömörek de informatívak (2-4 bekezdés)
- Javasold proaktívan ha valamit érdemes tenni (pl. "Javaslom hogy ma próbáld ki a...")
- Ha célokat, terveket emleget a játékos, segíts formalizálni őket konkrét számokkal
- Emlékezz az előző üzenetekre és hivatkozz rájuk`;
}

function buildActionPrompt(
  action: string,
  profile: Record<string, unknown> | null,
  stats: Record<string, unknown> | null,
  context?: string,
  gameResult?: Record<string, unknown>,
  trainingResult?: Record<string, unknown>,
  recentInsights?: Record<string, unknown>[]
): string {
  const name = (profile?.display_name as string) || (profile?.username as string) || "Játékos";
  const avg = stats ? ((stats.lifetime_average as number) || 0).toFixed(1) : "—";
  const winPct = stats ? ((stats.lifetime_win_percentage as number) || 0).toFixed(0) : "—";

  switch (action) {
    case "greeting": {
      const ctxMap: Record<string, string> = {
        game: `${name} éppen játszani készül. Mondj egy rövid, motiváló üdvözlést és egy konkrét tippet a mai meccshez az ő statisztikái alapján (átlag: ${avg}, győzelmi arány: ${winPct}%).`,
        training: `${name} edzésre készül. Adj egy rövid, energizáló üdvözlést és egy konkrét edzési fókuszt a mai napra a statisztikái alapján.`,
        dashboard: `${name} éppen belépett az alkalmazásba. Adj egy meleg, személyes üdvözlést, emeld ki a legfontosabb teljesítménymutatóját, és javasolj egy konkrét következő lépést. Légy tömör (2-3 mondat).`,
      };
      return ctxMap[context || ""] || `Üdvözöld ${name}-t melegen, és adj egy rövid, motiváló összefoglalót a legfontosabb statisztikájáról és egy konkrét mai tennivalóról.`;
    }
    case "analyze":
      return `Elemezd részletesen ${name} teljesítményét a statisztikák alapján. Emeld ki: erősségek, fejlesztendő területek, trend (javul vagy romlik?), és adj 2-3 konkrét, megvalósítható javaslatot. Legyen cselekvésorientált.`;
    case "suggest_drills":
      return `Javasolj konkrét gyakorlatokat ${name} számára a jelenlegi szintje és statisztikái alapján. Magyarázd el miért épp ezeket, és adj egy mini edzéstervet a mai napra.`;
    case "weekly_summary":
      return `Készíts egy motiváló heti összefoglalót ${name} számára. Emeld ki a pozitív fejlődést, azonosíts mintákat, és adj irányvonalat a következő hétre 2-3 konkrét céllal.`;
    case "generate_plan":
      return `Készíts egy részletes, 7 napos személyre szabott edzéstervet ${name} számára a statisztikái és szintje alapján. Adj napokra lebontott, konkrét feladatokat. Magyarázd el az edzés logikáját és hogy miért ezt a struktúrát választottad.`;
    case "game_result": {
      if (gameResult) {
        const result = gameResult.won ? "megnyerte" : "elvesztette";
        return `${name} most ${result} a meccsét. Eredmény: ${gameResult.legs_won || 0}-${gameResult.legs_lost || 0} leg, átlag: ${(gameResult.match_average as number || 0).toFixed(1)}. Adj egy rövid, személyes visszajelzést: mi ment jól, min lehet javítani, és egy motiváló zárás. Maximum 3 bekezdés.`;
      }
      return `Elemezd ${name} legutóbbi meccsét és adj visszajelzést.`;
    }
    case "training_result": {
      const tr = trainingResult as Record<string, unknown> | undefined;
      if (tr) {
        return `${name} most befejezett egy edzést: "${tr.drill_name}", találati arány: ${((tr.hit_rate as number) || 0).toFixed(1)}%, összes nyíl: ${tr.total_darts || 0}, időtartam: ${Math.floor(((tr.duration_seconds as number) || 0) / 60)} perc. Adj egy rövid, személyes visszajelzést az edzésről, emeld ki mi ment jól, adj egy konkrét tippet a következő alkalomra, és zárj motiválóan. Max 3 bekezdés.`;
      }
      return `Adj visszajelzést ${name} legutóbbi edzéséről.`;
    }
    default:
      return `Üdvözöld ${name}-t és adj egy rövid, motiváló összefoglalót.`;
  }
}

function buildPlayerContext(
  profile: Record<string, unknown> | null,
  stats: Record<string, unknown> | null,
  recentMatches: Record<string, unknown>[],
  recentTrainings: Record<string, unknown>[],
  goals: Record<string, unknown>[]
): string {
  if (!profile) return "";

  const name = (profile.display_name as string) || (profile.username as string) || "Játékos";
  const lines = [
    `## Játékos: ${name}`,
    `- Skill szint: ${(profile.skill_rating as number) || 0}/100`,
    `- Összes meccs: ${(profile.total_games_played as number) || 0}`,
    `- Győzelmek: ${(profile.total_wins as number) || 0}`,
  ];

  if (stats) {
    lines.push(`\n## Lifetime statisztikák:`);
    lines.push(`- Átlag: ${((stats.lifetime_average as number) || 0).toFixed(1)}`);
    lines.push(`- Legjobb átlag: ${((stats.lifetime_best_average as number) || 0).toFixed(1)}`);
    lines.push(`- Első 9 nyíl átlag: ${((stats.first_nine_average as number) || 0).toFixed(1)}`);
    lines.push(`- Győzelmi arány: ${((stats.lifetime_win_percentage as number) || 0).toFixed(0)}%`);
    lines.push(`- Kiszálló %: ${((stats.lifetime_checkout_percentage as number) || 0).toFixed(1)}%`);
    lines.push(`- Legmagasabb kiszálló: ${(stats.lifetime_highest_checkout as number) || 0}`);
    lines.push(`- 180-asok: ${(stats.lifetime_180s as number) || 0}`);
  }

  if (recentMatches.length > 0) {
    lines.push(`\n## Legutóbbi ${recentMatches.length} meccs:`);
    recentMatches.forEach((m) => {
      const avg = ((m.match_average as number) || 0).toFixed(1);
      const result = m.won ? "Győzelem" : "Vereség";
      lines.push(`- ${result} | Átlag: ${avg} | Leg: ${m.legs_won}-${m.legs_lost} | Mód: ${m.game_mode}`);
    });
    const winRate = recentMatches.length > 0
      ? ((recentMatches.filter(m => m.won).length / recentMatches.length) * 100).toFixed(0)
      : 0;
    const avgScore = recentMatches.length > 0
      ? (recentMatches.reduce((s, m) => s + ((m.match_average as number) || 0), 0) / recentMatches.length).toFixed(1)
      : 0;
    lines.push(`- Jelenlegi forma: ${winRate}% győzelmi arány, ${avgScore} átlagos meccsátlag`);
  }

  if (recentTrainings.length > 0) {
    lines.push(`\n## Legutóbbi edzések:`);
    recentTrainings.forEach((t) => {
      const drill = (t.drills as Record<string, unknown>)?.name_key || "Drill";
      lines.push(`- ${drill}: ${(t.score as number) || 0} pont`);
    });
  }

  if (goals.length > 0) {
    lines.push(`\n## Aktív célok (AI által generált + saját):`);
    goals.forEach((g) => {
      const pct = (g.target_value as number) > 0
        ? (((g.current_value as number) || 0) / (g.target_value as number) * 100).toFixed(0)
        : 0;
      const aiTag = g.ai_generated ? " [AI]" : "";
      lines.push(`- ${g.title}${aiTag}: ${g.current_value}/${g.target_value} ${g.unit} (${pct}%)`);
    });
  }

  return lines.join("\n");
}
