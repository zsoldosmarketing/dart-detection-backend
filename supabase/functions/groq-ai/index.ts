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

    const groqApiKey = Deno.env.get("GROQ_API_KEY") ?? "";
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ error: "A Groq API kulcs nincs beállítva." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: configs } = await supabaseAdmin
      .from("app_config")
      .select("key, value_json")
      .in("key", ["groq_model", "ai_system_prompt", "ai_enabled"]);

    const configMap: Record<string, unknown> = {};
    (configs || []).forEach((c: { key: string; value_json: unknown }) => {
      try {
        configMap[c.key] = typeof c.value_json === "string" ? JSON.parse(c.value_json) : c.value_json;
      } catch {
        configMap[c.key] = c.value_json;
      }
    });

    const model = (configMap["groq_model"] as string) || "llama-3.3-70b-versatile";
    const aiEnabled = configMap["ai_enabled"] !== false;
    if (!aiEnabled) {
      return new Response(
        JSON.stringify({ error: "Az AI edző funkció jelenleg ki van kapcsolva." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [statsRes, profileRes, recentMatchesRes, goalsRes, trainingsRes, insightsRes, allDrillsRes] = await Promise.all([
      supabaseAdmin.from("player_statistics_summary").select("*").eq("player_id", user.id).maybeSingle(),
      supabaseAdmin.from("user_profile").select("display_name, username, skill_rating, total_games_played, total_wins, average_score, preferred_doubles").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("match_statistics").select("game_mode, won, match_average, legs_won, legs_lost, highest_checkout, total_180s, total_100_plus, total_doubles_hit, total_doubles_thrown, total_triples_hit, total_triples_thrown, checkouts_hit, checkout_attempts, best_leg_average, worst_leg_average, first_9_average, created_at, duration_seconds").eq("player_id", user.id).order("created_at", { ascending: false }).limit(15),
      supabaseAdmin.from("ai_goals").select("*").eq("user_id", user.id).eq("status", "active"),
      supabaseAdmin.from("training_sessions").select("status, score, created_at, drills(name_key, category, difficulty)").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("ai_insights").select("id, title, insight_type, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
      supabaseAdmin.from("drills").select("name_key, desc_key, category, difficulty, config, group_key, estimated_minutes, slug").eq("is_active", true).order("category").order("difficulty"),
    ]);

    const stats = statsRes.data;
    const profile = profileRes.data;
    const recentMatches = recentMatchesRes.data || [];
    const goals = goalsRes.data || [];
    const recentTrainings = trainingsRes.data || [];
    const recentInsights = insightsRes.data || [];
    const allDrills = allDrillsRes.data || [];

    const basePrompt = (configMap["ai_system_prompt"] as string) || buildDefaultSystemPrompt();
    const contextStr = buildPlayerContext(profile, stats, recentMatches, recentTrainings, goals, allDrills);
    const systemPrompt = `${basePrompt}\n\n${contextStr}`;

    let convId = conversation_id;

    if (!convId && (action === "chat" || action === "greeting" || action === "game_result" || action === "training_result" || action === "generate_plan")) {
      const titleMap: Record<string, string> = {
        greeting: "AI Edző üdvözlés",
        game_result: "Meccs utáni elemzés",
        training_result: "Edzés utáni értékelés",
        generate_plan: "Személyes edzésterv",
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

    const userMessage = message || buildActionPrompt(action, profile, stats, context, game_result, training_result, recentInsights, allDrills);
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
        max_tokens: 2000,
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

    if (action === "generate_plan") {
      EdgeRuntime.waitUntil(
        tryGenerateStructuredPlan(supabaseAdmin, user.id, aiContent, profile, stats, groqApiKey, model, allDrills)
      );
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

async function tryGenerateStructuredPlan(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  aiResponse: string,
  profile: Record<string, unknown> | null,
  stats: Record<string, unknown> | null,
  apiKey: string,
  model: string,
  drills: Record<string, unknown>[]
) {
  try {
    const drillList = drills.map(d => `${d.slug}: ${d.name_key} (${d.category}, difficulty ${d.difficulty}, ~${d.estimated_minutes}min)`).join("\n");
    const name = (profile?.display_name as string) || (profile?.username as string) || "Játékos";
    const avg = stats ? ((stats.lifetime_average as number) || 0).toFixed(1) : "0";
    const checkoutPct = stats ? ((stats.lifetime_checkout_percentage as number) || 0).toFixed(1) : "0";
    const winPct = stats ? ((stats.lifetime_win_percentage as number) || 0).toFixed(0) : "0";

    const extractPrompt = `Az AI edző ezt javasolta ${name}-nek: "${aiResponse}"

A játékos statisztikái: átlag ${avg}, kiszálló ${checkoutPct}%, győzelmi arány ${winPct}%

Elérhető drillек (slug: leírás):
${drillList}

Generálj egy 7 napos személyre szabott edzéstervet JSON formátumban:
{
  "title": "terv neve",
  "description": "2-3 mondatos leírás miért ez a terv",
  "duration_days": 7,
  "focus_areas": ["terület1", "terület2"],
  "days": [
    {
      "day": 1,
      "title": "nap neve",
      "focus": "mai fókusz",
      "drills": [
        {"slug": "drill-slug-az-elérhető-listából", "name": "drill neve magyarul", "sets": 1, "reps": null, "duration": "10 perc", "notes": "mit figyelj"}
      ]
    }
  ]
}

FONTOS:
- Csak olyan slug-okat használj ami szerepel a fenti listában!
- Minden nap 2-4 drill legyen, 15-35 perc összesen
- A terv legyen fokozatosan nehezedő
- Az egyéni statisztikák alapján prioritizáld a gyenge területeket
- Csak valid JSON-t adj vissza, semmi mást!`;

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: extractPrompt }],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.title || !parsed.days?.length) return;

    await supabase.from("ai_training_plans").insert({
      user_id: userId,
      title: parsed.title,
      description: parsed.description || "",
      duration_days: parsed.duration_days || 7,
      days: parsed.days,
      focus_areas: parsed.focus_areas || [],
      status: "active",
    });
  } catch {
  }
}

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

Ha ez egy konkrét, mérhető célt tartalmaz (pl. átlag javítás, kiszálló %, győzelmek stb.), adj vissza egy JSON objektumot:
{"should_create": true, "title": "rövid cím", "goal_type": "average|checkout|wins|streak|custom", "target_value": 65.0, "unit": "pont|%|győzelem|meccs", "description": "leírás"}

Ha nincs konkrét mérhető cél: {"should_create": false}

Csak valid JSON-t adj vissza, semmi mást.`;

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: extractPrompt }], max_tokens: 200, temperature: 0.2 }),
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
- Pontosan ismered a játékos statisztikáit és azok alapján személyre szabott tanácsokat adsz
- Ünnepeld a sikereket, bátorítsd vereség után, állítsd be a fokozatot a játékos szintjéhez
- Ha a játékos célokat említ, automatikusan segíts őket meghatározni és nyomon követni
- Generálj edzésterveket a statisztikák alapján a VALÓDI elérhető drillekből
- Figyelj a trendekre: javulás, visszaesés, erősségek, gyengeségek

KISZÁLLÓ ÉRTÉKELÉS - KRITIKUS SZABÁLYOK:
- A kiszálló% CSAK akkor számít, ha a játékos TÉNYLEGESEN double-ra vagy bullra dobott amíg azon volt a kiszálló
- Tehát: ha 170-ről T20-at dob, az NEM kiszálló kísérlet - az setup
- Kiszálló kísérlet = a dobott szám értéke pontosan egyenlő a remaining-gel ÉS double vagy bull volt a célpont
- Pl: 40 marad → D20-ra dob = kiszálló kísérlet. 170 marad → T20-ra dob = NEM kiszálló kísérlet
- Ha a játékos 100% kiszállót mutat de 1-2 meccs volt csak, az alacsony mintaszám - jelezd ezt!
- Mindig nézd meg hány meccsből/kísérletből jön a statisztika

CHECKOUT ELEMZÉS MÉLYSÉGE:
- Azonosítsd a tipikus problémás leaveeket (pl. páratlan számok, 3-as maradékos számok)
- Értékeld a preferred doubles hatékonyságát
- Figyeld a double in/out konverziós arányt különböző nyomáshelyzetekben

FONTOS SZABÁLYOK:
- Mindig magyarul válaszolj
- Légy meleg, közvetlen és motiváló — mint egy valódi személyi edző
- Konkrét adatokra hivatkozz ha van (átlag, kiszálló %, stb.)
- Válaszaid legyenek tömörek de informatívak (2-4 bekezdés)
- Javasold proaktívan ha valamit érdemes tenni
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
  recentInsights?: Record<string, unknown>[],
  drills?: Record<string, unknown>[]
): string {
  const name = (profile?.display_name as string) || (profile?.username as string) || "Játékos";
  const avg = stats ? ((stats.lifetime_average as number) || 0).toFixed(1) : "—";
  const winPct = stats ? ((stats.lifetime_win_percentage as number) || 0).toFixed(0) : "—";
  const checkoutPct = stats ? ((stats.lifetime_checkout_percentage as number) || 0).toFixed(1) : "—";
  const totalMatches = stats ? ((stats.lifetime_matches as number) || 0) : 0;

  switch (action) {
    case "greeting": {
      const ctxMap: Record<string, string> = {
        game: `${name} éppen játszani készül. Mondj egy rövid, motiváló üdvözlést és egy konkrét tippet a mai meccshez az ő statisztikái alapján (átlag: ${avg}, győzelmi arány: ${winPct}%, kiszálló: ${checkoutPct}%).`,
        training: `${name} edzésre készül. Adj egy rövid, energizáló üdvözlést és egy konkrét edzési fókuszt a mai napra a statisztikái alapján.`,
        dashboard: `${name} éppen belépett az alkalmazásba. Adj egy meleg, személyes üdvözlést, emeld ki a legfontosabb teljesítménymutatóját, és javasolj egy konkrét következő lépést. Légy tömör (2-3 mondat).`,
        ai_trainer: `${name} megnyitotta az AI Edző oldalt. Adj egy motiváló üdvözlést. Emeld ki a legfontosabb statisztikát (${totalMatches} meccs, ${avg} átlag, ${checkoutPct}% kiszálló). Ha kevés a meccs (${totalMatches} db), akkor biztatsd hogy játsszon többet az adatgyűjtéshez.`,
      };
      return ctxMap[context || ""] || `Üdvözöld ${name}-t melegen, és adj egy rövid, motiváló összefoglalót.`;
    }
    case "analyze":
      return `Elemezd részletesen ${name} teljesítményét a statisztikák alapján. FONTOS: A kiszálló%-nál jelezd, hogy ez ${totalMatches} meccsből jön - ha kevés a minta, jelezd. Emeld ki: erősségek, fejlesztendő területek, trend (javul vagy romlik?), és adj 2-3 konkrét, megvalósítható javaslatot. Legyen cselekvésorientált.`;
    case "suggest_drills":
      return `Javasolj konkrét gyakorlatokat ${name} számára a jelenlegi szintje és statisztikái alapján. Csak a rendelkezésre álló drillekből javasolj (lásd a kontextusban). Magyarázd el miért épp ezeket, és adj egy mini edzéstervet a mai napra.`;
    case "weekly_summary":
      return `Készíts egy motiváló heti összefoglalót ${name} számára. Emeld ki a pozitív fejlődést, azonosíts mintákat, és adj irányvonalat a következő hétre 2-3 konkrét céllal.`;
    case "generate_plan":
      return `Készíts egy részletes, 7 napos személyre szabott edzéstervet ${name} számára a statisztikái és szintje alapján. Az átlaga: ${avg}, kiszálló: ${checkoutPct}%, győzelmi arány: ${winPct}%. Azonosítsd a legfontosabb fejlesztendő területet és arra koncentrálj. A terv a rendszerünkben elérhető drillekből épüljön fel. A válasz után automatikusan strukturált tervet is generálok a DB-be.`;
    case "game_result": {
      if (gameResult) {
        const gr = gameResult as Record<string, unknown>;
        const result = gr.won ? "megnyerte" : "elvesztette";
        const doublesHit = (gr.doubles_hit as number) || 0;
        const doublesThrown = (gr.doubles_thrown as number) || 0;
        const doublesPct = doublesThrown > 0 ? ((doublesHit / doublesThrown) * 100).toFixed(0) : "?";
        const checkoutAttempts = (gr.checkout_attempts as number) || 0;
        const checkoutsHit = (gr.checkouts_hit as number) || 0;
        const checkoutRate = checkoutAttempts > 0 ? ((checkoutsHit / checkoutAttempts) * 100).toFixed(0) : "?";
        const avg180s = (gr.total_180s as number) || 0;
        const avg100plus = (gr.total_100_plus as number) || 0;
        const first9 = (gr.first_nine_average as number) || 0;

        let legDetailText = "";
        const legDetails = gr.leg_details as Record<string, unknown>[] | undefined;
        if (legDetails && legDetails.length > 0) {
          legDetailText = "\nLeg részletek:\n" + legDetails.map(l =>
            `  Leg ${l.leg_number}: ${l.won ? "Győzelem" : "Vereség"}, ${(l.average as number || 0).toFixed(1)} átlag, ${l.darts} nyíl${l.checkout_score ? `, ${l.checkout_score} kiszálló` : ""}, ${l.visits_180} db 180, doubles: ${l.doubles_hit}/${l.doubles_thrown}`
          ).join("\n");
        }

        return `${name} most ${result} a meccsét.
Eredmény: ${gr.legs_won || 0}-${gr.legs_lost || 0} leg
Meccs átlag: ${(gr.match_average as number || 0).toFixed(1)}, Legjobb leg: ${(gr.best_leg_average as number || 0).toFixed(1)}, Legrosszabb leg: ${(gr.worst_leg_average as number || 0).toFixed(1)}
Első 9 nyíl átlag: ${first9 > 0 ? first9.toFixed(1) : "n/a"}
180-asok: ${avg180s}, 100+ látogatás: ${avg100plus}
Doubles: ${doublesHit}/${doublesThrown} (${doublesPct}%)
Kiszállók: ${checkoutsHit}/${checkoutAttempts} (${checkoutRate}%) - FIGYELEM: ez csak a TÉNYLEGES double/bull dobásokat jelenti!
Legmagasabb kiszálló: ${gr.highest_checkout || 0}
Játékmód: ${gr.game_mode || "ismeretlen"}${legDetailText}

Adj egy személyes, részletes visszajelzést: mi ment jól, mi volt a legkritikusabb gyengeség, és 1-2 konkrét fejlesztési tipp. Ha a kiszálló% magas (de kevés kísérlet volt), jelezd. Max 3-4 bekezdés.`;
      }
      return `Elemezd ${name} legutóbbi meccsét és adj visszajelzést.`;
    }
    case "training_result": {
      const tr = trainingResult as Record<string, unknown> | undefined;
      if (tr) {
        const hitRate = (tr.hit_rate as number) || 0;
        const drillCategory = (tr.drill_category as string) || "általános";

        let levelComment = "";
        if (drillCategory === "triples" || drillCategory === "doubles") {
          if (hitRate >= 75) levelComment = "Versenyképes szint!";
          else if (hitRate >= 60) levelComment = "Erős teljesítmény.";
          else if (hitRate >= 45) levelComment = "Fejlődő szint.";
          else levelComment = "Van mit dolgozni rajta.";
        }

        return `${name} most befejezett egy edzést: "${tr.drill_name}" (${drillCategory})
Találati arány: ${hitRate.toFixed(1)}% ${levelComment}
Összes nyíl: ${tr.total_darts || 0}, Időtartam: ${Math.floor(((tr.duration_seconds as number) || 0) / 60)} perc
${tr.targets_hit !== undefined ? `Célzások: ${tr.targets_hit}/${tr.targets_total}` : ""}
${tr.best_streak ? `Legjobb sorozat: ${tr.best_streak}` : ""}

Adj egy rövid, személyes visszajelzést: hogyan teljesített, mit csinált jól, mit kell javítani, és adj egy konkrét tippet a következő alkalomra. Max 3 bekezdés.`;
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
  goals: Record<string, unknown>[],
  drills: Record<string, unknown>[]
): string {
  if (!profile) return "";

  const name = (profile.display_name as string) || (profile.username as string) || "Játékos";
  const lines = [
    `## Játékos: ${name}`,
    `- Skill szint: ${(profile.skill_rating as number) || 0}/100`,
    `- Összes meccs: ${(profile.total_games_played as number) || 0}`,
    `- Győzelmek: ${(profile.total_wins as number) || 0}`,
  ];

  const preferredDoubles = profile.preferred_doubles as number[] | undefined;
  if (preferredDoubles && preferredDoubles.length > 0) {
    lines.push(`- Preferált double-ok: ${preferredDoubles.map(d => `D${d}`).join(", ")}`);
  }

  if (stats) {
    const totalMatches = (stats.lifetime_matches as number) || 0;
    const checkoutPct = (stats.lifetime_checkout_percentage as number) || 0;
    const checkoutSample = totalMatches < 5 ? ` (FIGYELEM: csak ${totalMatches} meccsből, alacsony mintaszám!)` : totalMatches < 15 ? ` (${totalMatches} meccsből)` : "";

    lines.push(`\n## Lifetime statisztikák (${totalMatches} meccs alapján):`);
    lines.push(`- Átlag: ${((stats.lifetime_average as number) || 0).toFixed(1)}`);
    lines.push(`- Legjobb átlag: ${((stats.lifetime_best_average as number) || 0).toFixed(1)}`);
    lines.push(`- Első 9 nyíl átlag: ${((stats.first_nine_average as number) || 0).toFixed(1)}`);
    lines.push(`- Győzelmi arány: ${((stats.lifetime_win_percentage as number) || 0).toFixed(0)}%`);
    lines.push(`- Kiszálló %: ${checkoutPct.toFixed(1)}%${checkoutSample}`);
    lines.push(`- FONTOS: Kiszálló% csak a tényleges double/bull dobásokat számítja (nem minden "kiszálló zónában" lévő dobaszt)`);
    lines.push(`- Legmagasabb kiszálló: ${(stats.lifetime_highest_checkout as number) || 0}`);
    lines.push(`- 180-asok: ${(stats.lifetime_180s as number) || 0}`);
    lines.push(`- Doubles pontosság: ${((stats.lifetime_doubles_accuracy as number) || 0).toFixed(1)}%`);
    lines.push(`- Triples pontosság: ${((stats.lifetime_triples_accuracy as number) || 0).toFixed(1)}%`);
  }

  if (recentMatches.length > 0) {
    lines.push(`\n## Legutóbbi ${recentMatches.length} meccs:`);
    recentMatches.forEach((m) => {
      const avg = ((m.match_average as number) || 0).toFixed(1);
      const result = m.won ? "Gy" : "V";
      const doublesHit = (m.total_doubles_hit as number) || 0;
      const doublesThrown = (m.total_doubles_thrown as number) || 0;
      const doublesPct = doublesThrown > 0 ? ((doublesHit / doublesThrown) * 100).toFixed(0) : "?";
      const checkAttempts = (m.checkout_attempts as number) || 0;
      const checkHit = (m.checkouts_hit as number) || 0;
      const checkRate = checkAttempts > 0 ? `${((checkHit / checkAttempts) * 100).toFixed(0)}%(${checkAttempts}ksrl)` : "n/a";
      lines.push(`- ${result} | ${avg} átl | ${m.legs_won}-${m.legs_lost} leg | D:${doublesPct}% | Ks:${checkRate} | 180:${(m.total_180s as number) || 0} | Mód:${m.game_mode}`);
    });

    const recentAvgs = recentMatches.slice(0, 5).map(m => (m.match_average as number) || 0).filter(a => a > 0);
    const olderAvgs = recentMatches.slice(5).map(m => (m.match_average as number) || 0).filter(a => a > 0);
    if (recentAvgs.length > 0 && olderAvgs.length > 0) {
      const recentMean = recentAvgs.reduce((s, a) => s + a, 0) / recentAvgs.length;
      const olderMean = olderAvgs.reduce((s, a) => s + a, 0) / olderAvgs.length;
      const trend = recentMean > olderMean + 2 ? "javuló" : recentMean < olderMean - 2 ? "romló" : "stabil";
      lines.push(`- Trend: ${trend} (utóbbi 5 meccs átl: ${recentMean.toFixed(1)} vs korábbi: ${olderMean.toFixed(1)})`);
    }
  }

  if (recentTrainings.length > 0) {
    lines.push(`\n## Legutóbbi edzések:`);
    recentTrainings.forEach((t) => {
      const drill = (t.drills as Record<string, unknown>);
      const drillName = drill?.name_key || "Drill";
      const category = drill?.category || "";
      lines.push(`- ${drillName} (${category}): ${(t.score as number) || 0} pont`);
    });
  }

  if (goals.length > 0) {
    lines.push(`\n## Aktív célok:`);
    goals.forEach((g) => {
      const pct = (g.target_value as number) > 0
        ? (((g.current_value as number) || 0) / (g.target_value as number) * 100).toFixed(0)
        : 0;
      const aiTag = g.ai_generated ? " [AI]" : "";
      lines.push(`- ${g.title}${aiTag}: ${g.current_value}/${g.target_value} ${g.unit} (${pct}%)`);
    });
  }

  if (drills.length > 0) {
    lines.push(`\n## Elérhető drillек (edzésterv generáláshoz):`);
    const byCategory: Record<string, string[]> = {};
    drills.forEach((d) => {
      const cat = (d.category as string) || "other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(`${d.slug} (neh.${d.difficulty}, ~${d.estimated_minutes}perc)`);
    });
    Object.entries(byCategory).forEach(([cat, items]) => {
      lines.push(`- ${cat}: ${items.join(", ")}`);
    });
  }

  return lines.join("\n");
}
