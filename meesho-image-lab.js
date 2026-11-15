'use strict';
const $ = id => document.getElementById(id);
const state={source:null,sourceImage:null,sourceKey:'',selectedFile:null,photoRevision:0,items:[],busy:false};
const BACKGROUNDS={white:'#ffffff',soft:'#f8f8f6',warm:'#faf8f3',cool:'#f6f8fc'};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function numberText(n){return Number.isFinite(n)?n.toFixed(2):'—'}
function message(s){$('status').textContent=s}
function urlFor(blob){return URL.createObjectURL(blob)}
function escapeCsv(v){let s=String(v??'');if(/^[\s]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function download(blob,filename){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
function cleanup(){for(const item of state.items)URL.revokeObjectURL(item.url);state.items=[];$('gallery').replaceChildren();$('rankings').replaceChildren();$('empty').classList.remove('hidden');$('downloadCSV').disabled=true;$('downloadZip').disabled=true;updateStats()}
function readImage(file){return new Promise((resolve,reject)=>{const u=urlFor(file),image=new Image();image.onload=()=>{URL.revokeObjectURL(u);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(u);reject(Error('Image could not be decoded. Try JPG or PNG.'))};image.src=u})}
function paint(image,canvas,box,cfg){const context=canvas.getContext('2d',{alpha:false});const size=cfg.size;const heightSize=cfg.height||size;canvas.width=size;canvas.height=heightSize;context.fillStyle=cfg.background;context.fillRect(0,0,size,heightSize);
 const roomW=size*(1-2*cfg.padding),roomH=heightSize*(1-2*cfg.padding),scale=Math.min(roomW/box.w,roomH/box.h);
 const width=box.w*scale,height=box.h*scale;
 const dx=(size-width)/2 + cfg.shiftX*(size*0.01),dy=(heightSize-height)/2+cfg.shiftY*(heightSize*0.01);
 context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 context.drawImage(image,box.x,box.y,box.w,box.h,dx,dy,width,height);
 return{scaledWidth:Math.round(width),scaledHeight:Math.round(height)}}
function cropRectangle(image){const w=image.naturalWidth,h=image.naturalHeight;if(!$('trim').checked)return{x:0,y:0,w,h};
 const d=document.createElement('canvas'),scale=Math.min(1,480/Math.max(w,h));d.width=Math.max(1,Math.round(w*scale));d.height=Math.max(1,Math.round(h*scale));const ctx=d.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,d.width,d.height);
 const data=ctx.getImageData(0,0,d.width,d.height).data;
 let left=d.width,top=d.height,right=-1,bottom=-1;
 for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++){const i=(y*d.width+x)*4;const a=data[i+3],r=data[i],g=data[i+1],b=data[i+2];if(a>=30&&!(r>=243&&g>=243&&b>=243)){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}}
 if(right<left)return{x:0,y:0,w,h};
 const bw=right-left+1,bh=bottom-top+1;
 // Conservative crop: if detection is tiny or almost full frame, keep the original.
 if(bw/d.width<.2||bh/d.height<.2||bw/d.width>.97&&bh/d.height>.97)return{x:0,y:0,w,h};
 const pad=Math.max(2,Math.round(Math.min(d.width,d.height)*.018));
 left=Math.max(0,left-pad);right=Math.min(d.width,right+pad+1);top=Math.max(0,top-pad);bottom=Math.min(d.height,bottom+pad+1);
 return{x:Math.round(left/scale),y:Math.round(top/scale),w:Math.min(w-Math.round(left/scale),Math.max(1,Math.round((right-left)/scale))),h:Math.min(h-Math.round(top/scale),Math.max(1,Math.round((bottom-top)/scale)))}}
function configs(count){const backgroundFamily=$('background').value;
 const options=[],backgrounds=backgroundFamily==='all'?Object.values(BACKGROUNDS):[BACKGROUNDS.white,BACKGROUNDS.soft];
 const sizes=[1000,1024,1200];const square=$('square').checked;
 // Deterministic, independently implemented exploration of conservative catalog-safe framing.
 for(let i=0;i<count;i++){const pad=[.035,.07,.11,.16][i%4],size=sizes[Math.floor(i/4)%sizes.length],bg=backgrounds[Math.floor(i/12)%backgrounds.length],shiftX=[0,-1.3,1.3][Math.floor(i/3)%3],shiftY=[0,-1.1,1.1][Math.floor(i/9)%3],quality=[.86,.92,.96][Math.floor(i/4)%3];options.push({padding:pad,size,height:square?size:Math.round(size*1.25),background:bg,shiftX,shiftY,quality})}
 return options}
function filename(item){return item.index===0?'meesho-original-'+item.key+'.'+(item.blob.type.includes('png')?'png':item.blob.type.includes('webp')?'webp':'jpg'):'meesho-variant-'+String(item.index).padStart(2,'0')+'-'+item.key+'.jpg'}
function updateStats(){
 const priced=state.items.filter(v=>v.quote!==null);
 const best=priced.length?priced.reduce((a,b)=>a.quote<=b.quote?a:b):null;
 const baseline=numericQuote($('originalCharge').value);
 $('total').textContent=String(Math.max(0,state.items.length-1));
 $('tested').textContent=String(priced.length);
 $('lowest').textContent=best?'₹'+numberText(best.quote):'—';
 $('saving').textContent=best&&baseline!==null?(baseline>=best.quote?'₹'+numberText(baseline-best.quote):'-₹'+numberText(best.quote-baseline)):'—';
 for(const card of $('gallery').children){const rank=Number(card.dataset.index);card.classList.toggle('best',!!best&&rank===best.index)}
 drawRanking(priced,best,baseline);
}
function numericQuote(v){if(String(v??'').trim()==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function currentPhoto(file,revision){return Boolean(file)&&state.photoRevision===revision&&$('photo').files?.[0]===file}
function sourceChanged(previous,next){return previous!==null&&previous!==next}
function baselineQuote(observations,entered){const current=numericQuote(entered);return current!==null?current:numericQuote(observations.quotes?.original??observations.originalCharge)}
function quoteKey(){return'meesho-image-lab-observations-'+state.sourceKey}
function variantSignature(cfg,box){return JSON.stringify([cfg.size,cfg.height,cfg.background,cfg.padding,cfg.shiftX,cfg.shiftY,cfg.quality,box.x,box.y,box.w,box.h])}
function restoredVariantQuote(observations,key,signature){return observations.signatures?.[key]===signature?numericQuote(observations.quotes?.[key]):null}
function saveQuotes(){if(!state.sourceKey)return;const quotes=Object.fromEntries(state.items.filter(v=>v.quote!==null).map(v=>[v.key,v.quote]));const signatures=Object.fromEntries(state.items.filter(v=>v.index>0&&v.signature).map(v=>[v.key,v.signature]));try{localStorage.setItem(quoteKey(),JSON.stringify({signatures,originalCharge:$('originalCharge').value,category:$('category').value,sellingPrice:$('sellingPrice').value,quotes}))}catch(e){message('Quotes could not be stored locally: '+e.message)}}
function loadQuotes(){try{return JSON.parse(localStorage.getItem(quoteKey())||'{}')}catch(e){return{}}}
function addCard(item){const card=document.createElement('article');card.className='variant';card.dataset.index=String(item.index);
 const img=document.createElement('img');img.className='photo';img.src=item.url;img.alt=item.name+' preview';img.loading='lazy';card.append(img);
 const title=document.createElement('div');title.className='name';title.textContent=item.name;card.append(title);
 const metadata=document.createElement('div');metadata.className='meta';metadata.textContent=item.detail+' · '+(item.blob.size/1024).toFixed(0)+' KB';card.append(metadata);
 const label=document.createElement('label');label.textContent='Observed Meesho shipping quote (₹)';const input=document.createElement('input');input.type='number';input.min='0';input.step='.01';input.placeholder='Enter genuine quote';input.value=item.quote===null?'':String(item.quote);
 input.addEventListener('input',()=>{item.quote=numericQuote(input.value);if(item.index===0)$('originalCharge').value=input.value;saveQuotes();updateStats()});label.append(input);card.append(label);
 const row=document.createElement('div');row.className='minirow';const down=document.createElement('button');down.type='button';down.className='btn';down.textContent='Download';down.onclick=()=>download(item.blob,filename(item));const copy=document.createElement('button');copy.type='button';copy.className='btn';copy.textContent='Copy name';copy.onclick=async()=>{try{await navigator.clipboard.writeText(filename(item));message('Copied file name.')}catch(e){message('Copy unavailable.')}};row.append(down,copy);card.append(row);
 $('gallery').append(card)}
function drawRanking(priced,best,baseline){const root=$('rankings');root.replaceChildren();if(!priced.length){const p=document.createElement('p');p.className='muted';p.textContent='No verified quotes entered. Download variants, test within Meesho Supplier Panel, then record your actual results.';root.append(p);return}
 const rows=[...priced].sort((a,b)=>a.quote-b.quote);const table=document.createElement('table'),head=document.createElement('thead');const tr=document.createElement('tr');for(const k of ['Rank','Variant','Observed shipping','Difference vs original']){const th=document.createElement('th');th.textContent=k;tr.append(th)}head.append(tr);table.append(head);
 const body=document.createElement('tbody');rows.forEach((r,i)=>{const tr=document.createElement('tr');const diff=baseline===null?'—':(baseline-r.quote>=0?'Saved ₹'+numberText(baseline-r.quote):'Increased ₹'+numberText(r.quote-baseline));for(const text of [String(i+1),r.name,'₹'+numberText(r.quote),diff]){const td=document.createElement('td');td.textContent=text;tr.append(td)}body.append(tr)});table.append(body);root.append(table)}
async function hashFile(file){const buff=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',buff);return Array.from(new Uint8Array(digest).slice(0,10)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function toJpeg(canvas,quality){return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('JPEG encoding failed')),'image/jpeg',quality))}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function generate(){if(state.busy)return;const file=$('photo').files[0];if(!file){message('Choose a product photo first.');return}if(!file.type.startsWith('image/')){message('Only image files are supported.');return}if(file.size>15*1024*1024){message('Please upload an image smaller than 15 MB.');return}
 state.busy=true;const revision=state.photoRevision;$('generate').disabled=true;$('progressBar').style.width='0%';cleanup();
 try{
  const image=await readImage(file);if(!currentPhoto(file,revision))return;const pixels=image.naturalWidth*image.naturalHeight;if(pixels>65e6)throw Error('Image too large. Resize to below 65 megapixels.');
  const key=await hashFile(file);if(!currentPhoto(file,revision))return;state.source=file;state.sourceImage=image;state.sourceKey=key;
  const observations=loadQuotes();if(observations.originalCharge!==undefined&&!$('originalCharge').value)$('originalCharge').value=observations.originalCharge;
  const box=cropRectangle(image),count=Number($('count').value)||24,settings=configs(count);
  const src={index:0,name:'Original photo (baseline)',blob:file,url:urlFor(file),quote:baselineQuote(observations,$('originalCharge').value),key:'original',detail:image.naturalWidth+' × '+image.naturalHeight+' original pixels'};
  state.items.push(src);addCard(src);$('empty').classList.add('hidden');
  const canvas=document.createElement('canvas');
  for(let i=0;i<settings.length;i++){
   const cfg=settings[i];const geometry=paint(image,canvas,box,cfg);const blob=await toJpeg(canvas,cfg.quality);if(!currentPhoto(file,revision))return;
   const item={index:i+1,name:'Variant '+String(i+1).padStart(2,'0'),blob,url:urlFor(blob),key:'v'+String(i+1).padStart(2,'0'),quote:restoredVariantQuote(observations,'v'+String(i+1).padStart(2,'0'),variantSignature(cfg,box)),signature:variantSignature(cfg,box),detail:cfg.size+'×'+cfg.height+' px · '+Math.round(cfg.padding*100)+'% frame · '+geometry.scaledWidth+'×'+geometry.scaledHeight+' image'};
   state.items.push(item);addCard(item);$('progressBar').style.width=Math.round((i+1)/count*100)+'%';message('Generated '+(i+1)+' / '+count+' variants…');
   if(i%3===0){await tick();if(!currentPhoto(file,revision))return;}
  }
  canvas.width=canvas.height=0;
  $('downloadCSV').disabled=false;$('downloadZip').disabled=false;message('Created '+count+' real image variants plus the original. Download, test and record real Meesho quotes.');
  updateStats()
 }catch(e){if(!currentPhoto(file,revision))return;message('Generation error: '+e.message);if(!state.items.length)$('empty').classList.remove('hidden')}
 finally{state.busy=false;$('generate').disabled=false}}
function resultsCsv(){const baseline=numericQuote($('originalCharge').value),category=$('category').value,price=numericQuote($('sellingPrice').value);
 const header=['Filename','Variant','Image width px','Image file bytes','Category','Selling price INR','Observed shipping INR','Original quote INR','Observed saving INR'];
 const rows=state.items.map(v=>{const dimensions=v.index===0?state.sourceImage?.naturalWidth:(v.detail.match(/^\d+/)||[])[0];const saving=v.quote!==null&&baseline!==null?baseline-v.quote:'';return[filename(v),v.name,dimensions,v.blob.size,category,price??'',v.quote??'',baseline??'',saving]});
 return [header,...rows].map(r=>r.map(escapeCsv).join(',')).join('\r\n')}
$('generate').addEventListener('click',generate);
$('downloadCSV').addEventListener('click',()=>{if(state.items.length)download(new Blob([resultsCsv()],{type:'text/csv;charset=utf-8'}),'meesho-variant-test-results.csv')});
$('downloadZip').addEventListener('click',async()=>{if(!state.items.length)return;if(!window.JSZip){message('ZIP library unavailable. Use individual image downloads instead.');return}
 const button=$('downloadZip');button.disabled=true;try{const zip=new JSZip();for(const item of state.items)zip.file(filename(item),item.blob);zip.file('shipping-quote-comparison.csv',resultsCsv());zip.file('IMPORTANT.txt','Image variants do not guarantee lower Meesho shipping. All quotes must be measured in the Meesho Supplier Panel. Keep product representation accurate.\n');const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}},p=>message('Preparing ZIP: '+p.percent.toFixed(0)+'%'));download(blob,'meesho-product-image-variants.zip');message('Downloaded '+state.items.length+' images and the comparison sheet.')}catch(e){message('ZIP failed: '+e.message)}finally{button.disabled=false}});
$('originalCharge').addEventListener('input',()=>{const baseline=state.items.find(x=>x.index===0);if(baseline){baseline.quote=numericQuote($('originalCharge').value);const input=$('gallery').querySelector('[data-index="0"] input');if(input)input.value=$('originalCharge').value}saveQuotes();updateStats()});
$('applyBulkQuotes').addEventListener('click',()=>{if(!state.items.length){message('Generate variants before entering quotes.');return}let applied=0,invalid=0;for(const line of $('bulkQuotes').value.split(/\r?\n/)){if(!line.trim())continue;const fields=line.trim().split(/[,;\t]/),index=Number((fields[0]||'').replace(/[^0-9]/g,'')),quote=numericQuote(fields[1]);const item=state.items.find(v=>v.index===index);if(!item||quote===null){invalid++;continue}item.quote=quote;const input=$('gallery').querySelector('[data-index="'+index+'"] input');if(input)input.value=quote;if(index===0)$('originalCharge').value=quote;applied++}saveQuotes();updateStats();message('Applied '+applied+' observed rates.'+(invalid?' Skipped '+invalid+' invalid entries.':''))});
$('category').addEventListener('change',saveQuotes);
$('sellingPrice').addEventListener('change',saveQuotes);
$('photo').addEventListener('change',async()=>{const revision=++state.photoRevision;cleanup();state.source=null;state.sourceKey='';const file=$('photo').files[0];if(sourceChanged(state.selectedFile,file)){$('originalCharge').value='';$('bulkQuotes').value='';message('New photo selected: previous photo shipping quotes cleared.')}state.selectedFile=file||null;if(!file){$('sourcepreview').style.display='none';message('Choose a photo to begin.');return}try{if(!file.type.startsWith('image/'))throw Error('Select an image.');const img=await readImage(file);if(!currentPhoto(file,revision))return;const thumb=document.createElement('canvas');const scale=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight));thumb.width=Math.max(1,Math.round(img.naturalWidth*scale));thumb.height=Math.max(1,Math.round(img.naturalHeight*scale));thumb.getContext('2d').drawImage(img,0,0,thumb.width,thumb.height);$('sourcepreview').src=thumb.toDataURL('image/jpeg',.85);$('sourcepreview').style.display='block';$('sourceinfo').textContent=img.naturalWidth+' × '+img.naturalHeight+' pixels · '+(file.size/1024/1024).toFixed(2)+' MB · Local processing';thumb.width=thumb.height=0;message('Photo loaded. Choose 12, 24 or 36 variations and generate.')}catch(e){if(currentPhoto(file,revision))message(e.message)}});
