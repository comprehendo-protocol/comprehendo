// Corpus Discovery CLI [NN]: the module surface, for tests (a process
// boundary is what `main.ts`'s own describe block crosses; everything else
// exercises these as functions).

export { run, USAGE } from './main.js';
export { runAdd, type AddDeps, type AddOptions, type AddResult } from './add.js';
export { installCorpusPackage, realInstaller, type InstallResult, type Installer } from './installer.js';
export {
  isValidNpmName,
  lookupCorpusPackage,
  type Fetcher,
  type RegistryError,
  type RegistryFound,
  type RegistryLookup,
  type RegistryNotFound,
} from './registry-lookup.js';
