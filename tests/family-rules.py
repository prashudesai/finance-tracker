"""Run against a local Firestore emulator only; never touches the live project.

Start: firebase emulators:start --only firestore --project demo-family-access
Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8087 python3 tests/family-rules.py
"""
import base64, json, os, time, urllib.request, urllib.error

host=os.environ.get('FIRESTORE_EMULATOR_HOST')
if not host or not host.startswith(('127.0.0.1:', 'localhost:')):
    raise SystemExit('Set FIRESTORE_EMULATOR_HOST to a local emulator. Live projects are refused.')
project='demo-family-access'
base=f'http://{host}/v1/projects/{project}/databases/(default)/documents'
def encode(value):
    return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).decode().rstrip('=')
def token(uid,email,verified=True):
    return encode({'alg':'none','typ':'JWT'})+'.'+encode({'sub':uid,'user_id':uid,'email':email,'email_verified':verified,'aud':project,'iss':'https://securetoken.google.com/'+project,'iat':int(time.time()),'exp':int(time.time())+3600,'firebase':{'sign_in_provider':'google.com'}})+'.'
def value(v):
    if isinstance(v,str): return {'stringValue':v}
    if isinstance(v,bool): return {'booleanValue':v}
    if isinstance(v,int): return {'integerValue':str(v)}
    if v is None:return {'nullValue':None}
    if isinstance(v,dict):return {'mapValue':{'fields':{k:value(x) for k,x in v.items()}}}
    raise ValueError(v)
def call(method,path,auth=None,data=None,query=False):
    headers={'Content-Type':'application/json'}
    if auth:headers['Authorization']='Bearer '+auth
    body=json.dumps(data if query else {'fields':{k:value(v) for k,v in data.items()}}).encode() if data is not None else None
    try:
        r=urllib.request.urlopen(urllib.request.Request(base+path,data=body,headers=headers,method=method));return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,e.read().decode()
owner=token('owner','owner@example.test');wife=token('wife','wife@example.test');stranger=token('stranger','other@example.test');unverified=token('wife','wife@example.test',False)
invite='/familyInvites/owner~wife@example.test'
record={'ownerUid':'owner','ownerEmail':'owner@example.test','email':'wife@example.test','role':'viewer','status':'pending'}
passed=[]
def check(name,result,allowed):
    status,body=result
    assert (200<=status<300)==allowed,(name,status,body)
    passed.append(name)
check('Owner reads absent invitation for creation',call('GET',invite,owner),False) # 404 is a permitted missing get; assert separately below.
assert call('GET',invite,owner)[0]==404
check('Owner creates pending invitation',call('PATCH',invite,owner,record),True)
check('Recipient can discover own invitation',call('GET',invite,wife),True)
check('Stranger cannot read invitation',call('GET',invite,stranger),False)
check('Recipient cannot grant herself editor',call('PATCH',invite,wife,{**record,'role':'editor','status':'accepted'}),False)
meta='/users/owner/tracker/current';chunk='/users/owner/snapshots/g1/chunks/0'
check('Owner creates snapshot',call('PATCH',chunk,owner,{'payload':'test'}),True)
pointer={'format':2,'revision':1,'generation':'g1','count':1,'digest':'test','previous':None}
check('Owner publishes pointer',call('PATCH',meta,owner,pointer),True)
check('Pending invite cannot read tracker',call('GET',meta,wife),False)
record['status']='accepted'
check('Recipient accepts pending invitation',call('PATCH',invite,wife,record),True)
check('Viewer reads shared tracker',call('GET',meta,wife),True)
check('Viewer reads shared snapshot',call('GET',chunk,wife),True)
check('Viewer cannot create snapshot',call('PATCH','/users/owner/snapshots/viewer/chunks/0',wife,{'payload':'bad'}),False)
check('Viewer cannot publish changes',call('PATCH',meta,wife,{**pointer,'revision':2,'previous':{'generation':'g1','count':1}}),False)
check('Stranger cannot read tracker',call('GET',meta,stranger),False)
check('Unverified email cannot read tracker',call('GET',meta,unverified),False)
check('Anonymous cannot read tracker',call('GET',meta),False)
check('Recipient cannot revoke invitation',call('DELETE',invite,wife),False)
record['role']='editor'
check('Owner changes role to editor',call('PATCH',invite,owner,record),True)
check('Editor creates new snapshot',call('PATCH','/users/owner/snapshots/g2/chunks/0',wife,{'payload':'new'}),True)
pointer2={**pointer,'revision':2,'generation':'g2','previous':{'generation':'g1','count':1}}
check('Editor publishes with previous snapshot retained',call('PATCH',meta,wife,pointer2),True)
check('Editor cannot drop recovery generation',call('PATCH',meta,wife,{**pointer2,'revision':3,'previous':None}),False)
check('Editor cannot delete snapshots',call('DELETE',chunk,wife),False)
check('Editor cannot invite others as owner',call('PATCH','/familyInvites/owner~other@example.test',wife,{**record,'email':'other@example.test','status':'pending'}),False)
check('Owner cannot bypass recipient acceptance',call('PATCH','/familyInvites/owner~other@example.test',owner,{**record,'email':'other@example.test','status':'accepted'}),False)
for field,wanted in [('ownerUid','wife'),('email','other@example.test'),('ownerEmail','spoof@example.test')]:
    check('Invitation identity is immutable: '+field,call('PATCH',invite,wife,{**record,field:wanted}),False)
query={'structuredQuery':{'from':[{'collectionId':'familyInvites'}],'where':{'fieldFilter':{'field':{'fieldPath':'email'},'op':'EQUAL','value':{'stringValue':'wife@example.test'}}}}}
owner_query={'structuredQuery':{'from':[{'collectionId':'familyInvites'}],'where':{'fieldFilter':{'field':{'fieldPath':'ownerUid'},'op':'EQUAL','value':{'stringValue':'owner'}}}}}
check('Owner can query only their managed invitations',call('POST',':runQuery',owner,owner_query,True),True)
check('Unscoped invitation query is denied',call('POST',':runQuery',wife,{'structuredQuery':{'from':[{'collectionId':'familyInvites'}]}},True),False)
check('Recipient can query invitations by own email',call('POST',':runQuery',wife,query,True),True)
check('Stranger cannot query another email',call('POST',':runQuery',stranger,query,True),False)
check('Owner revokes access',call('DELETE',invite,owner),True)
check('Revoked member cannot read tracker',call('GET',meta,wife),False)
check('Revoked member cannot stage writes',call('PATCH','/users/owner/snapshots/revoked/chunks/0',wife,{'payload':'bad'}),False)
check('Clients cannot create deletion tombstones',call('PATCH','/deletedAccounts/owner',owner,{'deletedAt':'now'}),False)
check('Admin can block a deleted account',call('PATCH','/deletedAccounts/owner','owner',{'deletedAt':'now'}),True)
check('Deleted owner old token cannot read',call('GET',meta,owner),False)
check('Deleted owner old token cannot stage data',call('PATCH','/users/owner/snapshots/after-delete/chunks/0',owner,{'payload':'bad'}),False)
check('Deleted owner cannot create invitations',call('PATCH','/familyInvites/owner~new@example.test',owner,{**record,'email':'new@example.test','status':'pending'}),False)
print(json.dumps({'passed' :len(passed),'failed':0,'tests':passed},indent=2))

