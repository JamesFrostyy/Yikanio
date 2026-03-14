export interface HaliTuru {
  id: string;
  ad: string;
  birimFiyat: number;
  icon: string;
}

export interface HaliKalemi {
  turId: string;
  adet: number;
  m2: number;
  birimFiyat?: number;
}

export interface Siparis {
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

export type PaketTip = 'starter' | 'pro' | 'enterprise';

export type AddonTip = 'ek_sube' | 'ek_kullanici';

export interface Firma {
  id: string;
  ad: string;
  email: string;
  aktif: boolean;
  paket?: PaketTip;
  addonlar?: AddonTip[];
  netgsm_user?: string;
  netgsm_pass?: string;
  netgsm_baslik?: string; 
  sms_kredisi?: number;
  wa_api_key?: string;
  wa_phone_id?: string;
}

// Paket tanımları
export const PAKETLER: Record<PaketTip, {
  ad: string;
  fiyat: number;
  renk: string;
  bg: string;
  ozellikler: string[];
}> = {
  starter: {
    ad: 'Starter',
    fiyat: 1250,
    renk: '#6366F1',
    bg: '#EEF2FF',
    ozellikler: [
      'Sipariş yönetimi',
      'WhatsApp (wa.me)',
      'Fiyat listesi',
      'Müşteri rehberi',
    ],
  },
  pro: {
    ad: 'Pro',
    fiyat: 2450,
    renk: '#0EA5E9',
    bg: '#F0F9FF',
    ozellikler: [
      'Starter özellikleri',
      'WhatsApp Business API',
      'SMS bildirimleri (merkezi havuz)',
      'PDF fatura',
      'Gelişmiş raporlar',
    ],
  },
  enterprise: {
    ad: 'Enterprise',
    fiyat: 4500,
    renk: '#8B5CF6',
    bg: '#F5F3FF',
    ozellikler: [
      'Pro özellikleri',
      'Çoklu şube',
      'Öncelikli destek',
      'Özel entegrasyonlar',
    ],
  },
};

// Addon tanımları — sadece kapasite addları
export const ADDONLAR: Record<AddonTip, {
  ad: string;
  fiyat: number;
  icon: string;
  aciklama: string;
  minPaket: PaketTip;
}> = {
  ek_sube: {
    ad: 'Ek Şube',
    fiyat: 300,
    icon: '🏪',
    aciklama: 'Her ek şube için +₺300/ay',
    minPaket: 'pro',
  },
  ek_kullanici: {
    ad: 'Ek Kullanıcı',
    fiyat: 150,
    icon: '👤',
    aciklama: 'Her ek kullanıcı için +₺150/ay',
    minPaket: 'pro',
  },
};

// Paket yetki kontrolü — addon değil, paket bazlı
export function firmaOzellikVar(
  firma: Firma | null | undefined,
  ozellik:
    | 'wa_me'          // Tüm paketler
    | 'wa_api'         // Pro+
    | 'sms'            // Pro+
    | 'pdf_fatura'     // Pro+
    | 'gelismis_raporlar' // Pro+
    | 'coklu_sube'     // Enterprise
    | 'oncelikli_destek'  // Enterprise
): boolean {
  if (!firma) return false;
  const paket = firma.paket || 'starter';

  switch (ozellik) {
    case 'wa_me':
      return true;
    case 'wa_api':
    case 'pdf_fatura':
    case 'gelismis_raporlar':
      return paket === 'pro' || paket === 'enterprise';
    case 'sms':
      return true;
    case 'coklu_sube':
    case 'oncelikli_destek':
      return paket === 'enterprise';
    default:
      return false;
      
  }
}

export interface StatusCfg {
  label: string;
  color: string;
  bg: string;
  icon: string;
}

export interface ToastState {
  msg: string | null;
  type: string;
}

export interface AuthUser {
  id: string;
  email: string;
  token: string;
  rol?: string | null;
}
export interface AuthUser {
  id: string;
  email: string;
  token: string;
  rol?: string | null;
  refreshToken?: string;   // ← ekle
  expiresIn?: number;      // ← ekle
}