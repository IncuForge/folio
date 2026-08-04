---
target: Folio Android mobile UI
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 5
timestamp: 2026-07-28T08-28-35Z
slug: app-clientapplayout-tsx
---
# Folio Android mobile UI critique

## Verdict
The current mobile UI is functional but not yet a convincing mobile product. It preserves Folio's restrained monochrome identity, yet the composition behaves like enlarged desktop pages inside a WebView. Design score: 20/40. Native audit: 9/20.

## Heuristics
Visibility 3/4; real-world match 3/4; control 2/4; consistency 2/4; error prevention 1/4; recognition 3/4; flexibility 1/4; aesthetic minimalism 2/4; error recovery 1/4; help 2/4.

## Priority findings
- P1: Mobile information architecture is desktop-derived. The bottom navigation is sound, but top hamburger duplicates More and the full-screen drawer is oversized and inconsistent.
- P1: The dashboard lacks a useful Today briefing: next event, prep risk, collections, and exceptions should lead.
- P1: Onboarding modal is not mobile-composed and overflows vertically with narrow three-column rows.
- P1: Android platform integration is weak: predictive Back, adaptive navigation for tablets/foldables, IME behavior, and TalkBack form associations are unverified or incomplete.
- P1: Orders, Calendar, and Library preserve desktop-shaped controls and content density instead of mobile task flows.
- P2: Repeated oversized page introductions and full-width CTAs consume the first viewport.
- P2: Persistent product footer is operational clutter on mobile.
- P2: Several controls are below Android's 48dp target and long lists are not demonstrably virtualized.
- P2: Dark theme and styling are tokenized but do not use Android Material roles or dynamic color.
- P3: Two pre-existing gold 3px side borders conflict with the stated anti-reference.

## Positives
- Persistent labeled bottom navigation with visible active state is the right foundation.
- Safe-area padding, reduced-motion handling, large form text, local pairing, and offline/local-first intent are valuable.
- Folio's warm paper, black ink, and restrained rule-based identity remains recognizable.

## Recommendation
A Flutter rewrite is justified only if Android is becoming a first-class product with native gestures, offline persistence, camera/scanner workflows, background sync, tablets, and long-term independent maintenance. Flutter will not fix information architecture automatically. First freeze a versioned sync/API contract and shared schema; then build a task-specific Flutter client using local SQLite/Drift and the existing pairing/sync protocol. If speed and shared maintenance are higher priorities, a dedicated mobile React/Tauri surface could solve most visual problems at much lower cost.
