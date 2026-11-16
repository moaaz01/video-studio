/**
 * The catalogue registry. A brand key must exist in both `brands.json` (tokens)
 * and here (content). Adding a client is two files and one line — never a
 * component edit.
 */
import type {Catalogue} from './types';
import {WAHA} from './waha';

export const CATALOGUES: Record<string, Catalogue> = {
  waha: WAHA,
};

export function hasCatalogue(brandSlug: string): boolean {
  return Boolean(CATALOGUES[brandSlug]);
}

export function getCatalogue(brandSlug: string): Catalogue {
  const catalogue = CATALOGUES[brandSlug];
  if (!catalogue) {
    throw new Error(`No catalogue for brand "${brandSlug}". Add src/data/${brandSlug}.ts and register it.`);
  }
  return catalogue;
}

export type {Catalogue, Kpi, Order, Service, ServiceIcon, TopService} from './types';
