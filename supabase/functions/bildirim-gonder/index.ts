import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NETGSM_USER = Deno.env.get("NETGSM_USER")!;
const NETGSM_PASS = Deno.env.get("NETGSM_PASS")!;
const NETGSM_BASLIK = Deno.env.get("NETGSM_BASLIK") || "YIKANIO";
const SMTP_API_KEY = Deno.env.get("SMTP_API_KEY") || ""; // Formspree veya başka servis

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// SMS gönder (Netgsm)
async function smsSend(telefon: string, mesaj: string): Promise<boolean> {
  if (!NETGSM_USER || !NETGSM_PASS) return false;
  let tel = telefon.replace(/[^0-9]/g, "");
  if (tel.startsWith("0")) tel = "9" + tel;
  else if (tel.startsWith("5")) tel = "90" + tel;

  const params = new URLSearchParams({
    usercode: NETGSM_USER,
    password: NETGSM_PASS,
    gsmno: tel,
    message: mesaj,
    msgheader: NETGSM_BASLIK,
    dil: "TR",
  });

  try {
    const res = await fetch(`https://api.netgsm.com.tr/sms/send/get/?${params}`);
    const text = await res.text();
    return text.startsWith("00") || text.startsWith("01") || text.startsWith("02");
  } catch {
    return false;
  }
}

// Email gönder (Formspree)
async function emailSend(to: string, konu: string, mesaj: string): Promise<boolean> {
  // Formspree form ID'nizi buraya girin
  const FORMSPREE_ID = Deno.env.get("FORMSPREE_ID") || "";
  if (!FORMSPREE_ID) return false;

  try {
    const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email: to,
        _subject: konu,
        mesaj,
        _replyto: "info@yikanio.com",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Bildirim log'a kaydet
async function logKaydet(firmaId: string, tip: string, kanal: string, basarili: boolean) {
  await supabase.from("bildirim_log").insert({
    firma_id: firmaId,
    tip,
    kanal,
    basarili,
    tarih: new Date().toISOString(),
  }).then(() => {});
}

serve(async (_req) => {
  try {
    const bugun = new Date();
    const uc_gun_sonra = new Date(bugun);
    uc_gun_sonra.setDate(uc_gun_sonra.getDate() + 3);
    const bes_gun_sonra = new Date(bugun);
    bes_gun_sonra.setDate(bes_gun_sonra.getDate() + 5);

    // Tüm aktif firmaları çek
    const { data: firmalar, error } = await supabase
      .from("firmalar")
      .select("*")
      .eq("aktif", true);

    if (error || !firmalar) {
      return new Response(JSON.stringify({ error: "Firmalar alınamadı" }), { status: 500 });
    }

    const sonuclar: string[] = [];

    for (const firma of firmalar) {
      const durum = firma.hesap_durum;
      const ad = firma.yetkili_ad || firma.ad;
      const tel = firma.telefon;
      const email = firma.email;

      // ── DEMO BİTİYOR ──────────────────────────────────────────────────────
      if (durum === "demo" && firma.demo_bitis) {
        const bitisGun = Math.ceil(
          (new Date(firma.demo_bitis).getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24)
        );

        // 3 gün kaldı
        if (bitisGun === 3) {
          const smsMesaj = `Sayın ${ad}, Yıkanio demo süreniz 3 gün içinde sona eriyor. Aboneliğe geçmek için hesabinizdan "Hesabım" sekmesini ziyaret edin. Bilgi: info@yikanio.com`;
          const emailMesaj = `Sayın ${ad},\n\nYıkanio demo süreniz 3 gün içinde sona eriyor (${new Date(firma.demo_bitis).toLocaleDateString("tr-TR")}).\n\nAboneliğe geçmek için uygulamanızdaki "Hesabım" sekmesini ziyaret edin.\n\nYıkanio Ekibi\ninfo@yikanio.com`;

          if (tel) {
            const ok = await smsSend(tel, smsMesaj);
            await logKaydet(firma.id, "demo_3gun", "sms", ok);
            if (ok) sonuclar.push(`${firma.ad}: Demo 3 gün SMS gönderildi`);
          }
          if (email) {
            const ok = await emailSend(email, "Yıkanio — Demo Süreniz 3 Gün İçinde Sona Eriyor", emailMesaj);
            await logKaydet(firma.id, "demo_3gun", "email", ok);
            if (ok) sonuclar.push(`${firma.ad}: Demo 3 gün email gönderildi`);
          }
        }

        // Demo bitti (bugün veya geçmiş, hesap hala demo)
        if (bitisGun <= 0 && bitisGun >= -1) {
          const smsMesaj = `Sayın ${ad}, Yıkanio demo süreniz sona erdi. Hizmetlerimizden yararlanmaya devam etmek için abonelik satın alın. Bilgi: info@yikanio.com`;
          const emailMesaj = `Sayın ${ad},\n\nYıkanio demo süreniz sona ermiştir.\n\nHizmetlerimizden yararlanmaya devam etmek için uygulamanızdaki "Hesabım" sekmesinden abonelik satın alabilirsiniz.\n\nYıkanio Ekibi\ninfo@yikanio.com`;

          if (tel) {
            const ok = await smsSend(tel, smsMesaj);
            await logKaydet(firma.id, "demo_bitti", "sms", ok);
            if (ok) sonuclar.push(`${firma.ad}: Demo bitti SMS gönderildi`);
          }
          if (email) {
            const ok = await emailSend(email, "Yıkanio — Demo Süreniz Sona Erdi", emailMesaj);
            await logKaydet(firma.id, "demo_bitti", "email", ok);
            if (ok) sonuclar.push(`${firma.ad}: Demo bitti email gönderildi`);
          }
        }
      }

      // ── ÖDEME YAKLAŞIYOR ──────────────────────────────────────────────────
      if (durum === "aktif" && firma.sonraki_odeme_tarihi) {
        const odemeGun = Math.ceil(
          (new Date(firma.sonraki_odeme_tarihi).getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24)
        );

        // 3 gün kaldı
        if (odemeGun === 3) {
          const paketAd = firma.paket || "starter";
          const fiyatlar: Record<string, number> = { starter: 1250, pro: 2450, enterprise: 4500 };
          const fiyat = fiyatlar[paketAd] || 0;
          const smsMesaj = `Sayın ${ad}, Yıkanio ${paketAd} abonelik ödemeniz (₺${fiyat}) 3 gün içinde alınacak. Bilgi: info@yikanio.com`;
          const emailMesaj = `Sayın ${ad},\n\nYıkanio ${paketAd} abonelik ödemeniz (₺${fiyat}) ${new Date(firma.sonraki_odeme_tarihi).toLocaleDateString("tr-TR")} tarihinde alınacaktır.\n\nYıkanio Ekibi\ninfo@yikanio.com`;

          if (tel) {
            const ok = await smsSend(tel, smsMesaj);
            await logKaydet(firma.id, "odeme_3gun", "sms", ok);
            if (ok) sonuclar.push(`${firma.ad}: Ödeme 3 gün SMS gönderildi`);
          }
          if (email) {
            const ok = await emailSend(email, "Yıkanio — Yaklaşan Ödeme Hatırlatması", emailMesaj);
            await logKaydet(firma.id, "odeme_3gun", "email", ok);
            if (ok) sonuclar.push(`${firma.ad}: Ödeme 3 gün email gönderildi`);
          }
        }
      }

      // ── ÖDEME GECİKMİŞ ───────────────────────────────────────────────────
      if ((durum === "aktif" || durum === "gecikme") && firma.sonraki_odeme_tarihi) {
        const odemeGun = Math.ceil(
          (new Date(firma.sonraki_odeme_tarihi).getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24)
        );

        // 1 gün gecikmiş
        if (odemeGun === -1) {
          const smsMesaj = `Sayın ${ad}, Yıkanio abonelik ödemeniz gecikmiş. Lütfen en kısa sürede ödemenizi yapın, aksi halde hesabınız 5 gün içinde pasife alınacak. Bilgi: info@yikanio.com`;
          if (tel) {
            const ok = await smsSend(tel, smsMesaj);
            await logKaydet(firma.id, "odeme_gecikme", "sms", ok);
            if (ok) sonuclar.push(`${firma.ad}: Ödeme gecikme SMS`);
          }

          // Durumu gecikme'ye al
          await supabase.from("firmalar").update({ hesap_durum: "gecikme" }).eq("id", firma.id);
        }

        // 5 gün gecikmiş → pasife al
        if (odemeGun === -5) {
          await supabase.from("firmalar")
            .update({ hesap_durum: "pasif", aktif: false })
            .eq("id", firma.id);

          const smsMesaj = `Sayın ${ad}, Yıkanio hesabınız ödeme alınamadığı için pasife alınmıştır. Hesabınızı aktifleştirmek için info@yikanio.com adresine yazın.`;
          if (tel) {
            const ok = await smsSend(tel, smsMesaj);
            await logKaydet(firma.id, "hesap_pasif", "sms", ok);
            if (ok) sonuclar.push(`${firma.ad}: Hesap pasife alındı, SMS gönderildi`);
          }
          if (email) {
            const emailMesaj = `Sayın ${ad},\n\nYıkanio hesabınız ödeme alınamadığı için pasife alınmıştır.\n\nHesabınızı aktifleştirmek için info@yikanio.com adresine yazın.\n\nYıkanio Ekibi`;
            const ok = await emailSend(email, "Yıkanio — Hesabınız Pasife Alındı", emailMesaj);
            await logKaydet(firma.id, "hesap_pasif", "email", ok);
            if (ok) sonuclar.push(`${firma.ad}: Hesap pasif email gönderildi`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, islem_sayisi: sonuclar.length, sonuclar }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});