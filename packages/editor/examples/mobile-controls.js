// RR-25: the phone and tablet layout of the playground. At 900px and narrower the page is one screen: the slide strip on top, the slide
// filling the middle, and a bottom bar (Edit, Design, Find, Undo, Redo). The inspector becomes a bottom sheet that the bar opens, so the
// slide stays in view above it; the document's header buttons sit behind a "More" button; nothing scrolls sideways down to 320px.
// While text is being typed the page asks the browser not to zoom into the field (iOS zooms into a field whose text is smaller than
// 16px, and the field mirrors the slide text), and gives the zoom back when typing ends.
const CSS = `
.mobile-only{display:none}
.slide-actions{display:contents}
@media (max-width:900px){
:root{--bar-h:56px}
html,body{overscroll-behavior:none}
.mobile-only{display:inline-flex}
.app-shell{display:flex;flex-direction:column;height:100dvh;min-height:0;overflow:hidden;padding-bottom:calc(var(--bar-h) + env(safe-area-inset-bottom))}
.sidebar{flex:0 0 auto;position:static;max-height:none;flex-direction:row;flex-wrap:wrap;align-items:center;border-right:0;border-bottom:1px solid var(--border)}
.workspace-brand{flex:1 1 auto;height:44px}
.workspace-badge,.sidebar-section,.sidebar-bottom{display:none}
.sidebar .add-slide{order:1;margin:0 4px 0 0;padding:4px 8px;font-size:12px;gap:4px;min-height:36px}
.slide-list{order:2;flex:1 1 100%;display:flex;flex-direction:row;gap:8px;overflow-x:auto;overflow-y:hidden;padding:2px 10px 8px;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
.slide-card{flex:0 0 96px;width:96px;margin:0}
.slide-toolbar{order:0;margin:0 6px 0 0}
.slide-actions{order:1;flex:1 1 100%;display:flex;gap:4px;overflow-x:auto;padding:0 8px 4px;scrollbar-width:none}
.slide-actions .add-slide{flex:0 0 auto;margin:0;order:0}
.main-shell{flex:1 1 0;min-height:0}
.document-bar{flex-wrap:wrap;height:auto;min-height:44px;padding:4px 12px;gap:6px}
.breadcrumb{flex:1 1 0;min-width:0}
.breadcrumb input{min-width:0;max-width:none;width:100%}
.breadcrumb-label,.breadcrumb .slash{display:none}
.header-actions{display:none;width:100%;flex-wrap:wrap;gap:6px;padding-bottom:6px}
body[data-menu=open] .header-actions{display:flex}
.editing-shell{display:flex;flex-direction:column;flex:1 1 0;min-height:0}
.canvas-column{flex:1 1 0;min-height:0}
.canvas-toolbar{height:auto;min-height:44px;flex-wrap:wrap;padding:4px 10px;gap:6px}
.canvas-toolbar #copy-slide,.canvas-toolbar #undo,.canvas-toolbar #redo,.canvas-toolbar #find-open{display:none}
.canvas-scroll{touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch}
.canvas-stage{padding:12px 10px 16px}
.canvas-caption{display:none}
.canvas-footer{padding:0 12px}
body[data-sheet] .sidebar,body[data-sheet] .document-bar{display:none}
body[data-sheet] .canvas-scroll{padding-bottom:min(46dvh,420px)}
.inspector{position:fixed;left:0;right:0;bottom:calc(var(--bar-h) + env(safe-area-inset-bottom));width:auto;max-height:min(46dvh,420px);border:0;border-top:1px solid var(--border);border-radius:14px 14px 0 0;box-shadow:0 -10px 40px #1c183033;z-index:40;overscroll-behavior:contain;transform:translateY(calc(100% + var(--bar-h)));visibility:hidden;transition:transform .2s ease,visibility 0s linear .2s}
body[data-sheet] .inspector{transform:none;visibility:visible;transition:transform .2s ease}
@media (max-height:720px){.workspace-brand{height:36px}.canvas-toolbar .slide-heading{display:none}.canvas-toolbar{min-height:40px;padding:2px 10px}}
@media (prefers-reduced-motion:reduce){.inspector{transition:none}}
.inspector-tabs{position:sticky;top:0;z-index:2;background:#fff;align-items:center;padding-right:6px}
.sheet-close{margin-left:auto;min-height:44px}
.inspector-panel{padding:14px 14px 20px;max-width:none}
.mobile-bar{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;background:#fff;border-top:1px solid var(--border);padding-bottom:env(safe-area-inset-bottom)}
.mobile-bar button{flex:1 1 0;min-width:0;min-height:var(--bar-h);flex-direction:column;gap:2px;border-radius:0;font-size:11px;font-weight:600;color:#4a4b56;padding:4px 2px}
.mobile-bar button[aria-pressed=true],.mobile-bar button[aria-expanded=true]{color:var(--accent);background:#f1effd}
.mobile-bar button:disabled{opacity:.4}
.mobile-bar .icon{width:20px;height:20px}
.find-host{position:fixed;left:0;right:0;bottom:calc(var(--bar-h) + env(safe-area-inset-bottom));z-index:45;padding:0 8px 8px;background:transparent}
.find-host .opf-find{max-height:min(62dvh,480px);overflow:auto;border-radius:12px}
.find-host .opf-find-results{max-height:min(22dvh,170px)}
dialog{max-width:100vw;max-height:100dvh}
button,select,input[type=text],input[type=number],textarea{touch-action:manipulation}
}
@media (max-width:900px) and (pointer:coarse){
.canvas-toolbar button,.document-bar button,.sidebar .add-slide,.inspector button,.inspector select,.inspector input{min-height:44px}
.inspector textarea,.inspector input[type=text],.inspector input[type=number],.inspector select,.document-bar input{font-size:16px}
}
`;

const BAR = [
  { id: 'bar-edit', label: 'Edit', sheet: 'content' },
  { id: 'bar-design', label: 'Design', sheet: 'design' },
  { id: 'bar-find', label: 'Find' },
  { id: 'bar-undo', label: 'Undo', icon: 'i-undo' },
  { id: 'bar-redo', label: 'Redo', icon: 'i-redo' },
];

export function installMobileControls() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const compact = window.matchMedia('(max-width: 900px)');

  // More: the document's header buttons.
  const more = document.createElement('button');
  more.id = 'more-actions';
  more.type = 'button';
  more.className = 'secondary mobile-only';
  more.textContent = 'More';
  more.setAttribute('aria-expanded', 'false');
  more.setAttribute('aria-controls', 'header-actions');
  document.querySelector('.header-actions').id ||= 'header-actions';
  document.querySelector('.document-bar').append(more);
  more.addEventListener('click', () => {
    const open = document.body.dataset.menu !== 'open';
    if (open) document.body.dataset.menu = 'open'; else delete document.body.dataset.menu;
    more.setAttribute('aria-expanded', String(open));
  });

  // The slide buttons share one row that scrolls sideways when it must (they wrapped onto three rows on a 320px screen).
  const slideActions = document.createElement('div');
  slideActions.className = 'slide-actions';
  document.getElementById('slide-list').after(slideActions);
  for (const id of ['add', 'add-layout', 'browse-gallery']) { const node = document.getElementById(id); if (node) slideActions.append(node); }

  // The bottom bar.
  const bar = document.createElement('nav');
  bar.className = 'mobile-bar mobile-only';
  bar.setAttribute('aria-label', 'Editing tools');
  const buttons = {};
  for (const item of BAR) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = item.id;
    if (item.icon) button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${item.icon}"/></svg>`;
    button.append(item.label);
    if (item.sheet) { button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', 'inspector'); }
    bar.append(button);
    buttons[item.id] = button;
  }
  document.body.append(bar);
  document.querySelector('.inspector').id ||= 'inspector';

  function setSheet(name) {
    if (name && compact.matches) {
      document.body.dataset.sheet = name;
      document.getElementById(`tab-${name}`).click();
    } else delete document.body.dataset.sheet;
    for (const item of BAR) if (item.sheet) buttons[item.id].setAttribute('aria-expanded', String(document.body.dataset.sheet === item.sheet));
  }
  const sheetClose = document.createElement('button');
  sheetClose.type = 'button';
  sheetClose.className = 'secondary sheet-close mobile-only';
  sheetClose.textContent = 'Done';
  document.querySelector('.inspector-tabs').append(sheetClose);
  sheetClose.addEventListener('click', () => { setSheet(null); buttons['bar-edit'].focus(); });
  for (const item of BAR) {
    if (!item.sheet) continue;
    buttons[item.id].addEventListener('click', () => setSheet(document.body.dataset.sheet === item.sheet ? null : item.sheet));
  }
  buttons['bar-find'].addEventListener('click', () => document.getElementById('find-open')?.click());
  buttons['bar-undo'].addEventListener('click', () => document.getElementById('undo').click());
  buttons['bar-redo'].addEventListener('click', () => document.getElementById('redo').click());
  // Keep Undo and Redo in step with the toolbar's own buttons, and Find with the panel.
  const mirror = () => {
    buttons['bar-undo'].disabled = document.getElementById('undo').disabled;
    buttons['bar-redo'].disabled = document.getElementById('redo').disabled;
    const find = document.getElementById('find-open');
    if (find) buttons['bar-find'].setAttribute('aria-pressed', String(find.getAttribute('aria-expanded') === 'true'));
  };
  const observer = new MutationObserver(mirror);
  for (const id of ['undo', 'redo', 'find-open']) { const node = document.getElementById(id); if (node) observer.observe(node, { attributes: true }); }
  mirror();
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.dataset.sheet && !event.defaultPrevented && !document.querySelector('dialog[open], .opf-crop, .opf-find:not([hidden])')) setSheet(null);
  });
  compact.addEventListener('change', () => { if (!compact.matches) { setSheet(null); delete document.body.dataset.menu; more.setAttribute('aria-expanded', 'false'); } });

  // Typing on the slide: no browser zoom into the field.
  const viewport = document.querySelector('meta[name=viewport]');
  const original = viewport?.getAttribute('content');
  const typing = (event) => event.target.matches?.('.opf-inline-input, .opf-rich-input') && compact.matches;
  // A field removed from the page when its edit commits sends no focusout, so any focus that lands elsewhere restores the zoom too.
  document.addEventListener('focusin', (event) => { if (viewport) viewport.setAttribute('content', typing(event) ? `${original},maximum-scale=1` : original); });
  document.addEventListener('focusout', (event) => { if (typing(event) && viewport) viewport.setAttribute('content', original); });
  return { setSheet };
}
