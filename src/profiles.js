export const conformance = {
  specification: 'AEL/0.13', phase: 'P2', status: 'public-devnet',
  profiles: ['AEL-Core/0.13','AEL-ID/0.4','AEL-Work/0.6','AEL-Memory/0.1','AEL-Growth/0.1','AEL-EL/0.3','AEL-IC/0.6','AEL-Runtime/0.8'],
  schema:{major:0,minor:13},
  accounting:{virtualLabel:'Virtual liquidity (not redeemable)',redeemableLabel:'Redeemable reserve',virtualIncludedInRedeemable:false},
  runtimeSovereignty:true,
  runtimeLimitations:['Physical provider shutdown can interrupt a runtime until failover'],
  mainnetReady:false,
  limitations: ['Coordinator transports BFT proposals while validators independently sign and persist votes','Follower and agent replicas do not vote unless separately admitted as validators','Independent operator and audit thresholds are not yet met','No production bridge','Wallet is devnet-only and externally unaudited','No TEE secret release','Physical provider shutdown can interrupt a runtime until failover'],
  publicSandboxUrl:'https://ael-network-production.up.railway.app',
  gates: { deterministicStateMachines: true, goldenVectors: true, hashLinkedBlocks:true,publicChainVerification:true,coreInvariantsExecutable: true, fourValidatorReplication: true, humanAgentEndToEnd: true,instantBoundedOnboarding:true,persistentApi: true, signedRemoteActors:true,hostedActorServices:true,selfCustodyOperatorOnboarding:true,signedOperatorApplications:true,selfCustodyHumanRoles:true,identityBoundGovernance:true,signedAuditWorkflow:true,reproducibleAuditManifest:true,runtimeProviderProtocol:true,signedAttestationIssuerBoundary:true,interchainObserverQuorum:true,terminalPortal:true,devnetWallet:true,agentSkill:true,validatorFollowers:true,publicSandbox:true,realValueEnabled: false }
};
