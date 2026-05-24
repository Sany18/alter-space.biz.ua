import Player from "./components/Player/Player";
import { World } from "./components/World/World";
import { Location1 } from "./scenes/Location-1/Location-1";
import { GlobalStateService } from "./services/global-state/global-state.service";
import { WsService } from "./services/ws/ws.service";
import { mountMainMenu } from "./components/MainMenu/MainMenu";
import { RemotePlayersService } from "./services/remote-players/remote-players.service";
import { PhysicsAuthorityService } from "./services/physics-authority/physics-authority.service";
import { AppConfig } from "./config";

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

WsService.on('player_update', (msg: any) => {
  const isSelf = msg.id === WsService.socketId;
  console.log(`[player_update] from=${msg.id} | mySocket=${WsService.socketId} | isSelf=${isSelf}`);
  if (!isSelf) {
    RemotePlayersService.update(msg.id, msg.state);
  }
});

WsService.on('player_leave', (msg: any) => {
  RemotePlayersService.remove(msg.id);
  PhysicsAuthorityService.onPlayerLeave(msg.id);
});

// Send player position and rotation to the server at a fixed rate
setInterval(() => {
  const { x, y, z } = player.cannonBody.position;
  const q = player.cannonBody.quaternion;
  WsService.send({
    type: 'player_update',
    state: { position: { x, y, z }, rotation: { x: q.x, y: q.y, z: q.z, w: q.w }, crouching: player.crouch },
  });
}, 1000 / AppConfig.playerUpdateRate);

setInterval(() => RemotePlayersService.cleanup(), 1000);

function App() {
  return <></>
}

export default App;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.location.reload();
  });
}
