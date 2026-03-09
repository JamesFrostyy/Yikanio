import { useState, useEffect } from "react";
import { Siparis, HaliTuru, ToastState } from "./types";
import { STATUS_CONFIG, STATUSLAR } from "./constants";
import { dbHaliTurleriKaydet, dbKaydet, toplamAdet, toplamM2 } from "./lib/db";
import { sbFetch } from "./lib/supabase";
import { useAuth } from "./hooks/useAuth";
import { useOrders } from "./hooks/useOrders";
import { Toast } from "./components/Toast";
import { StatusBadge } from "./components/StatusBadge";
import { SmsModal } from "./components/SmsModal";
import { DetailSheet } from "./components/DetailSheet";
import { OrderModal, OrderForm } from "./components/OrderModal";
import { HaliModal } from "./components/HaliModal";
import { FirmaModal } from "./components/FirmaModal";
import { AdminPanel } from "./components/AdminPanel";

// ─── RAPOR ────────────────────────────────────────────────────────────────────
function RaporEkrani({ orders, ht }: { orders: Siparis[]; ht: HaliTuru[] }) {
  const toplamCiro = orders.reduce((s, o) => s + o.fiyat, 0);
  const tamamlananCiro = orders.filter((o) => o.durum === "teslim_edildi").reduce((s, o) => s + o.fiyat, 0);
  const bekleyenCiro = orders.filter((o) => o.durum !== "teslim_edildi").reduce((s, o) => s + o.fiyat, 0);
  const ortalamaSiparis = orders.length ? Math.round(toplamCiro / orders.length) : 0;
  const aktifSiparis = orders.filter((o) => !["teslim_edildi"].includes(o.durum)).length;

  const turDagilimi = ht.map((t) => {
    const m2 = orders.flatMap((o) => o.haliKalemleri || []).filter((k) => k.turId === t.id).reduce((s, k) => s + (k.m2 || 0) * (k.adet || 1), 0);
    return { ...t, m2 };
  }).filter((t) => t.m2 > 0).sort((a, b) => b.m2 - a.m2);

  const maxTurM2 = Math.max(...turDagilimi.map((t) => t.m2), 1);
  const genelToplamM2 = turDagilimi.reduce((s, t) => s + t.m2, 0);
  const genelToplamAdet = orders.flatMap((o) => o.haliKalemleri || []).reduce((s, k) => s + (k.adet || 0), 0);

  return (
    <div style={{ padding: "24px", paddingBottom: "100px", maxWidth: "1200px", margin: "0 auto", fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0F172A" }}>📊 İşletme Raporu</h2>
        <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 14 }}>Tüm zamanların sipariş ve performans özetleri</p>
      </div>

      {/* Özet Kartlar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Toplam Ciro", value: `₺${toplamCiro.toLocaleString()}`, sub: "", gradient: "linear-gradient(135deg,#1E40AF,#3B82F6)", light: false },
          { label: "Kasadaki (Teslim)", value: `₺${tamamlananCiro.toLocaleString()}`, sub: `Alacak: ₺${bekleyenCiro.toLocaleString()}`, gradient: "", light: true, color: "#059669" },
          { label: "Tahsil Edilecek", value: `₺${bekleyenCiro.toLocaleString()}`, sub: `${aktifSiparis} aktif sipariş`, gradient: "", light: true, color: "#F97316" },
          { label: "Ort. Sepet Tutarı", value: `₺${ortalamaSiparis.toLocaleString()}`, sub: "Sipariş başına kazanç", gradient: "", light: true, color: "#0F172A" },
        ].map((k, i) => (
          <div key={i} style={{ background: k.gradient || "#fff", borderRadius: 16, padding: 20, border: k.light ? "1px solid #E2E8F0" : "none", boxShadow: k.light ? "0 4px 6px -1px rgba(0,0,0,0.05)" : "0 10px 15px -3px rgba(59,130,246,0.3)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: k.light ? "#64748B" : "#DBEAFE", marginBottom: 8, textTransform: "uppercase" }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.light ? k.color : "#fff" }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 12, color: k.light ? "#94A3B8" : "#BFDBFE", marginTop: 4 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Grafikler */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 20 }}>
        {/* Tür Dağılımı */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E2E8F0" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#0F172A", display: "flex", justifyContent: "space-between" }}>
            <span>Yıkanan Halı Türleri</span>
            <span style={{ fontSize: 13, color: "#3B82F6", background: "#EFF6FF", padding: "4px 10px", borderRadius: 12 }}>Toplam: {genelToplamM2} m²</span>
          </h3>
          <div style={{ display: "grid", gap: 16 }}>
            {turDagilimi.length === 0 ? (
              <div style={{ color: "#94A3B8", fontSize: 14 }}>Henüz veri yok.</div>
            ) : turDagilimi.map((t) => {
              const yuzde = Math.round((t.m2 / maxTurM2) * 100);
              const gercekYuzde = Math.round((t.m2 / (genelToplamM2 || 1)) * 100);
              return (
                <div key={t.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    <span>{t.icon} {t.ad}</span>
                    <span>{t.m2} m² <span style={{ color: "#94A3B8", fontWeight: 500 }}>({gercekYuzde}%)</span></span>
                  </div>
                  <div style={{ width: "100%", height: 10, background: "#F1F5F9", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${yuzde}%`, height: "100%", background: "linear-gradient(90deg,#3B82F6,#60A5FA)", borderRadius: 6, transition: "width 1s ease-out" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Durum Dağılımı */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E2E8F0" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#0F172A", display: "flex", justifyContent: "space-between" }}>
            <span>Sipariş Durumları</span>
            <span style={{ fontSize: 13, color: "#10B981", background: "#ECFDF5", padding: "4px 10px", borderRadius: 12 }}>{genelToplamAdet} Adet Halı</span>
          </h3>
          <div style={{ display: "grid", gap: 12 }}>
            {Object.keys(STATUS_CONFIG).map((durumKodu) => {
              const cfg = STATUS_CONFIG[durumKodu];
              const adet = orders.filter((o) => o.durum === durumKodu).length;
              if (adet === 0) return null;
              const yuzde = Math.round((adet / orders.length) * 100);
              return (
                <div key={durumKodu} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.bg, color: cfg.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{cfg.label}</div>
                    <div style={{ width: "100%", height: 6, background: "#E2E8F0", borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
                      <div style={{ width: `${yuzde}%`, height: "100%", background: cfg.color }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 50 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{adet}</div>
                    <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>%{yuzde}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────
export default function App() {
  const { authState, accessToken, user, isAdmin, login, logout, setPassword } = useAuth();

 const { orders, setOrders, firmalar, ht, setHt, firmaId, firmaAd, loading, err, yukle } = useOrders(
  user?.token || "", isAdmin, user?.email || ""
);

  const [sel, setSel] = useState<Siparis | null>(null);
  const [filterStatus, setFilterStatus] = useState("Tümü");
  const [filterFirma, setFilterFirma] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [showOrder, setShowOrder] = useState(false);
  const [editing, setEditing] = useState<Siparis | null>(null);
  const [smsOrder, setSmsOrder] = useState<Siparis | null>(null);
  const [activeTab, setActiveTab] = useState("siparisler");
  const [showHali, setShowHali] = useState(false);
  const [showFirma, setShowFirma] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [toast, setToast] = useState<ToastState>({ msg: null, type: "success" });

  const showToast = (msg: string, type = "success") => setToast({ msg, type });

  useEffect(() => { if (authState === "app") yukle(); }, [authState, yukle]);

  // Filtreleme
  const filtered = orders.filter((o) => {
    if (filterStatus !== "Tümü" && o.durum !== filterStatus) return false;
    if (filterFirma !== "Tümü" && o.firmaId !== filterFirma) return false;
    if (search && !o.musteri.toLowerCase().includes(search.toLowerCase()) && !o.telefon.includes(search) && !o.id.includes(search)) return false;
    return true;
  });

  const aktifFiltre = (filterStatus !== "Tümü" ? 1 : 0) + (filterFirma !== "Tümü" ? 1 : 0) + (search ? 1 : 0);

  const handleSave = async (form: OrderForm) => {
  if (!user) return;
  const resolvedFirmaId = isAdmin ? form.firmaId : firmaId;
  await dbKaydet(form, editing?.id || null, ht, user.token, resolvedFirmaId);
  await yukle();
  showToast(editing ? "Sipariş güncellendi!" : "Sipariş oluşturuldu!");
};

  const handleStatus = async (id: string, durum: string) => {
    if (!user) return;
    await sbFetch(`siparisler?id=eq.${id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ durum }) }, user.token);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, durum } : o));
    showToast("Durum güncellendi!");
  };

  const handleSms = async (durum: string, mesaj: string) => {
    if (!user || !smsOrder) return;
    const yeniSmsDurum = { ...smsOrder.smsDurum, [durum]: true };
    await sbFetch(`siparisler?id=eq.${smsOrder.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ sms_durum: yeniSmsDurum }) }, user.token);
    await sbFetch("sms_log", { method: "POST", body: JSON.stringify({ siparis_id: smsOrder.id, telefon: smsOrder.telefon, mesaj, durum_adi: durum }) }, user.token);
    setOrders((prev) => prev.map((o) => o.id === smsOrder.id ? { ...o, smsDurum: yeniSmsDurum } : o));
    showToast("WhatsApp açıldı!");
  };

  const handleHaliTurleriSave = async (liste: HaliTuru[]) => {
    if (!user) return;
    const fId = (await sbFetch(`firmalar?email=eq.${user.email}&select=id`, {}, user.token) as {id: string}[])[0]?.id;
    await dbHaliTurleriKaydet(user.token, fId, liste);
    setHt(liste);
    setShowHali(false);
    showToast("Fiyat listesi güncellendi!");
  };

  // ─── AUTH EKRANLARI ──────────────────────────────────────────────────────────
  if (authState === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #1E293B", borderTop: "3px solid #3B82F6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (authState === "setpassword") {
    return <SetPasswordScreen onSet={setPassword} />;
  }

  if (authState === "login") {
    return <LoginScreen onLogin={login} />;
  }
  if (isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Poppins', sans-serif" }}>
        <header style={{ background: "#0F172A", borderBottom: "1px solid #1E293B", padding: "0 20px", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Yikanio Premium Logo */}
          <div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
            <img src="/logo.png" alt="Yikanio Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: "20px", lineHeight: 1, letterSpacing: "-0.5px" }}>
              Yikan<span style={{ color: "#38BDF8" }}>io</span>
            </div>
            <div style={{ color: "#94A3B8", fontSize: "11px", marginTop: "3px", fontWeight: 500, letterSpacing: "0.5px" }}>
              {isAdmin ? "👑 YÖNETİM PANELİ" : (firmaAd ? `🏢 ${firmaAd.toUpperCase()}` : user?.email)}
            </div>
          </div>
        </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={yukle} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🔄 Yenile</button>
              <button onClick={logout} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Çıkış</button>
            </div>
          </div>
        </header>
        <AdminPanel firmalar={firmalar} orders={orders} token={user!.token} onFirmaYonet={() => setShowFirma(true)} onYukle={yukle} />
        {showFirma && <FirmaModal token={user!.token} onClose={() => setShowFirma(false)} onSaved={yukle} />}
        <Toast msg={toast.msg} type={toast.type} />
      </div>
    );
  }
  // ─── ANA EKRAN ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Poppins', sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {/* Yikanio Premium Logo */}
              <div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                <img src="/logo.png" alt="Yikanio Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div>
                <div style={{ color: "#0F172A", fontWeight: 800, fontSize: "20px", lineHeight: 1, letterSpacing: "-0.5px" }}>
                  Yikan<span style={{ color: "#38BDF8" }}>io</span>
                </div>
                <div style={{ color: "#64748B", fontSize: "11px", marginTop: "3px", fontWeight: 500, letterSpacing: "0.5px" }}>
                  {isAdmin ? "👑 YÖNETİM PANELİ" : (firmaAd ? `🏢 ${firmaAd.toUpperCase()}` : user?.email)}
                </div>
              </div>
            </div>
            <nav style={{ display: "flex", gap: 4 }} className="desktop-nav">
              {[["siparisler", "📋 Siparişler"], ["raporlar", "📊 Raporlar"], ...(!isAdmin ? [["fiyatlar", "🏷️ Fiyatlar"]] : [])].map(([k, l]) => (
                <button key={k} onClick={() => setActiveTab(k)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: activeTab === k ? "#EFF6FF" : "transparent", color: activeTab === k ? "#2563EB" : "#64748B", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isAdmin && <button onClick={() => setShowFirma(true)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🏢 Firmalar</button>}
            <button onClick={() => { setEditing(null); setShowOrder(true); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#2563EB,#3B82F6)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Sipariş</button>
            <button onClick={logout} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Çıkış</button>
          </div>
        </div>
      </header>

      {/* İçerik */}
      {activeTab === "raporlar" && <RaporEkrani orders={orders} ht={ht} />}
      {activeTab === "fiyatlar" && !isAdmin && (
        <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
          <button onClick={() => setShowHali(true)} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2563EB,#3B82F6)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 16, fontFamily: "inherit" }}>🪄 Fiyat Listesini Düzenle</button>
        </div>
      )}
 
      {activeTab === "siparisler" && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 100px" }}>
          {/* Arama & Filtre */}
          <div className="filter-row" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Müşteri, telefon veya sipariş no ara..." style={{ flex: 1, minWidth: 200, padding: "10px 16px", borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 14, fontFamily: "inherit", background: "#fff", cursor: "pointer" }}>
              {STATUSLAR.map((s) => <option key={s} value={s}>{s === "Tümü" ? "Tüm Durumlar" : STATUS_CONFIG[s]?.label}</option>)}
            </select>
            {isAdmin && (
              <select value={filterFirma} onChange={(e) => setFilterFirma(e.target.value)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 14, fontFamily: "inherit", background: "#fff", cursor: "pointer" }}>
                <option value="Tümü">Tüm Firmalar</option>
                {firmalar.map((f) => <option key={f.id} value={f.id}>{f.ad}</option>)}
              </select>
            )}
          </div>

          {/* ── DESKTOP: Tablo ── */}
          <div className="order-table" style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div style={{ width: 40, height: 40, border: "3px solid #E2E8F0", borderTop: "3px solid #3B82F6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {["No", "Müşteri", ...(isAdmin ? ["Firma"] : []), "Halı Detayı", "Tutar", "Durum", "SMS", "Tarih", "İşlem"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Sonuç bulunamadı.</td></tr>
                  ) : filtered.map((order) => {
                    const smsSayisi = Object.values(order.smsDurum || {}).filter(Boolean).length;
                    return (
                      <tr key={order.id} onClick={() => setSel(order)} style={{ cursor: "pointer", borderBottom: "1px solid #F1F5F9", transition: "background 0.15s" }} onMouseOver={(e) => (e.currentTarget.style.background = "#F8FAFC")} onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}>
                        <td style={{ padding: "14px 16px" }}><span style={{ fontWeight: 700, color: "#475569", fontSize: 12, background: "#F1F5F9", padding: "4px 8px", borderRadius: 6 }}>{order.id}</span></td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 700, color: "#0F172A" }}>{order.musteri}</div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>{order.telefon}</div>
                        </td>
                        {isAdmin && <td style={{ padding: "14px 16px" }}><span style={{ fontSize: 12, color: "#475569", background: "#F8FAFC", padding: "4px 8px", border: "1px solid #E2E8F0", borderRadius: 6 }}>🏢 {order.firmaAd || "Bireysel"}</span></td>}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(order.haliKalemleri || []).map((k, ki) => {
                              const tur = ht.find((t) => t.id === k.turId);
                              return <span key={ki} style={{ fontSize: 11, background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#475569", padding: "4px 8px", borderRadius: 6, fontWeight: 500 }}>{tur?.icon} {tur?.ad} · {k.m2}m²</span>;
                            })}
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}><span style={{ fontWeight: 800, color: "#059669", fontSize: 15 }}>₺{order.fiyat?.toLocaleString()}</span></td>
                        <td style={{ padding: "14px 16px" }}><StatusBadge durum={order.durum} /></td>
                        <td style={{ padding: "14px 16px" }}>{smsSayisi > 0 ? <span style={{ fontSize: 11, background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#059669", padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>📱 {smsSayisi}</span> : <span style={{ color: "#CBD5E1" }}>—</span>}</td>
                        <td style={{ padding: "14px 16px", color: "#64748B", fontSize: 12, whiteSpace: "nowrap" }}>{order.tarih}</td>
                        <td style={{ padding: "14px 16px" }}>
                          <button onClick={(e) => { e.stopPropagation(); setEditing(order); setShowOrder(true); }} style={{ background: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Düzenle</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && filtered.length > 0 && (
              <div style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0", fontSize: 13, color: "#64748B", background: "#F8FAFC" }}>
                Toplam <strong>{filtered.length}</strong> sipariş
              </div>
            )}
          </div>

          {/* ── MOBİL: Kartlar ── */}
          <div className="order-cards">
            {loading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #3B82F6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Sonuç bulunamadı.</div>
            ) : filtered.map((order) => {
              const smsSayisi = Object.values(order.smsDurum || {}).filter(Boolean).length;
              return (
                <div key={order.id} onClick={() => setSel(order)} style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", padding: 16, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  {/* Üst satır: No + Tarih */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: "#475569", fontSize: 11, background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 }}>{order.id}</span>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>{order.tarih}</span>
                  </div>
                  {/* Müşteri */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#0F172A" }}>{order.musteri}</div>
                      <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{order.telefon}</div>
                      {isAdmin && order.firmaAd && <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 4, fontWeight: 600 }}>🏢 {order.firmaAd}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 18, color: "#059669" }}>₺{order.fiyat?.toLocaleString()}</div>
                      {smsSayisi > 0 && <div style={{ fontSize: 11, color: "#059669", marginTop: 2 }}>📱 {smsSayisi} mesaj</div>}
                    </div>
                  </div>
                  {/* Halı Detayı */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {(order.haliKalemleri || []).map((k, ki) => {
                      const tur = ht.find((t) => t.id === k.turId);
                      return <span key={ki} style={{ fontSize: 11, background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#475569", padding: "4px 8px", borderRadius: 6, fontWeight: 500 }}>{tur?.icon} {tur?.ad} · {k.m2}m²</span>;
                    })}
                  </div>
                  {/* Alt satır: Durum + Düzenle */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <StatusBadge durum={order.durum} />
                    <button onClick={(e) => { e.stopPropagation(); setEditing(order); setShowOrder(true); }} style={{ background: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Düzenle</button>
                  </div>
                </div>
              );
            })}
            {!loading && filtered.length > 0 && (
              <div style={{ padding: "10px 4px", fontSize: 13, color: "#94A3B8", textAlign: "center" }}>
                Toplam <strong style={{ color: "#475569" }}>{filtered.length}</strong> sipariş
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobil Alt Nav */}
      <div className="bottom-nav" style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", borderTop: "1px solid #E2E8F0", padding: "12px 0 20px", justifyContent: "space-around", zIndex: 100 }}>
        {[["siparisler", "📋", "Siparişler"], ["raporlar", "📊", "Raporlar"]].map(([k, ic, l]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", flex: 1 }}>
            <span style={{ fontSize: 22 }}>{ic}</span>
            <span style={{ fontSize: 11, fontWeight: activeTab === k ? 700 : 500, color: activeTab === k ? "#2563EB" : "#64748B" }}>{l}</span>
          </button>
        ))}
        <button onClick={() => { setEditing(null); setShowOrder(true); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", flex: 1 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#3B82F6,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginTop: -22, boxShadow: "0 8px 16px rgba(37,99,235,0.3)", color: "#fff" }}>➕</div>
          <span style={{ fontSize: 11, color: "#64748B" }}>Ekle</span>
        </button>
      </div>

      {/* Modallar */}
      {sel && <DetailSheet order={orders.find((o) => o.id === sel.id) || null} ht={ht} isAdmin={isAdmin} onClose={() => setSel(null)} onStatusChange={handleStatus} onEdit={(o) => { setEditing(o); setShowOrder(true); setSel(null); }} onSmsOpen={(o) => { setSmsOrder(o); setSel(null); }} />}
      {showOrder && <OrderModal order={editing} ht={ht} firmalar={firmalar} isAdmin={isAdmin} token={user!.token} firmaId={firmaId} onClose={() => { setEditing(null); setShowOrder(false); }} onSave={handleSave} />}
      {smsOrder && <SmsModal order={smsOrder} ht={ht} firmaAd={isAdmin ? smsOrder.firmaAd || "" : firmaAd} onClose={() => setSmsOrder(null)} onSend={handleSms} />}
      {showHali && !isAdmin && <HaliModal turler={ht} onClose={() => setShowHali(false)} onSave={handleHaliTurleriSave} />}
      {showFirma && isAdmin && <FirmaModal token={user!.token} onClose={() => setShowFirma(false)} onSaved={yukle} />}

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}

// ─── LOGIN & SET PASSWORD EKRANLARI ──────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handle = async () => {
    if (!email || !password) { setErr("Email ve şifre zorunludur."); return; }
    setLoading(true); setErr("");
    try { await onLogin(email, password); }
    catch (e) { setErr(e instanceof Error ? e.message : "Giriş başarısız"); }
    finally { setLoading(false); }
  };

  const inp: React.CSSProperties = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #E2E8F0", fontSize: 15, fontFamily: "'Poppins', sans-serif", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, rgba(15, 23, 42, 0.7), rgba(30, 41, 59, 0.9)), url(/arkaplan.jpg)", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: 40, width: "100%", maxWidth: 400, boxShadow: "0 25px 50px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", margin: "0 auto 12px" }}>
            <img src="/logo.png" alt="Yikanio Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0F172A" }}>Yikan<span style={{ color: "#38BDF8" }}>io</span></h1>
          <p style={{ margin: "8px 0 0", color: "#64748B", fontSize: 14 }}>Halı Yıkama Yönetim Sistemi</p>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <input style={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email adresiniz" onKeyDown={(e) => e.key === "Enter" && handle()} />
          <input style={inp} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifreniz" onKeyDown={(e) => e.key === "Enter" && handle()} />
        </div>
        {err && <div style={{ color: "#DC2626", fontSize: 13, marginTop: 10, fontWeight: 600 }}>❌ {err}</div>}
        <button onClick={handle} disabled={loading} style={{ width: "100%", padding: 16, marginTop: 20, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2563EB,#3B82F6)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>
      </div>
    </div>
  );
}

function SetPasswordScreen({ onSet }: { onSet: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handle = async () => {
    if (password.length < 6) { setErr("Şifre en az 6 karakter olmalı."); return; }
    setLoading(true);
    try { await onSet(password); }
    catch (e) { setErr(e instanceof Error ? e.message : "Hata"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0F172A,#1E293B)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: 40, width: "100%", maxWidth: 400 }}>
        <h2 style={{ margin: "0 0 8px", fontWeight: 800 }}>🔐 Şifre Belirle</h2>
        <p style={{ margin: "0 0 24px", color: "#64748B", fontSize: 14 }}>Hesabınız için yeni bir şifre belirleyin.</p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Yeni şifre (min. 6 karakter)" style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #E2E8F0", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
        {err && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>❌ {err}</div>}
        <button onClick={handle} disabled={loading} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2563EB,#3B82F6)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {loading ? "Kaydediliyor..." : "Şifreyi Kaydet"}
        </button>
      </div>
    </div>
  );
}