import { useState } from "react";
import { Siparis, HaliTuru, Firma, firmaOzellikVar } from "../types";
import { STATUS_CONFIG } from "../constants";
import { smsMesaji } from "../lib/sms";

interface SmsModalProps {
  order: Siparis;
  ht: HaliTuru[];
  firmaAd: string;
  firma: Firma | null | undefined;
  onClose: () => void;
  onSend: (durum: string, mesaj: string, kanal: "wa_me" | "wa_api" | "sms") => Promise<void>;
  onError: (msg: string) => void;
  onKrediDus?: () => void;
}

type Kanal = "wa_me" | "wa_api" | "sms";

const KANAL_BILGI: Record<Kanal, { label: string; icon: string; renk: string; bg: string; aciklama: string }> = {
  wa_me: {
    label: "WhatsApp (Manuel)",
    icon: "💬",
    renk: "#25D366",
    bg: "#F0FDF4",
    aciklama: "WhatsApp açılır, mesajı siz gönderirsiniz",
  },
  wa_api: {
    label: "WhatsApp Business API",
    icon: "🤖",
    renk: "#0EA5E9",
    bg: "#F0F9FF",
    aciklama: "Otomatik gönderilir — müşteri anında alır",
  },
  sms: {
    label: "SMS (Netgsm)",
    icon: "📱",
    renk: "#8B5CF6",
    bg: "#F5F3FF",
    aciklama: "Her telefona ulaşır, WhatsApp gerekmez",
  },
};

export function SmsModal({ order, ht, firmaAd, firma, onClose, onSend, onError, onKrediDus }: SmsModalProps) {
  const [sel, setSel] = useState<string | null>(null);
  const [kanal, setKanal] = useState<Kanal>("wa_me");
  const [sending, setSending] = useState(false);
  const [waBekleniyor, setWaBekleniyor] = useState(false);

  const hasWaApi = firmaOzellikVar(firma, "wa_api");
  const hasSms = firmaOzellikVar(firma, "sms");

  const smsKredisi = firma?.sms_kredisi ?? 0;
  const kredisiYok = kanal === "sms" && smsKredisi <= 0;

  // Firma özel SMS başlığı varsa onu kullan, yoksa firma adını kırp
  const smsBaslik = firma?.netgsm_baslik || firmaAd.slice(0, 11);

  const txt = sel ? smsMesaji(sel, order, ht, firmaAd) : "";

  const handleSend = async () => {
    if (!sel || sending) return;

    if (kanal === "sms" && smsKredisi <= 0) {
      onError("SMS krediniz tükendi. Yöneticinizden yeni paket talep edin.");
      return;
    }

    setSending(true);

    try {
      let tel = order.telefon.replace(/[^0-9]/g, "");
      if (tel.startsWith("0")) tel = "9" + tel;
      else if (tel.startsWith("5")) tel = "90" + tel;

      if (kanal === "wa_me") {
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(txt)}`, "_blank");
        setSending(false);
        setWaBekleniyor(true);
        return;
      }

      if (kanal === "wa_api") {
        if (firma?.wa_api_key && firma?.wa_phone_id) {
          await fetch(
            `https://graph.facebook.com/v18.0/${firma.wa_phone_id}/messages`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${firma.wa_api_key}`,
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: tel,
                type: "text",
                text: { body: txt },
              }),
            }
          );
        } else {
          onError("WhatsApp API bilgileri eksik. Admin panelinden firma ayarlarını güncelleyin.");
          setSending(false);
          return;
        }
      } else if (kanal === "sms") {
        const netgsmUser = process.env.REACT_APP_NETGSM_USER;
        const netgsmPass = process.env.REACT_APP_NETGSM_PASS;

        if (!netgsmUser || !netgsmPass) {
          onError("SMS yapılandırması eksik. Lütfen yönetici ile iletişime geçin.");
          setSending(false);
          return;
        }

        const params = new URLSearchParams({
          usercode: netgsmUser,
          password: netgsmPass,
          gsmno: tel,
          message: txt,
          msgheader: smsBaslik, // ← Firma özel başlığı kullan
          dil: "TR",
        });

        const res = await fetch(`https://api.netgsm.com.tr/sms/send/get/?${params.toString()}`);
        const resText = await res.text();

        if (!resText.startsWith("00") && !resText.startsWith("01") && !resText.startsWith("02")) {
          onError(`SMS gönderilemedi. Hata kodu: ${resText}`);
          setSending(false);
          return;
        }

        // SMS başarılı → App'e kredi düş sinyali gönder
        onKrediDus?.();
      }

      await onSend(sel, txt, kanal);
      onClose();
    } catch (e) {
      console.error("Gönderim hatası:", e);
      onError("Gönderim sırasında bir hata oluştu.");
    } finally {
      setSending(false);
    }
  };

  const waOnayEvet = async () => {
    if (!sel) return;
    setSending(true);
    try {
      await onSend(sel, txt, "wa_me");
      onClose();
    } catch {
      onError("Log kaydedilemedi.");
    } finally {
      setSending(false);
      setWaBekleniyor(false);
    }
  };

  const waOnayHayir = () => {
    setWaBekleniyor(false);
    setSending(false);
  };

  const kanalInfo = KANAL_BILGI[kanal];

  // ─── wa_me ONAY EKRANI ───────────────────────────────────────────────────────
  if (waBekleniyor) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 2000, fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: 600 }}>
          <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 4, margin: "0 auto 24px" }} />
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0F172A" }}>WhatsApp açıldı</h2>
            <p style={{ margin: "8px 0 0", color: "#64748B", fontSize: 15, lineHeight: 1.5 }}>
              Mesajı <strong>{order.musteri}</strong>'e gönderebildiniz mi?
            </p>
          </div>
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 16px", marginBottom: 24, fontSize: 13, color: "#15803D", lineHeight: 1.5, whiteSpace: "pre-line" }}>
            {txt}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button
              onClick={waOnayHayir}
              style={{ padding: 16, borderRadius: 12, border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B", cursor: "pointer", fontWeight: 700, fontSize: 15, fontFamily: "inherit" }}
            >
              ✕ Gönderemedim
            </button>
            <button
              onClick={waOnayEvet}
              disabled={sending}
              style={{ padding: 16, borderRadius: 12, border: "none", background: "#25D366", color: "#fff", cursor: sending ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15, fontFamily: "inherit" }}
            >
              {sending ? "Kaydediliyor..." : "✓ Gönderdim"}
            </button>
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 16, marginBottom: 0 }}>
            "Gönderemedim" seçerseniz kayıt tutulmaz
          </p>
        </div>
      </div>
    );
  }

  // ─── ANA MODAL ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 2000, fontFamily: "'Poppins', sans-serif" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 4, margin: "0 auto 20px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📨 Bildirim Gönder</h2>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {/* Müşteri bilgisi */}
        <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 14, color: "#334155", border: "1px solid #E2E8F0" }}>
          <strong>{order.musteri}</strong> · {order.telefon}
        </div>

        {/* SMS Kredi Uyarıları */}
        {smsKredisi > 0 && smsKredisi <= 10 && (
          <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400E", display: "flex", alignItems: "center", gap: 8 }}>
            ⚠️ <span>SMS krediniz azalıyor: <strong>{smsKredisi} SMS</strong> kaldı.</span>
          </div>
        )}
        {smsKredisi <= 0 && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991B1B", display: "flex", alignItems: "center", gap: 8 }}>
            🚫 <span>SMS krediniz tükendi. Yöneticinizden yeni paket talep edin.</span>
          </div>
        )}

        {/* Kanal Seçici */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 10, textTransform: "uppercase" }}>Kanal Seç</div>
        <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          {(Object.entries(KANAL_BILGI) as [Kanal, typeof KANAL_BILGI[Kanal]][]).map(([k, info]) => {
            const kilitli = (k === "wa_api" && !hasWaApi) || (k === "sms" && !hasSms);
            const kredisiz = k === "sms" && smsKredisi <= 0;
            const secili = kanal === k;
            return (
              <button
                key={k}
                onClick={() => !kilitli && !kredisiz && setKanal(k)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", borderRadius: 12, textAlign: "left",
                  border: `1.5px solid ${secili ? info.renk : "#E2E8F0"}`,
                  background: secili ? info.bg : (kilitli || kredisiz) ? "#F8FAFC" : "#fff",
                  cursor: (kilitli || kredisiz) ? "not-allowed" : "pointer",
                  opacity: (kilitli || kredisiz) ? 0.55 : 1,
                  fontFamily: "inherit", transition: "all 0.2s",
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: secili ? info.renk + "20" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {info.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: secili ? info.renk : (kilitli || kredisiz) ? "#94A3B8" : "#334155" }}>
                    {info.label}
                    {kilitli && <span style={{ marginLeft: 6, fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>Pro gerekli</span>}
                    {kredisiz && <span style={{ marginLeft: 6, fontSize: 10, background: "#FEE2E2", color: "#DC2626", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>Kredi yok</span>}
                    {k === "sms" && !kilitli && !kredisiz && (
                      <span style={{ marginLeft: 6, fontSize: 10, background: "#F0FDF4", color: "#059669", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>
                        {smsKredisi} kredi
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    {k === "sms" && smsBaslik ? `${info.aciklama} · Gönderen: ${smsBaslik}` : info.aciklama}
                  </div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  border: `2px solid ${secili ? info.renk : "#CBD5E1"}`,
                  background: secili ? info.renk : "transparent",
                  flexShrink: 0,
                }} />
              </button>
            );
          })}
        </div>

        {/* Durum Seçici */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 10, textTransform: "uppercase" }}>Bildirim Türü</div>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {Object.keys(STATUS_CONFIG).filter((s) => s !== "bekliyor").map((s) => {
            const cfg = STATUS_CONFIG[s];
            const gone = order.smsDurum?.[s];
            const aktif = sel === s;
            return (
              <button key={s} onClick={() => !gone && setSel(s)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", borderRadius: 12,
                border: `1.5px solid ${aktif ? cfg.color : "#E2E8F0"}`,
                background: aktif ? cfg.bg : gone ? "#F8FAFC" : "#fff",
                cursor: gone ? "not-allowed" : "pointer",
                opacity: gone ? 0.6 : 1, fontFamily: "inherit", transition: "all 0.2s",
              }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: aktif ? cfg.color : "#334155" }}>
                  {cfg.icon} {cfg.label}
                </span>
                {gone && <span style={{ fontSize: 12, color: "#10B981", fontWeight: 700 }}>✓ Gönderildi</span>}
              </button>
            );
          })}
        </div>

        {/* Mesaj önizleme */}
        {txt && (
          <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 8 }}>
              MESAJ ÖNİZLEME
              {kanal === "sms" && smsBaslik && (
                <span style={{ marginLeft: 8, fontWeight: 400, color: "#64748B" }}>
                  · Gönderen: <strong>{smsBaslik}</strong>
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, color: "#15803D", lineHeight: 1.6, whiteSpace: "pre-line" }}>{txt}</div>
          </div>
        )}

        {/* Gönder butonu */}
        <button
          onClick={handleSend}
          disabled={!sel || sending || kredisiYok}
          style={{
            width: "100%", padding: 16, borderRadius: 12, border: "none",
            background: sel && !kredisiYok ? kanalInfo.renk : "#E2E8F0",
            color: sel && !kredisiYok ? "#fff" : "#94A3B8",
            cursor: sel && !kredisiYok ? "pointer" : "not-allowed",
            fontWeight: 700, fontSize: 16, fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s",
          }}
        >
          {sending
            ? "Gönderiliyor..."
            : <><span style={{ fontSize: 18 }}>{kanalInfo.icon}</span> {kanalInfo.label} ile Gönder</>
          }
        </button>
      </div>
    </div>
  );
}