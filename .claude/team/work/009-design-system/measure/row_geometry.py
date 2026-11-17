# Row geometry harness for the T9 row-height ruling (designer, 2026-11-16).
# Real CSS: tokens.css, Badge.css, IconButton.css, Popover.css, source.css (copied, not edited).
# Each cell is one variant; the hover and focus states are mirrored with .st-hover / .st-focus
# because :hover and :focus-within cannot be forced in a dump. Output: JSON in <pre id="out">.
# Usage: python3 row_geometry.py <out.html>; then google-chrome --headless=new --no-sandbox
#        --disable-gpu --window-size=1180,1400 --virtual-time-budget=2000 --dump-dom file://<out.html>
import sys, json
ROOT = '/home/kr/workspace/spectrum-kit/src/'
def rd(p): return open(ROOT + p).read()
def mirror(css):
    # Hover and focus-within are mirrored by classes.
    css = css.replace('.list-row:hover', '.list-row.st-hover')
    css = css.replace('.list-row-select:hover', '.list-row-select.st-hover')
    css = css.replace(':focus-within', '.st-focus')
    return css
css = ''.join([rd('styles/tokens.css'), rd('ui/Badge/Badge.css'), rd('ui/IconButton/IconButton.css'),
               mirror(rd('ui/Popover/Popover.css')), mirror(rd('styles/source.css'))])
# Measurement-only overrides: the page is a flow layout, not the app's absolute popover.
css += '''
.cell { position: relative; width: 360px; margin: 0 0 14px 0; }
.popover { position: relative; top: auto; width: 360px; box-sizing: border-box; }
.v-44 { --row-height: 44px; }
.v-48 { --row-height: 48px; }
.v-52 { --row-height: 52px; }
.v-44c { --row-height: 44px; }
.v-44c .list-row-actions { bottom: auto; top: calc(50% - var(--target-min) / 2); }
.v-52c { --row-height: 52px; }
.v-52c .list-row-actions { bottom: auto; top: calc(50% - var(--target-min) / 2); }
'''
NAME = 'Bench analyser, 2.4 GHz survey, rig A, SA430 near the window'  # 60 chars
REAL = 'SA430 08FF41E50F8B3A34'
variants = ['v-44', 'v-48', 'v-52', 'v-44c', 'v-52c']
states = ['rest', 'hover', 'focus']
cells = []
n = 0
for v in variants:
    for name_label, name in (('n60', NAME), ('real', REAL)):
        for s in states:
            n += 1
            cid = f'c{n}'
            row_cls = 'list-row' + (' st-hover' if s == 'hover' else '')
            act_cls = 'list-row-actions' + (' st-focus' if s == 'focus' else '')
            cells.append(f'''
<div class="cell {v}" id="{cid}" data-variant="{v}" data-name="{name_label}" data-state="{s}">
 <div class="popover popover-source"><ul class="popover-list"><li>
  <div class="{row_cls}" data-list-row data-size="two-line">
   <button type="button" class="list-row-select" data-list-item data-size="two-line" aria-label="x">
    <span class="source-row">
     <span class="ui-status-dot source-row-dot" data-status="connected" aria-hidden="true"></span>
     <span class="source-row-name" data-name>{name}</span>
     <span class="ui-badge source-row-badge" data-variant="chip" data-tone="neutral" data-badge>USB</span>
     <span class="source-row-sub" data-sub><span class="source-row-status ok">Connected</span><span class="source-row-sep">·</span><span class="source-row-detail">/dev/ttyACM0</span></span>
    </span>
   </button>
   <span class="{act_cls}" data-actions>
    <button type="button" class="ui-icon-button ui-icon-button--filled" data-btn>✎</button>
    <button type="button" class="ui-icon-button ui-icon-button--filled" data-btn>×</button>
   </span>
  </div>
 </li></ul></div>
</div>''')
js = r'''
<script>
const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
  return {l:+r.left.toFixed(2), r:+r.right.toFixed(2), t:+r.top.toFixed(2), b:+r.bottom.toFixed(2), w:+r.width.toFixed(2), h:+r.height.toFixed(2)}; };
const out = [];
for (const c of document.querySelectorAll('.cell')) {
  const row = c.querySelector('[data-list-row]');
  const sel = c.querySelector('[data-list-item]');
  const badge = c.querySelector('[data-badge]');
  const sub = c.querySelector('[data-sub]');
  const acts = c.querySelector('[data-actions]');
  const btns = [...c.querySelectorAll('[data-btn]')].map(box);
  const cs = getComputedStyle(badge), ca = getComputedStyle(acts);
  const rb = box(row), bb = box(badge), ab = box(acts);
  out.push({ id: c.id, variant: c.dataset.variant, name: c.dataset.name, state: c.dataset.state,
    row: rb, badge: bb, badgeOpacity: +cs.opacity, sub: box(sub), actions: ab, actionsOpacity: +ca.opacity,
    btn0: btns[0], btn1: btns[1],
    // vertical gap between badge bottom and actions top (negative = overlap), relative to row
    gapBadgeToActions: bb && ab ? +(ab.t - bb.b).toFixed(2) : null,
    overlapsSub: sub && ab ? (ab.l < box(sub).r && ab.r > box(sub).l && ab.t < box(sub).b && ab.b > box(sub).t) : null,
  });
}
document.getElementById('out').textContent = JSON.stringify(out);
</script>'''
html = f'''<!doctype html><html><head><meta charset="utf-8"><style>
body{{margin:16px;background:#101722;font-family:var(--font-family-ui);width:400px}}
{css}
</style></head><body>{''.join(cells)}<pre id="out"></pre>{js}</body></html>'''
open(sys.argv[1], 'w').write(html)
print('cells', n)
