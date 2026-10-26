window.financeCloudReady=window.financeCloudReady||new Promise(resolve=>{window.financeCloudResolve=resolve}),window.trackerStorage={key(key){const uid=window.financeCloud?.uid;if(!uid)throw new Error("Sign in before storing tracker data.");return"pft:"+uid+":"+key},getItem(key){return window.financeCloud?.uid?localStorage.getItem(this.key(key)):null},setItem(key,value){window.financeCloud?.uid&&localStorage.setItem(this.key(key),value)},removeItem(key){window.financeCloud?.uid&&localStorage.removeItem(this.key(key))}};

//# sourceMappingURL=bootstrap-2.d146d9c1acc0d967.js.map
