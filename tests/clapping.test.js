import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeClaps} from '../js/clapping.js';

test('first clap starts time; final sam determines duration and is excluded from hits',()=>{
 const result=analyzeClaps([4500,4750,5250,6500],[4,4,4,4]);
 assert.equal(result.duration,2000);assert.equal(result.totalMatras,16);
 assert.deepEqual(result.hits,[{index:1,elapsed:0,matra:0},{index:2,elapsed:250,matra:2},{index:3,elapsed:750,matra:6}]);
});
test('uneven timings remain unquantized against the complete configured cycle',()=>{
 const structure=[3,2,2];const times=[0,123,670,1000];const result=analyzeClaps(times,structure);
 assert.equal(result.totalMatras,7);assert.ok(Math.abs(result.hits[1].matra-.861)<1e-12);
 assert.ok(Math.abs(result.hits[2].matra-4.69)<1e-12);
 structure[0]=9;times[1]=999;assert.deepEqual(result.structure,[3,2,2]);assert.equal(result.hits[1].elapsed,123);
});
test('two sams produce one hit; insufficient or invalid captures and undefined tala are rejected',()=>{
 assert.equal(analyzeClaps([100,200],[4,4]).hits.length,1);
 for(const times of [[],[1],[1,1],[2,1],[0,NaN]])assert.throws(()=>analyzeClaps(times,[4,4]));
 for(const structure of [[],[0],[2.5],[-1]])assert.throws(()=>analyzeClaps([0,100],structure));
});
