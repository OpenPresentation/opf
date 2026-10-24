// The measurements behind the mobile and touch browser test (test/mobile-touch-browser.mjs), written as one self-contained function so that
// `page.evaluate(touchAudit)` can run it in the page. It looks at the controls that are visible and on top right now and reports
//   small    controls whose hit area (the control, or a checkbox with its label) is under 44px either way,
//   fonts    fields (input, select, textarea) whose text is under 16px (iOS Safari zooms the page on focus below 16px),
//   outside  controls that stick out of the layout viewport,
//   clipped  controls pushed out of sight sideways by an ancestor (a row that scrolls them away; the slide strip is a scroller by design) or whose text is cut,
//   overlaps controls that cover each other by more than 2px each way.
// Not controls: text typed on the slide (.opf-inline-input mirrors the slide's type), the gutter's fold markers, the layout canvas's wireframe regions (objects of the drawing, sized by the layout) and anything inside an SVG.
export function touchAudit() {
  const vw = document.documentElement.clientWidth;
  const selector = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=tab], [role=button], [role=menuitem], [role=menuitemradio], [role=option], [role=checkbox], [role=switch], [role=radio], .cm-tooltip-autocomplete li';
  const skip = '[hidden], dialog:not([open]), svg, .sr-only, .opf-source-status, .opf-source-live, .opf-inline-input, .opf-rich-input, .cm-foldGutter, .opf-fold-marker, .opf-lx-node';
  const visible = (element) => {
    if (element.closest(skip)) return false;
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    const box = element.getBoundingClientRect();
    return box.width > 1.5 && box.height > 1.5;
  };
  const scroller = (element, onlyX = false) => {
    const box = element.getBoundingClientRect(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    for (let node = element.parentElement; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (!/(auto|scroll)/.test(onlyX ? style.overflowX : style.overflowX + style.overflowY)) continue;
      const own = node.getBoundingClientRect();
      if (cx < own.left || cx > own.right || (!onlyX && (cy < own.top || cy > own.bottom))) return node;
    }
    return null;
  };
  const onTop = (element) => {
    if (scroller(element)) return true; // scrolled out of its list: still a control of the page
    const box = element.getBoundingClientRect();
    const x = Math.min(Math.max(box.x + box.width / 2, 0), innerWidth - 1), y = Math.min(Math.max(box.y + box.height / 2, 0), innerHeight - 1);
    const top = document.elementFromPoint(x, y);
    return Boolean(top) && (top === element || element.contains(top) || top.contains(element) || (top.closest('label') && top.closest('label') === element.closest('label')));
  };
  const label = (element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${typeof element.className === 'string' && element.className ? `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''} "${(element.getAttribute('aria-label') || element.textContent || element.value || '').trim().replace(/\s+/g, ' ').slice(0, 24)}"`;
  const clipRect = (element, box) => {
    let x0 = box.left, y0 = box.top, x1 = box.right, y1 = box.bottom;
    for (let node = element.parentElement; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node), own = node.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { x0 = Math.max(x0, own.left); x1 = Math.min(x1, own.right); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { y0 = Math.max(y0, own.top); y1 = Math.min(y1, own.bottom); }
    }
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  };
  // The hit area of a checkbox or radio is the box together with its labels.
  const area = (element) => {
    const parts = element.type === 'checkbox' || element.type === 'radio' ? [element, ...(element.labels ?? [])] : [element];
    const boxes = parts.map((part) => part.getBoundingClientRect());
    const box = { left: Math.min(...boxes.map((b) => b.left)), top: Math.min(...boxes.map((b) => b.top)), right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)) };
    return { width: box.right - box.left, height: parts.length > 1 ? Math.max(...boxes.map((b) => b.height)) : box.bottom - box.top, clip: clipRect(element, box), element };
  };
  const controls = [...document.querySelectorAll(selector)].filter(visible).filter(onTop);
  const small = [], fonts = [], outside = [], clipped = [], overlaps = [];
  const areas = controls.map(area);
  for (const [index, element] of controls.entries()) {
    const { width, height } = areas[index];
    const inlineLink = element.tagName === 'A' && getComputedStyle(element).display === 'inline';
    if ((width < 43.5 || height < 43.5) && !inlineLink) small.push(`${label(element)} ${Math.round(width)}x${Math.round(height)}`);
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName) && !/^(checkbox|radio|range|file|button|submit|color)$/.test(element.type) && parseFloat(getComputedStyle(element).fontSize) < 15.99) fonts.push(`${label(element)} ${getComputedStyle(element).fontSize}`);
    const box = element.getBoundingClientRect(), away = scroller(element, true);
    if (!away && !element.closest('#slide-list, .slide-list') && (box.right > vw + 1 || box.left < -1)) outside.push(`${label(element)} left=${Math.round(box.left)} right=${Math.round(box.right)}`);
    if (away && !away.closest('#slide-list, .slide-list')) clipped.push(`${label(element)} is scrolled out of ${label(away)}`);
    if (!away && element.scrollWidth > element.clientWidth + 1 && /^(BUTTON|SUMMARY)$/.test(element.tagName) && getComputedStyle(element).overflow !== 'visible') clipped.push(`${label(element)} cuts its text (${element.scrollWidth} > ${element.clientWidth})`);
  }
  for (let i = 0; i < areas.length; i++) {
    for (let j = i + 1; j < areas.length; j++) {
      const a = areas[i], b = areas[j];
      if (a.element.contains(b.element) || b.element.contains(a.element) || !a.clip.w || !b.clip.w || scroller(a.element) || scroller(b.element)) continue;
      const ox = Math.min(a.clip.x + a.clip.w, b.clip.x + b.clip.w) - Math.max(a.clip.x, b.clip.x);
      const oy = Math.min(a.clip.y + a.clip.h, b.clip.y + b.clip.h) - Math.max(a.clip.y, b.clip.y);
      if (ox > 2 && oy > 2) overlaps.push(`${label(a.element)} x ${label(b.element)} (${Math.round(ox)}x${Math.round(oy)})`);
    }
  }
  return { width: vw, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, controls: controls.length, small, fonts, outside, clipped, overlaps };
}
