import test from 'node:test';
import assert from 'node:assert/strict';
import {createComposition,appendToVibhag,insertPause,sanitizeComposition} from '../js/model.js';
import {createStore} from '../js/state.js';
import {createShareLink,readShareLink} from '../js/share-link.js';
test('pause inserts on either side in same matra, preserving neighboring matras and annotations',async()=>{
 let c=appendToVibhag(createComposition(),'Dha',1);c=appendToVibhag(c,'Dhin',1);c=appendToVibhag(c,'Na',2);c.bols[1].tags.dayanArticulation='sur';
 for(const side of ['before','after']){
  const d=insertPause(c,c.bols[1].id,side);assert.deepEqual(d.bols.map(b=>b.text),side==='before'?['Dha','—','Dhin','Na']:['Dha','Dhin','—','Na']);assert.deepEqual(d.bols.map(b=>[b.position.vibhag,b.position.matra]),[[1,1],[1,2],[1,2],[2,1]]);assert.equal(d.bols.find(b=>b.id===c.bols[1].id).tags.dayanArticulation,'sur');assert.deepEqual(sanitizeComposition(d),d);assert.deepEqual(await readShareLink(new URL(await createShareLink(d,'https://example.com/')).hash),d);
 }
 const store=createStore(c);store.update(c=>insertPause(c,c.bols[1].id,'before'));store.undo();assert.deepEqual(store.composition,c);store.redo();assert.equal(store.composition.bols.length,4);
});
test('pause inside submatra and shared leaf preserves ordered, valid nested positions',()=>{
 for(const sameLeaf of [false,true])for(const side of ['before','after'])for(let target=0;target<3;target++){
  let c=appendToVibhag(createComposition(),'TeReKeTe',1);c.bols.slice(0,3).forEach((b,i)=>{b.position.subMatra=1;b.position.subSubMatra=sameLeaf?1:i+1});c.bols[3].position.subMatra=2;
  const d=insertPause(c,c.bols[target].id,side);assert.deepEqual(d.bols.filter(b=>b.text!=='—').map(b=>b.id),c.bols.map(b=>b.id));assert.ok(d.bols.every(b=>b.position.matra===1));assert.deepEqual(sanitizeComposition(d),d);
 }
});
