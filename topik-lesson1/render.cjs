const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('file://'+__dirname+'/scene.html');await p.evaluate(()=>document.fonts.ready);fs.mkdirSync('/tmp/claude-0/frames2',{recursive:true});
const FPS=30,N=Math.ceil(FPS*38.6);for(let f=0;f<N;f++){await p.evaluate(t=>render(t),f/FPS);
await p.screenshot({path:`/tmp/claude-0/frames2/f${String(f).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});}
await b.close();})();
