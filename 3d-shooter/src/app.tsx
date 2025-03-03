import Player from "./components/Player/Player";
import { World } from "./components/World/World";
import { Location1 } from "./scenes/Location-1/Location-1";
import { GlobalStateService } from "./services/global-state/global-state.service";

const gameScene = new World();
gameScene.init();

const scene = gameScene.scene;
const camera = gameScene.camera;

const location1 = new Location1(scene);
location1.init();

const player = new Player(camera, scene);
gameScene.addAction('player-control', player.control);

gameScene.addAction('light-follow-player', () => {
  location1.light.directionalLight.position.set(
    player.mesh.position.x + location1.light.config.position.x,
    player.mesh.position.y + location1.light.config.position.y,
    player.mesh.position.z + location1.light.config.position.z
  );

  location1.light.directionalLight.target.position.set(
    player.mesh.position.x,
    player.mesh.position.y,
    player.mesh.position.z
  );
  location1.light.directionalLight.target.updateMatrixWorld();
});

// load player position and rotation
player.loadPosition();

// save player position and rotation
window.addEventListener('beforeunload', () => {
  player.savePosition();
});

GlobalStateService.set('player', player);
GlobalStateService.set('location1', location1);
GlobalStateService.set('scene', scene);
GlobalStateService.set('camera', camera);

function App() {
  return <></>
}

export default App;
