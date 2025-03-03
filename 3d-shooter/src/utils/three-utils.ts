import * as THREE from 'three';

const textures = import.meta.glob('/src/assets/textures/**/*', { eager: true });

export const getTexturePath = (name: string, path: string = '') => {
  const key = `/src/assets/textures/${path ? path + '/' : ''}${name}`;

  if (textures[key]) {
    return (textures[key] as { default: string }).default;
  } else {
    console.error(`Texture not found: ${key}`);
    return '';
  }
};

export const loadTexture = (name: string) => {
  const texturePath = getTexturePath(name);

  return new THREE.TextureLoader().load(
    texturePath,
    (texture) => console.log(`Texture ${name} loaded`),
    undefined,
    (err) => console.error(`Failed to load ${name}:`, err)
  );
};
