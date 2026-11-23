const N=require('../numerosity.js');let bad=0;const ck=(c,m)=>{if(!c){bad++;console.log('FAIL',m)}};
for(const kind of['scatter','dice','grouped'])for(let n=1;n<=9;n++){const L=N.layout({n,seed:100+n,kind,r:4.4});ck(L.length===n,`${kind} ${n} count ${L.length}`);
 for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j];ck(Math.hypot(a.x-b.x,a.y-b.y)>=(a.r+b.r),`overlap ${kind} ${n}`)}
 L.forEach(p=>ck(p.x-p.r>=0&&p.x+p.r<=100&&p.y-p.r>=0&&p.y+p.r<=100,'bounds'));
 ck(JSON.stringify(L)===JSON.stringify(N.layout({n,seed:100+n,kind,r:4.4})),'determinism')}
for(const[l,r]of[[12,4],[10,8],[7,6],[20,15]])for(const cong of[true,false]){const c=N.cmpLayout({nl:l,nr:r,cong,seed:9});
 ck(c.left.length===l&&c.right.length===r,'counts');const ar=c.areaL>c.areaR;ck(cong?ar:!ar,`congruence ${l}/${r} ${cong}`)}
const t=[];for(let i=0;i<40;i++)t.push({a:12,b:8,ok:i%5!==0});const w=N.weber(t);ck(w&&w.w>0&&w.w<2,'weber '+JSON.stringify(w));
const chance=N.weber(Array.from({length:30},(_,i)=>({a:10,b:8,ok:i%2===0})));console.log('weber sample',w,'chance',chance);
console.log(bad?'FAILED '+bad:'numerosity tests pass');process.exit(bad?1:0)
// number reading
{const c=N.classifyNumErr;const ex=[[14,'41','reversal'],[52,'fifty-two','same'],[16,'sixty','teenty'],[90,'nineteen','teenty'],[100,'ten','place'],[34,'38','tensright'],[68,'thirty eight','unitsright'],[29,'','none'],[7,'8','close'],[53,'seventeen','different'],[10,'01','different']];
ex.forEach(([t,s,e])=>{const r=c(t,s);if(r.cls!==e){console.log('FAIL classify',t,s,r.cls,'wanted',e);process.exitCode=1}});
if(N.parseSaid('forty-one')!==41||N.parseSaid('a hundred')!==100||N.parseSaid('nonsense')!==null){console.log('FAIL parse');process.exitCode=1}}
