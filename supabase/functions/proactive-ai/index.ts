import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    let targetUserId: string | null = null;

    if (authHeader) {
      const userSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userSupabase.auth.getUser();
      if (user) targetUserId = user.id;
    }

    const { data: configs } = await supabaseAdmin
      .from("app_config")
      .select("key, value_json")
      .in("key", ["groq_api_key", "groq_model", "ai_enabled"]);

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
      return new Response(JSON.stringify({ error: "Groq API key not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const aiEnabled = configMap["ai_enabled"] !== false;
    if (!aiEnabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "AI disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const model = (configMap["groq_model"] as string) || "llama-3.3-70b-versatile";
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    let usersToNudge: { id: string }[] = [];

    if (targetUserId) {
      usersToNudge = [{ id: targetUserId }];
    } else {
      const { data: allUsers } = await supabaseAdmin
        .from("user_profile")
        .select("id")
        .limit(50);

      if (!allUsers?.length) {
        return new Response(JSON.stringify({ processed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      for (const u of allUsers) {
        const { data: recentActivity } = await supabaseAdmin
          .from("match_statistics")
          .select("id")
          .eq("player_id", u.id)
          .gte("created_at", threeDaysAgo)
          .limit(1)
          .maybeSingle();

        const { data: recentTraining } = await supabaseAdmin
          .from("training_sessions")
          .select("id")
          .eq("user_id", u.id)
          .eq("status", "completed")
          .gte("created_at", threeDaysAgo)
          .limit(1)
          .maybeSingle();

        if (!recentActivity && !recentTraining) {
          const { data: recentInsight } = await supabaseAdmin
            .from("ai_insights")
            .select("id")
            .eq("user_id", u.id)
            .gte("created_at", threeDaysAgo)
            .limit(1)
            .maybeSingle();

          if (!recentInsight) {
            usersToNudge.push(u);
          }
        }
      }
    }

    let processed = 0;
    for (const u of usersToNudge.slice(0, 10)) {
      try {
        const [statsRes, profileRes, goalsRes] = await Promise.all([
          supabaseAdmin.from("player_statistics_summary").select("*").eq("player_id", u.id).maybeSingle(),
          supabaseAdmin.from("user_profile").select("display_name, username, total_games_played, total_wins").eq("id", u.id).maybeSingle(),
          supabaseAdmin.from("ai_goals").select("title, current_value, target_value, unit").eq("user_id", u.id).eq("status", "active").limit(3),
        ]);

        const profile = profileRes.data;
        const stats = statsRes.data;
        const goals = goalsRes.data || [];
        const name = (profile?.display_name as string) || (profile?.username as string) || "Játékos";
        const avg = stats ? ((stats.lifetime_average as number) || 0).toFixed(1) : "0";
        const winPct = stats ? ((stats.lifetime_win_percentage as number) || 0).toFixed(0) : "0";

        let goalsSummary = "";
        if (goals.length > 0) {
          goalsSummary = `\nAktív célok: ${goals.map((g: Record<string, unknown>) => `${g.title} (${g.current_value}/${g.target_value} ${g.unit})`).join(", ")}`;
        }

        const prompt = `Te DartsCoach AI vagy, egy proaktív személyes darts edző.

${name} 3 napja nem játszott és nem edzett. Átlaga: ${avg}, győzelmi arány: ${winPct}%.${goalsSummary}

Írj egy rövid, személyes motiváló üzenetet (max 3-4 mondat), amely:
1. Személyre szóló (megemlíti a statisztikáit vagy a céljait)
2. Konkrét javaslatot ad mit csináljon ma (edzés vagy meccs)
3. Motiváló és pozitív hangnemű
4. Közvetlen és emberi stílusú

Csak az üzenetet írd, semmi mást.`;

        const groqRes = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,
            temperature: 0.8,
          }),
        });

        if (!groqRes.ok) continue;
        const groqData = await groqRes.json();
        const content = groqData.choices?.[0]?.message?.content || "";
        if (!content) continue;

        await supabaseAdmin.from("ai_insights").insert({
          user_id: u.id,
          insight_type: "tip",
          title: "Az edződ üzen neked",
          content,
          is_read: false,
        });

        processed++;
      } catch {
        continue;
      }
    }

    return new Response(JSON.stringify({ processed, nudged: usersToNudge.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
