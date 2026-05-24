import * as CANNON from 'cannon-es';
import { WsService } from '../ws/ws.service';
import { GlobalStateService } from '../global-state/global-state.service';

const OBJECT_UPDATE_HZ = 20;
const SLEEP_VELOCITY_THRESHOLD = 0.05;
const SLEEP_AFTER_MS = 600;

const f7 = (n: number) => n.toPrecision(7);

interface ReceivedState {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  velocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
}

class PhysicsAuthorityServiceClass {
  private dynamicBodies = new Map<number, CANNON.Body>();

  private serverId: string | null = null;
  /** objectOwners: object id → client id who is currently simulating it. Empty string = unowned (server's). */
  private objectOwners = new Map<number, string>();
  private receivedStates = new Map<number, ReceivedState>();
  private stoppedSince = new Map<number, number>();

  private lastSendTime = 0;

  get isServer(): boolean {
    return !!this.serverId && this.serverId === WsService.socketId;
  }

  private isAuthoritativeFor(id: number): boolean {
    const owner = this.objectOwners.get(id) ?? '';
    if (owner === '') return this.isServer;
    return owner === WsService.socketId;
  }

  init() {
    WsService.on('server_role', (msg: any) => {
      this.serverId = msg.serverId ?? null;
      GlobalStateService.set('isPhysicsServer', this.isServer);
      this.reapplyAuthority();
    });

    WsService.on('object_release', (msg: any) => {
      const id = msg.id as number;
      this.objectOwners.delete(id);
      this.reapplyAuthority(); // server client takes over unowned objects
    });

    WsService.on('object_update', (msg: any) => {
      const id = msg.id as number;
      this.objectOwners.set(id, msg.ownerId as string);

      if (this.isAuthoritativeFor(id)) return; // we own it, ignore remote

      this.receivedStates.set(id, {
        position: msg.position,
        quaternion: msg.quaternion,
        velocity: msg.velocity,
        angularVelocity: msg.angularVelocity,
      });

      // Make non-authoritative body kinematic
      const body = this.dynamicBodies.get(id);
      if (body && body.type !== CANNON.Body.KINEMATIC) {
        body.type = CANNON.Body.KINEMATIC;
        body.velocity.setZero();
        body.angularVelocity.setZero();
      }
    });
  }

  registerBody(id: number, body: CANNON.Body) {
    this.dynamicBodies.set(id, body);
  }

  registerPlayerBody(body: CANNON.Body) {
    this.playerBody = body;
    body.addEventListener('collide', (e: any) => {
      const hit = e.body as CANNON.Body;
      for (const [id, boxBody] of this.dynamicBodies) {
        if (boxBody === hit) {
          this.claimOwnership(id);
          break;
        }
      }
    });
  }

  onPlayerLeave(id: string) {
    for (const [objId, ownerId] of this.objectOwners) {
      if (ownerId === id) {
        this.objectOwners.delete(objId);
      }
    }
    // After clearing, reapplyAuthority so the server picks up unowned objects
    this.reapplyAuthority();
  }

  private claimOwnership(id: number) {
    if (this.objectOwners.get(id) === WsService.socketId) return;
    this.objectOwners.set(id, WsService.socketId);
    this.activateBody(id);
  }

  private activateBody(id: number) {
    const body = this.dynamicBodies.get(id);
    if (!body) return;
    // Restore last known velocity so the simulation continues from the actual moving state
    const last = this.receivedStates.get(id);
    if (last) {
      body.position.set(last.position.x, last.position.y, last.position.z);
      body.quaternion.set(last.quaternion.x, last.quaternion.y, last.quaternion.z, last.quaternion.w);
      body.velocity.set(last.velocity.x, last.velocity.y, last.velocity.z);
      body.angularVelocity.set(last.angularVelocity.x, last.angularVelocity.y, last.angularVelocity.z);
    }
    body.type = CANNON.Body.DYNAMIC;
    body.wakeUp();
  }

  private reapplyAuthority() {
    for (const [id, body] of this.dynamicBodies) {
      if (this.isAuthoritativeFor(id)) {
        if (body.type !== CANNON.Body.DYNAMIC) {
          this.activateBody(id);
        }
      }
      // Non-authoritative bodies stay kinematic until first object_update arrives
    }
  }

  /** Call once per animation frame. */
  update() {
    // Apply received states to non-authoritative (kinematic) bodies
    for (const [id, state] of this.receivedStates) {
      if (this.isAuthoritativeFor(id)) continue;
      const body = this.dynamicBodies.get(id);
      if (!body) continue;
      body.position.set(state.position.x, state.position.y, state.position.z);
      body.quaternion.set(state.quaternion.x, state.quaternion.y, state.quaternion.z, state.quaternion.w);
      // For kinematic bodies, velocity drives movement each step — zero it so they stay put
      body.velocity.setZero();
      body.angularVelocity.setZero();
    }

    const now = Date.now();
    if (now - this.lastSendTime < 1000 / OBJECT_UPDATE_HZ) return;
    this.lastSendTime = now;

    // Broadcast state for every object this client is authoritative over
    for (const [id, body] of this.dynamicBodies) {
      if (!this.isAuthoritativeFor(id)) continue;

      // Skip bodies cannon has already put to sleep — no state change to broadcast.
      // Wake them up first if we just became authoritative (activateBody handles that).
      if (body.sleepState === CANNON.Body.SLEEPING) continue;

      const speed = body.velocity.length() + body.angularVelocity.length();

      // Track when the object comes to rest
      if (speed < SLEEP_VELOCITY_THRESHOLD) {
        if (!this.stoppedSince.has(id)) this.stoppedSince.set(id, now);
        const stoppedFor = now - this.stoppedSince.get(id)!;
        if (stoppedFor > SLEEP_AFTER_MS) {
          if (!this.isServer && this.objectOwners.get(id) === WsService.socketId) {
            // Non-server owner releases ownership once object has stopped
            // Save current state so the body stays put while waiting for server updates
            this.receivedStates.set(id, {
              position: { x: body.position.x, y: body.position.y, z: body.position.z },
              quaternion: { x: body.quaternion.x, y: body.quaternion.y, z: body.quaternion.z, w: body.quaternion.w },
              velocity: { x: body.velocity.x, y: body.velocity.y, z: body.velocity.z },
              angularVelocity: { x: body.angularVelocity.x, y: body.angularVelocity.y, z: body.angularVelocity.z },
            });
            this.objectOwners.delete(id);
            WsService.sendRaw(`or,${id}`);
          }
          // Both server and non-server skip broadcasting idle objects
          continue;
        }
      } else {
        this.stoppedSince.delete(id);
      }

      WsService.sendRaw(
        `ou,${id},${f7(body.position.x)},${f7(body.position.y)},${f7(body.position.z)},` +
        `${f7(body.quaternion.x)},${f7(body.quaternion.y)},${f7(body.quaternion.z)},${f7(body.quaternion.w)},` +
        `${f7(body.velocity.x)},${f7(body.velocity.y)},${f7(body.velocity.z)},` +
        `${f7(body.angularVelocity.x)},${f7(body.angularVelocity.y)},${f7(body.angularVelocity.z)}`
      );
    }
  }
}

export const PhysicsAuthorityService = new PhysicsAuthorityServiceClass();
