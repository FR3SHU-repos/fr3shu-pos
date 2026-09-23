export const komoAssets = {
  wave: "/mascot/komo/komo-wave.png",
  happy: "/mascot/komo/komo-happy.png",
  wink: "/mascot/komo/komo-wink.png",
  excited: "/mascot/komo/komo-excited.png",
  curious: "/mascot/komo/komo-curious.png",
  caring: "/mascot/komo/komo-caring.png",
  "open-arms": "/mascot/komo/komo-open-arms.png",
  celebrate: "/mascot/komo/komo-celebrate.png",
  shopping: "/mascot/komo/komo-shopping.png",
  produce: "/mascot/komo/komo-produce.png",
  reward: "/mascot/komo/komo-reward.png",
  mobile: "/mascot/komo/komo-mobile.png",
  qr: "/mascot/komo/komo-qr.png",
  invoice: "/mascot/komo/komo-invoice.png",
  guide: "/mascot/komo/komo-guide.png",
  approved: "/mascot/komo/komo-approved.png",
  success: "/mascot/komo/komo-success.png",
  failed: "/mascot/komo/komo-failed.png",
  offline: "/mascot/komo/komo-offline.png",
  syncing: "/mascot/komo/komo-syncing.png",
  idle: "/mascot/komo/komo-idle.png",
  working: "/mascot/komo/komo-working.png",
  reminder: "/mascot/komo/komo-reminder.png",
  streak: "/mascot/komo/komo-streak.png",
} as const;

export type KomoAction = keyof typeof komoAssets;

