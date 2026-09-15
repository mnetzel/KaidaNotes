const {webkit,chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
for(const engine of [webkit,chromium]){
 const browser=await engine.launch(engine===chromium && process.platform==='win32'?{channel:'msedge',headless:true}:{headless:true});
 const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 await page.goto((process.env.KAIDA_TEST_URL || 'http://localhost:4173/KaidaNotes/')+'?debug=1');await page.waitForFunction(()=>window.kaidaDebug);
 for(const rows of [1,4,16]){
 const link=await page.evaluate(async rows=>{
  const {createComposition,appendBol}=await import('./js/model.js');const {createShareLink}=await import('./js/share-link.js');let c=createComposition();
  for(let r=0;r<rows;r++)for(const [i,t] of ['Dhig','Na','TeRe','KeTe'].entries())c=appendBol(c,t,r>0&&i===0);
  c.vibhagStructure=Array(rows).fill(4);c.bols.forEach((b,i)=>Object.assign(b.tags,{dayanArticulation:['sur','kinar','syahi','open-tin'][i%4],leftHandFinger:'4-and-3',rightHandFinger:'2',openClose:'close'}));
  c.notes=('Long wrapped notes: żółć and rhythm. '.repeat(10)+'\n').repeat(rows>4?10:1)+'END OF NOTES';
  if(rows>1)c.clapping={timestamps:Array.from({length:c.bols.length+1},(_,i)=>500*i),name:'Test',structure:c.vibhagStructure,snap:true};
  return createShareLink(c,location.href);
 },rows);
 await page.goto(link);await page.locator('#presentation-open').click();await page.waitForFunction(()=>!document.querySelector('#presentation-save').disabled);
 for(const viewport of [{width:393,height:852},{width:852,height:393},{width:1200,height:900}]){
 await page.setViewportSize(viewport);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const result=await page.evaluate(async()=>{
  const {renderPresentationCanvas}=await import('./js/presentation-canvas.js');const c=document.querySelector('#presentation-content');
  const first=renderPresentationCanvas(c);const a=first.getContext('2d').getImageData(0,0,first.width,first.height).data;
  const saved=c.style.cssText;c.style.left='4357px';c.style.top='2983px';c.style.transform='scale(.137)';
  const second=renderPresentationCanvas(c);c.style.cssText=saved;
  const b=second.getContext('2d').getImageData(0,0,second.width,second.height).data;
  let difference=0,ink=0,top=first.height,bottom=0;
  for(let i=0;i<a.length;i+=4){difference+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);if(Math.min(a[i],a[i+1],a[i+2])<220){ink++;const y=Math.floor(i/4/first.width);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
  return {width:first.width,height:first.height,otherWidth:second.width,otherHeight:second.height,difference:difference/(a.length/4*3),ink,top,bottom};
 });
 assert.equal(result.width,result.otherWidth);assert.equal(result.height,result.otherHeight);
 assert.ok(result.ink>1000);assert.ok(result.top<result.height*.1);assert.ok(result.bottom>result.height*.9);
 assert.ok(result.difference<4,JSON.stringify({engine:engine.name(),rows,viewport,result}));
 console.log(`${engine.name()}: ${rows} rows at ${viewport.width}px, mean pixel difference ${result.difference.toFixed(4)}`);
 }
 await page.locator('#presentation-close').click();
 }
 await browser.close();
}
console.log('PASS: short/long/clapped sheets retain title and final notes; export is independent of modal translation, scale and orientation');
