const $=selector=>document.querySelector(selector),safeOrderId=value=>/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(value);
const get=async path=>{const response=await fetch(path),data=await response.json();if(!response.ok)throw Error(data.error??`request failed (${response.status})`);return data};
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(className)node.className=className;return node};
const keyValue=(target,label,value)=>{const row=element('div',undefined,'key-value');row.append(element('span',label),element('strong',value??'—'));target.append(row)};
const record=(target,value,empty)=>{target.replaceChildren();if(!value){target.append(element('p',empty,'muted-copy'));return}const output=element('pre',JSON.stringify(value,null,2),'audit-json');target.append(output)};
const renderVotes=(target,votes)=>{target.replaceChildren();if(!votes.length){target.append(element('p','No verification votes have been committed.','muted-copy'));return}const table=element('table'),head=element('thead'),headRow=element('tr');for(const label of ['verifier','decision','group','height'])headRow.append(element('th',label));head.append(headRow);const body=element('tbody');for(const vote of votes){const row=element('tr');for(const value of [vote.verifierId??vote.agentId??'—',vote.decision??vote.accepted??'—',vote.faultDomain??vote.independenceGroup??'—',vote.createdAtHeight??vote.height??'—'])row.append(element('td',value));body.append(row)}table.append(head,body);target.append(table)};
const renderTimeline=(target,timeline)=>{target.replaceChildren();if(!timeline.length){target.append(element('p','No committed event is available for this work order yet.','muted-copy'));return}for(const item of timeline){const block=item.commitment,event=item.event,entry=element('article'),heading=element('h3',event.type??'committed event');heading.prepend(element('span',block?`block #${block.height}`:'uncommitted'));entry.append(heading);entry.append(element('p',block?`${block.transition} · ${block.blockHash}`:'The event has no resolved block commitment.'));const detail=element('details'),summary=element('summary','show committed event');detail.append(summary,element('pre',JSON.stringify({event,commitment:block},null,2),'audit-json'));entry.append(detail);target.append(entry)}};
const renderLinks=(target,links)=>{target.replaceChildren();for(const[label,url]of Object.entries(links??{})){let resolved;try{resolved=new URL(url,location.origin)}catch{continue}if(resolved.origin!==location.origin)continue;const link=element('a',label.replace(/[A-Z]/g,letter=>` ${letter.toLowerCase()}`),'button quiet');link.href=`${resolved.pathname}${resolved.search}`;target.append(link)}};
const status=$('[data-audit-status]'),input=$('#order-id'),readout=$('[data-audit-readout]'),results=[...document.querySelectorAll('[data-audit-results]')];
async function inspect(orderId){
  if(!safeOrderId(orderId))throw Error('work order ID must use 2–128 letters, numbers, dots, underscores, or hyphens');
  status.textContent='verifying committed public evidence…';
  const audit=await get(`/v1/work-orders/${encodeURIComponent(orderId)}/audit`),{order,verificationVotes,timeline,receipt,chain}=audit;
  $('[data-audit-order-state]').textContent=order.status??'—';
  $('[data-audit-vote-count]').textContent=verificationVotes.length;
  $('[data-audit-receipt-state]').textContent=receipt?.status??(receipt?'recorded':'not issued');
  $('[data-audit-chain-state]').textContent=chain.valid?'verified':'invalid';
  const orderTarget=$('[data-audit-order]');orderTarget.replaceChildren();for(const[label,value]of Object.entries({orderId:order.orderId,title:order.title,assignment:order.assignmentMode,status:order.status,fundedTestAel:order.fundedAmount,scopeHash:order.scopeHash,openedAtHeight:order.createdAtHeight,assignedAgent:order.agentId??'unassigned'}))keyValue(orderTarget,label.replace(/[A-Z]/g,letter=>` ${letter.toLowerCase()}`),value);
  record($('[data-audit-result]'),audit.result,'No public result has been submitted.');
  renderVotes($('[data-audit-votes]'),verificationVotes);
  renderTimeline($('[data-audit-timeline]'),timeline);
  record($('[data-audit-receipt]'),receipt,'No settlement receipt has been issued.');
  renderLinks($('[data-audit-links]'),audit.links);
  readout.hidden=false;results.forEach(node=>node.hidden=false);history.replaceState(null,'',`?order=${encodeURIComponent(orderId)}`);status.textContent=`chain integrity ${chain.valid?'verified':'failed'} at height ${chain.latestHeight??'—'}`;
}
$('[data-audit-form]').addEventListener('submit',event=>{event.preventDefault();inspect(input.value.trim()).catch(error=>status.textContent=error.message)});
const initial=new URLSearchParams(location.search).get('order');if(initial){input.value=initial;inspect(initial).catch(error=>status.textContent=error.message)}
