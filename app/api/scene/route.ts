import Anthropic from "@anthropic-ai/sdk";
import {
  getSystemPrompt,
  getFinaleSystemPrompt,
  SCENE_SCHEMA,
  FINALE_SCHEMA,
  TOPLAM_ASAMA,
  asamaYonergesi,
  type Scene,
  type Choice,
} from "@/lib/adventureMaster";
import { summarizeWorld, type World, type Tema } from "@/lib/worldMaster";
import { summarizeCharacter, type Character } from "@/lib/characterMaster";
import { getSupabaseClient } from "@/lib/supabase";
import { renderImage } from "@/lib/imageMaster";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

function isChoice(value: unknown): value is Choice {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Choice).baslik === "string" &&
    typeof (value as Choice).metin === "string"
  );
}

export async function POST(request: Request) {
  let worldId: string | null = null;
  let mainCharacterId: string | null = null;
  let partyId: string | null = null;
  let secim: Choice | null = null;
  try {
    const body = await request.json();
    if (typeof body?.worldId === "string") worldId = body.worldId;
    if (typeof body?.mainCharacterId === "string")
      mainCharacterId = body.mainCharacterId;
    if (typeof body?.partyId === "string") partyId = body.partyId;
    if (isChoice(body?.secim)) secim = body.secim;
  } catch {
    // ignore — handled by the validation below
  }

  if (!worldId || !mainCharacterId || !partyId || !secim) {
    return Response.json(
      { error: "worldId, mainCharacterId, partyId and secim are required." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseClient();

  // Everything that grounds the scene lives server-side: the GM world, the full
  // cast, the gathering, and the chain of scenes played so far.
  const [
    { data: worldRow, error: worldError },
    { data: charRows, error: charError },
    { data: partyRow, error: partyError },
    { data: sceneRows, error: sceneError },
  ] = await Promise.all([
    supabase
      .from("worlds")
      .select("data, campaign_id")
      .eq("id", worldId)
      .single(),
    supabase.from("characters").select("id, data").eq("world_id", worldId),
    supabase
      .from("parties")
      .select("birlesme_metni")
      .eq("id", partyId)
      .single(),
    supabase
      .from("scenes")
      .select("secim, data")
      .eq("party_id", partyId)
      .order("created_at", { ascending: true }),
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
  if (partyError || !partyRow) {
    return Response.json({ error: "Party not found." }, { status: 404 });
  }
  if (sceneError) {
    return Response.json({ error: sceneError.message }, { status: 500 });
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

  // The exact nicknames the model must use when reporting per-character effects,
  // so the client can map each etki back to the right character card. Kept clean
  // (no annotations) so they match the stored lakaplar verbatim.
  const roster = charRows.map((row) => (row.data as Character).lakap);
  const mainLakap = (main.data as Character).lakap;

  // "Story so far": the gathering, then each already-resolved decision and the
  // problem it produced (the GM-only ozet), in play order.
  const history: string[] = [
    `Ekip bir araya geldi: ${partyRow.birlesme_metni}`,
  ];
  for (const row of sceneRows ?? []) {
    const choice = row.secim as Choice;
    const scene = row.data as Scene;
    history.push(`Karar: "${choice.baslik}" — ${choice.metin}`);
    history.push(`Sonuç: ${scene.ozet}`);
  }

  // Stage tracking: each resolved scene is one completed stage, so the scene
  // we are about to produce is aşama (count + 1). Aşama 6 is the finale.
  const asama = (sceneRows?.length ?? 0) + 1;
  const isFinale = asama >= TOPLAM_ASAMA;

  const sonYonerge = isFinale
    ? "Bu, maceranın FİNAL aşaması. Bu son kararın sonucunu doruğuyla anlat ve hikâyeyi kesin biçimde bitir; yeni problem çıkarma, yeni karar sunma."
    : "Bu kararın sonucunu anlat, ekibi maceranın bir adım derinine sürükle, önlerine somut bir problem çıkar ve bu problemi çözmek için 3 yeni karar sun.";

  const userMessage = [
    "Aşağıdaki dünyada geçen maceraya devam et.",
    "",
    `İLERLEME: ${asamaYonergesi(asama, TOPLAM_ASAMA)}`,
    "",
    "DÜNYA:",
    worldSummary,
    "",
    "ANA KARAKTER (oyuncu — ikinci tekil şahısla merkeze al):",
    mainSummary,
    "",
    "DİĞER EKİP ÜYELERİ:",
    ...companionSummaries.map((s, i) => `${i + 1}. ${s}`),
    "",
    'EKİBİN TAM LİSTESİ ("etkiler" alanını tam olarak bu lakaplarla, her üye için bir giriş olacak şekilde ver):',
    ...roster.map((l) => `- ${l}${l === mainLakap ? " (ana karakter)" : ""}`),
    "",
    "ŞİMDİYE KADARKİ HİKÂYE:",
    ...history,
    "",
    `OYUNCUNUN AZ ÖNCE VERDİĞİ KARAR: "${secim.baslik}" — ${secim.metin}`,
    "",
    sonYonerge,
  ].join("\n");

  console.log(userMessage);

  try {
    const response = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: isFinale ? getFinaleSystemPrompt(tema) : getSystemPrompt(tema),
      messages: [{ role: "user", content: userMessage }],
      output_config: {
        format: {
          type: "json_schema",
          schema: isFinale ? FINALE_SCHEMA : SCENE_SCHEMA,
        },
      },
    });

    const scene = response.parsed_output as Scene | null;
    if (!scene) {
      return Response.json(
        {
          error: "Model şemaya uygun bir çıktı üretemedi.",
          stop_reason: response.stop_reason,
        },
        { status: 502 },
      );
    }

    // Persist the scene and generate the illustration in parallel.
    const [{ data, error: insertError }, imageUrl] = await Promise.all([
      supabase
        .from("scenes")
        .insert({
          world_id: worldId,
          campaign_id: campaignId,
          party_id: partyId,
          secim,
          anlati: scene.anlati,
          data: scene,
        })
        .select("id")
        .single(),
      renderImage(scene.resim_promptu, "16:9", tema),
    ]);

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json(
      {
        id: data.id,
        anlati: scene.anlati,
        imageUrl: imageUrl ?? null,
        // Per-character impact of this scene, so the client can update the cast.
        etkiler: scene.etkiler ?? [],
        // Finale offers no decisions; the arc is over.
        secimler: isFinale ? [] : (scene.secimler ?? []),
        asama,
        toplam: TOPLAM_ASAMA,
        son: isFinale,
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
