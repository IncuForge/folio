# Folio Interface System

Folio is an operations desk for a working catering team: precise, quiet, durable, and easy to scan during service.

**System:** Folio Ledger. **Dials:** variance 4/10, motion 3/10, density 6/10.

## Structure

Desktop uses a 232 px sidebar, 64 px collapsed rail, 38 px title bar and a content canvas capped at 1480 px. Tables and schedules use ruled rows; cards are reserved for summaries and bounded workflows.

Android uses a contextual app bar and four primary destinations: Today, Orders, Calendar and Kitchen. Secondary destinations live in More. Lists replace tables, filters use a bottom sheet, and long forms become short saveable sections.

## Tokens

| Token | Light | Dark |
| --- | --- | --- |
| Canvas | `#F7F7F5` | `#000000` |
| Surface | `#FFFFFF` | `#0A0A0A` |
| Ink | `#171717` | `#FFFFFF` |
| Muted | `#626262` | `#B8B8B8` |
| Rule | `#D8D8D4` | `#343434` |
| Accent | `#1E5B4F` | `#79C9B6` |
| Warning | `#9A4D08` | `#F2AA5A` |
| Danger | `#A12828` | `#FF8E8E` |

Switzer remains the product typeface. Page titles are 30/36 desktop and 26/32 mobile; body is 16/24 and support text 14/20. Controls are 44 px desktop and 48 px touch. Spacing uses 4, 8, 12, 16, 24, 32 and 48. Radius is 6 px for controls and 10 px for overlays.

## Interaction

- Hover changes colour or border and never moves content.
- Page entry uses a subtle 140 ms reveal; navigation uses 180 ms ease-out.
- Skeletons match their eventual content. Empty states offer one next action.
- Errors are adjacent and announced. Reduced-motion removes non-essential motion.

## Migration

1. Tokens, shell, navigation, title bar, command palette and dialogs.
2. Today, Orders, Calendar and Food Library.
3. Order editor, Contacts, Reports and Settings.
4. Onboarding, login, receipts, print and edge states.
5. Flutter Android client using the same tokens and information architecture.
