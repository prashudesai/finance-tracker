const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8');
const source=html.slice(html.indexOf('    function preferredEntryMember('),html.indexOf('    // Native form.reset()'));
let names=['Prashanth'],fields={};
const make=value=>({value,dataset:{},group:{hidden:false},closest(){return this.group}});
fields.a=make('Old');fields.b=make('');
const context={window:{financeCloud:{displayName:'Priyanka Desai'}},profileMemberNames:()=>names,CUSTOM_VALUE_CONFIG:{familyMembers:{selectIds:['a','b']}},document:{getElementById:id=>fields[id]}};
vm.createContext(context);vm.runInContext(source,context);
context.syncEntryMemberFields();assert.equal(fields.a.value,'Prashanth');assert(fields.a.group.hidden);assert.equal(fields.b.value,'Prashanth');
names=['Prashanth','Priyanka'];context.syncEntryMemberFields();assert(!fields.a.group.hidden);assert.equal(fields.a.value,'Prashanth'); // never overwrite a user's current selection
fields.b=make('Prashanth');context.syncEntryMemberFields();assert.equal(fields.b.value,'Priyanka');
assert.equal(context.preferredEntryMember(['Priyanka','Priyanka Rao']),'');
assert.equal(context.preferredEntryMember(['Priyanka Desai','Priyanka Rao']),'Priyanka Desai');
assert(html.includes("if(!multiple){activeFamilyProfile='__combined__'"));assert(html.includes("if(profileMemberNames().length<2)return;"));
assert(html.includes("String(memberField.value||'')===names[0]"));
console.log('Single/multiple member defaults, selection preservation, identity ambiguity and profile guards passed');

assert(html.includes("event.target.contains(select)"));
