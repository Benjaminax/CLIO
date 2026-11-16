import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  BookOpen,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Compass,
} from "lucide-react";

interface Three3dBookViewerProps {
  title: string;
  author: string;
  description: string;
  pagesCount: number;
  coverTone?: "soft" | "dark" | "slides" | "grid";
  onOpenReader?: () => void;
}

const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71;
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 20;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

function createPageGeometry(): THREE.BoxGeometry {
  const pageGeometry = new THREE.BoxGeometry(
    PAGE_WIDTH,
    PAGE_HEIGHT,
    PAGE_DEPTH,
    PAGE_SEGMENTS,
    2
  );
  pageGeometry.translate(PAGE_WIDTH / 2, 0, 0);

  const pos = pageGeometry.attributes.position;
  const vertex = new THREE.Vector3();
  const skinIndexes: number[] = [];
  const skinWeights: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    vertex.fromBufferAttribute(pos, i);
    const x = vertex.x;
    const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH));
    const skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;

    skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
    skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
  }

  pageGeometry.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute(skinIndexes, 4)
  );
  pageGeometry.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute(skinWeights, 4)
  );

  return pageGeometry;
}

function generateCoverCanvasTexture(
  title: string,
  author: string,
  isBack = false,
  description = ""
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 684;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 684);
    if (!isBack) {
      grad.addColorStop(0, "#1e1b4b");
      grad.addColorStop(0.5, "#312e81");
      grad.addColorStop(1, "#0f172a");
    } else {
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(1, "#1e1b4b");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 684);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 12;
    ctx.strokeRect(24, 24, 464, 636);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, 440, 612);

    if (!isBack) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.beginPath();
      ctx.roundRect(176, 80, 160, 36, 18);
      ctx.fill();

      ctx.fillStyle = "#a5b4fc";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CLIO DIGITAL 3D", 256, 103);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px Georgia, serif";
      ctx.textAlign = "center";

      const words = title.split(" ");
      let line = "";
      let y = 240;
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + " ";
        if (ctx.measureText(testLine).width > 380 && i > 0) {
          ctx.fillText(line, 256, y);
          line = words[i] + " ";
          y += 36;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 256, y);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "italic 18px Georgia, serif";
      ctx.fillText(`By ${author}`, 256, y + 60);

      ctx.strokeStyle = "#818cf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(256, y + 140, 30, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#818cf8";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("3D", 256, y + 147);
    } else {
      ctx.fillStyle = "#a5b4fc";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SYNOPSIS & SUMMARY", 256, 100);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "14px Georgia, serif";
      ctx.textAlign = "left";

      const words = (description || "An interactive 3D digital library book edition.").split(" ");
      let line = "";
      let y = 160;
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + " ";
        if (ctx.measureText(testLine).width > 420 && i > 0) {
          ctx.fillText(line, 46, y);
          line = words[i] + " ";
          y += 24;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 46, y);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CLIO PLATFORM 3D EDITION · ALL RIGHTS RESERVED", 256, 620);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function generatePageCanvasTexture(pageIndex: number, textContent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 684;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#fdfbf7";
    ctx.fillRect(0, 0, 512, 684);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 32, 448, 620);

    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
    ctx.textAlign = pageIndex % 2 === 0 ? "right" : "left";
    ctx.fillText(`Page ${pageIndex + 1}`, pageIndex % 2 === 0 ? 470 : 42, 54);

    ctx.fillStyle = "#1e293b";
    ctx.font = "13px Georgia, serif";
    ctx.textAlign = "left";

    const lines = [
      `CHAPTER ${Math.floor(pageIndex / 2) + 1}`,
      "",
      "Multimodal document parsing requires joint modeling",
      "of layout geometry, typography, and mathematical syntax.",
      "",
      "In this 3D edition, pages feature skeletal bone rigging",
      "and vertex skinning to animate smooth 3D page flips.",
      "",
      "\"Strategy without tactics is the slowest route to victory.",
      "Tactics without strategy is the noise before defeat.\"",
      "",
      "Every document in your library can be inspected in 3D",
      "with full orbit camera control, depth lighting, and page",
      "progress persistence.",
    ];

    let y = 100;
    lines.forEach((l) => {
      if (l.startsWith("CHAPTER")) {
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "#334155";
      } else if (l.startsWith('"')) {
        ctx.font = "italic 13px Georgia, serif";
        ctx.fillStyle = "#0f172a";
      } else {
        ctx.font = "13px Georgia, serif";
        ctx.fillStyle = "#334155";
      }
      ctx.fillText(l, 42, y);
      y += 26;
    });

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px font-mono";
    ctx.textAlign = "center";
    ctx.fillText(`- ${pageIndex + 1} -`, 256, 640);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function Three3dBookViewer({
  title,
  author,
  description,
  pagesCount,
  onOpenReader,
}: Three3dBookViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const bookGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const totalSpreads = 5;

  useEffect(() => {
    const root = document.documentElement;
    const updateSceneTheme = () => {
      if (!sceneRef.current) return;
      sceneRef.current.background = new THREE.Color(
        root.classList.contains("dark") ? "#09090b" : "#f1f5f9"
      );
    };

    const observer = new MutationObserver(updateSceneTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    updateSceneTheme();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || (isFullscreen ? window.innerHeight * 0.8 : 420);

    const isDark = document.documentElement.classList.contains("dark");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? "#09090b" : "#f1f5f9");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0.2, isFullscreen ? 3.8 : 4.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(3, 6, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x818cf8, 1.5, 10);
    pointLight.position.set(-2, 2, 2);
    scene.add(pointLight);

    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const frontCoverTex = generateCoverCanvasTexture(title, author, false, description);
    const backCoverTex = generateCoverCanvasTexture(title, author, true, description);

    const bookGroup = new THREE.Group();
    bookGroup.rotation.y = -Math.PI / 6;
    scene.add(bookGroup);
    bookGroupRef.current = bookGroup;

    const pageMeshes: THREE.SkinnedMesh[] = [];
    const pageBonesList: THREE.Bone[][] = [];

    for (let p = 0; p < totalSpreads; p++) {
      const pageGeometry = createPageGeometry();

      const bones: THREE.Bone[] = [];
      for (let i = 0; i <= PAGE_SEGMENTS; i++) {
        const bone = new THREE.Bone();
        bones.push(bone);
        if (i === 0) bone.position.x = 0;
        else bone.position.x = SEGMENT_WIDTH;

        if (i > 0) bones[i - 1].add(bone);
      }

      const skeleton = new THREE.Skeleton(bones);

      const frontTex = p === 0 ? frontCoverTex : generatePageCanvasTexture(p * 2, description);
      const backTex = p === totalSpreads - 1 ? backCoverTex : generatePageCanvasTexture(p * 2 + 1, description);

      const materials = [
        new THREE.MeshStandardMaterial({ color: "#e2e8f0" }),
        new THREE.MeshStandardMaterial({ color: "#1e293b" }),
        new THREE.MeshStandardMaterial({ color: "#e2e8f0" }),
        new THREE.MeshStandardMaterial({ color: "#e2e8f0" }),
        new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.15 }),
        new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.15 }),
      ];

      const mesh = new THREE.SkinnedMesh(pageGeometry, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      mesh.add(skeleton.bones[0]);
      mesh.bind(skeleton);

      mesh.position.z = -p * PAGE_DEPTH;
      bookGroup.add(mesh);

      pageMeshes.push(mesh);
      pageBonesList.push(bones);
    }

    scene.updateMatrixWorld(true);

    let isMouseDown = false;
    let prevX = 0;
    let prevY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const deltaX = e.clientX - prevX;
      const deltaY = e.clientY - prevY;

      bookGroup.rotation.y += deltaX * 0.01;
      bookGroup.rotation.x += deltaY * 0.01;

      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      for (let p = 0; p < totalSpreads; p++) {
        const opened = currentPage > p;
        const bones = pageBonesList[p];
        const targetRot = opened ? -Math.PI + 0.1 : 0.02 * p;

        if (bones && Array.isArray(bones)) {
          for (let i = 0; i < bones.length; i++) {
            const bone = bones[i];
            if (!bone) continue;
            const curveIntensity = Math.sin((i / bones.length) * Math.PI) * 0.04;
            const flexRot = targetRot * (i === 0 ? 1 : curveIntensity);

            bone.rotation.y = THREE.MathUtils.lerp(
              bone.rotation.y,
              flexRot,
              0.12
            );
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", handleResize);
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      sceneRef.current = null;
    };
  }, [title, author, description, currentPage, isFullscreen]);

  const setViewAngle = (preset: "front" | "spine" | "back" | "top" | "reset") => {
    if (!bookGroupRef.current) return;
    if (preset === "front") {
      bookGroupRef.current.rotation.set(0, 0, 0);
    } else if (preset === "spine") {
      bookGroupRef.current.rotation.set(0, -Math.PI / 2, 0);
    } else if (preset === "back") {
      bookGroupRef.current.rotation.set(0, -Math.PI, 0);
    } else if (preset === "top") {
      bookGroupRef.current.rotation.set(-Math.PI / 3, 0, 0);
    } else {
      bookGroupRef.current.rotation.set(0, -Math.PI / 6, 0);
    }
  };

  return (
    <div
      className={`flex flex-col items-center space-y-4 w-full transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 p-6 bg-white/95 dark:bg-neutral-950/95 text-neutral-900 dark:text-neutral-100 backdrop-blur-xl overflow-y-auto"
          : "relative"
      }`}
    >
      {/* Top Angle Presets & Fullscreen Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-800 dark:text-neutral-300 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="font-bold">3D Orbit Presets:</span>
          <button
            onClick={() => setViewAngle("front")}
            className="px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
          >
            Front
          </button>
          <button
            onClick={() => setViewAngle("spine")}
            className="px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
          >
            Spine
          </button>
          <button
            onClick={() => setViewAngle("back")}
            className="px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
          >
            Back
          </button>
          <button
            onClick={() => setViewAngle("top")}
            className="px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
          >
            Top
          </button>
        </div>

        <button
          onClick={() => setIsFullscreen((f) => !f)}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen 3D Stage"}
        </button>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        className={`w-full rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-2xl relative overflow-hidden select-none cursor-grab active:cursor-grabbing ${
          isFullscreen ? "h-[65vh]" : "h-[420px]"
        }`}
      />

      {/* Page Flip Controls Overlay */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-800 dark:text-neutral-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage <= 0}
            className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 disabled:opacity-40 font-semibold flex items-center gap-1 transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>

          <span className="font-mono text-xs px-3.5 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200">
            {currentPage === 0
              ? "Cover"
              : currentPage === totalSpreads
              ? "Back Cover"
              : `Page ${currentPage * 2 - 1} - ${currentPage * 2}`}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalSpreads, p + 1))}
            disabled={currentPage >= totalSpreads}
            className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 disabled:opacity-40 font-semibold flex items-center gap-1 transition-all"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted((m) => !m)}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            title="Page Flip Audio"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
          </button>

          {onOpenReader && (
            <button
              onClick={onOpenReader}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <BookOpen className="w-4 h-4" /> Read Document
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
