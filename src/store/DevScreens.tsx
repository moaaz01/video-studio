/**
 * Dev harness for the store screens: renders one screen at one time value so a
 * designer (human or agent) can eyeball a real still at 2× instead of guessing.
 *
 *   npx remotion still StoreDev out/store-dev/home.png --props='{"screen":"home","t":40}'
 *
 * Not part of the film — `StoreDev` is never rendered into a master.
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {StoreHome, ProductScreen, CheckoutSheet, OrderSuccess} from './screens/buyer';
import {AdminHome, AdminOrders, BroadcastSheet, StatsScreen, SecurityScreen} from './screens/owner';
import {ChatScreen, WalletScreen, FeaturesScreen, SuccessToast} from './screens/extras';

type Shot = {dp: number; t: number};

const SCREENS: Record<string, React.FC<Shot>> = {
  home: StoreHome,
  product: ProductScreen,
  checkout: CheckoutSheet,
  success: OrderSuccess,
  admin: AdminHome,
  orders: AdminOrders,
  broadcast: BroadcastSheet,
  stats: StatsScreen,
  security: SecurityScreen,
  chat: ChatScreen,
  wallet: WalletScreen,
  features: FeaturesScreen,
  toast: SuccessToast,
};

export type StoreDevProps = {screen?: string; t?: number; dp?: number; frame?: boolean};

export const StoreDev: React.FC<StoreDevProps> = ({screen = 'home', t = 40, dp = 2, frame = true}) => {
  const C = SCREENS[screen] ?? SCREENS.home;
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(120% 90% at 50% 10%, #0B2B33 0%, #06171F 45%, #030A0F 100%)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          borderRadius: frame ? 44 * dp * 0.5 : 0,
          overflow: 'hidden',
          boxShadow: frame ? `0 ${30 * dp}px ${70 * dp}px -${10 * dp}px rgba(0,0,0,0.65)` : 'none',
        }}
      >
        <C dp={dp} t={t} />
      </div>
    </AbsoluteFill>
  );
};
