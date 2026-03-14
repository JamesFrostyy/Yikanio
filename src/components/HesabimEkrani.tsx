import { Firma, PAKETLER, PaketTip } from "../types";

interface HesabimEkraniProps {
  firma: Firma | null | undefined;
  onYukle: () => void;
}

export function HesabimEkrani({ firma, onYukle }: HesabimEkraniProps) {
  if (!firma) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: "'Poppins', sans-serif" }}>
        Firma bilgisi yüklenemedi.
      </div>
    );
  }

  const paketKey = (firma.paket || "starter") as PaketTip;
  const paket = PAKETLER[paketKey];
  const smsKredisi = firma.sms_kredisi ?? 0;
  const smsYuzde = Math.min(100, Math.round((smsKredisi / 50) * 100));

  const paketSirasi: PaketTip[] = ["starter", "pro", "enterprise"];
  const mevcutIndex = paketSirasi.indexOf(paketKey);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 100px", fontFamily: "'Poppins', sans-serif" }}>

      {/* Başlık */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A" }}>👤 Hesabım</h2>
        <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 14 }}>Paket bilgileriniz ve kullanım durumunuz</p>
      </div>

      {/* Firma Bilgisi */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 12 }}>Firma Bilgileri</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: paket.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
            🏢
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#0F172A" }}>{firma.ad}</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{firma.email}</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: paket.bg, color: paket.renk, border: `1px solid ${paket.renk}30` }}>
              {paket.ad}
            </span>
          </div>
        </div>
      </div>

      {/* Aktif Paket */}
      <div style={{ background: "linear-gradient(135deg, #1E40AF, #3B82F6)", borderRadius: 16, padding: 20, marginBottom: 16, color: "#fff", boxShadow: "0 10px 15px -3px rgba(59,130,246,0.3)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#BFDBFE", textTransform: "uppercase", marginBottom: 4 }}>Aktif Paket</div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{paket.ad}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#BFDBFE" }}>₺{paket.fiyat.toLocaleString()}<span style={{ fontSize: 14 }}>/ay</span></div>
      </div>

      {/* SMS Kredisi */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>SMS Kredisi</div>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            background: smsKredisi > 10 ? "#F0FDF4" : smsKredisi > 0 ? "#FFF7ED" : "#FEF2F2",
            color: smsKredisi > 10 ? "#059669" : smsKredisi > 0 ? "#D97706" : "#DC2626",
            border: `1px solid ${smsKredisi > 10 ? "#BBF7D0" : smsKredisi > 0 ? "#FDE68A" : "#FECACA"}`,
          }}>
            {smsKredisi > 10 ? "✓ Yeterli" : smsKredisi > 0 ? "⚠️ Azalıyor" : "🚫 Tükendi"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: smsKredisi > 10 ? "#059669" : smsKredisi > 0 ? "#D97706" : "#DC2626" }}>
            {smsKredisi}
          </span>
          <span style={{ fontSize: 14, color: "#64748B" }}>SMS kaldı</span>
        </div>

        {/* Progress bar */}
        <div style={{ width: "100%", height: 8, background: "#F1F5F9", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
          <div style={{
            width: `${smsYuzde}%`, height: "100%", borderRadius: 6,
            background: smsKredisi > 10
              ? "linear-gradient(90deg, #059669, #34D399)"
              : smsKredisi > 0
              ? "linear-gradient(90deg, #D97706, #FBBF24)"
              : "#DC2626",
            transition: "width 0.8s ease-out",
          }} />
        </div>

        {smsKredisi <= 10 && (
          <div style={{ fontSize: 13, color: smsKredisi === 0 ? "#DC2626" : "#D97706", fontWeight: 600, marginTop: 8 }}>
            {smsKredisi === 0
              ? "SMS krediniz tükendi. Yöneticinizle iletişime geçin."
              : `Krediniz azalıyor. Yöneticinizden yeni paket talep edin.`}
          </div>
        )}

        {firma.netgsm_baslik && (
          <div style={{ marginTop: 12, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, color: "#475569" }}>
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

      {/* Yükseltme Önerisi */}
      {mevcutIndex < paketSirasi.length - 1 && (
        <div style={{ background: "#F8FAFC", borderRadius: 16, padding: 20, border: "1.5px dashed #CBD5E1" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 12 }}>
            🚀 Daha Fazlası İçin
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {paketSirasi.slice(mevcutIndex + 1).map((key) => {
              const p = PAKETLER[key];
              return (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#fff", borderRadius: 12, border: `1px solid ${p.renk}30` }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: p.renk }}>{p.ad}</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                      {p.ozellikler.filter((o) => !paket.ozellikler.includes(o)).slice(0, 2).join(" · ")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>₺{p.fiyat.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>/ay</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
            Paket yükseltmek için yöneticinizle iletişime geçin.
          </div>
        </div>
      )}
    </div>
  );
}