# BaitBlocker design system

BaitBlocker should feel like a sharp annotation in the margin of something you are already reading: visible, specific, and never a verdict delivered from on high.

## Identity

- **Name:** BaitBlocker
- **Line:** The hook is the message.
- **Display:** Righteous
- **Reading:** Besley
- **Machine labels:** Chivo Mono

The fonts are bundled in `fonts/` under their OFL licences, so the extension never needs to fetch type from a third party.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| Ground | `#f5f4ef` | Main reading surface |
| Ground 2 | `#e9e6dc` | Selected and specimen surfaces |
| Ink | `#1d1a22` | Primary type |
| Ink 2 | `#4a4453` | Supporting copy |
| Ink 3 | `#8b8497` | Machine labels |
| Line | `#cfcabc` | Hairlines and dividers |
| Lead | `#dd3c3c` | A manipulation caught |
| Companion | `#2f7d76` | Active, neutral controls |

Red has one semantic job: BaitBlocker found a tell. On arbitrary webpages the annotation engine may change the red's lightness to preserve contrast, but it stays in the same red family. Teal belongs to controls and neutral state, not findings.

## The Tell

The signature marker is a 6px red dot, a 1px red hairline, and a compact uppercase mechanism label. It appears in the popup index, the settings specimen, and the on-page explanation.

On-page marks use a 1.5px underline plus a narrow, 16% tint behind inline text. New detections blink three times, then settle so reading remains comfortable. Hover or keyboard focus reveals the mechanism and explanation.

## Voice

Address the reader directly. Use short declarative sentences. Name the mechanism without claiming to know the author's intent or deciding what the reader should believe.
