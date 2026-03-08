import { useState, useEffect, useRef } from "react";
import { Siparis, HaliTuru, HaliKalemi, Firma } from "../types";
import { toplamM2, toplamAdet, dbMusteriAra } from "../lib/db";

interface OrderModalProps {
  order: Siparis | null;
  ht: HaliTuru[];
  firmalar: Firma[];
  isAdmin: boolean;
  token: string;
  firmaId: string;
  onClose: () => void;
  onSave: (form: OrderForm) => Promise<void>;
}

export interface OrderForm {
  musteri: string;
  telefon: string;
  adres: string;
  notlar: string;
  tarih: string;
  firmaId: string;
  haliKalemleri: HaliKalemi[];
}

interface MusteriOneri {
  id: string;
  ad_soyad: string;
  telefon: string;
  adres: string;
}

const inp: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 10,
  border: "1.5px solid #E2E8F0", fontSize: 14,
  fontFamily: "'Poppins', sans-serif", outline: "none",
  width: "100%", boxSizing: "border-box", background: "#fff",
};

const bugun = () => new Date().toISOString().split("T")[0];

export function OrderModal({ order, ht, firmalar, isAdmin, token, firmaId: propFirmaId, onClose, onSave }: OrderModalProps) {
  const [musteri, setMusteri] = useState("");
  const [telefon, setTelefon] = useState("");
  const [adres, setAdres] = useState("");
  const [notlar, setNotlar] = useState("");
  const [tarih, setTarih] = useState(bugun());
  const [firmaId, setFirmaId] = useState("");
  const [kalemler, setKalemler] = useState<HaliKalemi[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Autocomplete state
  const [oneriler, setOneriler] = useState<MusteriOneri[]>([]);
  const [showOneriler, setShowOneriler] = useState(false);
  const [aramaTimer, setAramaTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const musteriRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (order) {
      setMusteri(order.musteri);
      setTelefon(order.telefon);
      setAdres(order.adres);
      setNotlar(order.notlar);
      setTarih(order.tarih);
      setFirmaId(order.firmaId || "");
      setKalemler(order.haliKalemleri || []);
    } else {
      setMusteri(""); setTelefon(""); setAdres("");
      setNotlar(""); setTarih(bugun());
      setFirmaId(isAdmin && firmalar.length > 0 ? firmalar[0].id : propFirmaId);
      setKalemler([]);
    }
  }, [order, firmalar, isAdmin, propFirmaId]);

  // Dışarı tıklayınca önerileri kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (musteriRef.current && !musteriRef.current.contains(e.target as Node)) {
        setShowOneriler(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const musteriDegisti = (val: string) => {
    setMusteri(val);
    if (aramaTimer) clearTimeout(aramaTimer);
    if (val.length < 2) { setOneriler([]); setShowOneriler(false); return; }

    const aktifFirmaId = isAdmin ? firmaId : propFirmaId;
    if (!aktifFirmaId) return;

    const timer = setTimeout(async () => {
      const sonuc = await dbMusteriAra(token, aktifFirmaId, val);
      setOneriler(sonuc);
      setShowOneriler(sonuc.length > 0);
    }, 300);
    setAramaTimer(timer);
  };

  const musteriSec = (m: MusteriOneri) => {
    setMusteri(m.ad_soyad);
    setTelefon(m.telefon);
    setAdres(m.adres || "");
    setShowOneriler(false);
    setOneriler([]);
  };

  const kalemEkle = () => {
    if (ht.length === 0) return;
    setKalemler([...kalemler, { turId: ht[0].id, adet: 1, m2: 0 }]);
  };

  const kalemGuncelle = (i: number, f: keyof HaliKalemi, v: string | number) => {
    const k = [...kalemler];
    k[i] = { ...k[i], [f]: f === "turId" ? v : Number(v) };
    setKalemler(k);
  };

  const kalemSil = (i: number) => setKalemler(kalemler.filter((_, idx) => idx !== i));

  const toplamFiyat = kalemler.reduce((sum, k) => {
    const tur = ht.find((t) => t.id === k.turId);
    return sum + (tur?.birimFiyat || 0) * (k.m2 || 0) * (k.adet || 1);
  }, 0);

  const handleSave = async () => {
    if (!musteri.trim()) { setErr("Müşteri adı zorunludur."); return; }
    if (!telefon.trim()) { setErr("Telefon zorunludur."); return; }
    if (kalemler.length === 0) { setErr("En az 1 halı kalemi ekleyin."); return; }
    if (isAdmin && !firmaId) { setErr("Firma seçiniz."); return; }
    setSaving(true);
    setErr("");
    try {
      await onSave({ musteri, telefon, adres, notlar, tarih, firmaId, haliKalemleri: kalemler });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kayıt hatası");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000, fontFamily: "'Poppins', sans-serif" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "20px 20px 40px", width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 4, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            {order ? "✏️ Siparişi Düzenle" : "➕ Yeni Sipariş"}
          </h2>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {/* Admin: Firma Seç */}
        {isAdmin && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Firma</label>
            <select style={inp} value={firmaId} onChange={(e) => setFirmaId(e.target.value)}>
              <option value="">Firma seçin...</option>
              {firmalar.map((f) => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>
        )}

        {/* Müşteri Bilgileri */}
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>

          {/* Müşteri Adı — Autocomplete */}
          <div ref={musteriRef} style={{ position: "relative" }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Müşteri Adı</label>
            <input
              style={inp}
              value={musteri}
              onChange={(e) => musteriDegisti(e.target.value)}
              onFocus={() => oneriler.length > 0 && setShowOneriler(true)}
              placeholder="Ad Soyad ara veya yaz..."
              autoComplete="off"
            />
            {showOneriler && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
                background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", marginTop: 4,
              }}>
                {oneriler.map((m) => (
                  <div
                    key={m.id}
                    onMouseDown={() => musteriSec(m)}
                    style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>👤 {m.ad_soyad}</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                      📞 {m.telefon}{m.adres ? ` · 📍 ${m.adres}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Telefon</label>
            <input style={inp} value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="05XX XXX XX XX" type="tel" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Adres</label>
            <input style={inp} value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="Teslimat adresi" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Tarih</label>
              <input style={inp} type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 6, textTransform: "uppercase" }}>Notlar</label>
              <input style={inp} value={notlar} onChange={(e) => setNotlar(e.target.value)} placeholder="Opsiyonel not" />
            </div>
          </div>
        </div>

        {/* Halı Kalemleri */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
              Halı Kalemleri ({toplamAdet(kalemler)} adet · {toplamM2(kalemler)} m²)
            </label>
            <button onClick={kalemEkle} style={{ background: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Ekle</button>
          </div>

          {kalemler.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", background: "#F8FAFC", borderRadius: 12, border: "1.5px dashed #CBD5E1", color: "#94A3B8", fontSize: 14 }}>
              Halı kalemi ekleyin
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {kalemler.map((k, i) => {
                const tur = ht.find((t) => t.id === k.turId);
                const kalemTutar = (tur?.birimFiyat || 0) * (k.m2 || 0) * (k.adet || 1);
                return (
                  <div key={i} style={{ background: "#F8FAFC", borderRadius: 12, padding: 12, border: "1px solid #E2E8F0" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                      <select style={{ ...inp, background: "#fff" }} value={k.turId} onChange={(e) => kalemGuncelle(i, "turId", e.target.value)}>
                        {ht.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.ad} — ₺{t.birimFiyat}/m²</option>)}
                      </select>
                      <button onClick={() => kalemSil(i)} style={{ background: "#FEE2E2", border: "none", borderRadius: 8, width: 36, height: 36, cursor: "pointer", color: "#DC2626", fontSize: 16, flexShrink: 0 }}>✕</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", display: "block", marginBottom: 4 }}>ADET</label>
                        <input style={{ ...inp, textAlign: "center" }} type="number" min="1" value={k.adet} onChange={(e) => kalemGuncelle(i, "adet", e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", display: "block", marginBottom: 4 }}>M²</label>
                        <input style={{ ...inp, textAlign: "center" }} type="number" min="0" step="0.5" value={k.m2} onChange={(e) => kalemGuncelle(i, "m2", e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", display: "block", marginBottom: 4 }}>TUTAR</label>
                        <div style={{ ...inp, textAlign: "center", background: "#F0FDF4", color: "#059669", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>₺{kalemTutar}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Toplam */}
        {kalemler.length > 0 && (
          <div style={{ background: "linear-gradient(135deg,#1E40AF,#3B82F6)", borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#DBEAFE", fontWeight: 600, fontSize: 14 }}>Toplam Tutar</span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>₺{toplamFiyat.toLocaleString()}</span>
          </div>
        )}

        {err && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 12, fontWeight: 600 }}>❌ {err}</div>}

        <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: saving ? "#E2E8F0" : "linear-gradient(135deg,#2563EB,#3B82F6)", color: saving ? "#94A3B8" : "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 16, fontFamily: "inherit" }}>
          {saving ? "Kaydediliyor..." : order ? "Değişiklikleri Kaydet" : "Siparişi Oluştur"}
        </button>
      </div>
    </div>
  );
}