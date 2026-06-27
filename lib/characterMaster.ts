import type { Tema } from "./worldMaster";

const CYBERPUNK_SYSTEM_PROMPT = `Sen bir cyberpunk FRP oyununun karakter yaratıcısısın. Oyun dünyasına ait, hikâyesi güçlü ve oynanabilir bir karakter üret; yalnızca geçerli JSON döndür.

Dünya: neon ışıklı mega-şehir, mega-şirketler, implantlar, yapay zekâ, derin eşitsizlik. Ton karanlık ve teknolojik.

Karakter bir dönüm noktasından doğsun — borç, ihanet, kayıp veya suç. "ozgecmis" 2-3 cümlelik akıcı hikâye. "sir" ve "zayiflik" sahnede patlayabilecek somut tehditler. "oyuncu_metni": üçüncü şahısla, 2 cümle, sır/zayıflık/stat açık etmez.
"resim_promptu": 5-8 kelimelik İngilizce etiket. Örnek: "netrunner, chrome visor, red jacket".

Çıktı: yalnızca JSON, Türkçe (resim_promptu hariç), şemaya birebir uy.`;

const DND_SYSTEM_PROMPT = `Sen bir D&D fantezi FRP oyununun karakter yaratıcısısın. Oyun dünyasına ait, hikâyesi güçlü ve oynanabilir bir karakter üret; yalnızca geçerli JSON döndür.

Dünya: orta çağ fantasisi, krallıklar, ejderhalar, büyü, tehlike. Ton karanlık ve epik.

Karakter bir dönüm noktasından doğsun — yeminini bozma, sürgün, kayıp veya lanet. "ozgecmis" 2-3 cümlelik akıcı hikâye. "sir" ve "zayiflik" sahnede patlayabilecek somut tehditler. "oyuncu_metni": üçüncü şahısla, 2 cümle, sır/zayıflık/stat açık etmez.
"resim_promptu": 5-8 kelimelik İngilizce etiket. Örnek: "hooded rogue, torch-lit dungeon, dagger".

Çıktı: yalnızca JSON, Türkçe (resim_promptu hariç), şemaya birebir uy.`;

export function getSystemPrompt(tema: Tema): string {
  return tema === "dnd" ? DND_SYSTEM_PROMPT : CYBERPUNK_SYSTEM_PROMPT;
}

export const CYBERPUNK_CLASSES = [
  "Net-Kırıcı",
  "Sokak Samurayı",
  "Kaçakçı",
  "Teknomant",
  "Sabit-Göz",
  "Düzenbaz",
  "Hurdacı",
] as const;

export const DND_CLASSES = [
  "Savaşçı",
  "Büyücü",
  "Haydut",
  "Rahip",
  "Okçu",
  "Ozan",
  "Druid",
] as const;

export type CyberpunkClass = (typeof CYBERPUNK_CLASSES)[number];
export type DndClass = (typeof DND_CLASSES)[number];

function getClasses(tema: Tema): readonly string[] {
  return tema === "dnd" ? DND_CLASSES : CYBERPUNK_CLASSES;
}

const STAT_FIELD = { type: "integer" } as const;

export const CHARACTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    isim: { type: "string" },
    lakap: { type: "string" },
    sinif: { type: "string" },
    ozellikler: {
      type: "object",
      additionalProperties: false,
      properties: {
        mizac: { type: "string" },
        gorunum: { type: "string" },
        zayiflik: { type: "string" },
        sir: { type: "string" },
      },
      required: ["mizac", "gorunum", "zayiflik", "sir"],
    },
    ozgecmis: { type: "string" },
    stats: {
      type: "object",
      additionalProperties: false,
      description: "Stat toplamı tam 25 olmalı.",
      properties: {
        guc: STAT_FIELD,
        ceviklik: STAT_FIELD,
        teknik: STAT_FIELD,
        zeka: STAT_FIELD,
        karizma: STAT_FIELD,
        dayaniklilik: STAT_FIELD,
      },
      required: ["guc", "ceviklik", "teknik", "zeka", "karizma", "dayaniklilik"],
    },
    baslangic_envanteri: {
      type: "array",
      items: { type: "string" },
    },
    oyuncu_metni: { type: "string" },
    resim_promptu: { type: "string" },
  },
  required: [
    "isim", "lakap", "sinif", "ozellikler", "ozgecmis",
    "stats", "baslangic_envanteri", "oyuncu_metni", "resim_promptu",
  ],
} as const;

export interface Character {
  isim: string;
  lakap: string;
  sinif: string;
  ozellikler: { mizac: string; gorunum: string; zayiflik: string; sir: string };
  ozgecmis: string;
  stats: { guc: number; ceviklik: number; teknik: number; zeka: number; karizma: number; dayaniklilik: number };
  baslangic_envanteri: string[];
  oyuncu_metni: string;
  resim_promptu: string;
}

export interface CharacterPlayerView {
  id: string;
  isim: string;
  lakap: string;
  sinif: string;
  oyuncu_metni: string;
  imageUrl: string | null;
}

export function summarizeCharacter(c: Character): string {
  return [
    `${c.lakap} (${c.isim}) — ${c.sinif}`,
    `Mizaç: ${c.ozellikler.mizac}`,
    `Görünüm: ${c.ozellikler.gorunum}`,
  ].join(" | ");
}

export function pickDistinctClasses(n: number, tema: Tema): string[] {
  const pool = [...getClasses(tema)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
