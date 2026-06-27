import Anthropic from "@anthropic-ai/sdk";
import {
  getSystemPrompt,
  CHARACTER_SCHEMA,
  pickDistinctClasses,
  type Character,
} from "@/lib/characterMaster";
import { summarizeWorld, type World, type Tema } from "@/lib/worldMaster";
import { getSupabaseClient } from "@/lib/supabase";
import { renderImage } from "@/lib/imageMaster";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const COUNT = 4;

async function generateOne(
  characterClass: string,
  worldSummary: string,
  tema: Tema,
): Promise<Character> {
  const worldContext = worldSummary
    ? `Bu karakter aşağıdaki dünyada yaşıyor. Onu bu dünyaya, mekâna, ana göreve ve tona uygun biçimde, sahnenin doğal bir parçası olacak şekilde üret:\n\n${worldSummary}\n\n`
    : "";

  const response = await client.messages.parse({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    system: getSystemPrompt(tema),
    messages: [
      {
        role: "user",
        content: `${worldContext}Yeni, özgün bir oynanabilir karakter üret. Bu karakterin sınıfı "${characterClass}" olsun; diğer her şeyi (isim, geçmiş, mizaç, statlar) bu sınıfa ve dünyaya uygun ama özgün biçimde sen belirle.`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: CHARACTER_SCHEMA },
    },
  });

  const character = response.parsed_output as Character | null;
  if (!character) {
    throw new Error(
      `Model şemaya uygun karakter üretemedi (stop: ${response.stop_reason}).`,
    );
  }
  return character;
}

export async function POST(request: Request) {
  let worldId: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.worldId === "string") worldId = body.worldId;
  } catch {
    // ignore — handled by the worldId check below
  }

  if (!worldId) {
    return Response.json({ error: "worldId is required." }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // Pull the full GM world from storage (never trusted from the client).
  const { data: worldRow, error: fetchError } = await supabase
    .from("worlds")
    .select("data, campaign_id")
    .eq("id", worldId)
    .single();

  if (fetchError || !worldRow) {
    return Response.json({ error: "World not found." }, { status: 404 });
  }

  const worldData = worldRow.data as World;
  const worldSummary = summarizeWorld(worldData);
  const tema: Tema = worldData.tema ?? "cyberpunk";
  const campaignId = worldRow.campaign_id as string | null;

  try {
    const classes = pickDistinctClasses(COUNT, tema);
    const characters = await Promise.all(
      classes.map((characterClass) =>
        generateOne(characterClass, worldSummary, tema),
      ),
    );

    // Persist the cast, linked to its world and campaign. Return the rows so
    // the client can reference its chosen main character by storage id.
    const { data: inserted, error: insertError } = await supabase
      .from("characters")
      .insert(
        characters.map((character) => ({
          world_id: worldId,
          campaign_id: campaignId,
          character_class: character.sinif,
          data: character,
        })),
      )
      .select("id, data");
    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    // Generate portraits in parallel with Imagen; null on failure so the UI
    // degrades gracefully without blocking the rest of the pipeline.
    const imageUrls = await Promise.all(
      (inserted ?? []).map((row) =>
        renderImage((row.data as Character).resim_promptu, "1:1", tema),
      ),
    );

    // Expose only the player-facing slice; full sheets (stats, secret,
    // weakness, backstory) stay server-side, like the world's GM data.
    const playerView = (inserted ?? []).map((row, i) => {
      const c = row.data as Character;
      return {
        id: row.id as string,
        isim: c.isim,
        lakap: c.lakap,
        sinif: c.sinif,
        oyuncu_metni: c.oyuncu_metni,
        imageUrl: imageUrls[i] ?? null,
      };
    });

    return Response.json(
      { characters: playerView },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return Response.json(
        { error: err.message },
        { status: err.status ?? 500 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
    return Response.json({ error: message }, { status: 500 });
  }
}
