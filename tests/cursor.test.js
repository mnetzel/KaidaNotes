import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposition, appendToVibhag, sanitizeComposition } from '../js/model.js';
import { endCursor, insertAtCursor } from '../js/cursor.js';
import { moveSelectedAtLevel } from '../js/rhythm.js';
import { exportBasic } from '../js/export.js';
import { createShareLink, readShareLink } from '../js/share-link.js';

test('entry follows the global endpoint after moving a bol to another vibhag', () => {
 let c=appendToVibhag(appendToVibhag(createComposition(),'Dha',1),'Ta',1);
 c=moveSelectedAtLevel({composition:c,selectedBolId:c.bols[1].id,level:'vibhag',direction:'right'});
 assert.equal(c.ui.entryVibhag,1);assert.deepEqual(endCursor(c),{vibhag:2,matra:2});
 c=insertAtCursor(c,'Na',endCursor(c));assert.equal(c.bols.at(-1).position.vibhag,2);assert.equal(c.bols.at(-1).position.matra,2);
});
test('empty-matra insertion retains gaps through restore/share and returns to global end', async () => {
 let c=insertAtCursor(createComposition(),'Dha',{vibhag:3,matra:4});
 c=insertAtCursor(c,'TeRe',{vibhag:1,matra:3});
 assert.deepEqual(c.bols.map(b=>[b.position.vibhag,b.position.matra]),[[1,3],[1,3],[3,4]]);
 assert.deepEqual(endCursor(c),{vibhag:3,matra:5});
 assert.deepEqual(sanitizeComposition(c),c);
 assert.deepEqual(await readShareLink(new URL(await createShareLink(c,'https://example.com/')).hash),c);
 assert.match(exportBasic(c),/V1: \|  \|  \| TeRe \|/);
 assert.equal(insertAtCursor(c,'Ta',{vibhag:1,matra:3}),c);
});
test('multi-matra shortcut in an empty gap shifts only overlapping suffix in its row', () => {
 let c=insertAtCursor(createComposition(),'Na',{vibhag:1,matra:3});
 const id=c.bols[0].id;
 c=insertAtCursor(c,'GheGhe',{vibhag:1,matra:2});
 assert.deepEqual(c.bols.map(b=>b.position.matra),[2,3,4]);assert.equal(c.bols[2].id,id);
});
