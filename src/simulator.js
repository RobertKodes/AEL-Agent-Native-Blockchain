import { AelEngine } from './engine.js';
import { ProtocolError } from './errors.js';

export function fixture() {
  const e = new AelEngine();
  e.apply('createAgent', { agentId: 'agent-1', rootPublicKey: 'aelpub1', constitutionRoot: 'constitution-v1', virtualLiquidity: 1000, virtualTokens: 1000 });
  e.apply('registerRoute', { routeId: 'solana-test', realValue: false, cap: 1_000_000 });
  return e;
}
export function earnedLiquidityBasic() {
  const e = fixture(), before = e.state.agents['agent-1'].curve.base / e.state.agents['agent-1'].curve.token;
  e.apply('createWorkOrder', { orderId: 'work-1', agentId: 'agent-1', fundedAmount: 2000, scopeHash: 'scope' });
  e.apply('acceptWork', { orderId: 'work-1', agentId: 'agent-1' });
  e.apply('finalizeReceipt', { receiptId: 'receipt-1', orderId: 'work-1', paymentId: 'payment-1', amount: 2000, finalized: true, payerRoot: 'independent-client', verifiers: ['v1','v2'], publicData: { deliverableHash: 'deliverable' } });
  e.apply('admitEarned', { agentId: 'agent-1', receiptId: 'receipt-1', routeId: 'solana-test', lineageId: 'solana:tx:1', asset: 'USDC-test', provablyControlledValue: 1700, routeHaircut: .95, agentFundingRoot: 'agent-root' });
  return { engine: e, spotPriceNeutral: Math.abs(before - e.state.agents['agent-1'].curve.base / e.state.agents['agent-1'].curve.token) < 1e-12 };
}
const rejected = fn => { try { fn(); return false; } catch (e) { return e instanceof ProtocolError; } };
export function runMandatorySimulations() {
  const normal = earnedLiquidityBasic();
  const circular = fixture();
  circular.apply('createWorkOrder', { orderId:'w', agentId:'agent-1', fundedAmount:100, scopeHash:'s' }); circular.apply('acceptWork', { orderId:'w', agentId:'agent-1' });
  circular.apply('finalizeReceipt', { receiptId:'r', orderId:'w', paymentId:'p', amount:100, finalized:true, payerRoot:'same-root', verifiers:['v1','v2'], publicData:{} });
  const circularRejected = rejected(() => circular.apply('admitEarned', { agentId:'agent-1', receiptId:'r', routeId:'solana-test', lineageId:'l', asset:'test', provablyControlledValue:100, routeHaircut:1, agentFundingRoot:'same-root' }));
  const outage = normal.engine; outage.apply('registerRuntime', { agentId:'agent-1', provider:'p1', replicas:[{provider:'p2',checkpointRoot:'cp1'}], checkpointRoot:'cp1', faultDomains:['fd1','fd2'] }); outage.apply('failRuntime', { agentId:'agent-1', provider:'p1' });
  const insolvencyRejected = rejected(() => outage.apply('sell', { agentId:'agent-1', tokens:1_000_000 }));
  return { scenarios: { normal: normal.spotPriceNeutral, circularFunding: circularRejected, correlatedOutage: outage.state.runtimes['agent-1'].active === 'p2', insolvency: insolvencyRejected }, invariantViolations: 0 };
}
