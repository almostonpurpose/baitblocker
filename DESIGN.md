# BaitBlocker design system

BaitBlocker should feel like a sharp annotation in the margin of something you are already reading: visible, specific, and never a verdict delivered from on high.

## Identity

- **Name:** BaitBlocker
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
| Ink 3 | `#655f72` | Machine labels |
| Line | `#cfcabc` | Hairlines and dividers |
| Lead | `#dd3c3c` | A pattern caught — marks, dots, hairlines |
| Lead text | `#b82929` | The same signal where it has to be read as type |
| Companion | `#2f7d76` | Active, neutral controls |
| Companion text | `#276c66` | Companion where it has to be read as type |

Every colour that carries type clears 4.5:1 against both `Ground` and `Ground 2`, which
matters because `Ground 2` is the hovered and current row in the popup index. The display
reds and teals stay on marks, dots, hairlines and filled controls, where that ratio does
not apply.

Red has one semantic job: BaitBlocker found a pattern. On arbitrary webpages the annotation engine may change the red's lightness to preserve contrast, but it stays in the same red family. Teal belongs to controls and neutral state, not findings.

## The mark

The signature marker is a 6px red dot, a 1px red hairline, and a compact uppercase mechanism label. It appears in the popup index and the on-page explanation.

On-page marks use a 1.5px underline plus a narrow, 16% tint behind inline text. New detections blink three times, then settle so reading remains comfortable. Hover or keyboard focus reveals the mechanism and explanation.

## Voice

Address the reader directly. Use short declarative sentences. Name the mechanism without claiming to know the author's intent or deciding what the reader should believe.
