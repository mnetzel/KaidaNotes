const {webkit,chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { createComposition, appendToVibhag } from '../../js/model.js';
let example;
if (process.env.KAIDA_EXAMPLE_JSON) {
 example=JSON.parse(await readFile(process.env.KAIDA_EXAMPLE_JSON,'utf8'));
} else {
 example=createComposition();
 example.vibhagStructure=Array(8).fill(4);
 for(let row=1;row<=8;row++)for(const bol of ['Dhin','—','Dhi','Na'])example=appendToVibhag(example,bol,row);
 const count=example.bols.filter(b=>b.text!=='—').length;
 example.clapping={timestamps:Array.from({length:count},(_,i)=>i*500),structure:Array(8).fill(4),name:'Custom',snap:true};
}
const count=example.bols.length;
const pauses=example.bols.filter(b=>b.text==='—').length;
for(const engine of [webkit,chromium]){
 const browser=await engine.launch(engine===chromium && process.platform==='win32'?{channel:'msedge',headless:true}:{headless:true});
 const page=await browser.newPage({viewport:{width:1100,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.KAIDA_TEST_URL || 'http://localhost:4173/KaidaNotes/')+'?debug=1');await page.waitForFunction(()=>window.kaidaDebug);
 await page.locator('#json-file').setInputFiles({name:'example.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(example))});
 await page.waitForFunction(()=>document.querySelector('#json-status').textContent.startsWith('JSON imported'));
 const original=await page.evaluate(()=>kaidaDebug.snapshot());
 await page.locator('#manual-open').click();
 assert.equal(await page.locator('.manual-block').count(),count);
 assert.equal(await page.locator('.manual-block.rest').count(),pauses);
 assert.ok((await page.locator('#manual-status').textContent()).includes('Initial layout follows notation'));

 // Moving a touching block shifts its shared boundaries while preserving length.
 const body=await page.locator('.manual-block[data-index="2"] .manual-move').boundingBox();
 await page.mouse.move(body.x+body.width/2,body.y+body.height/2);await page.mouse.down();
 await page.mouse.move(body.x+body.width/2+30,body.y+body.height/2,{steps:4});await page.mouse.up();
 assert.equal(await page.locator('#manual-start').inputValue(),'3.25');
 assert.equal(await page.locator('#manual-end').inputValue(),'4.25');
 await page.locator('#manual-overview [data-index="0"]').click();
 // Shorten the first bol, expanding the following pause through linked edges.
 await page.locator('#manual-end').fill('1.75');await page.locator('#manual-end').press('Tab');
 assert.equal(await page.locator('#manual-duration').textContent(),'0.75 matras');
 // Drag the first bol's right boundary further left, snapped to the quarter grid.
 const handle=await page.locator('.manual-block[data-index="0"] .manual-end').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
 await page.mouse.move(handle.x+handle.width/2-30,handle.y+handle.height/2,{steps:4});await page.mouse.up();
 assert.equal(await page.locator('#manual-end').inputValue(),'1.5');
 await page.locator('#manual-cancel').click();assert.deepEqual(await page.evaluate(()=>kaidaDebug.snapshot()),original);
 await page.locator('#manual-open').click();
 await page.locator('#manual-end').fill('1.75');await page.locator('#manual-end').press('Tab');
 await page.locator('#manual-ok').click();
 const saved=await page.evaluate(()=>kaidaDebug.snapshot());
 assert.equal(saved.clapping.manualTimings.length,count);assert.equal(saved.clapping.manualTimings[0].end,.75);assert.equal(saved.clapping.snap,false);
 assert.deepEqual(saved.bols,original.bols);assert.deepEqual(saved.vibhagStructure,original.vibhagStructure);
 assert.equal(await page.locator('#clap-plot-container .clap-block').count(),count-pauses);
 await page.waitForFunction(()=>document.querySelector('#session-status').textContent==='Saved in this tab’s address');
 assert.deepEqual(await page.evaluate(async()=>{const {readShareLink}=await import('./js/share-link.js');return readShareLink(location.hash);}),saved);
 await page.reload();await page.waitForFunction(()=>window.kaidaDebug);assert.deepEqual(await page.evaluate(()=>kaidaDebug.snapshot()),saved);
 await page.locator('#manual-open').click();assert.equal(await page.locator('#manual-end').inputValue(),'1.75');
 // Navigate to the end of a long cycle and verify the overview scrolls there.
 await page.locator(`#manual-overview [data-index="${count-1}"]`).click();
 assert.ok(await page.locator('#manual-scroll').evaluate(e=>e.scrollLeft)>2500);
 await page.locator('#manual-cancel').click();
 // Reload clears history; test a fresh edit/undo next.
 await page.locator('#manual-open').click();await page.locator('#manual-end').fill('1.5');await page.locator('#manual-end').press('Tab');await page.locator('#manual-ok').click();
 await page.locator('#undo').click();assert.deepEqual(await page.evaluate(()=>kaidaDebug.snapshot()),saved);
 // Phone portrait: the dialog fits without scaling its touch targets.
 await page.setViewportSize({width:393,height:852});await page.locator('#manual-open').click();
 const rect=await page.locator('#manual-dialog').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=394);

 await page.keyboard.press('Escape');assert.equal(await page.locator('#manual-dialog').isVisible(),false);
 const url=new URL(page.url());url.searchParams.set('view','manual');await page.goto(url.href);await page.waitForSelector('#manual-dialog[open]');assert.equal(await page.locator('.manual-block').count(),count);assert.deepEqual(errors,[]);await browser.close();
}
console.log('PASS: long example including pauses, mouse edge drag with quarter snap, Cancel/OK/reload/link/undo, overview navigation and portrait in WebKit/Chromium');

