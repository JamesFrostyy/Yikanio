import { Siparis, HaliTuru } from "../types";
import { STATUS_CONFIG } from "../constants";

interface Props {
  musteriAd: string;
  musteriTelefon: string;
  orders: Siparis[];          // Tüm siparişler — burada filtreleriz
  ht: HaliTuru[];
  onClose: () => void;
  onSiparisAc: (order: Siparis) => void;  // DetailSheet'i açmak için
}

export function MusteriGecmisi({ musteriAd, musteriTelefon, orders, ht, onClose, onSiparisAc }: Props) {
  // Bu müşteriye ait siparişler — telefon numarasına göre eşleştiriyoruz
  const musteriSiparisleri = orders
    .filter((o) => o.telefon === musteriTelefon)
    .sort((a, b) => b.tarih.localeCompare(a.tarih));

  const toplamCiro = musteriSiparisleri.reduce((s, o) => s + (o.fiyat || 0), 0);
  const toplamHali = musteriSiparisleri.reduce(
    (s, o) => s + (o.haliKalemleri || []).reduce((ss, k) => ss + k.adet, 0),
    0
  );
  const toplamM2 = musteriSiparisleri.reduce(
    (s, o) => s + (o.haliKalemleri || []).reduce((ss, k) => ss + k.m2, 0),
    0
  );
  const sonTarih = musteriSiparisleri[0]?.tarih || "—";

  const initials = musteriAd
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
        zIndex: 200, display: "flex", alignItems: "flex-end",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 560, margin: "0 auto",
          background: "#fff", borderRadius: "20px 20px 0 0",
          maxHeight: "90vh", overflow: "hidden",
          display: "flex", flexDirection: "column",
          fontFamily: "'Poppins', sans-serif",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sürükleme çubuğu */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: "#E2E8F0" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "12px 20px 16px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Avatar */}
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "linear-gradient(135deg, #2563EB, #3B82F6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 18, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#0F172A" }}>{musteriAd}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{musteriTelefon}</div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "#F1F5F9", border: "none", borderRadius: "50%",
                width: 36, height: 36, fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#64748B",
              }}
            >✕</button>
          </div>

          {/* Özet istatistikler */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 8, marginTop: 16,
          }}>
            {[
              { label: "Sipariş", value: musteriSiparisleri.length, color: "#2563EB", bg: "#EFF6FF" },
              { label: "Toplam", value: `₺${toplamCiro.toLocaleString()}`, color: "#059669", bg: "#ECFDF5" },
              { label: "m²", value: toplamM2.toFixed(1), color: "#7C3AED", bg: "#F5F3FF" },
              { label: "Halı", value: toplamHali, color: "#D97706", bg: "#FFFBEB" },
            ].map((k) => (
              <div key={k.label} style={{
                background: k.bg, borderRadius: 12, padding: "10px 8px", textAlign: "center",
              }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sipariş listesi */}
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px 24px" }}>
          {musteriSiparisleri.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
              Bu müşteriye ait sipariş bulunamadı.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {musteriSiparisleri.map((order) => {
                const cfg = STATUS_CONFIG[order.durum];
                return (
                  <div
                    key={order.id}
                    onClick={() => { onSiparisAc(order); }}
                    style={{
                      background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0",
                      padding: "14px 16px", cursor: "pointer",
                      transition: "all 0.15s",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.borderColor = "#93C5FD")}
                    onMouseOut={(e) => (e.currentTarget.style.borderColor = "#E2E8F0")}
                  >
                    {/* Üst: No + Tarih */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{
                        fontWeight: 700, fontSize: 11, color: "#475569",
                        background: "#F1F5F9", padding: "3px 8px", borderRadius: 6,
                      }}>
                        {order.id}
                      </span>
                      <span style={{ fontSize: 12, color: "#94A3B8" }}>{order.tarih}</span>
                    </div>

                    {/* Halı kalemleri */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {(order.haliKalemleri || []).map((k, ki) => {
                        const tur = ht.find((t) => t.id === k.turId);
                        return (
                          <span key={ki} style={{
                            fontSize: 11, background: "#F8FAFC", border: "1px solid #E2E8F0",
                            color: "#475569", padding: "4px 8px", borderRadius: 6, fontWeight: 500,
                          }}>
                            {tur?.icon} {tur?.ad} · {k.m2}m²
                          </span>
                        );
                      })}
                    </div>

                    {/* Alt: Durum + Tutar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                        background: cfg?.bg || "#F1F5F9", color: cfg?.color || "#475569",
                      }}>
                        {cfg?.icon} {cfg?.label || order.durum}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#059669" }}>
                        ₺{order.fiyat?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {musteriSiparisleri.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
              Son sipariş: <strong style={{ color: "#475569" }}>{sonTarih}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}