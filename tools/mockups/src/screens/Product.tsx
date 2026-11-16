import {useState} from 'react';
import type {CSSProperties} from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Heart,
  MessageSquare,
  Minus,
  Plus,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Star,
  Zap,
} from 'lucide-react';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {getCatalogue} from '../data';
import {ServiceGlyph} from './ServiceGlyph';
import {money, type Brand} from '../brands';

export function Product({brand}: {brand: Brand}) {
  const service = getCatalogue(brand.slug).services[0];
  const [pkg, setPkg] = useState('pro');
  const [qty, setQty] = useState(1);
  const selected = service.packages.find((p) => p.id === pkg) ?? service.packages[1];

  return (
    <div className="pd" data-screen="product" style={{'--tint': service.tint} as CSSProperties}>
      <div className="pd-art">
        <div className="pd-art__grid" />
        <div className="pd-art__rings" />
        <div className="pd-art__orb">
          <ServiceGlyph kind={service.icon} size={44} />
        </div>

        <div className="pd-top">
          <div className="pd-top__side">
            <button className="icon-btn icon-btn--glass" aria-label="رجوع">
              <ArrowRight size={18} strokeWidth={2} />
            </button>
            <button className="icon-btn icon-btn--glass" aria-label="مشاركة">
              <Share2 size={17} strokeWidth={1.9} />
            </button>
          </div>
          <button className="icon-btn icon-btn--glass" aria-label="حفظ">
            <Heart size={17} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className="pd-sheet">
        <div className="pd-kicker">
          <Badge variant="success" label="الأكثر طلباً" />
          <span className="pd-rating">
            <Star size={12} fill="currentColor" strokeWidth={0} />
            {service.rating}
            <span>({service.reviews} تقييماً)</span>
          </span>
        </div>

        <h1 className="pd-title">{service.title}</h1>
        <p className="pd-sub">{service.meta}</p>

        <div className="pd-price-row">
          <div className="pd-price money">{money(selected.price, brand)}</div>
          {selected.oldPrice ? (
            <div className="pd-old money">{money(selected.oldPrice, brand)}</div>
          ) : null}
          <span className="pill pill--accent">وفّر 20%</span>
        </div>

        <p className="pd-desc">{service.blurb}</p>

        <div className="pd-divider" />

        <div className="pd-label">
          اختر الباقة
          <span>الأسعار تبدأ من</span>
        </div>
        <div className="pkg-row">
          {service.packages.map((option) => (
            <button
              key={option.id}
              className={`pkg${option.id === pkg ? ' pkg--on' : ''}`}
              onClick={() => setPkg(option.id)}
            >
              {option.id === pkg ? (
                <span className="pkg__check">
                  <Check size={10} strokeWidth={3} />
                </span>
              ) : null}
              <div className="pkg__name">{option.name}</div>
              <div className="pkg__price money">{money(option.price, brand)}</div>
              <div className="pkg__note">{option.note}</div>
            </button>
          ))}
        </div>

        <div className="feature-list">
          {service.includes.map((item) => (
            <div key={item} className="feature">
              <Check size={13} strokeWidth={2.6} />
              {item}
            </div>
          ))}
          <div className="feature">
            <Clock size={13} strokeWidth={2.2} />
            {service.duration}
          </div>
          <div className="feature">
            <ShieldCheck size={13} strokeWidth={2.2} />
            تعديلان مجانيان بعد التسليم
          </div>
        </div>

        <div className="pd-assurance">
          <div className="pd-assurance__item">
            <ShieldCheck size={12} strokeWidth={2.2} />
            دفع آمن
          </div>
          <div className="pd-assurance__item">
            <Zap size={12} strokeWidth={2.2} />
            تسليم سريع
          </div>
          <div className="pd-assurance__item">
            <MessageSquare size={12} strokeWidth={2.2} />
            دعم مباشر
          </div>
        </div>

        <div className="pd-steps">
          <div className="pd-step">
            <span className="pd-step__n">1</span>
            <span className="pd-step__t">تختار الباقة</span>
          </div>
          <div className="pd-step">
            <span className="pd-step__n">2</span>
            <span className="pd-step__t">نبدأ التنفيذ</span>
          </div>
          <div className="pd-step">
            <span className="pd-step__n">3</span>
            <span className="pd-step__t">تستلم الملفات</span>
          </div>
        </div>

        <div className="pd-faq">
          <span>الأسئلة الشائعة</span>
          <ChevronDown size={14} strokeWidth={2} />
        </div>

        <div className="pd-buy">
          <div className="pd-buy__cta">
            <Button
              label="أضف إلى السلة"
              variant="primary"
              size="lg"
              width="100%"
              icon={<ShoppingBag size={16} strokeWidth={2} />}
            />
          </div>
          <div className="qty">
            <button className="qty__btn" aria-label="أنقص" onClick={() => setQty(Math.max(1, qty - 1))}>
              <Minus size={12} strokeWidth={2.4} />
            </button>
            <span className="qty__value money">{qty}</span>
            <button className="qty__btn" aria-label="أزد" onClick={() => setQty(qty + 1)}>
              <Plus size={12} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
