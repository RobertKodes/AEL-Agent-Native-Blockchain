#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const packageDocument=JSON.parse(readFileSync('package.json','utf8'));
const auditManifest=readFileSync('dist/audit-manifest.json');
const sourceManifestSha256=createHash('sha256').update(auditManifest).digest('hex');
const created='2026-07-22T00:00:00Z';
const packageSpdxId='SPDXRef-Package-AEL';
const document={
  spdxVersion:'SPDX-2.3',
  dataLicense:'CC0-1.0',
  SPDXID:'SPDXRef-DOCUMENT',
  name:`AEL-${packageDocument.version}-source-sbom`,
  documentNamespace:`https://github.com/RobertKodes/AEL-Agent-Native-Blockchain/spdx/${packageDocument.version}/${sourceManifestSha256}`,
  creationInfo:{created,creators:['Tool: AEL deterministic SPDX generator/1.0']},
  documentDescribes:[packageSpdxId],
  packages:[{
    name:packageDocument.name,
    SPDXID:packageSpdxId,
    versionInfo:packageDocument.version,
    downloadLocation:`https://github.com/RobertKodes/AEL-Agent-Native-Blockchain/releases/tag/v${packageDocument.version}-devnet`,
    filesAnalyzed:false,
    licenseConcluded:packageDocument.license,
    licenseDeclared:packageDocument.license,
    copyrightText:'NOASSERTION',
    summary:packageDocument.description,
    externalRefs:[{referenceCategory:'PACKAGE-MANAGER',referenceType:'purl',referenceLocator:`pkg:npm/${packageDocument.name}@${packageDocument.version}`}],
    annotations:[{annotationDate:created,annotationType:'OTHER',annotator:'Tool: AEL deterministic SPDX generator/1.0',comment:`AEL-AUDIT-MANIFEST/1 SHA-256: ${sourceManifestSha256}; the package declares no third-party runtime dependencies.`}]
  }],
  relationships:[{spdxElementId:'SPDXRef-DOCUMENT',relationshipType:'DESCRIBES',relatedSpdxElement:packageSpdxId}]
};
writeFileSync(process.argv[2]??'dist/ael-sbom.spdx.json',`${JSON.stringify(document,null,2)}\n`);
