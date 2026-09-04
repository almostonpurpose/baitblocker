(() => {
  'use strict';

  const DEFAULTS = globalThis.BAITBLOCKER_DEFAULTS;
  const LEVEL = { strict: 0, balanced: 1, sensitive: 2 };
  const MARK = 'baitblocker-mark';
  const TOOLTIP_ID = 'baitblocker-tooltip';
  const UI_ATTRIBUTE = 'data-baitblocker-ui';
  const findings = [];
  const elements = [];
  // Slots freed by retired findings. Without this the table grows forever on pages
  // that rerender constantly, and every reconcile walks the whole history.
  const freeIndices = [];
  const elementIds = new WeakMap();
  const observedRoots = new WeakSet();
  const pending = new Set();
  let settings;
  let scanScheduled = false;
  let publishTimer;
  let tooltip;
  let hideTimer;
  let describedElement = null;
  let revealBurst = 0;
  let revealResetTimer;
  const shadowCss = `
    .baitblocker-mark{position:relative!important;text-decoration-line:underline!important;text-decoration-color:var(--baitblocker-accent,#dd3c3c)!important;text-decoration-thickness:1.5px!important;text-underline-offset:2px!important;text-decoration-skip-ink:none!important}
    .baitblocker-mark.baitblocker-inline{background-image:linear-gradient(transparent 74%,var(--baitblocker-wash,#dd3c3c29) 74%)!important;background-repeat:no-repeat!important;box-decoration-break:clone!important;-webkit-box-decoration-break:clone!important}
    .baitblocker-mark[data-baitblocker-kind="influence"]{text-decoration-style:dotted!important}.baitblocker-mark[data-baitblocker-kind="engagement"]{text-decoration-style:dashed!important}.baitblocker-mark[data-baitblocker-kind="framing"]{text-decoration-style:wavy!important}
    .baitblocker-new{animation:baitblocker-blink .68s ease-in-out 3}.baitblocker-focus{animation:baitblocker-focus .52s ease-in-out 3!important}
    @keyframes baitblocker-blink{0%,100%{filter:none}50%{filter:drop-shadow(0 0 7px var(--baitblocker-accent,#dd3c3c));text-shadow:0 0 8px var(--baitblocker-accent,#dd3c3c)}}
    @keyframes baitblocker-focus{0%,100%{filter:none}50%{filter:drop-shadow(0 0 10px var(--baitblocker-accent,#dd3c3c));text-shadow:0 0 10px var(--baitblocker-accent,#dd3c3c)}}
  `;

  const rules = [
    ['pressure', 0, 'Artificial urgency', 'A deadline is being used to make delay feel costly.', /\b(ends? (today|tonight|soon)|offer expires?|only \d+ (hours?|hrs?|minutes?|mins?)|hurry|act now|last chance|limited[- ]time|sale ends?|before midnight|booking (ends|closes)|time remaining|reserve within)\b/i],
    ['pressure', 0, 'Scarcity pressure', 'Availability is being used to push a quicker decision.', /\b(only \d+ (left|remaining|available)|selling fast|low stock|almost gone|few remaining|while stocks last|high demand)\b/i],
    ['pressure', 0, 'Price anchoring', 'A higher reference price is presented to make the current price feel like a bargain.', /\b(was [£$€]\s?\d+|save \d+%|rrp\b|normally [£$€]\s?\d+|valued at [£$€]\s?\d+|instead of [£$€]\s?\d+)\b/i],
    ['pressure', 1, 'Confirmshaming', 'Declining is worded to make a reasonable choice feel foolish or guilty.', /\b(no,? (i|we) (don.t|do not) want|i (don.t|do not) want to (save|improve|grow|get)|no thanks,? i prefer|keep me (un|)informed)\b/i],
    ['pressure', 1, 'Hidden commitment', 'A future charge or renewal is mentioned in low-prominence copy.', /\b(auto[- ]renew|renews? (at|on)|then [£$€]\s?\d+\s?(per|\/)(month|year)|billed (annually|monthly)|recurring (payment|charge))\b/i],
    ['influence', 0, 'Social proof', 'Other people’s behaviour is presented as evidence for your choice.', /\b(\d+[k,]? (people|customers|buyers|reviews)|\d+ people (are|viewing|bought)|recently (bought|viewed)|customers? (are|love)|trending now|most popular|best[- ]seller)\b/i],
    ['influence', 1, 'Authority cue', 'Expertise, a credential, or a claim of proof is being used to strengthen the appeal.', /\b(expert[- ]?(approved|backed)|doctor[- ]?(approved|recommended)|clinically proven|award[- ]winning|trusted by|#1 |number one|the leading)\b/i],
    ['influence', 1, 'Identity cue', 'The copy invites you to see the choice as an expression of who you are or want to be.', /\b(for (people|women|men|creatives?|founders?) who|join the \w+|made for (your|the) \w+|you deserve|be the envy|level up your)\b/i],
    ['influence', 2, 'Emotional framing', 'The wording leans on anxiety, aspiration, status, or fear of missing out.', /\b(don.t miss out|life.?changing|secret to|stop (struggling|settling)|finally (feel|get|be)|transform your)\b/i],
    ['engagement', 0, 'Engagement bait', 'The point is withheld or dramatized to pull a click, watch, reaction, or share.', /\b(you won.t believe|what happened next|wait (until|for) it|wait (until|till|til) the end|the (reason|truth) (will|might) shock|this changes everything|i tried .{1,40} so you don.t have to|things? (nobody|no one) tells you|no one is talking about (this|it)|nobody.s talking about (this|it)|do this before|stop scrolling|watch (until|till|til) the end|the internet is (losing|going) (its|their) mind|i can.t believe|here.s what (really )?happened|exposed\b|gone wrong)\b/i],
    ['engagement', 1, 'Search bait', 'This phrase appears shaped to capture search traffic rather than answer a specific need.', /\b(best \w+( \w+)? (in|for) \d{4}|ultimate guide|everything you need to know|top \d+ \w+ (in|for) \d{4})\b/i],
    ['engagement', 1, 'Engagement extraction', 'The content asks for a reaction, comment, save, or share as part of the pitch.', /\b(comment .{0,18}(for|and|if)|tag someone|share (this|before)|like if you|follow for more|save this for later)\b/i],
    ['framing', 1, 'Loaded framing', 'A charged descriptor guides your interpretation before the evidence is evaluated.', /\b(shocking|disgraceful|bizarre|radical|brutal|devastating|outrageous|sinister|alarming)\b/i],
    ['framing', 1, 'Over-certainty', 'The claim is framed as settled, without the qualification usually expected for a contested matter.', /\b(proves? that|undeniably|there is no doubt|everyone knows|the truth is|clearly shows)\b/i],
    ['framing', 2, 'Vague attribution', 'An unnamed group is cited without enough detail to assess the source.', /\b(experts? (say|agree)|critics? (say|claim)|sources? (say|claim)|many (people|believe|argue)|it is believed)\b/i]
  ];

  const normalise = value => (value || '').replace(/\s+/g, ' ').trim();

  // The pause list is keyed on the top-level site, so a cross-origin subframe on a
  // paused page stays quiet too. ancestorOrigins gives the top origin even when the
  // frame cannot reach `top.location`.
  const TOP_HOST = (() => {
    try {
      const origins = location.ancestorOrigins;
      if (origins?.length) return new URL(origins[origins.length - 1]).hostname;
    } catch { /* not available in this frame */ }
    return location.hostname;
  })();

  const sitePaused = () => (settings?.disabledSites || []).includes(TOP_HOST);
  const scanningAllowed = () => Boolean(settings?.enabled) && !sitePaused();
  const lensOn = lens => scanningAllowed() && Boolean(settings[lens]);
  const allowed = rule => lensOn(rule[0]) && rule[1] <= LEVEL[settings.sensitivity];

  function parseColour(value) {
    const numbers = String(value || '').match(/[\d.]+/g)?.map(Number) || [];
    if (numbers.length < 3) return null;
    return { r: numbers[0], g: numbers[1], b: numbers[2], a: numbers[3] ?? 1 };
  }

  function colourToHsl({ r, g, b }) {
    const [red, green, blue] = [r, g, b].map(channel => channel / 255);
    const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
    const lightness = (max + min) / 2;
    if (max === min) return { h: 174, s: 0, l: lightness * 100 };
    const delta = max - min;
    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    let hue = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
    return { h: hue, s: saturation * 100, l: lightness * 100 };
  }

  function hslToColour(h, s, l) {
    const saturation = s / 100, lightness = l / 100;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
    const m = lightness - chroma / 2;
    const sectors = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
    const [r, g, b] = sectors[Math.floor((h % 360) / 60)];
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  }

  function luminance({ r, g, b }) {
    const channel = value => {
      const scaled = value / 255;
      return scaled <= .04045 ? scaled / 12.92 : ((scaled + .055) / 1.055) ** 2.4;
    };
    return .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b);
  }

  function contrast(a, b) {
    const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (bright + .05) / (dark + .05);
  }

  function composedParent(element) {
    return element?.parentElement || element?.getRootNode?.()?.host || null;
  }

  function effectiveBackground(element) {
    const layers = [];
    for (let node = element; node; node = composedParent(node)) {
      const colour = parseColour(getComputedStyle(node).backgroundColor);
      if (colour?.a) layers.push(colour);
      if (colour?.a >= .98) break;
    }
    let result = matchMedia('(prefers-color-scheme: dark)').matches ? { r: 18, g: 18, b: 18 } : { r: 255, g: 255, b: 255 };
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const layer = layers[index], alpha = layer.a;
      result = {
        r: layer.r * alpha + result.r * (1 - alpha),
        g: layer.g * alpha + result.g * (1 - alpha),
        b: layer.b * alpha + result.b * (1 - alpha)
      };
    }
    return result;
  }

  function annotationColour(element) {
    const surface = effectiveBackground(element);
    const surfaceHsl = colourToHsl(surface);
    const lead = { r: 221, g: 60, b: 60 };
    if (contrast(lead, surface) >= 3.2) {
      return { solid: 'rgb(221 60 60)', wash: 'rgb(221 60 60 / .16)', rgb: lead };
    }

    // Stay recognisably BaitBlocker red, but move its lightness far enough to
    // remain legible on an awkward page colour.
    const targetLightness = surfaceHsl.l > 50 ? 38 : 68;
    let best;
    for (let lightness = 18; lightness <= 88; lightness += 2) {
      const colour = hslToColour(0, 72, lightness);
      const surfaceContrast = contrast(colour, surface);
      const score = (surfaceContrast >= 3.2 ? 100 : 0) - Math.abs(lightness - targetLightness) * .35 + surfaceContrast * .08;
      if (!best || score > best.score) best = { colour, score };
    }
    const { r, g, b } = best.colour;
    return { solid: `rgb(${r} ${g} ${b})`, wash: `rgb(${r} ${g} ${b} / .16)`, rgb: best.colour };
  }

  function isOurs(element) {
    return Boolean(element?.closest?.(`[${UI_ATTRIBUTE}]`));
  }

  function isVisible(element) {
    if (!element || isOurs(element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    if (rect.right <= 0 || rect.left >= document.documentElement.clientWidth) return false;
    for (let node = element; node && node.nodeType === Node.ELEMENT_NODE; node = composedParent(node)) {
      const style = getComputedStyle(node);
      if (node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= .02) return false;
    }
    return true;
  }

  function ensurePresentation(element, finding) {
    if (!element?.isConnected || !finding) return false;
    if (!element.classList.contains(MARK)) element.classList.add(MARK);
    if (element.dataset.baitblockerKind !== finding.lens) element.dataset.baitblockerKind = finding.lens;
    if (element.dataset.baitblockerId !== String(finding.index)) element.dataset.baitblockerId = String(finding.index);
    finding.expectedStyles ||= {};
    const setImportant = (property, value) => {
      if (element.style.getPropertyValue(property) === finding.expectedStyles[property] && element.style.getPropertyPriority(property) === 'important') return;
      element.style.setProperty(property, value, 'important');
      finding.expectedStyles[property] = element.style.getPropertyValue(property);
    };
    setImportant('--baitblocker-accent', finding.colour.solid);
    setImportant('--baitblocker-wash', finding.colour.wash);
    setImportant('text-decoration-line', 'underline');
    setImportant('text-decoration-color', finding.colour.solid);
    setImportant('text-decoration-thickness', '1.5px');
    setImportant('text-underline-offset', '2px');
    setImportant('text-decoration-skip-ink', 'none');
    const style = finding.lens === 'influence' ? 'dotted' : finding.lens === 'engagement' ? 'dashed' : finding.lens === 'framing' ? 'wavy' : 'solid';
    setImportant('text-decoration-style', style);
    if (finding.washEligible) {
      if (!element.classList.contains('baitblocker-inline')) element.classList.add('baitblocker-inline');
      setImportant('background-image', `linear-gradient(transparent 74%, ${finding.colour.wash} 74%)`);
      setImportant('background-repeat', 'no-repeat');
    }
    return true;
  }

  // Removes exactly what ensurePresentation added, so a lens can be switched off
  // without reloading the page.
  function unmark(element, finding) {
    if (!element) return;
    Object.keys(finding?.expectedStyles || {}).forEach(property => element.style.removeProperty(property));
    ['--baitblocker-accent', '--baitblocker-wash'].forEach(property => element.style.removeProperty(property));
    element.classList.remove(MARK, 'baitblocker-inline', 'baitblocker-new', 'baitblocker-focus');
    delete element.dataset.baitblockerKind;
    delete element.dataset.baitblockerId;
    if (element.getAttribute('aria-describedby') === TOOLTIP_ID) element.removeAttribute('aria-describedby');
    if (element.getAttribute('style') === '') element.removeAttribute('style');
    elementIds.delete(element);
  }

  function clearAllMarks() {
    elements.forEach((element, index) => unmark(element, findings[index]));
    findings.length = 0;
    elements.length = 0;
    freeIndices.length = 0;
    hideTooltip(true);
  }

  function reveal(element) {
    clearTimeout(revealResetTimer);
    revealResetTimer = setTimeout(() => { revealBurst = 0; }, 1200);
    if (revealBurst >= 10) return;
    const delay = revealBurst * 80;
    revealBurst += 1;
    setTimeout(() => {
      if (!element.isConnected || !element.classList.contains(MARK)) return;
      element.classList.add('baitblocker-new');
      setTimeout(() => element.classList.remove('baitblocker-new'), 2250);
    }, delay);
  }

  function reconcileFindings() {
    findings.forEach((finding, index) => {
      if (!finding) return;
      const element = elements[index];
      if (!element?.isConnected || !isVisible(element)) {
        if (element) elementIds.delete(element);
        findings[index] = null;
        elements[index] = null;
        freeIndices.push(index);
        return;
      }
      ensurePresentation(element, finding);
    });
  }

  function currentTactics() {
    return findings.flatMap((finding, index) => finding
      ? [{ lens: finding.lens, name: finding.name, why: finding.why, trigger: finding.trigger, sample: finding.sample, index }]
      : []);
  }

  function publish() {
    clearTimeout(publishTimer);
    publishTimer = setTimeout(() => {
      reconcileFindings();
      const tactics = currentTactics();
      chrome.runtime.sendMessage({ type: 'BAITBLOCKER_COUNT', count: tactics.length, tactics, pageTitle: document.title, host: TOP_HOST });
    }, 100);
  }

  function annotate(element, lens, name, why, trigger = '') {
    if (!isVisible(element)) return false;
    const existing = elementIds.get(element);
    if (existing !== undefined && findings[existing]) {
      ensurePresentation(element, findings[existing]);
      return false;
    }
    const index = freeIndices.length ? freeIndices.pop() : findings.length;
    const display = getComputedStyle(element).display;
    const washEligible = display.startsWith('inline') && getComputedStyle(element).backgroundImage === 'none';
    const finding = { index, lens, name, why, trigger: normalise(trigger).slice(0, 100), sample: normalise(element.innerText || element.textContent).slice(0, 180), colour: annotationColour(element), washEligible };
    findings[index] = finding;
    elements[index] = element;
    elementIds.set(element, index);
    ensurePresentation(element, finding);
    reveal(element);
    publish();
    return true;
  }

  function matchCopy(element, suppliedText) {
    if (!isVisible(element) || elementIds.has(element)) return;
    const text = normalise(suppliedText ?? element.innerText ?? element.textContent);
    if (text.length < 5 || text.length > 420) return;
    const rule = rules.find(candidate => allowed(candidate) && candidate[4].test(text));
    if (rule) annotate(element, rule[0], rule[2], rule[3], text.match(rule[4])?.[0] || '');
  }

  function timerFinding(start) {
    if (!lensOn('pressure') || !isVisible(start)) return;
    const seedText = normalise(start.innerText || start.textContent);
    const seedMetadata = normalise(`${start.id} ${start.className} ${start.getAttribute?.('aria-label')} ${start.getAttribute?.('data-testid')}`);
    const clockPattern = /(?:\b\d{1,2}\s*:\s*\d{2}(?:\s*:\s*\d{2})?\b)|(?:\b\d+\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)\b)/i;
    const timeFragment = /^\d{1,2}$|^\d{1,2}\s*:\s*\d{0,2}$|^\d+\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)$/i.test(seedText);
    if (!clockPattern.test(seedText) && !timeFragment && !/countdown|count-down|timer|time-left|expiry|expires/i.test(seedMetadata)) return;
    let timerElement = null;
    let current = start;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      const text = normalise(current.innerText || current.textContent);
      if (!text || text.length > 650) break;
      const clock = clockPattern.test(text);
      if (clock && !timerElement) timerElement = current;
      const metadata = normalise(`${current.id} ${current.className} ${current.getAttribute?.('aria-label')} ${current.getAttribute?.('data-testid')}`);
      const timerMetadata = /countdown|count-down|timer|time-left|expiry|expires/i.test(metadata);
      const bookingContext = /book|booking|reserve|reservation|slot|seat|ticket|basket|cart|hold|held|expires?|time (left|remaining)|complete (your|the) (order|purchase)/i.test(text);
      if (timerElement && (timerMetadata || bookingContext)) {
        annotate(timerElement, 'pressure', 'Countdown pressure', 'A live booking, basket, or reservation timer can make the decision feel more urgent.', text.match(clockPattern)?.[0] || timerElement.innerText);
        return;
      }
    }
  }

  function scan(root) {
    if (!root || isOurs(root.nodeType === Node.ELEMENT_NODE ? root : root.host)) return;
    const documentForRoot = root.ownerDocument || document;
    const textWalker = documentForRoot.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = textWalker.nextNode())) {
      const text = normalise(textNode.nodeValue);
      if (!text || isOurs(textNode.parentElement)) continue;
      matchCopy(textNode.parentElement, text);
      timerFinding(textNode.parentElement);
    }

    const candidates = root.querySelectorAll?.('p,li,button,a,h1,h2,h3,h4,h5,h6,[role="alert"],[role="status"],[class*="countdown" i],[id*="countdown" i],[class*="timer" i],[id*="timer" i],[data-testid*="timer" i],[aria-label*="remaining" i]') || [];
    candidates.forEach(element => {
      matchCopy(element);
      timerFinding(element);
    });

    if (lensOn('pressure')) {
      root.querySelectorAll?.('input[type="checkbox"]:checked,input[type="radio"]:checked').forEach(input => {
        const label = input.labels?.[0] || input.closest('label') || input.parentElement;
        if (/newsletter|marketing|offers?|updates?|insurance|add-on|share/i.test(normalise(label?.innerText))) annotate(label, 'pressure', 'Preselected choice', 'This option is already selected, making acceptance the path of least resistance.', normalise(label?.innerText));
      });
    }

    root.querySelectorAll?.('*').forEach(element => {
      if (element.shadowRoot) {
        scan(element.shadowRoot);
        observe(element.shadowRoot);
      }
    });
  }

  function queueScan(node) {
    if (!node || isOurs(node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)) return;
    pending.add(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(() => {
      scanScheduled = false;
      const batch = [...pending];
      pending.clear();
      batch.forEach(scan);
    }, 80);
  }

  function observe(root) {
    if (!root || observedRoots.has(root)) return;
    observedRoots.add(root);
    if (root instanceof ShadowRoot && !root.querySelector(`[${UI_ATTRIBUTE}="shadow-style"]`)) {
      const style = document.createElement('style');
      style.setAttribute(UI_ATTRIBUTE, 'shadow-style');
      style.textContent = shadowCss;
      root.appendChild(style);
    }
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'characterData') queueScan(record.target);
        record.addedNodes?.forEach(queueScan);
        if (record.type === 'attributes') {
          const index = elementIds.get(record.target);
          if (index !== undefined && findings[index]) ensurePresentation(record.target, findings[index]);
          else queueScan(record.target);
        }
      });
      publish();
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'id', 'aria-label', 'data-testid', 'data-baitblocker-kind', 'data-baitblocker-id'] });
    root.addEventListener('pointerover', onHover, true);
    root.addEventListener('focusin', onHover, true);
    root.addEventListener('pointerout', onLeave, true);
    root.addEventListener('focusout', onLeave, true);
  }

  function markedFromEvent(event) {
    return event.composedPath().find(node => node?.classList?.contains(MARK));
  }

  function ensureTooltip() {
    if (tooltip?.isConnected) return tooltip;
    tooltip = document.createElement('aside');
    tooltip.id = TOOLTIP_ID;
    tooltip.setAttribute(UI_ATTRIBUTE, 'true');
    tooltip.setAttribute('role', 'tooltip');
    document.documentElement.appendChild(tooltip);
    tooltip.addEventListener('pointerenter', () => clearTimeout(hideTimer));
    tooltip.addEventListener('pointerleave', hideTooltip);
    return tooltip;
  }

  function showTooltip(element) {
    const id = Number(element?.dataset?.baitblockerId);
    const finding = findings[id];
    if (!finding) return;
    clearTimeout(hideTimer);
    const card = ensureTooltip();
    card.replaceChildren();
    const marker = document.createElement('i');
    marker.className = 'baitblocker-tell';
    marker.setAttribute('aria-hidden', 'true');
    const eyebrow = document.createElement('small');
    eyebrow.textContent = `BB / ${finding.lens}`;
    const title = document.createElement('b');
    title.textContent = finding.name;
    const explanation = document.createElement('span');
    explanation.textContent = finding.why;
    card.append(marker, eyebrow, title, explanation);
    if (finding.lens === 'framing' && finding.trigger) {
      const evidence = document.createElement('q');
      evidence.textContent = finding.trigger;
      card.append(evidence);
    }
    card.style.setProperty('--baitblocker-accent', finding.colour.solid);
    const rect = element.getBoundingClientRect();
    const width = Math.min(310, innerWidth - 24);
    const left = Math.max(12, Math.min(innerWidth - width - 12, rect.left));
    const above = rect.top > 125;
    card.style.left = `${left}px`;
    card.style.top = `${above ? rect.top - 10 : rect.bottom + 10}px`;
    card.dataset.position = above ? 'above' : 'below';
    card.hidden = false;
    if (describedElement && describedElement !== element) describedElement.removeAttribute('aria-describedby');
    element.setAttribute('aria-describedby', TOOLTIP_ID);
    describedElement = element;
  }

  function hideTooltip(immediate = false) {
    clearTimeout(hideTimer);
    const close = () => {
      if (tooltip) tooltip.hidden = true;
      if (describedElement?.getAttribute('aria-describedby') === TOOLTIP_ID) describedElement.removeAttribute('aria-describedby');
      describedElement = null;
    };
    if (immediate) return close();
    hideTimer = setTimeout(close, 130);
  }

  function onHover(event) {
    const marked = markedFromEvent(event);
    if (marked) showTooltip(marked);
  }

  function onLeave(event) {
    const marked = markedFromEvent(event);
    if (marked && !marked.contains(event.relatedTarget)) hideTooltip();
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && tooltip && !tooltip.hidden) hideTooltip(true);
  }, true);

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === 'REPUBLISH') {
      reconcileFindings();
      respond({ tactics: currentTactics(), pageTitle: document.title, host: TOP_HOST, paused: sitePaused() });
      return false;
    }
    if (message.type !== 'JUMP_TO_FINDING') return false;
    reconcileFindings();
    const signature = message.finding || {};
    const atIndex = findings[message.index];
    const sameFinding = atIndex && atIndex.lens === signature.lens && atIndex.name === signature.name;
    let element = sameFinding ? elements[message.index] : null;
    if (!element?.isConnected || !isVisible(element)) {
      scan(document.body);
      let replacementIndex = findings.findIndex(finding => finding && finding.lens === signature.lens && finding.name === signature.name && (!signature.trigger || finding.trigger === signature.trigger));
      if (replacementIndex < 0) replacementIndex = findings.findIndex(finding => finding && finding.lens === signature.lens && finding.name === signature.name);
      if (replacementIndex >= 0) element = elements[replacementIndex];
    }
    if (!element?.isConnected) return respond({ ok: false });
    const activeIndex = elementIds.get(element);
    ensurePresentation(element, findings[activeIndex]);
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('baitblocker-focus');
    setTimeout(() => showTooltip(element), 300);
    setTimeout(() => element.classList.remove('baitblocker-focus'), 1700);
    respond({ ok: true });
    return false;
  });

  function start() {
    if (!scanningAllowed()) return publish();
    scan(document.body);
    observe(document.documentElement);
    publish();
  }

  // Settings apply to the open page rather than waiting for a reload.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !settings) return;
    const touched = Object.keys(changes).filter(key => key in DEFAULTS);
    if (!touched.length) return;
    touched.forEach(key => { settings[key] = changes[key].newValue; });
    clearAllMarks();
    start();
  });

  chrome.storage.sync.get(DEFAULTS, value => {
    settings = value;
    start();
  });
})();
