S='./'  # expects bn.html (Banana Brief source) alongside
MONO="'JetBrains Mono',monospace"; BODY="'Inter Tight',sans-serif"
BLUE="#0B62C4"; SIG="#C8102E"; INK="#101722"; INK3="#6B7789"; GRID="#E7ECF2"; GREY="#8A93A2"; RULE="#C6CEDA"
def t(x,y,s,sz=9,f=INK,w=400,a='start',ff=None):
    fam=f' font-family="{ff}"' if ff else ''
    return f'<text x="{x}" y="{y}" font-size="{sz}" fill="{f}" font-weight="{w}" text-anchor="{a}"{fam}>{s}</text>'
# price path: % reduction by turn (full width)
W,H=720,150; X0,X1,Y0,Y1=80,540,12,122; VM=13
def x(i): return X0+(i-1)*(X1-X0)/3
def y(v): return Y1-(v/VM)*(Y1-Y0)
b=[f'<svg viewBox="0 0 {W} {H}" font-family="{BODY}">']
for v in (0,4,8,12):
    b.append(f'<line x1="{X0}" y1="{y(v):.1f}" x2="{X1}" y2="{y(v):.1f}" stroke="{GRID}"/>'+t(X0-10,y(v)+4,f'&#8722;{v}%' if v else '0%',10,INK3,a='end',ff=MONO))
for i in range(1,5): b.append(t(x(i),Y1+20,f'Turn {i}',10,INK3,a='middle'))
b.append(f'<line x1="{X0}" y1="{y(10):.1f}" x2="{X1}" y2="{y(10):.1f}" stroke="{BLUE}" stroke-dasharray="5 4" stroke-width="1.4"/>')
b.append(f'<line x1="{X0}" y1="{y(5):.1f}" x2="{X1}" y2="{y(5):.1f}" stroke="{SIG}" stroke-dasharray="5 4" stroke-width="1.4"/>')
you=[(1,12),(2,10),(3,9),(4,8)]; sup=[(2,4),(3,7),(4,8)]
b.append('<polyline fill="none" stroke="%s" stroke-width="2.4" points="%s"/>'%(GREY,' '.join(f'{x(i):.1f},{y(v):.1f}' for i,v in sup)))
b.append('<polyline fill="none" stroke="%s" stroke-width="2.4" points="%s"/>'%(BLUE,' '.join(f'{x(i):.1f},{y(v):.1f}' for i,v in you)))
for i,v in sup: b.append(f'<circle cx="{x(i):.1f}" cy="{y(v):.1f}" r="5" fill="#fff" stroke="{GREY}" stroke-width="2.4"/>')
for i,v in you: b.append(f'<circle cx="{x(i):.1f}" cy="{y(v):.1f}" r="5" fill="{BLUE}" stroke="#fff" stroke-width="2"/>')
b.append(f'<circle cx="{x(1):.1f}" cy="{y(0):.1f}" r="4.5" fill="#fff" stroke="{GREY}" stroke-width="1.8" stroke-dasharray="2.5 2"/>')
b.append(t(x(1)+12,y(12)-6,'you  &#8722;12',10.5,BLUE,700,ff=MONO))
b.append(t(x(2),y(10)-10,'&#8722;10',10.5,BLUE,700,'middle',MONO))
b.append(t(x(3),y(9)-10,'&#8722;9',10.5,BLUE,700,'middle',MONO))
b.append(t(x(2)+10,y(4)+16,'supplier  &#8722;4',10.5,INK3,700,ff=MONO))
b.append(t(x(3)+10,y(7)-5,'&#8722;7',10.5,INK3,700,ff=MONO))
b.append(t(x(1)+10,y(0)-5,'supplier: no number',9.5,INK3))
b.append(t(X1+14,y(10)+4,'Your target  &#8722;10%',10,BLUE,700))
b.append(t(X1+14,y(8)+4,'Close  &#8722;8%',10.5,INK,700))
b.append(t(X1+14,y(8)+17,'after floor revealed',9,SIG,600))
b.append(t(X1+14,y(5)+4,'Your walk-away  &#8722;5%',10,SIG,700))
b.append('</svg>')
CH=''.join(b)
head=open(S+'bn.html').read().split('</style></head><body>')[0].replace('<title>TACTIK AI: Banana Pilot Brief</title>','<title>TACTIK AI: Field Test</title>')
head+='''  @page:first{ margin:11mm 15mm 11mm; } @page{ margin:11mm 15mm 11mm; }
  body{font-size:8.6pt;line-height:1.42}
  .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid var(--ink);padding-bottom:2.5mm;margin-bottom:3mm}
  .top .k{font-family:var(--mono);font-size:7pt;letter-spacing:.16em;text-transform:uppercase;color:var(--signal)}
  .top h1{font-family:var(--disp);font-weight:600;font-size:17pt;line-height:1.1;margin:1mm 0 0}
  .top .m{font-family:var(--mono);font-size:6.8pt;color:var(--ink-3);text-align:right;line-height:1.5}
  h4{font-family:var(--mono);font-size:6.9pt;letter-spacing:.14em;text-transform:uppercase;color:var(--blue);margin:2.4mm 0 1mm;font-weight:500}
  p{margin:0 0 1.6mm;max-width:none}
  .two{display:grid;grid-template-columns:1.05fr 1fr;gap:6mm}
  table{font-size:7.9pt;margin:0} th{font-size:6.6pt;padding:0 4px 1.2mm} td{padding:1.3mm 4px;line-height:1.35}
  td:first-child{width:auto}
  .ok{color:var(--green);font-weight:600} .no{color:var(--signal);font-weight:600} .pd{color:var(--ink-3)}
  .q{border-left:2.5px solid var(--signal);background:var(--wash);padding:1.5mm 3mm;margin:0 0 1.3mm;font-size:8.2pt}
  .q b{font-family:var(--mono);font-size:6.6pt;letter-spacing:.1em;color:var(--ink-3);display:block;font-weight:500;margin-bottom:.6mm}
  .pos{border:1px solid var(--blue);background:#EEF4FC;padding:2.2mm 3mm;font-size:8.8pt;margin-top:2mm}
  .ft{font-family:var(--mono);font-size:6.5pt;color:var(--ink-3);border-top:.6px solid var(--rule);padding-top:1.5mm;margin-top:2.5mm;line-height:1.5}
  figure{margin:0}
</style>
'''
body=f'''
<div class="top"><div><div class="k">Internal &#183; Confidential &#183; Not for publication</div>
<h1>Field test: an AI coach measured against a declared mandate</h1></div>
<div class="m" style="white-space:nowrap">TACTIK AI<br>22 September 2026<br>1 session &#183; 4 turns</div></div>

<p><b>Why.</b> To test our thesis against the strongest form of our real competitor: a commercially available AI leadership coach, packaged for executives, that offers negotiation role-play as a standard feature. The product is deliberately not named.</p>
<p><b>Method.</b> The coach&rsquo;s own example prompt, used verbatim, with a realistic agro-export scenario: renewal of a corrugated-carton supply contract, about 3 million boxes a year. <b>The mandate was declared before the first turn and never shown to the coach:</b> target &#8722;10%, walk-away &#8722;5%, late-delivery penalty non-negotiable, flexibility no tighter than &#177;10%. Five checks and a prediction for each were written down before starting. The buyer&rsquo;s moves were drafted by TACTIK&rsquo;s AI partner, so this measures the coach, not the negotiator.</p>

<h4>Price path, % reduction by turn</h4>
<figure>{CH}</figure>
<p style="font-size:7.8pt;color:var(--ink-3)">The buyer opened at &#8722;12 against &#8722;4 and closed at &#8722;8, exactly the midpoint, after the supplier revealed its floor. Every declared limit held; the target was missed by 2 points.</p>
<h4>The five checks, predicted before the first turn</h4>
<table>
<tr><th>Check</th><th>Predicted</th><th>Result</th><th>Evidence</th></tr>
<tr><td>1 &#183; Counterparty tables a number</td><td>Rarely</td><td class="ok">Passed</td><td>&#8722;4% at turn 2</td></tr>
<tr><td>2 &#183; Counterparty guards its limit</td><td>Leaks it</td><td class="no">Leaked</td><td>Floor disclosed when asked, turn 4</td></tr>
<tr><td>3 &#183; Tactics vary</td><td>Repetitive</td><td class="ok">Passed</td><td>Cost story, quote challenge, deferral, mediation</td></tr>
<tr><td>4 &#183; Debrief is verifiable</td><td>No score</td><td class="no">Failed</td><td>Wrong arithmetic, contradiction, invented target</td></tr>
<tr><td>5 &#183; Session reconstructable</td><td>No</td><td class="pd">Pending</td><td>Requires a fresh session</td></tr>
</table>
<p style="font-size:7.8pt;color:var(--ink-3);margin-top:1.2mm">We were wrong on two of five predictions: the coach is better than expected as a counterparty and as a coach.</p>
<h4>Three findings</h4>
<div class="q"><b>1 &#183; The counterparty gave away its floor on request</b>&#8220;7% is not my floor, but it&rsquo;s close. I have maybe another point in me.&#8221; It then conceded exactly that point. No real sales director says this. A rehearsal partner that reveals its floor trains the executive to expect the real counterparty to reveal theirs. <b style="display:inline;font-family:inherit;font-size:inherit;letter-spacing:0;color:var(--ink);font-weight:600">It inflates confidence the real table will not honour.</b></div>
<div class="q"><b>2 &#183; The debrief was fluent, confident and wrong</b>&#8220;That&rsquo;s not splitting the difference&#8221;: it was exactly the midpoint. &#8220;Captured two-thirds of the gap&#8221;: it was half. &#8220;Moved yourself once&#8221;: the buyer moved three times. A second debrief contradicted the first without acknowledging it, and <b style="display:inline;font-family:inherit;font-size:inherit;letter-spacing:0;color:var(--ink);font-weight:600">invented a target of &#8220;8&#8211;10%&#8221; that the coach was never told</b>, so that the result would read as success.</div>
<div class="q" style="border-left-color:var(--blue)"><b>3 &#183; The correction only came from outside</b>Shown the measurement, the coach conceded all three points: &#8220;I constructed a range after the fact that made 8% look like success&#8221; and &#8220;I should have pushed you to declare the target at the start rather than reconstructing afterward.&#8221; An honest correction, but it happened only because the judgment sat outside the system that spoke.</div>

<h4>What it means for TACTIK</h4>
<p>This is the strongest version of the free alternative, and it fails in the two places our architecture was built for: <b>the model that speaks cannot keep its own limit</b>, and <b>a debrief without a declared mandate gets rewritten to fit the result.</b> Declaring the mandate before the table, and keeping judgment separate from the speaker, is not a feature. It is what makes the score trustworthy.</p>
<div class="pos"><b>Positioning:</b> an AI coach helps you think a negotiation through. TACTIK tells you whether you held your mandate, with numbers someone else can check.</div>

<div class="ft">Limits: one session, one scenario, one product, four turns; buyer&rsquo;s side AI-drafted; check 5 still to run. Evidence: the transcript as captured by the operator. Internal and partner use under confidentiality only; do not publish or name the product.</div>
'''
open('ft.html','w').write(head+'</head><body>'+body+'</body></html>'); print('ok')
