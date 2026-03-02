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

// ─── SABİTLER ────────────────────────────────────────────────────────────────
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

// ─── YARDIMCI ────────────────────────────────────────────────────────────────
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
  const t: Record<string, string> = {
    toplandı: `Sayın ${order.musteri}, halılarınız teslim alındı.\nSipariş No: ${order.id}\nHalılar: ${turListesi}\nTutar: ₺${order.fiyat}\nTemiz360`,
    yıkamada: `Sayın ${order.musteri}, halılarınız yıkamaya alındı.\nSipariş No: ${order.id}\nHalılar: ${turListesi}\nTemiz360`,
    kurutuluyor: `Sayın ${order.musteri}, halılarınız kurutuluyor.\nSipariş No: ${order.id}\nTemiz360`,
    hazır: `Sayın ${order.musteri}, halılarınız HAZIR! 🎉\nSipariş No: ${order.id}\nHalılar: ${turListesi}\nÖdenecek: ₺${order.fiyat}\nTemiz360`,
    dağıtımda: `Sayın ${order.musteri}, halılarınız yola çıktı! 🏍️\nSipariş No: ${order.id}\nÖdenecek: ₺${order.fiyat}\nTemiz360`,
    teslim_edildi: `Sayın ${order.musteri}, halılarınız teslim edildi. ✅\nToplam: ₺${order.fiyat}\nTemiz360'ı tercih ettiğiniz için teşekkürler!`,
  };
  return t[durum] || "";
}

const hesaplaFiyat = (k: HaliKalemi[], t: HaliTuru[]) =>
  k.reduce(
    (s, x) => s + (t.find((r) => r.id === x.turId)?.birimFiyat || 0) * x.m2,
    0
  );
const toplamM2 = (k: HaliKalemi[]) => k.reduce((s, x) => s + (x.m2 || 0), 0);
const toplamAdet = (k: HaliKalemi[]) =>
  k.reduce((s, x) => s + (x.adet || 0), 0);

// ─── DB ──────────────────────────────────────────────────────────────────────
async function dbGetir(): Promise<Siparis[]> {
  const [ss, kk] = await Promise.all([
    sbFetch("siparisler?select=*&order=olusturuldu.desc"),
    sbFetch("hali_kalemleri?select=*"),
  ]);
  return ss.map((s: any) => ({
    id: s.id,
    musteri: s.musteri_ad,
    telefon: s.telefon,
    adres: s.adres || "",
    durum: s.durum,
    notlar: s.notlar || "",
    fiyat: Number(s.fiyat),
    tarih: s.tarih,
    smsDurum: s.sms_durum || {},
    haliKalemleri: kk
      .filter((k: any) => k.siparis_id === s.id)
      .map((k: any) => ({ turId: k.tur_id, adet: k.adet, m2: Number(k.m2) })),
  }));
}

async function dbKaydet(
  form: any,
  editId: string | null,
  ht: HaliTuru[]
): Promise<string> {
  const id = editId || `SP-${String(Date.now()).slice(-6)}`;
  if (editId) {
    await sbFetch(`siparisler?id=eq.${editId}`, {
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
    await sbFetch(`hali_kalemleri?siparis_id=eq.${editId}`, {
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
          siparis_id: editId || id,
          tur_id: k.turId,
          adet: k.adet,
          m2: k.m2,
          tutar: (ht.find((t) => t.id === k.turId)?.birimFiyat || 0) * k.m2,
        }))
      ),
    });
  }
  return id;
}

async function dbDurum(id: string, durum: string) {
  await sbFetch(`siparisler?id=eq.${id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ durum }),
  });
}
async function dbSms(id: string, sd: Record<string, boolean>) {
  await sbFetch(`siparisler?id=eq.${id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ sms_durum: sd }),
  });
}
async function dbSmsLog(sid: string, tel: string, msg: string, durum: string) {
  await sbFetch("sms_log", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      siparis_id: sid,
      telefon: tel,
      mesaj: msg,
      durum_adi: durum,
    }),
  });
}

// ─── KÜÇÜk BİLEŞENLER ────────────────────────────────────────────────────────
function StatusBadge({ durum }: { durum: string }) {
  const c = STATUS_CONFIG[durum] || STATUS_CONFIG.bekliyor;
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap" as any,
      }}
    >
      {c.icon} {c.label}
    </span>
  );
}

function Toast({ msg, type }: ToastState) {
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
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        whiteSpace: "nowrap" as any,
      }}
    >
      {type === "error" ? "❌ " : "✅ "}
      {msg}
    </div>
  );
}

// ─── HALI YÖNETİM ────────────────────────────────────────────────────────────
function HaliModal({
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
  ];
  const guncelle = (i: number, f: string, v: any) => {
    const k = [...liste];
    k[i] = { ...k[i], [f]: f === "birimFiyat" ? +v : v };
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
    boxSizing: "border-box",
  };
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "20px 16px 32px",
          width: "100%",
          maxWidth: 600,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e: any) => e.stopPropagation()}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "#E5E7EB",
            borderRadius: 4,
            margin: "0 auto 20px",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            🪄 Halı Türleri
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
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {liste.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr 80px 32px",
                gap: 6,
                alignItems: "center",
              }}
            >
              <select
                style={{
                  ...inp,
                  padding: "4px",
                  fontSize: 18,
                  textAlign: "center" as any,
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
                style={{ ...inp, width: "100%" }}
                value={t.ad}
                onChange={(e: any) => guncelle(i, "ad", e.target.value)}
              />
              <input
                style={{ ...inp, textAlign: "center" as any }}
                type="number"
                value={t.birimFiyat}
                onChange={(e: any) => guncelle(i, "birimFiyat", e.target.value)}
                placeholder="₺/m²"
              />
              <button
                onClick={() => setListe(liste.filter((_, idx) => idx !== i))}
                style={{
                  background: "#FEE2E2",
                  border: "none",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  color: "#DC2626",
                  fontSize: 16,
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
            padding: 12,
            border: "1.5px dashed #CBD5E1",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#6B7280",
              marginBottom: 8,
              textTransform: "uppercase" as any,
            }}
          >
            Yeni Tür Ekle
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "36px 1fr 80px auto",
              gap: 6,
              alignItems: "center",
            }}
          >
            <select
              style={{
                ...inp,
                padding: "4px",
                fontSize: 18,
                textAlign: "center" as any,
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
              style={{ ...inp, width: "100%" }}
              value={yeni.ad}
              onChange={(e: any) => setYeni({ ...yeni, ad: e.target.value })}
              placeholder="Tür adı"
            />
            <input
              style={{ ...inp, textAlign: "center" as any }}
              type="number"
              value={yeni.birimFiyat}
              onChange={(e: any) =>
                setYeni({ ...yeni, birimFiyat: e.target.value })
              }
              placeholder="₺/m²"
            />
            <button
              onClick={ekle}
              style={{
                background: "#DBEAFE",
                color: "#1D4ED8",
                border: "none",
                borderRadius: 8,
                padding: "8px 10px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              + Ekle
            </button>
          </div>
        </div>
        <button
          onClick={() => onSave(liste)}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg,#1E40AF,#3B82F6)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 16,
            fontFamily: "inherit",
          }}
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}

// ─── SMS MODALI ───────────────────────────────────────────────────────────────
function SmsModal({
  order,
  ht,
  onClose,
  onSend,
}: {
  order: Siparis;
  ht: HaliTuru[];
  onClose: () => void;
  onSend: (s: string, m: string) => Promise<void>;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const txt = sel ? smsMesaji(sel, order, ht) : "";
  const handleSend = async () => {
    if (!sel) return;
    setSending(true);
    await onSend(sel, txt);
    onClose();
  };
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "20px 16px 32px",
          width: "100%",
          maxWidth: 600,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e: any) => e.stopPropagation()}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "#E5E7EB",
            borderRadius: 4,
            margin: "0 auto 20px",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
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
            padding: "10px 12px",
            marginBottom: 12,
            fontSize: 13,
            color: "#374151",
          }}
        >
          <strong>{order.musteri}</strong> · {order.telefon}
        </div>
        <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          {Object.keys(STATUS_CONFIG)
            .filter((s) => s !== "bekliyor")
            .map((s) => {
              const cfg = STATUS_CONFIG[s];
              const gone = order.smsDurum?.[s];
              const aktif = sel === s;
              return (
                <button
                  key={s}
                  onClick={() => !gone && setSel(s)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: `1.5px solid ${aktif ? cfg.color : "#E5E7EB"}`,
                    background: aktif ? cfg.bg : gone ? "#F9FAFB" : "#fff",
                    cursor: gone ? "not-allowed" : "pointer",
                    opacity: gone ? 0.5 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: aktif ? cfg.color : "#374151",
                    }}
                  >
                    {cfg.icon} {cfg.label}
                  </span>
                  {gone && (
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
        {txt && (
          <div
            style={{
              background: "#F0FDF4",
              border: "1.5px solid #BBF7D0",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
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
                lineHeight: 1.6,
                whiteSpace: "pre-line" as any,
              }}
            >
              {txt}
            </div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
              {txt.length} karakter
            </div>
          </div>
        )}
        <button
          onClick={handleSend}
          disabled={!sel || sending}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: sel
              ? "linear-gradient(135deg,#065F46,#059669)"
              : "#E5E7EB",
            color: sel ? "#fff" : "#9CA3AF",
            cursor: sel ? "pointer" : "not-allowed",
            fontWeight: 800,
            fontSize: 16,
            fontFamily: "inherit",
          }}
        >
          {sending ? "Kaydediliyor..." : "📤 Gönder"}
        </button>
      </div>
    </div>
  );
}

// ─── SİPARİŞ DETAY (BOTTOM SHEET) ────────────────────────────────────────────
function DetailSheet({
  order,
  ht,
  onClose,
  onStatusChange,
  onEdit,
  onSmsOpen,
}: {
  order: Siparis | null;
  ht: HaliTuru[];
  onClose: () => void;
  onStatusChange: (id: string, s: string) => void;
  onEdit: (o: Siparis) => void;
  onSmsOpen: (o: Siparis) => void;
}) {
  if (!order) return null;
  const keys = Object.keys(STATUS_CONFIG);
  const idx = keys.indexOf(order.durum);
  const smsSayisi = Object.values(order.smsDurum || {}).filter(Boolean).length;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 800,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "20px 16px 32px",
          width: "100%",
          maxWidth: 600,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e: any) => e.stopPropagation()}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "#E5E7EB",
            borderRadius: 4,
            margin: "0 auto 16px",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>
              {order.id}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#111",
                margin: "2px 0 6px",
              }}
            >
              {order.musteri}
            </div>
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

        {/* Süreç */}
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
          }}
        >
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              overflowX: "auto" as any,
              paddingBottom: 4,
            }}
          >
            {keys.map((s, i) => {
              const cfg = STATUS_CONFIG[s];
              const done = i <= idx;
              const cur = i === idx;
              return (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: done ? cfg.color : "#E5E7EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: done ? "#fff" : "#9CA3AF",
                        fontWeight: 700,
                        boxShadow: cur ? `0 0 0 3px ${cfg.bg}` : "none",
                      }}
                    >
                      {done ? (cur ? cfg.icon : "✓") : ""}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: done ? "#374151" : "#9CA3AF",
                        fontWeight: cur ? 700 : 500,
                        textAlign: "center" as any,
                        maxWidth: 48,
                      }}
                    >
                      {cfg.label}
                    </div>
                    {order.smsDurum?.[s] && (
                      <div
                        style={{
                          fontSize: 8,
                          background: "#D1FAE5",
                          color: "#065F46",
                          padding: "1px 4px",
                          borderRadius: 4,
                          fontWeight: 700,
                        }}
                      >
                        SMS
                      </div>
                    )}
                  </div>
                  {i < keys.length - 1 && (
                    <div
                      style={{
                        width: 16,
                        height: 2,
                        background: i < idx ? cfg.color : "#E5E7EB",
                        flexShrink: 0,
                        marginBottom: 16,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Halı kalemleri */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#6B7280",
              marginBottom: 8,
            }}
          >
            HALI KALEMLERİ
          </div>
          {(order.haliKalemleri || []).map((k, i) => {
            const tur = ht.find((t) => t.id === k.turId);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: "#F8FAFC",
                  borderRadius: 10,
                  border: "1px solid #E5E7EB",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 14, color: "#374151" }}>
                  {tur?.icon} {tur?.ad || k.turId}
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>
                    {k.adet}ad · {k.m2}m²
                  </span>
                  <span
                    style={{ fontWeight: 800, fontSize: 14, color: "#059669" }}
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
              {toplamAdet(order.haliKalemleri || [])} halı ·{" "}
              {toplamM2(order.haliKalemleri || [])} m²
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#1E40AF" }}>
              ₺{order.fiyat?.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Bilgiler */}
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 12,
            padding: 12,
            marginBottom: 14,
          }}
        >
          {[
            ["📞", order.telefon],
            ["📍", order.adres],
            ["🗓", order.tarih],
          ].map(([ic, v]) => (
            <div
              key={ic}
              style={{
                display: "flex",
                gap: 10,
                padding: "6px 0",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <span style={{ fontSize: 14 }}>{ic}</span>
              <span style={{ fontSize: 13, color: "#374151" }}>{v}</span>
            </div>
          ))}
          {order.notlar && (
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: "#78350F",
                background: "#FFFBEB",
                padding: 10,
                borderRadius: 8,
              }}
            >
              📝 {order.notlar}
            </div>
          )}
        </div>

        {/* Aksiyonlar */}
        <div style={{ display: "grid", gap: 8 }}>
          <button
            onClick={() => onSmsOpen(order)}
            style={{
              padding: "14px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg,#065F46,#059669)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 15,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            📱 SMS Gönder{" "}
            {smsSayisi > 0 && (
              <span
                style={{
                  background: "rgba(255,255,255,0.25)",
                  borderRadius: 20,
                  padding: "1px 10px",
                  fontSize: 12,
                }}
              >
                {smsSayisi}
              </span>
            )}
          </button>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: idx > 0 ? "1fr 1fr" : "1fr",
              gap: 8,
            }}
          >
            {idx > 0 && (
              <button
                onClick={() => onStatusChange(order.id, keys[idx - 1])}
                style={{
                  padding: "12px",
                  borderRadius: 12,
                  border: "1.5px solid #E5E7EB",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              >
                ← Geri Al
              </button>
            )}
            {idx < keys.length - 1 && (
              <button
                onClick={() => onStatusChange(order.id, keys[idx + 1])}
                style={{
                  padding: "12px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg,#059669,#10B981)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              >
                Sonraki →
              </button>
            )}
          </div>
          <button
            onClick={() => onEdit(order)}
            style={{
              padding: "12px",
              borderRadius: 12,
              border: "1.5px solid #DBEAFE",
              background: "#EFF6FF",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              color: "#1D4ED8",
              fontFamily: "inherit",
            }}
          >
            ✏️ Düzenle
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SİPARİŞ FORMU ───────────────────────────────────────────────────────────
function OrderModal({
  order,
  ht,
  onClose,
  onSave,
}: {
  order: Siparis | null;
  ht: HaliTuru[];
  onClose: () => void;
  onSave: (f: any) => Promise<void>;
}) {
  const emptyK = (): HaliKalemi => ({
    turId: ht[0]?.id || "klasik",
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
            : [emptyK()],
        }
      : {
          musteri: "",
          telefon: "",
          adres: "",
          durum: "bekliyor",
          notlar: "",
          haliKalemleri: [emptyK()],
        }
  );
  const [saving, setSaving] = useState(false);
  const fiyat = hesaplaFiyat(form.haliKalemleri, ht);
  const upK = (i: number, f: string, v: any) => {
    const k = [...form.haliKalemleri];
    k[i] = { ...k[i], [f]: f === "m2" || f === "adet" ? +v : v };
    setForm({ ...form, haliKalemleri: k });
  };
  const submit = async () => {
    if (!form.musteri || !form.telefon) {
      alert("Ad ve telefon zorunlu");
      return;
    }
    setSaving(true);
    await onSave({ ...form, fiyat });
    setSaving(false);
  };
  const inp: any = {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "1.5px solid #E5E7EB",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    background: "#FAFAFA",
  };
  const lbl: any = {
    fontSize: 11,
    fontWeight: 700,
    color: "#6B7280",
    marginBottom: 6,
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "20px 16px 32px",
          width: "100%",
          maxWidth: 600,
          maxHeight: "92vh",
          overflowY: "auto",
        }}
        onClick={(e: any) => e.stopPropagation()}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "#E5E7EB",
            borderRadius: 4,
            margin: "0 auto 16px",
          }}
        />
        <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800 }}>
          {order ? "✏️ Düzenle" : "➕ Yeni Sipariş"}
        </h2>

        <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
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
          <div>
            <label style={lbl}>Adres</label>
            <input
              style={inp}
              value={form.adres}
              onChange={(e: any) => setForm({ ...form, adres: e.target.value })}
              placeholder="Mahalle, İlçe"
            />
          </div>
        </div>

        {/* Halı kalemleri */}
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
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
            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
              🪄 Halı Kalemleri
            </span>
            <button
              onClick={() =>
                setForm({
                  ...form,
                  haliKalemleri: [...form.haliKalemleri, emptyK()],
                })
              }
              style={{
                background: "#DBEAFE",
                color: "#1D4ED8",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              + Ekle
            </button>
          </div>
          {form.haliKalemleri.map((k: HaliKalemi, i: number) => {
            const tur = ht.find((t) => t.id === k.turId);
            const sf = tur ? tur.birimFiyat * k.m2 : 0;
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <select
                  style={{ ...inp, marginBottom: 6 }}
                  value={k.turId}
                  onChange={(e: any) => upK(i, "turId", e.target.value)}
                >
                  {ht.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon} {t.ad} — ₺{t.birimFiyat}/m²
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    style={{ ...inp }}
                    type="number"
                    min={1}
                    value={k.adet}
                    onChange={(e: any) => upK(i, "adet", e.target.value)}
                    placeholder="Adet"
                  />
                  <input
                    style={{ ...inp }}
                    type="number"
                    min={0}
                    step={0.5}
                    value={k.m2}
                    onChange={(e: any) => upK(i, "m2", e.target.value)}
                    placeholder="m²"
                  />
                  <div style={{ textAlign: "center" as any }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: sf > 0 ? "#059669" : "#CBD5E1",
                      }}
                    >
                      {sf > 0 ? `₺${sf}` : "—"}
                    </div>
                    <button
                      onClick={() => {
                        if (form.haliKalemleri.length > 1)
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
                        borderRadius: 6,
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "#DC2626",
                        marginTop: 4,
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: 10,
              borderTop: "2px dashed #E5E7EB",
            }}
          >
            <span style={{ fontSize: 13, color: "#6B7280" }}>
              {toplamAdet(form.haliKalemleri)} adet ·{" "}
              {toplamM2(form.haliKalemleri)} m²
            </span>
            <span style={{ fontWeight: 800, fontSize: 16, color: "#1E40AF" }}>
              ₺{fiyat.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
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
              style={{ ...inp, minHeight: 80, resize: "vertical" as any }}
              value={form.notlar}
              onChange={(e: any) =>
                setForm({ ...form, notlar: e.target.value })
              }
              placeholder="Özel istekler..."
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={saving}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: 12,
            border: "none",
            background: saving
              ? "#93C5FD"
              : "linear-gradient(135deg,#1E40AF,#3B82F6)",
            color: "#fff",
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 800,
            fontSize: 16,
            fontFamily: "inherit",
          }}
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </div>
  );
}

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────
export default function App() {
  const [orders, setOrders] = useState<Siparis[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<Siparis | null>(null);
  const [filterStatus, setFilterStatus] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [showOrder, setShowOrder] = useState(false);
  const [editing, setEditing] = useState<Siparis | null>(null);
  const [smsOrder, setSmsOrder] = useState<Siparis | null>(null);
  const [activeTab, setActiveTab] = useState("siparisler");
  const [showHali, setShowHali] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    msg: null,
    type: "success",
  });
  const [ht, setHt] = useState<HaliTuru[]>(() => {
    try {
      const s = localStorage.getItem("t360_ht");
      return s ? JSON.parse(s) : VARSAYILAN_HALI_TURLERI;
    } catch {
      return VARSAYILAN_HALI_TURLERI;
    }
  });

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: null, type: "success" }), 3000);
  };

  const yukle = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      setOrders(await dbGetir());
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const filtered = orders.filter((o) => {
    const ms = filterStatus === "Tümü" || o.durum === filterStatus;
    const q = search.toLowerCase();
    return (
      ms &&
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
    ciro: orders
      .filter((o) => o.durum !== "teslim_edildi")
      .reduce((s, o) => s + (o.fiyat || 0), 0),
  };

  const handleSave = async (form: any) => {
    try {
      await dbKaydet(form, editing?.id || null, ht);
      showToast(editing ? "Güncellendi" : "Sipariş oluşturuldu");
      await yukle();
      setShowOrder(false);
      setEditing(null);
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleStatus = async (id: string, ns: string) => {
    try {
      await dbDurum(id, ns);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, durum: ns } : o))
      );
      setSel((prev) => (prev?.id === id ? { ...prev, durum: ns } : prev));
      showToast(`${STATUS_CONFIG[ns].icon} ${STATUS_CONFIG[ns].label}`);
    } catch {
      showToast("Hata", "error");
    }
  };

  const handleSms = async (sk: string, msg: string) => {
    if (!smsOrder) return;
    try {
      const o = orders.find((x) => x.id === smsOrder.id);
      if (!o) return;
      const nd = { ...o.smsDurum, [sk]: true };
      await dbSms(smsOrder.id, nd);
      await dbSmsLog(smsOrder.id, smsOrder.telefon, msg, sk);
      setOrders((prev) =>
        prev.map((o) => (o.id === smsOrder.id ? { ...o, smsDurum: nd } : o))
      );
      setSel((prev) =>
        prev?.id === smsOrder.id ? { ...prev, smsDurum: nd } : prev
      );
      showToast("SMS logu kaydedildi");
    } catch {
      showToast("Hata", "error");
    }
  };

  const handleHaliKaydet = (liste: HaliTuru[]) => {
    setHt(liste);
    try {
      localStorage.setItem("t360_ht", JSON.stringify(liste));
    } catch {}
    setShowHali(false);
    showToast("Halı türleri güncellendi");
  };

  // Aktif filtre sayısı
  const aktifFiltre = filterStatus !== "Tümü" ? 1 : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F1F5F9",
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
        maxWidth: "100vw",
        overflowX: "hidden",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        @media (min-width: 768px) {
          .stat-grid { grid-template-columns: repeat(5, 1fr) !important; }
          .order-card { display: none !important; }
          .order-table { display: block !important; }
        }
        @media (max-width: 767px) {
          .order-card { display: block !important; }
          .order-table { display: none !important; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .header-tabs { display: none !important; }
          .bottom-nav { display: flex !important; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div
        style={{
          background: "linear-gradient(135deg,#0F172A,#0F3460)",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 60,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg,#06B6D4,#3B82F6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            🧹
          </div>
          <div>
            <div
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              Temiz360
            </div>
            <div style={{ color: "#475569", fontSize: 10 }}>Yönetim Paneli</div>
          </div>
        </div>

        {/* Masaüstü sekmeler */}
        <div
          className="header-tabs"
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 4,
            display: "flex",
          }}
        >
          {[
            ["siparisler", "📋 Siparişler"],
            ["fiyatlar", "🏷️ Fiyat Listesi"],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setActiveTab(k)}
              style={{
                padding: "7px 16px",
                borderRadius: 10,
                border: "none",
                background: activeTab === k ? "#fff" : "transparent",
                color: activeTab === k ? "#1E40AF" : "#94A3B8",
                fontWeight: activeTab === k ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {l}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={yukle}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#94A3B8",
              border: "none",
              borderRadius: 8,
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ⟳
          </button>
          <button
            onClick={() => setShowHali(true)}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#94A3B8",
              border: "none",
              borderRadius: 8,
              padding: "0 10px",
              height: 34,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
              whiteSpace: "nowrap" as any,
            }}
          >
            🪄
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setShowOrder(true);
            }}
            style={{
              background: "linear-gradient(135deg,#06B6D4,#3B82F6)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0 12px",
              height: 34,
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

      {err && (
        <div
          style={{
            margin: "12px 16px",
            padding: "12px 16px",
            background: "#FEE2E2",
            borderRadius: 12,
            color: "#DC2626",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ❌ {err}{" "}
          <button
            onClick={yukle}
            style={{
              marginLeft: 8,
              background: "#DC2626",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "3px 10px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Tekrar
          </button>
        </div>
      )}

      {/* ── FİYAT LİSTESİ ── */}
      {activeTab === "fiyatlar" && (
        <div style={{ padding: 16, paddingBottom: 80 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: "#0F172A",
              }}
            >
              Halı Fiyatları
            </h2>
            <button
              onClick={() => setShowHali(true)}
              style={{
                background: "#EFF6FF",
                color: "#1D4ED8",
                border: "1.5px solid #BFDBFE",
                borderRadius: 10,
                padding: "8px 14px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              ✏️ Düzenle
            </button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {ht.map((t) => (
              <div
                key={t.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "14px 16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "#F1F5F9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                    }}
                  >
                    {t.icon}
                  </div>
                  <div
                    style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}
                  >
                    {t.ad}
                  </div>
                </div>
                <div
                  style={{
                    background: "#EFF6FF",
                    borderRadius: 10,
                    padding: "6px 14px",
                    textAlign: "center" as any,
                  }}
                >
                  <div
                    style={{ fontSize: 18, fontWeight: 800, color: "#1E40AF" }}
                  >
                    ₺{t.birimFiyat}
                  </div>
                  <div
                    style={{ fontSize: 10, color: "#3B82F6", fontWeight: 700 }}
                  >
                    /m²
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SİPARİŞLER ── */}
      {activeTab === "siparisler" && (
        <div style={{ padding: 16, paddingBottom: 90 }}>
          {/* Stats - mobilde 2 sütun, masaüstünde 5 */}
          <div
            className="stat-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,1fr)",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {[
              {
                label: "Toplam",
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
                label: "Hazır",
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
                value: loading ? "…" : `₺${stats.ciro.toLocaleString()}`,
                icon: "💰",
                color: "#8B5CF6",
                bg: "#EDE9FE",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "12px 14px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
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
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#0F172A",
                      lineHeight: 1,
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Arama & Filtre */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              placeholder="🔍 Ara..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 12,
                border: "1.5px solid #E5E7EB",
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
                background: "#fff",
              }}
            />
            <button
              onClick={() => setShowFilter(!showFilter)}
              style={{
                background: aktifFiltre > 0 ? "#DBEAFE" : "#fff",
                border: `1.5px solid ${
                  aktifFiltre > 0 ? "#3B82F6" : "#E5E7EB"
                }`,
                borderRadius: 12,
                padding: "0 14px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                color: aktifFiltre > 0 ? "#1D4ED8" : "#374151",
                fontFamily: "inherit",
                position: "relative" as any,
                flexShrink: 0,
              }}
            >
              🔽 Filtre{" "}
              {aktifFiltre > 0 && (
                <span
                  style={{
                    background: "#3B82F6",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "1px 6px",
                    fontSize: 11,
                    marginLeft: 4,
                  }}
                >
                  {aktifFiltre}
                </span>
              )}
            </button>
          </div>

          {/* Filtre butonları */}
          {showFilter && (
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap" as any,
                marginBottom: 12,
                padding: "12px 14px",
                background: "#fff",
                borderRadius: 12,
                border: "1.5px solid #E5E7EB",
              }}
            >
              {STATUSLAR.map((s) => {
                const cfg = s !== "Tümü" ? STATUS_CONFIG[s] : null;
                const active = filterStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setFilterStatus(s);
                      setShowFilter(false);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 20,
                      border: "1.5px solid",
                      borderColor: active ? cfg?.color || "#1E40AF" : "#E5E7EB",
                      background: active ? cfg?.bg || "#DBEAFE" : "#fff",
                      color: active ? cfg?.color || "#1E40AF" : "#6B7280",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  >
                    {cfg ? `${cfg.icon} ${cfg.label}` : "Tümü"}
                  </button>
                );
              })}
            </div>
          )}

          {/* Mobil kart listesi */}
          <div className="order-card">
            {loading ? (
              <div style={{ padding: 40, textAlign: "center" as any }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    border: "3px solid #E5E7EB",
                    borderTop: "3px solid #3B82F6",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 10px",
                  }}
                />
                <div style={{ color: "#6B7280", fontSize: 14 }}>
                  Yükleniyor...
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center" as any,
                  color: "#9CA3AF",
                  fontSize: 14,
                }}
              >
                {orders.length === 0
                  ? "Henüz sipariş yok.\n+ Ekle butonuna tıklayın."
                  : "Sonuç bulunamadı."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filtered.map((order) => {
                  const smsSayisi = Object.values(order.smsDurum || {}).filter(
                    Boolean
                  ).length;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSel(order)}
                      style={{
                        background: "#fff",
                        borderRadius: 14,
                        padding: "14px 16px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        cursor: "pointer",
                        border:
                          sel?.id === order.id
                            ? "2px solid #3B82F6"
                            : "2px solid transparent",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 8,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 16,
                              color: "#0F172A",
                            }}
                          >
                            {order.musteri}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#9CA3AF",
                              marginTop: 2,
                            }}
                          >
                            {order.id} · {order.telefon}
                          </div>
                        </div>
                        <StatusBadge durum={order.durum} />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap" as any,
                          gap: 4,
                          marginBottom: 8,
                        }}
                      >
                        {(order.haliKalemleri || []).map((k, i) => {
                          const tur = ht.find((t) => t.id === k.turId);
                          return (
                            <span
                              key={i}
                              style={{
                                fontSize: 12,
                                background: "#F1F5F9",
                                color: "#374151",
                                padding: "3px 8px",
                                borderRadius: 6,
                                fontWeight: 500,
                              }}
                            >
                              {tur?.icon} {tur?.ad} · {k.m2}m²
                            </span>
                          );
                        })}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 16,
                            color: "#059669",
                          }}
                        >
                          ₺{order.fiyat?.toLocaleString()}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                          }}
                        >
                          {smsSayisi > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                background: "#D1FAE5",
                                color: "#065F46",
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontWeight: 700,
                              }}
                            >
                              📱{smsSayisi}
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                            {order.tarih}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Masaüstü tablo */}
          <div
            className="order-table"
            style={{
              display: "none",
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
              </div>
            ) : (
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
                          padding: 40,
                          textAlign: "center" as any,
                          color: "#9CA3AF",
                        }}
                      >
                        {orders.length === 0
                          ? "Henüz sipariş yok."
                          : "Sonuç bulunamadı."}
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
                          onClick={() => setSel(order)}
                          style={{
                            borderBottom: "1px solid #F1F5F9",
                            cursor: "pointer",
                            background:
                              sel?.id === order.id
                                ? "#EFF6FF"
                                : i % 2 === 0
                                ? "#fff"
                                : "#FAFAFA",
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
                            <div style={{ fontWeight: 600, color: "#0F172A" }}>
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
                                const tur = ht.find((t) => t.id === k.turId);
                                return (
                                  <span
                                    key={ki}
                                    style={{
                                      fontSize: 11,
                                      background: "#F1F5F9",
                                      color: "#374151",
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                    }}
                                  >
                                    {tur?.icon} {tur?.ad} · {k.m2}m²
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ fontWeight: 800, color: "#059669" }}>
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
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  fontWeight: 700,
                                }}
                              >
                                📱{smsSayisi}
                              </span>
                            ) : (
                              <span style={{ color: "#CBD5E1" }}>—</span>
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
                                setEditing(order);
                                setShowOrder(true);
                              }}
                              style={{
                                background: "#F1F5F9",
                                border: "none",
                                borderRadius: 8,
                                padding: "5px 12px",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
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
            )}
            {!loading && filtered.length > 0 && (
              <div
                style={{
                  padding: "10px 16px",
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

      {/* ── ALT NAVİGASYON (sadece mobil) ── */}
      <div
        className="bottom-nav"
        style={{
          display: "none",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#fff",
          borderTop: "1px solid #E5E7EB",
          padding: "8px 0 16px",
          justifyContent: "space-around",
          zIndex: 100,
        }}
      >
        {[
          ["siparisler", "📋", "Siparişler"],
          ["fiyatlar", "🏷️", "Fiyatlar"],
        ].map(([k, ic, l]) => (
          <button
            key={k}
            onClick={() => setActiveTab(k)}
            style={{
              display: "flex",
              flexDirection: "column" as any,
              alignItems: "center",
              gap: 2,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              flex: 1,
            }}
          >
            <span style={{ fontSize: 22 }}>{ic}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: activeTab === k ? 700 : 500,
                color: activeTab === k ? "#1E40AF" : "#94A3B8",
              }}
            >
              {l}
            </span>
          </button>
        ))}
        <button
          onClick={() => {
            setEditing(null);
            setShowOrder(true);
          }}
          style={{
            display: "flex",
            flexDirection: "column" as any,
            alignItems: "center",
            gap: 2,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            flex: 1,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#06B6D4,#3B82F6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              marginTop: -20,
              boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
            }}
          >
            ➕
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "#94A3B8",
              marginTop: 2,
            }}
          >
            Ekle
          </span>
        </button>
        <button
          onClick={() => setShowFilter(!showFilter)}
          style={{
            display: "flex",
            flexDirection: "column" as any,
            alignItems: "center",
            gap: 2,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            flex: 1,
          }}
        >
          <span style={{ fontSize: 22 }}>{aktifFiltre > 0 ? "🔵" : "🔽"}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: aktifFiltre > 0 ? "#1E40AF" : "#94A3B8",
            }}
          >
            Filtre
          </span>
        </button>
        <button
          onClick={() => setShowHali(true)}
          style={{
            display: "flex",
            flexDirection: "column" as any,
            alignItems: "center",
            gap: 2,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            flex: 1,
          }}
        >
          <span style={{ fontSize: 22 }}>🪄</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8" }}>
            Halı
          </span>
        </button>
      </div>

      {/* Modallar */}
      {sel && (
        <DetailSheet
          order={orders.find((o) => o.id === sel.id) || null}
          ht={ht}
          onClose={() => setSel(null)}
          onStatusChange={handleStatus}
          onEdit={(o) => {
            setEditing(o);
            setShowOrder(true);
            setSel(null);
          }}
          onSmsOpen={(o) => {
            setSmsOrder(o);
            setSel(null);
          }}
        />
      )}
      {showOrder && (
        <OrderModal
          order={editing}
          ht={ht}
          onClose={() => {
            setShowOrder(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
      {smsOrder && (
        <SmsModal
          order={smsOrder}
          ht={ht}
          onClose={() => setSmsOrder(null)}
          onSend={handleSms}
        />
      )}
      {showHali && (
        <HaliModal
          turler={ht}
          onClose={() => setShowHali(false)}
          onSave={handleHaliKaydet}
        />
      )}
      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}
