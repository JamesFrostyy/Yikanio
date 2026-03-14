import { useState, useCallback } from "react";
import { Siparis, HaliTuru, Firma } from "../types";
import { dbGetir, dbFirmalariGetir, dbHaliTurleriniGetir } from "../lib/db";
import { sbFetch } from "../lib/supabase";

export function useOrders(token: string, isAdmin: boolean, userEmail?: string) {
  const [orders, setOrders] = useState<Siparis[]>([]);
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [ht, setHt] = useState<HaliTuru[]>([]);
  const [firmaId, setFirmaId] = useState<string>("");
  const [firmaAd, setFirmaAd] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    if (!token || !userEmail) return;
    setLoading(true);
    setErr(null);
    try {
      const firmaSonuc = await sbFetch(
        `firmalar?email=eq.${userEmail}&select=*`,
        {},
        token
      ) as Record<string, unknown>[];

      const resolvedFirmaId = (firmaSonuc?.[0]?.id as string) || "";
      const resolvedFirmaAd = (firmaSonuc?.[0]?.ad as string) || "";
      setFirmaId(resolvedFirmaId);
      setFirmaAd(resolvedFirmaAd);

      const [siparisler, firms] = await Promise.all([
        dbGetir(token, isAdmin),
        isAdmin ? dbFirmalariGetir(token) : Promise.resolve([]),
      ]);

      setOrders(siparisler);

      if (isAdmin) {
        setFirmalar(firms);
      } else if (firmaSonuc?.[0]) {
        const f = firmaSonuc[0];
        setFirmalar([{
          id: f.id as string,
          ad: f.ad as string,
          email: f.email as string,
          aktif: f.aktif as boolean,
          paket: (f.paket as Firma["paket"]) || "starter",
          addonlar: Array.isArray(f.addonlar)
            ? (f.addonlar as Firma["addonlar"])
            : typeof f.addonlar === "string"
            ? JSON.parse(f.addonlar as string)
            : [],
          netgsm_user: f.netgsm_user as string | undefined,
          netgsm_pass: f.netgsm_pass as string | undefined,
          netgsm_baslik: f.netgsm_baslik as string | undefined,  // ← EKLENDİ
          sms_kredisi: f.sms_kredisi as number | undefined,       // ← EKLENDİ
          wa_api_key: f.wa_api_key as string | undefined,
          wa_phone_id: f.wa_phone_id as string | undefined,
        }]);
      }

      if (!isAdmin && resolvedFirmaId) {
        const haliTurleri = await dbHaliTurleriniGetir(token, resolvedFirmaId);
        setHt(haliTurleri);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, userEmail]);

  return { orders, setOrders, firmalar, ht, setHt, firmaId, firmaAd, loading, err, yukle };
}