// Separate print-only rules without changing screen selector order or theme coverage.
function partition(css){
 let critical='',secondary='',start=0,i=0,depth=0,quote='',comment=false;
 while(i<css.length){const c=css[i],next=css[i+1];if(comment){if(c==='*'&&next==='/'){comment=false;i+=2;continue;}i++;continue;}if(quote){if(c==='\\'){i+=2;continue;}if(c===quote)quote='';i++;continue;}if(c==='/'&&next==='*'){comment=true;i+=2;continue;}if(c==='"'||c==="'"){quote=c;i++;continue;}if(c==='{'){
  if(depth===0){const head=css.slice(start,i).replace(/\/\*[\s\S]*?\*\//g,'').trim();let j=i+1,d=1,q='',com=false;for(;j<css.length;j++){const x=css[j],n=css[j+1];if(com){if(x==='*'&&n==='/'){com=false;j++;}continue;}if(q){if(x==='\\'){j++;continue;}if(x===q)q='';continue;}if(x==='/'&&n==='*'){com=true;j++;continue;}if(x==='"'||x==="'"){q=x;continue;}if(x==='{')d++;if(x==='}'&&!--d)break;}
   const body=css.slice(i+1,j),block=css.slice(start,j+1);if(/^@media\s+print(?:\s+and\b|$)/.test(head)||/^@page\b/.test(head))secondary+=block;
   else if(/^@(media|supports)\b/.test(head)){const nested=partition(body);if(nested.critical.trim())critical+=head+'{'+nested.critical+'}';if(nested.secondary.trim())secondary+=head+'{'+nested.secondary+'}';}
   else critical+=block;
   start=j+1;i=j+1;continue;
  }depth++;
 }else if(c==='}')depth--;else if(c===';'&&depth===0){critical+=css.slice(start,i+1);start=i+1;}i++;
 }critical+=css.slice(start);return{critical,secondary};
}
module.exports=partition;
