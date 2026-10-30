const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('file://'+__dirname+'/scene.html');fs.mkdirSync('/tmp/claude-0/frames',{recursive:true});
const FPS=30,N=FPS*30;for(let f=0;f<N;f++){await p.evaluate(t=>render(t),f/FPS);
await p.screenshot({path:`/tmp/claude-0/frames/f${String(f).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});}
await b.close();})();
