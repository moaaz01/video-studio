import type {CSSProperties} from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Palette,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Store,
} from 'lucide-react';
import {Card} from '@astryxdesign/core/Card';
import {Badge} from '@astryxdesign/core/Badge';
import {getCatalogue} from '../data';
import type {Service} from '../data/types';
import {ServiceGlyph} from './ServiceGlyph';
import {money, type Brand} from '../brands';

function ServiceArt({service}: {service: Service}) {
  return (
    <div className="product-art" style={{'--tint': service.tint} as CSSProperties}>
      <div className="product-art__grid" />
      <div className="product-art__orb">
        <ServiceGlyph kind={service.icon} />
      </div>
      {service.oldPrice ? (
        <div className="product-art__tag">
          <Badge variant="warning" label={`وفّر ${Math.round((1 - service.price / service.oldPrice) * 100)}%`} />
        </div>
      ) : null}
    </div>
  );
}

export function Storefront({brand}: {brand: Brand}) {
  const {services, categories} = getCatalogue(brand.slug);

  return (
    <div className="sf" data-screen="storefront">
      <header className="sf-head">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden>
            {brand.monogram}
          </div>
          <div>
            <div className="brand-name">{brand.name}</div>
            <div className="brand-tag">{brand.tagline}</div>
          </div>
        </div>
        <div className="sf-actions">
          <button className="icon-btn" aria-label="بحث">
            <Search size={17} strokeWidth={1.8} />
          </button>
          <button className="icon-btn" aria-label="السلة">
            <ShoppingBag size={17} strokeWidth={1.8} />
            <span className="icon-btn__dot">2</span>
          </button>
        </div>
      </header>

      <div className="sf-search">
        <Search size={15} strokeWidth={1.9} />
        <span>ابحث عن خدمة أو باقة…</span>
      </div>

      <section className="sf-hero">
        <div className="sf-hero__copy">
          <span className="pill pill--glass">
            <BadgeCheck size={11} strokeWidth={2.2} />
            عرض هذا الأسبوع
          </span>
          <h1 className="sf-hero__title">
            هوية بصرية
            <br />
            تبدأ من {money(1200, brand)}
          </h1>
          <p className="sf-hero__sub">شعار، دليل هوية، وتطبيقات جاهزة — تسليم خلال 5 أيام.</p>
          <div className="sf-hero__foot">
            <button className="sf-hero__cta">
              اطلب الآن
              <ArrowLeft size={13} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div className="sf-hero__art" aria-hidden>
          <div className="hero-board hero-board--back">
            <div className="hero-board__line" />
            <div className="hero-board__line hero-board__line--short" />
            <div className="hero-board__line" />
            <div className="hero-board__line hero-board__line--short" />
          </div>
          <div className="hero-board">
            <div className="hero-board__row">
              <div className="hero-board__mark">{brand.monogram}</div>
              <div className="hero-board__type">أب</div>
            </div>
            <div className="hero-board__label">نظام الهوية · 2026</div>
            <div className="hero-board__swatches">
              <span className="hero-board__swatch" style={{background: brand.light.accent}} />
              <span className="hero-board__swatch" style={{background: brand.light.accentDeep}} />
              <span className="hero-board__swatch" style={{background: brand.light.gold}} />
              <span className="hero-board__swatch" style={{background: brand.light.ink}} />
            </div>
          </div>
        </div>
      </section>

      <div className="sf-chips">
        {categories.map((category, index) => (
          <button key={category} className={`chip${index === 0 ? ' chip--on' : ''}`}>
            {category}
          </button>
        ))}
      </div>

      <div className="section-head">
        <h2>الأكثر طلباً</h2>
        <button className="section-head__link">
          عرض الكل
          <ArrowLeft size={11} strokeWidth={2.2} />
        </button>
      </div>

      <div className="product-grid">
        {services.map((service) => (
          <Card key={service.id} padding={0} elevation="none" className="product-card">
            <ServiceArt service={service} />
            <div className="product-body">
              <div className="product-title">{service.title}</div>
              <div className="product-meta">{service.meta}</div>
              <div className="product-foot">
                <div className="product-price money">{money(service.price, brand)}</div>
                <button className="product-add" aria-label={`أضف ${service.title}`}>
                  <Plus size={15} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <nav className="sf-tabbar" aria-label="التنقل">
        <div className="sf-tab sf-tab--on">
          <span className="sf-tab__icon">
            <Store size={17} strokeWidth={2} />
          </span>
          الرئيسية
        </div>
        <div className="sf-tab">
          <span className="sf-tab__icon">
            <Palette size={17} strokeWidth={1.8} />
          </span>
          الخدمات
        </div>
        <div className="sf-tab">
          <span className="sf-tab__icon">
            <ShoppingBag size={17} strokeWidth={1.8} />
          </span>
          طلباتي
        </div>
        <div className="sf-tab">
          <span className="sf-tab__icon">
            <Star size={17} strokeWidth={1.8} />
          </span>
          حسابي
        </div>
      </nav>
    </div>
  );
}
