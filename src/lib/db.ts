import { sbFetch } from "./supabase";
import { VARSAYILAN_FIYAT_LISTESI } from "../constants";
import { Siparis, HaliTuru, Firma, HaliKalemi } from "../types";

export const toplamM2 = (k: HaliKalemi[]): number =>
  k.reduce((s, x) => s + (Number(x.m2) || 0) * (Number(x.adet) || 1), 0);

export const toplamAdet = (k: HaliKalemi[]): number =>
  k.reduce((s, x) => s + (Number(x.adet) || 0), 0);

export async function dbHaliTurleriniGetir(
  token: string,
  firmaId: string
): Promise<HaliTuru[]> {
  let turler = (await sbFetch(
    `hali_fiyatlari?firma_id=eq.${firmaId}&select=*`,
    {},
    token
  )) as Record<string, unknown>[];

  if (turler.length === 0) {
    const yeniListe = VARSAYILAN_FIYAT_LISTESI.map((t) => ({
      firma_id: firmaId,
      tur_id: t.ad.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
      ad: t.ad,
      birim_fiyat: t.birimFiyat,
      icon: t.icon,
    }));
    turler = (await sbFetch(
      "hali_fiyatlari",
      { method: "POST", body: JSON.stringify(yeniListe) },
      token
    )) as Record<string, unknown>[];
  }

  return turler.map((t) => ({
    id: t.tur_id as string,
    ad: t.ad as string,
    birimFiyat: Number(t.birim_fiyat),
    icon: t.icon as string,
  }));
}

export async function dbHaliTurleriKaydet(
  token: string,
  firmaId: string,
  turler: HaliTuru[]
): Promise<void> {
  await sbFetch(
    `hali_fiyatlari?firma_id=eq.${firmaId}`,
    { method: "DELETE", prefer: "return=minimal" },
    token
  );
  const yeniListe = turler.map((t) => ({
    firma_id: firmaId,
    tur_id: t.id,
    ad: t.ad,
    birim_fiyat: t.birimFiyat,
    icon: t.icon,
  }));
  await sbFetch(
    "hali_fiyatlari",
    { method: "POST", body: JSON.stringify(yeniListe) },
    token
  );
}

export async function dbGetir(
  token: string,
  isAdmin: boolean
): Promise<Siparis[]> {
  // Admin için firmalar join'i ayrı yap
  const query = isAdmin
    ? "siparisler?select=*,firmalar(ad),hali_kalemleri(*)&order=olusturuldu.desc"
    : "siparisler?select=*,hali_kalemleri(*)&order=olusturuldu.desc";

  try {
    const ss = (await sbFetch(query, {}, token)) as Record<string, unknown>[];
    return ss.map((s) => ({
      id: s.id as string,
      musteri: s.musteri_ad as string,
      telefon: s.telefon as string,
      adres: (s.adres as string) || "",
      durum: s.durum as string,
      notlar: (s.notlar as string) || "",
      fiyat: Number(s.fiyat),
      tarih: s.tarih as string,
      smsDurum: (s.sms_durum as Record<string, boolean>) || {},
      firmaId: s.firma_id as string,
      firmaAd: (s.firmalar as Record<string, string>)?.ad || "",
      haliKalemleri: ((s.hali_kalemleri as Record<string, unknown>[]) || []).map(
        (k) => ({
          turId: k.tur_id as string,
          adet: Number(k.adet),
          m2: Number(k.m2),
          birimFiyat: Number(k.birim_fiyat),
        })
      ),
    }));
  } catch (e) {
    console.error("dbGetir hatası:", e);
    return [];
  }
}

export async function dbFirmalariGetir(token: string): Promise<Firma[]> {
  return (await sbFetch(
    "firmalar?select=*&order=olusturuldu.desc",
    {},
    token
  )) as Firma[];
}

export async function dbFirmaEkle(
  token: string,
  ad: string,
  email: string
): Promise<void> {
  await sbFetch(
    "firmalar",
    { method: "POST", body: JSON.stringify({ ad, email, aktif: true }) },
    token
  );
}

export async function dbFirmaGuncelle(
  token: string,
  id: string,
  ad: string,
  aktif: boolean
): Promise<void> {
  await sbFetch(
    `firmalar?id=eq.${id}`,
    { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ ad, aktif }) },
    token
  );
}

export async function dbFirmaSil(token: string, id: string): Promise<void> {
  await sbFetch(
    `firmalar?id=eq.${id}`,
    { method: "DELETE", prefer: "return=minimal" },
    token
  );
}
export async function dbKaydet(
  form: {
    musteri: string;
    telefon: string;
    adres: string;
    notlar: string;
    tarih: string;
    firmaId: string;
    haliKalemleri: HaliKalemi[];
  },
  editId: string | null,
  ht: HaliTuru[],
  token: string,
  firmaId?: string
): Promise<string> {
  const id = editId || `SP-${String(Date.now()).slice(-6)}`;
  const topFiyat = form.haliKalemleri.reduce((sum, k) => {
    const tur = ht.find((t) => t.id === k.turId);
    return sum + (tur?.birimFiyat || 0) * (k.m2 || 0) * (k.adet || 1);
  }, 0);

  const siparisData = {
    id,
    musteri_ad: form.musteri,
    telefon: form.telefon,
    adres: form.adres,
    notlar: form.notlar,
    tarih: form.tarih,
    fiyat: topFiyat,
    durum: "bekliyor",
    firma_id: firmaId || form.firmaId || null,
  };

  if (editId) {
    await sbFetch(
      `siparisler?id=eq.${editId}`,
      { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ ...siparisData, id: undefined }) },
      token
    );
    await sbFetch(
      `hali_kalemleri?siparis_id=eq.${editId}`,
      { method: "DELETE", prefer: "return=minimal" },
      token
    );
  } else {
    await sbFetch(
      "siparisler",
      { method: "POST", body: JSON.stringify(siparisData) },
      token
    );
  }

  // Müşteriyi kaydet/güncelle
  const aktifFirmaId = firmaId || form.firmaId;
  if (aktifFirmaId) {
    await dbMusteriKaydet(token, aktifFirmaId, form.musteri, form.telefon, form.adres);
  }

  const kalemler = form.haliKalemleri.map((k) => {
    const tur = ht.find((t) => t.id === k.turId);
    return {
      siparis_id: id,
      tur_id: k.turId,
      adet: k.adet,
      m2: k.m2,
      birim_fiyat: tur?.birimFiyat || 0,
      tutar: (tur?.birimFiyat || 0) * (k.m2 || 0) * (k.adet || 1),
    };
  });

  if (kalemler.length > 0) {
    await sbFetch(
      "hali_kalemleri",
      { method: "POST", body: JSON.stringify(kalemler) },
      token
    );
  }

  return id;
}

export async function dbSil(token: string, id: string): Promise<void> {
  await sbFetch(
    `siparisler?id=eq.${id}`,
    { method: "DELETE", prefer: "return=minimal" },
    token
  );
}
export async function dbMusteriAra(
  token: string,
  firmaId: string,
  aramaMetni: string
): Promise<{ id: string; ad_soyad: string; telefon: string; adres: string }[]> {
  if (!aramaMetni || aramaMetni.length < 2) return [];
  try {
    const sonuc = await sbFetch(
      `musteriler?firma_id=eq.${firmaId}&ad_soyad=ilike.*${aramaMetni}*&select=id,ad_soyad,telefon,adres&limit=5`,
      {},
      token
    ) as { id: string; ad_soyad: string; telefon: string; adres: string }[];
    return sonuc;
  } catch {
    return [];
  }
}

export async function dbMusteriKaydet(
  token: string,
  firmaId: string,
  adSoyad: string,
  telefon: string,
  adres: string
): Promise<void> {
  // Aynı telefon+firma varsa güncelle, yoksa ekle
  const mevcut = await sbFetch(
    `musteriler?firma_id=eq.${firmaId}&telefon=eq.${telefon}&select=id`,
    {},
    token
  ) as { id: string }[];

  if (mevcut?.length > 0) {
    await sbFetch(
      `musteriler?id=eq.${mevcut[0].id}`,
      { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ ad_soyad: adSoyad, adres }) },
      token
    );
  } else {
    await sbFetch(
      "musteriler",
      { method: "POST", body: JSON.stringify({ firma_id: firmaId, ad_soyad: adSoyad, telefon, adres }) },
      token
    );
  }
}