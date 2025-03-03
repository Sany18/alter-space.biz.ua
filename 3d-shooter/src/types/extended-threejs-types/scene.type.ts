import * as THREE from 'three';

export type Scene = THREE.Scene & {
  cannonWorld?: any
  cannonDebugger?: any
};
