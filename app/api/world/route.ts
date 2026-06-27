import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { getSystemPrompt, WORLD_SCHEMA, type World, type Tema } from "@/lib/worldMaster";
import { getSupabaseClient } from "@/lib/supabase";
import { renderImage } from "@/lib/imageMaster";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

export async function POST(request: NextRequest) {
  // Optional inputs from the caller. The scene generates without them.
  let hint = "";
  let campaignTitle = "";
  let campaignId: string | null = null;
  let tema: Tema = "cyberpunk";
  try {
    const body = await request.json();
    if (typeof body?.hint === "string") hint = body.hint.trim();
    if (typeof body?.campaignTitle === "string")
      campaignTitle = body.campaignTitle.trim();
    if (typeof body?.campaignId === "string") campaignId = body.campaignId;
    if (body?.tema === "dnd" || body?.tema === "cyberpunk") tema = body.tema;
  } catch {
    // no body / invalid JSON — proceed with defaults
  }

  const userMessage = hint
    ? `Yeni bir başlangıç sahnesi oluştur. Ek yönlendirme: ${hint}`
    : "Yeni bir başlangıç sahnesi oluştur.";

  try {
    const response = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: getSystemPrompt(tema),
      messages: [{ role: "user", content: userMessage }],
      output_config: {
        format: { type: "json_schema", schema: WORLD_SCHEMA },
      },
    });

    const world = response.parsed_output as World | null;
    if (!world) {
      return Response.json(
        {
          error: "Model şemaya uygun bir çıktı üretemedi.",
          stop_reason: response.stop_reason,
        },
        { status: 502 },
      );
    }

    const supabase = getSupabaseClient();

    // Create a new campaign unless the caller is adding to an existing one.
    // Default the title to the scene's location when none is provided.
    let title = campaignTitle;
    if (!campaignId) {
      const fallbackTitle = campaignTitle || world.atmosfer.mekan;
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({ title: fallbackTitle })
        .select("id, title")
        .single();

      if (campaignError) {
        return Response.json({ error: campaignError.message }, { status: 500 });
      }
      campaignId = campaign.id;
      title = campaign.title;
    }

    // Persist the world and render the opening scene illustration in parallel.
    const [{ data, error }, imageUrl] = await Promise.all([
      supabase
        .from("worlds")
        .insert({
          campaign_id: campaignId,
          oyuncu_metni: world.oyuncu_metni,
          // tema is injected alongside the generated world data for downstream steps.
          data: { ...world, tema },
        })
        .select("id")
        .single(),
      renderImage(world.resim_promptu, "16:9", tema),
    ]);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(
      {
        id: data.id,
        campaignId,
        campaignTitle: title,
        oyuncu_metni: world.oyuncu_metni,
        tema,
        imageUrl: imageUrl ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return Response.json(
        { error: err.message },
        { status: err.status ?? 500 },
      );
    }
    return Response.json(
      { error: "Beklenmeyen bir hata oluştu." },
      { status: 500 },
    );
  }
}
