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

export function FirmaModal({ token, onClose, onSaved }: FirmaModalProps) {
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ad, setAd] = useState("");
  const [email, setEmail] = useState("");
  const [aktif, setAktif] = useState(true);
  const [paket, setPaket] = useState<PaketTip>("starter");
  const [addonlar, setAddonlar] = useState<AddonTip[]>([]);
  const [netgsmUser, setNetgsmUser] = useState("");
  const [netgsmPass, setNetgsmPass] = useState("");
  const [netgsmBaslik, setNetgsmBaslik] = useState("");   // ← YENİ
  const [smsKredisi, setSmsKredisi] = useState<number>(50); // ← YENİ
  const [waApiKey, setWaApiKey] = useState("");
  const [waPhoneId, setWaPhoneId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedFirma, setExpandedFirma] = useState<string | null>(null);
  const [aktifTab, setAktifTab] = useState<"temel" | "paket" | "entegrasyon">("temel");

  const yukle = async () => {
    setLoading(true);
    const list = await dbFirmalariGetir(token);
    setFirmalar(list);
    setLoading(false);
  };

  useEffect(() => { yukle(); }, []);

  const formuTemizle = () => {
    setAd(""); setEmail(""); setAktif(true);
    setPaket("starter"); setAddonlar([]);
    setNetgsmUser(""); setNetgsmPass("");
    setNetgsmBaslik(""); setSmsKredisi(50); // ← YENİ
    setWaApiKey(""); setWaPhoneId("");
    setIsEditing(false); setEditId(null); setErr("");
    setAktifTab("temel");
  };

  const duzenleModunaGec = (f: Firma) => {
    setAd(f.ad); setEmail(f.email); setAktif(f.aktif);
    setPaket(f.paket || "starter");
    setAddonlar(f.addonlar || []);
    setNetgsmUser(f.netgsm_user || "");
    setNetgsmPass(f.netgsm_pass || "");
    setNetgsmBaslik(f.netgsm_baslik || "");     // ← YENİ
    setSmsKredisi(f.sms_kredisi ?? 50);          // ← YENİ
    setWaApiKey(f.wa_api_key || "");
    setWaPhoneId(f.wa_phone_id || "");
    setIsEditing(true); setEditId(f.id); setErr("");
    setAktifTab("temel");
    setExpandedFirma(null);
  };

  const toggleAddon = (addon: AddonTip) => {
    setAddonlar((prev) =>
      prev.includes(addon) ? prev.filter((a) => a !== addon) : [...prev, addon]
    );
  };

  const kaydet = async () => {
    if (!ad.trim()) { setErr("Firma adı zorunludur."); return; }
    // SMS başlığı max 11 karakter kontrolü
    if (netgsmBaslik && netgsmBaslik.length > 11) {
      setErr("SMS başlığı en fazla 11 karakter olabilir."); return;
    }
    setSaving(true); setErr("");
    try {
      const extra = {
        paket,
        addonlar: JSON.stringify(addonlar),
        netgsm_user: netgsmUser || undefined,
        netgsm_pass: netgsmPass || undefined,
        netgsm_baslik: netgsmBaslik || undefined,   // ← YENİ
        sms_kredisi: String(smsKredisi),             // ← YENİ
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
    const paketFiyat = PAKETLER[paket].fiyat;
    const addonFiyat = addonlar.reduce((sum, a) => sum + (ADDONLAR[a]?.fiyat || 0), 0);
    return paketFiyat + addonFiyat;
  };

  const tabBtn = (key: typeof aktifTab, label: string) => (
    <button
      onClick={() => setAktifTab(key)}
      style={{
        flex: 1, padding: "8px 0", border: "none", cursor: "pointer",
        fontFamily: "inherit", fontWeight: 600, fontSize: 13,
        borderRadius: 8, transition: "all 0.2s",
        background: aktifTab === key ? "#1E40AF" : "transparent",
        color: aktifTab === key ? "#fff" : "#64748B",
      }}
    >{label}</button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, fontFamily: "'Poppins', sans-serif", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>

        {/* Başlık */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🏢 Firma Yönetimi</h2>
          <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer" }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ background: isEditing ? "#EFF6FF" : "#F8FAFC", borderRadius: 14, padding: 16, border: `1.5px dashed ${isEditing ? "#93C5FD" : "#CBD5E1"}`, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: isEditing ? "#1D4ED8" : "#6B7280", textTransform: "uppercase" }}>
              {isEditing ? "✏️ Firmayı Düzenle" : "Yeni Firma Ekle"}
            </div>
            {isEditing && <button onClick={formuTemizle} style={{ background: "transparent", border: "none", color: "#64748B", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>İptal Et</button>}
          </div>

          {/* Tab Navigasyon */}
          <div style={{ display: "flex", gap: 4, background: "#E2E8F0", borderRadius: 10, padding: 4, marginBottom: 16 }}>
            {tabBtn("temel", "Temel")}
            {tabBtn("paket", "Paket & Addon")}
            {tabBtn("entegrasyon", "Entegrasyon")}
          </div>

          {/* Tab: Temel */}
          {aktifTab === "temel" && (
            <div style={{ display: "grid", gap: 10 }}>
              <input style={inp} value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Firma adı" />
              <input style={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEditing} placeholder="Firma email adresi" />
              {isEditing && (
                <select style={inp} value={aktif ? "true" : "false"} onChange={(e) => setAktif(e.target.value === "true")}>
                  <option value="true">🟢 Hesap Aktif</option>
                  <option value="false">🔴 Hesap Pasif</option>
                </select>
              )}
            </div>
          )}

          {/* Tab: Paket & Addon */}
          {aktifTab === "paket" && (
            <div>
              {/* Paket Seçici */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10, textTransform: "uppercase" }}>Abonelik Paketi</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
                {(Object.entries(PAKETLER) as [PaketTip, typeof PAKETLER[PaketTip]][]).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => { setPaket(key); if (key === "starter") setAddonlar([]); }}
                    style={{
                      padding: "12px 8px", borderRadius: 12, border: `2px solid ${paket === key ? p.renk : "#E2E8F0"}`,
                      background: paket === key ? p.bg : "#fff", cursor: "pointer",
                      fontFamily: "inherit", transition: "all 0.2s", textAlign: "center",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: p.renk }}>{p.ad}</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>₺{p.fiyat.toLocaleString()}/ay</div>
                    {paket === key && <div style={{ fontSize: 10, marginTop: 4, color: p.renk }}>✓ Seçili</div>}
                  </button>
                ))}
              </div>

              {/* Seçili paketin özellikleri */}
              <div style={{ background: PAKETLER[paket].bg, borderRadius: 12, padding: "12px 14px", marginBottom: 20, border: `1px solid ${PAKETLER[paket].renk}20` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: PAKETLER[paket].renk, textTransform: "uppercase", marginBottom: 8 }}>Dahil Özellikler</div>
                {PAKETLER[paket].ozellikler.map((o, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#334155", padding: "3px 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: PAKETLER[paket].renk, fontWeight: 700 }}>✓</span> {o}
                  </div>
                ))}
              </div>

              {/* SMS Kredisi */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8, textTransform: "uppercase" }}>
                  📱 SMS Kredisi
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                  <input
                    style={inp}
                    type="number"
                    min={0}
                    value={smsKredisi}
                    onChange={(e) => setSmsKredisi(Number(e.target.value))}
                    placeholder="SMS kredisi"
                  />
                  <div style={{ fontSize: 13, color: "#64748B", whiteSpace: "nowrap" }}>adet</div>
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>
                  Starter: 50 hediye · Ek kredi satışı yapıyorsanız buradan güncelleyin
                </div>
              </div>

              {/* Addon — sadece Pro+ */}
              {paket !== "starter" ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10, textTransform: "uppercase" }}>Kapasite Addları</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {ADDON_LISTESI.map(([key, addon]) => {
                      const secili = addonlar.includes(key);
                      return (
                        <div
                          key={key}
                          onClick={() => toggleAddon(key)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                            border: `1.5px solid ${secili ? "#93C5FD" : "#E2E8F0"}`,
                            background: secili ? "#EFF6FF" : "#F8FAFC",
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: secili ? "#DBEAFE" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                            {addon.icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: secili ? "#1D4ED8" : "#334155" }}>{addon.ad}</div>
                            <div style={{ fontSize: 11, color: "#94A3B8" }}>{addon.aciklama}</div>
                          </div>
                          <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${secili ? "#3B82F6" : "#CBD5E1"}`, background: secili ? "#3B82F6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {secili ? "✓" : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 0", color: "#94A3B8", fontSize: 13 }}>
                  Starter pakette kapasite addon'u bulunmaz.
                </div>
              )}

              {/* Toplam */}
              <div style={{ marginTop: 16, padding: "12px 14px", background: "#F0FDF4", borderRadius: 12, border: "1px solid #BBF7D0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>Aylık Toplam</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#059669" }}>₺{toplamFiyat().toLocaleString()}/ay</span>
              </div>
            </div>
          )}

          {/* Tab: Entegrasyon */}
          {aktifTab === "entegrasyon" && (
            <div style={{ display: "grid", gap: 12 }}>
              {paket === "starter" && (
                <div style={{ padding: "12px 14px", background: "#FFF7ED", borderRadius: 10, border: "1px solid #FED7AA", fontSize: 13, color: "#92400E" }}>
                  ⚠️ Entegrasyon ayarları Pro ve Enterprise paketlerde kullanılabilir.
                </div>
              )}

              {/* Netgsm SMS */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>📱 Netgsm SMS</div>
              <input
                style={{ ...inp, opacity: paket === "starter" ? 0.5 : 1 }}
                disabled={paket === "starter"}
                value={netgsmUser}
                onChange={(e) => setNetgsmUser(e.target.value)}
                placeholder="Netgsm kullanıcı adı"
              />
              <input
                style={{ ...inp, opacity: paket === "starter" ? 0.5 : 1 }}
                disabled={paket === "starter"}
                type="password"
                value={netgsmPass}
                onChange={(e) => setNetgsmPass(e.target.value)}
                placeholder="Netgsm şifre"
              />

              {/* SMS Başlığı — tüm paketlerde ayarlanabilir */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: 6 }}>
                  🏷️ SMS Başlığı (Gönderen Adı)
                </div>
                <input
                  style={inp}
                  value={netgsmBaslik}
                  onChange={(e) => setNetgsmBaslik(e.target.value.slice(0, 11))}
                  placeholder="Max 11 karakter (örn: ALPHALIYIK)"
                  maxLength={11}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    Müşteri SMS'i bu isimden alır. Türkçe karakter kullanmayın.
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: netgsmBaslik.length >= 10 ? "#DC2626" : "#94A3B8" }}>
                    {netgsmBaslik.length}/11
                  </div>
                </div>
              </div>

              {/* WhatsApp Business API */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", marginTop: 4 }}>
                💬 WhatsApp Business API
              </div>
              <input
                style={{ ...inp, opacity: paket === "starter" ? 0.5 : 1 }}
                disabled={paket === "starter"}
                value={waApiKey}
                onChange={(e) => setWaApiKey(e.target.value)}
                placeholder="Meta API Key"
              />
              <input
                style={{ ...inp, opacity: paket === "starter" ? 0.5 : 1 }}
                disabled={paket === "starter"}
                value={waPhoneId}
                onChange={(e) => setWaPhoneId(e.target.value)}
                placeholder="WhatsApp Phone ID"
              />
            </div>
          )}

          {err && <div style={{ color: "#DC2626", fontSize: 12, marginTop: 12 }}>❌ {err}</div>}

          <button
            onClick={kaydet}
            disabled={saving}
            style={{ marginTop: 14, width: "100%", padding: 12, borderRadius: 10, border: "none", background: isEditing ? "linear-gradient(135deg,#059669,#10B981)" : "linear-gradient(135deg,#1E40AF,#3B82F6)", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}
          >
            {saving ? "İşleniyor..." : isEditing ? "Değişiklikleri Kaydet" : "+ Firma Ekle & Davet Gönder"}
          </button>
        </div>

        {/* Liste */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 8, textTransform: "uppercase" }}>Mevcut Firmalar</div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 20, color: "#9CA3AF" }}>Yükleniyor...</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {firmalar.length === 0 && (
              <div style={{ textAlign: "center", padding: 20, color: "#9CA3AF", fontSize: 14 }}>Henüz firma yok</div>
            )}
            {firmalar.map((f) => {
              const p = PAKETLER[f.paket || "starter"];
              const firmaAddonlar = (f.addonlar || []) as AddonTip[];
              return (
                <div key={f.id} style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        🏢 {f.ad}
                        <span style={{ fontSize: 10, background: p.bg, color: p.renk, padding: "2px 8px", borderRadius: 20, fontWeight: 700, border: `1px solid ${p.renk}20` }}>
                          {p.ad}
                        </span>
                        {!f.aktif && (
                          <span style={{ fontSize: 10, background: "#FEE2E2", color: "#DC2626", padding: "2px 6px", borderRadius: 4 }}>Pasif</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{f.email}</div>

                      {/* SMS Başlığı + Kredi */}
                      <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                        {f.netgsm_baslik && (
                          <span style={{ fontSize: 10, background: "#F0F9FF", color: "#0284C7", padding: "2px 7px", borderRadius: 20, border: "1px solid #BAE6FD", fontWeight: 600 }}>
                            📱 {f.netgsm_baslik}
                          </span>
                        )}
                        <span style={{
                          fontSize: 10,
                          background: (f.sms_kredisi ?? 0) > 10 ? "#F0FDF4" : "#FEF2F2",
                          color: (f.sms_kredisi ?? 0) > 10 ? "#059669" : "#DC2626",
                          padding: "2px 7px", borderRadius: 20,
                          border: `1px solid ${(f.sms_kredisi ?? 0) > 10 ? "#BBF7D0" : "#FECACA"}`,
                          fontWeight: 700,
                        }}>
                          💬 {f.sms_kredisi ?? 0} SMS
                        </span>
                      </div>

                      {/* Addon badges */}
                      {firmaAddonlar.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                          {firmaAddonlar.map((a) => (
                            <span key={a} style={{ fontSize: 10, background: "#F0F9FF", color: "#0284C7", padding: "2px 7px", borderRadius: 20, border: "1px solid #BAE6FD" }}>
                              {ADDONLAR[a]?.icon} {ADDONLAR[a]?.ad}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      <button onClick={() => duzenleModunaGec(f)} style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Düzenle</button>
                      <button onClick={() => setDeleteConfirm(f.id)} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Sil</button>
                    </div>
                  </div>
                  {deleteConfirm === f.id && (
                    <div style={{ background: "#FEF2F2", padding: "12px 14px", borderTop: "1px solid #FECACA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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