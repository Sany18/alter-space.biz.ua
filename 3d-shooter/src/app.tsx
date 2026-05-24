import Player from "./components/Player/Player";
import { World } from "./components/World/World";
import { Location1 } from "./scenes/Location-1/Location-1";
import { GlobalStateService } from "./services/global-state/global-state.service";
import { WsService } from "./services/ws/ws.service";
import { mountMainMenu } from "./components/MainMenu/MainMenu";
import { RemotePlayersService } from "./services/remote-players/remote-players.service";
import { PhysicsAuthorityService } from "./services/physics-authority/physics-authority.service";
import { AppConfig } from "./config";

const f7 = (n: number) => n.toPrecision(7);

const gameScene = new World();
gameScene.init();

const scene = gameScene.scene;
const camera = gameScene.camera;

const location1 = new Location1(scene);
location1.init();

const player = new Player(camera, scene);
gameScene.addAction('player-control', player.control);

PhysicsAuthorityService.init();
PhysicsAuthorityService.registerPlayerBody(player.cannonBody);
gameScene.addAction('physics-authority', () => PhysicsAuthorityService.update());

// CSM automatically repositions shadow frusta based on the camera each frame
gameScene.addAction('direct-light', () => {
  location1.light.update();
});

// save player position and rotation
window.addEventListener('beforeunload', () => {
  player.savePosition();
});

GlobalStateService.set('player', player);
GlobalStateService.set('location1', location1);
GlobalStateService.set('scene', scene);
GlobalStateService.set('camera', camera);

mountMainMenu();
WsService.connect();

RemotePlayersService.init(scene);
gameScene.addAction('remote-players-tick', () => RemotePlayersService.tick());

WsService.on('player_update', (msg: any) => {
  const isSelf = msg.id === WsService.socketId;

  if (!isSelf) {
    if (msg.state?.deleted) {
      RemotePlayersService.remove(msg.id);
      PhysicsAuthorityService.onPlayerLeave(msg.id);
    } else {
      RemotePlayersService.update(msg.id, msg.state);
    }
  }
});

// Send player position and rotation to the server at a fixed rate.
// When the tab is hidden, throttle to 1 update/s to save bandwidth.
let lastPlayerUpdateTime = 0;
setInterval(() => {
  // Unfocused tab skips updates. Only one per second.
  const minInterval = document.hasFocus() ? 1000 / AppConfig.playerUpdateRate : 1000;
  const now = Date.now();
  if (now - lastPlayerUpdateTime < minInterval) return;
  lastPlayerUpdateTime = now;
  // =====

  const { x, y, z } = player.cannonBody.position;
  const q = player.cannonBody.quaternion;

  WsService.sendRaw(
    `pu,${f7(x)},${f7(y)},${f7(z)},${f7(q.x)},${f7(q.y)},${f7(q.z)},${f7(q.w)},${player.crouch ? 1 : 0},${f7(player.eulerX.x)}`
  );
}, 1000 / AppConfig.playerUpdateRate);

function App() {
  return <></>
}

export default App;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.location.reload();
  });
}
