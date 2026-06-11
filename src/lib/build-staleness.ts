import type { DbDCharacter, DbDPerk, SavedBuild } from '../types';

export type BuildStalenessIssueType =
  | 'perk_removed'
  | 'perk_description_changed'
  | 'perk_renamed'
  | 'character_removed'
  | 'patch_updated';

export interface BuildStalenessIssue {
  type: BuildStalenessIssueType;
  perkId?: string;
  perkName?: string;
  detail: string;
}

export interface SavedBuildValidation {
  buildId: string;
  needsReview: boolean;
  issues: BuildStalenessIssue[];
}

function normalizeDesc(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function perkById(perks: DbDPerk[], id: string): DbDPerk | undefined {
  return perks.find((p) => p.id === id);
}

export function validateSavedBuild(
  saved: SavedBuild,
  perks: DbDPerk[],
  characters: DbDCharacter[],
  gameVersion: string,
): SavedBuildValidation {
  const issues: BuildStalenessIssue[] = [];
  const rolePerks = perks.filter((p) => p.role === saved.role);

  for (const buildPerk of saved.build.perks) {
    const live = perkById(rolePerks, buildPerk.id) ?? perkById(perks, buildPerk.id);
    if (!live) {
      issues.push({
        type: 'perk_removed',
        perkId: buildPerk.id,
        perkName: buildPerk.name,
        detail: `${buildPerk.name} is no longer in the game data.`,
      });
      continue;
    }

    if (live.name.toLowerCase() !== buildPerk.name.toLowerCase()) {
      issues.push({
        type: 'perk_renamed',
        perkId: buildPerk.id,
        perkName: live.name,
        detail: `Renamed from "${buildPerk.name}" to "${live.name}".`,
      });
    }

    const savedDesc = normalizeDesc(buildPerk.description);
    const liveDesc = normalizeDesc(live.description);
    if (savedDesc && liveDesc && savedDesc !== liveDesc) {
      issues.push({
        type: 'perk_description_changed',
        perkId: buildPerk.id,
        perkName: live.name,
        detail: `${live.name} was updated in a recent patch.`,
      });
    }
  }

  if (saved.characterId && !characters.some((c) => c.id === saved.characterId)) {
    issues.push({
      type: 'character_removed',
      detail: `${saved.characterName ?? 'Linked character'} is no longer in the roster.`,
    });
  }

  const impactful = issues.some((i) => i.type !== 'patch_updated');
  if (
    saved.savedAtGameVersion &&
    saved.savedAtGameVersion !== gameVersion &&
    gameVersion !== 'unknown'
  ) {
    issues.push({
      type: 'patch_updated',
      detail: `Saved on patch ${saved.savedAtGameVersion}; current data is patch ${gameVersion}.`,
    });
  }

  return {
    buildId: saved.id,
    needsReview: impactful,
    issues,
  };
}

export function validateSavedBuilds(
  builds: SavedBuild[],
  perks: DbDPerk[],
  characters: DbDCharacter[],
  gameVersion: string,
): Map<string, SavedBuildValidation> {
  const map = new Map<string, SavedBuildValidation>();
  for (const build of builds) {
    map.set(build.id, validateSavedBuild(build, perks, characters, gameVersion));
  }
  return map;
}

export function summarizeBuildIssues(validation: SavedBuildValidation): string {
  if (validation.issues.length === 0) return '';
  const headline = validation.needsReview
    ? 'This build may be outdated'
    : 'Saved on an older patch';
  const details = validation.issues.map((i) => i.detail).join(' ');
  return `${headline}: ${details}`;
}
