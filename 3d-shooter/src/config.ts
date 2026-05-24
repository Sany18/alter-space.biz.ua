export const AppConfig = {
  /** How many times per second the local player position is broadcast to the server. */
  playerUpdateRate: 60,

  /**
   * Milliseconds of silence after which a remote player is removed from the scene.
   * Must be well above 60 000 ms: Chrome's Intensive Timer Throttling (tab hidden
   * 5+ min) clamps setInterval to ~1 per minute, so updates can arrive 60 s apart.
   * Normal disconnects are already handled by the server's `player_leave` message,
   * so this timeout only catches abnormal / network-cut disconnects.
   */
  remotePlayerTimeoutMs: 90_000,
};
