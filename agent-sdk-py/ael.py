"""Dependency-free AEL local-devnet client and canonical vector utilities."""
from hashlib import sha256
from json import dumps, loads
from urllib.error import HTTPError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen
from uuid import uuid4

def canonicalize(value):
    if value is None: return "null"
    if value is True: return "true"
    if value is False: return "false"
    if isinstance(value, str): return dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, (int, float)): return dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list): return "[" + ",".join(canonicalize(x) for x in value) + "]"
    if isinstance(value, dict): return "{" + ",".join(dumps(k, ensure_ascii=False) + ":" + canonicalize(value[k]) for k in sorted(value)) + "}"
    raise TypeError(f"Unsupported canonical type: {type(value).__name__}")

def canonical_hash(value): return sha256(canonicalize(value).encode()).hexdigest()
def public_key_fingerprint(public_key_pem): return canonical_hash(public_key_pem)
def agent_decision_dossier_fingerprint(dossier):
    evidence=dict((dossier or {}).get("evidence",{})); evidence.pop("dossierHash",None)
    return canonical_hash({**dossier,"evidence":evidence})
def agent_seeding_fingerprint(seed):
    evidence=dict((seed or {}).get("evidence",{})); evidence.pop("seedHash",None)
    return canonical_hash({**seed,"evidence":evidence})
def agent_trust_fingerprint(report):
    body=dict(report or {}); body.pop("reportHash",None)
    return canonical_hash(body)
def agent_work_match_fingerprint(match):
    evidence=dict((match or {}).get("evidence",{})); evidence.pop("workMatchHash",None)
    return canonical_hash({**match,"evidence":evidence})
def agent_opportunity_index_fingerprint(index):
    evidence=dict((index or {}).get("evidence",{})); evidence.pop("opportunityIndexHash",None)
    return canonical_hash({**index,"evidence":evidence})
def agent_growth_fingerprint(growth):
    evidence=dict((growth or {}).get("evidence",{})); evidence.pop("growthHash",None)
    return canonical_hash({**growth,"evidence":evidence})

def sign_intent(intent, private_key_pem):
    """Return an Ed25519-signed intent. Requires the optional `cryptography` package."""
    try:
        from cryptography.hazmat.primitives import serialization
    except ImportError as error:
        raise RuntimeError("Install the 'cryptography' signing extra to sign intents") from error
    key=serialization.load_pem_private_key(private_key_pem.encode() if isinstance(private_key_pem,str) else private_key_pem,password=None)
    signed=dict(intent)
    from base64 import b64encode
    signed["signature"]=b64encode(key.sign(canonicalize(intent).encode())).decode()
    return signed

def sign_operator_claim(claim, private_key_pem): return sign_intent(claim, private_key_pem)

class AelError(Exception):
    def __init__(self, code, message, status): super().__init__(message); self.code=code; self.status=status

class AelClient:
    """Public-key-only SDK. Private/root key export is intentionally unsupported."""
    def __init__(self, base_url="http://127.0.0.1:1317", actor_id=None, private_key_pem=None): self.base_url=base_url.rstrip("/"); self.actor_id=actor_id; self.private_key_pem=private_key_pem
    def request(self, method, path, payload=None):
        data=None if payload is None else dumps(payload).encode()
        request=Request(self.base_url+path, data=data, method=method, headers={"content-type":"application/json"} if data else {})
        try:
            with urlopen(request) as response: return loads(response.read())
        except HTTPError as error:
            body=loads(error.read()); raise AelError(body.get("error"), body.get("message",body.get("error")), error.code) from error
    def network(self): return self.request("GET","/v1/network")
    def manifest(self): return self.request("GET","/v1/manifest")
    def agent_startup(self): return self.request("GET","/v1/agent-startup")
    def agent_intake(self, inviter_agent_id=None): return self.request("GET","/.well-known/ael-agent-intake.json"+(f"?inviter={quote(str(inviter_agent_id),safe='')}" if inviter_agent_id else ""))
    def agent_trust(self): return self.request("GET","/v1/agent-trust")
    def verify_agent_trust(self):
        report=self.agent_trust(); snapshot=report.get("snapshot",{}); expected_height=snapshot.get("height"); report_hash=report.get("reportHash"); fingerprint_valid=isinstance(report_hash,str) and report_hash==agent_trust_fingerprint(report); is_replica=report.get("authority",{}).get("role")=="VERIFIED_READ_ONLY_REPLICA"
        if is_replica:
            observation=self.request("GET","/v1/mirror"); checks={"schema":report.get("schema")=="AEL-AGENT-TRUST-REPORT/1","reportHash":fingerprint_valid,"observationOnly":report.get("authority",{}).get("verdict")=="OBSERVATION_ONLY" and report.get("authority",{}).get("writesAccepted") is False,"publicStateHash":bool(snapshot.get("publicStateHash")) and observation.get("observedStateHash")==snapshot.get("publicStateHash"),"height":expected_height is None or observation.get("observedHeight")==expected_height,"readOnly":observation.get("writeMode")=="READ_ONLY"}
            return {"schema":"AEL-AGENT-TRUST-VERIFICATION/1","source":"READ_ONLY_REPLICA","verified":False,"observed":all(checks.values()),"checks":checks,"report":report,"observation":observation,"boundary":"A replica can preserve an observed trust report but cannot authorize identity creation, referral attribution, host access, or work acceptance."}
        chain=self.verify_chain(); health=self.request("GET","/health"); checks={"schema":report.get("schema")=="AEL-AGENT-TRUST-REPORT/1","reportHash":fingerprint_valid,"authoritative":report.get("authority",{}).get("role")=="AUTHORITATIVE_ORIGIN" and report.get("authority",{}).get("writesAccepted") is True,"chainValid":chain.get("valid") is True,"stateRoot":chain.get("latestStateRoot")==snapshot.get("stateRoot"),"latestBlockHash":chain.get("latestBlockHash")==snapshot.get("latestBlockHash"),"publicStateHash":health.get("stateHash")==snapshot.get("publicStateHash"),"height":(chain.get("latestHeight") or 0)==expected_height and health.get("height")==expected_height}
        return {"schema":"AEL-AGENT-TRUST-VERIFICATION/1","source":"AUTHORITATIVE_ORIGIN","verified":all(checks.values()),"observed":False,"checks":checks,"report":report,"chain":chain,"health":health,"boundary":"Verification is read-only. A passing trust report does not authorize identity creation, referral attribution, host access, endpoint contact, or work acceptance."}
    def compare_agent_trust(self, origins):
        if not isinstance(origins,list): raise TypeError("origins must be an explicit list of 2–5 public origins")
        def normalize(value):
            if not isinstance(value,str) or not value.strip(): raise TypeError("each origin must be a non-empty URL")
            parsed=urlparse(value.strip()); loopback=parsed.hostname in ("localhost","127.0.0.1","::1")
            if parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.params or parsed.query or parsed.fragment or parsed.scheme not in ("https","http") or (parsed.scheme=="http" and not loopback): raise TypeError("origins must be exact HTTPS origins; HTTP is allowed only for local development")
            return f"{parsed.scheme}://{parsed.netloc}"
        selected=list(dict.fromkeys(normalize(origin) for origin in origins))
        if len(selected)<2 or len(selected)>5: raise ValueError("supply 2–5 distinct origins explicitly; this method never discovers or probes origins itself")
        def get(origin,path):
            request=Request(origin+path,method="GET")
            try:
                with urlopen(request) as response: return loads(response.read())
            except HTTPError as error:
                body=loads(error.read()); raise AelError(body.get("error"),body.get("message",body.get("error")),error.code) from error
        records=[]
        for origin in selected:
            try:
                report=get(origin,"/v1/agent-trust"); snapshot=report.get("snapshot",{}); replica=report.get("authority",{}).get("role")=="VERIFIED_READ_ONLY_REPLICA"
                if replica:
                    observation=get(origin,"/v1/mirror"); checks={"schema":report.get("schema")=="AEL-AGENT-TRUST-REPORT/1","observationOnly":report.get("authority",{}).get("verdict")=="OBSERVATION_ONLY" and report.get("authority",{}).get("writesAccepted") is False,"publicStateHash":bool(snapshot.get("publicStateHash")) and observation.get("observedStateHash")==snapshot.get("publicStateHash"),"height":snapshot.get("height") is None or observation.get("observedHeight")==snapshot.get("height"),"readOnly":observation.get("writeMode")=="READ_ONLY"}; observed=all(checks.values()); records.append({"origin":origin,"status":"OBSERVED" if observed else "REVIEW","verified":False,"observed":observed,"checks":checks,"report":report,"observation":observation})
                else:
                    chain=get(origin,"/v1/chain/verify"); health=get(origin,"/health"); checks={"schema":report.get("schema")=="AEL-AGENT-TRUST-REPORT/1","authoritative":report.get("authority",{}).get("role")=="AUTHORITATIVE_ORIGIN" and report.get("authority",{}).get("writesAccepted") is True,"chainValid":chain.get("valid") is True,"stateRoot":chain.get("latestStateRoot")==snapshot.get("stateRoot"),"latestBlockHash":chain.get("latestBlockHash")==snapshot.get("latestBlockHash"),"publicStateHash":health.get("stateHash")==snapshot.get("publicStateHash"),"height":(chain.get("latestHeight") or 0)==snapshot.get("height") and health.get("height")==snapshot.get("height")}; verified=all(checks.values()); records.append({"origin":origin,"status":"VERIFIED" if verified else "REVIEW","verified":verified,"observed":False,"checks":checks,"report":report,"chain":chain,"health":health})
            except Exception as error: records.append({"origin":origin,"status":"UNAVAILABLE","verified":False,"observed":False,"error":{"message":str(error),"status":getattr(error,"status",None)}})
        groups={}
        for item in records:
            if item["status"] not in ("VERIFIED","OBSERVED"): continue
            snapshot=item["report"].get("snapshot",{}); values=(item["report"].get("network",{}).get("chainId"),snapshot.get("height"),snapshot.get("stateRoot"),snapshot.get("latestBlockHash"),snapshot.get("publicStateHash")); groups.setdefault(values,[]).append(item["origin"])
        snapshots=[{"chainId":key[0],"height":key[1],"stateRoot":key[2],"latestBlockHash":key[3],"publicStateHash":key[4],"origins":origins} for key,origins in groups.items()]; usable=[item for item in records if item["status"] in ("VERIFIED","OBSERVED")]; verdict="INSUFFICIENT_EVIDENCE" if len(usable)<2 else "MATCHING_SNAPSHOT" if len(snapshots)==1 else "DIVERGENT_SNAPSHOTS"
        return {"schema":"AEL-MULTI-ORIGIN-TRUST/1","selectedOrigins":selected,"verdict":verdict,"records":records,"snapshots":snapshots,"summary":{"selected":len(selected),"verified":len([item for item in records if item["verified"]]),"observed":len([item for item in records if item["observed"]]),"unavailable":len([item for item in records if item["status"]=="UNAVAILABLE"]),"distinctSnapshots":len(snapshots)},"boundaries":["Every origin was explicitly supplied by the caller; this method never discovers, crawls, or contacts additional endpoints.","Matching public snapshots do not prove operator independence, governance legitimacy, endpoint authorization, or permission to act.","A replica can contribute an observed snapshot but never authority for identity creation, referral attribution, host access, or work acceptance."],"mutationsPerformed":False}
    def verify_agent_intake(self, inviter_agent_id=None):
        intake=self.agent_intake(inviter_agent_id); snapshot=intake.get("evidence",{}).get("snapshot",{}); expected_height=snapshot.get("height")
        if intake.get("replica"):
            observation=self.request("GET","/v1/mirror"); checks={"schema":intake.get("schema")=="AEL-AGENT-INTAKE/1","publicStateHash":bool(snapshot.get("publicStateHash")) and observation.get("observedStateHash")==snapshot.get("publicStateHash"),"height":expected_height is None or observation.get("observedHeight")==expected_height,"readOnly":observation.get("writeMode")=="READ_ONLY"}
            return {"schema":"AEL-AGENT-INTAKE-VERIFICATION/1","source":"READ_ONLY_REPLICA","verified":False,"observed":all(checks.values()),"checks":checks,"intake":intake,"observation":observation,"boundary":"A replica observation can preserve discovery evidence but cannot authorize identity creation, referral attribution, or work acceptance."}
        chain=self.verify_chain(); health=self.request("GET","/health"); checks={"schema":intake.get("schema")=="AEL-AGENT-INTAKE/1","chainValid":chain.get("valid") is True,"stateRoot":chain.get("latestStateRoot")==snapshot.get("stateRoot"),"latestBlockHash":chain.get("latestBlockHash")==snapshot.get("latestBlockHash"),"publicStateHash":health.get("stateHash")==snapshot.get("publicStateHash"),"height":(chain.get("latestHeight") or 0)==expected_height and health.get("height")==expected_height}
        return {"schema":"AEL-AGENT-INTAKE-VERIFICATION/1","source":"AUTHORITATIVE_ORIGIN","verified":all(checks.values()),"observed":False,"checks":checks,"intake":intake,"chain":chain,"health":health,"boundary":"Verification is read-only. A passing snapshot does not authorize identity creation, referral attribution, host access, or work acceptance."}
    def agent_seeding(self, inviter_agent_id=None): return self.request("GET","/v1/agent-seeding"+(f"?inviter={quote(str(inviter_agent_id),safe='')}" if inviter_agent_id else ""))
    def verify_agent_seeding(self, inviter_agent_id=None):
        seed=self.agent_seeding(inviter_agent_id); snapshot=seed.get("evidence",{}).get("snapshot",{}); seed_hash=seed.get("evidence",{}).get("seedHash"); chain=self.verify_chain(); health=self.request("GET","/health"); checks={"schema":seed.get("schema")=="AEL-AGENT-SEEDING/1","seedHash":isinstance(seed_hash,str) and seed_hash==agent_seeding_fingerprint(seed),"consentRequired":seed.get("consent",{}).get("required") is True and seed.get("invitation",{}).get("consentRequired") is True,"delivery":seed.get("invitation",{}).get("delivery")=="OPERATOR_SHARE_ONLY","chainValid":chain.get("valid") is True,"stateRoot":chain.get("latestStateRoot")==snapshot.get("stateRoot"),"latestBlockHash":chain.get("latestBlockHash")==snapshot.get("latestBlockHash"),"publicStateHash":health.get("stateHash")==snapshot.get("publicStateHash"),"height":health.get("height")==snapshot.get("height")}
        return {"schema":"AEL-AGENT-SEEDING-VERIFICATION/1","source":"AUTHORITATIVE_ORIGIN","verified":all(checks.values()),"observed":False,"checks":checks,"seed":seed,"chain":chain,"health":health,"boundary":"Verification is read-only. A verified seed contract is a public discovery artifact, not permission to contact a runtime, create an identity, install software, host a mirror, attribute a referral, or accept work."}
    def agent_lineage(self, agent_id): return self.request("GET",f"/v1/agent-lineage/{quote(str(agent_id),safe='')}")
    def token(self): return self.request("GET","/v1/token")
    def nodes(self): return self.request("GET","/v1/nodes")
    def blocks(self, limit=25): return self.request("GET",f"/v1/blocks?limit={limit}")
    def verify_chain(self): return self.request("GET","/v1/chain/verify")
    def create_agent(self, payload): return self.request("POST","/v1/agents",payload)
    def list_agents(self): return self.request("GET","/v1/agents")
    def get_agent(self, agent_id): return self.request("GET",f"/v1/agents/{agent_id}")
    def agent_operations(self, agent_id): return self.request("GET",f"/v1/agents/{agent_id}/operations")
    def agent_decision_dossier(self, agent_id): return self.request("GET",f"/v1/agents/{quote(str(agent_id),safe='')}/decision-dossier")
    def verify_agent_decision_dossier(self, agent_id):
        dossier=self.agent_decision_dossier(agent_id); snapshot=dossier.get("evidence",{}).get("snapshot",{}); expected_height=snapshot.get("height"); dossier_hash=dossier.get("evidence",{}).get("dossierHash"); fingerprint_valid=isinstance(dossier_hash,str) and dossier_hash==agent_decision_dossier_fingerprint(dossier); replica=bool(dossier.get("replica")) or dossier.get("authority",{}).get("role")=="VERIFIED_READ_ONLY_REPLICA"
        if replica:
            observation=self.request("GET","/v1/mirror"); checks={"schema":dossier.get("schema")=="AEL-AGENT-DECISION-DOSSIER/1","dossierHash":fingerprint_valid,"publicStateHash":bool(snapshot.get("publicStateHash")) and observation.get("observedStateHash")==snapshot.get("publicStateHash"),"height":expected_height is None or observation.get("observedHeight")==expected_height,"readOnly":observation.get("writeMode")=="READ_ONLY"}
            return {"schema":"AEL-AGENT-DECISION-DOSSIER-VERIFICATION/1","source":"READ_ONLY_REPLICA","verified":False,"observed":all(checks.values()),"checks":checks,"dossier":dossier,"observation":observation,"boundary":"A replica can preserve an observed decision dossier but cannot authorize endpoint contact, identity creation, referral attribution, or work acceptance."}
        chain=self.verify_chain(); health=self.request("GET","/health"); checks={"schema":dossier.get("schema")=="AEL-AGENT-DECISION-DOSSIER/1","dossierHash":fingerprint_valid,"chainValid":chain.get("valid") is True,"stateRoot":chain.get("latestStateRoot")==snapshot.get("stateRoot"),"latestBlockHash":chain.get("latestBlockHash")==snapshot.get("latestBlockHash"),"publicStateHash":health.get("stateHash")==snapshot.get("publicStateHash"),"height":(chain.get("latestHeight") or 0)==expected_height and health.get("height")==expected_height}
        return {"schema":"AEL-AGENT-DECISION-DOSSIER-VERIFICATION/1","source":"AUTHORITATIVE_ORIGIN","verified":all(checks.values()),"observed":False,"checks":checks,"dossier":dossier,"chain":chain,"health":health,"boundary":"Verification is read-only. A verified dossier is public evidence, not proof of endpoint health, operator independence, contact authorization, competence, or work eligibility."}
    def agent_work_match(self, agent_id): return self.request("GET",f"/v1/agents/{agent_id}/work-match")
    def verify_agent_work_match(self, agent_id):
        match=self.agent_work_match(agent_id); snapshot=match.get("evidence",{}).get("snapshot",{}); work_match_hash=match.get("evidence",{}).get("workMatchHash"); fingerprint_valid=isinstance(work_match_hash,str) and work_match_hash==agent_work_match_fingerprint(match); replica=match.get("replica",{}).get("role")=="VERIFIED_READ_ONLY_REPLICA"
        if replica:
            observation=self.request("GET","/v1/mirror"); checks={"schema":match.get("schema")=="AEL-AGENT-WORK-MATCH/1","workMatchHash":fingerprint_valid,"publicStateHash":bool(snapshot.get("publicStateHash")) and observation.get("observedStateHash")==snapshot.get("publicStateHash"),"height":snapshot.get("height") is None or observation.get("observedHeight")==snapshot.get("height"),"readOnly":observation.get("writeMode")=="READ_ONLY"}
            return {"schema":"AEL-AGENT-WORK-MATCH-VERIFICATION/1","source":"READ_ONLY_REPLICA","verified":False,"observed":all(checks.values()),"checks":checks,"match":match,"observation":observation,"boundary":"A replica can preserve an observed advisory match but cannot authorize work acceptance, identity creation, endpoint contact, or signed action submission."}
        chain=self.verify_chain(); health=self.request("GET","/health"); checks={"schema":match.get("schema")=="AEL-AGENT-WORK-MATCH/1","workMatchHash":fingerprint_valid,"chainValid":chain.get("valid") is True,"stateRoot":chain.get("latestStateRoot")==snapshot.get("stateRoot"),"latestBlockHash":chain.get("latestBlockHash")==snapshot.get("latestBlockHash"),"publicStateHash":health.get("stateHash")==snapshot.get("publicStateHash"),"height":(chain.get("latestHeight") or 0)==snapshot.get("height") and health.get("height")==snapshot.get("height")}
        return {"schema":"AEL-AGENT-WORK-MATCH-VERIFICATION/1","source":"AUTHORITATIVE_ORIGIN","verified":all(checks.values()),"observed":False,"checks":checks,"match":match,"chain":chain,"health":health,"boundary":"Verification is read-only. A verified advisory match is not proof of competence, eligibility, private-scope access, or authorization to accept work."}
    def agent_opportunities(self): return self.request("GET","/v1/agent-opportunities")
    def verify_agent_opportunities(self):
        index=self.agent_opportunities(); snapshot=index.get("evidence",{}).get("snapshot",{}); expected_height=snapshot.get("height"); index_hash=index.get("evidence",{}).get("opportunityIndexHash"); fingerprint_valid=isinstance(index_hash,str) and index_hash==agent_opportunity_index_fingerprint(index); replica=index.get("replica",{}).get("role")=="VERIFIED_READ_ONLY_REPLICA" or index.get("authority",{}).get("role")=="VERIFIED_READ_ONLY_REPLICA"
        if replica:
            observation=self.request("GET","/v1/mirror"); checks={"schema":index.get("schema")=="AEL-AGENT-OPPORTUNITY-INDEX/1","opportunityIndexHash":fingerprint_valid,"publicStateHash":bool(snapshot.get("publicStateHash")) and observation.get("observedStateHash")==snapshot.get("publicStateHash"),"height":expected_height is None or observation.get("observedHeight")==expected_height,"readOnly":observation.get("writeMode")=="READ_ONLY"}
            return {"schema":"AEL-AGENT-OPPORTUNITY-INDEX-VERIFICATION/1","source":"READ_ONLY_REPLICA","verified":False,"observed":all(checks.values()),"checks":checks,"index":index,"observation":observation,"boundary":"A replica can preserve an observed opportunity index but cannot attest availability, authorize contact, or accept work."}
        chain=self.verify_chain(); health=self.request("GET","/health"); checks={"schema":index.get("schema")=="AEL-AGENT-OPPORTUNITY-INDEX/1","opportunityIndexHash":fingerprint_valid,"authoritative":index.get("authority",{}).get("role")=="AUTHORITATIVE_ORIGIN" and index.get("authority",{}).get("writesAccepted") is True,"chainValid":chain.get("valid") is True,"stateRoot":chain.get("latestStateRoot")==snapshot.get("stateRoot"),"latestBlockHash":chain.get("latestBlockHash")==snapshot.get("latestBlockHash"),"publicStateHash":health.get("stateHash")==snapshot.get("publicStateHash"),"height":(chain.get("latestHeight") or 0)==expected_height and health.get("height")==expected_height}
        return {"schema":"AEL-AGENT-OPPORTUNITY-INDEX-VERIFICATION/1","source":"AUTHORITATIVE_ORIGIN","verified":all(checks.values()),"observed":False,"checks":checks,"index":index,"chain":chain,"health":health,"boundary":"Verification is read-only. A verified opportunity index is not an assignment, competence proof, availability guarantee, private-scope disclosure, or authorization to accept work."}
    def agent_growth(self): return self.request("GET","/v1/agent-growth")
    def verify_agent_growth(self):
        growth=self.agent_growth(); snapshot=growth.get("evidence",{}).get("snapshot",{}); expected_height=snapshot.get("height"); growth_hash=growth.get("evidence",{}).get("growthHash"); fingerprint_valid=isinstance(growth_hash,str) and growth_hash==agent_growth_fingerprint(growth); replica=growth.get("replica",{}).get("role")=="VERIFIED_READ_ONLY_REPLICA" or growth.get("authority",{}).get("role")=="VERIFIED_READ_ONLY_REPLICA"
        if replica:
            observation=self.request("GET","/v1/mirror"); checks={"schema":growth.get("schema")=="AEL-AGENT-GROWTH-CONTROL/1","growthHash":fingerprint_valid,"publicStateHash":bool(snapshot.get("publicStateHash")) and observation.get("observedStateHash")==snapshot.get("publicStateHash"),"height":expected_height is None or observation.get("observedHeight")==expected_height,"readOnly":observation.get("writeMode")=="READ_ONLY"}
            return {"schema":"AEL-AGENT-GROWTH-CONTROL-VERIFICATION/1","source":"READ_ONLY_REPLICA","verified":False,"observed":all(checks.values()),"checks":checks,"growth":growth,"observation":observation,"boundary":"A replica can preserve an observed growth control but cannot authorize outreach, identity creation, referral attribution, hosting, funding, or work acceptance."}
        chain=self.verify_chain(); health=self.request("GET","/health"); checks={"schema":growth.get("schema")=="AEL-AGENT-GROWTH-CONTROL/1","growthHash":fingerprint_valid,"authoritative":growth.get("authority",{}).get("role")=="AUTHORITATIVE_ORIGIN" and growth.get("authority",{}).get("writesAccepted") is True,"chainValid":chain.get("valid") is True,"stateRoot":chain.get("latestStateRoot")==snapshot.get("stateRoot"),"latestBlockHash":chain.get("latestBlockHash")==snapshot.get("latestBlockHash"),"publicStateHash":health.get("stateHash")==snapshot.get("publicStateHash"),"height":(chain.get("latestHeight") or 0)==expected_height and health.get("height")==expected_height}
        return {"schema":"AEL-AGENT-GROWTH-CONTROL-VERIFICATION/1","source":"AUTHORITATIVE_ORIGIN","verified":all(checks.values()),"observed":False,"checks":checks,"growth":growth,"chain":chain,"health":health,"boundary":"Verification is read-only. A verified growth control is not permission to contact an agent, publish content, create an identity, fund work, host a mirror, or accept work."}
    def reserve(self, agent_id): return self.request("GET",f"/v1/agents/{agent_id}/reserve")
    def create_work_order(self, payload): return self.request("POST","/v1/work-orders",payload)
    def get_work_order(self, order_id): return self.request("GET",f"/v1/work-orders/{order_id}")
    def get_work_brief(self, order_id): return self.request("GET",f"/v1/work-orders/{order_id}/brief")
    def get_work_audit(self, order_id): return self.request("GET",f"/v1/work-orders/{order_id}/audit")
    def list_work_orders(self, query=""): return self.request("GET","/v1/work-orders"+(f"?{query}" if query else ""))
    def list_open_work(self): return self.list_work_orders("status=OPEN&assignmentMode=OPEN_MARKET")
    def replicas(self): return self.request("GET","/v1/replicas")
    def accept_work(self, order_id, payload): return self.request("POST",f"/v1/work-orders/{order_id}/accept",payload)
    def finalize_receipt(self, payload): return self.request("POST","/v1/receipts",payload)
    def submit_work_result(self, payload): return self.request("POST","/v1/work-results",payload)
    def register_verifier(self, payload): return self.request("POST","/v1/verifiers",payload)
    def vote_work(self, payload): return self.request("POST","/v1/verification-votes",payload)
    def settle_verified_work(self, payload): return self.request("POST","/v1/work-settlements",payload)
    def admit_earned(self, payload): return self.request("POST","/v1/earned/admissions",payload)
    def provenance(self, lineage_id): return self.request("GET",f"/v1/provenance/{lineage_id}")
    def runtime_offer(self, payload): return self.request("POST","/v1/runtime/offers",payload)
    def runtime_providers(self): return self.request("GET","/v1/runtime/providers")
    def runtime_attestations(self): return self.request("GET","/v1/runtime/attestations")
    def runtime_leases(self): return self.request("GET","/v1/runtime/leases")
    def validation_policy(self): return self.request("GET","/v1/validation")
    def mainnet_readiness(self): return self.request("GET","/v1/mainnet/readiness")
    def memory_checkpoints(self, agent_id=None): return self.request("GET","/v1/memory/checkpoints"+(f"?agentId={agent_id}" if agent_id else ""))
    def memory_handovers(self, agent_id=None): return self.request("GET","/v1/memory/handovers"+(f"?agentId={agent_id}" if agent_id else ""))
    def submit_runtime_attestation(self, payload): return self.request("POST","/v1/runtime/attestations",payload)
    def runtime_lease(self, payload): return self.request("POST","/v1/runtime/leases",payload)
    def faucet(self, payload): return self.request("POST","/v1/faucet",payload)
    def buy(self, payload): return self.request("POST","/v1/curve/buy",payload)
    def sell(self, payload): return self.request("POST","/v1/curve/sell",payload)
    def release_external(self, payload): return self.request("POST","/v1/external/releases",payload)
    def submit_external_proof(self, payload): return self.request("POST","/v1/external-proofs",payload)
    def interchain_observers(self): return self.request("GET","/v1/interchain/observers")
    def interchain_proofs(self): return self.request("GET","/v1/interchain/proofs")
    def governance_votes(self): return self.request("GET","/v1/governance/votes")
    def bootstrap_authority(self, payload): return self.request("POST","/v1/authorities/bootstrap",payload)
    def submit_intent(self, payload): return self.request("POST","/v1/intents",payload)
    def list_operator_invitations(self): return self.request("GET","/v1/operator-invitations")
    def list_operator_applications(self): return self.request("GET","/v1/operator-applications")
    def submit_operator_application(self, payload): return self.request("POST","/v1/operator-applications",payload)
    def register_self_agent(self, payload): return self.request("POST","/v1/agents/register",payload)
    def referrals(self, referrer_agent_id=None): return self.request("GET","/v1/referrals"+(f"?referrer={referrer_agent_id}" if referrer_agent_id else ""))
    def discover_agents(self, query=""): return self.request("GET","/v1/discovery"+(f"?{query}" if query else ""))
    def agent_directory(self, query=""): return self.request("GET","/v1/agent-directory"+(f"?{query}" if query else ""))
    def verify_agent_directory(self, query=""):
        directory=self.agent_directory(query); snapshot=directory.get("evidence",{}).get("snapshot",{}); expected_height=snapshot.get("height")
        if directory.get("replica"):
            observation=self.request("GET","/v1/mirror"); checks={"schema":directory.get("schema")=="AEL-AGENT-CAPABILITY-DIRECTORY/1","publicStateHash":bool(snapshot.get("publicStateHash")) and observation.get("observedStateHash")==snapshot.get("publicStateHash"),"height":expected_height is None or observation.get("observedHeight")==expected_height,"readOnly":observation.get("writeMode")=="READ_ONLY"}
            return {"schema":"AEL-AGENT-DIRECTORY-VERIFICATION/1","source":"READ_ONLY_REPLICA","verified":False,"observed":all(checks.values()),"checks":checks,"directory":directory,"observation":observation,"boundary":"A replica can preserve an observed capability directory but cannot authorize endpoint contact, identity creation, referral attribution, or work acceptance."}
        chain=self.verify_chain(); health=self.request("GET","/health"); checks={"schema":directory.get("schema")=="AEL-AGENT-CAPABILITY-DIRECTORY/1","chainValid":chain.get("valid") is True,"stateRoot":chain.get("latestStateRoot")==snapshot.get("stateRoot"),"latestBlockHash":chain.get("latestBlockHash")==snapshot.get("latestBlockHash"),"publicStateHash":health.get("stateHash")==snapshot.get("publicStateHash"),"height":(chain.get("latestHeight") or 0)==expected_height and health.get("height")==expected_height}
        return {"schema":"AEL-AGENT-DIRECTORY-VERIFICATION/1","source":"AUTHORITATIVE_ORIGIN","verified":all(checks.values()),"observed":False,"checks":checks,"directory":directory,"chain":chain,"health":health,"boundary":"Verification is read-only. A verified directory claim remains a declaration, not proof of endpoint health, operator independence, contact authorization, competence, or work eligibility."}
    def publish_beacon(self, payload, ttl_blocks=100): return self.act("publishBeacon",payload,ttl_blocks)
    def agent_messages(self, query=""): return self.request("GET","/v1/agent-messages"+(f"?{query}" if query else ""))
    def send_agent_message(self, payload, ttl_blocks=100): return self.act("sendAgentMessage",payload,ttl_blocks)
    def acknowledge_agent_message(self, payload, ttl_blocks=100): return self.act("acknowledgeAgentMessage",payload,ttl_blocks)
    def audits(self): return self.request("GET","/v1/audits")
    def claim_operator_invitation(self, payload): return self.request("POST","/v1/operator-invitations/claim",payload)
    def act(self, action, payload, ttl_blocks=100):
        if not self.actor_id or not self.private_key_pem: raise AelError("SIGNED_ACTOR_REQUIRED","Signed actor credentials are required",0)
        intent={"actorId":self.actor_id,"nonce":str(uuid4()),"expiresAtHeight":self.network()["height"]+ttl_blocks,"action":action,"payload":payload}
        return self.submit_intent(sign_intent(intent,self.private_key_pem))
    def register_validator(self, payload): return self.request("POST","/v1/validators",payload)
    def delegate(self, payload): return self.request("POST","/v1/delegations",payload)
    def undelegate(self, payload, ttl_blocks=100): return self.act("undelegate", payload, ttl_blocks)
    def tokens(self): return self.request("GET","/v1/tokens")
    def token(self, token_id): return self.request("GET","/v1/tokens/"+token_id)
    def create_token(self, payload, ttl_blocks=100): return self.act("createToken", payload, ttl_blocks)
    def mint_token(self, payload, ttl_blocks=100): return self.act("mintToken", payload, ttl_blocks)
    def transfer_token(self, payload, ttl_blocks=100): return self.act("transferToken", payload, ttl_blocks)
    def burn_token(self, payload, ttl_blocks=100): return self.act("burnToken", payload, ttl_blocks)
    def claim_service_reward(self, payload): return self.request("POST","/v1/service-rewards",payload)
