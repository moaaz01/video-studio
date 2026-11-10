/**
 * Fixture catalogue for `waha` (واحة), a fictional digital-services store.
 *
 * Every value is a placeholder chosen to exercise real layout: long Arabic
 * titles, a discount, a rating, a delivery estimate, a unit price, eight orders.
 * It is NOT a client catalogue and must never be shipped as one. Add a new
 * `src/data/<client>.ts` for a real store and register it in `src/data/index.ts`.
 */
import type {Catalogue} from './types';

export const WAHA: Catalogue = {
  services: [
    {
      id: 'identity',
      title: 'هوية بصرية كاملة',
      meta: 'شعار · دليل هوية · تطبيقات',
      price: 1200,
      oldPrice: 1500,
      duration: 'تسليم 5 أيام',
      rating: 4.9,
      reviews: 128,
      tint: '#0F7A5E',
      icon: 'palette',
      blurb:
        'هوية متكاملة تبدأ من الشعار وتنتهي بدليل استخدام واضح: ألوان، خطوط، وقواعد تجعل علامتك متسقة في كل مكان.',
      includes: ['3 مقترحات شعار', 'دليل هوية PDF', 'ملفات مفتوحة وجاهزة'],
      packages: [
        {id: 'basic', name: 'أساسية', price: 900, note: 'شعار فقط'},
        {id: 'pro', name: 'احترافية', price: 1200, oldPrice: 1500, note: 'شعار + دليل'},
        {id: 'full', name: 'كاملة', price: 1800, note: 'هوية + تطبيقات'},
      ],
    },
    {
      id: 'social',
      title: 'إدارة حسابات',
      meta: 'محتوى · جدولة · اشتراك شهري',
      price: 450,
      duration: 'اشتراك شهري',
      rating: 4.8,
      reviews: 94,
      tint: '#C98A2E',
      icon: 'megaphone',
      blurb:
        'خطة محتوى شهرية، تصميم منشورات، وجدولة النشر مع تقرير أداء واضح. فريق واحد يتولى الحساب من الفكرة إلى القياس.',
      includes: ['12 منشوراً شهرياً', 'تقويم نشر', 'تقرير أداء شهري'],
      packages: [
        {id: 'basic', name: 'أساسية', price: 300, note: '8 منشورات'},
        {id: 'pro', name: 'احترافية', price: 450, note: '12 منشوراً'},
        {id: 'full', name: 'كاملة', price: 700, note: '20 منشوراً + فيديو'},
      ],
    },
    {
      id: 'store',
      title: 'متجر إلكتروني',
      meta: 'تصميم · ربط · تسليم',
      price: 2400,
      duration: 'تسليم 10 أيام',
      rating: 5,
      reviews: 61,
      tint: '#6A57A6',
      icon: 'store',
      blurb:
        'متجر جاهز للبيع: واجهة عربية، صفحات منتجات، سلة ودفع، وربط مع بوابة الدفع وواتساب. تدريب قصير عند التسليم.',
      includes: ['واجهة عربية RTL', 'ربط الدفع', 'تدريب فيديو'],
      packages: [
        {id: 'basic', name: 'أساسية', price: 1600, note: 'حتى 20 منتجاً'},
        {id: 'pro', name: 'احترافية', price: 2400, note: 'حتى 100 منتج'},
        {id: 'full', name: 'كاملة', price: 3600, note: 'منتجات غير محدودة'},
      ],
    },
    {
      id: 'video',
      title: 'مونتاج فيديو',
      meta: 'ريلز · إعلانات · موشن',
      price: 300,
      duration: 'تسليم 3 أيام',
      rating: 4.9,
      reviews: 173,
      tint: '#C4553F',
      icon: 'clapper',
      blurb:
        'مونتاج عمودي للنشر: إيقاع سريع، نصوص عربية مقروءة، تصحيح ألوان، وموسيقى مناسبة للمنصة. نسخة واحدة بثلاثة مقاسات.',
      includes: ['مونتاج 30 ثانية', 'نصوص وحركة', '3 مقاسات نشر'],
      packages: [
        {id: 'basic', name: 'أساسية', price: 180, note: 'حتى 20 ثانية'},
        {id: 'pro', name: 'احترافية', price: 300, note: 'حتى 40 ثانية'},
        {id: 'full', name: 'كاملة', price: 480, note: 'حتى 60 ثانية + موشن'},
      ],
    },
  ],
  categories: ['الكل', 'تصميم', 'تسويق', 'متاجر', 'فيديو'],
  orders: [
    {id: '1042', customer: 'سارة الحلبي', service: 'هوية بصرية كاملة', amount: 1200, status: 'paid', date: 'اليوم 14:20'},
    {id: '1041', customer: 'محمد العبد', service: 'متجر إلكتروني', amount: 2400, status: 'paid', date: 'اليوم 12:05'},
    {id: '1040', customer: 'لينا مراد', service: 'إدارة حسابات', amount: 450, status: 'pending', date: 'أمس 21:40'},
    {id: '1039', customer: 'عمر الشامي', service: 'مونتاج فيديو', amount: 300, status: 'paid', date: 'أمس 18:12'},
    {id: '1038', customer: 'ريم قاسم', service: 'هوية بصرية كاملة', amount: 900, status: 'refunded', date: 'أمس 11:03'},
    {id: '1037', customer: 'خالد منصور', service: 'متجر إلكتروني', amount: 1600, status: 'paid', date: 'أمس 09:47'},
    {id: '1036', customer: 'نور حسن', service: 'مونتاج فيديو', amount: 480, status: 'pending', date: 'أمس 08:15'},
    {id: '1035', customer: 'بشار الخطيب', service: 'إدارة حسابات', amount: 700, status: 'paid', date: 'قبل يومين 22:31'},
  ],
  kpis: [
    {id: 'revenue', label: 'إيرادات الشهر', value: '48,200', delta: '+12.4%', icon: 'wallet'},
    {id: 'orders', label: 'الطلبات', value: '126', delta: '+8.1%', icon: 'package'},
    {id: 'average', label: 'متوسط الطلب', value: '382', delta: '+3.2%', icon: 'trend'},
    {id: 'rating', label: 'رضا العملاء', value: '4.9', delta: '+0.1', icon: 'star'},
  ],
  revenue: [18, 22, 20, 27, 25, 31, 29, 36, 34, 41, 39, 48],
  revenueLabels: ['أسبوع 1', 'أسبوع 4', 'أسبوع 8', 'أسبوع 12'],
  topServices: [
    {name: 'هوية بصرية كاملة', value: '18,400', share: 88},
    {name: 'متجر إلكتروني', value: '12,900', share: 64},
    {name: 'إدارة حسابات', value: '8,700', share: 44},
    {name: 'مونتاج فيديو', value: '5,200', share: 27},
  ],
};
