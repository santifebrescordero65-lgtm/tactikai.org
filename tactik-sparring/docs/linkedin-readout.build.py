MONO="'JetBrains Mono',monospace"; BODY="'Inter Tight',sans-serif"
BLUE="#0B62C4"; SIG="#C8102E"; INK="#101722"; INK2="#3C4757"; INK3="#6B7789"; GRID="#E7ECF2"; RULE="#C6CEDA"; GREY="#A9B3C1"; BW="#E6EFFA"
def t(x,y,s,size=13,fill=INK,w=400,a='start',f=None,ls=None):
    ff=f' font-family="{f}"' if f else ''; l=f' letter-spacing="{ls}"' if ls else ''
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{w}" text-anchor="{a}"{ff}{l}>{s}</text>'

# ---- panel 1: weekly impressions
weeks=[('22 Jun',664,0),('29 Jun',38,0),('6 Jul',3511,1),('13 Jul',1507,1),('20 Jul',10118,2),('27 Jul',7519,3),
       ('3 Aug',1631,1),('10 Aug',4486,2),('17 Aug',138,0),('24 Aug',2043,1),('31 Aug',139,0),('7 Sep',36,0),('14 Sep',163,0),('21 Sep',40,0)]
W,H=920,300; X0,X1,Y0,Y1=58,905,20,230; VMAX=11000
bw=(X1-X0)/len(weeks)
b=[f'<svg viewBox="0 0 {W} {H}" font-family="{BODY}">']
for v in (0,2500,5000,7500,10000):
    y=Y1-(v/VMAX)*(Y1-Y0)
    b.append(f'<line x1="{X0}" y1="{y:.1f}" x2="{X1}" y2="{y:.1f}" stroke="{GRID}"/>')
    b.append(t(X0-8,y+4,f'{v:,}',11,INK3,a='end',f=MONO))
for i,(lab,v,n) in enumerate(weeks):
    x=X0+i*bw+5; h=(v/VMAX)*(Y1-Y0); silent=i>=10
    col=BLUE if n>0 else (SIG if silent else GREY)
    b.append(f'<rect x="{x:.1f}" y="{Y1-h:.1f}" width="{bw-10:.1f}" height="{max(h,1.5):.1f}" rx="3" fill="{col}"/>')
    if i%2==0 or i==13: b.append(t(x+(bw-10)/2,Y1+18,lab,11,INK3,a='middle'))
    for k in range(n): b.append(f'<circle cx="{x+(bw-10)/2-(n-1)*6+k*12:.1f}" cy="{Y1+32}" r="3.8" fill="{BLUE}"/>')
xs=X0+9*bw+5+(bw-10)/2
b.append(f'<line x1="{xs:.1f}" y1="{Y0+30}" x2="{xs:.1f}" y2="{Y1}" stroke="{INK3}" stroke-dasharray="3 3"/>')
b.append(t(xs+8,Y0+44,'Last post &#183; 27 Aug',13,INK,700))
b.append(t(xs+8,Y0+62,'26 days of silence since',12,SIG,600))
b.append(t(X0+4*bw+6,Y0+6,'10,118',12,INK,700,f=MONO))
b.append('</svg>'); P1=''.join(b)

# ---- panel 2: channel (two separate single-measure charts, no dual axis)
def hbars(rows,vmax,fmt,title,w=440):
    o=[f'<svg viewBox="0 0 {w} 120" font-family="{BODY}">',t(0,14,title,11,INK3,500,f=MONO,ls=1.1)]
    for i,(lab,v,col) in enumerate(rows):
        y=34+i*40; L=120; bwid=(v/vmax)*(w-L-70)
        o.append(t(0,y+15,lab,14,INK,600))
        o.append(f'<rect x="{L}" y="{y}" width="{bwid:.1f}" height="22" rx="3" fill="{col}"/>')
        o.append(t(L+bwid+8,y+16,fmt(v),14,INK,700,f=MONO))
    o.append('</svg>'); return ''.join(o)
P2a=hbars([('Groups',94.2,GREY),('Your feed',5.8,BLUE)],100,lambda v:f'{v:.0f}%','SHARE OF IMPRESSIONS')
P2b=hbars([('Groups',0.56,GREY),('Your feed',5.27,BLUE)],6,lambda v:f'{v:.2f}%','ENGAGEMENT RATE')

# ---- panel 3: audience mismatch dumbbell
rows=[('Founders',9,2),('C-level',15,3),('Owners',10,3),('Firms of 2&#8211;10',21,7),
      ('Entry level',16,27),('Firms of 10,001+',9,18)]
W3=920; L=190; R=850; VM=30
def xp(v): return L+(v/VM)*(R-L)
o=[f'<svg viewBox="0 0 {W3} 330" font-family="{BODY}">']
for v in (0,10,20,30):
    o.append(f'<line x1="{xp(v):.1f}" y1="30" x2="{xp(v):.1f}" y2="292" stroke="{GRID}"/>'+t(xp(v),310,f'{v}%',11,INK3,a='middle',f=MONO))
o.append(t(0,20,'YOUR BUYERS &#8212; FALL',11,SIG,600,f=MONO,ls=1.1))
o.append(t(0,212,'NOT YOUR BUYERS &#8212; RISE',11,INK3,600,f=MONO,ls=1.1))
for i,(lab,f,c) in enumerate(rows):
    y=48+i*40+(24 if i>=4 else 0)
    o.append(t(0,y+5,lab,14,INK,600))
    o.append(f'<line x1="{xp(f):.1f}" y1="{y}" x2="{xp(c):.1f}" y2="{y}" stroke="{RULE}" stroke-width="3"/>')
    o.append(f'<circle cx="{xp(f):.1f}" cy="{y}" r="8" fill="{BLUE}" stroke="#fff" stroke-width="2"/>')
    o.append(f'<circle cx="{xp(c):.1f}" cy="{y}" r="8" fill="#fff" stroke="{INK2}" stroke-width="2.5"/>')
    lf,lc=(xp(f)+14,'start') if f>c else (xp(f)-14,'end')
    o.append(t(lf,y+5,f'{f}%',12.5,BLUE,700,lc,MONO))
    lf2,lc2=(xp(c)-14,'end') if f>c else (xp(c)+14,'start')
    o.append(t(lf2,y+5,f'{c}%',12.5,INK2,700,lc2,MONO))
o.append('</svg>'); P3=''.join(o)

# ---- panel 4: feed engagement rate per post
posts=[('9 Jul','The judgment layer',6,138),('15 Jul','The deal did not survive',6,119),('21 Jul','Broken in public',3,106),
       ('25 Jul','USMCA live test',12,188),('28 Jul','Now verifiable by you',13,512),('31 Jul','Ecuador carousel',20,158),
       ('2 Aug','AI negotiation, future of work',14,234),('7 Aug','Decision intelligence',1,52),('11 Aug','Field note 005',6,62),
       ('12 Aug','Cocoa negotiations',6,93),('27 Aug','The model can sound careful',7,69)]
L=300; R=800; VM=14
o=[f'<svg viewBox="0 0 {W3} {len(posts)*31+42}" font-family="{BODY}">']
for v in (0,5,10):
    x=L+(v/VM)*(R-L); o.append(f'<line x1="{x:.1f}" y1="6" x2="{x:.1f}" y2="{len(posts)*31+10}" stroke="{GRID}"/>'+t(x,len(posts)*31+30,f'{v}%',11,INK3,a='middle',f=MONO))
for i,(d,n,e,imp) in enumerate(posts):
    y=12+i*31; r=100*e/imp; hot=n in('Ecuador carousel',); mine=n in ('Cocoa negotiations','The model can sound careful')
    o.append(t(0,y+14,d,11.5,INK3,f=MONO))
    o.append(t(62,y+14,n,13.5,BLUE if hot else INK,700 if (hot or mine) else 500))
    wv=(r/VM)*(R-L)
    o.append(f'<rect x="{L}" y="{y+2}" width="{wv:.1f}" height="17" rx="3" fill="{BLUE if hot else (INK2 if mine else GREY)}"/>')
    o.append(t(L+wv+8,y+15,f'{r:.1f}%',12.5,INK,700,f=MONO))
    o.append(t(R+110,y+15,f'{e} / {imp}',11,INK3,a='end',f=MONO))
o.append('</svg>'); P4=''.join(o)

html=f'''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap">
<style>
 body{{margin:0;background:#fff;font-family:'Inter Tight',sans-serif;color:{INK};width:1000px}}
 .wrap{{padding:44px 40px 36px}}
 .k{{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:{BLUE}}}
 h1{{font-family:'Fraunces',serif;font-weight:600;font-size:40px;line-height:1.08;margin:10px 0 8px;letter-spacing:-.01em}}
 .sub{{font-size:17px;color:{INK2};margin:0 0 26px;line-height:1.45}}
 .tiles{{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid {RULE};border-radius:6px;overflow:hidden;margin-bottom:34px}}
 .tile{{padding:18px 16px;background:#F5F7FA;border-right:1px solid {RULE}}} .tile:last-child{{border-right:0}}
 .v{{font-family:'JetBrains Mono',monospace;font-size:30px;font-weight:500;color:{BLUE};line-height:1}}
 .v.bad{{color:{SIG}}} .v small{{font-size:15px;color:{INK3}}}
 .l{{font-size:14px;color:{INK2};margin-top:8px;line-height:1.35}}
 section{{border-top:1.5px solid {INK};padding-top:16px;margin-bottom:34px}}
 .n{{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.16em;color:{BLUE};text-transform:uppercase}}
 h2{{font-family:'Fraunces',serif;font-weight:600;font-size:25px;margin:6px 0 4px}}
 .so{{font-size:15.5px;color:{INK2};margin:0 0 16px;line-height:1.45}} .so b{{color:{INK}}}
 .two{{display:grid;grid-template-columns:1fr 1fr;gap:28px}}
 .lg{{display:flex;gap:24px;font-size:13.5px;color:{INK2};margin:0 0 8px}} .lg i{{display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:7px;vertical-align:-2px}}
 .foot{{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:{INK3};line-height:1.6;border-top:1px solid {RULE};padding-top:12px}}
</style></head><body><div class="wrap">
<div class="k">LinkedIn readout &#183; 25 Jun &#8211; 22 Sep 2026</div>
<h1>Your content earns attention.<br>The distribution is wrong.</h1>
<p class="sub">90 days, 32,033 impressions, 1,968 followers. What your own analytics say before we write the next post.</p>
<div class="tiles">
 <div class="tile"><div class="v bad">&#8722;98<small>%</small></div><div class="l">impressions, July to September</div></div>
 <div class="tile"><div class="v">9.4<small>&#215;</small></div><div class="l">engagement rate of your feed versus the groups</div></div>
 <div class="tile"><div class="v bad">15<small>&#8594;3%</small></div><div class="l">C-level among followers, versus among viewers</div></div>
 <div class="tile"><div class="v">12.7<small>%</small></div><div class="l">best post: the Ecuador carousel</div></div>
</div>
<section><div class="n">01 &#183; Momentum</div><h2>July built it. September lost it.</h2>
<p class="so">21,467 impressions in July, 9,543 in August, <b>342 in September</b>. The drop is not the algorithm &#8212; it is the calendar. Blue weeks had a post; the dots count them.</p>{P1}</section>
<section><div class="n">02 &#183; Channel</div><h2>Groups bring reach. Your feed brings attention.</h2>
<p class="so">94% of impressions came through groups, at 0.56% engagement. Your own feed delivered 6% of the reach at <b>5.27%</b> &#8212; nine times more attention per view.</p>
<div class="two"><div>{P2a}</div><div>{P2b}</div></div></section>
<section><div class="n">03 &#183; Audience</div><h2>Your followers are your buyers. Your viewers are not.</h2>
<p class="so">Who follows you: founders, owners, C-level, small firms &#8212; <b>Guayaquil 10%, Miami 7%, New York 4%</b>. Who actually sees your posts: entry-level IT services staff at very large firms &#8212; <b>Bengaluru 6%, Delhi 5%, Hyderabad 3%, Mumbai 3%</b>. The groups are carrying your content to the wrong room.</p>
<div class="lg"><span><i style="background:{BLUE}"></i>your followers</span><span><i style="background:#fff;border:2.5px solid {INK2};width:10px;height:10px"></i>people who saw your posts</span></div>{P3}</section>
<section><div class="n">04 &#183; What landed</div><h2>The post closest to home won.</h2>
<p class="so">Engagement rate on your own feed, per post. The <b>Ecuador carousel</b> leads by a clear margin; your two latest posts are 2nd and 4th. Small denominators on the right &#8212; read the ranking, not the decimals.</p>{P4}</section>
<div class="foot">Source: LinkedIn Aggregate Analytics export, 25 Jun&#8211;22 Sep 2026 (two exports supplied; cell-identical). Engagement totals are net of a &#8722;42 correction LinkedIn applied on 7 Aug. Channel rates use the 40 posts where both impressions and engagements are reported. Demographic shares are LinkedIn&#8217;s top-N buckets; locations below 1% are not reported.</div>
</div></body></html>'''
open('readout.html','w').write(html); print('ok')
