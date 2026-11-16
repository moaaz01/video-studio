/**
 * The data contract every screen reads. A brand supplies tokens; a catalogue
 * supplies the content. Keeping them separate means the same screen can be
 * captured for a second store without touching a component.
 */

export type ServiceIcon = 'palette' | 'megaphone' | 'store' | 'clapper';

export type Service = {
  id: string;
  title: string;
  meta: string;
  price: number;
  oldPrice?: number;
  duration: string;
  rating: number;
  reviews: number;
  tint: string;
  icon: ServiceIcon;
  blurb: string;
  includes: string[];
  packages: Array<{id: string; name: string; price: number; oldPrice?: number; note: string}>;
};

export type Order = {
  id: string;
  customer: string;
  service: string;
  amount: number;
  status: 'paid' | 'pending' | 'refunded';
  date: string;
};

export type KpiIcon = 'wallet' | 'package' | 'trend' | 'star';

export type Kpi = {
  id: string;
  label: string;
  value: string;
  delta: string;
  icon: KpiIcon;
};

export type TopService = {
  name: string;
  value: string;
  share: number;
};

export type Catalogue = {
  services: Service[];
  categories: string[];
  orders: Order[];
  kpis: Kpi[];
  revenue: number[];
  revenueLabels: string[];
  topServices: TopService[];
};
