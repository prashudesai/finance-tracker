const fs=require('./app-source.cjs').fs,vm=require('vm'),assert=require('assert/strict'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../dist/family-access.js'),'utf8').replace(/^import .*\n/,'').replace(/export /g,'');
const c={};vm.createContext(c);vm.runInContext(source,c);
assert.equal(c.normalizeFamilyEmail(' WIFE@Example.com '),'wife@example.com');
assert.equal(c.inviteDocumentId('owner','wife@example.com'),'owner~wife@example.com');
assert.notEqual(c.inviteDocumentId('a__b','c@example.com'),c.inviteDocumentId('a','b__c@example.com'));
for(const email of ['bad','a/b@example.com','a b@example.com','a@b','x'.repeat(255)+'@example.com'])assert.throws(()=>c.normalizeFamilyEmail(email));
assert.throws(()=>c.inviteDocumentId('bad/uid','wife@example.com'));
for(const [role,edit,manage] of [['owner',true,true],['editor',true,false],['viewer',false,false],['unknown',false,false]]){const p=c.familyPermissions(role);assert.equal(p.canEdit,edit);assert.equal(p.canManage,manage);}
console.log('PASS: normalized email, safe invitation IDs, collision resistance, and role permissions');
