const C=require('../conclusions.js');
const g=(yr)=>({yr,attempted:true});
const S={
 dyslexic:{name:'Alex',yearNum:4,ageYears:8.8,d:{word:g(1),nonword:g(0),spell:g(1),comp:g(3),listen:g(5),maths:g(4),pa:{blend:{pct:50,n:8},seg:{pct:40,n:10},elis:{pct:55,n:10},iso:{pct:70,n:8}},dsf:{span:4},dsb:{span:2},flu:{wcpm:35,acc:88,below:false},spellErr:{plausible:3,total:20}}},
 compOnly:{name:'Sam',yearNum:5,ageYears:9.9,d:{word:g(5),nonword:g(5),spell:g(5),comp:g(2),listen:g(5),maths:g(5),flu:{wcpm:120,acc:98}}},
 maths:{name:'Mia',yearNum:3,ageYears:7.9,d:{word:g(3),spell:g(3),comp:g(3),listen:g(4),maths:g(0)}},
 fine:{name:'Jo',yearNum:6,ageYears:10.9,d:{word:g(6),nonword:g(6),spell:g(6),comp:g(6),listen:g(7),maths:g(6)}},
 eal:{name:'Ali',yearNum:2,ageYears:6.9,eal:true,confidence:'Limited',d:{word:g(0),comp:g(0),listen:g(0),maths:g(2)}},
 secondary:{name:'Dee',yearNum:9,ageYears:13.9,d:{word:g(5),nonword:g(4),spell:g(4),comp:g(5),listen:g(9),maths:g(6)}},
 noyear:{d:{word:g(3)}}
};
for(const [k,p] of Object.entries(S)){const r=C.build(p);const n=Object.values(r.support).flat().length;console.log(`${k}: phase ${r.phaseName}; ${r.strengths.length} strengths, ${r.difficulties.length} difficulties, ${r.conclusions.length} conclusions, ${r.implications.length} implications, ${n} support points, flags ${r.flags.length}`);
 [...r.strengths,...r.difficulties,...r.conclusions,...r.implications,...Object.values(r.support).flat()].forEach(t=>{if(/undefined|NaN|\bnull\b/.test(t)||/  /.test(t))console.log('  BAD:',t)});}
if(process.argv[2]){const r=C.build(S[process.argv[2]]);for(const [k,v] of Object.entries(r))console.log('##',k,JSON.stringify(v,null,1))}
// numerosity cases
{const base={name:'Kit',yearNum:4,ageYears:8.8};
const cases={numWeakMathsWeak:{...base,d:{maths:g(1),numer:{sub:{small:{n:8,c:4},four:{n:2,c:1},large:{n:8,c:0},n:18},cmp:{n:24,pct:52,easy:{n:8,c:4},hard:{n:8,c:4},cong:{n:12,c:8},incong:{n:12,c:5},w:null}}}},
 numFineMathsWeak:{...base,d:{maths:g(1),numer:{cmp:{n:24,pct:88,easy:{n:8,c:8},hard:{n:8,c:6},cong:{n:12,c:11},incong:{n:12,c:10},w:0.25}}}},
 sizeCue:{...base,d:{maths:g(4),numer:{cmp:{n:24,pct:70,easy:{n:8,c:7},hard:{n:8,c:4},cong:{n:12,c:11},incong:{n:12,c:6},w:0.4}}}}};
for(const[k,p]of Object.entries(cases)){const r=C.build(p);const all=[...r.strengths,...r.difficulties,...r.conclusions,...r.implications,...Object.values(r.support).flat()];
 console.log(k,'->',r.conclusions.filter(t=>/number-sense|quantity|space/.test(t)).length,'numer conclusions');all.forEach(t=>{if(/undefined|NaN|\bnull\b/.test(t)||/  /.test(t))console.log('  BAD:',t)})}}
