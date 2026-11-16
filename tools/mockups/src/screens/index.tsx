import type {FC} from 'react';
import type {Brand, BrandMode} from '../brands';
import {Dashboard} from './Dashboard';
import {Product} from './Product';
import {Storefront} from './Storefront';

export type ScreenProps = {
  brand: Brand;
  mode: BrandMode;
};

/**
 * Screen registry. A screen is a pure component: brand tokens arrive as props,
 * no data fetching, no router, no timers. The capture script only needs the
 * slug from `screens.json`; this map is the one place that knows how to draw it.
 */
export const SCREENS: Record<string, FC<ScreenProps>> = {
  storefront: Storefront,
  product: Product,
  dashboard: Dashboard,
};
