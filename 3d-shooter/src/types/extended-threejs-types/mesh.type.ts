import * as THREE from 'three';

import * as CANNON from 'cannon-es';

export type Mesh = THREE.Mesh & {
  cannonBody?: CANNON.Body;
};
