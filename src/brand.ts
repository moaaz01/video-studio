/**
 * Brand config — the only file that changes between clients.
 *
 * Everything the end card, the device frame and the captions say about the brand
 * comes from here. Keep it small: a film needs a name, a mark, one action and the
 * contact details the viewer will actually use.
 */
export type Contact = {kind: 'telegram' | 'whatsapp' | 'web'; label: string; value: string};

export type Brand = {
  /** Latin wordmark, as the brand writes it. */
  name: string;
  /** The name in the film's language, set under the wordmark. */
  nameLocal: string;
  /** One line that says what it is. */
  tagline: string;
  /** `staticFile` path to the icon (optional — falls back to a monogram tile). */
  icon?: string;
  /** Letters shown in the monogram fallback. */
  monogram: string;
  accent: string;
  accentDeep: string;
  /** The single thing the viewer should do. The handle IS the call to action. */
  action: {label: string; value: string; sub?: string};
  contacts: Contact[];
  /** Small print under the action (platform, availability). */
  footnote?: string;
};

export const BRAND: Brand = {
  name: 'StudyAI',
  nameLocal: 'ستادي أي',
  tagline: 'من الصفحة… إلى الفهم',
  monogram: 'S',
  accent: '#0E8A6E',
  accentDeep: '#0A6B56',
  action: {
    label: 'حمّل التطبيق مجانًا',
    value: 't.me/studyai0',
    sub: 'نسخة أندرويد · مجاني بالكامل',
  },
  contacts: [
    {kind: 'whatsapp', label: 'واتساب', value: '+90 552 855 2420'},
    {kind: 'telegram', label: 'تلجرام', value: 't.me/StudyA_1'},
  ],
  footnote: 'التطبيق يُوزَّع عبر تلجرام',
};
