import { RemotePlayer, RemotePlayerState } from '../../components/RemotePlayer/RemotePlayer';
import { Scene } from '../../types/extended-threejs-types/scene.type';

class RemotePlayersServiceClass {
  private players = new Map<string, RemotePlayer>();
  private scene: Scene | null = null;

  init(scene: Scene) {
    this.scene = scene;
  }

  update(id: string, state: RemotePlayerState) {
    if (!this.scene) return;
    const existing = this.players.get(id);
    if (existing) {
      existing.update(state);
    } else {
      const player = new RemotePlayer(this.scene);
      player.update(state);
      this.players.set(id, player);
      console.log(`[RemotePlayers] Player joined: ${id}`);
    }
  }

  tick() {
    for (const player of this.players.values()) {
      player.tick();
    }
  }

  remove(id: string) {
    const player = this.players.get(id);
    if (player) {
      player.destroy();
      this.players.delete(id);
      console.log(`[RemotePlayers] Player left: ${id}`);
    }
  }

  destroyAll() {
    for (const id of [...this.players.keys()]) {
      this.remove(id);
    }
  }
}

export const RemotePlayersService = new RemotePlayersServiceClass();
