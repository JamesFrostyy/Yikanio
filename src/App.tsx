import { useState, useEffect, useCallback } from "react";

// ─── TIPLER ──────────────────────────────────────────────────────────────────
interface HaliTuru {
  id: string;
  ad: string;
  birimFiyat: number;
  icon: string;
}

interface HaliKalemi {
  turId: string;
  adet: number;
  m2: number;
}

interface Siparis {
  id: string;
  musteri: string;
  telefon: string;
  adres: string;
  durum: string;
  notlar: string;
  fiyat: number;
  tarih: string;
  smsDurum: Record<string, boolean>;
  haliKalemleri: HaliKalemi[];
}

interface StatusCfg {
  label: string;
  color: string;
  bg: string;
  icon: string;
}

interface ToastState {
  msg: string | null;
  type: string;
}

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://nubrhlnxrajuebphahrp.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51YnJobG54cmFqdWVicGhhaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjM3MzcsImV4cCI6MjA4NzkzOTczN30.tf-fBN-a-xS08lES5cJ7RUY2DKrUVSalgH_wHxFjs5Y";

async function sbFetch(path: string, options: any = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── SABİT VERİLER ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, StatusCfg> = {
  bekliyor: { label: "Bekliyor", color: "#F59E0B", bg: "#FEF3C7", icon: "⏳" },
  toplandı: { label: "Toplandı", color: "#3B82F6", bg: "#DBEAFE", icon: "🚛" },
  yıkamada: { label: "Yıkamada", color: "#8B5CF6", bg: "#EDE9FE", icon: "🫧" },
  kurutuluyor: {
    label: "Kurutuluyor",
    color: "#06B6D4",
    bg: "#CFFAFE",
    icon: "💨",
  },
  hazır: { label: "Hazır", color: "#10B981", bg: "#D1FAE5", icon: "✅" },
  dağıtımda: {
    label: "Dağıtımda",
    color: "#F97316",
    bg: "#FFEDD5",
    icon: "🏍️",
  },
  teslim_edildi: {
    label: "Teslim Edildi",
    color: "#6B7280",
    bg: "#F3F4F6",
    icon: "📦",
  },
};

const VARSAYILAN_HALI_TURLERI: HaliTuru[] = [
  { id: "klasik", ad: "Klasik / Düz", birimFiyat: 25, icon: "🟫" },
  { id: "akrilik", ad: "Akrilik", birimFiyat: 30, icon: "🟦" },
  { id: "yun", ad: "Yün", birimFiyat: 45, icon: "🐑" },
  { id: "ipek", ad: "İpek / Bambu", birimFiyat: 80, icon: "✨" },
  { id: "shaggy", ad: "Shaggy / Tüylü", birimFiyat: 40, icon: "🦁" },
  { id: "kilim", ad: "Kilim / Düz Dokuma", birimFiyat: 20, icon: "🔶" },
  { id: "cocuk", ad: "Çocuk Odası Halısı", birimFiyat: 28, icon: "🧒" },
  { id: "banyo", ad: "Banyo / Kapı Paspası", birimFiyat: 15, icon: "🚿" },
];

const STATUSLAR = ["Tümü", ...Object.keys(STATUS_CONFIG)];

// ─── SMS ŞABLONLARI ───────────────────────────────────────────────────────────
function smsMesaji(
  durum: string,
  order: Siparis,
  haliTurleri: HaliTuru[]
): string {
  const turListesi = (order.haliKalemleri || [])
    .map((k: HaliKalemi) => {
      const tur = haliTurleri.find((t: HaliTuru) => t.id === k.turId);
      return `${tur?.ad || k.turId} (${k.m2}m²)`;
    })
    .join(", ");

  const templates: Record<string, string> = {
    toplandı: `Sayın ${order.musteri}, halılarınız teslim alındı.\n\nSipariş No: ${order.id}\nHalılarınız: ${turListesi}\nToplam Tutar: ₺${order.fiyat}\n\nTemiz360`,
    yıkamada: `Sayın ${order.musteri}, halılarınız yıkama sürecine alındı.\n\nSipariş No: ${order.id}\nHalılarınız: ${turListesi}\nToplam Tutar: ₺${order.fiyat}\n\nTemiz360`,
    kurutuluyor: `Sayın ${order.musteri}, halılarınız yıkandı ve kurutma aşamasına geçildi.\n\nSipariş No: ${order.id}\nHalılarınız: ${turListesi}\n\nTemiz360`,
    hazır: `Sayın ${order.musteri}, halılarınız teslimata HAZIR! 🎉\n\nSipariş No: ${order.id}\nHalılarınız: ${turListesi}\nÖdenecek Tutar: ₺${order.fiyat}\n\nTemiz360`,
    dağıtımda: `Sayın ${order.musteri}, halılarınız yola çıktı! 🏍️\n\nSipariş No: ${order.id}\nHalılarınız: ${turListesi}\nÖdenecek Tutar: ₺${order.fiyat}\n\nTemiz360`,
    teslim_edildi: `Sayın ${order.musteri}, halılarınız teslim edildi. ✅\n\nSipariş No: ${order.id}\nToplam: ₺${order.fiyat}\n\nTemiz360'ı tercih ettiğiniz için teşekkürler!`,
  };
  return templates[durum] || "";
}

// ─── YARDIMCI ────────────────────────────────────────────────────────────────
const hesaplaFiyat = (kalemler: HaliKalemi[], turler: HaliTuru[]): number =>
  kalemler.reduce(
    (s, k) =>
      s + (turler.find((t) => t.id === k.turId)?.birimFiyat || 0) * k.m2,
    0
  );
const toplamM2 = (k: HaliKalemi[]): number =>
  k.reduce((s, x) => s + (x.m2 || 0), 0);
const toplamAdet = (k: HaliKalemi[]): number =>
  k.reduce((s, x) => s + (x.adet || 0), 0);

// ─── VERİTABANI ──────────────────────────────────────────────────────────────
async function dbSiparisleriGetir(): Promise<Siparis[]> {
  const [siparisler, kalemler] = await Promise.all([
    sbFetch("siparisler?select=*&order=olusturuldu.desc"),
    sbFetch("hali_kalemleri?select=*"),
  ]);
  return siparisler.map((s: any) => ({
    id: s.id,
    musteri: s.musteri_ad,
    telefon: s.telefon,
    adres: s.adres || "",
    durum: s.durum,
    notlar: s.notlar || "",
    fiyat: Number(s.fiyat),
    tarih: s.tarih,
    smsDurum: s.sms_durum || {},
    haliKalemleri: kalemler
      .filter((k: any) => k.siparis_id === s.id)
      .map((k: any) => ({ turId: k.tur_id, adet: k.adet, m2: Number(k.m2) })),
  }));
}

async function dbSiparisKaydet(
  form: any,
  editingId: string | null = null,
  haliTurleri: HaliTuru[]
): Promise<string> {
  const id = editingId || `SP-${String(Date.now()).slice(-6)}`;
  if (editingId) {
    await sbFetch(`siparisler?id=eq.${editingId}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({
        musteri_ad: form.musteri,
        telefon: form.telefon,
        adres: form.adres,
        durum: form.durum,
        notlar: form.notlar,
        fiyat: form.fiyat,
      }),
    });
    await sbFetch(`hali_kalemleri?siparis_id=eq.${editingId}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
  } else {
    await sbFetch("siparisler", {
      method: "POST",
      body: JSON.stringify({
        id,
        musteri_ad: form.musteri,
        telefon: form.telefon,
        adres: form.adres,
        durum: form.durum,
        notlar: form.notlar,
        fiyat: form.fiyat,
        sms_durum: {},
        tarih: new Date().toISOString().split("T")[0],
      }),
    });
  }
  if (form.haliKalemleri?.length) {
    await sbFetch("hali_kalemleri", {
      method: "POST",
      body: JSON.stringify(
        form.haliKalemleri.map((k: HaliKalemi) => ({
          siparis_id: editingId || id,
          tur_id: k.turId,
          adet: k.adet,
          m2: k.m2,
          tutar:
            (haliTurleri.find((t) => t.id === k.turId)?.birimFiyat || 0) * k.m2,
        }))
      ),
    });
  }
  return id;
}

async function dbDurumGuncelle(id: string, durum: string): Promise<void> {
  await sbFetch(`siparisler?id=eq.${id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ durum }),
  });
}

async function dbSmsGuncelle(
  id: string,
  smsDurum: Record<string, boolean>
): Promise<void> {
  await sbFetch(`siparisler?id=eq.${id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ sms_durum: smsDurum }),
  });
}

async function dbSmsLog(
  siparisId: string,
  telefon: string,
  mesaj: string,
  durumAdi: string
): Promise<void> {
  await sbFetch("sms_log", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      siparis_id: siparisId,
      telefon,
      mesaj,
      durum_adi: durumAdi,
    }),
  });
}

// ─── BİLEŞENLER ──────────────────────────────────────────────────────────────
function StatusBadge({ durum }: { durum: string }) {
  const cfg = STATUS_CONFIG[durum] || STATUS_CONFIG.bekliyor;
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

function Toast({ msg, type }: { msg: string | null; type: string }) {
  if (!msg) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: type === "error" ? "#FEE2E2" : "#D1FAE5",
        color: type === "error" ? "#DC2626" : "#065F46",
        padding: "12px 24px",
        borderRadius: 12,
        fontWeight: 700,
        fontSize: 14,
        zIndex: 9999,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      }}
    >
      {type === "error" ? "❌ " : "✅ "}
      {msg}
    </div>
  );
}

// ─── HALI YÖNETİM MODALI ─────────────────────────────────────────────────────
function HaliYonetimModal({
  turler,
  onClose,
  onSave,
}: {
  turler: HaliTuru[];
  onClose: () => void;
  onSave: (l: HaliTuru[]) => void;
}) {
  const [liste, setListe] = useState<HaliTuru[]>(turler.map((t) => ({ ...t })));
  const [yeni, setYeni] = useState({ ad: "", birimFiyat: "", icon: "🪄" });
  const ikonlar = [
    "🟫",
    "🟦",
    "🐑",
    "✨",
    "🦁",
    "🔶",
    "🧒",
    "🚿",
    "🪄",
    "🌿",
    "⭐",
    "🎨",
    "🏡",
    "🌸",
  ];

  const guncelle = (i: number, field: string, val: any) => {
    const k = [...liste];
    k[i] = { ...k[i], [field]: field === "birimFiyat" ? +val : val };
    setListe(k);
  };

  const ekle = () => {
    if (!yeni.ad || !yeni.birimFiyat) return;
    setListe([
      ...liste,
      {
        id: yeni.ad
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, ""),
        ad: yeni.ad,
        birimFiyat: +yeni.birimFiyat,
        icon: yeni.icon,
      },
    ]);
    setYeni({ ad: "", birimFiyat: "", icon: "🪄" });
  };

  const inp: any = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1.5px solid #E5E7EB",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    background: "#FAFAFA",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: 28,
          width: "100%",
          maxWidth: 580,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
        }}
        onClick={(e: any) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            🪄 Halı Türleri Yönetimi
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "#F3F4F6",
              border: "none",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          {liste.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 110px 36px",
                gap: 8,
                alignItems: "center",
              }}
            >
              <select
                style={{
                  ...inp,
                  textAlign: "center",
                  fontSize: 18,
                  padding: "4px",
                }}
                value={t.icon}
                onChange={(e: any) => guncelle(i, "icon", e.target.value)}
              >
                {ikonlar.map((ik) => (
                  <option key={ik} value={ik}>
                    {ik}
                  </option>
                ))}
              </select>
              <input
                style={{
                  ...inp,
                  width: "100%",
                  boxSizing: "border-box" as any,
                }}
                value={t.ad}
                onChange={(e: any) => guncelle(i, "ad", e.target.value)}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#6B7280" }}>₺</span>
                <input
                  style={{ ...inp, width: "60px", textAlign: "center" }}
                  type="number"
                  value={t.birimFiyat}
                  onChange={(e: any) =>
                    guncelle(i, "birimFiyat", e.target.value)
                  }
                />
                <span style={{ fontSize: 10, color: "#9CA3AF" }}>/m²</span>
              </div>
              <button
                onClick={() => setListe(liste.filter((_, idx) => idx !== i))}
                style={{
                  background: "#FEE2E2",
                  border: "none",
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#DC2626",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 12,
            padding: 14,
            border: "1.5px dashed #CBD5E1",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#6B7280",
              marginBottom: 10,
              textTransform: "uppercase" as any,
              letterSpacing: "0.05em",
            }}
          >
            Yeni Tür Ekle
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr 110px auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <select
              style={{
                ...inp,
                textAlign: "center",
                fontSize: 18,
                padding: "4px",
              }}
              value={yeni.icon}
              onChange={(e: any) => setYeni({ ...yeni, icon: e.target.value })}
            >
              {ikonlar.map((ik) => (
                <option key={ik} value={ik}>
                  {ik}
                </option>
              ))}
            </select>
            <input
              style={{ ...inp, width: "100%", boxSizing: "border-box" as any }}
              value={yeni.ad}
              onChange={(e: any) => setYeni({ ...yeni, ad: e.target.value })}
              placeholder="Halı türü adı"
            />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>₺</span>
              <input
                style={{ ...inp, width: "60px", textAlign: "center" }}
                type="number"
                value={yeni.birimFiyat}
                onChange={(e: any) =>
                  setYeni({ ...yeni, birimFiyat: e.target.value })
                }
                placeholder="0"
              />
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>/m²</span>
            </div>
            <button
              onClick={ekle}
              style={{
                background: "#DBEAFE",
                color: "#1D4ED8",
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "inherit",
                whiteSpace: "nowrap" as any,
              }}
            >
              + Ekle
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "1.5px solid #E5E7EB",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              color: "#374151",
              fontFamily: "inherit",
            }}
          >
            İptal
          </button>
          <button
            onClick={() => onSave(liste)}
            style={{
              padding: "10px 28px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg,#1E40AF,#3B82F6)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 14,
              fontFamily: "inherit",
            }}
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SMS MODALI ───────────────────────────────────────────────────────────────
function SmsModal({
  order,
  haliTurleri,
  onClose,
  onSend,
}: {
  order: Siparis;
  haliTurleri: HaliTuru[];
  onClose: () => void;
  onSend: (s: string, m: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const smsText = selected ? smsMesaji(selected, order, haliTurleri) : "";

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    await onSend(selected, smsText);
    setSent(true);
    setTimeout(onClose, 1000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: 28,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
        }}
        onClick={(e: any) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            📱 SMS Gönder
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "#F3F4F6",
              border: "none",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 14,
            fontSize: 13,
            color: "#374151",
          }}
        >
          <strong>{order.musteri}</strong> · {order.telefon} · {order.id}
        </div>
        <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
          {Object.keys(STATUS_CONFIG)
            .filter((s) => s !== "bekliyor")
            .map((s) => {
              const cfg = STATUS_CONFIG[s];
              const zatenGitti = order.smsDurum?.[s];
              const aktif = selected === s;
              return (
                <button
                  key={s}
                  onClick={() => !zatenGitti && setSelected(s)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1.5px solid ${aktif ? cfg.color : "#E5E7EB"}`,
                    background: aktif
                      ? cfg.bg
                      : zatenGitti
                      ? "#F9FAFB"
                      : "#fff",
                    cursor: zatenGitti ? "not-allowed" : "pointer",
                    opacity: zatenGitti ? 0.55 : 1,
                    textAlign: "left" as any,
                    fontFamily: "inherit",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: aktif ? cfg.color : "#374151",
                    }}
                  >
                    {cfg.icon} {cfg.label} SMS'i
                  </span>
                  {zatenGitti && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "#10B981",
                        fontWeight: 700,
                      }}
                    >
                      ✓ Gönderildi
                    </span>
                  )}
                </button>
              );
            })}
        </div>
        {smsText && (
          <div
            style={{
              background: "#F0FDF4",
              border: "1.5px solid #BBF7D0",
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#166534",
                marginBottom: 6,
              }}
            >
              MESAJ ÖNİZLEME
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#15803D",
                lineHeight: 1.7,
                whiteSpace: "pre-line" as any,
              }}
            >
              {smsText}
            </div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>
              {smsText.length} karakter · ~{Math.ceil(smsText.length / 160)} SMS
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "1.5px solid #E5E7EB",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              color: "#374151",
              fontFamily: "inherit",
            }}
          >
            İptal
          </button>
          <button
            onClick={handleSend}
            disabled={!selected || sending || sent}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: sent
                ? "#10B981"
                : selected
                ? "linear-gradient(135deg,#16A34A,#22C55E)"
                : "#E5E7EB",
              color: selected ? "#fff" : "#9CA3AF",
              cursor: selected && !sending ? "pointer" : "not-allowed",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "inherit",
            }}
          >
            {sent ? "✓ Kaydedildi!" : sending ? "Kaydediliyor..." : "📤 Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SİPARİŞ FORMU ───────────────────────────────────────────────────────────
function OrderModal({
  order,
  haliTurleri,
  onClose,
  onSave,
}: {
  order: Siparis | null;
  haliTurleri: HaliTuru[];
  onClose: () => void;
  onSave: (f: any) => Promise<void>;
}) {
  const emptyKalem = (): HaliKalemi => ({
    turId: haliTurleri[0]?.id || "klasik",
    adet: 1,
    m2: 0,
  });
  const [form, setForm] = useState<any>(
    order
      ? {
          musteri: order.musteri,
          telefon: order.telefon,
          adres: order.adres,
          durum: order.durum,
          notlar: order.notlar,
          haliKalemleri: order.haliKalemleri?.length
            ? [...order.haliKalemleri]
            : [emptyKalem()],
        }
      : {
          musteri: "",
          telefon: "",
          adres: "",
          durum: "bekliyor",
          notlar: "",
          haliKalemleri: [emptyKalem()],
        }
  );
  const [saving, setSaving] = useState(false);
  const fiyat = hesaplaFiyat(form.haliKalemleri, haliTurleri);

  const updateKalem = (i: number, field: string, val: any) => {
    const k = [...form.haliKalemleri];
    k[i] = {
      ...k[i],
      [field]: field === "m2" || field === "adet" ? +val : val,
    };
    setForm({ ...form, haliKalemleri: k });
  };

  const handleSubmit = async () => {
    if (!form.musteri || !form.telefon) {
      alert("Müşteri adı ve telefon zorunludur.");
      return;
    }
    setSaving(true);
    await onSave({ ...form, fiyat });
    setSaving(false);
  };

  const inp: any = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 10,
    border: "1.5px solid #E5E7EB",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    background: "#FAFAFA",
  };
  const lbl: any = {
    fontSize: 10,
    fontWeight: 700,
    color: "#6B7280",
    marginBottom: 4,
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: 28,
          width: "100%",
          maxWidth: 640,
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
        }}
        onClick={(e: any) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: "0 0 22px",
            fontSize: 20,
            fontWeight: 800,
            color: "#111",
          }}
        >
          {order ? "✏️ Siparişi Düzenle" : "➕ Yeni Sipariş"}
        </h2>
        <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label style={lbl}>Müşteri Adı *</label>
              <input
                style={inp}
                value={form.musteri}
                onChange={(e: any) =>
                  setForm({ ...form, musteri: e.target.value })
                }
                placeholder="Ad Soyad"
              />
            </div>
            <div>
              <label style={lbl}>Telefon *</label>
              <input
                style={inp}
                value={form.telefon}
                onChange={(e: any) =>
                  setForm({ ...form, telefon: e.target.value })
                }
                placeholder="0532 xxx xx xx"
              />
            </div>
          </div>
          <div>
            <label style={lbl}>Adres</label>
            <input
              style={inp}
              value={form.adres}
              onChange={(e: any) => setForm({ ...form, adres: e.target.value })}
              placeholder="Mahalle, İlçe, Şehir"
            />
          </div>
        </div>
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
            border: "1.5px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#374151",
                textTransform: "uppercase" as any,
                letterSpacing: "0.05em",
              }}
            >
              🪄 Halı Kalemleri
            </span>
            <button
              onClick={() =>
                setForm({
                  ...form,
                  haliKalemleri: [...form.haliKalemleri, emptyKalem()],
                })
              }
              style={{
                background: "#DBEAFE",
                color: "#1D4ED8",
                border: "none",
                borderRadius: 8,
                padding: "4px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              + Kalem Ekle
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 60px 70px 80px 32px",
              gap: 8,
              marginBottom: 6,
            }}
          >
            {["Halı Türü", "Adet", "m²", "Tutar", ""].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#9CA3AF",
                  textTransform: "uppercase" as any,
                }}
              >
                {h}
              </div>
            ))}
          </div>
          {form.haliKalemleri.map((k: HaliKalemi, i: number) => {
            const tur = haliTurleri.find((t) => t.id === k.turId);
            const sf = tur ? tur.birimFiyat * k.m2 : 0;
            return (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 60px 70px 80px 32px",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <select
                  style={{ ...inp, padding: "7px 10px" }}
                  value={k.turId}
                  onChange={(e: any) => updateKalem(i, "turId", e.target.value)}
                >
                  {haliTurleri.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon} {t.ad} — ₺{t.birimFiyat}/m²
                    </option>
                  ))}
                </select>
                <input
                  style={{ ...inp, textAlign: "center", padding: "7px 6px" }}
                  type="number"
                  min={1}
                  value={k.adet}
                  onChange={(e: any) => updateKalem(i, "adet", e.target.value)}
                />
                <input
                  style={{ ...inp, textAlign: "center", padding: "7px 6px" }}
                  type="number"
                  min={0}
                  step={0.5}
                  value={k.m2}
                  onChange={(e: any) => updateKalem(i, "m2", e.target.value)}
                />
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: sf > 0 ? "#059669" : "#CBD5E1",
                    textAlign: "right" as any,
                  }}
                >
                  {sf > 0 ? `₺${sf}` : "—"}
                </div>
                <button
                  onClick={() => {
                    if (form.haliKalemleri.length === 1) return;
                    setForm({
                      ...form,
                      haliKalemleri: form.haliKalemleri.filter(
                        (_: any, idx: number) => idx !== i
                      ),
                    });
                  }}
                  style={{
                    background: "#FEE2E2",
                    border: "none",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#DC2626",
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12,
              paddingTop: 12,
              borderTop: "2px dashed #E5E7EB",
            }}
          >
            <span style={{ fontSize: 12, color: "#6B7280" }}>
              {toplamAdet(form.haliKalemleri)} adet ·{" "}
              {toplamM2(form.haliKalemleri)} m²
            </span>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#1E40AF" }}>
              Toplam: ₺{fiyat.toLocaleString()}
            </span>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={lbl}>Durum</label>
            <select
              style={inp}
              value={form.durum}
              onChange={(e: any) => setForm({ ...form, durum: e.target.value })}
            >
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Notlar</label>
            <textarea
              style={{ ...inp, minHeight: 72, resize: "vertical" as any }}
              value={form.notlar}
              onChange={(e: any) =>
                setForm({ ...form, notlar: e.target.value })
              }
              placeholder="Özel istekler..."
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 22,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "1.5px solid #E5E7EB",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              color: "#374151",
              fontFamily: "inherit",
            }}
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: "10px 28px",
              borderRadius: 10,
              border: "none",
              background: saving
                ? "#93C5FD"
                : "linear-gradient(135deg,#1E40AF,#3B82F6)",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 800,
              fontSize: 14,
              fontFamily: "inherit",
            }}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DETAY PANELİ ─────────────────────────────────────────────────────────────
function DetailPanel({
  order,
  haliTurleri,
  onClose,
  onStatusChange,
  onEdit,
  onSmsOpen,
}: {
  order: Siparis | null;
  haliTurleri: HaliTuru[];
  onClose: () => void;
  onStatusChange: (id: string, s: string) => void;
  onEdit: (o: Siparis) => void;
  onSmsOpen: (o: Siparis) => void;
}) {
  if (!order) return null;
  const statusKeys = Object.keys(STATUS_CONFIG);
  const currentIdx = statusKeys.indexOf(order.durum);
  const smsSayisi = Object.values(order.smsDurum || {}).filter(Boolean).length;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: 400,
        background: "#fff",
        boxShadow: "-4px 0 30px rgba(0,0,0,0.12)",
        zIndex: 500,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          padding: "24px 24px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>
            {order.id}
          </div>
          <h2
            style={{
              margin: "4px 0 8px",
              fontSize: 20,
              fontWeight: 800,
              color: "#111",
            }}
          >
            {order.musteri}
          </h2>
          <StatusBadge durum={order.durum} />
        </div>
        <button
          onClick={onClose}
          style={{
            background: "#F3F4F6",
            border: "none",
            borderRadius: 8,
            width: 32,
            height: 32,
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ padding: "20px 24px 0" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#6B7280",
            marginBottom: 10,
          }}
        >
          SİPARİŞ SÜRECİ
        </div>
        {statusKeys.map((s, i) => {
          const cfg = STATUS_CONFIG[s];
          const done = i <= currentIdx;
          const current = i === currentIdx;
          return (
            <div
              key={s}
              style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: done ? cfg.color : "#E5E7EB",
                    color: done ? "#fff" : "#9CA3AF",
                    boxShadow: current ? `0 0 0 4px ${cfg.bg}` : "none",
                  }}
                >
                  {done ? (current ? cfg.icon : "✓") : ""}
                </div>
                {i < statusKeys.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      height: 22,
                      background: i < currentIdx ? cfg.color : "#E5E7EB",
                      margin: "2px 0",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  paddingBottom: 6,
                  paddingTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: current ? 700 : 500,
                    color: done ? "#111" : "#9CA3AF",
                  }}
                >
                  {cfg.label}
                </span>
                {order.smsDurum?.[s] && (
                  <span
                    style={{
                      fontSize: 10,
                      background: "#D1FAE5",
                      color: "#065F46",
                      padding: "1px 6px",
                      borderRadius: 6,
                      fontWeight: 700,
                    }}
                  >
                    SMS ✓
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "16px 24px 0" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#6B7280",
            marginBottom: 10,
          }}
        >
          HALI KALEMLERİ
        </div>
        {(order.haliKalemleri || []).map((k, i) => {
          const tur = haliTurleri.find((t) => t.id === k.turId);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 12px",
                background: "#F8FAFC",
                borderRadius: 10,
                border: "1px solid #E5E7EB",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 13, color: "#374151" }}>
                {tur?.icon} {tur?.ad || k.turId}
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#6B7280" }}>
                  {k.adet} adet · {k.m2} m²
                </span>
                <span
                  style={{ fontWeight: 700, fontSize: 13, color: "#059669" }}
                >
                  ₺{tur ? tur.birimFiyat * k.m2 : 0}
                </span>
              </div>
            </div>
          );
        })}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 12px",
            background: "#EFF6FF",
            borderRadius: 10,
            border: "1px solid #BFDBFE",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>
            Toplam · {toplamAdet(order.haliKalemleri || [])} halı ·{" "}
            {toplamM2(order.haliKalemleri || [])} m²
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#1E40AF" }}>
            ₺{order.fiyat?.toLocaleString()}
          </span>
        </div>
      </div>
      <div style={{ padding: "16px 24px 0" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#6B7280",
            marginBottom: 8,
          }}
        >
          BİLGİLER
        </div>
        {[
          ["📞", "Telefon", order.telefon],
          ["📍", "Adres", order.adres],
          ["🗓", "Tarih", order.tarih],
        ].map(([ic, k, v]) => (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "9px 0",
              borderBottom: "1px solid #F3F4F6",
            }}
          >
            <span style={{ fontSize: 13, color: "#6B7280" }}>
              {ic} {k}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111",
                textAlign: "right" as any,
                maxWidth: "60%",
              }}
            >
              {v}
            </span>
          </div>
        ))}
        {order.notlar && (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              background: "#FFFBEB",
              borderRadius: 10,
              border: "1px solid #FDE68A",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#92400E",
                marginBottom: 4,
              }}
            >
              NOT
            </div>
            <div style={{ fontSize: 13, color: "#78350F" }}>{order.notlar}</div>
          </div>
        )}
      </div>
      <div style={{ padding: "20px 24px 24px" }}>
        <button
          onClick={() => onSmsOpen(order)}
          style={{
            width: "100%",
            marginBottom: 8,
            padding: "12px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg,#065F46,#059669)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          📱 SMS Gönder
          {smsSayisi > 0 && (
            <span
              style={{
                background: "rgba(255,255,255,0.25)",
                borderRadius: 20,
                padding: "1px 10px",
                fontSize: 11,
              }}
            >
              {smsSayisi} gönderildi
            </span>
          )}
        </button>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 8,
          }}
        >
          {currentIdx > 0 && (
            <button
              onClick={() =>
                onStatusChange(order.id, statusKeys[currentIdx - 1])
              }
              style={{
                padding: "10px",
                borderRadius: 10,
                border: "1.5px solid #E5E7EB",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                color: "#374151",
                fontFamily: "inherit",
              }}
            >
              ← Geri Al
            </button>
          )}
          {currentIdx < statusKeys.length - 1 && (
            <button
              onClick={() =>
                onStatusChange(order.id, statusKeys[currentIdx + 1])
              }
              style={{
                padding: "10px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg,#059669,#10B981)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "inherit",
                gridColumn: currentIdx === 0 ? "span 2" : "auto",
              }}
            >
              Sonraki Adım →
            </button>
          )}
        </div>
        <button
          onClick={() => onEdit(order)}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 10,
            border: "1.5px solid #DBEAFE",
            background: "#EFF6FF",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
            color: "#1D4ED8",
            fontFamily: "inherit",
          }}
        >
          ✏️ Siparişi Düzenle
        </button>
      </div>
    </div>
  );
}

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────
export default function App() {
  const [orders, setOrders] = useState<Siparis[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Siparis | null>(null);
  const [filterStatus, setFilterStatus] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Siparis | null>(null);
  const [smsOrder, setSmsOrder] = useState<Siparis | null>(null);
  const [activeTab, setActiveTab] = useState("siparisler");
  const [showHaliYonetim, setShowHaliYonetim] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    msg: null,
    type: "success",
  });
  const [haliTurleri, setHaliTurleri] = useState<HaliTuru[]>(() => {
    try {
      const s = localStorage.getItem("temiz360_hali_turleri");
      return s ? JSON.parse(s) : VARSAYILAN_HALI_TURLERI;
    } catch {
      return VARSAYILAN_HALI_TURLERI;
    }
  });

  const showToast = (msg: string, type: string = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: null, type: "success" }), 3000);
  };

  const siparisleriYukle = useCallback(async () => {
    try {
      setLoading(true);
      setDbError(null);
      setOrders(await dbSiparisleriGetir());
    } catch (e: any) {
      setDbError("Bağlantı hatası: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    siparisleriYukle();
  }, [siparisleriYukle]);

  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === "Tümü" || o.durum === filterStatus;
    const q = search.toLowerCase();
    return (
      matchStatus &&
      (o.musteri.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.telefon.includes(q))
    );
  });

  const stats = {
    toplam: orders.length,
    bekleyen: orders.filter((o) => o.durum === "bekliyor").length,
    hazır: orders.filter((o) => o.durum === "hazır").length,
    dagitimda: orders.filter((o) => o.durum === "dağıtımda").length,
    aktifCiro: orders
      .filter((o) => o.durum !== "teslim_edildi")
      .reduce((s, o) => s + (o.fiyat || 0), 0),
  };

  const handleSave = async (form: any) => {
    try {
      await dbSiparisKaydet(form, editingOrder?.id || null, haliTurleri);
      showToast(
        editingOrder ? "Sipariş güncellendi" : "Yeni sipariş oluşturuldu"
      );
      await siparisleriYukle();
      setShowOrderModal(false);
      setEditingOrder(null);
    } catch (e: any) {
      showToast("Hata: " + e.message, "error");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await dbDurumGuncelle(id, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, durum: newStatus } : o))
      );
      setSelectedOrder((prev) =>
        prev?.id === id ? { ...prev, durum: newStatus } : prev
      );
      showToast(
        `${STATUS_CONFIG[newStatus].icon} ${STATUS_CONFIG[newStatus].label}`
      );
    } catch (e: any) {
      showToast("Durum güncellenemedi", "error");
    }
  };

  const handleSmsSend = async (statusKey: string, mesaj: string) => {
    if (!smsOrder) return;
    try {
      const order = orders.find((o) => o.id === smsOrder.id);
      if (!order) return;
      const yeniSmsDurum = { ...order.smsDurum, [statusKey]: true };
      await dbSmsGuncelle(smsOrder.id, yeniSmsDurum);
      await dbSmsLog(smsOrder.id, smsOrder.telefon, mesaj, statusKey);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === smsOrder.id ? { ...o, smsDurum: yeniSmsDurum } : o
        )
      );
      setSelectedOrder((prev) =>
        prev?.id === smsOrder.id ? { ...prev, smsDurum: yeniSmsDurum } : prev
      );
      showToast("SMS logu kaydedildi ✓");
    } catch (e: any) {
      showToast("SMS kaydedilemedi", "error");
    }
  };

  const handleHaliKaydet = (liste: HaliTuru[]) => {
    setHaliTurleri(liste);
    try {
      localStorage.setItem("temiz360_hali_turleri", JSON.stringify(liste));
    } catch {}
    setShowHaliYonetim(false);
    showToast("Halı türleri güncellendi");
  };

  const tabStyle = (key: string): any => ({
    padding: "8px 18px",
    borderRadius: 10,
    border: "none",
    background: activeTab === key ? "#fff" : "transparent",
    color: activeTab === key ? "#1E40AF" : "#94A3B8",
    fontWeight: activeTab === key ? 700 : 500,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: activeTab === key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F1F5F9",
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg,#0F172A 0%,#0F3460 100%)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg,#06B6D4,#3B82F6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            🧹
          </div>
          <div>
            <div
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: 18,
                lineHeight: 1,
                letterSpacing: "-0.3px",
              }}
            >
              Temiz360
            </div>
            <div style={{ color: "#475569", fontSize: 10, fontWeight: 500 }}>
              Halı Yıkama Yönetim Sistemi
            </div>
          </div>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 4,
            display: "flex",
          }}
        >
          <button
            style={tabStyle("siparisler")}
            onClick={() => setActiveTab("siparisler")}
          >
            📋 Siparişler
          </button>
          <button
            style={tabStyle("fiyatlar")}
            onClick={() => setActiveTab("fiyatlar")}
          >
            🏷️ Fiyat Listesi
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={siparisleriYukle}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#94A3B8",
              border: "none",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          >
            ⟳
          </button>
          <button
            onClick={() => setShowHaliYonetim(true)}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#94A3B8",
              border: "none",
              borderRadius: 10,
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          >
            🪄 Halı Türleri
          </button>
          <button
            onClick={() => {
              setEditingOrder(null);
              setShowOrderModal(true);
            }}
            style={{
              background: "linear-gradient(135deg,#06B6D4,#3B82F6)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "8px 18px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "inherit",
            }}
          >
            + Yeni Sipariş
          </button>
        </div>
      </div>

      {dbError && (
        <div
          style={{
            margin: "16px 24px",
            padding: "14px 18px",
            background: "#FEE2E2",
            borderRadius: 12,
            border: "1px solid #FECACA",
            color: "#DC2626",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ❌ {dbError}
          <button
            onClick={siparisleriYukle}
            style={{
              marginLeft: 12,
              background: "#DC2626",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* FİYAT LİSTESİ */}
      {activeTab === "fiyatlar" && (
        <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                style={{
                  margin: "0 0 4px",
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0F172A",
                }}
              >
                Halı Türleri & Fiyatlar
              </h2>
              <p style={{ margin: 0, color: "#64748B", fontSize: 14 }}>
                Tüm fiyatlar KDV dahil, m² başına hesaplanır.
              </p>
            </div>
            <button
              onClick={() => setShowHaliYonetim(true)}
              style={{
                background: "linear-gradient(135deg,#1E40AF,#3B82F6)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              ✏️ Düzenle
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))",
              gap: 12,
            }}
          >
            {haliTurleri.map((t) => (
              <div
                key={t.id}
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "18px 22px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1.5px solid #E2E8F0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 14,
                      background: "#F1F5F9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                    }}
                  >
                    {t.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#0F172A",
                      }}
                    >
                      {t.ad}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}
                    >
                      Profesyonel yıkama hizmeti
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)",
                    borderRadius: 12,
                    padding: "8px 18px",
                    textAlign: "center" as any,
                    border: "1px solid #BFDBFE",
                    minWidth: 72,
                  }}
                >
                  <div
                    style={{ fontSize: 22, fontWeight: 800, color: "#1E40AF" }}
                  >
                    ₺{t.birimFiyat}
                  </div>
                  <div
                    style={{ fontSize: 10, color: "#3B82F6", fontWeight: 700 }}
                  >
                    / m²
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SİPARİŞLER */}
      {activeTab === "siparisler" && (
        <div style={{ padding: 24, maxWidth: 1300, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5,1fr)",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[
              {
                label: "Toplam Sipariş",
                value: loading ? "…" : stats.toplam,
                icon: "📋",
                color: "#3B82F6",
                bg: "#DBEAFE",
              },
              {
                label: "Bekleyen",
                value: loading ? "…" : stats.bekleyen,
                icon: "⏳",
                color: "#F59E0B",
                bg: "#FEF3C7",
              },
              {
                label: "Teslime Hazır",
                value: loading ? "…" : stats.hazır,
                icon: "✅",
                color: "#10B981",
                bg: "#D1FAE5",
              },
              {
                label: "Dağıtımda",
                value: loading ? "…" : stats.dagitimda,
                icon: "🏍️",
                color: "#F97316",
                bg: "#FFEDD5",
              },
              {
                label: "Aktif Ciro",
                value: loading ? "…" : `₺${stats.aktifCiro.toLocaleString()}`,
                icon: "💰",
                color: "#8B5CF6",
                bg: "#EDE9FE",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "14px 18px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: s.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: "#0F172A",
                      lineHeight: 1.2,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}
                  >
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "12px 16px",
              marginBottom: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              display: "flex",
              gap: 10,
              flexWrap: "wrap" as any,
              alignItems: "center",
            }}
          >
            <input
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              placeholder="🔍 Müşteri, telefon veya sipariş no..."
              style={{
                flex: 1,
                minWidth: 200,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1.5px solid #E5E7EB",
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
                background: "#F8FAFC",
              }}
            />
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as any }}>
              {STATUSLAR.map((s) => {
                const cfg = s !== "Tümü" ? STATUS_CONFIG[s] : null;
                const active = filterStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 20,
                      border: "1.5px solid",
                      borderColor: active ? cfg?.color || "#1E40AF" : "#E5E7EB",
                      background: active ? cfg?.bg || "#DBEAFE" : "#fff",
                      color: active ? cfg?.color || "#1E40AF" : "#6B7280",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 11,
                      fontFamily: "inherit",
                    }}
                  >
                    {cfg ? `${cfg.icon} ${cfg.label}` : "Tümü"}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}
          >
            {loading ? (
              <div style={{ padding: 60, textAlign: "center" as any }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    border: "3px solid #E5E7EB",
                    borderTop: "3px solid #3B82F6",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 12px",
                  }}
                />
                <div style={{ color: "#6B7280", fontSize: 14 }}>
                  Veriler yükleniyor...
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{ width: "100%", borderCollapse: "collapse" as any }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#F8FAFC",
                        borderBottom: "2px solid #E5E7EB",
                      }}
                    >
                      {[
                        "Sipariş No",
                        "Müşteri",
                        "Halı Kalemleri",
                        "Toplam",
                        "Durum",
                        "SMS",
                        "Tarih",
                        "",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "11px 14px",
                            textAlign: "left" as any,
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#64748B",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase" as any,
                            whiteSpace: "nowrap" as any,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: 50,
                            textAlign: "center" as any,
                            color: "#9CA3AF",
                            fontSize: 14,
                          }}
                        >
                          {orders.length === 0
                            ? "Henüz sipariş yok. + Yeni Sipariş butonuna tıklayın."
                            : "Arama kriterine uygun sipariş bulunamadı."}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((order, i) => {
                        const smsSayisi = Object.values(
                          order.smsDurum || {}
                        ).filter(Boolean).length;
                        return (
                          <tr
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            style={{
                              borderBottom: "1px solid #F1F5F9",
                              cursor: "pointer",
                              background:
                                selectedOrder?.id === order.id
                                  ? "#EFF6FF"
                                  : i % 2 === 0
                                  ? "#fff"
                                  : "#FAFAFA",
                              transition: "background 0.15s",
                            }}
                          >
                            <td style={{ padding: "12px 14px" }}>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: "#1E40AF",
                                  fontSize: 13,
                                }}
                              >
                                {order.id}
                              </span>
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: "#0F172A",
                                  fontSize: 14,
                                }}
                              >
                                {order.musteri}
                              </div>
                              <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                                {order.telefon}
                              </div>
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap" as any,
                                  gap: 4,
                                }}
                              >
                                {(order.haliKalemleri || []).map((k, ki) => {
                                  const tur = haliTurleri.find(
                                    (t) => t.id === k.turId
                                  );
                                  return (
                                    <span
                                      key={ki}
                                      style={{
                                        fontSize: 11,
                                        background: "#F1F5F9",
                                        color: "#374151",
                                        padding: "2px 8px",
                                        borderRadius: 6,
                                        fontWeight: 500,
                                      }}
                                    >
                                      {tur?.icon} {tur?.ad || k.turId} · {k.m2}
                                      m²
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  color: "#059669",
                                  fontSize: 14,
                                }}
                              >
                                ₺{order.fiyat?.toLocaleString()}
                              </span>
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <StatusBadge durum={order.durum} />
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              {smsSayisi > 0 ? (
                                <span
                                  style={{
                                    fontSize: 11,
                                    background: "#D1FAE5",
                                    color: "#065F46",
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    fontWeight: 700,
                                  }}
                                >
                                  📱 {smsSayisi}
                                </span>
                              ) : (
                                <span
                                  style={{ fontSize: 11, color: "#CBD5E1" }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "12px 14px",
                                color: "#9CA3AF",
                                fontSize: 12,
                                whiteSpace: "nowrap" as any,
                              }}
                            >
                              {order.tarih}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <button
                                onClick={(e: any) => {
                                  e.stopPropagation();
                                  setEditingOrder(order);
                                  setShowOrderModal(true);
                                }}
                                style={{
                                  background: "#F1F5F9",
                                  border: "none",
                                  borderRadius: 8,
                                  padding: "5px 12px",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "#374151",
                                  fontFamily: "inherit",
                                }}
                              >
                                Düzenle
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && filtered.length > 0 && (
              <div
                style={{
                  padding: "10px 18px",
                  borderTop: "1px solid #F1F5F9",
                  fontSize: 12,
                  color: "#9CA3AF",
                }}
              >
                {filtered.length} sipariş · Temiz360 · Supabase ✓
              </div>
            )}
          </div>
        </div>
      )}

      {selectedOrder && (
        <DetailPanel
          order={orders.find((o) => o.id === selectedOrder.id) || null}
          haliTurleri={haliTurleri}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          onEdit={(o) => {
            setEditingOrder(o);
            setShowOrderModal(true);
          }}
          onSmsOpen={setSmsOrder}
        />
      )}
      {showOrderModal && (
        <OrderModal
          order={editingOrder}
          haliTurleri={haliTurleri}
          onClose={() => {
            setShowOrderModal(false);
            setEditingOrder(null);
          }}
          onSave={handleSave}
        />
      )}
      {smsOrder && (
        <SmsModal
          order={smsOrder}
          haliTurleri={haliTurleri}
          onClose={() => setSmsOrder(null)}
          onSend={handleSmsSend}
        />
      )}
      {showHaliYonetim && (
        <HaliYonetimModal
          turler={haliTurleri}
          onClose={() => setShowHaliYonetim(false)}
          onSave={handleHaliKaydet}
        />
      )}
      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}
