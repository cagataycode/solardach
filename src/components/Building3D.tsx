"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import SunCalc from "suncalc";

type Vec3 = [number, number, number];

interface SceneData {
  originLatitude: number;
  originLongitude: number;
  roofs: Array<{ ring: Vec3[]; panelCount: number; compass: string }>;
  walls: Vec3[][];
  panels: Array<[Vec3, Vec3, Vec3, Vec3]>;
  neighborSurfaces: Array<{ kind: string; ring: Vec3[] }>;
}

interface Building3DProps {
  checkId: string;
}

/** Edge length (m) of the orthophoto draped under/over the scene. */
const ORTHO_SIZE_M = 220;

/** ENU (east, north, up) → three.js (x=east, y=up, z=south). */
function toThree([e, n, u]: Vec3): THREE.Vector3 {
  return new THREE.Vector3(e, u, -n);
}

/** Triangulate a planar 3D ring (fan would fail on concave roofs). */
function ringGeometry(ring: Vec3[]): THREE.BufferGeometry | null {
  if (ring.length < 3) return null;
  const pts = ring.map(toThree);

  // Build an in-plane 2D projection for triangulation.
  const normal = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    const c = pts[i];
    const nx = pts[(i + 1) % pts.length];
    normal.x += (c.y - nx.y) * (c.z + nx.z);
    normal.y += (c.z - nx.z) * (c.x + nx.x);
    normal.z += (c.x - nx.x) * (c.y + nx.y);
  }
  if (normal.lengthSq() === 0) return null;
  normal.normalize();
  const u = new THREE.Vector3(0, 1, 0).cross(normal);
  if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(normal, u);

  const projected = pts.map(
    (p) => new THREE.Vector2(p.dot(u), p.dot(v))
  );
  const triangles = THREE.ShapeUtils.triangulateShape(projected, []);

  const positions: number[] = [];
  for (const [a, b, c] of triangles) {
    for (const idx of [a, b, c]) {
      positions.push(pts[idx].x, pts[idx].y, pts[idx].z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Top-down planar UVs matching an orthophoto bbox centered on the origin. */
function applyPlanarUv(geo: THREE.BufferGeometry, sizeM: number) {
  const pos = geo.getAttribute("position");
  const half = sizeM / 2;
  const uvs: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    uvs.push((pos.getX(i) + half) / sizeM, (-pos.getZ(i) + half) / sizeM);
  }
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
}

function addRing(
  group: THREE.Group,
  ring: Vec3[],
  material: THREE.Material,
  uvSizeM?: number
) {
  const geo = ringGeometry(ring);
  if (!geo) return;
  if (uvSizeM) applyPlanarUv(geo, uvSizeM);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

export default function Building3D({ checkId }: Building3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<SceneData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading"
  );
  const [hour, setHour] = useState(13);
  const sunRef = useRef<((hour: number) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/building3d?checkId=${checkId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (!cancelled) {
          setScene(data.scene);
          setStatus("ready");
        }
      })
      .catch(() => !cancelled && setStatus("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [checkId]);

  useEffect(() => {
    if (!scene || !mountRef.current) return;
    const mount = mountRef.current;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    // Aerial photo (NRW DOP open data) draped over ground and roofs makes the
    // scene recognizably *their* home. Scene still renders without it.
    const init = (ortho: THREE.Texture | null) => {
      if (disposed) return;
      cleanup = buildScene(mount, scene, ortho);
    };
    new THREE.TextureLoader()
      .loadAsync(`/api/orthophoto?checkId=${checkId}&size=${ORTHO_SIZE_M}`)
      .then((tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        init(tex);
      })
      .catch(() => init(null));

    return () => {
      disposed = true;
      cleanup?.();
      sunRef.current = null;
    };

    function buildScene(
      el: HTMLDivElement,
      scene: SceneData,
      ortho: THREE.Texture | null
    ): () => void {
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      el.appendChild(renderer.domElement);

      const three = new THREE.Scene();
      three.background = new THREE.Color("#dcebf5");
      three.fog = new THREE.Fog("#dcebf5", 140, 360);

      const camera = new THREE.PerspectiveCamera(
        45,
        el.clientWidth / el.clientHeight,
        0.1,
        1000
      );

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI / 2.05;
      controls.minDistance = 8;
      controls.maxDistance = 150;

      // Materials — DoubleSide because CityGML ring winding is not guaranteed.
      // With an orthophoto, roofs are draped with the real aerial image.
      const roofMat = ortho
        ? new THREE.MeshStandardMaterial({
            map: ortho,
            roughness: 0.9,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshStandardMaterial({
            color: "#9a5b43",
            roughness: 0.85,
            side: THREE.DoubleSide,
          });
      const neighborRoofMat = ortho
        ? roofMat
        : new THREE.MeshStandardMaterial({
            color: "#c5c9c4",
            roughness: 0.95,
            side: THREE.DoubleSide,
          });
      const wallMat = new THREE.MeshStandardMaterial({
        color: "#e8dfca",
        roughness: 0.9,
        side: THREE.DoubleSide,
      });
      const neighborWallMat = new THREE.MeshStandardMaterial({
        color: "#cfd2cc",
        roughness: 0.95,
        side: THREE.DoubleSide,
      });
      const panelMat = new THREE.MeshStandardMaterial({
        color: "#13233f",
        roughness: 0.25,
        metalness: 0.55,
        side: THREE.DoubleSide,
      });

      const uvSize = ortho ? ORTHO_SIZE_M : undefined;
      const group = new THREE.Group();
      const buildingGroup = new THREE.Group();
      for (const r of scene.roofs) addRing(buildingGroup, r.ring, roofMat, uvSize);
      for (const w of scene.walls) addRing(buildingGroup, w, wallMat);
      group.add(buildingGroup);
      for (const ns of scene.neighborSurfaces) {
        if (ns.kind === "roof") addRing(group, ns.ring, neighborRoofMat, uvSize);
        else addRing(group, ns.ring, neighborWallMat);
      }

      // Panels: lifted slightly off the roof plane to avoid z-fighting.
      for (const quad of scene.panels) {
        const [a, b, c, d] = quad.map(toThree);
        const normal = new THREE.Vector3()
          .crossVectors(
            new THREE.Vector3().subVectors(b, a),
            new THREE.Vector3().subVectors(d, a)
          )
          .normalize();
        if (normal.y < 0) normal.negate();
        const lift = normal.multiplyScalar(0.09);
        const pts = [a, b, c, d].map((p) => p.clone().add(lift));
        const geo = new THREE.BufferGeometry();
        const positions: number[] = [];
        for (const idx of [0, 1, 2, 0, 2, 3]) {
          positions.push(pts[idx].x, pts[idx].y, pts[idx].z);
        }
        geo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3)
        );
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, panelMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      three.add(group);

      // Frame the camera on the target building (not the whole neighborhood).
      const bbox = new THREE.Box3().setFromObject(buildingGroup);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.z, 12);
      controls.target.copy(center);

      // Approach from the side the panels are on, so they are visible on load.
      const viewDir = new THREE.Vector3(1, 0, 1).normalize();
      if (scene.panels.length > 0) {
        const pc = new THREE.Vector3();
        for (const quad of scene.panels)
          for (const p of quad) pc.add(toThree(p));
        pc.divideScalar(scene.panels.length * 4);
        const horiz = pc.clone().sub(center).setY(0);
        if (horiz.lengthSq() > 0.5) viewDir.copy(horiz.normalize());
      }
      camera.position.set(
        center.x + viewDir.x * radius * 2.2,
        center.y + radius * 1.1,
        center.z + viewDir.z * radius * 2.2
      );

      // Ground: aerial photo if available, plain green otherwise.
      const ground = ortho
        ? new THREE.Mesh(
            new THREE.PlaneGeometry(ORTHO_SIZE_M, ORTHO_SIZE_M),
            new THREE.MeshStandardMaterial({ map: ortho, roughness: 1 })
          )
        : new THREE.Mesh(
            new THREE.CircleGeometry(200, 64),
            new THREE.MeshStandardMaterial({ color: "#aebf9a", roughness: 1 })
          );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.05;
      ground.receiveShadow = true;
      three.add(ground);

      // Lights
      three.add(new THREE.HemisphereLight("#ffffff", "#9aa391", 1.5));
      const sun = new THREE.DirectionalLight("#fff3d6", 1.7);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -80;
      sun.shadow.camera.right = 80;
      sun.shadow.camera.top = 80;
      sun.shadow.camera.bottom = -80;
      sun.shadow.camera.far = 400;
      sun.shadow.bias = -0.0004;
      three.add(sun);

      const updateSun = (h: number) => {
        // June 21st — best-case sun path; SunCalc azimuth is from south.
        const date = new Date();
        date.setMonth(5, 21);
        date.setHours(Math.floor(h), (h % 1) * 60, 0, 0);
        const pos = SunCalc.getPosition(
          date,
          scene.originLatitude,
          scene.originLongitude
        );
        const azFromNorth = pos.azimuth + Math.PI;
        const alt = Math.max(pos.altitude, -0.05);
        const dist = 180;
        const e = Math.sin(azFromNorth) * Math.cos(alt) * dist;
        const n = Math.cos(azFromNorth) * Math.cos(alt) * dist;
        const up = Math.sin(alt) * dist;
        sun.position.set(e, up, -n);
        sun.intensity = pos.altitude > 0 ? 1.7 : 0.15;
      };
      sunRef.current = updateSun;
      updateSun(hour);

      let raf = 0;
      const animate = () => {
        raf = requestAnimationFrame(animate);
        controls.update();
        renderer.render(three, camera);
      };
      animate();

      const onResize = () => {
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(el.clientWidth, el.clientHeight);
      };
      window.addEventListener("resize", onResize);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        controls.dispose();
        renderer.dispose();
        el.removeChild(renderer.domElement);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => {
    sunRef.current?.(hour);
  }, [hour]);

  if (status === "unavailable") return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-pine/15 bg-white/80 shadow-[0_24px_60px_-30px_rgb(27_58_36/0.35)]">
      <div className="relative">
        <div ref={mountRef} className="h-[380px] w-full sm:h-[440px]" />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-parchment/80 text-sm text-ink/60">
            3D-Modell wird geladen …
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-pine-deep/85 px-3 py-1 text-xs font-medium text-cream">
          Ihr Zuhause in 3D — amtliche Gebäudedaten & Luftbild
        </span>
        <span className="absolute bottom-3 right-4 rounded bg-ink/40 px-2 py-0.5 text-[10px] text-cream/90">
          Daten: Geobasis NRW (Open Data)
        </span>
      </div>
      <div className="flex items-center gap-4 border-t border-ink/10 px-5 py-4">
        <span className="text-xs font-medium uppercase tracking-wider text-ink/50">
          Sonnenstand
        </span>
        <input
          type="range"
          min={5}
          max={21}
          step={0.25}
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          className="flex-1 accent-sun-deep"
          aria-label="Tageszeit für Sonnenstand-Simulation"
        />
        <span className="w-14 text-right text-sm tabular-nums text-ink/70">
          {String(Math.floor(hour)).padStart(2, "0")}:
          {String(Math.round((hour % 1) * 60)).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
