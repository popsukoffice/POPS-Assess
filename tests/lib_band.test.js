const L=require('../lib.js');
const by={1:{n:8,c:8,a:8},2:{n:8,c:7,a:8},3:{n:8,c:6,a:8},4:{n:8,c:4,a:8},5:{n:8,c:2,a:8}};
const b=L.levelBand(by,0.8);console.log(JSON.stringify({p:b.point,f:b.firm,pl:b.plausible,n:b.next,em:b.probablyEmerging,un:b.uncertain}));
console.log(L.probeLevels(b,{1:4,2:4,3:4,4:4,5:4}));
console.log(L.binomTail(3,4,.25).toFixed(4),L.binomTail(24,32,.25).toExponential(2));
console.log(L.latencySummary([{level:1,mark:1,ms:900},{level:1,mark:1,ms:1100},{level:2,mark:1,ms:2500},{level:2,mark:0,ms:3000}]));
const K=L.kappa([['a','a'],['a','a'],['b','b'],['b','a'],['a','a'],['b','b']]);console.log('kappa',K.kappa.toFixed(3),'(expect 0.667)');
