(()=>{
  if(window.ael?.isAelWallet)return;
  const pending=new Map(),listeners=new Map();
  const emit=(name,value)=>{for(const listener of listeners.get(name)??[])try{listener(value)}catch{}};
  const provider={
    isAelWallet:true,version:'0.6.0',
    request({method,params={}}={}){if(typeof method!=='string')return Promise.reject(new Error('AEL method is required'));const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{pending.set(requestId,{resolve,reject});window.postMessage({target:'AEL_EXTENSION',type:'AEL_PROVIDER_REQUEST',requestId,method,params},location.origin)})},
    on(name,listener){if(typeof listener!=='function')throw new TypeError('listener must be a function');const set=listeners.get(name)??new Set();set.add(listener);listeners.set(name,set);return provider},
    removeListener(name,listener){listeners.get(name)?.delete(listener);return provider}
  };
  Object.defineProperty(window,'ael',{value:Object.freeze(provider),configurable:false,writable:false});
  window.addEventListener('message',event=>{if(event.source!==window||event.origin!==location.origin||event.data?.target!=='AEL_PAGE')return;const{requestId,result,error,event:eventName}=event.data;if(eventName){emit(eventName,result);return}const request=pending.get(requestId);if(!request)return;pending.delete(requestId);error?request.reject(Object.assign(new Error(error.message??'AEL wallet request rejected'),{code:error.code??'AEL_REQUEST_REJECTED'})):request.resolve(result)});
  window.dispatchEvent(new Event('ael#initialized'));
})();
