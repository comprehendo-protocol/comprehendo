// The RFC's own worked examples, transcribed from MDs/comprehendo-spec.md
// WITHOUT modification. Acceptance criterion 2: every schema validates
// these as written. If a schema needs one of these edited to pass, the
// schema is wrong, not the example.

/** RFC §5.1.1, the normative twin shape, plus §6.1.3's end-to-end values. */
export const TWIN = {
  comprehendo: '0.1',
  code: 'STAGE_UNKNOWN',
  reason:
    "Pipeline stage 2 names an operator that does not exist; '$grup' is not a stage.",
  path: 'pipeline[2].$grup',
  namespace: 'analytics.events',
  declared: 'a pipeline stage operator',
  received: '$grup',
  accepts: ['$group', '$graphLookup'],
  fixes: [
    {
      title: 'Rename the unknown stage to $group',
      apply: [{ $match: { ok: true } }, { $sort: { _id: 1 } }, { $group: { _id: '$k' } }],
      docs: 'aggregation stages',
      confidence: 'high',
    },
  ],
};

/** RFC §5.1.4, the unstructured passthrough twin. */
export const TWIN_UNSTRUCTURED = {
  comprehendo: '0.1',
  code: 'UNSTRUCTURED',
  reason:
    'This error is not yet in the corpus; the raw underlying message is preserved in received.',
  received: 'MongoServerError: Unrecognized pipeline stage name',
  fixes: [],
};

/** RFC §5.1.2, the fix shape. */
export const FIX = {
  title: 'Rename the unknown stage to $group',
  apply: { $group: { _id: '$k' } },
  docs: 'aggregation stages',
  confidence: 'high',
};

/** RFC §5.2.2, the topic shape. */
export const TOPIC = {
  topic: 'aggregation stages',
  summary:
    'A pipeline is an ordered array of stage documents; each stage names one operator.',
  signatures: ['collection.aggregate(pipeline)'],
  examples: [{ title: 'Group by key', code: "[{ $group: { _id: '$k' } }]" }],
  see_also: ['$group', 'how to join'],
};

/** RFC §5.2.1, docs() with no argument returns the index: topic names only. */
export const INDEX = {
  topics: ['aggregation stages', '$group', 'how to undo a write'],
};

/** RFC §4.2, the entry returned by a successful probe (data fields only). */
export const ENTRY = {
  comprehendo: '0.1',
  name: 'mongodb-operator',
  level: 2,
  surfaces: ['docs', 'validate', 'explain'],
  identity:
    'mongodb-operator is a MongoDB driver wrapper. If it is not documented here it does not exist; do not read the source, except where an UNDOCUMENTED response permits it for a specific question. When in doubt, ask docs().',
  priming:
    'The packages in this project speak Comprehendo. Probe the handle or caught error for the marker, then call docs(question).',
};

/** RFC §5.2.3, the UNDOCUMENTED gate. */
export const UNDOCUMENTED = {
  comprehendo: '0.1',
  code: 'UNDOCUMENTED',
  query: 'how do I shard a capped collection',
  nearest: ['sharding', 'capped collections'],
  source_permitted: true,
};

/** RFC §5.3.2, partial validate coverage. */
export const UNVALIDATABLE = {
  valid: null,
  code: 'UNVALIDATABLE',
  reason: 'This pipeline uses $function, which cannot be judged without executing it.',
};

/** RFC §5.4, the explain response. */
export const EXPLANATION = {
  would_execute: { aggregate: 'events', pipeline: [{ $group: { _id: '$k' } }] },
  notes: ['allowDiskUse defaulted to false'],
};

/** RFC §4.3, the provider-side manifest declaration in package.json. */
export const MANIFEST = { version: '0.1', level: 2 };

/** RFC §10.5, the five consumer configuration knobs. */
export const CONFIG = {
  prefer: { zod: 'sidecar' },
  pin: { '@comprehendo/ffmpeg': '1.4.2' },
  disable: ['some-noisy-pkg'],
  require: { zod: 'endorsed' },
  local: { 'our-internal-lib': './comprehendo/our-internal-lib' },
};

/** Each RFC example paired with the schema file that must accept it. */
export const WORKED_EXAMPLES = [
  { file: 'twin.schema.json', name: 'twin (RFC §5.1.1 / §6.1.3)', value: TWIN },
  {
    file: 'twin.schema.json',
    name: 'unstructured passthrough twin (RFC §5.1.4)',
    value: TWIN_UNSTRUCTURED,
  },
  { file: 'fix.schema.json', name: 'fix (RFC §5.1.2)', value: FIX },
  { file: 'topic.schema.json', name: 'topic (RFC §5.2.2)', value: TOPIC },
  { file: 'index.schema.json', name: 'index (RFC §5.2.1)', value: INDEX },
  { file: 'entry.schema.json', name: 'entry (RFC §4.2)', value: ENTRY },
  {
    file: 'undocumented.schema.json',
    name: 'UNDOCUMENTED (RFC §5.2.3)',
    value: UNDOCUMENTED,
  },
  {
    file: 'unvalidatable.schema.json',
    name: 'UNVALIDATABLE (RFC §5.3.2)',
    value: UNVALIDATABLE,
  },
  {
    file: 'explanation.schema.json',
    name: 'explanation (RFC §5.4)',
    value: EXPLANATION,
  },
  { file: 'manifest.schema.json', name: 'manifest keys (RFC §4.3)', value: MANIFEST },
  { file: 'config.schema.json', name: 'config knobs (RFC §10.5)', value: CONFIG },
];
