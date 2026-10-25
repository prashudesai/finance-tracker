
    window.financeCloudReady=new Promise(resolve=>{window.financeCloudResolve=resolve;});
    window.trackerStorage={
      key(key){const uid=window.financeCloud?.uid;if(!uid)throw new Error('Sign in before storing tracker data.');return 'pft:'+uid+':'+key;},
      getItem(key){if(!window.financeCloud?.uid)return null;return localStorage.getItem(this.key(key));},
      setItem(key,value){if(!window.financeCloud?.uid)return;localStorage.setItem(this.key(key),value);},
      removeItem(key){if(!window.financeCloud?.uid)return;localStorage.removeItem(this.key(key));}
    };
  