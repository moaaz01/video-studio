import {Clapperboard, Megaphone, Palette, Store} from 'lucide-react';
import type {ServiceIcon} from '../data/types';

/** One icon vocabulary for a service, shared by the storefront and detail screens. */
export function ServiceGlyph({kind, size = 22}: {kind: ServiceIcon; size?: number}) {
  const props = {size, strokeWidth: 1.8};
  if (kind === 'palette') return <Palette {...props} />;
  if (kind === 'megaphone') return <Megaphone {...props} />;
  if (kind === 'store') return <Store {...props} />;
  return <Clapperboard {...props} />;
}
