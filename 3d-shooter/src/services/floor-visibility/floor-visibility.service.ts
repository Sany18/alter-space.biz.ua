export type TileCoord = [number, number]; // [worldX, worldZ]

/**
 * Computes which floor tile positions (in world-space, snapped to tileSize grid)
 * fall inside a horizontal view cone.
 *
 * The cone is defined in the XZ plane (top-down view):
 *
 *           dirX/dirZ
 *               ^
 *          ___/|\___
 *         /   |   \
 *        /  player \
 *       /____________\
 *
 * Tiles within `footprintRadius` tiles of the player are always included
 * regardless of view direction, so the ground under the player never disappears.
 */
export class FloorVisibilityService {
  /**
   * @param posX        Camera world X
   * @param posZ        Camera world Z
   * @param dirX        Forward direction X (normalised, XZ projection)
   * @param dirZ        Forward direction Z (normalised, XZ projection)
   * @param halfFOV     Half of horizontal FOV in radians
   * @param distance    Max render distance in world units
   * @param tileSize    Floor tile size in world units
   * @param footprintRadius  Tiles always rendered around the player (default 1)
   */
  static getTilesInCone(
    posX: number,
    posZ: number,
    dirX: number,
    dirZ: number,
    halfFOV: number,
    distance: number,
    tileSize: number,
    footprintRadius = 1,
  ): TileCoord[] {
    const cosHalf = Math.cos(halfFOV);
    const dist2 = distance * distance;

    // Snap camera position to nearest tile-grid origin so coverage is symmetric.
    const cx = Math.round(posX / tileSize) * tileSize;
    const cz = Math.round(posZ / tileSize) * tileSize;

    const span = Math.ceil(distance / tileSize) + footprintRadius;

    const result: TileCoord[] = [];

    for (let i = -span; i <= span; i++) {
      for (let j = -span; j <= span; j++) {
        const tx = cx + i * tileSize;
        const tz = cz + j * tileSize;

        // Always include the immediate footprint around the player.
        if (Math.abs(i) <= footprintRadius && Math.abs(j) <= footprintRadius) {
          result.push([tx, tz]);
          continue;
        }

        // Distance check (fast squared comparison).
        const dx = tx - posX;
        const dz = tz - posZ;
        if (dx * dx + dz * dz > dist2) continue;

        // Angle check: dot(normalised tile direction, forward) >= cos(halfFOV).
        const len = Math.sqrt(dx * dx + dz * dz);
        const dot = (dx * dirX + dz * dirZ) / len;
        if (dot >= cosHalf) {
          result.push([tx, tz]);
        }
      }
    }

    return result;
  }
}
