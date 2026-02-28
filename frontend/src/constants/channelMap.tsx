/**
 * Channel mapping for ticket contact channels
 * Maps backend enum values to display labels
 */

export const CHANNEL_MAP: Record<string, { label_en: string; label_he: string }> = {
  phone: {
    label_en: 'Phone',
    label_he: 'טלפון',
  },
  whatsapp: {
    label_en: 'WhatsApp',
    label_he: 'WhatsApp',
  },
  email: {
    label_en: 'Email',
    label_he: 'אימייל',
  },
  other: {
    label_en: 'Other',
    label_he: 'אחר',
  },
};

/**
 * Get localized channel label
 * @param channelCode - Backend channel code (phone, whatsapp, email, other)
 * @param locale - Current locale (en, he)
 * @returns Localized label or the code if not found
 */
export const getChannelLabel = (channelCode: string | undefined, locale: string = 'en'): string => {
  if (!channelCode) return '-';
  const config = CHANNEL_MAP[channelCode];
  if (!config) return channelCode;
  return locale === 'he' ? config.label_he : config.label_en;
};
