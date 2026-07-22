"""Dependency-free AEL local-devnet client and canonical vector utilities."""
from hashlib import sha256
from json import dumps, loads
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

def canonicalize(value):
    if value is None: return "null"
    if value is True: return "true"
    if value is False: return "false"
    if isinstance(value, str): return dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, (int, float)): return dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list): return "[" + ",".join(canonicalize(x) for x in value) + "]"
    if isinstance(value, dict): return "{" + ",".join(dumps(k, ensure_ascii=False) + ":" + canonicalize(value[k]) for k in sorted(value) if value[k] is not None) + "}"
    raise TypeError(f"Unsupported canonical type: {type(value).__name__}")

def canonical_hash(value): return sha256(canonicalize(value).encode()).hexdigest()
def public_key_fingerprint(public_key_pem): return canonical_hash(public_key_pem)

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
    def token(self): return self.request("GET","/v1/token")
    def nodes(self): return self.request("GET","/v1/nodes")
    def blocks(self, limit=25): return self.request("GET",f"/v1/blocks?limit={limit}")
    def verify_chain(self): return self.request("GET","/v1/chain/verify")
    def create_agent(self, payload): return self.request("POST","/v1/agents",payload)
    def list_agents(self): return self.request("GET","/v1/agents")
    def get_agent(self, agent_id): return self.request("GET",f"/v1/agents/{agent_id}")
    def reserve(self, agent_id): return self.request("GET",f"/v1/agents/{agent_id}/reserve")
    def create_work_order(self, payload): return self.request("POST","/v1/work-orders",payload)
    def list_work_orders(self, query=""): return self.request("GET","/v1/work-orders"+(f"?{query}" if query else ""))
    def list_open_work(self): return self.list_work_orders("status=OPEN&assignmentMode=OPEN_MARKET")
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
    def claim_service_reward(self, payload): return self.request("POST","/v1/service-rewards",payload)
