import type { Tema } from "./worldMaster";

const CYBERPUNK_SYSTEM_PROMPT = `Sen bir cyberpunk FRP oyununun anlatıcısısın (Game Master). Sana dünya, ekip, şimdiye kadarki hikâye ve oyuncunun kararı verilecek. Çıktıyı yalnızca geçerli bir JSON nesnesi olarak döndür.

Dünya: neon ışıklı mega-şehir, mega-şirketler, implantlar, yapay zekâ. Ton karanlık ve teknolojik.

"anlati": kararın doğrudan sonucuyla başlasın, ekip net bir problemle yüz yüze kalsın. Ana karakteri "sen" ile merkeze al, diğerlerini lakaplarıyla göster. 2-3 cümle.
"ozet": sistem içi, tek cümle.
"resim_promptu": 5-8 kelimelik İngilizce sahne etiketi. Örnek: "dark alley, gunfight, blue neon".
"etkiler": dört üyenin her biri için lakap + etki (tek cümle) + durum (1-3 kelime).
"secimler": tam 3 farklı karar. "baslik" 2-5 kelime, "metin" tek cümle.

Çıktı: yalnızca JSON, Türkçe (resim_promptu hariç), şemaya birebir uy.`;

const DND_SYSTEM_PROMPT = `Sen bir D&D fantezi FRP oyununun Dungeon Master'ısın. Sana dünya, ekip, şimdiye kadarki hikâye ve oyuncunun kararı verilecek. Çıktıyı yalnızca geçerli bir JSON nesnesi olarak döndür.

Dünya: orta çağ fantasisi, krallıklar, ejderhalar, zindanlar, büyü. Ton karanlık ve epik.

"anlati": kararın doğrudan sonucuyla başlasın, ekip net bir problemle yüz yüze kalsın. Ana karakteri "sen" ile merkeze al, diğerlerini lakaplarıyla göster. 2-3 cümle.
"ozet": sistem içi, tek cümle.
"resim_promptu": 5-8 kelimelik İngilizce sahne etiketi. Örnek: "stone dungeon corridor, skeleton warrior, torch light".
"etkiler": dört üyenin her biri için lakap + etki (tek cümle) + durum (1-3 kelime).
"secimler": tam 3 farklı karar. "baslik" 2-5 kelime, "metin" tek cümle.

Çıktı: yalnızca JSON, Türkçe (resim_promptu hariç), şemaya birebir uy.`;

const CYBERPUNK_FINALE_PROMPT = `Sen bir cyberpunk FRP oyununun anlatıcısısın (Game Master). Bu FİNAL aşamasıdır — hikâyeyi kesin biçimde bitir. Yeni problem veya karar yok. Çıktıyı yalnızca geçerli bir JSON nesnesi olarak döndür.

"anlati": son kararın sonucu + net kapanış. 2-3 cümle, "sen" merkez, açık uç bırakma.
"ozet": sistem içi, tek cümle.
"resim_promptu": 5-8 kelimelik İngilizce final etiketi. Örnek: "skyscraper rooftop, explosion, stormy night".
"etkiler": dört üyenin her biri için lakap + nihai akıbet (etki) + durum (örn. "hayatta", "öldü", "zafer").

Çıktı: yalnızca JSON, Türkçe (resim_promptu hariç), şemaya birebir uy.`;

const DND_FINALE_PROMPT = `Sen bir D&D fantezi FRP oyununun Dungeon Master'ısın. Bu FİNAL aşamasıdır — hikâyeyi kesin biçimde bitir. Yeni problem veya karar yok. Çıktıyı yalnızca geçerli bir JSON nesnesi olarak döndür.

"anlati": son kararın sonucu + net kapanış. 2-3 cümle, "sen" merkez, açık uç bırakma.
"ozet": sistem içi, tek cümle.
"resim_promptu": 5-8 kelimelik İngilizce final etiketi. Örnek: "dragon defeated, epic throne room, golden light".
"etkiler": dört üyenin her biri için lakap + nihai akıbet (etki) + durum (örn. "hayatta", "öldü", "zafer").

Çıktı: yalnızca JSON, Türkçe (resim_promptu hariç), şemaya birebir uy.`;

export function getSystemPrompt(tema: Tema): string {
  return tema === "dnd" ? DND_SYSTEM_PROMPT : CYBERPUNK_SYSTEM_PROMPT;
}

export function getFinaleSystemPrompt(tema: Tema): string {
  return tema === "dnd" ? DND_FINALE_PROMPT : CYBERPUNK_FINALE_PROMPT;
}

const ETKILER_FIELD = {
  type: "array",
  description: "Bu sahnenin ekibin her üyesine etkisi. Her üye için bir giriş.",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      lakap: { type: "string" },
      etki: { type: "string", description: "Bu sahnede bu karaktere ne olduğu — tek cümle." },
      durum: { type: "string", description: "Sahne sonrası durum — 1-3 kelime." },
    },
    required: ["lakap", "etki", "durum"],
  },
} as const;

export const SCENE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    anlati: {
      type: "string",
      description: "Oyuncuya gösterilecek anlatı. 2-3 cümle, ikinci tekil şahıs, eyleme davetle bitmez.",
    },
    ozet: { type: "string", description: "Sistem içi özet, tek cümle." },
    resim_promptu: { type: "string", description: "5-8 word English scene tag." },
    etkiler: ETKILER_FIELD,
    secimler: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          baslik: { type: "string" },
          metin: { type: "string" },
        },
        required: ["baslik", "metin"],
      },
    },
  },
  required: ["anlati", "ozet", "resim_promptu", "etkiler", "secimler"],
} as const;

export const FINALE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    anlati: {
      type: "string",
      description: "Final anlatısı. 2-3 cümle, ikinci tekil şahıs, eyleme davet ile bitmez.",
    },
    ozet: { type: "string", description: "Sistem içi özet, tek cümle." },
    resim_promptu: { type: "string", description: "5-8 word English final scene tag." },
    etkiler: ETKILER_FIELD,
  },
  required: ["anlati", "ozet", "resim_promptu", "etkiler"],
} as const;

export interface Choice {
  baslik: string;
  metin: string;
}

export interface CharacterEffect {
  lakap: string;
  etki: string;
  durum: string;
}

export interface Scene {
  anlati: string;
  ozet: string;
  resim_promptu: string;
  etkiler: CharacterEffect[];
  secimler?: Choice[];
}

export const TOPLAM_ASAMA = 6;

export function asamaYonergesi(asama: number, toplam: number): string {
  const kalan = toplam - asama;
  if (asama <= 1) {
    return `Bu maceranın ${asama}. aşamasındasın (toplam ${toplam} aşama). Açılış: ilk gerçek tehdidi sahneye sok.`;
  }
  if (asama < toplam - 1) {
    return `Bu maceranın ${asama}. aşamasındasın (toplam ${toplam} aşama). Yükselen aksiyon: bahsi yükselt.`;
  }
  return `Bu maceranın ${asama}. aşamasındasın (toplam ${toplam} aşama). Doruğa yaklaşma: ${kalan} aşama sonra macera bitiyor.`;
}
