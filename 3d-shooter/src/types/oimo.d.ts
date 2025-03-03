declare module 'oimo' {
  export class World {
    constructor(config: any);
    public add(obj: WorldAddParams): OIMO.RigidBody;
    public remove(obj: any): void;
    public step(): void;
  }

  export class RigidBody {
    constructor(config: any);

    isStatic: boolean;
    numContacts: number;

    public setPosition(x: number, y: number, z: number): void;
    public setQuaternion(x: number, y: number, z: number, w: number): void;
    public getPosition(): any;
    public getQuaternion(): any;
    public addForce(x: number, y: number, z: number): void;
    public addTorque(x: number, y: number, z: number): void;
  }

  export class Shape {
    constructor(config: any);
  }

  export class SphereShape extends Shape {
    constructor(config: any);
  }

  export class BoxShape extends Shape {
    constructor(config: any);
  }

  export class CylinderShape extends Shape {
    constructor(config: any);
  }
}

type XYZ = number[];

type WorldAddParams = {
  type?: 'sphere' | 'box' | 'cylinder'
  size?: XYZ
  pos?: XYZ,
  rot?: XYZ,
  move?: boolean,
  density?: number,
  noSleep?: boolean,
  friction?: number,
  restitution?: number,
  belongsTo?: number, // The bits of the collision groups to which the shape belongs.
  collidesWith?: number
}
