# Komo mascot usage

Komo is KOMOLA's friendly red panda for onboarding, rewards, empty states,
transaction feedback, invoices, offline states, and helpful guidance. Meaningful
status information always remains real HTML text; Komo supports the message.

## Assets

Approved transparent PNG assets live in `public/mascot/komo/`. The central
mapping is `shared/lib/mascot/komo.ts`, and UI code should use the typed
`KomoAction` rather than hard-coding asset paths.

The PNG artwork is the primary web asset. The supplied SVG wrappers are kept in
the repository source pack but are not used by the web app.

## Components

- `Komo` renders one approved pose with stable dimensions and responsive sizes.
- `KomoMessage` provides a restrained guidance or completion card.
- `KomoEmptyState` is for buyer/seller empty states with an optional CTA.
- `KomoStatus` supports offline, syncing, waiting, success, and recoverable
  failure states.

## Action guidance

- Onboarding: `wave`, `happy`, `produce`, `curious`, `celebrate`
- Buyer: `shopping`, `qr`, `guide`, `success`, `reward`, `approved`, `streak`
- Seller: `wave`, `produce`, `idle`, `qr`, `invoice`, `working`, `celebrate`
- Payment: `success`, `idle`, `failed`
- Offline/sync: `offline`, `syncing`, `success`, `failed`

Do not place Komo beside every navigation item, input, button, table row, or
statistic. Do not use Komo instead of conventional security, fraud, permission,
or critical financial warning UI.

## Accessibility and motion

Use descriptive `alt` text when Komo communicates a state. Use decorative mode
when the adjacent HTML already communicates the same meaning. Only the wrapper
may animate, and the animation must be disabled or reduced under
`prefers-reduced-motion`.

