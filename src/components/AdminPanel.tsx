import { useState, useEffect } from "react";
import { Firma, Siparis } from "../types";
import { sbFetch } from "../lib/supabase";
import { STATUS_CONFIG } from "../constants";

interface AdminPanelProps {
  firmalar: Firma[];
  orders: Siparis[];
  token: string;
  onFirmaYonet: () => void;
  onYukle: () => void;
}

interface FirmaIstatistik {
  firmaId: string;
  firmaAd: string;
  siparisSayisi: number;
  toplamCiro: number;
  aktifSiparis: number;
  sonSiparisTarih: string;
}

interface AylikVeri {
  ay: string;
  siparis_sayisi: number;
  toplam_ciro: number;
}

export function AdminPanel({ firmalar, orders, token, onFirmaYonet, onYukle }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "siparisler" | "raporlar">("dashboard");
  const [aylikVeri, setAylikVeri] = useState<AylikVeri[]>([]);
  const [filterFirma, setFilterFirma] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [silConfirm, setSilConfirm] = useState<string | null>(null);
  const [siliyor, setSiliyor] = useState(false);

  useEffect(() => {
    const aylikYukle = async () => {
      try {
        const veri = await sbFetch(
          "aylik_ozet?select=ay,siparis_sayisi,toplam_ciro&order=ay.desc&limit=12",
          {},
          token
        ) as AylikVeri[];
        const grouped = veri.reduce((acc: Record<string, AylikVeri>, v) => {
          const ay = v.ay.slice(0, 7);
          if (!acc[ay]) acc[ay] = { ay, siparis_sayisi: 0, toplam_ciro: 0 };
          acc[ay].siparis_sayisi += Number(v.siparis_sayisi);
          acc[ay].toplam_ciro += Number(v.toplam_ciro);
          return acc;
        }, {});
        setAylikVeri(Object.values(grouped).slice(0, 6).reverse());
      } catch (e) {
        console.error("Aylık veri yüklenemedi:", e);
      }
    };
    aylikYukle();
  }, [token]);

  const siparislerSil = async (id: string) => {
    setSiliyor(true);
    try {
      await sbFetch(`hali_kalemleri?siparis_id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }, token);
      await sbFetch(`siparisler?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }, token);
      setSilConfirm(null);
      onYukle();
    } catch (e) {
      console.error("Silme hatası:", e);
    } finally {
      setSiliyor(false);
    }
  };

  const firmaIstatistikleri: FirmaIstatistik[] = firmalar.map((f) => {
    const firmaOrders = orders.filter((o) => o.firmaId === f.id);
    const aktif = firmaOrders.filter((o) => o.durum !== "teslim_edildi").length;
    const ciro = firmaOrders.reduce((s, o) => s + o.fiyat, 0);
    const sonTarih = firmaOrders.sort((a, b) => b.tarih.localeCompare(a.tarih))[0]?.tarih || "-";
    return { firmaId: f.id, firmaAd: f.ad, siparisSayisi: firmaOrders.length, toplamCiro: ciro, aktifSiparis: aktif, sonSiparisTarih: sonTarih };
  }).sort((a, b) => b.siparisSayisi - a.siparisSayisi);

  const toplamSiparis = orders.length;
  const toplamCiro = orders.reduce((s, o) => s + o.fiyat, 0);
  const aktifFirma = firmalar.filter((f) => f.aktif).length;
  const aktifSiparis = orders.filter((o) => o.durum !== "teslim_edildi").length;

  const filteredOrders = orders.filter((o) => {
    if (filterFirma !== "Tümü" && o.firmaId !== filterFirma) return false;
    if (search && !o.musteri.toLowerCase().includes(search.toLowerCase()) && !o.id.includes(search)) return false;
    return true;
  });

  const maxCiro = Math.max(...firmaIstatistikleri.map((f) => f.toplamCiro), 1);
  const maxAylikSiparis = Math.max(...aylikVeri.map((a) => a.siparis_sayisi), 1);

  const tabBtn = (key: typeof activeTab, label: string, icon: string) => (
    <button
      onClick={() => setActiveTab(key)}
      style={{
        padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
        fontFamily: "inherit", fontWeight: 600, fontSize: 14, transition: "all 0.2s",
        background: activeTab === key ? "#1E40AF" : "transparent",
        color: activeTab === key ? "#fff" : "#64748B",
      }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px 100px", fontFamily: "'Poppins', sans-serif" }}>

      {/* Tab Nav */}
      <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 12, padding: 4, marginBottom: 24, width: "100%", overflowX: "auto" }}>
        {tabBtn("dashboard", "Dashboard", "📊")}
        {tabBtn("siparisler", "Siparişler", "📋")}
        {tabBtn("raporlar", "Raporlar", "📈")}
      </div>

      {/* ─── DASHBOARD ─── */}
      {activeTab === "dashboard" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Aktif Firma", value: aktifFirma, icon: "🏢", color: "#2563EB", bg: "#EFF6FF" },
              { label: "Toplam Sipariş", value: toplamSiparis, icon: "📋", color: "#7C3AED", bg: "#F5F3FF" },
              { label: "Aktif İş", value: aktifSiparis, icon: "⚙️", color: "#D97706", bg: "#FFFBEB" },
              { label: "Platform Cirosu", value: `₺${toplamCiro.toLocaleString()}`, icon: "💰", color: "#059669", bg: "#ECFDF5" },
            ].map((k, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{k.icon}</div>
                  <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>{k.label}</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0F172A" }}>🏢 Firma Performansı</h3>
            <button onClick={onFirmaYonet} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              + Firma Yönet
            </button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {firmaIstatistikleri.map((f, i) => (
              <div key={f.firmaId} style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: i === 0 ? "#FEF3C7" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏢"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{f.firmaAd}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>Son: {f.sonSiparisTarih}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#059669" }}>₺{f.toplamCiro.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>{f.siparisSayisi} sipariş</div>
                  </div>
                </div>
                <div style={{ width: "100%", height: 5, background: "#F1F5F9", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round((f.toplamCiro / maxCiro) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#3B82F6,#60A5FA)", borderRadius: 6 }} />
                </div>
              </div>
            ))}
            {firmaIstatistikleri.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 14 }}>Henüz firma yok.</div>
            )}
          </div>
        </div>
      )}

      {/* ─── SİPARİŞLER ─── */}
      {activeTab === "siparisler" && (
        <div>
          {/* Filtreler */}
          <div className="filter-row" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Müşteri veya sipariş no ara..."
              style={{ flex: 1, minWidth: 200, padding: "10px 16px", borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 14, fontFamily: "inherit", outline: "none" }}
            />
            <select
              value={filterFirma}
              onChange={(e) => setFilterFirma(e.target.value)}
              style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 14, fontFamily: "inherit", background: "#fff", cursor: "pointer" }}
            >
              <option value="Tümü">Tüm Firmalar</option>
              {firmalar.map((f) => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>

          {/* DESKTOP: Tablo */}
          <div className="order-table" style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["No", "Firma", "Müşteri", "Tutar", "Durum", "Tarih", ""].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Sonuç bulunamadı.</td></tr>
                ) : filteredOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontWeight: 700, color: "#475569", fontSize: 12, background: "#F1F5F9", padding: "4px 8px", borderRadius: 6 }}>{o.id}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 13, color: "#475569", background: "#F8FAFC", padding: "4px 8px", border: "1px solid #E2E8F0", borderRadius: 6 }}>🏢 {o.firmaAd || "—"}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 14 }}>{o.musteri}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>{o.telefon}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontWeight: 800, color: "#059669", fontSize: 15 }}>₺{o.fiyat?.toLocaleString()}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: STATUS_CONFIG[o.durum]?.bg || "#F1F5F9", color: STATUS_CONFIG[o.durum]?.color || "#475569" }}>
                        {STATUS_CONFIG[o.durum]?.icon} {STATUS_CONFIG[o.durum]?.label || o.durum}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748B", fontSize: 13 }}>{o.tarih}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {silConfirm === o.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => siparislerSil(o.id)} disabled={siliyor} style={{ background: "#DC2626", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            {siliyor ? "..." : "Evet"}
                          </button>
                          <button onClick={() => setSilConfirm(null)} style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>İptal</button>
                        </div>
                      ) : (
                        <button onClick={() => setSilConfirm(o.id)} style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑️ Sil</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length > 0 && (
              <div style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0", fontSize: 13, color: "#64748B", background: "#F8FAFC" }}>
                Toplam <strong>{filteredOrders.length}</strong> sipariş · <strong>₺{filteredOrders.reduce((s, o) => s + o.fiyat, 0).toLocaleString()}</strong> ciro
              </div>
            )}
          </div>

          {/* MOBİL: Kartlar */}
          <div className="order-cards">
            {filteredOrders.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Sonuç bulunamadı.</div>
            ) : filteredOrders.map((o) => (
              <div key={o.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: "#475569", fontSize: 11, background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 }}>{o.id}</span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>{o.tarih}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0F172A" }}>{o.musteri}</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{o.telefon}</div>
                    {o.firmaAd && <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 4, fontWeight: 600 }}>🏢 {o.firmaAd}</div>}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "#059669" }}>₺{o.fiyat?.toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: STATUS_CONFIG[o.durum]?.bg || "#F1F5F9", color: STATUS_CONFIG[o.durum]?.color || "#475569" }}>
                    {STATUS_CONFIG[o.durum]?.icon} {STATUS_CONFIG[o.durum]?.label || o.durum}
                  </span>
                  {silConfirm === o.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => siparislerSil(o.id)} disabled={siliyor} style={{ background: "#DC2626", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {siliyor ? "..." : "Evet, Sil"}
                      </button>
                      <button onClick={() => setSilConfirm(null)} style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>İptal</button>
                    </div>
                  ) : (
                    <button onClick={() => setSilConfirm(o.id)} style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑️ Sil</button>
                  )}
                </div>
              </div>
            ))}
            {filteredOrders.length > 0 && (
              <div style={{ padding: "8px 4px", fontSize: 13, color: "#94A3B8", textAlign: "center" }}>
                Toplam <strong style={{ color: "#475569" }}>{filteredOrders.length}</strong> sipariş
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── RAPORLAR ─── */}
      {activeTab === "raporlar" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>💰 Firma Ciro Karşılaştırması</h3>
              <div style={{ display: "grid", gap: 12 }}>
                {firmaIstatistikleri.map((f) => (
                  <div key={f.firmaId}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                      <span>🏢 {f.firmaAd}</span>
                      <span>₺{f.toplamCiro.toLocaleString()} <span style={{ color: "#94A3B8", fontWeight: 500 }}>({f.siparisSayisi})</span></span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "#F1F5F9", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((f.toplamCiro / maxCiro) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#3B82F6,#60A5FA)", borderRadius: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>📈 Aylık Büyüme</h3>
              {aylikVeri.length === 0 ? (
                <div style={{ color: "#94A3B8", fontSize: 14 }}>Henüz yeterli veri yok.</div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
                  {aylikVeri.map((a) => {
                    const yuzde = Math.round((a.siparis_sayisi / maxAylikSiparis) * 100);
                    const ayAd = new Date(a.ay + "-01").toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
                    return (
                      <div key={a.ay} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#3B82F6" }}>{a.siparis_sayisi}</div>
                        <div style={{ width: "100%", height: `${Math.max(yuzde, 5)}%`, background: "linear-gradient(180deg,#3B82F6,#93C5FD)", borderRadius: "4px 4px 0 0", minHeight: 6 }} />
                        <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600, textAlign: "center" }}>{ayAd}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {aylikVeri.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F1F5F9" }}>
                  {aylikVeri.slice(-1).map((a) => (
                    <div key={a.ay} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#64748B" }}>Bu ay ciro:</span>
                      <span style={{ fontWeight: 700, color: "#059669" }}>₺{Number(a.toplam_ciro).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E2E8F0" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>🏆 Sıralama</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {firmaIstatistikleri.map((f, i) => (
                  <div key={f.firmaId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: i === 0 ? "#FFFBEB" : "#F8FAFC", borderRadius: 10, border: `1px solid ${i === 0 ? "#FDE68A" : "#E2E8F0"}` }}>
                    <div style={{ fontSize: 18, width: 28, textAlign: "center" }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#0F172A" }}>{f.firmaAd}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{f.siparisSayisi} sipariş</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#059669" }}>₺{f.toplamCiro.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}