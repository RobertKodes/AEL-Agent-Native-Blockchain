const $=selector=>document.querySelector(selector),api=async path=>{const response=await fetch(path);const data=await response.json();if(!response.ok)throw Object.assign(Error(data.message??data.error??`HTTP ${response.status}`),data);return data};
const short=value=>typeof value==='string'&&value.length>18?`${value.slice(0,10)}…${value.slice(-6)}`:value;
const show=(kind,value)=>{$('[data-x-result]').hidden=false;$('[data-x-result-kind]').textContent=kind;$('[data-x-result-json]').textContent=JSON.stringify(value,null,2)};

let knownBlocks=new Map(),knownRegistry={tokens:[]};
const eventDetail=event=>{const skip=new Set(['height','type']);const pairs=Object.entries(event).filter(([key,value])=>!skip.has(key)&&(typeof value==='string'||typeof value==='number')).slice(0,3);return pairs.map(([key,value])=>`${key}=${short(String(value))}`).join(' · ')};
async function refresh(){
  try{
    const [network,{blocks},accounts,registry,events]=await Promise.all([api('/v1/network'),api('/v1/blocks?limit=12'),api('/v1/accounts'),api('/v1/tokens'),api('/v1/events')]);
    knownRegistry=registry;knownBlocks=new Map(blocks.map(block=>[block.height,block]));
    $('[data-x-height]').textContent=network.height;
    $('[data-x-hash]').textContent=short(network.latestBlockHash??'—');
    $('[data-x-accounts]').textContent=Object.keys(accounts).length;
    $('[data-x-tokens]').textContent=registry.count;
    $('[data-x-blocks]').innerHTML='';
    for(const block of blocks){const row=document.createElement('tr');row.dataset.height=block.height;for(const value of [block.height,block.transition,short(block.blockHash),short(block.stateRoot)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}row.addEventListener('click',()=>show(`block #${block.height}`,block));$('[data-x-blocks]').append(row)}
    const activity=$('[data-x-activity]');activity.innerHTML='';
    for(const event of events.slice(-14).reverse()){const row=document.createElement('tr');for(const value of [event.height,event.type,eventDetail(event)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}row.addEventListener('click',()=>show(`event @ #${event.height}`,event));activity.append(row)}
    if(registry.count){$('[data-x-token-rows]').innerHTML='';for(const token of registry.tokens){const row=document.createElement('tr');for(const value of [token.tokenId,token.symbol,token.decimals,token.supply,token.supplyCap??'∞',token.mintAuthority]){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}row.addEventListener('click',async()=>{try{show(`token ${token.tokenId}`,await api(`/v1/tokens/${encodeURIComponent(token.tokenId)}`))}catch(error){show('error',{error:error.message})}});$('[data-x-token-rows]').append(row)}}
  }catch(error){$('[data-x-status]').textContent=error.message}
}

async function search(){
  const query=$('[data-x-query]').value.trim();
  if(!query)return;
  $('[data-x-status]').textContent='searching…';
  try{
    if(/^\d+$/.test(query)){const height=Number(query),{blocks}=await api(`/v1/blocks?before=${height+1}&limit=1`);if(blocks[0]?.height===height){show(`block #${height}`,blocks[0]);}else show('not found',{error:'BLOCK_NOT_FOUND',height});}
    else if(query.startsWith('tok-')){show(`token ${query}`,await api(`/v1/tokens/${encodeURIComponent(query)}`));}
    else{
      const accounts=await api('/v1/accounts');
      if(accounts[query]){const account=accounts[query],held=Object.entries(account.tokens??{}).map(([tokenId,amount])=>{const token=knownRegistry.tokens.find(item=>item.tokenId===tokenId);return token?{tokenId,symbol:token.symbol,amount,human:amount/10**token.decimals,nft:token.decimals===0&&token.supplyCap===1}:{tokenId,amount}});show(`account ${query}`,{...account,tokenDetail:held});}
      else{try{show(`agent ${query}`,await api(`/v1/agents/${encodeURIComponent(query)}`));}catch{show('not found',{error:'NO_BLOCK_ACCOUNT_AGENT_OR_TOKEN_MATCHES',query});}}
    }
    $('[data-x-status]').textContent='';
  }catch(error){$('[data-x-status]').textContent='';show('not found',{error:error.message,query});}
}

$('[data-x-go]').addEventListener('click',search);
$('[data-x-query]').addEventListener('keydown',event=>{if(event.key==='Enter')search()});
refresh();setInterval(refresh,15000);
