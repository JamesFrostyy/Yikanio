import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHOPIER_API_KEY = Deno.env.get("SHOPIER_API_KEY") || "";
const SHOPIER_API_SECRET = Deno.env.get("SHOPIER_API_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// SMS paket tanımları — Shopier'daki ürün ID'leriyle eşleştirin
const SMS_PAKETLER: Record<string, { adet: number; ad: string }> = {
  "sms-100":  { adet: 100,  ad: "100 SMS Paketi" },
  "sms-250":  { adet: 250,  ad: "250 SMS Paketi" },
  "sms-500":  { adet: 500,  ad: "500 SMS Paketi" },
  "sms-1000": { adet: 1000, ad: "1000 SMS Paketi" },
};

// Abonelik paket tanımları
const ABONELIK_PAKETLER: Record<string, { paket: string; ad: string }> = {
  "yikanio-starter":    { paket: "starter",    ad: "Starter Abonelik" },
  "yikanio-pro":        { paket: "pro",        ad: "Pro Abonelik" },
  "yikanio-enterprise": { paket: "enterprise", ad: "Enterprise Abonelik" },
};

serve(async (req) => {
  // Sadece POST kabul et
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();

    // Shopier webhook payload
    // Shopier'ın gönderdiği alanlar: order_id, email, product_id, status vb.
    const { email, product_id, status, payment_status } = body;

    // Sadece başarılı ödemeleri işle
    if (status !== "complete" && payment_status !== "approved") {
      return new Response(JSON.stringify({ ok: false, reason: "Ödeme onaylanmadı" }), { status: 200 });
    }

    if (!email || !product_id) {
      return new Response(JSON.stringify({ ok: false, reason: "Eksik veri" }), { status: 400 });
    }

    // Firmayı email ile bul
    const { data: firmalar } = await supabase
      .from("firmalar")
      .select("*")
      .eq("email", email)
      .single();

    if (!firmalar) {
      return new Response(JSON.stringify({ ok: false, reason: "Firma bulunamadı" }), { status: 404 });
    }

    const firma = firmalar;

    // ── SMS PAKETİ Mİ? ───────────────────────────────────────────────────
    if (SMS_PAKETLER[product_id]) {
      const paket = SMS_PAKETLER[product_id];
      const mevcutKredi = firma.sms_kredisi || 0;
      const yeniKredi = mevcutKredi + paket.adet;

      await supabase
        .from("firmalar")
        .update({ sms_kredisi: yeniKredi })
        .eq("id", firma.id);

      // Log kaydet
      await supabase.from("bildirim_log").insert({
        firma_id: firma.id,
        tip: "sms_paket_satin_alindi",
        kanal: "shopier_webhook",
        basarili: true,
        tarih: new Date().toISOString(),
        detay: JSON.stringify({ paket: paket.ad, eklenen: paket.adet, yeni_toplam: yeniKredi }),
      });

      return new Response(
        JSON.stringify({ ok: true, mesaj: `${paket.adet} SMS kredisi eklendi. Yeni bakiye: ${yeniKredi}` }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ── ABONELİK PAKETİ Mİ? ─────────────────────────────────────────────
    if (ABONELIK_PAKETLER[product_id]) {
      const paketBilgi = ABONELIK_PAKETLER[product_id];
      const bugun = new Date().toISOString();
      const birAySonra = new Date();
      birAySonra.setMonth(birAySonra.getMonth() + 1);

      await supabase
        .from("firmalar")
        .update({
          paket: paketBilgi.paket,
          hesap_durum: "aktif",
          aktif: true,
          abonelik_baslangic: bugun,
          son_odeme_tarihi: bugun,
          sonraki_odeme_tarihi: birAySonra.toISOString(),
        })
        .eq("id", firma.id);

      // Log kaydet
      await supabase.from("bildirim_log").insert({
        firma_id: firma.id,
        tip: "abonelik_aktif",
        kanal: "shopier_webhook",
        basarili: true,
        tarih: new Date().toISOString(),
        detay: JSON.stringify({ paket: paketBilgi.ad }),
      });

      return new Response(
        JSON.stringify({ ok: true, mesaj: `${paketBilgi.ad} aktif edildi` }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Bilinmeyen ürün
    return new Response(
      JSON.stringify({ ok: false, reason: `Bilinmeyen ürün: ${product_id}` }),
      { status: 200 }
    );

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});