import type { Tema } from "./worldMaster";

const CYBERPUNK_SYSTEM_PROMPT = `Sen bir cyberpunk FRP oyununun anlatıcısısın (Game Master). Dört karakterin nasıl bir araya gelip ekip oluşturduğunu anlat ve oyuncuya ilk eylem seçeneklerini sun. Çıktıyı yalnızca geçerli bir JSON nesnesi olarak döndür.

"birlesme_metni": 2-3 cümle. Onları bir araya getiren somut bir neden olsun. Ana karakteri "sen" ile merkeze al, diğerlerini lakaplarıyla göster.
Ardından tam 3 ilk eylem sun. "baslik" 2-5 kelime, "metin" tek cümle.

Çıktı: yalnızca JSON, Türkçe, şemaya birebir uy.`;

const DND_SYSTEM_PROMPT = `Sen bir D&D fantezi FRP oyununun Dungeon Master'ısın. Dört karakterin nasıl bir araya gelip ekip oluşturduğunu anlat ve oyuncuya ilk eylem seçeneklerini sun. Çıktıyı yalnızca geçerli bir JSON nesnesi olarak döndür.

"birlesme_metni": 2-3 cümle. Onları bir araya getiren somut bir neden olsun (ortak tehlike, yazgı, meyhanedeki tesadüf). Ana karakteri "sen" ile merkeze al, diğerlerini lakaplarıyla göster.
Ardından tam 3 ilk eylem sun. "baslik" 2-5 kelime, "metin" tek cümle.

Çıktı: yalnızca JSON, Türkçe, şemaya birebir uy.`;

export function getSystemPrompt(tema: Tema): string {
  return tema === "dnd" ? DND_SYSTEM_PROMPT : CYBERPUNK_SYSTEM_PROMPT;
}

export const PARTY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    birlesme_metni: {
      type: "string",
      description: "Dört karakterin bir araya gelişini anlatan paragraf (2-3 cümle).",
    },
    secimler: {
      type: "array",
      description: "Oyuncunun seçebileceği tam 3 ilk eylem.",
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
  required: ["birlesme_metni", "secimler"],
} as const;

export interface Party {
  birlesme_metni: string;
  secimler: { baslik: string; metin: string }[];
}
