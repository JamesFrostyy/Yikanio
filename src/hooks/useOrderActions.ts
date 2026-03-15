import { Siparis, HaliTuru, Firma, ToastState } from "../types";
import { dbKaydet, dbSil } from "../lib/db";
import { sbFetch } from "../lib/supabase";
import { OrderForm } from "../components/OrderModal"; // type'ı export etmeniz gerekebilir

interface UseOrderActionsParams {
  user: { token: string } | null;
  orders: Siparis[];
  setOrders: React.Dispatch<React.SetStateAction<Siparis[]>>;
  ht: HaliTuru[];
  firmaId: string;
  isAdmin: boolean;
  hesapAktif: boolean;
  showToast: (msg: string, type?: string) => void;
}

export function useOrderActions({
  user,
  orders,
  setOrders,
  ht,
  firmaId,
  isAdmin,
  hesapAktif,
  showToast,
}: UseOrderActionsParams) {

  const handleSave = async (form: OrderForm, editingId: string | null) => {
    if (!user) return;
    if (!isAdmin && !hesapAktif) {
    showToast("Hesabınız aktif değil. Yöneticinizle iletişime geçin.", "error");
    return;
  }
    const resolvedFirmaId = isAdmin ? form.firmaId : firmaId;
    await dbKaydet(form, editingId, ht, user.token, resolvedFirmaId);
    showToast(editingId ? "Sipariş güncellendi!" : "Sipariş oluşturuldu!");
  };

  const handleStatus = async (id: string, durum: string) => {
    if (!user) return;
    if (!isAdmin && !hesapAktif) {
    showToast("Hesabınız aktif değil.", "error");
    return;
  }
    await sbFetch(
      `siparisler?id=eq.${id}`,
      { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ durum }) },
      user.token
    );
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, durum } : o));
    showToast("Durum güncellendi!");
  };

  const handleSms = async (
    smsOrder: Siparis | null,
    durum: string,
    mesaj: string,
    kanal: "wa_me" | "wa_api" | "sms"
  ) => {
    if (!user || !smsOrder) return;
    const yeniSmsDurum = { ...smsOrder.smsDurum, [durum]: true };
    await sbFetch(
      `siparisler?id=eq.${smsOrder.id}`,
      { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ sms_durum: yeniSmsDurum }) },
      user.token
    );
    await sbFetch(
      "sms_log",
      { method: "POST", body: JSON.stringify({ siparis_id: smsOrder.id, telefon: smsOrder.telefon, mesaj, durum_adi: durum, kanal }) },
      user.token
    );
    setOrders((prev) =>
      prev.map((o) => o.id === smsOrder.id ? { ...o, smsDurum: yeniSmsDurum } : o)
    );
    showToast("Bildirim gönderildi!");
  };

  const handleSil = async (id: string) => {
    if (!user) return;
    await dbSil(user.token, id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    showToast("Sipariş silindi!");
  };

  return { handleSave, handleStatus, handleSms, handleSil };
}