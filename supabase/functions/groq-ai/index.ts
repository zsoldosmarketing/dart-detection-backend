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

    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { message, conversation_id, action = "chat" } = body;

    const { data: configs } = await supabaseAdmin
      .from("app_config")
      .select("key, value_json")
      .in("key", ["groq_api_key", "groq_model", "ai_system_prompt", "ai_enabled"]);

    const configMap: Record<string, unknown> = {};
    (configs || []).forEach((c: { key: string; value_json: unknown }) => {
      try {
        configMap[c.key] =
          typeof c.value_json === "string"
            ? JSON.parse(c.value_json)
            : c.value_json;
      } catch {
        configMap[c.key] = c.value_json;
      }
    });

    const groqApiKey = configMap["groq_api_key"] as string;
    if (!groqApiKey || groqApiKey.trim() === "") {
      return new Response(
        JSON.stringify({
          error:
            "A Groq API kulcs nincs beállítva. Kérj egy adminisztrátortól segítséget.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const model =
      (configMap["groq_model"] as string) || "llama-3.3-70b-versatile";
    const aiEnabled = configMap["ai_enabled"] !== false;

    if (!aiEnabled) {
      return new Response(
        JSON.stringify({ error: "Az AI edző funkció jelenleg ki van kapcsolva." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const [statsRes, profileRes, recentMatchesRes, goalsRes, trainingsRes] =
      await Promise.all([
        supabaseAdmin
          .from("player_statistics_summary")
          .select("*")
          .eq("player_id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("user_profile")
          .select(
            "display_name, username, skill_rating, total_games_played, total_wins, average_score"
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("match_statistics")
          .select(
            "game_mode, won, match_average, legs_won, legs_lost, highest_checkout, created_at"
          )
          .eq("player_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabaseAdmin
          .from("ai_goals")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active"),
        supabaseAdmin
          .from("training_sessions")
          .select("status, score, created_at, drills(name_key)")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    const stats = statsRes.data;
    const profile = profileRes.data;
    const recentMatches = recentMatchesRes.data || [];
    const goals = goalsRes.data || [];
    const recentTrainings = trainingsRes.data || [];

    const basePrompt =
      (configMap["ai_system_prompt"] as string) || buildDefaultSystemPrompt();
    const contextStr = buildPlayerContext(
      profile,
      stats,
      recentMatches,
      recentTrainings,
      goals
    );
    const systemPrompt = `${basePrompt}\n\n${contextStr}`;

    let convId = conversation_id;

    if (!convId && action === "chat") {
      const shortTitle = message?.substring(0, 60) || "Új chat";
      const { data: newConv } = await supabaseAdmin
        .from("ai_conversations")
        .insert({ user_id: user.id, title: shortTitle })
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

    const userMessage = message || buildActionPrompt(action, profile, stats);

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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const groqData = await groqResponse.json();
    const aiContent = groqData.choices?.[0]?.message?.content || "";
    const tokensUsed = groqData.usage?.total_tokens || 0;

    if (convId) {
      await supabaseAdmin.from("ai_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: aiContent,
      });

      await supabaseAdmin
        .from("ai_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convId);
    }

    if (action === "analyze") {
      await supabaseAdmin.from("ai_insights").insert({
        user_id: user.id,
        insight_type: "performance",
        title: "Heti teljesítményelemzés",
        content: aiContent,
        is_read: false,
      });
    }

    return new Response(
      JSON.stringify({
        message: aiContent,
        conversation_id: convId,
        tokens_used: tokensUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildDefaultSystemPrompt(): string {
  return `Te egy profi darts edző és személyes trainer vagy a DartsTraining platformon. A neved DartsCoach AI.

A te szereped:
- Személyes edzőként viselkedj: biztató, konkrét és adatvezérelt
- Elemezd a játékos teljesítményének trendjeit a valós statisztikák alapján
- Javasolj konkrét gyakorlatokat és edzéseket, hivatkozz a platform drill-jeire
- Segíts célokat meghatározni és nyomon követni
- Taktikai tanácsokat adj a fejlődéshez
- Ünnepeld a győzelmeket, bátorítsd vereség után
- Személyre szabott edzésterveket készíts

Fontos szabályok:
- Mindig magyarul válaszolj
- Légy meleg, professzionális és motiváló
- Ha konkrét számokra hivatkozol, pontosan használd az adatokat
- Válaszaid legyenek tömörek de informatívak (max 3-4 bekezdés)
- Használj pozitív, motiváló hangsziget`;
}

function buildActionPrompt(
  action: string,
  profile: Record<string, unknown> | null,
  stats: Record<string, unknown> | null
): string {
  const name =
    (profile?.display_name as string) ||
    (profile?.username as string) ||
    "Játékos";
  switch (action) {
    case "analyze":
      return `Elemezd ${name} legutóbbi teljesítményét a rendelkezésre álló statisztikák alapján. Adj részletes visszajelzést és konkrét javaslatokat a fejlődéshez.`;
    case "suggest_drills":
      return `Javasolj konkrét gyakorlatokat ${name} számára a jelenlegi szintje és statisztikái alapján. Magyarázd el miért épp ezeket és hogyan kell végezni.`;
    case "weekly_summary":
      return `Készíts egy motiváló heti összefoglalót ${name} számára. Emeld ki a pozitív fejlődést és adj irányvonalat a következő hétre.`;
    case "generate_plan":
      return `Készíts egy 7 napos személyre szabott edzéstervet ${name} számára a statisztikái és szintje alapján. Adj napokra lebontott, konkrét feladatokat.`;
    default:
      return `Üdvözöld ${name}-t és adj egy rövid, motiváló összefoglalót a jelenlegi teljesítményéről!`;
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

  const name =
    (profile.display_name as string) ||
    (profile.username as string) ||
    "Játékos";
  const lines = [
    `## Játékos profil: ${name}`,
    `- Skill szint: ${(profile.skill_rating as number) || 0}/100`,
    `- Összes meccs: ${(profile.total_games_played as number) || 0}`,
    `- Győzelmek: ${(profile.total_wins as number) || 0}`,
  ];

  if (stats) {
    lines.push(`\n## Lifetime statisztikák:`);
    lines.push(
      `- Átlag: ${((stats.lifetime_average as number) || 0).toFixed(1)}`
    );
    lines.push(
      `- Legjobb átlag: ${((stats.lifetime_best_average as number) || 0).toFixed(1)}`
    );
    lines.push(
      `- Első 9 nyíl: ${((stats.first_nine_average as number) || 0).toFixed(1)}`
    );
    lines.push(
      `- Győzelmi arány: ${((stats.lifetime_win_percentage as number) || 0).toFixed(0)}%`
    );
    lines.push(
      `- Kiszálló %: ${((stats.lifetime_checkout_percentage as number) || 0).toFixed(1)}%`
    );
    lines.push(
      `- Highest checkout: ${(stats.lifetime_highest_checkout as number) || 0}`
    );
    lines.push(`- 180-asok: ${(stats.lifetime_180s as number) || 0}`);
  }

  if (recentMatches.length > 0) {
    lines.push(`\n## Legutóbbi ${recentMatches.length} meccs:`);
    recentMatches.forEach((m) => {
      const avg = ((m.match_average as number) || 0).toFixed(1);
      const result = m.won ? "✓ Győzelem" : "✗ Vereség";
      lines.push(
        `- ${result} | Átlag: ${avg} | Leg: ${m.legs_won}-${m.legs_lost} | Mód: ${m.game_mode}`
      );
    });

    const winRate =
      recentMatches.length > 0
        ? (
            (recentMatches.filter((m) => m.won).length /
              recentMatches.length) *
            100
          ).toFixed(0)
        : 0;
    const avgScore =
      recentMatches.length > 0
        ? (
            recentMatches.reduce(
              (s, m) => s + ((m.match_average as number) || 0),
              0
            ) / recentMatches.length
          ).toFixed(1)
        : 0;
    lines.push(
      `- Forma: ${winRate}% győzelmi arány, ${avgScore} átlagos meccsen`
    );
  }

  if (recentTrainings.length > 0) {
    lines.push(`\n## Legutóbbi edzések:`);
    recentTrainings.forEach((t) => {
      const drill = (t.drills as Record<string, unknown>)?.name_key || "Drill";
      lines.push(`- ${drill}: ${(t.score as number) || 0} pont`);
    });
  }

  if (goals.length > 0) {
    lines.push(`\n## Aktív célok:`);
    goals.forEach((g) => {
      const pct =
        (g.target_value as number) > 0
          ? (
              (((g.current_value as number) || 0) /
                (g.target_value as number)) *
              100
            ).toFixed(0)
          : 0;
      lines.push(
        `- ${g.title}: ${g.current_value}/${g.target_value} ${g.unit} (${pct}%)`
      );
    });
  }

  return lines.join("\n");
}
