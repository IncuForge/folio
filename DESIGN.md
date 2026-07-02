# Design System: Folio Menu Paper Vibe

Visual system rules to ensure a high-contrast, premium, paper-like restaurant menu layout.

## Style Strategy
- **Ink and Paper**: The default design feels like a physical menu sheet printed on warm white textured paper.
- **Strict Monochromatic Base**: All borders, buttons, and backgrounds are built from shades of black, charcoal, silver, and warm off-white.
- **Alert Highlights**: Saturated, deep primary warning tones (Red, Amber, Green, Navy) are used exclusively for notifications and milestone checkmarks.

## Color Palette (OKLCH & Hex)

| Name | Hue / Role | Hex Value | OKLCH |
|---|---|---|---|
| `--bg-app` | Body Background (Warm Paper) | `#faf9f6` | `oklch(0.98 0.003 70)` |
| `--bg-card` | Surface / Container (Clean Sheet) | `#ffffff` | `oklch(1.0 0 0)` |
| `--ink` | Primary Text / Rules | `#18181b` | `oklch(0.18 0.005 240)` |
| `--ink-muted` | Secondary Text / Subheaders | `#52525b` | `oklch(0.42 0.005 240)` |
| `--border-ink` | Hairline Rules / Separators | `#d4d4d8` | `oklch(0.85 0.005 240)` |
| `--border-strong` | Strong Borders / Headers | `#18181b` | `oklch(0.18 0.005 240)` |

### Accent Colors (For Alerts Only)
- **Overdue (Red)**: `#991b1b` / `oklch(0.24 0.16 28)`
- **Urgent (Amber)**: `#92400e` / `oklch(0.35 0.13 60)`
- **Paid (Green)**: `#065f46` / `oklch(0.30 0.09 164)`
- **Active (Blue)**: `#1e3a8a` / `oklch(0.23 0.10 264)`

## Typography

### Families
- **Unified Font Family**: Inter (clean sans-serif used uniformly across body text, headings, numbers, and key UI controls to ensure high visual consistency in product views).

### Scale & Spacing
- Heading 1 (Page Title): `2.25rem` / `fontWeight: 800` / `letter-spacing: -0.03em`.
- Heading 2 (Sections): `1.5rem` / `fontWeight: 700` / `letter-spacing: -0.02em`.
- Body: `0.95rem` / Line height: `1.5` / Max width: `72ch`.
- Headings use `text-wrap: balance` to prevent awkward typography orphans.
- Paragraph text uses `text-wrap: pretty` to reduce orphan words at the end of text lines.

## Layout & Components

### Spacing Rules
- Margin / Padding multipliers: `0.5rem`, `1rem`, `1.5rem`, `3rem`.
- Elements are separated using clean whitespace or single `1px solid var(--border-ink)` hairline rules.

### Borders & Shadows
- **No Box Shadows**: Absolutely no shadows. Separation is created using solid borders and background tint transitions.
- **Sharp Radii**: Border radius is limited to `4px` (small UI details like checkboxes or small tags) or `0px` (large containers, cards, tables).
- **Zero Glassmorphism**: No background blur filters or semi-transparent cards.

### Buttons & Fields
- Buttons use solid borders and clear text: `border: 1px solid var(--border-strong); background: var(--bg-card); color: var(--ink)`.
- Input elements are un-rounded boxes with bottom-only borders or simple light boxes: `border: 1px solid var(--border-ink)`.
