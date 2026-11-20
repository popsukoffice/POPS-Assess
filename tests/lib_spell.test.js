const L=require('../lib.js');
const cases=[
['night','nite','plausible'],['night','nit','nonplausible'],['night','knight','plausible'],['boat','bote','plausible'],['boat','bot','nonplausible'],
['cat','cat','correct'],['cat','kat','plausible'],['cat','ct','nonplausible'],['bed','bad','nonplausible'],['made','mayd','plausible'],['made','mad','nonplausible'],
['rain','rane','plausible'],['rain','rayn','plausible'],['phone','fone','plausible'],['phone','fon','nonplausible'],['train','chrain','nonplausible'],['jumped','jumpt','plausible'],['jumped','jumpd','plausible'],['jumped','jump','nonplausible'],
['dog','bog','nonplausible'],['dog','dgo','nonplausible'],['said','sed','plausible'],['said','siad','nonplausible'],['because','becos','plausible'],['because','becuz','plausible'],
['friend','frend','plausible'],['friend','freind','nonplausible'],['school','skool','plausible'],['school','scool','plausible'],['light','lite','plausible'],['light','lit','nonplausible'],
['little','litel','plausible'],['little','litle','plausible'],['little','lito','nonplausible'],['house','hows','plausible'],['house','hous','plausible'],['house','huse','nonplausible'],
['because','bcause','nonplausible'],['happy','hapy','plausible'],['happy','hapee','plausible'],['running','runing','plausible'],['running','runnin','nonplausible'],['stopped','stopt','plausible'],
['monkey','munky','plausible'],['was','woz','plausible'],['was','wos','plausible'],['was','was','correct'],['they','thay','plausible'],['they','thae','nonplausible'],
['there','thare','plausible'],['there','their','plausible'],['their','there','plausible'],['sure','shore','plausible'],['knife','nife','plausible'],['write','rite','plausible'],['write','wite','nonplausible'],
['girl','gurl','plausible'],['girl','grl','nonplausible'],['bird','burd','plausible'],['church','chirch','plausible'],['church','curch','nonplausible'],['sheep','shep','nonplausible'],['sheep','sheap','plausible'],
['could','cud','plausible'],['would','wud','plausible'],['people','peeple','plausible'],['people','pepol','nonplausible'],['beautiful','butiful','plausible'],['beautiful','beutiful','plausible'],
['bike','biek','nonplausible'],['bike','bik','nonplausible'],['table','tabel','plausible'],['table','tabl','plausible'],['circle','sircle','plausible'],['circle','cirkle','plausible'],
['pretty','prity','plausible'],['going','goin','nonplausible'],['again','agen','plausible'],['busy','bizzy','plausible'],['busy','bisy','plausible'],
['enough','enuf','plausible'],['enough','enogh','nonplausible'],['though','tho','plausible'],['through','thru','plausible'],['calf','calf','correct'],['quick','kwik','plausible'],['quick','quik','plausible'],['quick','quic','plausible'],
];
let ok=0,bad=[];for(const [t,a,e] of cases){const r=L.spellAnalyse(t,a);if(r.cls===e)ok++;else bad.push([t,a,e,r.cls,L.soundKey(t),r.key,r.tags.join('|')])}
console.log(ok+'/'+cases.length);bad.forEach(b=>console.log(b.join('  ')));
