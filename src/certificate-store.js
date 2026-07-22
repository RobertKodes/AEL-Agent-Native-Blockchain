import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { hash } from "./canonical.js";
import { ProtocolError } from "./errors.js";

export class CertificateStore {
  constructor(path) {
    this.path = path;
    this.byHash = new Map();
    this.byHeight = new Map();
    this.load();
  }
  validate(certificate) {
    if (!certificate || !["AEL-FINALITY-CERTIFICATE/1","AEL-CHECKPOINT-CERTIFICATE/1"].includes(certificate.schema))
      throw new ProtocolError("FINALITY_CERTIFICATE_INVALID");
    const { certificateHash, ...body } = certificate;
    if (
      !/^[a-f0-9]{64}$/.test(certificateHash ?? "") ||
      hash(body) !== certificateHash ||
      !Number.isInteger(certificate.height) ||
      certificate.height < 1
    )
      throw new ProtocolError("FINALITY_CERTIFICATE_INVALID");
    return certificate;
  }
  load() {
    if (!existsSync(this.path)) return;
    for (const line of readFileSync(this.path, "utf8")
      .split("\n")
      .filter(Boolean)) {
      let certificate;
      try {
        certificate = JSON.parse(line);
      } catch {
        throw new ProtocolError("CERTIFICATE_STORE_CORRUPT");
      }
      try {
        this.index(this.validate(certificate));
      } catch {
        throw new ProtocolError("CERTIFICATE_STORE_CORRUPT");
      }
    }
  }
  index(certificate) {
    const existing = this.byHeight.get(certificate.height);
    if (existing && existing.certificateHash !== certificate.certificateHash)
      throw new ProtocolError("CONFLICTING_FINALITY_CERTIFICATE");
    this.byHash.set(certificate.certificateHash, certificate);
    this.byHeight.set(certificate.height, certificate);
  }
  append(certificate) {
    this.validate(certificate);
    if (this.byHash.has(certificate.certificateHash)) return certificate;
    this.index(certificate);
    mkdirSync(dirname(this.path), { recursive: true });
    const fd = openSync(this.path, "a", 0o600);
    try {
      appendFileSync(fd, `${JSON.stringify(certificate)}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    return certificate;
  }
  get(certificateHash) {
    return this.byHash.get(certificateHash) ?? null;
  }
  atHeight(height) {
    return this.byHeight.get(height) ?? null;
  }
  latest() {
    return (
      [...this.byHeight.values()].sort((a, b) => b.height - a.height)[0] ?? null
    );
  }
}
