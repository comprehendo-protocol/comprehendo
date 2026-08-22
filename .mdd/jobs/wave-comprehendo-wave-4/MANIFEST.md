# Wave job manifest: comprehendo-wave-4

mode: unattended
branch: wave/comprehendo-wave-4
started: 2026-08-22

## Lane plan

- batch 1 (parallel, 2): 19-cc8-native-precedence, 20-cc10-honest-miss [done, SPECs, no code]
- batch 2 (sequential, 1): 21-fingerprint-index-matcher (dep 20; new package packages/registry-tools)
- batch 3 (sequential, 1): 22-router-precedence (dep 19, 21, 12; new file packages/core/src/router.ts)
- batch 4 (parallel, 2): 23-config-loader (dep 22; EXTENDS the existing packages/core/src/config.ts from 15-manifest-wiring), 24-wrap-proxy (dep 22, 12; new file packages/core/src/wrap.ts)

## Features

- [x] 19-cc8-native-precedence (SPEC)
- [x] 20-cc10-honest-miss (SPEC)
- [ ] 21-fingerprint-index-matcher (COMPONENT)
- [ ] 22-router-precedence (COMPONENT)
- [ ] 23-config-loader (COMPONENT)
- [ ] 24-wrap-proxy (COMPONENT)

## Judgment log

(SPECs 19-20 had no code phase, mechanical contract confirmation, no judgment calls worth logging beyond what's in their docs.)
