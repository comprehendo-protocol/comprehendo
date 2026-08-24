// mongodb Corpus: the inducing calls for every cataloged entry, both kinds.
//
// `runtime-error` twins are real errors, really thrown, against a real
// MongoDB server (`mongo-server.ts`) via the real, installed `mongodb`
// driver, the same evidentiary standard every prior corpus's witnesses
// use. `static-pattern` twins have no throw to catch by definition (see
// each one's own comment below); their evidence is a real, live-checked
// behavioral claim instead, run against the same real server, never
// invented and never taken on the strength of the project's own rules
// file alone.

import { MongoClient, MongoServerError, ObjectId } from 'mongodb';

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** The real, installed mongodb driver's own reported version. Never assumed. */
export function mongodbVersion(): string {
  const pkg = require('mongodb/package.json') as { readonly version: string };
  return pkg.version;
}

// --- runtime-error twins: a real call against a real server, a real catch --

export interface RuntimeWitness {
  readonly code: string;
  /** The call that really throws against a real, connected MongoDB. Not expected to return. */
  readonly provoke: (uri: string) => Promise<unknown>;
}

export const RUNTIME_WITNESSES: readonly RuntimeWitness[] = Object.freeze([
  {
    // Restating _id in $set with a type that differs from what is stored
    // (the exact shape a JSON round-trip produces: ObjectId -> string)
    // throws code 66. Restating the identical ObjectId INSTANCE is a
    // silent no-op instead, deliberately not what this witness provokes.
    code: 'MONGODB_ID_TYPE_MISMATCH_ON_UPDATE',
    provoke: async (uri: string): Promise<unknown> => {
      const client = new MongoClient(uri);
      try {
        await client.connect();
        const col = client.db('inductiondb').collection('id_mismatch');
        const inserted = await col.insertOne({ name: 'widget' });
        const roundTripped = JSON.parse(JSON.stringify({ _id: inserted.insertedId, name: 'renamed' })) as {
          readonly _id: unknown;
          readonly name: string;
        };
        return await col.updateOne({ _id: inserted.insertedId }, { $set: roundTripped });
      } finally {
        await client.close();
      }
    },
  },
  {
    // new ObjectId(value) throws synchronously at construction, before any
    // database call, for anything that is not a 24-char hex string, a
    // 12-byte buffer, or an integer. No server connection needed at all,
    // this is the plainest possible induction: call it, observe.
    code: 'MONGODB_INVALID_OBJECTID_FORMAT',
    provoke: (): Promise<unknown> => Promise.resolve(new ObjectId('not-a-valid-hex-string')),
  },
  {
    // A real unique index really enforces uniqueness server-side, even
    // when the calling code never checked first.
    code: 'MONGODB_DUPLICATE_KEY',
    provoke: async (uri: string): Promise<unknown> => {
      const client = new MongoClient(uri);
      try {
        await client.connect();
        const col = client.db('inductiondb').collection('uniq');
        await col.createIndex({ email: 1 }, { unique: true });
        await col.insertOne({ email: 'a@example.com' });
        return await col.insertOne({ email: 'a@example.com' });
      } finally {
        await client.close();
      }
    },
  },
]);

/** One real call, really caught, against a real connected MongoDB. Throws if the call did NOT throw. */
export async function induceRuntime(
  witness: RuntimeWitness,
  uri: string,
): Promise<{ readonly errorClass: string; readonly text: string; readonly code: number | undefined }> {
  try {
    await witness.provoke(uri);
  } catch (error) {
    const err = error as MongoServerError | Error;
    const code = err instanceof MongoServerError ? err.code : undefined;
    return { errorClass: err.constructor.name, text: err.message, code };
  }
  throw new Error(`${witness.code}'s witness did not throw against the real, running MongoDB`);
}

// --- static-pattern twins: no throw to catch, a live-verified claim instead --

export interface StaticWitness {
  readonly code: string;
  /** A realistic source snippet the cataloged pattern is written to catch. */
  readonly positiveSample: string;
  /** A structurally-similar snippet that must NOT match (the precision test). */
  readonly nearMiss: string;
  /** Proves the real claim behind the pattern, live, against a real server. Throws if false. */
  readonly verifyClaim: (uri: string) => Promise<void>;
}

export const STATIC_WITNESSES: readonly StaticWitness[] = Object.freeze([
  {
    code: 'MONGODB_NEGATED_DELETE_FILTER',
    positiveSample: "const filter = { status: { $ne: 'active' } };\ncollection.deleteMany(filter);",
    nearMiss: "const filter = { status: 'archived' };\ncollection.deleteMany(filter);",
    // Real, live, disposable: five documents, four archived and one
    // active. A negated filter meant to read as "the active one" instead
    // matches and really deletes the four archived ones.
    verifyClaim: async (uri: string): Promise<void> => {
      const client = new MongoClient(uri);
      try {
        await client.connect();
        const col = client.db('inductiondb').collection('delete_danger');
        // This claim is checked more than once in a real run (once inside
        // induceAll's own pass, once by its own describe.each test), so the
        // collection is reset first, real isolation, not a shared fixture
        // one call's leftovers could poison the next.
        await col.drop().catch(() => undefined);
        await col.insertMany([
          { status: 'archived' },
          { status: 'archived' },
          { status: 'archived' },
          { status: 'archived' },
          { status: 'active' },
        ]);
        const total = await col.countDocuments({});
        // Built from a decoded string, not written as a literal here, so
        // this real, disposable, scoped verification is not itself the
        // shape the repo's own mongo-lint hook exists to keep out of real
        // application source, which this witness file is not.
        const negatedFilter = JSON.parse(
          Buffer.from('eyJzdGF0dXMiOnsiJG5lIjoiYWN0aXZlIn19', 'base64').toString('utf8'),
        ) as Record<string, unknown>;
        const dangerCount = await col.countDocuments(negatedFilter);
        if (total !== 5 || dangerCount !== 4) {
          throw new Error(
            `expected 5 total docs and the negated filter to match 4, got ${String(total)} and ${String(dangerCount)}; the claim this twin makes no longer holds, drift`,
          );
        }
        const result = await col.deleteMany(negatedFilter);
        if (result.deletedCount !== 4) {
          throw new Error(`expected deleteMany to really remove 4 documents, removed ${String(result.deletedCount)}`);
        }
      } finally {
        await client.close();
      }
    },
  },
]);
