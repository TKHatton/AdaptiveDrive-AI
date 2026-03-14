import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion } from 'motion/react';

export default function DrivingScene({ speed = 0, steering = 0, scenarioId = 'start', backgroundUrl = null, onDistanceUpdate }: { speed: number; steering: number; scenarioId?: string; backgroundUrl?: string | null; onDistanceUpdate?: (dist: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    road: THREE.Mesh;
    car: THREE.Group;
    stopSign: THREE.Group;
    distance: number;
    backgroundTexture?: THREE.Texture;
    stopLine: THREE.Mesh;
    crosswalk: THREE.Group;
    sideRoad: THREE.Mesh;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new THREE.Fog(0x87ceeb, 50, 150);

    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 1, -5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(10, 20, 10);
    scene.add(sunLight);

    // Ground / Roadside
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 }); // Forest Green
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    // Road
    const roadGeometry = new THREE.PlaneGeometry(10, 1000);
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    scene.add(road);

    // Road markings (Center dashed line)
    const lineGeometry = new THREE.PlaneGeometry(0.2, 2);
    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (let i = 0; i < 100; i++) {
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.01, -i * 10);
      scene.add(line);
    }

    // Lane markers (Solid side lines)
    const sideLineGeometry = new THREE.PlaneGeometry(0.1, 1000);
    const sideLineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
    const leftLine = new THREE.Mesh(sideLineGeometry, sideLineMaterial);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-4.8, 0.01, 0);
    scene.add(leftLine);
    const rightLine = new THREE.Mesh(sideLineGeometry, sideLineMaterial);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(4.8, 0.01, 0);
    scene.add(rightLine);

    // Stop Line (for stop scenario)
    const stopLineGeometry = new THREE.PlaneGeometry(10, 1);
    const stopLineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const stopLine = new THREE.Mesh(stopLineGeometry, stopLineMaterial);
    stopLine.rotation.x = -Math.PI / 2;
    stopLine.position.set(0, 0.02, -95);
    stopLine.visible = false;
    scene.add(stopLine);

    // Crosswalk (for turn scenario)
    const crosswalk = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-3.5 + i * 1, 0.02, 0);
      crosswalk.add(stripe);
    }
    crosswalk.position.set(0, 0, -90);
    crosswalk.visible = false;
    scene.add(crosswalk);

    // Branching Road (for turn scenario)
    const sideRoadGeometry = new THREE.PlaneGeometry(100, 10);
    const sideRoadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const sideRoad = new THREE.Mesh(sideRoadGeometry, sideRoadMaterial);
    sideRoad.rotation.x = -Math.PI / 2;
    sideRoad.position.set(0, -0.01, -100);
    sideRoad.visible = false;
    scene.add(sideRoad);

    // Stop Sign
    const stopSign = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    pole.position.y = 1.5;
    stopSign.add(pole);
    const signGeometry = new THREE.OctahedronGeometry(0.5, 0);
    const signMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.y = 3;
    sign.rotation.y = Math.PI / 4;
    stopSign.add(sign);
    stopSign.position.set(6, 0, -100); // Start far away
    scene.add(stopSign);

    // Simple Car Placeholder
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 3), new THREE.MeshStandardMaterial({ color: 0x2f6df6 }));
    body.position.y = 0.5;
    car.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.5), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    roof.position.y = 1;
    car.add(roof);
    scene.add(car);

    sceneRef.current = { scene, camera, renderer, road, car, stopSign, distance: 100, stopLine, crosswalk, sideRoad };

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

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
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, []);

  // Update Background Texture
  useEffect(() => {
    if (!sceneRef.current || !backgroundUrl) {
      if (sceneRef.current) {
        sceneRef.current.scene.background = new THREE.Color(0x87ceeb);
      }
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(backgroundUrl, (texture) => {
      if (sceneRef.current) {
        sceneRef.current.scene.background = texture;
        sceneRef.current.backgroundTexture = texture;
      }
    });
  }, [backgroundUrl]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const { road, car, camera, stopSign, stopLine, crosswalk, sideRoad } = sceneRef.current;
    
    // Update car position based on steering
    car.position.x += steering * 0.1;
    car.rotation.y = -steering * 0.2;
    
    // Move road to simulate speed
    const normalizedSpeed = speed / 100;
    // idleSpeed = 0.3, clamp between 0 and 8
    const moveAmount = Math.max(0, Math.min(8, (normalizedSpeed * 6) + 0.3));
    
    road.position.z += moveAmount;
    if (road.position.z > 10) road.position.z = 0;

    // Reset visibility
    stopSign.visible = false;
    stopLine.visible = false;
    crosswalk.visible = false;
    sideRoad.visible = false;

    // Update scenario objects
    if (scenarioId === 'stop') {
      stopSign.visible = true;
      stopLine.visible = true;
      sceneRef.current.distance -= moveAmount;
      stopSign.position.z = -sceneRef.current.distance;
      stopLine.position.z = -sceneRef.current.distance + 5;
      
      if (sceneRef.current.distance < -10) {
        sceneRef.current.distance = 100; // Reset for loop
      }
      onDistanceUpdate?.(sceneRef.current.distance);
    } else if (scenarioId === 'turn') {
      crosswalk.visible = true;
      sideRoad.visible = true;
      sceneRef.current.distance -= moveAmount;
      crosswalk.position.z = -sceneRef.current.distance;
      sideRoad.position.z = -sceneRef.current.distance - 5;

      if (sceneRef.current.distance < -10) {
        sceneRef.current.distance = 100; // Reset for loop
      }
      onDistanceUpdate?.(sceneRef.current.distance);
    }

    // Camera follow with subtle shake
    const shake = Math.sin(Date.now() * 0.01) * normalizedSpeed * 0.05;
    camera.position.x = car.position.x;
    camera.position.y = 2 + shake;
    camera.lookAt(car.position.x, 1, car.position.z - 5);
    camera.rotation.z = steering * 0.02; // Subtle tilt
  }, [speed, steering, scenarioId]);

  return (
    <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden shadow-inner bg-slate-900 relative" id="driving-scene">
      {scenarioId === 'stop' && sceneRef.current && (
        <div className="absolute top-24 right-6 bg-black/60 backdrop-blur-xl px-6 py-4 rounded-3xl border border-white/20 text-white shadow-2xl animate-in fade-in slide-in-from-right-4">
          <p className="text-[10px] uppercase tracking-widest text-rose-400 font-bold mb-1">Target: Stop Sign</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono">{Math.max(0, sceneRef.current.distance).toFixed(1)}</span>
            <span className="text-sm opacity-60">meters</span>
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
            <motion.div 
              className="h-full bg-rose-500"
              animate={{ width: `${(Math.max(0, sceneRef.current.distance) / 100) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
