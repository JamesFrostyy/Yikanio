import { useState } from "react";
import { Siparis, HaliTuru } from "../types";
import { STATUS_CONFIG } from "../constants";
import { toplamAdet, toplamM2 } from "../lib/db";
import { StatusBadge } from "./StatusBadge";

interface DetailSheetProps {
  order: Siparis | null;
  ht: HaliTuru[];
  isAdmin: boolean;
  onClose: () => void;
  onStatusChange: (id: string, durum: string) => void;
  onEdit: (order: Siparis) => void;
  onSmsOpen: (order: Siparis) => void;
  onDelete?: (id: string) => void;
}

export function DetailSheet({ order, ht, isAdmin, onClose, onStatusChange, onEdit, onSmsOpen, onDelete }: DetailSheetProps) {
  const [silConfirm, setSilConfirm] = useState(false);
  if (!order) return null;
  const keys = Object.keys(STATUS_CONFIG);
  const idx = keys.indexOf(order.durum);
  const smsSayisi = Object.values(order.smsDurum || {}).filter(Boolean).length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 800, fontFamily: "'Poppins', sans-serif" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 4, margin: "0 auto 20px" }} />

        {/* Başlık */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
              {order.id}{isAdmin && order.firmaAd ? ` · 🏢 ${order.firmaAd}` : ""}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "4px 0 8px" }}>{order.musteri}</div>
            <StatusBadge durum={order.durum} />
          </div>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {/* Süreç */}
        <div style={{ background: "#F8FAFC", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 16, textTransform: "uppercase" }}>İşlem Süreci</div>
          <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 8 }}>
            {keys.map((s, i) => {
              const cfg = STATUS_CONFIG[s];
              const done = i <= idx;
              const cur = i === idx;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: done ? cfg.color : "#E2E8F0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, color: done ? "#fff" : "#94A3B8", fontWeight: 700,
                      boxShadow: cur ? `0 0 0 4px ${cfg.bg}` : "none", transition: "all 0.3s",
                    }}>
                      {done ? (cur ? cfg.icon : "✓") : ""}
                    </div>
                    <div style={{ fontSize: 10, color: done ? "#334155" : "#94A3B8", fontWeight: cur ? 700 : 500, textAlign: "center", maxWidth: 50 }}>{cfg.label}</div>
                    {order.smsDurum?.[s] && (
                      <div style={{ fontSize: 9, background: "#D1FAE5", color: "#065F46", padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>SMS</div>
                    )}
                  </div>
                  {i < keys.length - 1 && (
                    <div style={{ width: 20, height: 2, background: i < idx ? cfg.color : "#E2E8F0", flexShrink: 0, marginBottom: 24 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Halı Detayları */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 8, textTransform: "uppercase" }}>Halı Detayları</div>
          {(order.haliKalemleri || []).map((k, i) => {
            const tur = ht.find((t) => t.id === k.turId);
            const kalemBirimFiyat = k.birimFiyat ?? tur?.birimFiyat ?? 0;
            const kalemTutar = kalemBirimFiyat * (k.m2 || 0) * (k.adet || 1);
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{tur?.icon} {tur?.ad}</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#64748B" }}>{k.adet}ad · {k.m2}m²</span>
                  <span style={{ fontWeight: 800, color: "#059669", fontSize: 15 }}>₺{kalemTutar}</span>
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", background: "#EFF6FF", borderRadius: 12, marginTop: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E40AF" }}>
              {toplamAdet(order.haliKalemleri || [])} Halı · {toplamM2(order.haliKalemleri || [])} m²
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#1E40AF" }}>₺{order.fiyat?.toLocaleString()}</span>
          </div>
        </div>

        {/* İletişim */}
        <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 10, textTransform: "uppercase" }}>İletişim & Adres</div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>📞</span>
              <a href={`tel:${order.telefon}`} style={{ color: "#2563EB", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>{order.telefon}</a>
            </div>
            {order.adres && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 16 }}>📍</span>
                <span style={{ color: "#334155", fontSize: 14 }}>{order.adres}</span>
              </div>
            )}
            {order.notlar && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 16 }}>📝</span>
                <span style={{ color: "#334155", fontSize: 14 }}>{order.notlar}</span>
              </div>
            )}
          </div>
        </div>

        {/* Durum Değiştir */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 10, textTransform: "uppercase" }}>Durumu Güncelle</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {keys.map((s) => {
              const cfg = STATUS_CONFIG[s];
              const aktif = order.durum === s;
              return (
                <button key={s} onClick={() => onStatusChange(order.id, s)} style={{
                  padding: "8px 14px", borderRadius: 20,
                  border: `1.5px solid ${aktif ? cfg.color : "#E2E8F0"}`,
                  background: aktif ? cfg.bg : "#fff",
                  color: aktif ? cfg.color : "#64748B",
                  cursor: "pointer", fontWeight: 600, fontSize: 12,
                  fontFamily: "inherit", transition: "all 0.2s",
                }}>
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Aksiyonlar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={() => onEdit(order)} style={{ padding: 14, borderRadius: 12, border: "none", background: "#EFF6FF", color: "#2563EB", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
            ✏️ Düzenle
          </button>
          <button onClick={() => onSmsOpen(order)} style={{ padding: 14, borderRadius: 12, border: "none", background: "#F0FDF4", color: "#059669", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
            💬 WhatsApp {smsSayisi > 0 ? `(${smsSayisi})` : ""}
          </button>
        </div>
        {onDelete && (
          <div style={{ marginTop: 10 }}>
            {silConfirm ? (
              <div style={{ background: "#FEF2F2", borderRadius: 12, padding: "12px 16px", border: "1px solid #FECACA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#991B1B", fontWeight: 600 }}>⚠️ Siparişi silmek istiyor musunuz?</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setSilConfirm(false)} style={{ background: "#fff", border: "1px solid #FECACA", color: "#475569", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>İptal</button>
                  <button onClick={() => { onDelete(order.id); onClose(); }} style={{ background: "#DC2626", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>Evet, Sil</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setSilConfirm(true)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
                🗑️ Siparişi Sil
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}