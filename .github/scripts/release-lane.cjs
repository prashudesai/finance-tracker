#!/usr/bin/env node
'use strict';

// Fail closed: only pure style/image changes qualify for a shorter deployment gate.
// All JavaScript, HTML, financial data, config, rules and test changes run full checks.
const fs=require('node:fs');
const assert=require('node:assert/strict');

function classify(files,forceFull=false){
 const changed=files.filter(Boolean);
 if(forceFull||!changed.length)return {visual_only:false,rules_changed:true,functions_changed:true};
 const visualOnly=changed.every(name=>/^(src|dist)\/.+\.(css|png|jpe?g|webp|svg|gif|ico)$/i.test(name));
 const rulesChanged=changed.some(name=>['firestore.rules','firebase.json','.firebaserc'].includes(name));
 const functionsChanged=changed.some(name=>name.startsWith('functions/')||['firebase.json','dist/firebase-client.js'].includes(name));
 return {visual_only:visualOnly,rules_changed:rulesChanged,functions_changed:functionsChanged};
}

if(process.argv.includes('--self-test')){
 assert.deepEqual(classify(['src/legacy-1.css','dist/app-style.css']),{visual_only:true,rules_changed:false,functions_changed:false});
 assert.deepEqual(classify(['dist/images/chart.svg','dist/cash-flow.css']),{visual_only:true,rules_changed:false,functions_changed:false});
 for(const name of ['src/index.html','dist/app-style.js','src/core/08-nps.js','tools/build.cjs','package-lock.json','.github/workflows/deploy-firebase-hosting.yml']){
  assert.equal(classify(['dist/app-style.css',name]).visual_only,false,name);
 }
 assert.deepEqual(classify(['firestore.rules']),{visual_only:false,rules_changed:true,functions_changed:false});
 assert.deepEqual(classify([]),{visual_only:false,rules_changed:true,functions_changed:true});
 assert.deepEqual(classify(['dist/app-style.css'],true),{visual_only:false,rules_changed:true,functions_changed:true});
 assert.deepEqual(classify(['dist/firebase-client.js']).functions_changed,true);
 assert.deepEqual(classify(['functions/index.js']).functions_changed,true);
 assert.deepEqual(classify(['src/core/13-dashboard.js']).functions_changed,false);
 console.log('Release lane classification safety tests passed.');
}else{
 const forced=process.argv.includes('--full');
 const paths=forced?[]:fs.readFileSync(0).toString('utf8').split('\0').filter(Boolean);
 const flags=classify(paths,forced);
 const output=Object.entries(flags).map(([key,value])=>key+'='+value).join('\n')+'\n';
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,output);
 process.stdout.write(output);
}
