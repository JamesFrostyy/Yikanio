import { useState, useEffect } from "react";
import { Firma, PaketTip, AddonTip, PAKETLER, ADDONLAR } from "../types";
import { dbFirmalariGetir, dbFirmaEkle, dbFirmaGuncelle, dbFirmaSil } from "../lib/db";
import { SUPABASE_URL, SUPABASE_KEY } from "../constants";

interface FirmaModalProps {
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

const inp: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0",
  fontSize: 14, fontFamily: "'Poppins', sans-serif",
  outline: "none", width: "100%", boxSizing: "border-box",
};

const ADDON_LISTESI = Object.entries(ADDONLAR) as [AddonTip, typeof ADDONLAR[AddonTip]][];

const HESAP_DURUM_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  demo:    { label: "Demo",    color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", icon: "🧪" },
  aktif:   { label: "Aktif",   color: "#059669", bg: "#F0FDF4", border: "#BBF7D0", icon: "✅" },
  gecikme: { label: "Gecikme", color: "#D97706", bg: "#FFF7ED", border: "#FDE68A", icon: "⚠️" },
  pasif:   { label: "Pasif",   color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: "🔴" },
  iptal:   { label: "İptal",   color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB", icon: "❌" },
};

// Tarihe kaç gün kaldığını hesapla (negatif = geçti)
function gunFarki(tarih?: string): number {
  if (!tarih) return 0;
  return Math.ceil((new Date(tarih).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ISO tarihi input[type=date] formatına çevir
function toDateInput(iso?: string): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

// input[type=date] değerini ISO'ya çevir
function toISO(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString();
}

export function FirmaModal({ token, onClose, onSaved }: FirmaModalProps) {
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Temel
  const [ad, setAd] = useState("");
  const [email, setEmail] = useState("");
  const [yetkiliAd, setYetkiliAd] = useState("");
  const [telefon, setTelefon] = useState("");
  const [aktif, setAktif] = useState(true);
  const [hesapDurum, setHesapDurum] = useState<string>("demo");

  // Paket
  const [paket, setPaket] = useState<PaketTip>("starter");
  const [addonlar, setAddonlar] = useState<AddonTip[]>([]);
  const [smsKredisi, setSmsKredisi] = useState<number>(50);

  // Tarihler
  const [demoBitis, setDemoBitis] = useState<string>("");
  const [abonelikBaslangic, setAbonelikBaslangic] = useState<string>("");
  const [sonOdemeTarihi, setSonOdemeTarihi] = useState<string>("");
  const [sonrakiOdemeTarihi, setSonrakiOdemeTarihi] = useState<string>("");

  // Entegrasyon
  const [netgsmUser, setNetgsmUser] = useState("");
  const [netgsmPass, setNetgsmPass] = useState("");
  const [netgsmBaslik, setNetgsmBaslik] = useState("");
  const [waApiKey, setWaApiKey] = useState("");
  const [waPhoneId, setWaPhoneId] = useState("");

  // UI
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [aktifTab, setAktifTab] = useState<"temel" | "paket" | "tarihler" | "entegrasyon">("temel");

  const yukle = async () => {
    setLoading(true);
    const list = await dbFirmalariGetir(token);
    setFirmalar(list);
    setLoading(false);
  };

  useEffect(() => { yukle(); }, []);

  const formuTemizle = () => {
    setAd(""); setEmail(""); setYetkiliAd(""); setTelefon(""); setAktif(true);
    setHesapDurum("demo"); setPaket("starter"); setAddonlar([]);
    setSmsKredisi(50); setDemoBitis(""); setAbonelikBaslangic("");
    setSonOdemeTarihi(""); setSonrakiOdemeTarihi("");
    setNetgsmUser(""); setNetgsmPass(""); setNetgsmBaslik("");
    setWaApiKey(""); setWaPhoneId("");
    setIsEditing(false); setEditId(null); setErr("");
    setAktifTab("temel");
  };

  const duzenleModunaGec = (f: Firma) => {
    setAd(f.ad); setEmail(f.email); setYetkiliAd(f.yetkili_ad || "");
    setTelefon(f.telefon || ""); setAktif(f.aktif);
    setHesapDurum(f.hesap_durum || "demo");
    setPaket(f.paket || "starter"); setAddonlar(f.addonlar || []);
    setSmsKredisi(f.sms_kredisi ?? 50);
    setDemoBitis(toDateInput(f.demo_bitis));
    setAbonelikBaslangic(toDateInput(f.abonelik_baslangic));
    setSonOdemeTarihi(toDateInput(f.son_odeme_tarihi));
    setSonrakiOdemeTarihi(toDateInput(f.sonraki_odeme_tarihi));
    setNetgsmUser(f.netgsm_user || ""); setNetgsmPass(f.netgsm_pass || "");
    setNetgsmBaslik(f.netgsm_baslik || "");
    setWaApiKey(f.wa_api_key || ""); setWaPhoneId(f.wa_phone_id || "");
    setIsEditing(true); setEditId(f.id); setErr("");
    setAktifTab("temel");
  };
  // Hesap durumu değişince aktifliği otomatik ayarla
    useEffect(() => {
    if (hesapDurum === "aktif" || hesapDurum === "demo" || hesapDurum === "gecikme") {
    setAktif(true);
    } else if (hesapDurum === "pasif" || hesapDurum === "iptal") {
    setAktif(false);
    }
    }, [hesapDurum]);

  const toggleAddon = (addon: AddonTip) => {
    setAddonlar((prev) => prev.includes(addon) ? prev.filter((a) => a !== addon) : [...prev, addon]);
  };

  const kaydet = async () => {
    if (!ad.trim()) { setErr("Firma adı zorunludur."); return; }
    if (netgsmBaslik && netgsmBaslik.length > 11) { setErr("SMS başlığı en fazla 11 karakter."); return; }
    setSaving(true); setErr("");
    try {
      const extra: Record<string, string | undefined> = {
        paket,
        addonlar: JSON.stringify(addonlar),
        yetkili_ad: yetkiliAd || undefined,
        telefon: telefon || undefined,
        hesap_durum: hesapDurum,
        sms_kredisi: String(smsKredisi),
        demo_bitis: demoBitis ? toISO(demoBitis) : undefined,
        abonelik_baslangic: abonelikBaslangic ? toISO(abonelikBaslangic) : undefined,
        son_odeme_tarihi: sonOdemeTarihi ? toISO(sonOdemeTarihi) : undefined,
        sonraki_odeme_tarihi: sonrakiOdemeTarihi ? toISO(sonrakiOdemeTarihi) : undefined,
        netgsm_user: netgsmUser || undefined,
        netgsm_pass: netgsmPass || undefined,
        netgsm_baslik: netgsmBaslik || undefined,
        wa_api_key: waApiKey || undefined,
        wa_phone_id: waPhoneId || undefined,
      };

      if (isEditing && editId) {
        await dbFirmaGuncelle(token, editId, ad, aktif, extra);
      } else {
        if (!email.trim()) { setErr("Email zorunludur."); setSaving(false); return; }
        await dbFirmaEkle(token, ad, email, extra);
        await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      }
      formuTemizle();
      await yukle();
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const sil = async (id: string) => {
    await dbFirmaSil(token, id);
    setDeleteConfirm(null);
    await yukle();
    onSaved();
  };

  const toplamFiyat = () => {
    return PAKETLER[paket].fiyat + addonlar.reduce((sum, a) => sum + (ADDONLAR[a]?.fiyat || 0), 0);
  };

  const tabBtn = (key: typeof aktifTab, label: string) => (
    <button onClick={() => setAktifTab(key)} style={{
      flex: 1, padding: "7px 0", border: "none", cursor: "pointer",
      fontFamily: "inherit", fontWeight: 600, fontSize: 12, borderRadius: 7, transition: "all 0.2s",
      background: aktifTab === key ? "#1E40AF" : "transparent",
      color: aktifTab === key ? "#fff" : "#64748B",
    }}>{label}</button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, fontFamily: "'Poppins', sans-serif", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 580, maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>

        {/* Başlık */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🏢 Firma Yönetimi</h2>
          <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer" }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ background: isEditing ? "#EFF6FF" : "#F8FAFC", borderRadius: 14, padding: 16, border: `1.5px dashed ${isEditing ? "#93C5FD" : "#CBD5E1"}`, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: isEditing ? "#1D4ED8" : "#6B7280", textTransform: "uppercase" }}>
              {isEditing ? "✏️ Firmayı Düzenle" : "Yeni Firma Ekle"}
            </div>
            {isEditing && <button onClick={formuTemizle} style={{ background: "transparent", border: "none", color: "#64748B", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>İptal Et</button>}
          </div>

          {/* Tab Navigasyon */}
          <div style={{ display: "flex", gap: 3, background: "#E2E8F0", borderRadius: 10, padding: 3, marginBottom: 16 }}>
            {tabBtn("temel", "Temel")}
            {tabBtn("paket", "Paket")}
            {tabBtn("tarihler", "Tarihler")}
            {tabBtn("entegrasyon", "Entegrasyon")}
          </div>

          {/* ── TAB: TEMEL ───────────────────────────────────────── */}
          {aktifTab === "temel" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>Firma Adı *</div>
                  <input style={inp} value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Yıldız Halı Yıkama" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>Yetkili Kişi</div>
                  <input style={inp} value={yetkiliAd} onChange={(e) => setYetkiliAd(e.target.value)} placeholder="Ad Soyad" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>Email *</div>
                  <input style={{ ...inp, opacity: isEditing ? 0.6 : 1 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEditing} placeholder="firma@email.com" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>Telefon</div>
                  <input style={inp} type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="05XX XXX XX XX" />
                </div>
              </div>
              {isEditing && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>Hesap Durumu</div>
                    <select style={inp} value={hesapDurum} onChange={(e) => setHesapDurum(e.target.value)}>
                      {Object.entries(HESAP_DURUM_CFG).map(([k, v]) => (
                        <option key={k} value={k}>{v.icon} {v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>Hesap Aktifliği</div>
                    <select style={inp} value={aktif ? "true" : "false"} onChange={(e) => setAktif(e.target.value === "true")}>
                      <option value="true">🟢 Aktif</option>
                      <option value="false">🔴 Pasif (Dondurulmuş)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: PAKET ───────────────────────────────────────── */}
          {aktifTab === "paket" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 8, textTransform: "uppercase" }}>Abonelik Paketi</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                {(Object.entries(PAKETLER) as [PaketTip, typeof PAKETLER[PaketTip]][]).map(([key, p]) => (
                  <button key={key} onClick={() => { setPaket(key); if (key === "starter") setAddonlar([]); }}
                    style={{ padding: "10px 6px", borderRadius: 12, border: `2px solid ${paket === key ? p.renk : "#E2E8F0"}`, background: paket === key ? p.bg : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: p.renk }}>{p.ad}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>₺{p.fiyat.toLocaleString()}/ay</div>
                    {paket === key && <div style={{ fontSize: 10, color: p.renk, marginTop: 2 }}>✓ Seçili</div>}
                  </button>
                ))}
              </div>

              {/* SMS Kredisi */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase" }}>📱 SMS Kredisi</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", marginBottom: 16 }}>
                <input style={inp} type="number" min={0} value={smsKredisi} onChange={(e) => setSmsKredisi(Number(e.target.value))} />
                <span style={{ fontSize: 13, color: "#64748B" }}>adet</span>
              </div>

              {/* Addon */}
              {paket !== "starter" ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 8, textTransform: "uppercase" }}>Kapasite Addları</div>
                  <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                    {ADDON_LISTESI.map(([key, addon]) => {
                      const secili = addonlar.includes(key);
                      return (
                        <div key={key} onClick={() => toggleAddon(key)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, cursor: "pointer", border: `1.5px solid ${secili ? "#93C5FD" : "#E2E8F0"}`, background: secili ? "#EFF6FF" : "#F8FAFC" }}>
                          <span style={{ fontSize: 18 }}>{addon.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: secili ? "#1D4ED8" : "#334155" }}>{addon.ad}</div>
                            <div style={{ fontSize: 11, color: "#94A3B8" }}>{addon.aciklama}</div>
                          </div>
                          <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${secili ? "#3B82F6" : "#CBD5E1"}`, background: secili ? "#3B82F6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11 }}>
                            {secili ? "✓" : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "12px 0", color: "#94A3B8", fontSize: 13, marginBottom: 16 }}>Starter pakette addon bulunmaz.</div>
              )}

              {/* Toplam */}
              <div style={{ padding: "10px 14px", background: "#F0FDF4", borderRadius: 10, border: "1px solid #BBF7D0", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>Aylık Toplam</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#059669" }}>₺{toplamFiyat().toLocaleString()}/ay</span>
              </div>
            </div>
          )}

          {/* ── TAB: TARİHLER ────────────────────────────────────── */}
          {aktifTab === "tarihler" && (
            <div style={{ display: "grid", gap: 14 }}>

              {/* Demo */}
              <div style={{ background: "#F5F3FF", borderRadius: 12, padding: 14, border: "1px solid #DDD6FE" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", marginBottom: 10, textTransform: "uppercase" }}>🧪 Demo Süresi</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 5 }}>Demo Bitiş Tarihi</div>
                  <input style={inp} type="date" value={demoBitis} onChange={(e) => setDemoBitis(e.target.value)} />
                  {demoBitis && (
                    <div style={{ fontSize: 12, marginTop: 6, color: gunFarki(toISO(demoBitis)) > 0 ? "#7C3AED" : "#DC2626", fontWeight: 600 }}>
                      {gunFarki(toISO(demoBitis)) > 0
                        ? `⏳ ${gunFarki(toISO(demoBitis))} gün kaldı`
                        : `🔴 ${Math.abs(gunFarki(toISO(demoBitis)))} gün önce bitti`}
                    </div>
                  )}
                </div>
              </div>

              {/* Abonelik */}
              <div style={{ background: "#F0FDF4", borderRadius: 12, padding: 14, border: "1px solid #BBF7D0" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 10, textTransform: "uppercase" }}>💳 Abonelik & Ödeme</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 5 }}>Abonelik Başlangıcı</div>
                    <input style={inp} type="date" value={abonelikBaslangic} onChange={(e) => setAbonelikBaslangic(e.target.value)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 5 }}>Son Ödeme Tarihi</div>
                      <input style={inp} type="date" value={sonOdemeTarihi} onChange={(e) => setSonOdemeTarihi(e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 5 }}>Sonraki Ödeme</div>
                      <input style={inp} type="date" value={sonrakiOdemeTarihi} onChange={(e) => setSonrakiOdemeTarihi(e.target.value)} />
                    </div>
                  </div>
                  {sonrakiOdemeTarihi && (
                    <div style={{ fontSize: 12, color: gunFarki(toISO(sonrakiOdemeTarihi)) <= 3 ? "#DC2626" : gunFarki(toISO(sonrakiOdemeTarihi)) <= 7 ? "#D97706" : "#059669", fontWeight: 600 }}>
                      {gunFarki(toISO(sonrakiOdemeTarihi)) < 0
                        ? `🔴 Ödeme ${Math.abs(gunFarki(toISO(sonrakiOdemeTarihi)))} gün gecikmiş!`
                        : gunFarki(toISO(sonrakiOdemeTarihi)) === 0
                        ? "🔴 Bugün son ödeme günü!"
                        : `💰 ${gunFarki(toISO(sonrakiOdemeTarihi))} gün sonra ödeme`}
                    </div>
                  )}
                </div>
              </div>

              {/* Hızlı Aksiyon: Demo → Aktif */}
              {isEditing && hesapDurum === "demo" && (
                <button
                  onClick={() => {
                    setHesapDurum("aktif");
                    const bugun = new Date().toISOString().split("T")[0];
                    const birAySonra = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
                    setAbonelikBaslangic(bugun);
                    setSonrakiOdemeTarihi(birAySonra);
                    setAktifTab("temel");
                  }}
                  style={{ padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#059669,#10B981)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}
                >
                  🚀 Demo → Aktif Aboneliğe Geçir
                </button>
              )}
            </div>
          )}

          {/* ── TAB: ENTEGRASYON ─────────────────────────────────── */}
          {aktifTab === "entegrasyon" && (
            <div style={{ display: "grid", gap: 12 }}>
              {paket === "starter" && (
                <div style={{ padding: "10px 12px", background: "#FFF7ED", borderRadius: 10, border: "1px solid #FED7AA", fontSize: 13, color: "#92400E" }}>
                  ⚠️ Netgsm ve WhatsApp API entegrasyonu Pro+ paketlerde kullanılabilir.
                </div>
              )}

              {/* SMS Başlığı — tüm paketler */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase" }}>🏷️ SMS Başlığı (Gönderen Adı)</div>
                <input style={inp} value={netgsmBaslik} onChange={(e) => setNetgsmBaslik(e.target.value.slice(0, 11))} placeholder="Max 11 karakter (örn: YILDIZHAL)" maxLength={11} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>Türkçe karakter kullanmayın</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: netgsmBaslik.length >= 10 ? "#DC2626" : "#94A3B8" }}>{netgsmBaslik.length}/11</span>
                </div>
              </div>

              {/* Netgsm */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>📱 Netgsm (Merkezi Hesap)</div>
              <input style={{ ...inp, opacity: paket === "starter" ? 0.5 : 1 }} disabled={paket === "starter"} value={netgsmUser} onChange={(e) => setNetgsmUser(e.target.value)} placeholder="Netgsm kullanıcı adı" />
              <input style={{ ...inp, opacity: paket === "starter" ? 0.5 : 1 }} disabled={paket === "starter"} type="password" value={netgsmPass} onChange={(e) => setNetgsmPass(e.target.value)} placeholder="Netgsm şifre" />

              {/* WhatsApp */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", marginTop: 4 }}>💬 WhatsApp Business API</div>
              <input style={{ ...inp, opacity: paket === "starter" ? 0.5 : 1 }} disabled={paket === "starter"} value={waApiKey} onChange={(e) => setWaApiKey(e.target.value)} placeholder="Meta API Key" />
              <input style={{ ...inp, opacity: paket === "starter" ? 0.5 : 1 }} disabled={paket === "starter"} value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} placeholder="WhatsApp Phone ID" />
            </div>
          )}

          {err && <div style={{ color: "#DC2626", fontSize: 12, marginTop: 12 }}>❌ {err}</div>}

          <button onClick={kaydet} disabled={saving} style={{ marginTop: 14, width: "100%", padding: 12, borderRadius: 10, border: "none", background: isEditing ? "linear-gradient(135deg,#059669,#10B981)" : "linear-gradient(135deg,#1E40AF,#3B82F6)", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
            {saving ? "İşleniyor..." : isEditing ? "Değişiklikleri Kaydet" : "+ Firma Ekle & Davet Gönder"}
          </button>
        </div>

        {/* ── MEVCUT FİRMALAR LİSTESİ ─────────────────────────── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 8, textTransform: "uppercase" }}>Mevcut Firmalar</div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 20, color: "#9CA3AF" }}>Yükleniyor...</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {firmalar.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#9CA3AF", fontSize: 14 }}>Henüz firma yok</div>}
            {firmalar.map((f) => {
              const p = PAKETLER[f.paket || "starter"];
              const durum = HESAP_DURUM_CFG[f.hesap_durum || "demo"];
              const demKalan = gunFarki(f.demo_bitis);
              const odemeKalan = gunFarki(f.sonraki_odeme_tarihi);

              return (
                <div key={f.id} style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 14px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>

                      {/* Ad + Paket + Durum */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>🏢 {f.ad}</span>
                        <span style={{ fontSize: 10, background: p.bg, color: p.renk, padding: "2px 7px", borderRadius: 20, fontWeight: 700, border: `1px solid ${p.renk}20` }}>{p.ad}</span>
                        <span style={{ fontSize: 10, background: durum.bg, color: durum.color, padding: "2px 7px", borderRadius: 20, fontWeight: 700, border: `1px solid ${durum.border}` }}>{durum.icon} {durum.label}</span>
                        {!f.aktif && <span style={{ fontSize: 10, background: "#FEE2E2", color: "#DC2626", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>Dondurulmuş</span>}
                      </div>

                      {/* Email + Yetkili */}
                      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>
                        {f.email}
                        {f.yetkili_ad && <span style={{ marginLeft: 8, color: "#94A3B8" }}>· {f.yetkili_ad}</span>}
                        {f.telefon && <span style={{ marginLeft: 8, color: "#94A3B8" }}>· {f.telefon}</span>}
                      </div>

                      {/* Badges: SMS, Demo/Ödeme uyarıları */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {f.netgsm_baslik && (
                          <span style={{ fontSize: 10, background: "#F0F9FF", color: "#0284C7", padding: "2px 7px", borderRadius: 20, border: "1px solid #BAE6FD", fontWeight: 600 }}>
                            📱 {f.netgsm_baslik}
                          </span>
                        )}
                        <span style={{ fontSize: 10, background: (f.sms_kredisi ?? 0) > 10 ? "#F0FDF4" : "#FEF2F2", color: (f.sms_kredisi ?? 0) > 10 ? "#059669" : "#DC2626", padding: "2px 7px", borderRadius: 20, border: `1px solid ${(f.sms_kredisi ?? 0) > 10 ? "#BBF7D0" : "#FECACA"}`, fontWeight: 700 }}>
                          💬 {f.sms_kredisi ?? 0} SMS
                        </span>
                        {f.hesap_durum === "demo" && f.demo_bitis && (
                          <span style={{ fontSize: 10, background: demKalan > 3 ? "#F5F3FF" : "#FEF2F2", color: demKalan > 3 ? "#7C3AED" : "#DC2626", padding: "2px 7px", borderRadius: 20, border: "1px solid #DDD6FE", fontWeight: 700 }}>
                            {demKalan > 0 ? `⏳ ${demKalan}g demo` : "🔴 Demo bitti"}
                          </span>
                        )}
                        {f.hesap_durum === "aktif" && f.sonraki_odeme_tarihi && (
                          <span style={{ fontSize: 10, background: odemeKalan <= 3 ? "#FEF2F2" : "#F0FDF4", color: odemeKalan <= 3 ? "#DC2626" : "#059669", padding: "2px 7px", borderRadius: 20, border: `1px solid ${odemeKalan <= 3 ? "#FECACA" : "#BBF7D0"}`, fontWeight: 700 }}>
                            {odemeKalan < 0 ? `🔴 ${Math.abs(odemeKalan)}g gecikme` : odemeKalan === 0 ? "🔴 Bugün son gün" : `💰 ${odemeKalan}g sonra ödeme`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8, marginTop: 2 }}>
                      <button onClick={() => duzenleModunaGec(f)} style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Düzenle</button>
                      <button onClick={() => setDeleteConfirm(f.id)} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Sil</button>
                    </div>
                  </div>

                  {deleteConfirm === f.id && (
                    <div style={{ background: "#FEF2F2", padding: "10px 14px", borderTop: "1px solid #FECACA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>⚠️ Firmayı silmek istiyor musunuz?</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setDeleteConfirm(null)} style={{ background: "#fff", border: "1px solid #FECACA", color: "#475569", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>İptal</button>
                        <button onClick={() => sil(f.id)} style={{ background: "#DC2626", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Evet, Sil</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}