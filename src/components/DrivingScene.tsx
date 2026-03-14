import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { motion } from 'motion/react';

interface DrivingSceneProps {
  speed?: number;
  steering?: number;
  scenarioId?: string;
  backgroundUrl?: string | null;
  onDistanceUpdate?: (dist: number) => void;
}

// Helper to create a car that actually looks like a car
function createCar(): THREE.Group {
  const car = new THREE.Group();
  const bodyColor = 0x2F6DF6;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.7, roughness: 0.25 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x88CCFF, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.35 });

  // Lower body (chassis)
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.35, 4.2),
    bodyMat
  );
  chassis.position.y = 0.42;
  chassis.castShadow = true;
  car.add(chassis);

  // Upper body / cabin base
  const upperBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.3, 3.6),
    bodyMat
  );
  upperBody.position.y = 0.65;
  upperBody.castShadow = true;
  car.add(upperBody);

  // Hood (tapered front)
  const hoodGeo = new THREE.BoxGeometry(1.6, 0.18, 1.3);
  const hood = new THREE.Mesh(hoodGeo, bodyMat);
  hood.position.set(0, 0.68, -1.2);
  hood.rotation.x = -0.08;
  car.add(hood);

  // Trunk (slightly raised rear)
  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.18, 0.9),
    bodyMat
  );
  trunk.position.set(0, 0.68, 1.3);
  trunk.rotation.x = 0.05;
  car.add(trunk);

  // Windshield (angled glass)
  const windshieldGeo = new THREE.BoxGeometry(1.45, 0.55, 0.08);
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(0, 1.0, -0.7);
  windshield.rotation.x = -0.35;
  car.add(windshield);

  // Rear windshield
  const rearGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.45, 0.08),
    glassMat
  );
  rearGlass.position.set(0, 0.95, 0.85);
  rearGlass.rotation.x = 0.3;
  car.add(rearGlass);

  // Side windows (left)
  const sideWindowGeo = new THREE.BoxGeometry(0.06, 0.4, 1.2);
  const leftWindow = new THREE.Mesh(sideWindowGeo, glassMat);
  leftWindow.position.set(-0.85, 0.95, 0.05);
  car.add(leftWindow);

  // Side windows (right)
  const rightWindow = new THREE.Mesh(sideWindowGeo, glassMat);
  rightWindow.position.set(0.85, 0.95, 0.05);
  car.add(rightWindow);

  // Roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.1, 1.3),
    bodyMat
  );
  roof.position.set(0, 1.2, 0.05);
  car.add(roof);

  // A-pillars (windshield frame)
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  [[-0.72, 1.0, -0.45], [0.72, 1.0, -0.45]].forEach(([px, py, pz]) => {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.5, 0.06),
      pillarMat
    );
    pillar.position.set(px, py, pz);
    pillar.rotation.x = -0.35;
    car.add(pillar);
  });

  // Wheels with tires and rims
  const createWheel = (x: number, z: number) => {
    const wheelGroup = new THREE.Group();

    // Tire
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 })
    );
    tire.rotation.z = Math.PI / 2;
    wheelGroup.add(tire);

    // Rim
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0xBBBBBB, metalness: 0.8, roughness: 0.2 })
    );
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    // Hub cap center
    const hub = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9 })
    );
    hub.position.x = x > 0 ? 0.13 : -0.13;
    hub.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
    wheelGroup.add(hub);

    // Wheel well / fender arch
    const archGeo = new THREE.RingGeometry(0.28, 0.42, 12, 1, 0, Math.PI);
    const arch = new THREE.Mesh(archGeo, bodyMat);
    arch.position.x = x > 0 ? 0.03 : -0.03;
    arch.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
    arch.position.y = 0.05;
    wheelGroup.add(arch);

    wheelGroup.position.set(x, 0.3, z);
    wheelGroup.castShadow = true;
    return wheelGroup;
  };

  car.add(createWheel(-0.85, -1.2));
  car.add(createWheel(0.85, -1.2));
  car.add(createWheel(-0.85, 1.2));
  car.add(createWheel(0.85, 1.2));

  // Headlights
  const headlightGeo = new THREE.BoxGeometry(0.35, 0.12, 0.05);
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFDD, emissive: 0xFFFF88, emissiveIntensity: 0.8
  });
  [[-0.55, 0.5, -2.1], [0.55, 0.5, -2.1]].forEach(([hx, hy, hz]) => {
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(hx, hy, hz);
    car.add(hl);
  });

  // Tail lights
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xFF2222, emissive: 0xFF0000, emissiveIntensity: 0.6
  });
  [[-0.6, 0.52, 2.1], [0.6, 0.52, 2.1]].forEach(([tx, ty, tz]) => {
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.1, 0.05),
      taillightMat
    );
    tl.position.set(tx, ty, tz);
    car.add(tl);
  });

  // Front grille
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.2, 0.04),
    darkMat
  );
  grille.position.set(0, 0.38, -2.1);
  car.add(grille);

  // License plate area (rear)
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.12, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xEEEEEE })
  );
  plate.position.set(0, 0.38, 2.12);
  car.add(plate);

  // Side mirrors
  const mirrorMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.5 });
  [[-1.0, 0.85, -0.5], [1.0, 0.85, -0.5]].forEach(([mx, my, mz]) => {
    const mirror = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 0.15),
      mirrorMat
    );
    mirror.position.set(mx, my, mz);
    car.add(mirror);
  });

  // Bumpers
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.15), bumperMat);
  frontBumper.position.set(0, 0.28, -2.05);
  car.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.15), bumperMat);
  rearBumper.position.set(0, 0.28, 2.05);
  car.add(rearBumper);

  return car;
}

// Create a more realistic tree
function createTree(x: number, z: number, scale: number = 1, variant: number = 0): THREE.Group {
  const tree = new THREE.Group();

  // Trunk with slight taper
  const trunkGeo = new THREE.CylinderGeometry(0.1 * scale, 0.2 * scale, 2.5 * scale, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4E3524, roughness: 0.95 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.25 * scale;
  trunk.castShadow = true;
  tree.add(trunk);

  if (variant === 0) {
    // Rounded deciduous tree (sphere-based canopy)
    const leafColors = [0x2D6B2D, 0x357A35, 0x3D8B3D, 0x2A5F2A];
    const mainCanopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.8 * scale, 8, 6),
      new THREE.MeshStandardMaterial({ color: leafColors[0], roughness: 0.85 })
    );
    mainCanopy.position.y = 3.8 * scale;
    mainCanopy.scale.y = 0.85;
    mainCanopy.castShadow = true;
    tree.add(mainCanopy);

    // Secondary smaller spheres for fullness
    const offsets = [[0.6, 3.2, 0.4], [-0.5, 3.5, -0.3], [0.2, 4.3, 0.3], [-0.3, 3.0, 0.5]];
    offsets.forEach(([ox, oy, oz], i) => {
      const sub = new THREE.Mesh(
        new THREE.SphereGeometry((0.8 + Math.random() * 0.4) * scale, 6, 5),
        new THREE.MeshStandardMaterial({ color: leafColors[i % leafColors.length], roughness: 0.85 })
      );
      sub.position.set(ox * scale, oy * scale, oz * scale);
      sub.castShadow = true;
      tree.add(sub);
    });
  } else if (variant === 1) {
    // Pine / conifer (layered cones)
    const pineColors = [0x1B4D1B, 0x205520, 0x256025];
    for (let i = 0; i < 4; i++) {
      const coneGeo = new THREE.ConeGeometry(
        (1.5 - i * 0.25) * scale,
        (2.0 - i * 0.15) * scale,
        8
      );
      const coneMat = new THREE.MeshStandardMaterial({
        color: pineColors[i % pineColors.length],
        roughness: 0.85,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.y = (2.8 + i * 1.0) * scale;
      cone.castShadow = true;
      tree.add(cone);
    }
  } else {
    // Bushy / oak style (multiple overlapping spheres)
    const oakColors = [0x3A7A3A, 0x448844, 0x2D6D2D];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const r = 0.6 * scale;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry((1.0 + Math.random() * 0.5) * scale, 7, 5),
        new THREE.MeshStandardMaterial({ color: oakColors[i % oakColors.length], roughness: 0.9 })
      );
      sphere.position.set(
        Math.cos(angle) * r,
        (3.0 + Math.random() * 1.0) * scale,
        Math.sin(angle) * r
      );
      sphere.castShadow = true;
      tree.add(sphere);
    }
  }

  tree.position.set(x, 0, z);
  return tree;
}

export default function DrivingScene({ speed = 0, steering = 0, scenarioId = 'start', backgroundUrl = null, onDistanceUpdate }: DrivingSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Store props in refs so the animation loop always has current values
  const propsRef = useRef({ speed, steering, scenarioId });
  const onDistanceUpdateRef = useRef(onDistanceUpdate);
  propsRef.current = { speed, steering, scenarioId };
  onDistanceUpdateRef.current = onDistanceUpdate;

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    car: THREE.Group;
    roadGroup: THREE.Group;
    roadOffset: number;
    stopSign: THREE.Group;
    stopLine: THREE.Mesh;
    crosswalk: THREE.Group;
    sideRoad: THREE.Mesh;
    turnArrow: THREE.Group;
    distance: number;
    trees: THREE.Group;
    buildings: THREE.Group;
    streetLights: THREE.Group;
    dashLines: THREE.Mesh[];
    totalDistance: number;
    oncomingTraffic: THREE.Group;
    currentSpeed: number;
    backgroundTexture?: THREE.Texture;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0xBBCCDD, 0.007);

    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      500
    );
    camera.position.set(1.8, 3.0, 7); // Start behind car in right lane
    camera.lookAt(1.5, 1.5, -10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFF5E0, 1.6);
    sunLight.position.set(25, 40, 15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x3A7D3A, 0.35);
    scene.add(hemiLight);

    // Ground with slight texture variation
    const groundGeo = new THREE.PlaneGeometry(300, 600);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4A8C3F, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.position.z = -250;
    ground.receiveShadow = true;
    scene.add(ground);

    // Sidewalks along road
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xBBBBAA, roughness: 0.9 });
    [-7.5, 7.5].forEach(sx => {
      const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 500), sidewalkMat);
      sidewalk.position.set(sx, 0.06, -200);
      sidewalk.receiveShadow = true;
      scene.add(sidewalk);
    });

    // Curbs
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x999988 });
    [-6.3, 6.3].forEach(cx => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 500), curbMat);
      curb.position.set(cx, 0.09, -200);
      scene.add(curb);
    });

    // Road surface
    const roadGroup = new THREE.Group();
    const roadWidth = 12;
    const roadLength = 500;

    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x3D3D3D, roughness: 0.82, metalness: 0.03 });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.z = -roadLength / 2 + 30;
    roadMesh.receiveShadow = true;
    roadGroup.add(roadMesh);

    // Yellow double center line
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xEEBB00, emissive: 0x332200, emissiveIntensity: 0.15 });
    [-0.12, 0.12].forEach(offset => {
      const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(0.08, roadLength), yellowMat);
      centerLine.rotation.x = -Math.PI / 2;
      centerLine.position.set(offset, 0.012, -roadLength / 2 + 30);
      roadGroup.add(centerLine);
    });

    // White dashed lane lines
    const dashLines: THREE.Mesh[] = [];
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xEEEEEE, emissive: 0x111111, emissiveIntensity: 0.05 });
    const dashLength = 3;
    const dashGap = 5;
    const laneOffsets = [-3, 3];

    laneOffsets.forEach(laneX => {
      for (let z = 30; z > -roadLength + 30; z -= (dashLength + dashGap)) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, dashLength), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(laneX, 0.012, z);
        roadGroup.add(dash);
        dashLines.push(dash);
      }
    });

    // Solid white edge lines
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xDDDDDD });
    [-roadWidth / 2 + 0.15, roadWidth / 2 - 0.15].forEach(ex => {
      const edgeLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, roadLength), edgeMat);
      edgeLine.rotation.x = -Math.PI / 2;
      edgeLine.position.set(ex, 0.012, -roadLength / 2 + 30);
      roadGroup.add(edgeLine);
    });

    scene.add(roadGroup);

    // Trees - mixed varieties along both sides
    const trees = new THREE.Group();
    for (let z = 15; z > -420; z -= 10 + Math.random() * 8) {
      const leftX = -14 - Math.random() * 20;
      const rightX = 14 + Math.random() * 20;
      const scale = 0.6 + Math.random() * 0.7;
      const variant = Math.floor(Math.random() * 3);
      trees.add(createTree(leftX, z, scale, variant));
      trees.add(createTree(rightX, z, scale + 0.1, (variant + 1) % 3));
      // Extra depth trees
      if (Math.random() > 0.4) {
        trees.add(createTree(leftX - 6 - Math.random() * 8, z + 4, scale * 0.9, 2));
      }
      if (Math.random() > 0.4) {
        trees.add(createTree(rightX + 6 + Math.random() * 8, z - 3, scale * 0.85, 1));
      }
    }
    scene.add(trees);

    // Buildings
    const buildings = new THREE.Group();
    const buildingColors = [0x8899AA, 0xAA9988, 0x778899, 0xBBAA99, 0x9999AA, 0x887766, 0xAA8877];

    const createBuilding = (x: number, z: number, w: number, h: number, d: number, color: number) => {
      const building = new THREE.Group();

      const bodyGeo = new THREE.BoxGeometry(w, h, d);
      const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.08 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      building.add(body);

      // Roof detail
      const roofGeo = new THREE.BoxGeometry(w + 0.2, 0.15, d + 0.2);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
      const roofMesh = new THREE.Mesh(roofGeo, roofMat);
      roofMesh.position.y = h;
      building.add(roofMesh);

      // Windows
      const windowMat = new THREE.MeshStandardMaterial({
        color: 0x88CCFF, emissive: 0x224466, emissiveIntensity: 0.25,
        metalness: 0.6, roughness: 0.15,
      });
      const winSize = 0.55;
      const winGap = 1.6;
      const floors = Math.floor((h - 1) / winGap);
      const winsPerFloor = Math.floor((w - 1) / winGap);

      for (let floor = 0; floor < floors; floor++) {
        for (let win = 0; win < winsPerFloor; win++) {
          // Front face
          const wf = new THREE.Mesh(new THREE.PlaneGeometry(winSize, winSize * 1.4), windowMat);
          wf.position.set(-w / 2 + winGap * 0.8 + win * winGap, 1.5 + floor * winGap, d / 2 + 0.01);
          building.add(wf);
          // Back face
          const wb = new THREE.Mesh(new THREE.PlaneGeometry(winSize, winSize * 1.4), windowMat);
          wb.position.set(-w / 2 + winGap * 0.8 + win * winGap, 1.5 + floor * winGap, -d / 2 - 0.01);
          wb.rotation.y = Math.PI;
          building.add(wb);
        }
      }

      // Door on front
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x443322 });
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), doorMat);
      door.position.set(0, 0.8, d / 2 + 0.02);
      building.add(door);

      building.position.set(x, 0, z);
      return building;
    };

    for (let z = 5; z > -350; z -= 16 + Math.random() * 8) {
      const h = 5 + Math.random() * 14;
      const w = 5 + Math.random() * 5;
      const d = 6 + Math.random() * 4;
      buildings.add(createBuilding(-16 - Math.random() * 6, z, w, h, d, buildingColors[Math.floor(Math.random() * buildingColors.length)]));
      buildings.add(createBuilding(16 + Math.random() * 6, z, w, h * 0.85, d, buildingColors[Math.floor(Math.random() * buildingColors.length)]));
    }
    buildings.visible = false;
    scene.add(buildings);

    // Street lights
    const streetLights = new THREE.Group();
    const createStreetLight = (x: number, z: number) => {
      const light = new THREE.Group();
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.3 });

      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 5.5, 6), poleMat);
      pole.position.y = 2.75;
      pole.castShadow = true;
      light.add(pole);

      // Curved arm
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 4), poleMat);
      arm.rotation.z = Math.PI / 2.5;
      arm.position.set(x > 0 ? -0.8 : 0.8, 5.2, 0);
      light.add(arm);

      // Light fixture
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.12, 0.25),
        new THREE.MeshStandardMaterial({ color: 0xFFEECC, emissive: 0xFFDD88, emissiveIntensity: 0.4 })
      );
      fixture.position.set(x > 0 ? -1.5 : 1.5, 5.1, 0);
      light.add(fixture);

      light.position.set(x, 0, z);
      return light;
    };

    for (let z = 10; z > -350; z -= 22) {
      streetLights.add(createStreetLight(-8, z));
      streetLights.add(createStreetLight(8, z));
    }
    scene.add(streetLights);

    // Stop sign (proper octagon)
    const stopSign = new THREE.Group();
    const signPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 })
    );
    signPole.position.y = 1.6;
    signPole.castShadow = true;
    stopSign.add(signPole);

    // Octagonal shape
    const octShape = new THREE.Shape();
    const octR = 0.5;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 8) + (i * Math.PI / 4);
      const ox = Math.cos(angle) * octR;
      const oy = Math.sin(angle) * octR;
      if (i === 0) octShape.moveTo(ox, oy);
      else octShape.lineTo(ox, oy);
    }
    octShape.closePath();

    const signGeo = new THREE.ExtrudeGeometry(octShape, { depth: 0.03, bevelEnabled: false });
    const signMesh = new THREE.Mesh(signGeo, new THREE.MeshStandardMaterial({ color: 0xCC0000, roughness: 0.4 }));
    signMesh.position.set(0, 3.2, 0);
    signMesh.rotation.y = Math.PI / 2;
    stopSign.add(signMesh);

    // White border
    const borderShape = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 8) + (i * Math.PI / 4);
      const bx = Math.cos(angle) * 0.55;
      const by = Math.sin(angle) * 0.55;
      if (i === 0) borderShape.moveTo(bx, by);
      else borderShape.lineTo(bx, by);
    }
    borderShape.closePath();
    const borderMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(borderShape, { depth: 0.02, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
    );
    borderMesh.position.set(0, 3.2, -0.01);
    borderMesh.rotation.y = Math.PI / 2;
    stopSign.add(borderMesh);

    stopSign.position.set(6.5, 0, -100); // Right side of road where driver sees it
    stopSign.visible = false;
    scene.add(stopSign);

    // Stop line
    const stopLine = new THREE.Mesh(
      new THREE.PlaneGeometry(roadWidth - 1, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
    );
    stopLine.rotation.x = -Math.PI / 2;
    stopLine.position.set(0, 0.015, -95);
    stopLine.visible = false;
    scene.add(stopLine);

    // Crosswalk
    const crosswalk = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 5),
        new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-3.5 + i * 1.1, 0.015, 0);
      crosswalk.add(stripe);
    }
    crosswalk.position.set(0, 0, -90);
    crosswalk.visible = false;
    scene.add(crosswalk);

    // Side road
    const sideRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(80, roadWidth),
      roadMat.clone()
    );
    sideRoad.rotation.x = -Math.PI / 2;
    sideRoad.position.set(0, -0.005, -100);
    sideRoad.visible = false;
    scene.add(sideRoad);

    // Turn arrow
    const turnArrow = new THREE.Group();
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, -1);
    arrowShape.lineTo(0, 0.5);
    arrowShape.lineTo(-0.5, 0.5);
    arrowShape.lineTo(0, 1.2);
    arrowShape.lineTo(0.5, 0.5);
    arrowShape.lineTo(0.15, 0.5);
    arrowShape.lineTo(0.15, -1);
    arrowShape.closePath();
    const arrowMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(arrowShape),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide })
    );
    arrowMesh.rotation.x = -Math.PI / 2;
    arrowMesh.rotation.z = Math.PI / 2;
    arrowMesh.position.set(3, 0.016, -80);
    turnArrow.add(arrowMesh);
    turnArrow.visible = false;
    scene.add(turnArrow);

    // Car - positioned in right lane
    const car = createCar();
    car.position.x = 3; // Right lane (center of right lane between center line and edge)
    scene.add(car);

    // Oncoming traffic cars in left lane
    const oncomingTraffic = new THREE.Group();
    const trafficColors = [0xCC3333, 0x33AA33, 0x888888, 0xEECC44, 0x4488CC, 0xAA5522];

    const createTrafficCar = (color: number): THREE.Group => {
      const tc = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
      const darkM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
      const glassM = new THREE.MeshStandardMaterial({ color: 0x88CCFF, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.35 });

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 4.0), mat);
      body.position.y = 0.42;
      body.castShadow = true;
      tc.add(body);

      // Cabin
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 2.0), mat);
      cabin.position.y = 0.72;
      cabin.castShadow = true;
      tc.add(cabin);

      // Windshields
      const ws = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.06), glassM);
      ws.position.set(0, 0.92, -0.65);
      ws.rotation.x = -0.3;
      tc.add(ws);
      const rw = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 0.06), glassM);
      rw.position.set(0, 0.88, 0.7);
      rw.rotation.x = 0.25;
      tc.add(rw);

      // Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 1.2), mat);
      roof.position.y = 1.0;
      tc.add(roof);

      // Wheels (simplified)
      [[-0.8, 0.28, -1.1], [0.8, 0.28, -1.1], [-0.8, 0.28, 1.1], [0.8, 0.28, 1.1]].forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 0.2, 10),
          darkM
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, wy, wz);
        tc.add(wheel);
      });

      // Headlights (facing us since they drive toward camera)
      const hlMat = new THREE.MeshStandardMaterial({ color: 0xFFFFDD, emissive: 0xFFFF88, emissiveIntensity: 0.6 });
      [[-0.5, 0.48, -2.0], [0.5, 0.48, -2.0]].forEach(([hx, hy, hz]) => {
        tc.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.04), hlMat).translateX(hx).translateY(hy).translateZ(hz));
      });

      // Taillights (facing away)
      const tlMat = new THREE.MeshStandardMaterial({ color: 0xFF2222, emissive: 0xFF0000, emissiveIntensity: 0.5 });
      [[-0.5, 0.48, 2.0], [0.5, 0.48, 2.0]].forEach(([tx, ty, tz]) => {
        tc.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.04), tlMat).translateX(tx).translateY(ty).translateZ(tz));
      });

      // Rotate 180 so they face toward the player (oncoming)
      tc.rotation.y = Math.PI;
      return tc;
    };

    // Place 5-6 oncoming cars at staggered distances in the left lane
    for (let i = 0; i < 6; i++) {
      const trafficCar = createTrafficCar(trafficColors[i % trafficColors.length]);
      trafficCar.position.set(-3, 0, -40 - i * 55 - Math.random() * 20); // Left lane, spaced out
      oncomingTraffic.add(trafficCar);
    }
    scene.add(oncomingTraffic);

    sceneRef.current = {
      scene, camera, renderer, car, roadGroup,
      roadOffset: 0,
      stopSign, stopLine, crosswalk, sideRoad, turnArrow,
      distance: 100,
      trees, buildings, streetLights,
      dashLines,
      totalDistance: 0,
      oncomingTraffic,
      currentSpeed: 0,
    };

    // Animation loop - ALL movement happens here at 60fps
    let lastTime = performance.now();
    const animate = (now: number) => {
      requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 16.667, 3); // Normalize to ~60fps, cap at 3x
      lastTime = now;

      const s = sceneRef.current;
      if (!s) return;

      const { speed: currentSpeed, steering: currentSteering, scenarioId: currentScenarioId } = propsRef.current;

      // Smooth the internal speed - responsive enough to feel immediate
      const targetSpeed = Math.max(0, currentSpeed) / 100; // 0 to 1
      // Fast ramp up (0.15), even faster brake response (0.25)
      const smoothFactor = targetSpeed > s.currentSpeed ? 0.15 : 0.25;
      s.currentSpeed += (targetSpeed - s.currentSpeed) * smoothFactor * dt;
      if (s.currentSpeed < 0.002) s.currentSpeed = 0;

      // Strong movement multiplier so even small throttle produces visible motion
      const moveAmount = s.currentSpeed * 2.5 * dt;

      // Car steering - right lane baseline at x=3
      const laneCenter = 3;
      const targetX = laneCenter + currentSteering * 2.5;
      s.car.position.x += (targetX - s.car.position.x) * 0.05 * dt;
      s.car.position.x = Math.max(0.5, Math.min(5.5, s.car.position.x));
      s.car.rotation.y = -currentSteering * 0.12;

      // Animate dashed lines (road motion)
      s.roadOffset += moveAmount;
      if (s.roadOffset > 8) s.roadOffset -= 8;

      s.dashLines.forEach(dash => {
        dash.position.z += moveAmount;
        if (dash.position.z > 35) dash.position.z -= 420;
      });

      s.totalDistance += moveAmount;

      // Scroll scenery
      s.trees.children.forEach((tree, i) => {
        tree.position.z += moveAmount;
        if (tree.position.z > 35) tree.position.z -= 450;
        // Subtle sway
        tree.rotation.z = Math.sin(now * 0.0008 + i * 0.7) * 0.008;
      });

      s.buildings.children.forEach(bldg => {
        bldg.position.z += moveAmount;
        if (bldg.position.z > 35) bldg.position.z -= 380;
      });

      s.streetLights.children.forEach(light => {
        light.position.z += moveAmount;
        if (light.position.z > 35) light.position.z -= 375;
      });

      // Oncoming traffic
      const oncomingSpeed = moveAmount * 1.8 + 0.12 * dt;
      s.oncomingTraffic.children.forEach(trafficCar => {
        trafficCar.position.z += oncomingSpeed;
        if (trafficCar.position.z > 40) {
          trafficCar.position.z = -280 - Math.random() * 80;
          trafficCar.position.x = -3 + (Math.random() - 0.5) * 0.6;
        }
      });

      // Scenario elements
      s.stopSign.visible = false;
      s.stopLine.visible = false;
      s.crosswalk.visible = false;
      s.sideRoad.visible = false;
      s.turnArrow.visible = false;
      s.buildings.visible = currentScenarioId !== 'start';

      if (currentScenarioId === 'stop') {
        s.stopSign.visible = true;
        s.stopLine.visible = true;
        s.buildings.visible = true;
        s.distance -= moveAmount;
        s.stopSign.position.z = -s.distance;
        s.stopLine.position.z = -s.distance + 5;
        if (s.distance < -15) s.distance = 100;
        onDistanceUpdateRef.current?.(Math.max(0, s.distance));
      } else if (currentScenarioId === 'turn') {
        s.crosswalk.visible = true;
        s.sideRoad.visible = true;
        s.turnArrow.visible = true;
        s.buildings.visible = true;
        s.distance -= moveAmount;
        s.crosswalk.position.z = -s.distance;
        s.sideRoad.position.z = -s.distance - 5;
        if (s.distance < -15) s.distance = 100;
        onDistanceUpdateRef.current?.(Math.max(0, s.distance));
      } else {
        s.distance = 100;
      }

      // Camera - follows car from behind in right lane
      const shake = Math.sin(now * 0.007) * s.currentSpeed * 0.04;
      s.camera.position.x += (s.car.position.x * 0.6 - s.camera.position.x) * 0.05 * dt;
      s.camera.position.y = 3.0 + shake;
      s.camera.lookAt(s.car.position.x * 0.5, 1.5, s.car.position.z - 12);
      s.camera.rotation.z = currentSteering * 0.012;

      renderer.render(scene, camera);
    };
    requestAnimationFrame(animate);

    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Background texture
  useEffect(() => {
    if (!sceneRef.current) return;
    if (backgroundUrl) {
      new THREE.TextureLoader().load(backgroundUrl, (texture) => {
        if (sceneRef.current) {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          sceneRef.current.scene.background = texture;
          sceneRef.current.backgroundTexture = texture;
        }
      });
    } else {
      sceneRef.current.scene.background = new THREE.Color(0x87CEEB);
    }
  }, [backgroundUrl]);

  return (
    <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden shadow-inner bg-slate-900 relative" id="driving-scene">
      {scenarioId === 'stop' && sceneRef.current && (
        <div className="absolute top-6 right-6 bg-black/60 backdrop-blur-xl px-6 py-4 rounded-2xl border border-white/20 text-white shadow-2xl">
          <p className="text-[10px] uppercase tracking-widest text-rose-400 font-bold mb-1">Target: Stop Sign</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono">{Math.max(0, sceneRef.current.distance).toFixed(0)}</span>
            <span className="text-sm opacity-60">m</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: sceneRef.current.distance < 20 ? '#ef4444' : sceneRef.current.distance < 50 ? '#f59e0b' : '#22B8A5'
              }}
              animate={{ width: `${Math.max(0, (sceneRef.current.distance / 100)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {scenarioId === 'turn' && sceneRef.current && (
        <div className="absolute top-6 right-6 bg-black/60 backdrop-blur-xl px-6 py-4 rounded-2xl border border-white/20 text-white shadow-2xl">
          <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mb-1">Intersection Ahead</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono">{Math.max(0, sceneRef.current.distance).toFixed(0)}</span>
            <span className="text-sm opacity-60">m</span>
          </div>
        </div>
      )}
    </div>
  );
}
