import Player from "./components/Player/Player";
import { World } from "./components/World/World";
import { Location1 } from "./scenes/Location-1/Location-1";
import { GlobalStateService } from "./services/global-state/global-state.service";
import { WsService } from "./services/ws/ws.service";
import { mountMainMenu, unmountMainMenu } from "./components/MainMenu/MainMenu";

const gameScene = new World();
gameScene.init();

const scene = gameScene.scene;
const camera = gameScene.camera;

const location1 = new Location1(scene);
location1.init();

const player = new Player(camera, scene);
gameScene.addAction('player-control', player.control);

// CSM automatically repositions shadow frusta based on the camera each frame
gameScene.addAction('csm-update', () => {
  location1.light.update();
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

mountMainMenu();
WsService.connect();

function App() {
  return <></>
}

export default App;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    gameScene.destroy();
    location1.destroy();
    player.removeEventListeners();
    document.getElementById('side-menu')?.remove();
    unmountMainMenu();
    WsService.disconnect();
  });
}
