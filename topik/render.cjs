// 사용법: node render.cjs <en|ja|zh> <duration초> | node render.cjs <lang> preview t1,t2,...
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const lang=process.argv[2],arg=process.argv[3];
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/scene.html?lang='+lang);await p.evaluate(()=>document.fonts.ready);
if(arg==='preview'){for(const t of process.argv[4].split(',')){await p.evaluate(t=>render(t),+t);await p.screenshot({path:`/tmp/claude-0/pv_${lang}_${t}.png`});}}
else{const dir=`/tmp/claude-0/frames_${lang}`;fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
const FPS=30,N=Math.ceil(FPS*+arg);for(let f=0;f<N;f++){await p.evaluate(t=>render(t),f/FPS);
await p.screenshot({path:`${dir}/f${String(f).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});}}
await b.close();})();
