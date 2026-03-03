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
  firmaId?: string;
  firmaAd?: string;
}
interface Firma {
  id: string;
  ad: string;
  email: string;
  aktif: boolean;
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
interface AuthUser {
  id: string;
  email: string;
  token: string;
}

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://nubrhlnxrajuebphahrp.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51YnJobG54cmFqdWVicGhhaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjM3MzcsImV4cCI6MjA4NzkzOTczN30.tf-fBN-a-xS08lES5cJ7RUY2DKrUVSalgH_wHxFjs5Y";
const ADMIN_EMAIL = "cemayaz1981@gmail.com";

async function sbFetch(
  path: string,
  options: any = {},
  token?: string
): Promise<any> {
  const authToken = token || options.token || SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function authLogin(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error_description || data.msg || "Giriş başarısız");
  return { id: data.user.id, email: data.user.email, token: data.access_token };
}

async function authSetPassword(
  accessToken: string,
  password: string
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.msg || "Şifre belirlenemedi");
  }
}

async function authLogout(token: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
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

const VARSAYILAN_HT: HaliTuru[] = [
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
function smsMesaji(durum: string, order: Siparis, ht: HaliTuru[]): string {
  const tl = (order.haliKalemleri || [])
    .map((k: HaliKalemi) => {
      const t = ht.find((x) => x.id === k.turId);
      return `${t?.ad || k.turId} (${k.m2}m²)`;
    })
    .join(", ");
  const m: Record<string, string> = {
    toplandı: `Sayın ${order.musteri}, halılarınız teslim alındı.\nSipariş No: ${order.id}\nHalılar: ${tl}\nTutar: ₺${order.fiyat}\nHalıPro`,
    yıkamada: `Sayın ${order.musteri}, halılarınız yıkamaya alındı.\nSipariş No: ${order.id}\nHalılar: ${tl}\nHalıPro`,
    kurutuluyor: `Sayın ${order.musteri}, halılarınız kurutuluyor.\nSipariş No: ${order.id}\nHalıPro`,
    hazır: `Sayın ${order.musteri}, halılarınız HAZIR! 🎉\nSipariş No: ${order.id}\nHalılar: ${tl}\nÖdenecek: ₺${order.fiyat}\nHalıPro`,
    dağıtımda: `Sayın ${order.musteri}, halılarınız yola çıktı! 🏍️\nSipariş No: ${order.id}\nÖdenecek: ₺${order.fiyat}\nHalıPro`,
    teslim_edildi: `Sayın ${order.musteri}, halılarınız teslim edildi. ✅\nToplam: ₺${order.fiyat}\nHalıPro'yu tercih ettiğiniz için teşekkürler!`,
  };
  return m[durum] || "";
}

const hesaplaFiyat = (k: HaliKalemi[], t: HaliTuru[]) =>
  k.reduce(
    (s, x) =>
      s +
      (t.find((r) => r.id === x.turId)?.birimFiyat || 0) * x.m2 * (x.adet || 1),
    0
  );
const toplamM2 = (k: HaliKalemi[]) =>
  k.reduce((s, x) => s + (x.m2 || 0) * (x.adet || 1), 0);
const toplamAdet = (k: HaliKalemi[]) =>
  k.reduce((s, x) => s + (x.adet || 0), 0);
// ─── DB ──────────────────────────────────────────────────────────────────────
async function dbGetir(token: string, isAdmin: boolean): Promise<Siparis[]> {
  const query = isAdmin
    ? "siparisler?select=*,firmalar(ad)&order=olusturuldu.desc"
    : "siparisler?select=*&order=olusturuldu.desc";
  const [ss, kk] = await Promise.all([
    sbFetch(query, {}, token),
    sbFetch("hali_kalemleri?select=*", {}, token),
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
    firmaId: s.firma_id,
    firmaAd: s.firmalar?.ad || "",
    haliKalemleri: kk
      .filter((k: any) => k.siparis_id === s.id)
      .map((k: any) => ({ turId: k.tur_id, adet: k.adet, m2: Number(k.m2) })),
  }));
}

async function dbFirmalariGetir(token: string): Promise<Firma[]> {
  return await sbFetch("firmalar?select=*&order=olusturuldu.desc", {}, token);
}

async function dbFirmaEkle(
  token: string,
  ad: string,
  email: string
): Promise<void> {
  await sbFetch(
    "firmalar",
    { method: "POST", body: JSON.stringify({ ad, email, aktif: true }) },
    token
  );
}

async function dbKaydet(
  form: any,
  editId: string | null,
  ht: HaliTuru[],
  token: string,
  firmaId?: string
): Promise<string> {
  const id = editId || `SP-${String(Date.now()).slice(-6)}`;
  if (editId) {
    await sbFetch(
      `siparisler?id=eq.${editId}`,
      {
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
      },
      token
    );
    await sbFetch(
      `hali_kalemleri?siparis_id=eq.${editId}`,
      { method: "DELETE", prefer: "return=minimal" },
      token
    );
  } else {
    await sbFetch(
      "siparisler",
      {
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
          firma_id: firmaId || null,
        }),
      },
      token
    );
  }
  if (form.haliKalemleri?.length) {
    await sbFetch(
      "hali_kalemleri",
      {
        method: "POST",
        body: JSON.stringify(
          form.haliKalemleri.map((k: HaliKalemi) => ({
            siparis_id: editId || id,
            tur_id: k.turId,
            adet: k.adet,
            m2: k.m2,
            tutar:
              (ht.find((t) => t.id === k.turId)?.birimFiyat || 0) *
              k.m2 *
              k.adet,
          }))
        ),
      },
      token
    );
  }
  return id;
}

async function dbDurum(id: string, durum: string, token: string) {
  await sbFetch(
    `siparisler?id=eq.${id}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ durum }),
    },
    token
  );
}
async function dbSms(id: string, sd: Record<string, boolean>, token: string) {
  await sbFetch(
    `siparisler?id=eq.${id}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ sms_durum: sd }),
    },
    token
  );
}
async function dbSmsLog(
  sid: string,
  tel: string,
  msg: string,
  d: string,
  token: string
) {
  await sbFetch(
    "sms_log",
    {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({
        siparis_id: sid,
        telefon: tel,
        mesaj: msg,
        durum_adi: d,
      }),
    },
    token
  );
}

// ─── KÜÇÜK BİLEŞENLER ────────────────────────────────────────────────────────
function StatusBadge({ durum }: { durum: string }) {
  const c = STATUS_CONFIG[durum] || STATUS_CONFIG.bekliyor;
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        padding: "6px 12px",
        borderRadius: "24px",
        fontSize: "12px",
        fontWeight: 600,
        whiteSpace: "nowrap" as any,
        border: `1px solid ${c.color}40`,
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <span style={{ fontSize: "14px" }}>{c.icon}</span> {c.label}
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
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {type === "error" ? "❌ " : "✅ "}
      {msg}
    </div>
  );
}

// ─── ŞİFRE BELİRLEME EKRANI ──────────────────────────────────────────────────
function SetPasswordScreen({
  accessToken,
  onDone,
}: {
  accessToken: string;
  onDone: () => void;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    if (pw.length < 6) {
      setErr("Şifre en az 6 karakter olmalı");
      return;
    }
    if (pw !== pw2) {
      setErr("Şifreler eşleşmiyor");
      return;
    }
    setLoading(true);
    try {
      await authSetPassword(accessToken, pw);
      window.location.hash = "";
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inp: any = {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "1.5px solid #E5E7EB",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Poppins', sans-serif",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#0F172A,#0F3460)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 24,
          padding: 32,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ textAlign: "center" as any, marginBottom: 28 }}>
          <h1
            style={{
              margin: "0 0 4px",
              fontSize: 22,
              fontWeight: 800,
              color: "#0F172A",
            }}
          >
            HalıPro
          </h1>
          <p style={{ margin: 0, color: "#64748B", fontSize: 14 }}>
            Hesabınız için şifre belirleyin
          </p>
        </div>
        <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          <input
            style={inp}
            type="password"
            value={pw}
            onChange={(e: any) => setPw(e.target.value)}
            placeholder="Yeni şifre (min. 6 karakter)"
          />
          <input
            style={inp}
            type="password"
            value={pw2}
            onChange={(e: any) => setPw2(e.target.value)}
            placeholder="Şifreyi tekrar girin"
          />
        </div>
        {err && (
          <div
            style={{
              color: "#DC2626",
              fontSize: 13,
              marginBottom: 12,
              background: "#FEE2E2",
              padding: "10px 12px",
              borderRadius: 8,
            }}
          >
            {err}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg,#1E40AF,#3B82F6)",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 800,
            fontSize: 16,
            fontFamily: "inherit",
          }}
        >
          {loading ? "Kaydediliyor..." : "Şifremi Belirle →"}
        </button>
      </div>
    </div>
  );
}

// ─── GİRİŞ EKRANI ────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (u: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleLogin = async () => {
    if (!email || !pw) {
      setErr("Lütfen email ve şifrenizi girin.");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const user = await authLogin(email, pw);
      localStorage.setItem("t360_token", user.token);
      localStorage.setItem("t360_email", user.email);
      localStorage.setItem("t360_id", user.id);
      onLogin(user);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inp: any = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1.5px solid #E2E8F0",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Poppins', sans-serif",
    background: "rgba(255, 255, 255, 0.85)",
    color: "#0F172A",
    transition: "all 0.3s ease",
  };

  const labelStyle: any = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "#475569",
    marginBottom: "8px",
    letterSpacing: "0.3px",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.40), rgba(15, 23, 42, 0.70)), url('/arkaplan.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />
      <style>
        {`
          .modern-input:focus {
            border-color: #3B82F6 !important;
            background: #ffffff !important;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1) !important;
          }
          .modern-btn {
            transition: all 0.3s ease;
            background-size: 200% auto;
          }
          .modern-btn:hover:not(:disabled) {
            background-position: right center;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
          }
          .modern-btn:active:not(:disabled) {
            transform: translateY(0);
          }
        `}
      </style>

      <div
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: "24px",
          padding: "48px 36px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #ffffff 0%, #F8FAFC 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow:
                "0 10px 25px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255,255,255,1)",
              border: "1px solid #E2E8F0",
            }}
          >
            <svg
              width="44"
              height="44"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="layer-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#1E3A8A" />
                </linearGradient>
                <linearGradient
                  id="layer-cyan"
                  x1="0%"
                  y1="100%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#06B6D4" />
                  <stop offset="100%" stopColor="#2563EB" />
                </linearGradient>
              </defs>
              <path
                d="M16 4L28 10.5L16 17L4 10.5L16 4Z"
                fill="url(#layer-cyan)"
                fillOpacity="0.15"
                stroke="url(#layer-cyan)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M4 16L16 22.5L28 16"
                stroke="url(#layer-grad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 21.5L16 28L28 21.5"
                stroke="#94A3B8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="10.5" r="3" fill="url(#layer-cyan)" />
            </svg>
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "28px",
              fontWeight: 900,
              color: "#0F172A",
              letterSpacing: "-0.5px",
            }}
          >
            HalıPro{" "}
            <span style={{ color: "#3B82F6", fontSize: "28px" }}>.</span>
          </h1>
          <p
            style={{
              margin: 0,
              color: "#64748B",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            Tesis Yönetim Paneli
          </p>
        </div>

        <div style={{ display: "grid", gap: "20px", marginBottom: "28px" }}>
          <div>
            <label style={labelStyle}>Kullanıcı Adı veya Email</label>
            <input
              className="modern-input"
              style={inp}
              type="email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              placeholder="ornek@firma.com"
              onKeyDown={(e: any) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <label style={{ ...labelStyle, marginBottom: 0 }}>Şifre</label>
            </div>
            <input
              className="modern-input"
              style={inp}
              type="password"
              value={pw}
              onChange={(e: any) => setPw(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e: any) => e.key === "Enter" && handleLogin()}
            />
          </div>
        </div>

        {err && (
          <div
            style={{
              color: "#DC2626",
              fontSize: "13px",
              fontWeight: 500,
              marginBottom: "24px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              padding: "12px 16px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "18px" }}>🚨</span> {err}
          </div>
        )}

        <button
          className="modern-btn"
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "12px",
            border: "none",
            background: loading
              ? "#93C5FD"
              : "linear-gradient(to right, #1E40AF 0%, #3B82F6 51%, #1E40AF 100%)",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: "16px",
            fontFamily: "'Poppins', sans-serif",
            letterSpacing: "0.5px",
          }}
        >
          {loading ? "Giriş yapılıyor..." : "Sisteme Giriş Yap"}
        </button>
      </div>
    </div>
  );
}

// ─── FİRMA YÖNETİM MODALI (sadece admin) ─────────────────────────────────────
function FirmaModal({
  token,
  onClose,
  onSaved,
}: {
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    dbFirmalariGetir(token)
      .then(setFirmalar)
      .finally(() => setLoading(false));
  }, [token]);

  const ekle = async () => {
    if (!ad || !email) {
      setErr("Ad ve email gerekli");
      return;
    }
    setSaving(true);
    setErr("");

    try {
      // 1. ADIM: Firmayı arka planda rastgele, güçlü bir şifreyle sisteme kayıt et
      const tempPassword = "T360." + Math.random().toString(36).slice(-8) + "!";
      await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password: tempPassword }),
      });

      // 2. ADIM: Firmaya "Şifre Sıfırlama" linki gönder (Davetiye maili)
      const recoverRes = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!recoverRes.ok) {
        const errData = await recoverRes.json();
        throw new Error(`Mail reddedildi: ${errData.msg || errData.message}`);
      }

      // 3. ADIM: Firmayı kendi veritabanı tablomuza (firmalar) ekle
      await dbFirmaEkle(token, ad, email);

      // Başarılı olursa formu temizle ve listeyi yenile
      setAd("");
      setEmail("");
      const liste = await dbFirmalariGetir(token);
      setFirmalar(liste);
      onSaved();
    } catch (e: any) {
      // PostgreSQL "Duplicate Key" hatasını yakalayıp Türkçeleştiriyoruz
      if (
        e.message.includes("23505") ||
        e.message.includes("duplicate key") ||
        e.message.includes("firmalar_email_key")
      ) {
        setErr("Bu e-posta adresiyle zaten bir firma kayıtlı!");
      } else {
        setErr(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const inp: any = {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "1.5px solid #E5E7EB",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Poppins', sans-serif",
    background: "#FAFAFA",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.65)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 2000,
        fontFamily: "'Poppins', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px 32px",
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
            background: "#E2E8F0",
            borderRadius: 4,
            margin: "0 auto 16px",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            🏢 Firma Yönetimi
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "#F1F5F9",
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

        {/* Yeni firma ekle */}
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 12,
            padding: 16,
            border: "1.5px dashed #CBD5E1",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748B",
              marginBottom: 10,
              textTransform: "uppercase" as any,
            }}
          >
            Yeni Firma Ekle
          </div>
          <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
            <input
              style={inp}
              value={ad}
              onChange={(e: any) => setAd(e.target.value)}
              placeholder="Firma adı (örn: Yıldız Halı Yıkama)"
            />
            <input
              style={inp}
              type="email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              placeholder="Firma email adresi"
            />
          </div>
          {err && (
            <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>
              ❌ {err}
            </div>
          )}
          <button
            onClick={ekle}
            disabled={saving}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg,#2563EB,#3B82F6)",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "inherit",
            }}
          >
            {saving ? "Ekleniyor..." : "+ Firma Ekle & Davet Gönder"}
          </button>
        </div>

        {/* Firma listesi */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#64748B",
            marginBottom: 10,
            textTransform: "uppercase" as any,
          }}
        >
          Mevcut Firmalar
        </div>
        {loading ? (
          <div
            style={{
              textAlign: "center" as any,
              padding: 20,
              color: "#9CA3AF",
            }}
          >
            Yükleniyor...
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {firmalar.length === 0 && (
              <div
                style={{
                  textAlign: "center" as any,
                  padding: 20,
                  color: "#9CA3AF",
                  fontSize: 14,
                }}
              >
                Henüz firma yok
              </div>
            )}
            {firmalar.map((f) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px",
                  background: "#F8FAFC",
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                }}
              >
                <div>
                  <div
                    style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}
                  >
                    🏢 {f.ad}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                    {f.email}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    background: f.aktif ? "#D1FAE5" : "#F1F5F9",
                    color: f.aktif ? "#065F46" : "#64748B",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontWeight: 700,
                  }}
                >
                  {f.aktif ? "Aktif" : "Pasif"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HALI YÖNETİM MODALI ─────────────────────────────────────────────────────
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
    padding: "10px",
    borderRadius: 8,
    border: "1.5px solid #E2E8F0",
    fontSize: 14,
    fontFamily: "'Poppins', sans-serif",
    outline: "none",
    background: "#fff",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.65)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 2000,
        fontFamily: "'Poppins', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px 32px",
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
            background: "#E2E8F0",
            borderRadius: 4,
            margin: "0 auto 20px",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            🪄 Halı Türleri ve Fiyatlar
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "#F1F5F9",
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
        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          {liste.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 90px 36px",
                gap: 8,
                alignItems: "center",
              }}
            >
              <select
                style={{
                  ...inp,
                  padding: "4px",
                  fontSize: 20,
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
                  width: 36,
                  height: 36,
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
            padding: 16,
            border: "1.5px dashed #CBD5E1",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748B",
              marginBottom: 12,
              textTransform: "uppercase" as any,
            }}
          >
            Yeni Ekle
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 90px auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <select
              style={{
                ...inp,
                padding: "4px",
                fontSize: 20,
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
                background: "#EFF6FF",
                color: "#2563EB",
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
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
            padding: "16px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg,#2563EB,#3B82F6)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 16,
            fontFamily: "inherit",
          }}
        >
          Değişiklikleri Kaydet
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
        background: "rgba(15,23,42,0.65)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 2000,
        fontFamily: "'Poppins', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px 32px",
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
            background: "#E2E8F0",
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
            📱 SMS Gönder
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "#F1F5F9",
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
            borderRadius: 12,
            padding: "14px",
            marginBottom: 16,
            fontSize: 14,
            color: "#334155",
            border: "1px solid #E2E8F0",
          }}
        >
          <strong>{order.musteri}</strong> <br /> {order.telefon}
        </div>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
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
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: `1.5px solid ${aktif ? cfg.color : "#E2E8F0"}`,
                    background: aktif ? cfg.bg : gone ? "#F8FAFC" : "#fff",
                    cursor: gone ? "not-allowed" : "pointer",
                    opacity: gone ? 0.6 : 1,
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: aktif ? cfg.color : "#334155",
                    }}
                  >
                    {cfg.icon} {cfg.label}
                  </span>
                  {gone && (
                    <span
                      style={{
                        fontSize: 12,
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
              padding: "16px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#166534",
                marginBottom: 8,
                letterSpacing: "0.5px",
              }}
            >
              MESAJ ÖNİZLEME
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#15803D",
                lineHeight: 1.6,
                whiteSpace: "pre-line" as any,
              }}
            >
              {txt}
            </div>
          </div>
        )}
        <button
          onClick={handleSend}
          disabled={!sel || sending}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 12,
            border: "none",
            background: sel
              ? "linear-gradient(135deg,#059669,#10B981)"
              : "#E2E8F0",
            color: sel ? "#fff" : "#94A3B8",
            cursor: sel ? "pointer" : "not-allowed",
            fontWeight: 700,
            fontSize: 16,
            fontFamily: "inherit",
          }}
        >
          {sending ? "Gönderiliyor..." : "📤 Mesajı Gönder"}
        </button>
      </div>
    </div>
  );
}

// ─── DETAY SHEET ─────────────────────────────────────────────────────────────
function DetailSheet({
  order,
  ht,
  isAdmin,
  onClose,
  onStatusChange,
  onEdit,
  onSmsOpen,
}: {
  order: Siparis | null;
  ht: HaliTuru[];
  isAdmin: boolean;
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
        background: "rgba(15,23,42,0.65)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 800,
        fontFamily: "'Poppins', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px 32px",
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
            background: "#E2E8F0",
            borderRadius: 4,
            margin: "0 auto 20px",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
              {order.id}{" "}
              {isAdmin && order.firmaAd ? ` · 🏢 ${order.firmaAd}` : ""}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#0F172A",
                margin: "4px 0 8px",
              }}
            >
              {order.musteri}
            </div>
            <StatusBadge durum={order.durum} />
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#F1F5F9",
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
            borderRadius: 16,
            padding: "16px",
            marginBottom: 16,
            border: "1px solid #E2E8F0",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748B",
              marginBottom: 16,
              textTransform: "uppercase" as any,
            }}
          >
            İşlem Süreci
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              overflowX: "auto" as any,
              paddingBottom: 8,
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
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: done ? cfg.color : "#E2E8F0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: done ? "#fff" : "#94A3B8",
                        fontWeight: 700,
                        boxShadow: cur ? `0 0 0 4px ${cfg.bg}` : "none",
                        transition: "all 0.3s",
                      }}
                    >
                      {done ? (cur ? cfg.icon : "✓") : ""}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: done ? "#334155" : "#94A3B8",
                        fontWeight: cur ? 700 : 500,
                        textAlign: "center" as any,
                        maxWidth: 50,
                      }}
                    >
                      {cfg.label}
                    </div>
                    {order.smsDurum?.[s] && (
                      <div
                        style={{
                          fontSize: 9,
                          background: "#D1FAE5",
                          color: "#065F46",
                          padding: "2px 6px",
                          borderRadius: 6,
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
                        width: 20,
                        height: 2,
                        background: i < idx ? cfg.color : "#E2E8F0",
                        flexShrink: 0,
                        marginBottom: 24,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Kalemler */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748B",
              marginBottom: 8,
              textTransform: "uppercase" as any,
            }}
          >
            Halı Detayları
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
                  padding: "12px 16px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 500 }}>
                  {tur?.icon} {tur?.ad}
                </span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#64748B" }}>
                    {k.adet}ad · {k.m2}m²
                  </span>
                  <span
                    style={{ fontWeight: 800, color: "#059669", fontSize: 15 }}
                  >
                    ₺{tur ? tur.birimFiyat * k.m2 * k.adet : 0}
                  </span>
                </div>
              </div>
            );
          })}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "14px 16px",
              background: "#EFF6FF",
              borderRadius: 12,
              marginTop: 10,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E40AF" }}>
              {toplamAdet(order.haliKalemleri || [])} Halı ·{" "}
              {toplamM2(order.haliKalemleri || [])} m²
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#1E40AF" }}>
              ₺{order.fiyat?.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Bilgiler */}
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 16,
            padding: "16px",
            marginBottom: 20,
            border: "1px solid #E2E8F0",
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
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <span style={{ fontSize: 16 }}>{ic}</span>
              <span style={{ fontSize: 14, color: "#334155", fontWeight: 500 }}>
                {v}
              </span>
            </div>
          ))}
          {order.notlar && (
            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                color: "#78350F",
                background: "#FFFBEB",
                padding: "12px",
                borderRadius: 10,
                border: "1px solid #FEF3C7",
              }}
            >
              <strong style={{ display: "block", marginBottom: 4 }}>
                Notlar:
              </strong>{" "}
              {order.notlar}
            </div>
          )}
        </div>

        {/* Aksiyonlar */}
        <div style={{ display: "grid", gap: 10 }}>
          <button
            onClick={() => onSmsOpen(order)}
            style={{
              padding: "16px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg,#059669,#10B981)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 15,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            📱 SMS Gönder{" "}
            {smsSayisi > 0 && (
              <span
                style={{
                  background: "rgba(255,255,255,0.25)",
                  borderRadius: 20,
                  padding: "2px 10px",
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
              gap: 10,
            }}
          >
            {idx > 0 && (
              <button
                onClick={() => onStatusChange(order.id, keys[idx - 1])}
                style={{
                  padding: "14px",
                  borderRadius: 12,
                  border: "1.5px solid #E2E8F0",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  fontFamily: "inherit",
                  color: "#475569",
                }}
              >
                ← Geri Al
              </button>
            )}
            {idx < keys.length - 1 && (
              <button
                onClick={() => onStatusChange(order.id, keys[idx + 1])}
                style={{
                  padding: "14px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg,#2563EB,#3B82F6)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              >
                Sonraki Aşama →
              </button>
            )}
          </div>
          <button
            onClick={() => onEdit(order)}
            style={{
              padding: "14px",
              borderRadius: 12,
              border: "1.5px solid #BFDBFE",
              background: "#EFF6FF",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              color: "#1D4ED8",
              fontFamily: "inherit",
              marginTop: 4,
            }}
          >
            ✏️ Siparişi Düzenle
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
  firmalar,
  isAdmin,
  onClose,
  onSave,
}: {
  order: Siparis | null;
  ht: HaliTuru[];
  firmalar: Firma[];
  isAdmin: boolean;
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
          firmaId: order.firmaId || "",
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
          firmaId: "",
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
      alert("Ad ve telefon zorunludur.");
      return;
    }
    setSaving(true);
    await onSave({ ...form, fiyat });
    setSaving(false);
  };

  const inp: any = {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "1.5px solid #E2E8F0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Poppins', sans-serif",
    background: "#fff",
  };
  const lbl: any = {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748B",
    marginBottom: 8,
    display: "block",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.65)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1000,
        fontFamily: "'Poppins', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px 32px",
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
            background: "#E2E8F0",
            borderRadius: 4,
            margin: "0 auto 20px",
          }}
        />
        <h2
          style={{
            margin: "0 0 20px",
            fontSize: 22,
            fontWeight: 800,
            color: "#0F172A",
          }}
        >
          {order ? "✏️ Siparişi Düzenle" : "➕ Yeni Sipariş Oluştur"}
        </h2>

        <div style={{ display: "grid", gap: 16, marginBottom: 20 }}>
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
              placeholder="Mahalle, Cadde, Sokak..."
            />
          </div>
          {isAdmin && firmalar.length > 0 && (
            <div>
              <label style={lbl}>İlgili Firma</label>
              <select
                style={inp}
                value={form.firmaId}
                onChange={(e: any) =>
                  setForm({ ...form, firmaId: e.target.value })
                }
              >
                <option value="">— Firma seçin —</option>
                {firmalar.map((f) => (
                  <option key={f.id} value={f.id}>
                    🏢 {f.ad}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Halı kalemleri */}
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 16,
            padding: "16px",
            marginBottom: 20,
            border: "1px solid #E2E8F0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>
              🪄 Halı Detayları
            </span>
            <button
              onClick={() =>
                setForm({
                  ...form,
                  haliKalemleri: [...form.haliKalemleri, emptyK()],
                })
              }
              style={{
                background: "#EFF6FF",
                color: "#2563EB",
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
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
            const sf = tur ? tur.birimFiyat * k.m2 * k.adet : 0;
            return (
              <div
                key={i}
                style={{
                  marginBottom: 16,
                  background: "#fff",
                  padding: "12px",
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                }}
              >
                <select
                  style={{ ...inp, marginBottom: 10, padding: "10px" }}
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
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <input
                    style={{ ...inp, padding: "10px" }}
                    type="number"
                    min={1}
                    value={k.adet}
                    onChange={(e: any) => upK(i, "adet", e.target.value)}
                    placeholder="Adet"
                  />
                  <input
                    style={{ ...inp, padding: "10px" }}
                    type="number"
                    min={0}
                    step={0.5}
                    value={k.m2}
                    onChange={(e: any) => upK(i, "m2", e.target.value)}
                    placeholder="m²"
                  />
                  <div style={{ textAlign: "center" as any, padding: "0 8px" }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 15,
                        color: sf > 0 ? "#059669" : "#CBD5E1",
                        marginBottom: 4,
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
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "#DC2626",
                        fontWeight: 600,
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
              paddingTop: 12,
              borderTop: "2px dashed #E2E8F0",
            }}
          >
            <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>
              {toplamAdet(form.haliKalemleri)} adet ·{" "}
              {toplamM2(form.haliKalemleri)} m²
            </span>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#1E40AF" }}>
              ₺{fiyat.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
          <div>
            <label style={lbl}>Sipariş Durumu</label>
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
            <label style={lbl}>Notlar / Özel İstekler</label>
            <textarea
              style={{ ...inp, minHeight: 100, resize: "vertical" as any }}
              value={form.notlar}
              onChange={(e: any) =>
                setForm({ ...form, notlar: e.target.value })
              }
              placeholder="Eklemek istediğiniz notlar..."
            />
          </div>
        </div>
        <button
          onClick={submit}
          disabled={saving}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 12,
            border: "none",
            background: saving
              ? "#93C5FD"
              : "linear-gradient(135deg,#2563EB,#3B82F6)",
            color: "#fff",
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 800,
            fontSize: 16,
            fontFamily: "inherit",
          }}
        >
          {saving ? "Kaydediliyor..." : "Siparişi Kaydet"}
        </button>
      </div>
    </div>
  );
}

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState] = useState<
    "loading" | "setpassword" | "login" | "app"
  >("loading");
  const [accessToken, setAccessToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [orders, setOrders] = useState<Siparis[]>([]);
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
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
  const [toast, setToast] = useState<ToastState>({
    msg: null,
    type: "success",
  });

  const [ht, setHt] = useState<HaliTuru[]>(() => {
    try {
      const s = localStorage.getItem("t360_ht");
      return s ? JSON.parse(s) : VARSAYILAN_HT;
    } catch {
      return VARSAYILAN_HT;
    }
  });

  // Auth başlangıç kontrolü
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const token = params.get("access_token");
      const type = params.get("type");
      if (token && type === "invite") {
        setAccessToken(token);
        setAuthState("setpassword");
        return;
      }
      if (token && type === "recovery") {
        setAccessToken(token);
        setAuthState("setpassword");
        return;
      }
    }
    const savedToken = localStorage.getItem("t360_token");
    const savedEmail = localStorage.getItem("t360_email");
    const savedId = localStorage.getItem("t360_id");
    if (savedToken && savedEmail && savedId) {
      setUser({ token: savedToken, email: savedEmail, id: savedId });
      setAuthState("app");
    } else {
      setAuthState("login");
    }
  }, []);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: null, type: "success" }), 3000);
  };

  const yukle = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setErr(null);
      const [ss, ff] = await Promise.all([
        dbGetir(user.token, isAdmin),
        isAdmin ? dbFirmalariGetir(user.token) : Promise.resolve([]),
      ]);
      setOrders(ss);
      setFirmalar(ff);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (authState === "app") yukle();
  }, [authState, yukle]);

  const handleLogout = async () => {
    if (user) await authLogout(user.token).catch(() => {});
    localStorage.removeItem("t360_token");
    localStorage.removeItem("t360_email");
    localStorage.removeItem("t360_id");
    setUser(null);
    setAuthState("login");
  };

  const filtered = orders.filter((o) => {
    const ms = filterStatus === "Tümü" || o.durum === filterStatus;
    const mf = !isAdmin || filterFirma === "Tümü" || o.firmaId === filterFirma;
    const q = search.toLowerCase();
    return (
      ms &&
      mf &&
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
      const firmaId = isAdmin
        ? form.firmaId
        : firmalar.find((f) => f.email === user?.email)?.id;
      await dbKaydet(form, editing?.id || null, ht, user!.token, firmaId);
      showToast(editing ? "Sipariş güncellendi" : "Sipariş oluşturuldu");
      await yukle();
      setShowOrder(false);
      setEditing(null);
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleStatus = async (id: string, ns: string) => {
    try {
      await dbDurum(id, ns, user!.token);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, durum: ns } : o))
      );
      setSel((prev) => (prev?.id === id ? { ...prev, durum: ns } : prev));
      showToast(`${STATUS_CONFIG[ns].icon} Durum: ${STATUS_CONFIG[ns].label}`);
    } catch {
      showToast("Bir hata oluştu", "error");
    }
  };

  const handleSms = async (sk: string, msg: string) => {
    if (!smsOrder) return;
    try {
      const o = orders.find((x) => x.id === smsOrder.id);
      if (!o) return;
      const nd = { ...o.smsDurum, [sk]: true };
      await dbSms(smsOrder.id, nd, user!.token);
      await dbSmsLog(smsOrder.id, smsOrder.telefon, msg, sk, user!.token);
      setOrders((prev) =>
        prev.map((o) => (o.id === smsOrder.id ? { ...o, smsDurum: nd } : o))
      );
      showToast("SMS başarıyla loglandı");
    } catch {
      showToast("SMS loglanırken hata oluştu", "error");
    }
  };

  const aktifFiltre =
    (filterStatus !== "Tümü" ? 1 : 0) + (filterFirma !== "Tümü" ? 1 : 0);

  // ─── EKRAN YÖNLENDİRMELERİ ───
  if (authState === "loading")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F8FAFC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid #E2E8F0",
            borderTop: "3px solid #3B82F6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  if (authState === "setpassword")
    return (
      <SetPasswordScreen
        accessToken={accessToken}
        onDone={() => setAuthState("login")}
      />
    );
  if (authState === "login")
    return (
      <LoginScreen
        onLogin={(u) => {
          setUser(u);
          setAuthState("app");
        }}
      />
    );

  // ─── ANA EKRAN RENDER ───
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        fontFamily: "'Poppins', sans-serif",
        maxWidth: "100vw",
        overflowX: "hidden",
        color: "#0F172A",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
        
        /* Modern SaaS Tasarım Sınıfları */
        .saas-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .saas-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.08);
        }
        
        .modern-table { width: 100%; border-collapse: collapse; }
        .modern-table th {
          background: #F1F5F9; color: #64748B; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px;
          padding: 16px; text-align: left; border-bottom: 2px solid #E2E8F0;
        }
        .modern-table td { padding: 16px; border-bottom: 1px solid #F1F5F9; font-size: 13px; color: #334155; }
        .modern-table tr { transition: background 0.2s ease; }
        .modern-table tr:hover { background: #F8FAFC; }

        @media (min-width: 768px) {
          .stat-grid { grid-template-columns: repeat(5, 1fr) !important; }
          .order-card { display: none !important; }
          .order-table { display: block !important; }
          .bottom-nav { display: none !important; }
          .header-tabs { display: flex !important; }
        }
        @media (max-width: 767px) {
          .order-card { display: block !important; }
          .order-table { display: none !important; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .header-tabs { display: none !important; }
          .bottom-nav { display: flex !important; }
        }
      `}</style>

      {/* HEADER */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.98)",
          backdropFilter: "blur(10px)",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 70,
          position: "sticky",
          top: 0,
          zIndex: 100,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg, #ffffff 0%, #F8FAFC 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient
                  id="layer-cyan-sm"
                  x1="0%"
                  y1="100%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#06B6D4" />
                  <stop offset="100%" stopColor="#2563EB" />
                </linearGradient>
              </defs>
              <path
                d="M16 4L28 10.5L16 17L4 10.5L16 4Z"
                fill="url(#layer-cyan-sm)"
                fillOpacity="0.2"
                stroke="url(#layer-cyan-sm)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M4 16L16 22.5L28 16"
                stroke="#3B82F6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 21.5L16 28L28 21.5"
                stroke="#94A3B8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: "18px",
                lineHeight: 1,
                letterSpacing: "-0.5px",
              }}
            >
              HalıPro <span style={{ color: "#3B82F6" }}>.</span>
            </div>
            <div
              style={{
                color: "#94A3B8",
                fontSize: "11px",
                marginTop: "2px",
                fontWeight: 500,
              }}
            >
              {isAdmin ? "👑 Yönetici Paneli" : user?.email}
            </div>
          </div>
        </div>

        <div
          className="header-tabs"
          style={{
            background: "rgba(255,255,255,0.06)",
            borderRadius: "12px",
            padding: "4px",
            display: "none",
            border: "1px solid rgba(255,255,255,0.05)",
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
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === k ? "#fff" : "transparent",
                color: activeTab === k ? "#0F172A" : "#94A3B8",
                fontWeight: activeTab === k ? 700 : 500,
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s",
              }}
            >
              {l}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {isAdmin && (
            <button
              onClick={() => setShowFirma(true)}
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "0 12px",
                height: "38px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              🏢
            </button>
          )}
          <button
            onClick={yukle}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              width: "38px",
              height: "38px",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            ⟳
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: "transparent",
              color: "#94A3B8",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "0 12px",
              height: "38px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "inherit",
            }}
          >
            Çıkış
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setShowOrder(true);
            }}
            style={{
              background: "linear-gradient(135deg,#3B82F6,#2563EB)",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "0 16px",
              height: "38px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "13px",
              fontFamily: "inherit",
              boxShadow: "0 4px 10px rgba(37, 99, 235, 0.3)",
            }}
          >
            + Yeni Sipariş
          </button>
        </div>
      </div>

      {err && (
        <div
          style={{
            margin: "20px",
            padding: "16px 20px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "12px",
            color: "#B91C1C",
            fontSize: "14px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>🚨 {err}</span>
          <button
            onClick={yukle}
            style={{
              background: "#DC2626",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "6px 16px",
              cursor: "pointer",
              fontWeight: 600,
              fontFamily: "inherit",
              fontSize: "13px",
            }}
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* FİYATLAR SEKMESİ */}
      {activeTab === "fiyatlar" && (
        <div
          style={{
            padding: "24px",
            paddingBottom: "100px",
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
              Halı Türleri ve Fiyatlar
            </h2>
            <button
              onClick={() => setShowHali(true)}
              style={{
                background: "#EFF6FF",
                color: "#2563EB",
                border: "1px solid #BFDBFE",
                borderRadius: 10,
                padding: "10px 16px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              ✏️ Fiyatları Düzenle
            </button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {ht.map((t) => (
              <div
                key={t.id}
                className="saas-card"
                style={{
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                    }}
                  >
                    {t.icon}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{t.ad}</div>
                </div>
                <div
                  style={{
                    background: "#EFF6FF",
                    borderRadius: 12,
                    padding: "8px 16px",
                    textAlign: "center" as any,
                  }}
                >
                  <div
                    style={{ fontSize: 18, fontWeight: 800, color: "#1E40AF" }}
                  >
                    ₺{t.birimFiyat}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#3B82F6", fontWeight: 700 }}
                  >
                    m² Fiyatı
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SİPARİŞLER SEKMESİ */}
      {activeTab === "siparisler" && (
        <div
          style={{
            padding: "24px",
            paddingBottom: "100px",
            maxWidth: "1400px",
            margin: "0 auto",
          }}
        >
          <div
            className="stat-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,1fr)",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {[
              {
                label: "Toplam Sipariş",
                value: loading ? "…" : stats.toplam,
                icon: "📋",
                bg: "#EFF6FF",
                col: "#3B82F6",
              },
              {
                label: "Bekleyen",
                value: loading ? "…" : stats.bekleyen,
                icon: "⏳",
                bg: "#FFFBEB",
                col: "#F59E0B",
              },
              {
                label: "Hazır",
                value: loading ? "…" : stats.hazır,
                icon: "✅",
                bg: "#ECFDF5",
                col: "#10B981",
              },
              {
                label: "Dağıtımda",
                value: loading ? "…" : stats.dagitimda,
                icon: "🏍️",
                bg: "#FFF7ED",
                col: "#F97316",
              },
              {
                label: "Aktif Ciro",
                value: loading ? "…" : `₺${stats.ciro.toLocaleString()}`,
                icon: "💰",
                bg: "#F5F3FF",
                col: "#8B5CF6",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="saas-card"
                style={{
                  padding: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    background: s.bg,
                    color: s.col,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      color: "#0F172A",
                      lineHeight: 1,
                      marginBottom: "4px",
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748B",
                      fontWeight: 500,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "12px",
                  fontSize: "16px",
                  opacity: 0.5,
                }}
              >
                🔍
              </span>
              <input
                value={search}
                onChange={(e: any) => setSearch(e.target.value)}
                placeholder="Müşteri, telefon veya sipariş no ara..."
                style={{
                  width: "100%",
                  padding: "12px 14px 12px 40px",
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                  fontSize: "14px",
                  outline: "none",
                  fontFamily: "inherit",
                  background: "#fff",
                  transition: "all 0.2s",
                }}
                onFocus={(e: any) => (e.target.style.borderColor = "#3B82F6")}
                onBlur={(e: any) => (e.target.style.borderColor = "#E2E8F0")}
              />
            </div>
            <button
              onClick={() => setShowFilter(!showFilter)}
              style={{
                background: aktifFiltre > 0 ? "#EFF6FF" : "#fff",
                border: `1px solid ${aktifFiltre > 0 ? "#BFDBFE" : "#E2E8F0"}`,
                borderRadius: "12px",
                padding: "0 20px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "14px",
                color: aktifFiltre > 0 ? "#1D4ED8" : "#475569",
                fontFamily: "inherit",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              Filtrele{" "}
              {aktifFiltre > 0 && (
                <span
                  style={{
                    background: "#3B82F6",
                    color: "#fff",
                    borderRadius: "10px",
                    padding: "2px 8px",
                    fontSize: "11px",
                  }}
                >
                  {aktifFiltre}
                </span>
              )}
            </button>
          </div>

          {showFilter && (
            <div
              className="saas-card"
              style={{ padding: "20px", marginBottom: "20px" }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#64748B",
                  marginBottom: "12px",
                  textTransform: "uppercase",
                }}
              >
                Durum
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginBottom: isAdmin && firmalar.length > 0 ? "20px" : 0,
                }}
              >
                {STATUSLAR.map((s) => {
                  const cfg = s !== "Tümü" ? STATUS_CONFIG[s] : null;
                  const active = filterStatus === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "20px",
                        border: `1px solid ${
                          active ? cfg?.color || "#1E40AF" : "#E2E8F0"
                        }`,
                        background: active ? cfg?.bg || "#EFF6FF" : "#fff",
                        color: active ? cfg?.color || "#1E40AF" : "#64748B",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "13px",
                        fontFamily: "inherit",
                        transition: "all 0.2s",
                      }}
                    >
                      {cfg ? `${cfg.icon} ${cfg.label}` : "Tümü"}
                    </button>
                  );
                })}
              </div>
              {isAdmin && firmalar.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#64748B",
                      marginBottom: 12,
                      textTransform: "uppercase" as any,
                    }}
                  >
                    Firma
                  </div>
                  <div
                    style={{ display: "flex", gap: 8, flexWrap: "wrap" as any }}
                  >
                    <button
                      onClick={() => setFilterFirma("Tümü")}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 20,
                        border: `1px solid ${
                          filterFirma === "Tümü" ? "#1E40AF" : "#E2E8F0"
                        }`,
                        background: filterFirma === "Tümü" ? "#EFF6FF" : "#fff",
                        color: filterFirma === "Tümü" ? "#1E40AF" : "#64748B",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                        fontFamily: "inherit",
                      }}
                    >
                      Tümü
                    </button>
                    {firmalar.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilterFirma(f.id)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 20,
                          border: `1px solid ${
                            filterFirma === f.id ? "#1E40AF" : "#E2E8F0"
                          }`,
                          background: filterFirma === f.id ? "#EFF6FF" : "#fff",
                          color: filterFirma === f.id ? "#1E40AF" : "#64748B",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 13,
                          fontFamily: "inherit",
                        }}
                      >
                        🏢 {f.ad}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* MOBİL GÖRÜNÜM KARTLARI */}
          <div className="order-card" style={{ display: "none" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center" as any }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    border: "3px solid #E2E8F0",
                    borderTop: "3px solid #3B82F6",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 10px",
                  }}
                />
                <div style={{ color: "#64748B", fontSize: 14 }}>
                  Yükleniyor...
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center" as any,
                  color: "#94A3B8",
                }}
              >
                Sonuç bulunamadı.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {filtered.map((order) => {
                  const smsSayisi = Object.values(order.smsDurum || {}).filter(
                    Boolean
                  ).length;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSel(order)}
                      className="saas-card"
                      style={{
                        padding: "16px",
                        cursor: "pointer",
                        border:
                          sel?.id === order.id
                            ? "2px solid #3B82F6"
                            : "1px solid #E2E8F0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 12,
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
                              color: "#64748B",
                              marginTop: 4,
                            }}
                          >
                            {order.id} · {order.telefon}
                            {isAdmin && order.firmaAd
                              ? ` · 🏢${order.firmaAd}`
                              : ""}
                          </div>
                        </div>
                        <StatusBadge durum={order.durum} />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap" as any,
                          gap: 6,
                          marginBottom: 12,
                        }}
                      >
                        {(order.haliKalemleri || []).map((k, i) => {
                          const tur = ht.find((t) => t.id === k.turId);
                          return (
                            <span
                              key={i}
                              style={{
                                fontSize: 11,
                                background: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                color: "#475569",
                                padding: "4px 8px",
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
                          borderTop: "1px solid #F1F5F9",
                          paddingTop: 12,
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
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          {smsSayisi > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                background: "#ECFDF5",
                                color: "#059669",
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontWeight: 700,
                              }}
                            >
                              📱{smsSayisi}
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: "#94A3B8" }}>
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

          {/* MASAÜSTÜ TABLO GÖRÜNÜMÜ */}
          <div className="order-table saas-card" style={{ overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "60px", textAlign: "center" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid #E2E8F0",
                    borderTop: "3px solid #3B82F6",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto",
                  }}
                />
              </div>
            ) : (
              <table className="modern-table">
                <thead>
                  <tr>
                    {[
                      "No",
                      "Müşteri Bilgisi",
                      "Firma",
                      "Halı Detayı",
                      "Tutar",
                      "Durum",
                      "SMS",
                      "Tarih",
                      "İşlem",
                    ]
                      .filter((h) => isAdmin || h !== "Firma")
                      .map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: "40px",
                          textAlign: "center",
                          color: "#94A3B8",
                        }}
                      >
                        Sonuç bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((order) => {
                      const smsSayisi = Object.values(
                        order.smsDurum || {}
                      ).filter(Boolean).length;
                      return (
                        <tr
                          key={order.id}
                          onClick={() => setSel(order)}
                          style={{
                            cursor: "pointer",
                            background:
                              sel?.id === order.id ? "#F8FAFC" : "#fff",
                          }}
                        >
                          <td>
                            <span
                              style={{
                                fontWeight: 700,
                                color: "#475569",
                                fontSize: "12px",
                                background: "#F1F5F9",
                                padding: "4px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              {order.id}
                            </span>
                          </td>
                          <td>
                            <div
                              style={{
                                fontWeight: 700,
                                color: "#0F172A",
                                marginBottom: "2px",
                              }}
                            >
                              {order.musteri}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748B" }}>
                              {order.telefon}
                            </div>
                          </td>
                          {isAdmin && (
                            <td>
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#475569",
                                  background: "#F8FAFC",
                                  padding: "4px 8px",
                                  border: "1px solid #E2E8F0",
                                  borderRadius: "6px",
                                }}
                              >
                                🏢 {order.firmaAd || "Bireysel"}
                              </span>
                            </td>
                          )}
                          <td>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "6px",
                              }}
                            >
                              {(order.haliKalemleri || []).map((k, ki) => {
                                const tur = ht.find((t) => t.id === k.turId);
                                return (
                                  <span
                                    key={ki}
                                    style={{
                                      fontSize: "11px",
                                      background: "#F8FAFC",
                                      border: "1px solid #E2E8F0",
                                      color: "#475569",
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {tur?.icon} {tur?.ad} · {k.m2}m²
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                fontWeight: 800,
                                color: "#059669",
                                fontSize: "15px",
                              }}
                            >
                              ₺{order.fiyat?.toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <StatusBadge durum={order.durum} />
                          </td>
                          <td>
                            {smsSayisi > 0 ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  background: "#ECFDF5",
                                  border: "1px solid #A7F3D0",
                                  color: "#059669",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontWeight: 700,
                                }}
                              >
                                📱 {smsSayisi}
                              </span>
                            ) : (
                              <span style={{ color: "#CBD5E1" }}>—</span>
                            )}
                          </td>
                          <td
                            style={{
                              color: "#64748B",
                              fontSize: "12px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {order.tarih}
                          </td>
                          <td>
                            <button
                              onClick={(e: any) => {
                                e.stopPropagation();
                                setEditing(order);
                                setShowOrder(true);
                              }}
                              style={{
                                background: "#EFF6FF",
                                color: "#2563EB",
                                border: "none",
                                borderRadius: "8px",
                                padding: "8px 16px",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: 600,
                                fontFamily: "inherit",
                                transition: "background 0.2s",
                              }}
                              onMouseOver={(e: any) =>
                                (e.target.style.background = "#DBEAFE")
                              }
                              onMouseOut={(e: any) =>
                                (e.target.style.background = "#EFF6FF")
                              }
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
                  padding: "16px 20px",
                  borderTop: "1px solid #E2E8F0",
                  fontSize: "13px",
                  color: "#64748B",
                  background: "#F8FAFC",
                }}
              >
                Toplam <strong>{filtered.length}</strong> sipariş listeleniyor.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ALT NAV (Mobil) */}
      <div
        className="bottom-nav"
        style={{
          display: "none",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid #E2E8F0",
          padding: "12px 0 20px",
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
              gap: 4,
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
                fontSize: 11,
                fontWeight: activeTab === k ? 700 : 500,
                color: activeTab === k ? "#2563EB" : "#64748B",
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
            gap: 4,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            flex: 1,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#3B82F6,#2563EB)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              marginTop: -22,
              boxShadow: "0 8px 16px rgba(37,99,235,0.3)",
              color: "#fff",
            }}
          >
            ➕
          </div>
          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>
            Ekle
          </span>
        </button>
        <button
          onClick={() => setShowFilter(!showFilter)}
          style={{
            display: "flex",
            flexDirection: "column" as any,
            alignItems: "center",
            gap: 4,
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
              fontSize: 11,
              fontWeight: aktifFiltre > 0 ? 700 : 500,
              color: aktifFiltre > 0 ? "#2563EB" : "#64748B",
            }}
          >
            Filtre
          </span>
        </button>
      </div>

      {/* MODALLAR */}
      {sel && (
        <DetailSheet
          order={orders.find((o) => o.id === sel.id) || null}
          ht={ht}
          isAdmin={isAdmin}
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
          firmalar={firmalar}
          isAdmin={isAdmin}
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
          onSave={(l) => {
            setHt(l);
            try {
              localStorage.setItem("t360_ht", JSON.stringify(l));
            } catch {}
            setShowHali(false);
            showToast("Halı türleri güncellendi");
          }}
        />
      )}
      {showFirma && isAdmin && (
        <FirmaModal
          token={user!.token}
          onClose={() => setShowFirma(false)}
          onSaved={yukle}
        />
      )}

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}
