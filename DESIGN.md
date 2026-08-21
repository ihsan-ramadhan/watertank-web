# DESIGN.md

Ground Tank Water Level Monitoring System.

## Dial
ENERGY 1 / RHYTHM 1 / MOTION 1

## Identity
- Style: Industrial telemetry console, data-dense, functional, clear contrast.
- Primary Audience: Facility operators, maintenance technicians.

## Color System
- Canvas: `#0b1120` (Dark slate)
- Card / Panel Surface: `#0f172a` (Slate 900) with border `rgb(51 65 85 / 0.6)` (Slate 700/60)
- Text Primary: `#f1f5f9` (Slate 100)
- Text Secondary / Muted: `#94a3b8` (Slate 400)
- Primary Accent: `#14b8a6` (Teal 500)
- Status Safe: `#34d399` (Emerald 400)
- Status Critical: `#fb7185` (Rose 400)
- Status Info: `#38bdf8` (Sky 400)

## Typography
- Body: Geist Sans (`--font-geist-sans`)
- Metrics & Values: Geist Mono (`--font-geist-mono`)

## Layout & Components
- Uniform 12-column grid for metrics and tank cards.
- Subtle elevation using thin borders instead of heavy floating shadows.
- Distinct states: Loading, Error (with retry), and Empty states.
