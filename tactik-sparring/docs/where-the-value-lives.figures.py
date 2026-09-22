# Figures for "Where the Value Lives". Two hues only: blue = our core / measured,
# signal = the one boundary that must never be crossed. Everything else is ink
# and neutral grey. Every mark is also labelled in text.
MONO="'JetBrains Mono',monospace"; BODY="'Inter Tight',sans-serif"; DISP="'Fraunces',serif"
BLUE="#0B62C4"; BLUE_W="#E6EFFA"; SIG="#C8102E"; INK="#101722"; INK2="#3C4757"; INK3="#6B7789"
GRID="#E7ECF2"; RULE="#C6CEDA"; WASH="#F5F7FA"; EMPTY="#E4E9F0"
F={}
def svg(w,h,label,body):
    return (f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{label}" font-family="{BODY}">'
            f'<rect width="{w}" height="{h}" fill="#FFFFFF"/>'+''.join(body)+'</svg>')
def t(x,y,s,size=9,fill=INK,weight=400,anchor='start',font=None,ls=None):
    f=f' font-family="{font}"' if font else ''
    l=f' letter-spacing="{ls}"' if ls else ''
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" text-anchor="{anchor}"{f}{l}>{s}</text>'

# ---------- FIG 1: two problems on one timeline ----------
b=[]
b.append(t(30,20,'PROBLEM 1 &#183; BEFORE',8.2,INK3,font=MONO,ls=1.3))
b.append(t(30,37,'The negotiator walks in cold',12,INK,600))
b.append(t(30,53,'Buyer: the negotiator  &#183;  Budget: training &#8212; small, discretionary',8.8,INK3))
b.append(f'<path d="M30 70 V62 H370 V70" fill="none" stroke="{RULE}" stroke-width="1.4"/>')
phases=[(30,190,'Preparation',False),(210,370,'At the table',False),(390,570,'Aftermath',True)]
b.append(f'<line x1="20" y1="92" x2="580" y2="92" stroke="{RULE}" stroke-width="1"/>')
for x0,x1,lab,hot in phases:
    if hot:
        b.append(f'<rect x="{x0}" y="78" width="{x1-x0}" height="28" rx="14" fill="{BLUE}"/>')
        b.append(t((x0+x1)/2,96.5,lab,10,'#FFFFFF',600,'middle'))
    else:
        b.append(f'<rect x="{x0+.5}" y="78.5" width="{x1-x0-1}" height="27" rx="13.5" fill="{WASH}" stroke="{RULE}"/>')
        b.append(t((x0+x1)/2,96.5,lab,10,INK2,500,'middle'))
b.append(f'<path d="M390 114 V122 H570 V114" fill="none" stroke="{BLUE}" stroke-width="1.8"/>')
b.append(t(570,140,'PROBLEM 2 &#183; AFTER &#8212; OUR LEAD',8.2,BLUE,500,'end',MONO,1.3))
b.append(t(570,157,'Nobody can reconstruct why a concession was made',12,INK,600,'end'))
b.append(t(570,173,'Buyer: board, legal, risk  &#183;  Budget: governance &#8212; larger, defensive',8.8,INK3,anchor='end'))
F['FIG1']=svg(600,184,'Two problems, two buyers, on one negotiation timeline',b)

# ---------- FIG 2: qualitative positioning map ----------
b=[]; X0,X1,Y0,Y1=86,560,26,236
b.append(f'<rect x="{(X0+X1)/2}" y="{Y0}" width="{(X1-X0)/2}" height="{(Y1-Y0)/2}" fill="{BLUE_W}"/>')
b.append(t(X1-8,Y0+14,'ONE NEGOTIATION &#183; HIGH STAKES',7.6,BLUE,500,'end',MONO,1.1))
b.append(f'<line x1="{X0}" y1="{Y1}" x2="{X1}" y2="{Y1}" stroke="{RULE}"/>')
b.append(f'<line x1="{X0}" y1="{Y0}" x2="{X0}" y2="{Y1}" stroke="{RULE}"/>')
b.append(f'<line x1="{(X0+X1)/2}" y1="{Y0}" x2="{(X0+X1)/2}" y2="{Y1}" stroke="{GRID}" stroke-dasharray="3 3"/>')
b.append(f'<line x1="{X0}" y1="{(Y0+Y1)/2}" x2="{X1}" y2="{(Y0+Y1)/2}" stroke="{GRID}" stroke-dasharray="3 3"/>')
b.append(t(X0,Y1+16,'Recurs many times &#8212; repeatable',8.6,INK3))
b.append(t(X1,Y1+16,'Happens once &#8212; and it matters',8.6,INK3,anchor='end'))
b.append(t((X0+X1)/2,Y1+31,'HOW OFTEN THE SAME NEGOTIATION RECURS',7.8,INK3,500,'middle',MONO,1.2))
b.append(f'<text transform="translate(18 {(Y0+Y1)/2}) rotate(-90)" font-size="7.8" fill="{INK3}" font-family="{MONO}" letter-spacing="1.2" text-anchor="middle">STAKES PER NEGOTIATION</text>')
b.append(t(X0-8,Y0+8,'High',8.6,INK3,anchor='end'))
b.append(t(X0-8,Y1-2,'Low',8.6,INK3,anchor='end'))
def pt(x,y,label,sub,filled,hero=False,anchor='start',dx=12):
    r=9 if hero else 7
    o=[]
    if filled:
        o.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{BLUE if hero else INK2}" stroke="#fff" stroke-width="2"/>')
    else:
        o.append(f'<circle cx="{x}" cy="{y}" r="{r-1}" fill="#fff" stroke="{INK2}" stroke-width="2"/>')
    lx=x+dx if anchor=='start' else x-dx
    o.append(t(lx,y-1,label,10 if hero else 9.4,BLUE if hero else INK,700 if hero else 600,anchor))
    o.append(t(lx,y+12,sub,8.2,INK3,anchor=anchor))
    return ''.join(o)
b.append(pt(170,190,'Sales-call AI','scored against a script',True))
b.append(pt(300,146,'Generic LLM role-play','used anywhere &#183; scores nothing',False))
b.append(pt(418,86,'Consultancy &amp; exec-ed','expert, but leaves no record',False,anchor='end'))
b.append(pt(508,58,'TACTIK','measured &#183; sealed &#183; domain-deep',True,True,anchor='end'))
F['FIG2']=svg(600,276,'Qualitative positioning map of the negotiation-preparation market',b)

# ---------- FIG 3: capability matrix ----------
cols=['Hidden\nlimits','Scored\ndebrief','Sealed\nrecord','Domain\ndepth','Live\nface','Scales\ncheaply']
rows=[('Generic LLM role-play',[0,0,0,0,0,2]),
      ('Sales-call AI',[0,2,1,0,1,2]),
      ('Consultancy &amp; exec-ed',[2,1,0,2,2,0]),
      ('Avatar vendors',[0,0,0,0,2,2]),
      ('TACTIK',[2,2,1,2,1,1])]
b=[]; LX=176; CW=68; TOP=46; RH=30
for j,c in enumerate(cols):
    a,bb=c.split('\n'); cx=LX+j*CW+CW/2
    b.append(t(cx,16,a,8.6,INK2,600,'middle')); b.append(t(cx,28,bb,8.6,INK2,600,'middle'))
b.append(f'<line x1="0" y1="{TOP-8}" x2="{LX+6*CW}" y2="{TOP-8}" stroke="{INK}" stroke-width="1.2"/>')
for i,(name,v) in enumerate(rows):
    y=TOP+i*RH; hero=name=='TACTIK'
    if hero: b.append(f'<rect x="0" y="{y-4}" width="{LX+6*CW}" height="{RH}" fill="{BLUE_W}"/>')
    b.append(t(8,y+15,name,9.8,BLUE if hero else INK,700 if hero else 500))
    col=BLUE if hero else INK2
    for j,s in enumerate(v):
        cx=LX+j*CW+CW/2; cy=y+11
        if s==2: b.append(f'<circle cx="{cx}" cy="{cy}" r="6.5" fill="{col}"/>')
        elif s==1:
            b.append(f'<circle cx="{cx}" cy="{cy}" r="5.8" fill="#fff" stroke="{col}" stroke-width="1.6"/>')
            b.append(f'<path d="M{cx} {cy-5.8} A5.8 5.8 0 0 1 {cx} {cy+5.8} Z" fill="{col}"/>')
        else: b.append(f'<circle cx="{cx}" cy="{cy}" r="5.8" fill="#fff" stroke="{RULE}" stroke-width="1.6"/>')
    if i<len(rows)-1 and not hero and rows[i+1][0]!='TACTIK':
        b.append(f'<line x1="0" y1="{y+RH-4}" x2="{LX+6*CW}" y2="{y+RH-4}" stroke="{GRID}"/>')
ly=TOP+len(rows)*RH+14
b.append(f'<circle cx="14" cy="{ly-3}" r="5.5" fill="{INK2}"/>'+t(25,ly,'yes',8.6,INK3))
b.append(f'<circle cx="68" cy="{ly-3}" r="5" fill="#fff" stroke="{INK2}" stroke-width="1.5"/><path d="M68 {ly-8} A5 5 0 0 1 68 {ly+2} Z" fill="{INK2}"/>'+t(79,ly,'partial',8.6,INK3))
b.append(f'<circle cx="138" cy="{ly-3}" r="5" fill="#fff" stroke="{RULE}" stroke-width="1.5"/>'+t(149,ly,'no',8.6,INK3))
F['FIG3']=svg(LX+6*CW+4,ly+8,'Capability comparison across five categories',b)

# ---------- FIG 4: core versus commodity ----------
b=[]
b.append(f'<rect x="205" y="6" width="190" height="34" rx="4" fill="{INK}"/>')
b.append(t(300,21,'One mandate record',10,'#FFFFFF',600,'middle'))
b.append(t(300,33,'the executive&#8217;s real limits',8,'#AFBDCE',anchor='middle'))
b.append(f'<path d="M250 40 C250 62 150 58 150 82" fill="none" stroke="{INK3}" stroke-width="1.3" marker-end="url(#ah)"/>')
b.append(f'<path d="M350 40 C350 62 450 58 450 82" fill="none" stroke="{BLUE}" stroke-width="1.6" marker-end="url(#ahb)"/>')
b.append(t(186,62,'compiled with no limits',8.3,INK3,anchor='end'))
b.append(t(414,62,'compiled with every limit',8.3,BLUE,500))
b.insert(0,f'<defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="{INK3}"/></marker>'
           f'<marker id="ahb" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="{BLUE}"/></marker></defs>')
# left panel
b.append(f'<rect x="10" y="86" width="270" height="176" rx="5" fill="{WASH}" stroke="{RULE}"/>')
b.append(t(24,105,'GENERATION',8.4,INK3,500,font=MONO,ls=1.4))
b.append(t(24,120,'Commodity &#8212; we buy it and ride the curve',9,INK2,500))
for k,s in enumerate(['Counterparty language model','Voice','Video face &#183; avatar vendor']):
    y=134+k*38
    b.append(f'<rect x="24" y="{y}" width="242" height="28" rx="3" fill="#FFFFFF" stroke="{RULE}"/>')
    b.append(t(36,y+18,s,9.4,INK2))
# right panel
b.append(f'<rect x="320" y="86" width="270" height="176" rx="5" fill="{BLUE_W}" stroke="{BLUE}" stroke-width="1.2"/>')
b.append(t(334,105,'ADJUDICATION',8.4,BLUE,500,font=MONO,ls=1.4))
b.append(t(334,120,'Our core &#8212; we build it and own it',9,INK,600))
for k,s in enumerate(['Offer extraction','Arbiter &#183; holds every limit','Six-axis scoring','Sealed debrief']):
    y=132+k*31
    b.append(f'<rect x="334" y="{y}" width="242" height="24" rx="3" fill="{BLUE}"/>')
    b.append(t(346,y+16,s,9.4,'#FFFFFF',500))
# boundary
b.append(f'<line x1="300" y1="80" x2="300" y2="270" stroke="{SIG}" stroke-width="2" stroke-dasharray="5 4"/>')
b.append(f'<path d="M281 200 H313" stroke="{INK3}" stroke-width="1.3" marker-end="url(#ah)"/>')
b.append(t(300,288,'LIMITS NEVER CROSS THIS LINE',8.2,SIG,500,'middle',MONO,1.3))
b.append(t(300,301,'what is said flows right on every turn &#8212; what is permitted never flows left',8.4,INK3,anchor='middle'))
F['FIG4']=svg(600,308,'Architecture: generation is commodity, adjudication is the core',b)

# ---------- FIG 5: cost per session (from What We Built) ----------
rows=[('Text rehearsal','unbounded',0,0),('Counterfactual run','~4 min',0,0),
      ('Replica vs replica','~4 min',2.80,2.80),('Human sparring, video','12&#8211;20 min',8.40,14.00)]
b=[]; X0,X1,VMAX=196,520,15
def x(v): return X0+(v/VMAX)*(X1-X0)
for v in (0,5,10,15):
    b.append(f'<line x1="{x(v):.1f}" y1="14" x2="{x(v):.1f}" y2="158" stroke="{GRID}"/>')
    b.append(t(x(v),172,f'${v}',8.4,INK3,anchor='middle',font=MONO))
b.append(t(X1,8,'USD PER SESSION',7.8,INK3,500,'end',MONO,1.2))
for i,(lab,dur,lo,hi) in enumerate(rows):
    y=26+i*34
    b.append(t(0,y+9,lab,9.6,INK,600)); b.append(t(0,y+21,dur,8.2,INK3))
    video=hi>0 and i==3
    if hi==0:
        b.append(f'<circle cx="{x(0):.1f}" cy="{y+8}" r="5" fill="{BLUE}"/>')
        b.append(t(x(0)+11,y+12,'$0.00 &#8212; pure inference',9,INK,500,font=MONO))
    elif lo==hi:
        b.append(f'<rect x="{x(0):.1f}" y="{y+2}" width="{x(hi)-x(0):.1f}" height="13" rx="3" fill="{INK3}"/>')
        b.append(t(x(hi)+7,y+12,f'${hi:.2f}',9,INK,500,font=MONO))
    else:
        b.append(f'<rect x="{x(0):.1f}" y="{y+2}" width="{x(lo)-x(0):.1f}" height="13" rx="3" fill="{INK3}"/>')
        b.append(f'<rect x="{x(lo):.1f}" y="{y+2}" width="{x(hi)-x(lo):.1f}" height="13" rx="3" fill="#fff" stroke="{INK3}" stroke-width="1.4" stroke-dasharray="3 2"/>')
        b.append(t(x(hi)+7,y+12,f'${lo:.2f}&#8211;${hi:.2f}',9,INK,500,font=MONO))
b.append(f'<line x1="{X0}" y1="158" x2="{X1}" y2="158" stroke="{RULE}"/>')
b.append(f'<circle cx="6" cy="190" r="5" fill="{BLUE}"/>'+t(16,194,'the defensible core &#8212; free to run',8.4,INK3))
b.append(f'<rect x="210" y="184" width="16" height="11" rx="2" fill="{INK3}"/>'+t(232,194,'video minutes &#8212; metered separately',8.4,INK3))
F['FIG5']=svg(600,202,'Cost per session type',b)

# ---------- FIG 6: score weights; composure needs live ----------
axes=[('Red-line integrity',30,False),('Concession discipline',25,False),('Anchor discipline',15,False),
      ('Information ratio',15,False),('Pressure composure',15,True)]
b=[]; X0,W,Y=0,596,40; acc=0
b.append(f'<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="{BLUE_W}"/><line x1="0" y1="0" x2="0" y2="6" stroke="{BLUE}" stroke-width="2.2"/></pattern></defs>')
b.append(t(0,16,'SHARE OF THE COMPOSITE SCORE',7.8,INK3,500,font=MONO,ls=1.2))
for name,w,live in axes:
    x0=X0+acc/100*W; x1=X0+(acc+w)/100*W; gap=2 if acc+w<100 else 0
    if live:
        b.append(f'<rect x="{x0:.1f}" y="{Y}" width="{x1-x0-gap:.1f}" height="30" rx="3" fill="url(#hatch)" stroke="{BLUE}" stroke-width="1.4"/>')
    else:
        b.append(f'<rect x="{x0:.1f}" y="{Y}" width="{x1-x0-gap:.1f}" height="30" rx="3" fill="{BLUE}"/>')
        b.append(t(x0+8,Y+19,f'{w}%',10,'#FFFFFF',600,font=MONO))
    if live:
        b.append(f'<rect x="{x0+5:.1f}" y="{Y+7}" width="34" height="16" rx="2" fill="#FFFFFF"/>')
        b.append(t(x0+8,Y+19,f'{w}%',10,BLUE,700,font=MONO))
        cx=(x0+x1)/2
    words=name.split(' ',1)
    b.append(t(x0+2,Y+46,words[0],8.6,INK,600)); b.append(t(x0+2,Y+58,words[1],8.6,INK,600))
    acc+=w
b.append(f'<line x1="{cx:.1f}" y1="{Y+64}" x2="{cx:.1f}" y2="{Y+78}" stroke="{BLUE}" stroke-width="1.4"/>')
b.append(t(W-2,Y+92,'Reachable only when the exchange is live',9.4,BLUE,700,'end'))
b.append(t(W-2,Y+105,'hesitation &#183; silence &#183; the pause before conceding',8.4,INK3,anchor='end'))
b.append(f'<rect x="0" y="{Y+82}" width="14" height="11" rx="2" fill="{BLUE}"/>'+t(20,Y+91,'measurable in text',8.4,INK3))
b.append(f'<rect x="130" y="{Y+82}" width="14" height="11" rx="2" fill="url(#hatch)" stroke="{BLUE}"/>'+t(150,Y+91,'needs a live exchange',8.4,INK3))
F['FIG6']=svg(600,Y+112,'Scoring weights and the axis that video makes measurable',b)

# ---------- FIG 7: the sequence to a business ----------
steps=[('01','Paid pilot','90 days &#183; one metric','breach rate of declared limits'),
       ('02','Vertical library','agro-export first','producer and exporter genomes'),
       ('03','Adjacent verticals','the same shape','other commodities, procurement'),
       ('04','The live layer','video certification','metered, on top of the report')]
b=[]; W=146; G=5
for i,(n,h,s1,s2) in enumerate(steps):
    x0=i*(W+G); hot=i==0; end=i==3
    pts=f'{x0},0 {x0+W-10},0 {x0+W},34 {x0+W-10},68 {x0},68 {x0+10},34' if i>0 else f'{x0},0 {x0+W-10},0 {x0+W},34 {x0+W-10},68 {x0},68'
    fill=BLUE if hot else (BLUE_W if not end else WASH)
    stroke=BLUE if not end else RULE
    dash=' stroke-dasharray="4 3"' if end else ''
    b.append(f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="1.2"{dash}/>')
    tx=x0+(18 if i>0 else 12); c1='#FFFFFF' if hot else INK; c2='#D6E6F8' if hot else INK3; cn='#BFD8F4' if hot else (BLUE if not end else INK3)
    b.append(t(tx,17,n,8,cn,500,font=MONO,ls=1.2))
    b.append(t(tx,33,h,10.4,c1,700))
    b.append(t(tx,47,s1,8.2,c2)); b.append(t(tx,59,s2,7.6,c2))
F['FIG7']=svg(4*W+3*G+2,72,'The sequence from pilot to platform',b)

import json; json.dump(F,open('figs.json','w'))
print({k:len(v) for k,v in F.items()})
