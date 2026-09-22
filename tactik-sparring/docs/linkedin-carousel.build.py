NAVY="#0B1424"; NAVY2="#111D31"; CREAM="#EDE6D6"; MUTE="#8E9AAE"; DIM="#5D6A80"; RULE="#2A3850"; SIG="#E0566B"
def page(inner,n):
    return f'''<section class="s"><div class="mark"><svg width="30" height="30" viewBox="0 0 30 30"><rect x="6" y="3" width="18" height="24" rx="2" fill="none" stroke="{CREAM}" stroke-width="1.6"/><rect x="11" y="9" width="8" height="12" rx="1" fill="none" stroke="{CREAM}" stroke-width="1.6"/></svg><div>TACTIK AI</div><i></i></div>{inner}<div class="foot"><span>FIELD NOTE &#183; ADVERSARIAL REHEARSAL</span><span>{n} / 5</span></div></section>'''
cells=lambda k,filled,color: ''.join(f'<b class="c {"f" if i<filled else ""}" style="{"background:"+color+";border-color:"+color if i<filled else ""}"></b>' for i in range(k))
S=[]
S.append(page('''<div class="kick">What we caught on our own platform</div>
<h1>The model can<br>argue perfectly<br>and never make<br>an offer.</h1>
<p class="lede">Nine turns against an AI counterparty.<br>A sealed transcript. Zero offers.</p>''',1))
S.append(page(f'''<div class="kick">The evidence</div>
<h2>Nine turns.<br>Zero offers.</h2>
<div class="row"><div class="lab">Opened by restating my position, then attacking it</div><div class="cells">{cells(9,9,CREAM)}</div><div class="num">9 of 9</div></div>
<div class="row"><div class="lab">Named a price, a volume, a date or a term</div><div class="cells">{cells(9,0,CREAM)}</div><div class="num sig">0 of 9</div></div>
<p class="note">It knew the regulation. It knew the commercial pressure.<br>It pushed back on every point.<br><em>Fluent. Well-informed. Impossible to negotiate with.</em></p>
<p class="src">Sealed transcript &#183; 18 messages</p>''',2))
S.append(page('''<div class="kick">Why it matters</div>
<h2>No offer,<br>nothing to score.</h2>
<ol class="chain"><li>No offer on the table</li><li>No concession to measure</li><li>No anchor to defend</li><li>No score &#8212; only a debate</li></ol>
<p class="note">A rehearsal you cannot score is not a rehearsal.<br><em>It is an argument with good grammar.</em></p>''',3))
S.append(page('''<div class="kick">The principle</div>
<h2>A model cannot<br>hide a limit<br>from itself.</h2>
<p class="body">Whatever it knows about its own walk-away point, it knows in the same place it speaks from. So under pressure it gives the limit away &#8212; or it behaves as if it has none.</p>
<div class="rule"><span>Our rule</span>The model that speaks<br>never holds the limits.</div>''',4))
S.append(page(f'''<div class="kick">The correction, measured</div>
<div class="big"><span>0</span><em>of 6</em><b>&#8594;</b><span>5</span><em>of 6</em></div>
<p class="cap">turns putting a real term on the table,<br>before and after the fix, in a second engine</p>
<h3>An argument is not an offer.<br>That holds for machines too.</h3>
<p class="src">Simulation finding, not a forecast.</p>''',5))
html=f'''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
@page{{size:1080px 1350px;margin:0}}
*{{box-sizing:border-box}} body{{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.s{{width:1080px;height:1350px;background:radial-gradient(ellipse at 50% 0%,{NAVY2},{NAVY} 70%);color:{CREAM};position:relative;
   padding:120px 110px 0;page-break-after:always;overflow:hidden;font-family:'Inter Tight',sans-serif}}
.mark{{position:absolute;top:70px;left:0;right:0;text-align:center;font-size:19px;letter-spacing:.42em;color:{CREAM};font-weight:500}}
.mark div{{margin-top:10px}} .mark i{{display:block;width:70px;height:1px;background:{DIM};margin:18px auto 0}}
.kick{{margin-top:170px;text-align:center;font-size:21px;letter-spacing:.2em;text-transform:uppercase;color:{MUTE}}}
h1{{font-family:'Playfair Display',serif;font-weight:600;font-size:92px;line-height:1.08;text-align:center;text-transform:uppercase;margin:44px 0 0;letter-spacing:.005em}}
h2{{font-family:'Playfair Display',serif;font-weight:600;font-size:84px;line-height:1.08;text-align:center;text-transform:uppercase;margin:36px 0 48px}}
h3{{font-family:'Playfair Display',serif;font-weight:500;font-size:50px;line-height:1.2;text-align:center;margin:90px 0 0;text-transform:uppercase}}
.lede{{text-align:center;font-size:32px;line-height:1.5;color:{MUTE};margin-top:70px}}
.row{{display:grid;grid-template-columns:1fr;gap:14px;margin:0 0 38px;padding:0 20px}}
.lab{{font-size:28px;color:{CREAM};line-height:1.35}}
.cells{{display:flex;gap:16px}} .c{{width:56px;height:56px;border:2px solid {DIM};border-radius:8px;display:block}}
.num{{font-family:'JetBrains Mono',monospace;font-size:34px;color:{CREAM}}} .num.sig{{color:{SIG}}}
.note{{text-align:center;font-size:30px;line-height:1.55;color:{MUTE};margin-top:20px}} .note em{{color:{CREAM};font-style:normal}}
.src{{position:absolute;bottom:122px;left:0;right:0;text-align:center;font-family:'JetBrains Mono',monospace;font-size:19px;color:{DIM}}}
.chain{{list-style:none;padding:0;margin:0 auto 60px;width:640px;counter-reset:c}}
.chain li{{counter-increment:c;font-size:36px;padding:22px 0 22px 90px;position:relative;border-bottom:1px solid {RULE}}}
.chain li:last-child{{color:{SIG};border-bottom:0}}
.chain li::before{{content:counter(c);position:absolute;left:0;top:18px;width:52px;height:52px;border:1.6px solid {DIM};border-radius:50%;
  font-family:'JetBrains Mono',monospace;font-size:22px;display:flex;align-items:center;justify-content:center;color:{MUTE}}}
.body{{font-size:33px;line-height:1.55;color:{MUTE};text-align:center;margin:0 30px}}
.rule{{margin:80px auto 0;width:720px;border:1.6px solid {DIM};padding:40px 30px;text-align:center;font-family:'Playfair Display',serif;font-size:46px;line-height:1.25;text-transform:uppercase}}
.rule span{{display:block;font-family:'Inter Tight',sans-serif;font-size:20px;letter-spacing:.24em;color:{MUTE};margin-bottom:18px}}
.big{{display:flex;justify-content:center;align-items:baseline;gap:18px;margin-top:80px;font-family:'Playfair Display',serif}}
.big span{{font-size:220px;line-height:1;font-weight:600}} .big span:first-child{{color:{SIG}}}
.big em{{font-style:normal;font-family:'Inter Tight',sans-serif;font-size:34px;color:{MUTE}}} .big b{{font-size:90px;color:{DIM};margin:0 26px;font-weight:400}}
.cap{{text-align:center;font-size:30px;line-height:1.45;color:{MUTE};margin-top:26px}}
.foot{{position:absolute;bottom:64px;left:110px;right:110px;display:flex;justify-content:space-between;font-size:18px;letter-spacing:.14em;color:{DIM};border-top:1px solid {RULE};padding-top:22px}}
</style></head><body>{''.join(S)}</body></html>'''
open('car.html','w').write(html); print('ok')
