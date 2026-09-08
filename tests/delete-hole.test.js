import test from 'node:test';
import assert from 'node:assert/strict';
import {createComposition,appendToVibhag,deleteBol,sanitizeComposition} from '../js/model.js';
import {insertAtCursor} from '../js/cursor.js';
import {createShareLink,readShareLink} from '../js/share-link.js';

test('selected delete leaves its matra empty without moving subsequent bols', async()=>{
 const c=['Dha','Ta','Na'].reduce((c,b)=>appendToVibhag(c,b,1),createComposition());
 const deleted=deleteBol(c,c.bols[1].id,{preserveMatra:true});
 assert.deepEqual(deleted.bols,[c.bols[0],c.bols[2]]);
 assert.deepEqual(deleted.ui.emptyMatras,[{vibhag:1,matra:2}]);
 assert.deepEqual(sanitizeComposition(deleted),deleted);
 assert.deepEqual(await readShareLink(new URL(await createShareLink(deleted,'https://example.com/')).hash),deleted);
 const filled=insertAtCursor(deleted,'TeRe',{vibhag:1,matra:2});
 assert.deepEqual(filled.bols.map(b=>b.position.matra),[1,2,2,3]);
 assert.deepEqual(filled.ui.emptyMatras,[]);
});
test('deleting last bol in an unconfigured row records a persistent empty cell',()=>{
 const c=insertAtCursor(createComposition(),'Dha',{vibhag:5,matra:6});
 const d=deleteBol(c,c.bols[0].id,{preserveMatra:true});
 assert.deepEqual(d.ui.emptyMatras,[{vibhag:5,matra:6}]);assert.deepEqual(sanitizeComposition(d),d);
});
test('deleting one part of a grouped matra keeps its remaining bols in that matra',()=>{
 let c=appendToVibhag(createComposition(),'TeReKeTe',1);c=appendToVibhag(c,'Na',1);
 const d=deleteBol(c,c.bols[1].id,{preserveMatra:true});
 assert.deepEqual(d.bols.map(b=>b.position.matra),[1,1,1,2]);assert.deepEqual(d.bols.at(-1),c.bols.at(-1));
 assert.deepEqual(sanitizeComposition(d),d);
});
