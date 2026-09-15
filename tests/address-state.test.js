import test from 'node:test';
import assert from 'node:assert/strict';
import { createAddressWriter } from '../js/address-state.js';
test('latest edit wins when compression finishes out of order', async()=>{
 let url='https://example.com/?debug=1';const jobs=[];
 const writer=createAddressWriter({getURL:()=>url,replaceURL:u=>url=u,encode:()=>new Promise(resolve=>jobs.push(resolve))});
 const a=writer.save({}),b=writer.save({});
 jobs[1]('https://example.com/#kaida=new');await b;
 jobs[0]('https://example.com/#kaida=old');await a;
 assert.equal(url,'https://example.com/?debug=1#kaida=new');assert.equal(writer.unsettled,false);
});
test('loading another address cancels a pending write; failures remain unsaved',async()=>{
 let url='https://example.com/';let resolve;
 const writer=createAddressWriter({getURL:()=>url,replaceURL:u=>url=u,encode:()=>new Promise(r=>resolve=r)});
 const save=writer.save({});writer.cancel();url+='incoming';
 resolve('https://example.com/#stale');await save;assert.equal(url,'https://example.com/incoming');
 const failed=createAddressWriter({getURL:()=>url,replaceURL:()=>assert.fail(),encode:async()=>{throw new Error('too large');}});
 await failed.save({});assert.equal(failed.unsettled,true);
});
