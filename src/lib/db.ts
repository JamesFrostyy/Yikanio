import { sbFetch } from "./supabase";
import { VARSAYILAN_FIYAT_LISTESI } from "../constants";
import { Siparis, HaliTuru, Firma, HaliKalemi } from "../types";

export const toplamM2 = (k: HaliKalemi[]): number =>
  k.reduce((s, x) => s + (Number(x.m2) || 0) * (Number(x.adet) || 1), 0);

export const toplamAdet = (k: HaliKalemi[]): number =>
  k.reduce((s, x) => s + (Number(x.adet) || 0), 0);

export async function dbHaliTurleriniGetir(token: string, firmaId: string): Promise<HaliTuru[]> {
  let turler = (await sbFetch(`hali_fiyatlari?firma_id=eq.${firmaId}&select=*`, {}, token)) as Record<string, unknown>[];
  if (turler.length === 0) {
    const yeniListe = VARSAYILAN_FIYAT_LISTESI.map((t) => ({
      firma_id: firmaId,
      tur_id: t.ad.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
      ad: t.ad, birim_fiyat: t.birimFiyat, icon: t.icon,
    }));
    turler = (await sbFetch("hali_fiyatlari", { method: "POST", body: JSON.stringify(yeniListe) }, token)) as Record<string, unknown>[];
  }
  return turler.map((t) => ({ id: t.tur_id as string, ad: t.ad as string, birimFiyat: Number(t.birim_fiyat), icon: t.icon as string }));
}

export async function dbHaliTurleriKaydet(token: string, firmaId: string, turler: HaliTuru[]): Promise<void> {
  await sbFetch(`hali_fiyatlari?firma_id=eq.${firmaId}`, { method: "DELETE", prefer: "return=minimal" }, token);
  const yeniListe = turler.map((t) => ({ firma_id: firmaId, tur_id: t.id, ad: t.ad, birim_fiyat: t.birimFiyat, icon: t.icon }));
  await sbFetch("hali_fiyatlari", { method: "POST", body: JSON.stringify(yeniListe) }, token);
}

export async function dbGetir(token: string, isAdmin: boolean): Promise<Siparis[]> {
  const query = isAdmin
    ? "siparisler?select=*,firmalar(ad),hali_kalemleri(*)&order=olusturuldu.desc"
    : "siparisler?select=*,hali_kalemleri(*)&order=olusturuldu.desc";
  try {
    const ss = (await sbFetch(query, {}, token)) as Record<string, unknown>[];
    return ss.map((s) => ({
      id: s.id as string, musteri: s.musteri_ad as string, telefon: s.telefon as string,
      adres: (s.adres as string) || "", durum: s.durum as string, notlar: (s.notlar as string) || "",
      fiyat: Number(s.fiyat), tarih: s.tarih as string,
      smsDurum: (s.sms_durum as Record<string, boolean>) || {},
      firmaId: s.firma_id as string,
      firmaAd: (s.firmalar as Record<string, string>)?.ad || "",
      haliKalemleri: ((s.hali_kalemleri as Record<string, unknown>[]) || []).map((k) => ({
        turId: k.tur_id as string, adet: Number(k.adet), m2: Number(k.m2), birimFiyat: Number(k.birim_fiyat),
      })),
    }));
  } catch (e) { console.error("dbGetir hatası:", e); return []; }
}

export async function dbFirmalariGetir(token: string): Promise<Firma[]> {
  const raw = (await sbFetch("firmalar?select=*&order=olusturuldu.desc", {}, token)) as Record<string, unknown>[];
  return raw.map((f) => ({
    id: f.id as string, ad: f.ad as string, email: f.email as string, aktif: f.aktif as boolean,
    paket: (f.paket as Firma["paket"]) || "starter",
    addonlar: Array.isArray(f.addonlar) ? (f.addonlar as Firma["addonlar"]) : typeof f.addonlar === "string" ? JSON.parse(f.addonlar) : [],
    netgsm_user: f.netgsm_user as string | undefined,
    netgsm_pass: f.netgsm_pass as string | undefined,
    netgsm_baslik: f.netgsm_baslik as string | undefined,       
    sms_kredisi: f.sms_kredisi as number | undefined,
    wa_api_key: f.wa_api_key as string | undefined,
    wa_phone_id: f.wa_phone_id as string | undefined,
  }));
}

export async function dbFirmaEkle(
  token: string,
  ad: string,
  email: string,
  extra?: Record<string, string | undefined>
): Promise<void> {
  const body: Record<string, unknown> = { ad, email, aktif: true };
  if (extra) {
    if (extra.paket) body.paket = extra.paket;
    if (extra.addonlar) {
      try { body.addonlar = JSON.parse(extra.addonlar); }
      catch { body.addonlar = []; }
    }
    if (extra.netgsm_user) body.netgsm_user = extra.netgsm_user;
    if (extra.netgsm_pass) body.netgsm_pass = extra.netgsm_pass;
    if (extra.netgsm_baslik) body.netgsm_baslik = extra.netgsm_baslik;
    if (extra.wa_api_key) body.wa_api_key = extra.wa_api_key;
    if (extra.wa_phone_id) body.wa_phone_id = extra.wa_phone_id;
    // ✅ YENİ firma için SMS kredisi
    body.sms_kredisi = extra.sms_kredisi ? Number(extra.sms_kredisi) : 50;
  }
  await sbFetch("firmalar", { method: "POST", body: JSON.stringify(body) }, token);
}
export async function dbFirmaGuncelle(
  token: string,
  id: string,
  ad: string,
  aktif: boolean,
  extra?: Record<string, string | undefined>
): Promise<void> {
  const body: Record<string, unknown> = { ad, aktif };
  if (extra) {
    if (extra.paket) body.paket = extra.paket;
    if (extra.addonlar !== undefined) {
      try { body.addonlar = JSON.parse(extra.addonlar); }
      catch { body.addonlar = []; }
    }
    body.netgsm_user = extra.netgsm_user || null;
    body.netgsm_pass = extra.netgsm_pass || null;
    body.netgsm_baslik = extra.netgsm_baslik || null;  // ← zaten var mı kontrol edin
    body.wa_api_key = extra.wa_api_key || null;
    body.wa_phone_id = extra.wa_phone_id || null;
    // ✅ SMS KREDİSİ — string'den number'a çevir
    if (extra.sms_kredisi !== undefined) {
      body.sms_kredisi = Number(extra.sms_kredisi);
    }
  }
  await sbFetch(
    `firmalar?id=eq.${id}`,
    { method: "PATCH", prefer: "return=minimal", body: JSON.stringify(body) },
    token
  );
}

export async function dbFirmaSil(token: string, id: string): Promise<void> {
  await sbFetch(`firmalar?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }, token);
}

export async function dbKaydet(
  form: { musteri: string; telefon: string; adres: string; notlar: string; tarih: string; firmaId: string; haliKalemleri: HaliKalemi[] },
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

  if (editId) {
    // Edit: sadece müşteri bilgilerini ve fiyatı güncelle — durum DOKUNULMAZ
    const editData = {
      musteri_ad: form.musteri,
      telefon: form.telefon,
      adres: form.adres,
      notlar: form.notlar,
      fiyat: topFiyat,
    };
    await sbFetch(
      `siparisler?id=eq.${editId}`,
      { method: "PATCH", prefer: "return=minimal", body: JSON.stringify(editData) },
      token
    );
    await sbFetch(
      `hali_kalemleri?siparis_id=eq.${editId}`,
      { method: "DELETE", prefer: "return=minimal" },
      token
    );
  } else {
    // Yeni sipariş
    const yeniData = {
      id,
      musteri_ad: form.musteri,
      telefon: form.telefon,
      adres: form.adres,
      notlar: form.notlar,
      tarih: form.tarih,
      fiyat: topFiyat,
      durum: "bekliyor",
      firma_id: firmaId || form.firmaId || null,
      sms_durum: {},
    };
    await sbFetch(
      "siparisler",
      { method: "POST", body: JSON.stringify(yeniData) },
      token
    );
  }

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
    `hali_kalemleri?siparis_id=eq.${id}`,
    { method: "DELETE", prefer: "return=minimal" },
    token
  );
  await sbFetch(
    `sms_log?siparis_id=eq.${id}`,
    { method: "DELETE", prefer: "return=minimal" },
    token
  );
  await sbFetch(
    `siparisler?id=eq.${id}`,
    { method: "DELETE", prefer: "return=minimal" },
    token
  );
}

export async function dbMusteriKaydet(token: string, firmaId: string, adSoyad: string, telefon: string, adres: string): Promise<void> {
  const mevcut = await sbFetch(`musteriler?firma_id=eq.${firmaId}&telefon=eq.${telefon}&select=id`, {}, token) as { id: string }[];
  if (mevcut?.length > 0) {
    await sbFetch(`musteriler?id=eq.${mevcut[0].id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ ad_soyad: adSoyad, adres }) }, token);
  } else {
    await sbFetch("musteriler", { method: "POST", body: JSON.stringify({ firma_id: firmaId, ad_soyad: adSoyad, telefon, adres }) }, token);
  }
}

export async function dbMusteriAra(token: string, firmaId: string, aramaMetni: string): Promise<{ id: string; ad_soyad: string; telefon: string; adres: string }[]> {
  if (!aramaMetni || aramaMetni.length < 2) return [];
  try {
    return await sbFetch(
      `musteriler?firma_id=eq.${firmaId}&ad_soyad=ilike.*${aramaMetni}*&select=id,ad_soyad,telefon,adres&limit=5`,
      {},
      token
    ) as { id: string; ad_soyad: string; telefon: string; adres: string }[];
  } catch { return []; }
}