import * as THREE from "three";
import { Scene } from "../types/extended-threejs-types/scene.type";

export interface LocationInterface {
  scene: Scene;
  sceneObjects: THREE.Object3D[];

  isLocationAlive: boolean;

  init(): void;
  destroy(): void;
}
