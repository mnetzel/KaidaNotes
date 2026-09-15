import test from 'node:test';
import assert from 'node:assert/strict';
import { clapBlocks, blocksInRange } from '../js/clap-data.js';
test('blocks span whole, half and quarter matras until next onset and final sam',()=>{
 const result={totalMatras:4,hits:[0,1,1.5,1.75].map(matra=>({matra,label:'Dha'}))};
 const original=structuredClone(result);
 assert.deepEqual(clapBlocks(result).map(h=>h.endMatra-h.matra),[1,.5,.25,2.25]);
 assert.deepEqual(result,original);
});
test('blocks continue across row boundaries and retain hands, labels and colors',()=>{
 const blocks=[{matra:3.5,endMatra:4.5,hands:['right','left'],label:'Dha',color:'blue'}];
 const first=blocksInRange(blocks,0,4),second=blocksInRange(blocks,4,8,true);
 assert.deepEqual(first.map(h=>[h.matra,h.endMatra]),[[3.5,4]]);
 assert.deepEqual(second.map(h=>[h.matra,h.endMatra]),[[0,.5]]);
 assert.deepEqual(second[0].hands,['right','left']);
 assert.equal(second[0].label,'Dha');assert.equal(second[0].color,'blue');
 assert.equal(blocksInRange([{matra:4,endMatra:5}],0,4).length,0);
});
test('coincident snapped hits remain zero-duration blocks, including end of cycle',()=>{
 const blocks=clapBlocks({totalMatras:4,hits:[0,0,4].map(matra=>({matra}))});
 assert.deepEqual(blocks.map(h=>[h.matra,h.endMatra]),[[0,0],[0,4],[4,4]]);
 assert.equal(blocksInRange(blocks,0,4,true).length,3);
});
