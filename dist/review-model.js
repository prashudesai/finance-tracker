export const REVIEW_GROUPS=['closedMonths','valuations','confirmedEntries','planning','paymentStatus'];
export function stable(value){if(value===undefined)return 'null';if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stable).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';}
export function reviewValues(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid review data.');const result={};
 for(const key of Object.keys(input)){if(!REVIEW_GROUPS.includes(key))throw Error('Unknown review section.');const group=input[key];if(!group||typeof group!=='object'||Array.isArray(group)||Object.keys(group).length>3000)throw Error('Invalid review section.');result[key]=JSON.parse(JSON.stringify(group));}
 if(JSON.stringify(result).length>180000)throw Error('Review history is too large. Export it before adding more.');return result;
}
export function reviewPatch(group,before={},after={}){
 if(!REVIEW_GROUPS.includes(group))throw Error('Unknown review section.');const rows=[];for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(stable(before[key])!==stable(after[key]))rows.push({group,key,before:before[key]??null,after:after[key]??null});return rows;
}
export function applyReviewPatch(values,patch,check=true){
 const changes=[],last=new Map();
 for(const p of patch){const key=JSON.stringify([p.group,p.key]),index=last.get(key),previous=changes[index];if(check&&previous&&stable(previous.after)===stable(p.before)&&previous.epoch===p.epoch)changes[index]={...previous,after:p.after};else{last.set(key,changes.length);changes.push(p);}}
 const result=reviewValues(values);for(const p of changes){if(!REVIEW_GROUPS.includes(p.group)||typeof p.key!=='string'||p.key.length>1000||['__proto__','constructor','prototype'].includes(p.key))throw Error('Invalid review change.');const group=result[p.group]||{};const now=group[p.key]??null;
 if(check&&stable(now)!==stable(p.before)&&stable(now)!==stable(p.after))throw Object.assign(Error('Another device changed the same review item. Reload shared reviews before retrying.'),{code:'tracker/review-conflict'});
 if(p.after===null)delete group[p.key];else group[p.key]=p.after;result[p.group]=group;}
 return reviewValues(result);
}
export function reviewBackup(values){return {format:1,values:reviewValues(values)};}
export function parseReviewBackup(input){
 if(!input||input.format!==1||!Object.hasOwn(input,'values')||Object.keys(input).some(k=>!['format','values'].includes(k)))throw Error('Unsupported shared-review backup format.');
 return reviewValues(input.values);
}
export function validateReviewRestore(input){
 if(!input||!Object.hasOwn(input,'values')||typeof input.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(input.id)||!Number.isInteger(input.baseRevision)||input.baseRevision<0||typeof input.epoch!=='string'||!input.epoch||input.epoch.length>100)throw Error('Invalid review restore request.');
 return {...input,values:reviewValues(input.values)};
}
