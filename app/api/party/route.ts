import Anthropic from "@anthropic-ai/sdk";
import { getSystemPrompt, PARTY_SCHEMA, type Party } from "@/lib/partyMaster";
import { summarizeWorld, type World, type Tema } from "@/lib/worldMaster";
import { summarizeCharacter, type Character } from "@/lib/characterMaster";
import { getSupabaseClient } from "@/lib/supabase";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

export async function POST(request: Request) {
  let worldId: string | null = null;
  let mainCharacterId: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.worldId === "string") worldId = body.worldId;
    if (typeof body?.mainCharacterId === "string")
      mainCharacterId = body.mainCharacterId;
  } catch {
    // ignore — handled by the validation below
  }

  if (!worldId || !mainCharacterId) {
    return Response.json(
      { error: "worldId and mainCharacterId are required." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseClient();

  // Pull the full GM world and the world's cast from storage (never trusted
  // from the client). The chosen main character is identified by storage id.
  const [
    { data: worldRow, error: worldError },
    { data: charRows, error: charError },
  ] = await Promise.all([
    supabase
      .from("worlds")
      .select("data, campaign_id")
      .eq("id", worldId)
      .single(),
    supabase.from("characters").select("id, data").eq("world_id", worldId),
  ]);

  if (worldError || !worldRow) {
    return Response.json({ error: "World not found." }, { status: 404 });
  }
  if (charError || !charRows || charRows.length === 0) {
    return Response.json(
      { error: "Characters not found for this world." },
      { status: 404 },
    );
  }

  const main = charRows.find((row) => row.id === mainCharacterId);
  if (!main) {
    return Response.json(
      { error: "mainCharacterId does not belong to this world." },
      { status: 400 },
    );
  }

  const worldData = worldRow.data as World;
  const worldSummary = summarizeWorld(worldData);
  const tema: Tema = worldData.tema ?? "cyberpunk";
  const campaignId = worldRow.campaign_id as string | null;

  const mainSummary = summarizeCharacter(main.data as Character);
  const companionSummaries = charRows
    .filter((row) => row.id !== mainCharacterId)
    .map((row) => summarizeCharacter(row.data as Character));

  const userMessage = [
    "Aşağıdaki dünyada, oyuncunun seçtiği ana karakter ile diğer üç karakterin",
    "nasıl bir araya gelip aynı ekibi oluşturduğunu anlat ve oyuncuya ilk eylem",
    "seçeneklerini sun.",
    "",
    "DÜNYA:",
    worldSummary,
    "",
    "ANA KARAKTER (oyuncu — ikinci tekil şahısla merkeze al):",
    mainSummary,
    "",
    "DİĞER ÜÇ KARAKTER (ekibin diğer üyeleri):",
    ...companionSummaries.map((s, i) => `${i + 1}. ${s}`),
  ].join("\n");

  try {
    const response = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: getSystemPrompt(tema),
      messages: [{ role: "user", content: userMessage }],
      output_config: {
        format: { type: "json_schema", schema: PARTY_SCHEMA },
      },
    });

    const party = response.parsed_output as Party | null;
    if (!party) {
      return Response.json(
        {
          error: "Model şemaya uygun bir çıktı üretemedi.",
          stop_reason: response.stop_reason,
        },
        { status: 502 },
      );
    }

    // Persist the gathering, linked to its world, campaign and main character.
    const { data, error: insertError } = await supabase
      .from("parties")
      .insert({
        world_id: worldId,
        campaign_id: campaignId,
        main_character_id: mainCharacterId,
        birlesme_metni: party.birlesme_metni,
        data: party,
      })
      .select("id")
      .single();

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json(
      {
        id: data.id,
        birlesme_metni: party.birlesme_metni,
        secimler: party.secimler,
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
    const message =
      err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
    return Response.json({ error: message }, { status: 500 });
  }
}
