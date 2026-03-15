import { useState } from "react";
import { Firma, PAKETLER, PaketTip } from "../types";
import { sbFetch } from "../lib/supabase";

interface HesabimEkraniProps {
  firma: Firma | null | undefined;
  token: string;
  onYukle: () => void;
}

const HESAP_DURUM_CFG: Record<string, {
  label: string; color: string; bg: string; border: string; icon: string; aciklama: string
}> = {
  demo:    { label: "Demo",            color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", icon: "🧪", aciklama: "Deneme süreniz aktif" },
  aktif:   { label: "Aktif",           color: "#059669", bg: "#F0FDF4", border: "#BBF7D0", icon: "✅", aciklama: "Aboneliğiniz aktif" },
  gecikme: { label: "Ödeme Gecikmeli", color: "#D97706", bg: "#FFF7ED", border: "#FDE68A", icon: "⚠️", aciklama: "Ödemeniz gecikmiş" },
  pasif:   { label: "Hesap Pasif",     color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: "🔴", aciklama: "Hesabınız donduruldu" },
  iptal:   { label: "İptal",           color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB", icon: "❌", aciklama: "Abonelik iptal edildi" },
};

function gunFarki(tarih?: string): number {
  if (!tarih) return 999;
  return Math.ceil((new Date(tarih).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function tarihFormat(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

// Bugünden N ay sonrasını ISO string olarak döner
function birAySonra(baslangic?: string): string {
  const bas = baslangic ? new Date(baslangic) : new Date();
  const sonraki = new Date(bas);
  sonraki.setMonth(sonraki.getMonth() + 1);
  return sonraki.toISOString();
}

export function HesabimEkrani({ firma, token, onYukle }: HesabimEkraniProps) {
  const [showOdeme, setShowOdeme] = useState(false);

  if (!firma) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: "'Poppins', sans-serif" }}>
        Firma bilgisi yüklenemedi.
      </div>
    );
  }

  const paketKey = (firma.paket || "starter") as PaketTip;
  const paket = PAKETLER[paketKey];
  const durumCfg = HESAP_DURUM_CFG[firma.hesap_durum || "demo"];
  const smsKredisi = firma.sms_kredisi ?? 0;
  const smsYuzde = Math.min(100, Math.round((smsKredisi / 50) * 100));
  const demKalan = gunFarki(firma.demo_bitis);
  const odemeKalan = gunFarki(firma.sonraki_odeme_tarihi);
  const paketSirasi: PaketTip[] = ["starter", "pro", "enterprise"];
  const mevcutIndex = paketSirasi.indexOf(paketKey);

  // Yükseltme yapılabilecek paketler (mevcut dahil, aşağısı değil)
  // Demo ise tüm paketler seçilebilir
  // Aktif ise sadece mevcut ve üzeri
  const secilebilenPaketler = firma.hesap_durum === "demo"
    ? paketSirasi
    : paketSirasi.filter((_, i) => i >= mevcutIndex);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 100px", fontFamily: "'Poppins', sans-serif" }}>

      {/* Başlık */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A" }}>👤 Hesabım</h2>
        <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 14 }}>Paket bilgileriniz ve kullanım durumunuz</p>
      </div>

      {/* Hesap Durumu Banner */}
      <div style={{ background: durumCfg.bg, border: `1.5px solid ${durumCfg.border}`, borderRadius: 16, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 32 }}>{durumCfg.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: durumCfg.color }}>{durumCfg.label}</div>
          <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{durumCfg.aciklama}</div>
        </div>
        {firma.hesap_durum === "demo" && firma.demo_bitis && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: demKalan <= 3 ? "#DC2626" : durumCfg.color }}>
              {Math.max(0, demKalan)}
            </div>
            <div style={{ fontSize: 11, color: "#64748B" }}>gün kaldı</div>
          </div>
        )}
        {(firma.hesap_durum === "aktif" || firma.hesap_durum === "gecikme") && firma.sonraki_odeme_tarihi && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: odemeKalan <= 3 ? "#DC2626" : "#059669" }}>
              {odemeKalan < 0 ? `${Math.abs(odemeKalan)}g gecikme` : odemeKalan === 0 ? "Bugün!" : `${odemeKalan}g sonra`}
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>ödeme</div>
          </div>
        )}
      </div>

      {/* Firma + Paket */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 12 }}>Firma & Paket</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: paket.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏢</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#0F172A" }}>{firma.ad}</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{firma.email}</div>
            {firma.yetkili_ad && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>👤 {firma.yetkili_ad}</div>}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: paket.bg, color: paket.renk, border: `1px solid ${paket.renk}30` }}>
            {paket.ad}
          </span>
        </div>
        <div style={{ background: "linear-gradient(135deg,#1E40AF,#3B82F6)", borderRadius: 12, padding: "14px 18px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#BFDBFE", fontWeight: 700, textTransform: "uppercase" }}>Aktif Paket</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{paket.ad}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>₺{paket.fiyat.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: "#BFDBFE" }}>/ay</div>
          </div>
        </div>
      </div>

      {/* Demo Bilgisi */}
      {firma.hesap_durum === "demo" && (
        <div style={{ background: "#F5F3FF", border: "1.5px solid #DDD6FE", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", marginBottom: 12 }}>🧪 Demo Süresi</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "#fff", borderRadius: 10, padding: 12, border: "1px solid #DDD6FE" }}>
              <div style={{ fontSize: 11, color: "#7C3AED", fontWeight: 600, marginBottom: 4 }}>Başlangıç</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{tarihFormat(firma.demo_baslangic)}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, padding: 12, border: `1px solid ${demKalan <= 3 ? "#FECACA" : "#DDD6FE"}` }}>
              <div style={{ fontSize: 11, color: demKalan <= 3 ? "#DC2626" : "#7C3AED", fontWeight: 600, marginBottom: 4 }}>Bitiş</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{tarihFormat(firma.demo_bitis)}</div>
            </div>
          </div>
          {firma.demo_baslangic && firma.demo_bitis && (() => {
            const toplam = new Date(firma.demo_bitis).getTime() - new Date(firma.demo_baslangic).getTime();
            const gecen = Date.now() - new Date(firma.demo_baslangic).getTime();
            const yuzde = Math.min(100, Math.max(0, Math.round((gecen / toplam) * 100)));
            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 6 }}>
                  <span>Demo süresi</span>
                  <span style={{ fontWeight: 700, color: demKalan <= 3 ? "#DC2626" : "#7C3AED" }}>
                    {demKalan > 0 ? `${demKalan} gün kaldı` : "Süre doldu"}
                  </span>
                </div>
                <div style={{ height: 8, background: "#DDD6FE", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${yuzde}%`, height: "100%", background: demKalan <= 3 ? "#DC2626" : "linear-gradient(90deg,#7C3AED,#A78BFA)", borderRadius: 6 }} />
                </div>
              </div>
            );
          })()}
          <button onClick={() => setShowOdeme(true)} style={{ marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7C3AED,#A78BFA)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 15, fontFamily: "inherit" }}>
            🚀 Abonelik Satın Al — İstediğin Paketten Başla
          </button>
        </div>
      )}

      {/* Abonelik & Ödeme Bilgisi */}
      {(firma.hesap_durum === "aktif" || firma.hesap_durum === "gecikme") && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 14 }}>💳 Abonelik & Ödeme</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {firma.abonelik_baslangic && (
              <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 12, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginBottom: 4 }}>Abonelik Başlangıcı</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{tarihFormat(firma.abonelik_baslangic)}</div>
              </div>
            )}
            {firma.son_odeme_tarihi && (
              <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 12, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginBottom: 4 }}>Son Ödeme</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>{tarihFormat(firma.son_odeme_tarihi)}</div>
              </div>
            )}
          </div>
          {firma.sonraki_odeme_tarihi && (
            <div style={{ background: odemeKalan <= 3 ? "#FEF2F2" : "#F0FDF4", border: `1px solid ${odemeKalan <= 3 ? "#FECACA" : "#BBF7D0"}`, borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: odemeKalan <= 3 ? "#DC2626" : "#059669", marginBottom: 2 }}>
                  {odemeKalan < 0 ? "🔴 Ödeme Gecikmiş!" : odemeKalan === 0 ? "🔴 Bugün Son Gün!" : "💰 Sonraki Ödeme"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{tarihFormat(firma.sonraki_odeme_tarihi)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: odemeKalan <= 3 ? "#DC2626" : "#059669" }}>
                  ₺{paket.fiyat.toLocaleString()}
                </div>
                {odemeKalan < 0 && (
                  <button onClick={() => setShowOdeme(true)} style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                    Ödeme Yap
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Paket Yükseltme — sadece üst paket varsa göster */}
          {mevcutIndex < paketSirasi.length - 1 && (
            <button onClick={() => setShowOdeme(true)} style={{ marginTop: 14, width: "100%", padding: 12, borderRadius: 10, border: "1.5px dashed #CBD5E1", background: "#F8FAFC", color: "#475569", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }}>
              🚀 Paketi Yükselt
            </button>
          )}
        </div>
      )}

      {/* SMS Kredisi */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>SMS Kredisi</div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: smsKredisi > 10 ? "#F0FDF4" : smsKredisi > 0 ? "#FFF7ED" : "#FEF2F2", color: smsKredisi > 10 ? "#059669" : smsKredisi > 0 ? "#D97706" : "#DC2626", border: `1px solid ${smsKredisi > 10 ? "#BBF7D0" : smsKredisi > 0 ? "#FDE68A" : "#FECACA"}` }}>
            {smsKredisi > 10 ? "✓ Yeterli" : smsKredisi > 0 ? "⚠️ Azalıyor" : "🚫 Tükendi"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: smsKredisi > 10 ? "#059669" : smsKredisi > 0 ? "#D97706" : "#DC2626" }}>{smsKredisi}</span>
          <span style={{ fontSize: 14, color: "#64748B" }}>SMS kaldı</span>
        </div>
        <div style={{ width: "100%", height: 8, background: "#F1F5F9", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ width: `${smsYuzde}%`, height: "100%", borderRadius: 6, background: smsKredisi > 10 ? "linear-gradient(90deg,#059669,#34D399)" : smsKredisi > 0 ? "linear-gradient(90deg,#D97706,#FBBF24)" : "#DC2626" }} />
        </div>
        {smsKredisi <= 10 && (
          <div style={{ fontSize: 13, color: smsKredisi === 0 ? "#DC2626" : "#D97706", fontWeight: 600, marginTop: 6 }}>
            {smsKredisi === 0 ? "SMS krediniz tükendi. Yöneticinizle iletişime geçin." : "Krediniz azalıyor. Yöneticinizden yeni paket talep edin."}
          </div>
        )}
        {firma.netgsm_baslik && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, color: "#475569" }}>
            📱 SMS gönderen adı: <strong>{firma.netgsm_baslik}</strong>
          </div>
        )}
      </div>

      {/* Paket Özellikleri */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 14 }}>Paket Özellikleri</div>
        <div style={{ display: "grid", gap: 10 }}>
          {paket.ozellikler.map((o, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: paket.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: paket.renk, fontWeight: 800, fontSize: 12 }}>✓</span>
              </div>
              <span style={{ fontSize: 14, color: "#334155" }}>{o}</span>
            </div>
          ))}
        </div>
      </div>

      {/* İletişim */}
      <div style={{ textAlign: "center", padding: "16px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 13, color: "#64748B" }}>
        Paket değişikliği, ödeme veya destek için:
        <a href="mailto:info@yikanio.com" style={{ color: "#2563EB", fontWeight: 700, marginLeft: 6, textDecoration: "none" }}>info@yikanio.com</a>
      </div>

      {/* Ödeme Modal */}
      {showOdeme && (
        <OdemeModal
          firma={firma}
          token={token}
          mevcutPaket={paketKey}
          mevcutDurum={firma.hesap_durum || "demo"}
          secilebilenPaketler={secilebilenPaketler}
          onClose={() => setShowOdeme(false)}
          onBasarili={() => { setShowOdeme(false); onYukle(); }}
        />
      )}
    </div>
  );
}

// ─── ÖDEME MODALI ────────────────────────────────────────────────────────────
interface OdemeModalProps {
  firma: Firma;
  token: string;
  mevcutPaket: PaketTip;
  mevcutDurum: string;
  secilebilenPaketler: PaketTip[];
  onClose: () => void;
  onBasarili: () => void;
}

function OdemeModal({
  firma, token, mevcutPaket, mevcutDurum, secilebilenPaketler, onClose, onBasarili
}: OdemeModalProps) {
  const paketSirasi: PaketTip[] = ["starter", "pro", "enterprise"];
  const mevcutIndex = paketSirasi.indexOf(mevcutPaket);

  // Demo ise en uygun (Starter), aktifse bir üst paket varsayılan
  const varsayilanPaket = mevcutDurum === "demo"
    ? "starter"
    : (paketSirasi[mevcutIndex + 1] || mevcutPaket) as PaketTip;

  const [secilenPaket, setSecilenPaket] = useState<PaketTip>(varsayilanPaket);
  const [yukleniyor, setYukleniyor] = useState(false);

  const secilenPaketBilgi = PAKETLER[secilenPaket];

  // Shopier linkleri — her paket için kendi linkinizi girin
  const SHOPIER_LINKLER: Record<PaketTip, string> = {
    starter:    "https://www.shopier.com/yikanio-starter",
    pro:        "https://www.shopier.com/yikanio-pro",
    enterprise: "https://www.shopier.com/yikanio-enterprise",
  };

  const shopierOdemeBaslat = async () => {
    setYukleniyor(true);
    try {
      // 4 numara: Abonelik tarihleri otomatik hesapla
      const bugun = new Date().toISOString();
      const sonrakiOdeme = birAySonra(bugun);

      // Supabase'de firma bilgilerini güncelle
      // (Shopier'dan ödeme onayı gelince admin manuel onaylayacak — webhook sonrası otomatik yapılacak)
      // Şimdilik Shopier sayfasını aç, onay sonrası admin aktif edecek
      // Tarihleri kaydet ki admin onaylayınca kullanılsın
      await sbFetch(
        `firmalar?id=eq.${firma.id}`,
        {
          method: "PATCH",
          prefer: "return=minimal",
          body: JSON.stringify({
            paket: secilenPaket,
            // Tarihler — admin onayına kadar bekler, hesap_durum değişmez
            abonelik_baslangic: bugun,
            son_odeme_tarihi: bugun,
            sonraki_odeme_tarihi: sonrakiOdeme,
          }),
        },
        token
      );

      // Shopier sayfasını aç
      const link = SHOPIER_LINKLER[secilenPaket];
      const url = `${link}?email=${encodeURIComponent(firma.email)}&name=${encodeURIComponent(firma.yetkili_ad || firma.ad)}`;
      window.open(url, "_blank");

      setYukleniyor(false);

      // Kullanıcıya bilgi ver
      alert(`Shopier ödeme sayfası açıldı.\n\nÖdemeniz onaylandıktan sonra hesabınız aktif edilecektir.\n\nBilgi: info@yikanio.com`);
      onBasarili();
    } catch (e) {
      setYukleniyor(false);
      alert("Bir hata oluştu, lütfen tekrar deneyin.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 3000, fontFamily: "'Poppins', sans-serif" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 24px 40px", width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>

        <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 4, margin: "0 auto 20px" }} />

        {/* Başlık */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0F172A" }}>💳 Abonelik Satın Al</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>Güvenli ödeme — Shopier altyapısı</p>
          </div>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {/* Paket Seçici */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 10, textTransform: "uppercase" }}>
          {mevcutDurum === "demo" ? "Başlamak istediğiniz paketi seçin" : "Yükseltmek istediğiniz paketi seçin"}
        </div>
        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          {paketSirasi.map((key) => {
            const p = PAKETLER[key];
            const seciliMi = key === secilenPaket;
            const mevcutMu = key === mevcutPaket && mevcutDurum !== "demo";
            // Demo değilse ve bu paket mevcut paketin altındaysa kilitli
            const kilitli = mevcutDurum !== "demo" && paketSirasi.indexOf(key) < mevcutIndex;

            return (
              <button
                key={key}
                onClick={() => !mevcutMu && !kilitli && setSecilenPaket(key)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 16px", borderRadius: 14, textAlign: "left",
                  border: `2px solid ${seciliMi ? p.renk : "#E2E8F0"}`,
                  background: seciliMi ? p.bg : (mevcutMu || kilitli) ? "#F8FAFC" : "#fff",
                  cursor: (mevcutMu || kilitli) ? "not-allowed" : "pointer",
                  opacity: kilitli ? 0.4 : 1,
                  fontFamily: "inherit", transition: "all 0.2s",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: seciliMi ? p.renk : kilitli ? "#94A3B8" : "#334155", display: "flex", alignItems: "center", gap: 8 }}>
                    {p.ad}
                    {mevcutMu && <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>(Mevcut paket)</span>}
                    {kilitli && <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>🔒 İndirim yapılamaz</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                    {p.ozellikler.slice(0, 2).join(" · ")}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: seciliMi ? p.renk : "#0F172A" }}>₺{p.fiyat.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>/ay</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Otomatik Tarih Bilgisi */}
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 6 }}>📅 Abonelik Tarihleri (Otomatik)</div>
          <div style={{ fontSize: 13, color: "#334155" }}>
            Abonelik başlangıcı: <strong>{tarihFormat(new Date().toISOString())}</strong>
          </div>
          <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>
            Sonraki ödeme: <strong>{tarihFormat(birAySonra(new Date().toISOString()))}</strong>
          </div>
        </div>

        {/* Sipariş Özeti */}
        <div style={{ background: "linear-gradient(135deg,#0F172A,#1E293B)", borderRadius: 16, padding: 20, marginBottom: 20, color: "#fff" }}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Sipariş Özeti</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Yıkanio {secilenPaketBilgi.ad}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>Aylık abonelik</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>₺{secilenPaketBilgi.fiyat.toLocaleString()}</div>
          </div>
          <div style={{ borderTop: "1px solid #334155", paddingTop: 10, fontSize: 13, color: "#94A3B8" }}>
            {firma.ad} · {firma.email}
          </div>
        </div>

        {/* Güvenlik */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          {["🔒 SSL şifreleme", "💳 Tüm kartlar", "🚫 Taahhüt yok"].map((item) => (
            <div key={item} style={{ fontSize: 12, color: "#64748B" }}>{item}</div>
          ))}
        </div>

        {/* Ödeme Butonu */}
        <button
          onClick={shopierOdemeBaslat}
          disabled={yukleniyor || secilenPaket === mevcutPaket && mevcutDurum !== "demo"}
          style={{
            width: "100%", padding: "18px", borderRadius: 14, border: "none",
            background: yukleniyor ? "#E2E8F0" : "linear-gradient(135deg,#2563EB,#3B82F6)",
            color: yukleniyor ? "#94A3B8" : "#fff",
            cursor: yukleniyor ? "not-allowed" : "pointer",
            fontWeight: 800, fontSize: 16, fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          {yukleniyor ? "Yönlendiriliyor..." : (
            <><span style={{ fontSize: 20 }}>💳</span> Shopier ile Güvenli Öde — ₺{secilenPaketBilgi.fiyat.toLocaleString()}</>
          )}
        </button>

        <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
          Ödeme onayından sonra hesabınız 24 saat içinde aktif edilir.<br />
          Sorun için: <a href="mailto:info@yikanio.com" style={{ color: "#2563EB" }}>info@yikanio.com</a>
        </p>
      </div>
    </div>
  );
}