'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{value:id==='background'?'all':'',checked:id==='square',addEventListener(){},classList:{add(){},remove(){},toggle(){}},textContent:'',disabled:false});return nodes.get(id)}
const ctx=vm.createContext({document:{getElementById:node},URL:{},console,Math,Number,String,Array,Object,Set,Map,JSON,Uint8Array,Blob:class{},setTimeout(){}});
vm.runInContext(fs.readFileSync('meesho-image-lab.js','utf8'),ctx,{filename:'meesho-image-lab.js'});
const evaluate=s=>vm.runInContext(s,ctx);
for(const n of [12,24,36]){const cfg=evaluate('configs('+n+')');assert.equal(cfg.length,n);assert.equal(new Set(cfg.map(v=>JSON.stringify(v))).size,n,'all variants have unique settings')}
const canvas={width:0,height:0,draws:[],getContext(){return{fillRect(){},drawImage(...args){canvas.draws.push(args)},set fillStyle(v){},set imageSmoothingEnabled(v){},set imageSmoothingQuality(v){}}}};
ctx.testCanvas=canvas;
const image={naturalWidth:1000,naturalHeight:1600},box={x:0,y:0,w:1000,h:1600};ctx.testImage=image;ctx.testBox=box;
const square=evaluate('paint(testImage,testCanvas,testBox,configs(12)[0])');assert.equal(canvas.width,1000);assert.equal(canvas.height,1000);assert(square.scaledWidth>0&&square.scaledHeight>0);assert(canvas.draws.length);
node('square').checked=false;
const portrait=evaluate('paint(testImage,testCanvas,testBox,configs(12)[0])');assert.equal(canvas.width,1000);assert.equal(canvas.height,1250);assert(portrait.scaledHeight>square.scaledHeight);
assert.equal(evaluate("numericQuote('')"),null);assert.equal(evaluate("numericQuote('49.50')"),49.5);assert.equal(evaluate("numericQuote('x')"),null);
assert(evaluate("escapeCsv('=IMPORTXML(1)')").startsWith('"\''));
console.log('Image lab unit checks pass: 12/24/36 unique variants, square/portrait geometry, quote parsing, CSV formula escaping');
