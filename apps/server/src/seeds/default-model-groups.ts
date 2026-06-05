import { randomUUID } from "crypto";
import type { DataSource } from "typeorm";

type ModelGroupSeed = {
  alias: string;
  displayName: string;
  description: string;
  stickySessionTtlSeconds: number;
  tags: string[];
  requireFree?: boolean;
};

const DEFAULT_GROUPS: ModelGroupSeed[] = [
  {
    alias: "chat-default",
    displayName: "Chat default",
    description: "Balanced default OpenAI-compatible chat route.",
    stickySessionTtlSeconds: 86_400,
    tags: ["fallback", "coding", "free"],
  },
  {
    alias: "coding",
    displayName: "Coding",
    description: "Models suitable for code generation and debugging.",
    stickySessionTtlSeconds: 86_400,
    tags: ["coding"],
  },
  {
    alias: "free-coding",
    displayName: "Free coding",
    description: "Free-tier coding models only.",
    stickySessionTtlSeconds: 86_400,
    tags: ["coding", "free"],
    requireFree: true,
  },
  {
    alias: "reasoning",
    displayName: "Reasoning",
    description: "Reasoning-oriented models.",
    stickySessionTtlSeconds: 86_400,
    tags: ["reasoning"],
  },
  {
    alias: "cheap",
    displayName: "Cheap",
    description: "Lowest-cost models, preferring verified cheap/free pricing.",
    stickySessionTtlSeconds: 86_400,
    tags: ["cheap", "free"],
  },
  {
    alias: "fallback",
    displayName: "Fallback",
    description: "Broad fallback pool for resilient routing.",
    stickySessionTtlSeconds: 43_200,
    tags: ["fallback", "free"],
  },
];

type RowWithId = { id: string };
type CandidateModel = { id: string; isFree: number; tagsJson: string };

function modelMatchesGroup(model: CandidateModel, group: ModelGroupSeed): boolean {
  const tags = JSON.parse(model.tagsJson) as string[];
  if (group.requireFree && model.isFree !== 1) {
    return false;
  }
  return group.tags.some((tag) => tags.includes(tag));
}

async function upsertGroup(dataSource: DataSource, group: ModelGroupSeed): Promise<string> {
  const existing = (await dataSource.query("select id from model_groups where teamId is null and alias = ?", [
    group.alias,
  ])) as RowWithId[];
  const existingGroup = existing[0];
  if (existingGroup) {
    await dataSource.query(
      `update model_groups
       set displayName = ?, description = ?, policyJson = ?, stickySessionTtlSeconds = ?, isEnabled = 1, updatedAt = CURRENT_TIMESTAMP
       where id = ?`,
      [
        group.displayName,
        group.description,
        JSON.stringify({ strategy: "priority_weighted", requireFree: group.requireFree ?? false, tags: group.tags }),
        group.stickySessionTtlSeconds,
        existingGroup.id,
      ],
    );
    return existingGroup.id;
  }

  const id = randomUUID();
  await dataSource.query(
    `insert into model_groups (id, teamId, alias, displayName, description, policyJson, stickySessionTtlSeconds, isEnabled)
     values (?, null, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      group.alias,
      group.displayName,
      group.description,
      JSON.stringify({ strategy: "priority_weighted", requireFree: group.requireFree ?? false, tags: group.tags }),
      group.stickySessionTtlSeconds,
    ],
  );
  return id;
}

export async function seedDefaultModelGroups(dataSource: DataSource): Promise<void> {
  const models = (await dataSource.query(
    "select id, isFree, tagsJson from provider_models where isEnabled = 1 and endpointType = 'openai_chat_completions'",
  )) as CandidateModel[];

  for (const group of DEFAULT_GROUPS) {
    const groupId = await upsertGroup(dataSource, group);
    await dataSource.query("delete from model_group_candidates where modelGroupId = ?", [groupId]);
    const candidates = models.filter((model) => modelMatchesGroup(model, group));
    let priority = 10;
    for (const candidate of candidates) {
      await dataSource.query(
        `insert into model_group_candidates (id, modelGroupId, providerModelId, priority, weight, isEnabled, constraintsJson)
         values (?, ?, ?, ?, ?, 1, ?)`,
        [
          randomUUID(),
          groupId,
          candidate.id,
          priority,
          candidate.isFree === 1 ? 10 : 1,
          JSON.stringify({ requireFree: group.requireFree ?? false }),
        ],
      );
      priority += 10;
    }
  }
}
