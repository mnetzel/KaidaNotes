import test from 'node:test';
import assert from 'node:assert/strict';
import {clapDisplay,validateClapCapture} from '../js/clap-data.js';
import {createComposition,sanitizeComposition,appendBol} from '../js/model.js';
import {createShareLink,readShareLink} from '../js/share-link.js';
const capture=()=>({timestamps:[0,61,64,124,126,499,999,1000],structure:[2],name:'Custom',snap:false});
test('half snapping rounds both ways without changing raw times or merging hits',()=>{
 const c=capture();const original=structuredClone(c);const raw=clapDisplay(c);const snapped=clapDisplay({...c,snap:true});
 assert.deepEqual(snapped.hits.map(h=>h.matra),[0,0,0,0,.5,1,2]);
 assert.equal(snapped.hits.length,7);assert.equal(snapped.duration,1000);assert.deepEqual(c,original);assert.deepEqual(clapDisplay({...c,snap:false}),raw);
});
test('full share/restore retains raw clap times, captured structure and snap toggle',async()=>{
 const c={...createComposition(),clapping:{...capture(),snap:true}};
 assert.deepEqual(sanitizeComposition(c),c);
 const decoded=await readShareLink(new URL(await createShareLink(c,'https://example.com/KaidaNotes/')).hash);
 assert.deepEqual(decoded,c);assert.deepEqual(clapDisplay({...decoded.clapping,snap:false}).hits,clapDisplay(capture()).hits);
 assert.ok(!('clapping' in sanitizeComposition(createComposition())));
});
test('invalid clap payloads are rejected before import',()=>{
 for(const c of [{...capture(),timestamps:[0,0]}, {...capture(),timestamps:[100,200]}, {...capture(),snap:'true'}, {...capture(),structure:[Infinity]}, {...capture(),timestamps:[0,NaN]}, {...capture(),structure:[]}])assert.throws(()=>validateClapCapture(c));
});

test('clap labels skip pauses, follow notation order, survive sharing and retain timing', async()=>{
 let c=createComposition();
 for(const text of ['Dha','—','Te','Re','—','Dhin']) c=appendBol(c,text);
 c.clapping=capture();
 const raw=clapDisplay(c.clapping,c.bols);
 assert.deepEqual(raw.hits.map(h=>h.label),['Dha','Te','Re','Dhin','','','']);
 assert.deepEqual(raw.hits.map(h=>h.matra),clapDisplay(c.clapping).hits.map(h=>h.matra));
 const decoded=await readShareLink(new URL(await createShareLink(c,'https://example.com/')).hash);
 assert.deepEqual(clapDisplay(decoded.clapping,decoded.bols),raw);
 assert.deepEqual(clapDisplay({...c.clapping,snap:true},c.bols).hits.map(h=>h.label),raw.hits.map(h=>h.label));
 assert.deepEqual(clapDisplay(c.clapping,c.bols.slice(2)).hits.slice(0,3).map(h=>h.label),['Te','Re','Dhin']);
 assert.equal(clapDisplay({...capture(),timestamps:[0,100]},c.bols).hits.length,1);
});
