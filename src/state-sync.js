import { createHash } from "node:crypto";
import { canonicalize, hash } from "./canonical.js";
import { ProtocolError } from "./errors.js";
import { verifyFinalityCertificate } from "./consensus-primitives.js";

const digest = (value) => createHash("sha256").update(value).digest("hex");
export const merkleRoot = (hashes) => {
  if (!hashes.length) return digest(Buffer.alloc(0));
  let level = [...hashes];
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2)
      next.push(
        digest(
          Buffer.from(
            `${level[index]}${level[index + 1] ?? level[index]}`,
            "hex",
          ),
        ),
      );
    level = next;
  }
  return level[0];
};

export function createStateCheckpoint(state, certificate, chunkSize = 262144) {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1024 || !certificate)
    throw new ProtocolError("STATE_CHECKPOINT_INVALID");
  const encoded = Buffer.from(canonicalize(state)),
    chunks = [];
  for (let offset = 0; offset < encoded.length; offset += chunkSize)
    chunks.push(encoded.subarray(offset, offset + chunkSize));
  const chunkHashes = chunks.map(digest),
    body = {
      schema: "AEL-STATE-CHECKPOINT/1",
      height: state.height,
      stateHash: hash(state),
      certificateHash: certificate.certificateHash,
      encoding: "canonical-json",
      byteLength: encoded.length,
      chunkSize,
      chunkCount: chunks.length,
      chunkHashes,
      chunksRoot: merkleRoot(chunkHashes),
    };
  return { manifest: { ...body, checkpointHash: hash(body) }, chunks };
}

export function verifyStateCheckpoint({
  manifest,
  chunks,
  certificate,
  validatorSet,
}) {
  const { checkpointHash, ...body } = manifest ?? {};
  if (
    manifest?.schema !== "AEL-STATE-CHECKPOINT/1" ||
    hash(body) !== checkpointHash ||
    !Array.isArray(chunks) ||
    chunks.length !== manifest.chunkCount
  )
    throw new ProtocolError("STATE_CHECKPOINT_INVALID");
  const buffers = chunks.map((chunk) =>
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "base64"),
    ),
    chunkHashes = buffers.map(digest);
  if (
    chunkHashes.some((value, index) => value !== manifest.chunkHashes[index]) ||
    merkleRoot(chunkHashes) !== manifest.chunksRoot ||
    buffers.reduce((sum, item) => sum + item.length, 0) !== manifest.byteLength
  )
    throw new ProtocolError("STATE_CHUNK_INVALID");
  let state;
  try {
    state = JSON.parse(Buffer.concat(buffers).toString("utf8"));
  } catch {
    throw new ProtocolError("STATE_CHECKPOINT_INVALID");
  }
  if (
    state.height !== manifest.height ||
    hash(state) !== manifest.stateHash ||
    certificate?.certificateHash !== manifest.certificateHash ||
    !verifyFinalityCertificate({
      certificate,
      validatorSet,
      stateHash: manifest.stateHash,
      height: manifest.height,
    })
  )
    throw new ProtocolError("STATE_CHECKPOINT_CERTIFICATE_INVALID");
  return state;
}

export async function fetchStateFromPeers(
  peerUrls,
  { validatorSet, minSources = 2, timeoutMs = 5000 } = {},
) {
  const observations = await Promise.allSettled(
      peerUrls.map(async (peer) => {
        const response = await fetch(
          `${peer.replace(/\/$/, "")}/v1/state/checkpoint`,
          { signal: AbortSignal.timeout(timeoutMs) },
        );
        if (!response.ok) throw Error("checkpoint");
        return { peer, manifest: await response.json() };
      }),
    ),
    groups = new Map();
  for (const result of observations)
    if (result.status === "fulfilled") {
      const key = result.value.manifest.checkpointHash,
        list = groups.get(key) ?? [];
      list.push(result.value);
      groups.set(key, list);
    }
  const agreed = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  if (!agreed || agreed.length < minSources)
    throw new ProtocolError("STATE_SYNC_SOURCE_QUORUM");
  const manifest = agreed[0].manifest,
    certificateResponse = await fetch(
      `${agreed[0].peer.replace(/\/$/, "")}/v1/consensus/certificates/${manifest.certificateHash}`,
      { signal: AbortSignal.timeout(timeoutMs) },
    );
  if (!certificateResponse.ok)
    throw new ProtocolError("STATE_SYNC_CERTIFICATE_UNAVAILABLE");
  const certificate = await certificateResponse.json(),
    chunks = await Promise.all(
      manifest.chunkHashes.map(async (_, index) => {
        const source = agreed[index % agreed.length].peer,
          response = await fetch(
            `${source.replace(/\/$/, "")}/v1/state/chunks/${index}?checkpoint=${manifest.checkpointHash}`,
            { signal: AbortSignal.timeout(timeoutMs) },
          );
        if (!response.ok)
          throw new ProtocolError("STATE_SYNC_CHUNK_UNAVAILABLE");
        return Buffer.from((await response.json()).data, "base64");
      }),
    );
  return {
    state: verifyStateCheckpoint({
      manifest,
      chunks,
      certificate,
      validatorSet,
    }),
    manifest,
    certificate,
    sources: agreed.map((item) => item.peer),
  };
}
