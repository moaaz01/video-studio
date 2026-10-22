/**
 * Demo copy for the film's screens — every string traces to the app's own tables.
 *
 * Sources (read-only app at `bot-store-saas/webapp/src`):
 *   - store identity, products, packages, prices, wallet ledger: `lib/api/mock/fixtures.ts`
 *     (SAMPLE DATA — labelled on the end card, never presented as real customers)
 *   - storefront strings: `storefront/screens/{Home,Product,Search,Wallet,Orders}.svelte`
 *   - checkout/success: `storefront/components/CheckoutSheet.svelte`, `screens/OrderDetail.svelte`
 *   - admin strings: `admin/screens/{home,stats,orders,settings}/…`, `admin/sections.ts`
 *   - order status labels: `lib/orders/admin.ts` and `lib/orders/status.ts`
 *
 * Rules: no SaaS/tenant vocabulary, no invented ratings/users, no price claims
 * in the voice-over. Numbers shown are the app's own sample data.
 */

export const STORE = {
  name: 'متجر الشام للشحن',
  handle: '@shamshop_bot',
  welcome: 'أهلاً بك في متجر الشام. اشحن ألعابك واشترِ بطاقاتك بثوانٍ من رصيدك.',
  support: '@shamshop_support',
} as const;

/** Storefront Home (Home.svelte). */
export const HOME = {
  hello: 'أهلاً بك',
  question: 'ماذا تريد أن تشتري اليوم؟',
  search: 'ابحث في المتجر',
  section: 'التصنيفات',
  tabs: ['الرئيسية', 'الطلبات', 'المحفظة', 'حسابي'] as const,
} as const;

/** Root categories as the demo store seeds them (fixtures.ts). */
export const CATEGORIES = [
  {label: 'ألعاب', sub: 'ببجي · فري فاير · جينشن', glyph: '◈'},
  {label: 'بطاقات رقمية', sub: 'آيتونز · جوجل بلاي · ستيم', glyph: '▤'},
  {label: 'أرقام مؤقتة', sub: 'واتساب · تلجرام', glyph: '◍'},
  {label: 'سوشيال', sub: 'متابعين · مشاهدات', glyph: '◉'},
  {label: 'رصيد موبايل', sub: 'سيريتل · إم تي إن', glyph: '▮'},
  {label: 'اشتراكات', sub: 'نتفلكس · شاهد', glyph: '❖'},
] as const;

/** Product page for the hero product (fixtures.ts id 101). */
export const PRODUCT = {
  name: 'شدّات ببجي موبايل (UC)',
  desc: 'شحن فوري على آيدي اللاعب، بدون كلمة سر.',
  section: 'اختر الباقة',
  qty: 'الكمية',
  field: 'آيدي اللاعب',
  hint: 'تجده في الملف الشخصي داخل اللعبة (8 إلى 12 رقماً)',
  cta: 'تابع للدفع',
  packages: [
    {label: '60 UC', price: '$0.99'},
    {label: '325 UC', price: '$4.99'},
    {label: '660 UC', price: '$9.99', selected: true},
    {label: '1800 UC', price: '$24.99'},
    {label: '3850 UC', price: '$49.99'},
  ],
} as const;

/** Receipt sheet (CheckoutSheet.svelte · Voucher.svelte). */
export const CHECKOUT = {
  title: 'مراجعة الطلب',
  rows: [
    ['الباقة', '660 UC'],
    ['الكمية', '1'],
    ['الإجمالي', '$9.99'],
  ] as Array<[string, string]>,
  pay: 'ادفع $9.99',
  balanceLabel: 'رصيدك الآن',
  balance: '$12.56',
  afterLabel: 'بعد الدفع',
  after: '$3.07',
  note: 'الرصيد يُخصم مرة واحدة فقط',
} as const;

/** Order detail after payment (OrderDetail.svelte). */
export const SUCCESS = {
  title: 'تم الدفع وبدأ تنفيذ طلبك',
  order: 'طلب #1047',
  delivery: 'التسليم',
  codeLabel: 'كود التفعيل',
  code: 'UC-660-8821-4471',
  copy: 'نسخ',
  done: 'تم، استخدمت الكود',
  remaining: 'المتبقي',
  progress: 'التقدم',
} as const;

/** Wallet (Wallet.svelte + the sample ledger in fixtures.ts). */
export const WALLET = {
  title: 'محفظتي',
  sub: 'رصيدك وكل حركة عليه',
  balanceLabel: 'الرصيد المتاح',
  balance: '$12.56',
  deposit: 'اشحن رصيدك',
  movesTitle: 'آخر الحركات',
  moves: [
    {title: 'طلب #1047 - 660 UC', amount: '-$9.99', after: '$12.56', when: 'قبل ساعتين'},
    {title: 'شحن عبر شام كاش', amount: '+$10.00', after: '$22.55', when: 'قبل 5 ساعات'},
    {title: 'طلب #1041 - بطاقة آيتونز', amount: '-$10.60', after: '$12.55', when: 'أمس'},
  ],
} as const;

/** Orders tab (Orders.svelte). */
export const ORDERS = {
  title: 'طلباتي',
  sub: 'تابع كل طلب لحظة بلحظة',
  filters: ['الكل', 'جارية', 'مكتملة', 'ملغاة'],
  rows: [
    {id: '#1047', name: 'شدّات ببجي موبايل (UC)', status: 'قيد التنفيذ', amount: '$9.99'},
    {id: '#1046', name: 'بطاقات آيتونز (متجر أمريكا)', status: 'مكتمل', amount: '$10.60'},
  ],
} as const;

/** Owner dashboard (admin/screens/home/Home.svelte). */
export const ADMIN = {
  hello: 'أهلاً ليث',
  subtitle: 'ملخص المتجر ومتابعة ما يحتاج انتباهك.',
  dayLabel: 'آخر 24 ساعة',
  calm: 'كل شيء يعمل بسلاسة. لا شيء يحتاج تدخّلك الآن.',
  kpis: [
    {label: 'الطلبات', value: '128', hint: '4 قيد التنفيذ', icon: 'orders'},
    {label: 'المبيعات', value: '$3,420', hint: 'الطلبات المنفّذة فقط', icon: 'coin'},
    {label: 'صافي الربح', value: '$1,180', hint: 'بعد تكلفة المصدر', icon: 'chart'},
    {label: 'بانتظارك', value: '3', hint: 'اضغط لفتح القائمة', icon: 'alert'},
  ] as const,
  quickTitle: 'إجراءات سريعة',
  actions: [
    {label: 'المنتجات', hint: 'التصنيفات والباقات والأكواد'},
    {label: 'طلبات الشحن', hint: 'المعلقة والمرفوضة'},
    {label: 'البث', hint: 'راسل عملاءك'},
    {label: 'القنوات', hint: 'القنوات الإجبارية'},
  ] as const,
  tabs: ['الرئيسية', 'الطلبات', 'المنتجات', 'المزيد'] as const,
  ordersTitle: 'الطلبات',
  ordersSub: 'نفّذ الطلبات اليدوية وراجع كل طلب.',
  orders: [
    {id: '#1047', name: 'ببجي · 660 UC', status: 'processing', amount: '$9.99', when: '12:41'},
    {id: '#1046', name: 'آيتونز · بطاقة 10$', status: 'completed', amount: '$10.60', when: '12:38'},
    {id: '#1045', name: 'فري فاير · 520 جوهرة', status: 'completed', amount: '$4.80', when: '12:36'},
    {id: '#1044', name: 'رقم تلجرام مؤقت', status: 'manual', amount: '$0.60', when: '12:33'},
  ] as const,
  broadcast: {
    title: 'راسل عملائك',
    sub: 'رسائل جماعية إلى عملائك — الآن أو في موعد.',
    audience: 'كل العملاء',
    estimate: '1,248 مستلم',
    progress: 0.64,
    sent: '798',
    status: 'يُرسل الآن',
    limits: 'احترام حدود تلجرام تلقائياً',
  },
  stats: {
    title: 'الإحصائيات',
    sub: 'المبيعات والأرباح مقارنة بالفترة السابقة.',
    points: [12, 18, 15, 26, 31, 24, 38, 44, 39, 52, 48, 61],
    salesLabel: 'المبيعات',
    profitLabel: 'صافي الربح',
    compare: 'مقارنة بالفترة السابقة',
  },
  vipTitle: 'مستويات العملاء',
  vip: [
    {name: 'فضي', pct: '3%', members: 64},
    {name: 'ذهبي', pct: '5%', members: 27},
    {name: 'ماسي', pct: '8%', members: 9},
  ] as const,
} as const;

/** Order status labels exactly as `lib/orders/admin.ts` writes them. */
export const ORDER_STATUS: Record<string, {label: string; tone: 'brand' | 'success' | 'warning' | 'danger'}> = {
  processing: {label: 'قيد التنفيذ', tone: 'brand'},
  manual: {label: 'بانتظارك', tone: 'warning'},
  completed: {label: 'مكتمل', tone: 'success'},
  rejected: {label: 'مرفوض', tone: 'danger'},
};

/** Security screen copy (admin settings/security + brief §6). */
export const SECURITY = {
  title: 'الأمان',
  sub: 'الطبقات التي تحمي متجرك.',
  pinLabel: 'رمز PIN',
  pinHint: '6 أرقام لحماية أفعالك المالية',
  lock: 'قفل اللوحة الآن',
  guards: [
    {glyph: '✈', label: 'توقيع تلجرام', note: 'الدخول عبر تلجرام نفسه'},
    {glyph: '⌗', label: 'رمز PIN', note: 'قفل إضافي لأفعال المال'},
    {glyph: '◈', label: 'تشفير الأسرار', note: 'المفاتيح مشفّرة في القاعدة'},
    {glyph: '☰', label: 'سجل ما ينحذف', note: 'كل حركة مسجّلة بوقتها'},
  ] as const,
  auditTitle: 'آخر الحركات',
  audit: [
    ['12:41', 'تعديل سعر', '660 UC'],
    ['12:38', 'موافقة شحن', '$25.00'],
    ['12:36', 'تسجيل دخول', 'جهاز جديد'],
    ['12:33', 'بث', '798 مستلم'],
  ] as Array<[string, string, string]>,
} as const;

/** Contact card — supplied by the operator (the only numbers in the film). */
export const CTA = {
  tg: 't.me/abumooaz1',
  wa: '+90 552 855 2420',
  tgLabel: 'تلجرام',
  waLabel: 'واتساب',
  sub: 'نسختك وأسعارك على الخاص.',
  foot: 'لقطات الواجهة ببيانات تجريبية · الأسعار على الخاص',
} as const;
