# Measurement harness for 009 (designer, 2026-11-16). Builds a page from the real src/styles/*.css
# and the toolbar, status bar and side-panel markup, then measures it in headless Chrome.
# Usage: python3 build_harness.py <window_width> <out.html> [name]
# Then: google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
#       --window-size=<w>,700 --virtual-time-budget=2000 --dump-dom file://<out.html>
# The JSON in <pre id="out"> holds the boxes. Fonts are the machine's fallbacks (re-measure in WebKitGTK).
import sys, html
W = int(sys.argv[1]); OUT = sys.argv[2]
ROOT='/home/kr/workspace/spectrum-kit/src/styles/'
css = ''.join(open(ROOT+f).read()+'\n' for f in ['app.css','capture.css','source.css','sourceDialog.css'])
LONG = 'Bench analyser, 2.4 GHz survey, rig A, SA430 near the window'  # 60 chars
ID = 'SA430 08FF41E50F8B3A34'
assert len(LONG)==60, len(LONG)
NAME = sys.argv[3] if len(sys.argv)>3 else LONG
body = f'''
<div class="app">
 <header class="toolbar" id="tb">
  <div class="brand" id="brand"><span class="brand-mark">▲</span>Spectrum Studio</div>
  <div class="toolbar-group toolbar-source" id="grp-src">
   <div class="source-control" id="sc">
    <button type="button" class="source-button" id="srcbtn" aria-haspopup="menu" aria-expanded="false">
      <span class="src-dot" data-status="connected" aria-hidden="true"></span>
      <span class="src-name" id="srcname">{html.escape(NAME)}</span><span aria-hidden="true">▾</span>
    </button>
   </div>
   <div class="capture" role="group" aria-label="Capture" data-mode="continuous" data-state="idle" id="cap">
     <button type="button" class="capture-main" id="capmain" data-mode="continuous"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg><span class="capture-label">Continuous</span></button>
     <button type="button" class="capture-chevron" id="capchev" aria-label="Capture mode: Continuous"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
   </div>
  </div>
  <div class="toolbar-group" id="grp-field">
   <label class="field" id="lcenter"><span>Center</span><input class="freq-input" id="center" value="2.400000 GHz" size="1"></label>
   <label class="field" id="lspan"><span>Span</span><select aria-label="Span" id="span"><option>2.048 MHz</option></select></label>
  </div>
 </header>
 <div class="notices" id="notices"><div class="notice notice-connectFailed" id="notice"><span class="notice-message">Could not connect to TI SA430 spectrum analyzer: The device did not answer in time. Check the cable and reconnect.</span><button class="icon" id="dismiss" aria-label="Dismiss">×</button></div></div>
 <main class="workspace">
  <section class="plots with-waterfall" id="plots">
    <div class="plot spectrum-plot" id="plot"><div class="plot-badge liveness-stopped" id="badge">HOLD · last data 13:44:46</div><button class="plot-zoom-reset" id="zoomreset">Zoom: 2.0 MHz · reset</button></div>
  </section>
  <aside class="side-panel" id="side">
   <details class="panel" open><summary>Measurement</summary>
    <div class="panel-body" id="meas">
     <div class="form-row"><label for="fft">FFT size</label><select id="fft" style="width:130px"><option>8192</option></select></div>
     <div class="form-row"><label for="ref">Reference level</label><input type="number" id="ref" value="0"></div>
     <div class="form-row checks" id="checks"><label id="chkwf"><input type="checkbox" checked> Waterfall</label><select aria-label="Waterfall palette"><option>Classic</option></select></div>
     <div class="form-row"><label for="above">Above noise</label><span class="with-unit" id="withunit"><input type="number" id="above" value="15"><span class="unit">dB</span></span></div>
    </div>
   </details>
   <details class="panel" open><summary>Markers</summary>
    <div class="panel-body">
     <div class="button-row"><button class="small" id="pk">Peak search</button><button class="small">Next peak</button><button class="small">+ Marker</button></div>
     <table class="readout-table" id="mtab"><thead><tr><th></th><th>Frequency</th><th>Level</th><th></th></tr></thead><tbody>
      <tr id="mrow"><td class="marker-id">M1</td><td>2.400000 GHz</td><td>-61.25 dBFS</td><td class="row-actions"><button class="icon" id="mx">×</button></td></tr>
      <tr><td class="marker-id">M2</td><td>2.401250 GHz<div class="delta">Δ 1.250 MHz</div></td><td>-70.00 dBFS<div class="delta">Δ -8.75 dB</div></td><td class="row-actions"><button class="icon">×</button></td></tr>
     </tbody></table>
    </div>
   </details>
  </aside>
 </main>
 <footer class="status-bar" id="sb">
   <span class="status-item" id="s-center"><span class="status-label">Center</span> 2.400000 GHz</span>
   <span class="status-item" id="s-span"><span class="status-label">Span</span> 2.048 MHz</span>
   <span class="status-item"><span class="status-label">RBW</span> 2.0 kHz</span>
   <span class="status-item"><span class="status-label">FFT</span> 8192 · Blackman-Harris</span>
   <span class="status-item"><span class="status-label">Avg</span> 10/10</span>
   <span class="status-item"><span class="status-label">Noise floor</span> -84.5 dBFS/bin</span>
   <span class="status-item"><span class="status-label">Unit</span> dBFS</span>
   <span class="status-item"><span class="status-label">Rate</span> 30.0 fps</span>
   <span class="status-item" id="s-frame"><span class="status-label">Frame</span> #184223 · 13:44:46</span>
   <span class="status-item uncalibrated" id="s-unc">Uncalibrated</span>
 </footer>
</div>
'''
js = r'''
<script>
function r(el){ if(!el) return null; const b=el.getBoundingClientRect(); return {x:Math.round(b.left*10)/10, r:Math.round(b.right*10)/10, w:Math.round(b.width*10)/10, h:Math.round(b.height*10)/10, t:Math.round(b.top*10)/10, b:Math.round(b.bottom*10)/10}; }
function q(s){return document.querySelector(s)}
window.addEventListener('load', () => {
  const out = {vw: window.innerWidth};
  const tb = q('#tb'); out.toolbar = r(tb); out.toolbarScrollW = tb.scrollWidth; out.toolbarClientW = tb.clientWidth;
  out.brand = r(q('#brand')); out.grpSrc = r(q('#grp-src')); out.sc = r(q('#sc')); out.srcbtn = r(q('#srcbtn'));
  const sn = q('#srcname'); out.srcname = {w: sn.getBoundingClientRect().width, scrollW: sn.scrollWidth, clientW: sn.clientWidth};
  out.cap = r(q('#cap')); out.grpField = r(q('#grp-field')); out.center = r(q('#center')); out.span = r(q('#span')); out.lcenter=r(q('#lcenter'));
  out.lspan = r(q('#lspan'));
  out.toolbarRightEdge = Math.max(...[...tb.querySelectorAll('*')].map(e=>e.getBoundingClientRect().right));
  out.toolbarPaddingRight = 12; // checked against CSS
  // status bar
  const sb = q('#sb'); out.sbBox = r(sb); out.sbScrollW = sb.scrollWidth; out.sbClientW = sb.clientWidth;
  out.sbItems = [...sb.querySelectorAll('.status-item')].map(e => ({t: e.textContent.trim().slice(0,28), x: Math.round(e.getBoundingClientRect().left), r: Math.round(e.getBoundingClientRect().right), cut: e.getBoundingClientRect().right > sb.getBoundingClientRect().right - 12 + 0.5}));
  // side panel rows
  out.formRows = [...q('#side').querySelectorAll('.form-row')].map(fr => ({ label: fr.querySelector('label') ? Math.round(fr.querySelector('label').getBoundingClientRect().width):null, rowW: Math.round(fr.getBoundingClientRect().width), overflow: fr.scrollWidth > fr.clientWidth + 0.5 }));
  out.sideW = r(q('#side'));
  // targets
  const h = (sel) => { const e=q(sel); return e? r(e): null; };
  out.targets = {
    capMain: h('#capmain'), capChev: h('#capchev'), srcBtn: h('#srcbtn'), freq: h('#center'), spanSel: h('#span'),
    peakSearch: h('#pk'), markerX: h('#mx'), zoomReset: h('#zoomreset'), dismiss: h('#dismiss'),
    readoutRow: h('#mrow'), checkWf: h('#chkwf'), fft: h('#fft'), ref: h('#ref')
  };
  // source row actions (hidden via opacity but laid out)
  out.ok = true;
  document.getElementById('out').textContent = JSON.stringify(out);
});
</script>'''
page = f'''<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>{body}<pre id="out"></pre>{js}</body></html>'''
open(OUT,'w').write(page)
print('wrote', OUT, len(page))
