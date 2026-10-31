// 사용법: node render.cjs <NN> <en|ja|zh> <초> | node render.cjs <NN> <lang> preview t1,t2,...
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const [NN,lang,arg,pv]=process.argv.slice(2);
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(`file://${__dirname}/lesson.html?lesson=${NN}&lang=${lang}`);await p.evaluate(()=>document.fonts.ready);
if(arg==='preview'){for(const t of pv.split(',')){await p.evaluate(t=>render(t),+t);await p.screenshot({path:`/tmp/claude-0/pv_${NN}_${lang}_${t}.png`});}}
else{const dir=`/tmp/claude-0/frames_${NN}_${lang}`;fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
const FPS=30,N=Math.ceil(FPS*+arg);for(let f=0;f<N;f++){await p.evaluate(t=>render(t),f/FPS);await p.screenshot({path:`${dir}/f${String(f).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});}}
await b.close();})();
