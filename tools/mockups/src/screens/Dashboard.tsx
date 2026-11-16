import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  CircleHelp,
  Download,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table';
import {getCatalogue} from '../data';
import type {Order} from '../data/types';
import {money, type Brand} from '../brands';

const NAV = [
  {label: 'نظرة عامة', icon: LayoutDashboard, on: true},
  {label: 'الطلبات', icon: ShoppingBag, badge: '12'},
  {label: 'الخدمات', icon: Boxes},
  {label: 'العملاء', icon: Users},
  {label: 'التقارير', icon: BarChart3},
];

const MANAGE = [
  {label: 'الإعدادات', icon: Settings},
  {label: 'المساعدة', icon: CircleHelp},
];

const KPI_ICONS = {wallet: Wallet, package: Package, trend: TrendingUp, star: Star} as const;

function Chart({revenue, labels}: {revenue: number[]; labels: string[]}) {
  const w = 560;
  const h = 118;
  const pad = 6;
  const max = Math.max(...revenue);
  const min = Math.min(...revenue);
  const points = revenue.map((value, index) => {
    const x = pad + (index * (w - pad * 2)) / (revenue.length - 1);
    const y = h - pad - ((value - min) / (max - min)) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
  const last = points[points.length - 1];

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="الإيرادات">
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-accent)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--brand-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={pad}
            x2={w - pad}
            y1={h * fraction}
            y2={h * fraction}
            stroke="var(--brand-border)"
            strokeDasharray="3 5"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#rev-fill)" />
        <path d={line} fill="none" stroke="var(--brand-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="4.5" fill="var(--brand-surface)" stroke="var(--brand-accent)" strokeWidth="2.4" />
      </svg>
      <div className="chart__labels">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </>
  );
}

function statusBadge(status: Order['status']) {
  if (status === 'paid') return <Badge variant="success" label="مدفوع" />;
  if (status === 'pending') return <Badge variant="warning" label="قيد الانتظار" />;
  return <Badge variant="error" label="مُسترجع" />;
}

export function Dashboard({brand}: {brand: Brand}) {
  const {orders, kpis, revenue, revenueLabels, topServices} = getCatalogue(brand.slug);

  return (
    <div className="dash" data-screen="dashboard">
      <aside className="dash-side">
        <div className="dash-brand">
          <div className="brand-mark">{brand.monogram}</div>
          <div>
            <div className="dash-brand__name">{brand.name}</div>
            <div className="dash-brand__tag">لوحة إدارة المتجر</div>
          </div>
        </div>

        <nav className="dash-nav" aria-label="القائمة">
          {NAV.map((item) => (
            <div key={item.label} className={`dash-nav__item${item.on ? ' dash-nav__item--on' : ''}`}>
              <item.icon size={15} strokeWidth={1.9} />
              {item.label}
              {item.badge ? <span className="dash-nav__badge">{item.badge}</span> : null}
            </div>
          ))}
          <div className="dash-nav__label">الإدارة</div>
          {MANAGE.map((item) => (
            <div key={item.label} className="dash-nav__item">
              <item.icon size={15} strokeWidth={1.9} />
              {item.label}
            </div>
          ))}
        </nav>

        <div className="side-activity">
          <div className="side-activity__title">اليوم</div>
          <div className="side-activity__item">
            <span className="side-activity__dot side-activity__dot--accent" />
            3 طلبات جديدة
          </div>
          <div className="side-activity__item">
            <span className="side-activity__dot side-activity__dot--gold" />
            2 رسائل بانتظار الرد
          </div>
          <div className="side-activity__item">
            <span className="side-activity__dot side-activity__dot--rose" />
            1 تقييم جديد
          </div>
        </div>

        <div className="side-plan">
          <div className="side-plan__title">خطة المتجر</div>
          <div className="side-plan__meta">الطلبات هذا الشهر</div>
          <div className="side-plan__bar">
            <div className="side-plan__fill" style={{inlineSize: '62%'}} />
          </div>
          <div className="side-plan__foot">
            <span>78 / 126</span>
            <span>62%</span>
          </div>
        </div>

        <div className="dash-side__foot">
          <div className="dash-user">
            <Avatar name="ريم قاسم" size={32} shape="circle" />
            <div>
              <div className="dash-user__name">ريم قاسم</div>
              <div className="dash-user__role">مديرة المتجر</div>
            </div>
            <LogOut size={13} strokeWidth={1.9} style={{marginInlineStart: 'auto', color: 'var(--brand-muted)'}} />
          </div>
          <div className="pill pill--accent" style={{marginBlockStart: 8}}>
            <LifeBuoy size={10} strokeWidth={2} />
            الدعم متاح
          </div>
        </div>
      </aside>

      <main className="dash-main">
        <div className="dash-top">
          <div>
            <div className="dash-top__title">لوحة التحكم</div>
            <div className="dash-top__sub">{brand.name} / الرئيسية</div>
          </div>
          <div className="dash-search">
            <Search size={13} strokeWidth={2} />
            ابحث عن طلب أو عميل…
          </div>
          <div className="dash-top__actions">
            <button className="icon-btn" aria-label="الإشعارات">
              <Bell size={15} strokeWidth={1.9} />
              <span className="icon-btn__dot">3</span>
            </button>
            <Avatar name="ريم قاسم" size={32} shape="circle" />
            <ChevronDown size={13} strokeWidth={2} style={{color: 'var(--brand-muted)'}} />
          </div>
        </div>

        <div className="dash-content">
          <div className="dash-heading">
            <div>
              <h1>نظرة عامة</h1>
              <p>آخر تحديث: اليوم 14:30 · بيانات تجريبية</p>
            </div>
            <div className="dash-heading__actions">
              <Button label="تصدير" variant="secondary" size="sm" icon={<Download size={13} strokeWidth={2} />} />
              <Button label="طلب جديد" variant="primary" size="sm" icon={<Plus size={13} strokeWidth={2.4} />} />
            </div>
          </div>

          <div className="kpi-grid">
            {kpis.map((kpi) => {
              const Icon = KPI_ICONS[kpi.icon];
              return (
                <div key={kpi.id} className="kpi">
                  <div className="kpi__top">
                    <span className="kpi__label">{kpi.label}</span>
                    <span className="kpi__icon">
                      <Icon size={14} strokeWidth={1.9} />
                    </span>
                  </div>
                  <div className="kpi__value money" dir={kpi.id === 'revenue' ? 'ltr' : undefined}>
                    {kpi.value}
                    {kpi.id === 'revenue' ? <small>{brand.currency}</small> : null}
                  </div>
                  <div className="kpi__delta">
                    <ArrowUpRight size={10} strokeWidth={2.4} />
                    {kpi.delta} هذا الشهر
                  </div>
                </div>
              );
            })}
          </div>

          <div className="dash-row">
            <section className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">الإيرادات</div>
                  <div className="panel__sub">آخر 12 أسبوعاً</div>
                </div>
                <div className="panel__value money" dir="ltr">
                  48,200 <small>{brand.currency}</small>
                </div>
              </div>
              <Chart revenue={revenue} labels={revenueLabels} />
            </section>

            <section className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">أفضل الخدمات</div>
                  <div className="panel__sub">حسب الإيراد</div>
                </div>
                <span className="pill pill--accent">هذا الشهر</span>
              </div>
              <div className="top-list">
                {topServices.map((service, index) => (
                  <div key={service.name} className="top-item">
                    <span className="top-item__rank">{index + 1}</span>
                    <div className="top-item__body">
                      <div className="top-item__name">{service.name}</div>
                      <div className="top-item__bar">
                        <div className="top-item__fill" style={{inlineSize: `${service.share}%`}} />
                      </div>
                    </div>
                    <span className="top-item__value money">{service.value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="panel table-panel">
            <div className="panel__head">
              <div>
                <div className="panel__title">أحدث الطلبات</div>
                <div className="panel__sub">5 طلبات من أصل 126</div>
              </div>
              <button className="section-head__link">
                عرض الكل
                <ArrowUpRight size={11} strokeWidth={2.2} />
              </button>
            </div>
            <Table density="compact" dividers="rows">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>العميل</TableHeaderCell>
                  <TableHeaderCell>الخدمة</TableHeaderCell>
                  <TableHeaderCell style={{textAlign: 'end'}}>المبلغ</TableHeaderCell>
                  <TableHeaderCell>الحالة</TableHeaderCell>
                  <TableHeaderCell>التاريخ</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="table-customer">
                        <Avatar name={order.customer} size={24} shape="circle" />
                        <div>
                          <div className="table-customer__name">{order.customer}</div>
                          <div className="table-customer__id">#{order.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{order.service}</TableCell>
                    <TableCell style={{textAlign: 'end'}}>
                      <span className="table-amount money">{money(order.amount, brand)}</span>
                    </TableCell>
                    <TableCell>{statusBadge(order.status)}</TableCell>
                    <TableCell>
                      <span className="table-date">{order.date}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="table-foot">
              <span className="table-foot__note">عرض 1–{orders.length} من 126 طلباً</span>
              <div className="table-foot__pages">
                <button className="table-foot__page table-foot__page--on">1</button>
                <button className="table-foot__page">2</button>
                <button className="table-foot__page">3</button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
