const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../dist');
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname;const file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root+path.sep))throw Error('Invalid path');res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end('Not found');}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
  const requested=[];await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();requested.push(url.href);return route.abort();});
  const page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#cloudLogin').waitFor({state:'visible',timeout:20000});
  assert(requested.some(url=>url.startsWith('https://apis.google.com/js/api.js')),'The real Firebase SDK must start its mobile popup helper before the sign-in button is tapped');
  console.log('PASS Real Firebase SDK prepares its mobile popup helper before sign-in');await context.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
