"use client";

import { useMemo, useState } from "react";
import type { CharacterPlayerView } from "@/lib/characterMaster";
import type { CharacterEffect } from "@/lib/adventureMaster";
import type { Tema } from "@/lib/worldMaster";

// The client only ever sees the player-facing text plus storage ids.
// All GM/system world data lives in Supabase, never in the browser.
type WorldView = {
  id: string;
  campaignId: string;
  campaignTitle: string | null;
  oyuncu_metni: string;
  tema: Tema;
  imageUrl: string | null;
};

// The client only ever holds the curated player-facing slice — the full
// character sheet (stats, secret, weakness, backstory) stays in Supabase.
type CharacterView = CharacterPlayerView;

type Choice = { baslik: string; metin: string };

// The party-gathering step: the narrative of the four coming together plus
// the first action choices.
type PartyView = {
  id: string;
  birlesme_metni: string;
  secimler: Choice[];
};

// One turn of the adventure loop: the chosen decision, the narrative it
// produced (problem included) and the next decisions to solve it.
type SceneView = {
  id: string;
  chosen: Choice;
  anlati: string;
  imageUrl: string | null;
  // How this scene affected each party member (keyed by lakap).
  etkiler: CharacterEffect[];
  secimler: Choice[];
  // Which stage produced this scene, and whether it is the finale.
  asama: number;
  toplam: number;
  son: boolean;
};

export default function Home() {
  const [tema, setTema] = useState<Tema>("cyberpunk");
  const [hint, setHint] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [world, setWorld] = useState<WorldView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [characters, setCharacters] = useState<CharacterView[] | null>(null);
  const [charLoading, setCharLoading] = useState(false);
  const [charError, setCharError] = useState("");

  // Step 3: the player picks a main character, then the four are gathered
  // into a party and offered the first action choices.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [party, setParty] = useState<PartyView | null>(null);
  const [partyLoading, setPartyLoading] = useState(false);
  const [partyError, setPartyError] = useState("");

  // Step 4+: the adventure loop. Each chosen decision produces a scene with a
  // new problem and the next set of decisions.
  const [scenes, setScenes] = useState<SceneView[]>([]);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [sceneError, setSceneError] = useState("");

  // Step 1: build the world. On success, chain straight into character
  // generation so the cast belongs to the world we just created.
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setWorld(null);
    setCharacters(null);
    setCharError("");
    setSelectedId(null);
    setParty(null);
    setPartyError("");
    setScenes([]);
    setSceneError("");

    try {
      const res = await fetch("/api/world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint, campaignTitle, tema }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `İstek başarısız (${res.status}).`);
      const newWorld = data as WorldView;
      setWorld(newWorld);
      await generateCharacters(newWorld.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir şeyler ters gitti.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: generate 4 characters that live in the stored world (by id).
  async function generateCharacters(worldId: string) {
    if (charLoading) return;

    setCharLoading(true);
    setCharError("");
    setCharacters(null);
    // A fresh cast invalidates any earlier selection / gathering / adventure.
    setSelectedId(null);
    setParty(null);
    setPartyError("");
    setScenes([]);
    setSceneError("");

    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `İstek başarısız (${res.status}).`);
      setCharacters(data.characters as CharacterView[]);
    } catch (err) {
      setCharError(err instanceof Error ? err.message : "Bir şeyler ters gitti.");
    } finally {
      setCharLoading(false);
    }
  }

  // Step 3: gather the four into a party around the chosen main character and
  // fetch the first action choices.
  async function gatherParty() {
    if (partyLoading || !world || !selectedId) return;

    setPartyLoading(true);
    setPartyError("");
    setParty(null);
    setScenes([]);
    setSceneError("");

    try {
      const res = await fetch("/api/party", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId: world.id, mainCharacterId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `İstek başarısız (${res.status}).`);
      setParty(data as PartyView);
    } catch (err) {
      setPartyError(err instanceof Error ? err.message : "Bir şeyler ters gitti.");
    } finally {
      setPartyLoading(false);
    }
  }

  // The cast's live state: replay every scene's effects in play order so each
  // character shows the most recent thing that happened to them (keyed by lakap).
  const latestEffectByLakap = useMemo(() => {
    const map = new Map<string, CharacterEffect>();
    for (const scene of scenes) {
      for (const e of scene.etkiler) map.set(e.lakap, e);
    }
    return map;
  }, [scenes]);

  // The arc is over once the finale scene has been played.
  const lastScene = scenes.length ? scenes[scenes.length - 1] : null;
  const ended = !!lastScene?.son;

  // The current decisions are the latest scene's, or the gathering's if the
  // adventure hasn't started yet. The finale has none.
  const currentChoices = ended
    ? []
    : scenes.length
      ? scenes[scenes.length - 1].secimler
      : party?.secimler ?? [];

  // Step 4+: act on a decision. The chosen action drives the story forward —
  // the result confronts the party with a problem and the next decisions.
  async function advanceScene(choice: Choice) {
    if (sceneLoading || !world || !selectedId || !party) return;

    setSceneLoading(true);
    setSceneError("");

    try {
      const res = await fetch("/api/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId: world.id,
          mainCharacterId: selectedId,
          partyId: party.id,
          secim: choice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `İstek başarısız (${res.status}).`);
      setScenes((prev) => [
        ...prev,
        {
          id: data.id as string,
          chosen: choice,
          anlati: data.anlati as string,
          imageUrl: (data.imageUrl as string | null) ?? null,
          etkiler: (data.etkiler ?? []) as CharacterEffect[],
          secimler: data.secimler as Choice[],
          asama: data.asama as number,
          toplam: data.toplam as number,
          son: Boolean(data.son),
        },
      ]);
    } catch (err) {
      setSceneError(err instanceof Error ? err.message : "Bir şeyler ters gitti.");
    } finally {
      setSceneLoading(false);
    }
  }

  // Sidebar is visible once the party is formed.
  const showSidebar = !!party && !!characters;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 font-sans text-zinc-100">
      <div
        className={`mx-auto flex w-full flex-1 ${
          showSidebar ? "max-w-6xl" : "max-w-4xl"
        }`}
      >
        {/* ── Main content ── */}
        <main className="flex flex-1 flex-col gap-6 px-6 py-16">
          <header className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-cyan-300">
              Cyberpunk Dünya Kurucu
            </h1>
            <p className="text-sm text-zinc-400">
              Pipeline 1. adım — başlangıç sahnesini üret.
            </p>
          </header>

          <form onSubmit={generate} className="flex flex-col gap-3">
            {/* Theme selector */}
            <div className="flex gap-2">
              {(["cyberpunk", "dnd"] as Tema[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTema(t)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                    tema === t
                      ? t === "cyberpunk"
                        ? "bg-cyan-400 text-zinc-950"
                        : "bg-amber-400 text-zinc-950"
                      : "border border-white/15 text-zinc-400 hover:border-white/30"
                  }`}
                >
                  {t === "cyberpunk" ? "Cyberpunk" : "D&D"}
                </button>
              ))}
            </div>

            <input
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
              placeholder="Kampanya adı (opsiyonel) — boşsa sahnenin mekânı kullanılır"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-base outline-none placeholder:text-zinc-600 focus:border-cyan-400/50"
            />
            <textarea
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Ek yönlendirme (opsiyonel) — ör. 'oyuncu kaçak bir netrunner olsun'"
              rows={3}
              className="w-full resize-y rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-base outline-none placeholder:text-zinc-600 focus:border-cyan-400/50"
            />
            <button
              type="submit"
              disabled={loading}
              className="self-start rounded-full bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-300 disabled:opacity-50"
            >
              {loading
                ? world
                  ? "Karakterler üretiliyor…"
                  : "Dünya kuruluyor…"
                : "Dünya Oluştur"}
            </button>
          </form>

          {error && (
            <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">{error}</p>
          )}

          {world && (
            <section className="overflow-hidden rounded-xl border border-cyan-400/30 bg-cyan-400/5">
              {world.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={world.imageUrl}
                  alt="Açılış sahnesi"
                  className="w-full object-cover"
                  style={{ maxHeight: "360px" }}
                />
              )}
              <div className="p-5">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-cyan-300">
                    Sahne
                  </h2>
                  {world.campaignTitle && (
                    <span className="text-xs text-zinc-400">
                      Kampanya: {world.campaignTitle}
                    </span>
                  )}
                </div>
                <p className="leading-7 text-zinc-100">{world.oyuncu_metni}</p>
              </div>
            </section>
          )}

          {(charLoading || characters || charError) && (
            <header className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-8">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight text-fuchsia-300">
                  Bu Dünyanın Karakterleri
                </h2>
                <p className="text-sm text-zinc-400">
                  Üretilen dünyaya ait 4 oynanabilir karakter.
                </p>
              </div>
              {world && (
                <button
                  type="button"
                  onClick={() => generateCharacters(world.id)}
                  disabled={charLoading || loading || partyLoading}
                  className="self-start rounded-full border border-fuchsia-400/40 px-5 py-2 text-sm font-medium text-fuchsia-300 transition-colors hover:bg-fuchsia-400/10 disabled:opacity-50"
                >
                  {charLoading ? "Karakterler üretiliyor…" : "Karakterleri Yeniden Üret"}
                </button>
              )}
            </header>
          )}

          {charError && (
            <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">{charError}</p>
          )}

          {charLoading && !characters && (
            <p className="text-sm text-zinc-400">Karakterler bu dünyaya göre üretiliyor…</p>
          )}

          {characters && (
            <>
              <p className="text-sm text-zinc-400">
                {party
                  ? "Ana karakterin seçildi ve ekip kuruldu."
                  : "Ana karakterini seçmek için bir karta tıkla."}
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {characters.map((c) => (
                  <CharacterCard
                    key={c.id}
                    c={c}
                    selected={c.id === selectedId}
                    disabled={!!party || partyLoading}
                    onSelect={() => !party && setSelectedId(c.id)}
                  />
                ))}
              </div>

              {!party && (
                <button
                  type="button"
                  onClick={gatherParty}
                  disabled={!selectedId || partyLoading}
                  className="self-start rounded-full bg-fuchsia-400 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-fuchsia-300 disabled:opacity-50"
                >
                  {partyLoading
                    ? "Ekip kuruluyor…"
                    : selectedId
                      ? "Bu Karakterle Devam Et"
                      : "Önce bir karakter seç"}
                </button>
              )}
            </>
          )}

          {partyError && (
            <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">{partyError}</p>
          )}

          {party && (
            <section className="mt-6 flex flex-col gap-5 border-t border-white/10 pt-8">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight text-amber-300">
                  Ekip Bir Araya Geliyor
                </h2>
                <p className="text-sm text-zinc-400">
                  Dört karakterin yolları kesişiyor.
                </p>
              </div>

              <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
                <p className="leading-7 text-zinc-100">{party.birlesme_metni}</p>
              </div>

              {scenes.map((scene) => (
                <div key={scene.id} className="flex flex-col gap-3">
                  <p className="flex items-center justify-between text-xs font-medium uppercase tracking-widest text-amber-400/80">
                    <span>» {scene.chosen.baslik}</span>
                    <span className="text-amber-400/60">
                      {scene.son ? "Final" : `Aşama ${scene.asama}/${scene.toplam}`}
                    </span>
                  </p>
                  <div
                    className={`overflow-hidden rounded-xl border ${
                      scene.son
                        ? "border-emerald-400/40 bg-emerald-400/5"
                        : "border-amber-400/30 bg-amber-400/5"
                    }`}
                  >
                    {scene.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={scene.imageUrl}
                        alt={scene.chosen.baslik}
                        className="w-full object-cover"
                        style={{ maxHeight: "320px" }}
                      />
                    )}
                    <p className="p-5 leading-7 text-zinc-100">{scene.anlati}</p>
                  </div>
                </div>
              ))}

              {sceneError && (
                <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
                  {sceneError}
                </p>
              )}

              {ended ? (
                <div className="flex flex-col gap-4 rounded-xl border border-emerald-400/40 bg-emerald-400/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                    Macera burada sona erdi
                  </p>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={loading}
                    className="self-start rounded-full bg-emerald-400 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-300 disabled:opacity-50"
                  >
                    Yeni Macera Başlat
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                    {sceneLoading ? "Sonuç işleniyor…" : "Ne yapmak istersin?"}
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {currentChoices.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => advanceScene(s)}
                          disabled={sceneLoading}
                          className="w-full rounded-lg border border-white/10 bg-zinc-900/60 p-4 text-left transition-colors hover:border-amber-400/50 hover:bg-amber-400/5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <p className="font-medium text-amber-200">{s.baslik}</p>
                          <p className="mt-1 text-sm leading-6 text-zinc-300">{s.metin}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </main>

        {/* ── Party sidebar ── */}
        {showSidebar && (
          <aside className="hidden w-72 shrink-0 border-l border-white/10 lg:block">
            <div className="sticky top-0 flex max-h-screen flex-col gap-4 overflow-y-auto px-5 py-16">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Ekip Durumu
              </h2>
              <div className="flex flex-col gap-3">
                {characters.map((c) => (
                  <PartyMemberStatus
                    key={c.id}
                    c={c}
                    isMain={c.id === selectedId}
                    effect={latestEffectByLakap.get(c.lakap) ?? null}
                  />
                ))}
              </div>
              {scenes.length > 0 && (
                <p className="mt-2 text-[11px] text-zinc-600">
                  Aşama {scenes[scenes.length - 1].asama}/{scenes[scenes.length - 1].toplam}
                </p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function CharacterCard({
  c,
  selected,
  disabled,
  onSelect,
}: {
  c: CharacterView;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={
        disabled
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
      }
      aria-pressed={selected}
      className={`flex flex-col gap-0 overflow-hidden rounded-xl border bg-zinc-900/60 transition-colors ${
        selected
          ? "border-fuchsia-400 ring-1 ring-fuchsia-400/60"
          : "border-white/10"
      } ${disabled ? "cursor-default" : "cursor-pointer hover:border-fuchsia-400/50"}`}
    >
      {c.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.imageUrl}
          alt={c.lakap}
          className="h-48 w-full object-cover"
        />
      ) : (
        <div className="flex h-48 items-center justify-center bg-zinc-800/60 text-zinc-600 text-xs">
          görsel yükleniyor…
        </div>
      )}

      <div className="flex flex-col gap-4 p-5">
        <div>
          <h3 className="text-lg font-semibold text-fuchsia-200">
            {c.lakap}{" "}
            <span className="text-sm font-normal text-zinc-400">({c.isim})</span>
            {selected && (
              <span className="ml-2 inline-block rounded-full bg-fuchsia-400 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-zinc-950">
                Ana Karakter
              </span>
            )}
          </h3>
          <span className="mt-1 inline-block rounded-full bg-fuchsia-400/15 px-3 py-0.5 text-xs font-medium text-fuchsia-300">
            {c.sinif}
          </span>
        </div>
        <p className="text-sm leading-7 text-zinc-300">{c.oyuncu_metni}</p>
      </div>
    </article>
  );
}

// Compact party-roster card shown during the adventure. Its status badge and
// last-effect line are re-derived from the scene chain, so they update after
// every scene the player advances through.
function PartyMemberStatus({
  c,
  isMain,
  effect,
}: {
  c: CharacterView;
  isMain: boolean;
  effect: CharacterEffect | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60">
      {c.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.imageUrl}
          alt={c.lakap}
          className="h-28 w-full object-cover object-top"
        />
      )}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-amber-200">
            {c.lakap}
            {isMain && (
              <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-400/70">
                sen
              </span>
            )}
          </h4>
          <span className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
            {effect?.durum ?? "hazır"}
          </span>
        </div>
        <p className="text-xs leading-5 text-zinc-400">
          {effect?.etki ?? `${c.sinif}`}
        </p>
      </div>
    </div>
  );
}
