import type { AnatomicalRegionId, AnatomicalRegionState, AnatomicalStatus } from "../types";

/**
 * Resolves 3D mesh node names to standard semantic AnatomicalRegionIds.
 */
export function resolveSemanticId(rawName: string): AnatomicalRegionId | null {
  if (!rawName) return null;
  const name = rawName.toLowerCase();

  if (
    name.includes("heart") ||
    name.includes("myocardi") ||
    name.includes("ventricle") ||
    name.includes("atrium")
  ) {
    return "organ_heart";
  }
  if (name.includes("lung") || name.includes("pulmon") || name.includes("bronch")) {
    return "organ_lungs";
  }
  if (
    name.includes("brain") ||
    name.includes("cerebr") ||
    name.includes("cerebell") ||
    name.includes("encephalon")
  ) {
    return "organ_brain";
  }
  if (name.includes("liver") || name.includes("hepat")) {
    return "organ_liver";
  }
  if (name.includes("stomach") || name.includes("gastric")) {
    return "organ_stomach";
  }
  if (name.includes("pancreas") || name.includes("pancreat")) {
    return "organ_pancreas";
  }
  if (name.includes("spleen") || name.includes("splen") || name.includes("lien")) {
    return "organ_spleen";
  }
  if (name.includes("kidney") || name.includes("renal") || name.includes("nephr")) {
    return "organ_kidneys";
  }
  if (name.includes("bladder") || name.includes("vesic")) {
    return "organ_bladder";
  }
  if (
    name.includes("skull") ||
    name.includes("cranium") ||
    name.includes("frontal bone") ||
    name.includes("parietal") ||
    name.includes("occipital") ||
    name.includes("mandible")
  ) {
    return "bone_skull";
  }
  if (
    name.includes("vertebra") ||
    name.includes("spine") ||
    name.includes("cervical") ||
    name.includes("thoracic") ||
    name.includes("lumbar") ||
    name.includes("coccyx")
  ) {
    return "bone_spine";
  }
  if (
    name.includes("rib") ||
    name.includes("sternum") ||
    name.includes("costal") ||
    name.includes("thorax")
  ) {
    return "bone_ribcage";
  }
  if (
    name.includes("pelvis") ||
    name.includes("pelvic") ||
    name.includes("ilium") ||
    name.includes("sacrum")
  ) {
    return "bone_pelvis";
  }
  if (
    name.includes("femur") ||
    name.includes("humerus") ||
    name.includes("radius") ||
    name.includes("tibia") ||
    name.includes("fibula") ||
    name.includes("skeleton of upper") ||
    name.includes("skeleton of lower")
  ) {
    return "bone_limbs";
  }
  if (
    name.includes("muscle") ||
    name.includes("pectoral") ||
    name.includes("deltoid") ||
    name.includes("gluteus")
  ) {
    return "muscle_system";
  }
  if (
    name.includes("shell") ||
    name.includes("skin") ||
    name.includes("body") ||
    name.includes("human")
  ) {
    return "body_shell";
  }

  return null;
}

/**
 * Computes high-level distribution of body statuses.
 */
export function getStatusSummary(regionStates: Record<AnatomicalRegionId, AnatomicalRegionState>) {
  const counts: Record<AnatomicalStatus, number> = {
    NO_DATA: 0,
    STABLE: 0,
    ATTENTION: 0,
    REVIEW_REQUIRED: 0,
  };

  Object.values(regionStates).forEach((region) => {
    if (region.id !== "body_shell") {
      counts[region.status] += 1;
    }
  });

  return counts;
}

/**
 * Returns prioritized regions that need user review or attention.
 */
export function getPrioritizedRegions(
  regionStates: Record<AnatomicalRegionId, AnatomicalRegionState>,
): AnatomicalRegionState[] {
  const regions = Object.values(regionStates).filter((r) => r.id !== "body_shell" && r.hasData);
  const priorityOrder: Record<AnatomicalStatus, number> = {
    REVIEW_REQUIRED: 1,
    ATTENTION: 2,
    STABLE: 3,
    NO_DATA: 4,
  };

  return regions.sort((a, b) => priorityOrder[a.status] - priorityOrder[b.status]);
}
