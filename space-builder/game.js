// Space Station Builder - Premium Version
// Beautiful 3D space station construction game

class SpaceStation {
    constructor() {
        // Core Three.js
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Camera control
        this.cameraOrbit = { theta: 0.8, phi: 0.5 };
        this.cameraDistance = 40;
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        
        // Interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedModuleType = 'core';
        this.deleteMode = false;
        
        // Station data
        this.modules = [];
        this.grid = new Map();
        this.connectionPoints = [];
        this.ghostModule = null;
        this.validPlacement = false;
        
        // Module definitions with connection ports
        this.moduleTypes = {
            core: {
                name: 'Ядро',
                energy: 10,
                crew: 2,
                ports: ['north', 'south', 'east', 'west', 'up', 'down'],
                size: { x: 1, y: 1, z: 1 }
            },
            corridor: {
                name: 'Коридор',
                energy: 0,
                crew: 0,
                ports: ['north', 'south'],
                size: { x: 1, y: 1, z: 2 }
            },
            habitat: {
                name: 'Жилой модуль',
                energy: -3,
                crew: 6,
                ports: ['north', 'south', 'east', 'west'],
                size: { x: 2, y: 1, z: 2 }
            },
            lab: {
                name: 'Лаборатория',
                energy: -5,
                crew: 3,
                ports: ['north', 'south'],
                size: { x: 2, y: 2, z: 2 }
            },
            solar: {
                name: 'Солн. панель',
                energy: 15,
                crew: 0,
                ports: ['down'],
                size: { x: 3, y: 0.2, z: 1 },
                attachOnly: true
            },
            storage: {
                name: 'Склад',
                energy: -1,
                crew: 0,
                ports: ['north', 'south'],
                size: { x: 1, y: 1, z: 1.5 }
            },
            dock: {
                name: 'Стыковочный узел',
                energy: -2,
                crew: 1,
                ports: ['south', 'up'],
                size: { x: 1.5, y: 1.5, z: 1.5 }
            },
            antenna: {
                name: 'Антенна',
                energy: -2,
                crew: 0,
                ports: ['down'],
                size: { x: 1, y: 2, z: 1 },
                attachOnly: true
            },
            engine: {
                name: 'Двигатель',
                energy: -8,
                crew: 0,
                ports: ['north'],
                size: { x: 1, y: 1, z: 1.5 }
            },
            greenhouse: {
                name: 'Теплица',
                energy: -2,
                crew: 1,
                ports: ['north', 'south'],
                size: { x: 2, y: 1.5, z: 2 }
            }
        };

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x030810);

        // Camera
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.updateCamera();

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        document.getElementById('game-container').insertBefore(
            this.renderer.domElement,
            document.getElementById('game-container').firstChild
        );

        // Setup scene
        this.createLighting();
        this.createEnvironment();
        this.createGrid();
        this.createGhostModule();
        
        // Events
        this.setupEvents();
        
        // Start animation
        this.animate();
        
        // Hide loading
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 500);
    }

    createLighting() {
        // Ambient light (space ambient)
        const ambient = new THREE.AmbientLight(0x1a2a4a, 0.4);
        this.scene.add(ambient);

        // Main sun light
        const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
        sunLight.position.set(50, 30, 40);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.camera.left = -50;
        sunLight.shadow.camera.right = 50;
        sunLight.shadow.camera.top = 50;
        sunLight.shadow.camera.bottom = -50;
        sunLight.shadow.bias = -0.0001;
        this.scene.add(sunLight);

        // Fill light (blue, from Earth reflection)
        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
        fillLight.position.set(-30, -20, 20);
        this.scene.add(fillLight);

        // Rim light
        const rimLight = new THREE.DirectionalLight(0xff8866, 0.2);
        rimLight.position.set(0, 10, -50);
        this.scene.add(rimLight);

        // Hemisphere light for ambient variation
        const hemiLight = new THREE.HemisphereLight(0x6688cc, 0x222244, 0.3);
        this.scene.add(hemiLight);
    }

    createEnvironment() {
        // Starfield
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 5000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let i = 0; i < starCount; i++) {
            const radius = 300 + Math.random() * 500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            const temp = Math.random();
            if (temp < 0.3) {
                colors[i * 3] = 1; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 0.6;
            } else if (temp < 0.6) {
                colors[i * 3] = 0.8; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1;
            } else {
                colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
            }

            sizes[i] = 0.5 + Math.random() * 1.5;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const starMaterial = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true
        });

        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);

        // Earth
        const earthGroup = new THREE.Group();
        
        // Earth sphere
        const earthGeo = new THREE.SphereGeometry(80, 64, 64);
        const earthMat = new THREE.MeshStandardMaterial({
            color: 0x1155aa,
            roughness: 0.8,
            metalness: 0.1,
            emissive: 0x112244,
            emissiveIntensity: 0.2
        });
        const earth = new THREE.Mesh(earthGeo, earthMat);
        earthGroup.add(earth);

        // Clouds
        const cloudGeo = new THREE.SphereGeometry(81, 48, 48);
        const cloudMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25,
            roughness: 1
        });
        this.clouds = new THREE.Mesh(cloudGeo, cloudMat);
        earthGroup.add(this.clouds);

        // Atmosphere glow
        const atmosGeo = new THREE.SphereGeometry(86, 32, 32);
        const atmosMat = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.12,
            side: THREE.BackSide
        });
        const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
        earthGroup.add(atmosphere);

        earthGroup.position.set(0, -120, -80);
        this.scene.add(earthGroup);
        this.earth = earthGroup;
    }

    createGrid() {
        // Construction grid
        const gridSize = 30;
        const divisions = 30;
        
        const gridHelper = new THREE.GridHelper(gridSize, divisions, 0x00aaff, 0x003366);
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.3;
        this.scene.add(gridHelper);

        // Invisible plane for raycasting
        const planeGeo = new THREE.PlaneGeometry(gridSize, gridSize);
        const planeMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
        this.groundPlane = new THREE.Mesh(planeGeo, planeMat);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.name = 'ground';
        this.scene.add(this.groundPlane);
    }

    // ==================== MODULE BUILDING ====================

    createModuleMesh(type, isGhost = false) {
        const config = this.moduleTypes[type];
        const group = new THREE.Group();
        group.userData = { type, config };

        // Materials
        const materials = this.createMaterials(type, isGhost);

        // Build specific module
        switch (type) {
            case 'core': this.buildCore(group, materials); break;
            case 'corridor': this.buildCorridor(group, materials); break;
            case 'habitat': this.buildHabitat(group, materials); break;
            case 'lab': this.buildLab(group, materials); break;
            case 'solar': this.buildSolar(group, materials); break;
            case 'storage': this.buildStorage(group, materials); break;
            case 'dock': this.buildDock(group, materials); break;
            case 'antenna': this.buildAntenna(group, materials); break;
            case 'engine': this.buildEngine(group, materials); break;
            case 'greenhouse': this.buildGreenhouse(group, materials); break;
        }

        // Add connection port indicators
        if (!isGhost) {
            this.addConnectionPorts(group, config.ports);
        }

        // Apply shadows
        if (!isGhost) {
            group.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }

        return group;
    }

    createMaterials(type, isGhost) {
        const colorMap = {
            core: 0x3b82f6,
            corridor: 0x64748b,
            habitat: 0x22c55e,
            lab: 0xe2e8f0,
            solar: 0x1e3a5f,
            storage: 0xf97316,
            dock: 0xef4444,
            antenna: 0x9ca3af,
            engine: 0xf59e0b,
            greenhouse: 0x4ade80
        };

        const baseColor = colorMap[type] || 0x888888;
        const opacity = isGhost ? 0.5 : 1;

        return {
            main: new THREE.MeshStandardMaterial({
                color: baseColor,
                metalness: 0.7,
                roughness: 0.3,
                transparent: isGhost,
                opacity: opacity
            }),
            dark: new THREE.MeshStandardMaterial({
                color: 0x1a1a2e,
                metalness: 0.8,
                roughness: 0.2,
                transparent: isGhost,
                opacity: opacity
            }),
            accent: new THREE.MeshStandardMaterial({
                color: 0x00d4ff,
                metalness: 0.9,
                roughness: 0.1,
                emissive: 0x00aaff,
                emissiveIntensity: 0.5,
                transparent: isGhost,
                opacity: opacity
            }),
            glass: new THREE.MeshStandardMaterial({
                color: 0xffffcc,
                metalness: 0.1,
                roughness: 0.1,
                emissive: 0xffff88,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: isGhost ? 0.3 : 0.8
            }),
            panel: new THREE.MeshStandardMaterial({
                color: 0x0a0a1a,
                metalness: 0.95,
                roughness: 0.05,
                transparent: isGhost,
                opacity: opacity
            }),
            frame: new THREE.MeshStandardMaterial({
                color: 0x888899,
                metalness: 0.8,
                roughness: 0.2,
                transparent: isGhost,
                opacity: opacity
            })
        };
    }

    buildCore(group, mat) {
        // Main octagonal body
        const bodyGeo = new THREE.CylinderGeometry(1.5, 1.5, 2.5, 8);
        const body = new THREE.Mesh(bodyGeo, mat.main);
        body.rotation.y = Math.PI / 8;
        group.add(body);

        // End caps with detail
        const capGeo = new THREE.CylinderGeometry(1.3, 1.5, 0.4, 8);
        [1.45, -1.45].forEach(y => {
            const cap = new THREE.Mesh(capGeo, mat.dark);
            cap.position.y = y;
            cap.rotation.y = Math.PI / 8;
            group.add(cap);
        });

        // Connection ports (6 directions)
        const portGeo = new THREE.CylinderGeometry(0.5, 0.55, 0.6, 16);
        const portPositions = [
            { pos: [2, 0, 0], rot: [0, 0, Math.PI / 2] },
            { pos: [-2, 0, 0], rot: [0, 0, -Math.PI / 2] },
            { pos: [0, 0, 2], rot: [Math.PI / 2, 0, 0] },
            { pos: [0, 0, -2], rot: [-Math.PI / 2, 0, 0] },
            { pos: [0, 1.75, 0], rot: [0, 0, 0] },
            { pos: [0, -1.75, 0], rot: [Math.PI, 0, 0] }
        ];

        portPositions.forEach(p => {
            const port = new THREE.Mesh(portGeo, mat.dark);
            port.position.set(...p.pos);
            port.rotation.set(...p.rot);
            group.add(port);

            // Glowing ring
            const ringGeo = new THREE.TorusGeometry(0.45, 0.06, 8, 24);
            const ring = new THREE.Mesh(ringGeo, mat.accent);
            ring.position.set(...p.pos);
            ring.rotation.set(...p.rot);
            ring.rotation.x += Math.PI / 2;
            group.add(ring);
        });

        // Windows
        const windowGeo = new THREE.CircleGeometry(0.25, 16);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
            const win = new THREE.Mesh(windowGeo, mat.glass);
            win.position.set(Math.cos(angle) * 1.51, 0.5, Math.sin(angle) * 1.51);
            win.lookAt(Math.cos(angle) * 3, 0.5, Math.sin(angle) * 3);
            group.add(win);
        }
    }

    buildCorridor(group, mat) {
        // Main tube
        const tubeGeo = new THREE.CylinderGeometry(0.8, 0.8, 3, 16);
        const tube = new THREE.Mesh(tubeGeo, mat.main);
        tube.rotation.x = Math.PI / 2;
        group.add(tube);

        // End connectors
        const endGeo = new THREE.CylinderGeometry(0.85, 0.75, 0.4, 16);
        [-1.7, 1.7].forEach(z => {
            const end = new THREE.Mesh(endGeo, mat.dark);
            end.position.z = z;
            end.rotation.x = Math.PI / 2;
            group.add(end);
        });

        // Support rings
        const ringGeo = new THREE.TorusGeometry(0.82, 0.08, 8, 24);
        [-1, 0, 1].forEach(z => {
            const ring = new THREE.Mesh(ringGeo, mat.frame);
            ring.position.z = z;
            group.add(ring);
        });

        // Windows on top
        const winGeo = new THREE.PlaneGeometry(0.3, 0.5);
        [-0.5, 0.5].forEach(z => {
            const win = new THREE.Mesh(winGeo, mat.glass);
            win.position.set(0, 0.81, z);
            win.rotation.x = -Math.PI / 2;
            group.add(win);
        });

        // Interior lights
        const lightGeo = new THREE.BoxGeometry(0.1, 0.05, 2.5);
        const light = new THREE.Mesh(lightGeo, mat.accent);
        light.position.y = 0.7;
        group.add(light);
    }

    buildHabitat(group, mat) {
        // Main cylinder body
        const bodyGeo = new THREE.CylinderGeometry(1.4, 1.4, 3, 24);
        const body = new THREE.Mesh(bodyGeo, mat.main);
        group.add(body);

        // Rounded end caps
        const capGeo = new THREE.SphereGeometry(1.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const topCap = new THREE.Mesh(capGeo, mat.main);
        topCap.position.y = 1.5;
        group.add(topCap);
        
        const bottomCap = new THREE.Mesh(capGeo, mat.main);
        bottomCap.position.y = -1.5;
        bottomCap.rotation.x = Math.PI;
        group.add(bottomCap);

        // Windows - 3 rows
        const winGeo = new THREE.CircleGeometry(0.2, 16);
        for (let row = 0; row < 3; row++) {
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const win = new THREE.Mesh(winGeo, mat.glass);
                win.position.set(
                    Math.cos(angle) * 1.41,
                    1 - row * 1,
                    Math.sin(angle) * 1.41
                );
                win.lookAt(Math.cos(angle) * 3, 1 - row * 1, Math.sin(angle) * 3);
                group.add(win);
            }
        }

        // Connection ports
        const portGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.5, 12);
        [[1.6, 0, 0], [-1.6, 0, 0], [0, 0, 1.6], [0, 0, -1.6]].forEach(pos => {
            const port = new THREE.Mesh(portGeo, mat.dark);
            port.position.set(...pos);
            if (pos[0] !== 0) port.rotation.z = Math.PI / 2;
            if (pos[2] !== 0) port.rotation.x = Math.PI / 2;
            group.add(port);
        });

        // Decorative bands
        const bandGeo = new THREE.TorusGeometry(1.42, 0.05, 8, 32);
        [-0.8, 0, 0.8].forEach(y => {
            const band = new THREE.Mesh(bandGeo, mat.frame);
            band.position.y = y;
            band.rotation.x = Math.PI / 2;
            group.add(band);
        });
    }

    buildLab(group, mat) {
        // Spherical main body
        const sphereGeo = new THREE.SphereGeometry(1.8, 32, 32);
        const sphere = new THREE.Mesh(sphereGeo, mat.main);
        group.add(sphere);

        // Equipment ring
        const ringGeo = new THREE.TorusGeometry(1.5, 0.15, 12, 32);
        const ring = new THREE.Mesh(ringGeo, mat.frame);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        // Second ring perpendicular
        const ring2 = new THREE.Mesh(ringGeo, mat.frame);
        ring2.rotation.z = Math.PI / 2;
        group.add(ring2);

        // Large observation window
        const windowGeo = new THREE.CircleGeometry(0.6, 32);
        const window1 = new THREE.Mesh(windowGeo, mat.glass);
        window1.position.set(0, 0.8, 1.65);
        window1.lookAt(0, 0.8, 3);
        group.add(window1);

        // Connection tubes
        const tubeGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.8, 12);
        [[2.1, 0, 0], [-2.1, 0, 0]].forEach(pos => {
            const tube = new THREE.Mesh(tubeGeo, mat.dark);
            tube.position.set(...pos);
            tube.rotation.z = Math.PI / 2;
            group.add(tube);
        });

        // Scientific equipment pods
        const podGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.6, 8);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const pod = new THREE.Mesh(podGeo, mat.accent);
            pod.position.set(Math.cos(angle) * 1.3, -1.2, Math.sin(angle) * 1.3);
            group.add(pod);
        }
    }

    buildSolar(group, mat) {
        // Central hub/mount
        const hubGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.5, 8);
        const hub = new THREE.Mesh(hubGeo, mat.dark);
        hub.position.y = -0.1;
        group.add(hub);

        // Rotator mechanism
        const rotatorGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 12);
        const rotator = new THREE.Mesh(rotatorGeo, mat.frame);
        rotator.rotation.x = Math.PI / 2;
        group.add(rotator);

        // Solar panels - both sides
        [-1, 1].forEach(side => {
            const panelGroup = new THREE.Group();

            // Main panel surface
            const panelGeo = new THREE.BoxGeometry(3, 0.05, 1.5);
            const panel = new THREE.Mesh(panelGeo, mat.panel);
            panelGroup.add(panel);

            // Panel frame
            const frameTop = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.08), mat.frame);
            frameTop.position.z = 0.75;
            panelGroup.add(frameTop);

            const frameBot = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.08), mat.frame);
            frameBot.position.z = -0.75;
            panelGroup.add(frameBot);

            const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.5), mat.frame);
            frameLeft.position.x = -1.55;
            panelGroup.add(frameLeft);

            const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.5), mat.frame);
            frameRight.position.x = 1.55;
            panelGroup.add(frameRight);

            // Grid lines
            for (let i = -1; i <= 1; i++) {
                if (i === 0) continue;
                const gridLine = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 0.03), mat.frame);
                gridLine.position.z = i * 0.5;
                panelGroup.add(gridLine);
            }

            for (let i = -2; i <= 2; i++) {
                const gridLine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 1.5), mat.frame);
                gridLine.position.x = i * 0.6;
                panelGroup.add(gridLine);
            }

            // Arm connecting to hub
            const armGeo = new THREE.BoxGeometry(0.8, 0.1, 0.1);
            const arm = new THREE.Mesh(armGeo, mat.frame);
            arm.position.x = side * -1.1;
            panelGroup.add(arm);

            panelGroup.position.x = side * 2.2;
            group.add(panelGroup);
        });
    }

    buildStorage(group, mat) {
        // Main container body
        const bodyGeo = new THREE.BoxGeometry(1.8, 1.6, 2.2);
        const body = new THREE.Mesh(bodyGeo, mat.main);
        group.add(body);

        // Reinforcement straps
        const strapGeo = new THREE.BoxGeometry(0.12, 1.62, 2.22);
        [-0.6, 0, 0.6].forEach(x => {
            const strap = new THREE.Mesh(strapGeo, mat.dark);
            strap.position.x = x;
            group.add(strap);
        });

        // Handles
        const handleGeo = new THREE.BoxGeometry(0.2, 0.5, 0.1);
        [[0.91, 0.3, 0], [0.91, -0.3, 0], [-0.91, 0.3, 0], [-0.91, -0.3, 0]].forEach(pos => {
            const handle = new THREE.Mesh(handleGeo, mat.frame);
            handle.position.set(...pos);
            group.add(handle);
        });

        // Warning labels (colored strips)
        const labelGeo = new THREE.BoxGeometry(0.5, 0.15, 2.23);
        const labelMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.3, roughness: 0.6 });
        [0.5, -0.5].forEach(y => {
            const label = new THREE.Mesh(labelGeo, labelMat);
            label.position.set(0, y, 0);
            group.add(label);
        });

        // Connection ports
        const portGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.4, 12);
        [[0, 0, 1.3], [0, 0, -1.3]].forEach(pos => {
            const port = new THREE.Mesh(portGeo, mat.dark);
            port.position.set(...pos);
            port.rotation.x = Math.PI / 2;
            group.add(port);
        });
    }

    buildDock(group, mat) {
        // Main docking ring
        const ringGeo = new THREE.TorusGeometry(1.2, 0.25, 16, 32);
        const ring = new THREE.Mesh(ringGeo, mat.main);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.8;
        group.add(ring);

        // Inner guidance ring
        const innerRingGeo = new THREE.TorusGeometry(0.8, 0.08, 12, 24);
        const innerRing = new THREE.Mesh(innerRingGeo, mat.accent);
        innerRing.rotation.x = Math.PI / 2;
        innerRing.position.y = 0.8;
        group.add(innerRing);

        // Support structure
        const supportGeo = new THREE.CylinderGeometry(0.9, 1.1, 1.2, 16);
        const support = new THREE.Mesh(supportGeo, mat.dark);
        support.position.y = 0;
        group.add(support);

        // Guide lights
        const lightColors = [0x00ff00, 0xff0000, 0x00ff00, 0xff0000];
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const lightGeo = new THREE.SphereGeometry(0.1, 8, 8);
            const lightMat = new THREE.MeshBasicMaterial({ color: lightColors[i] });
            const light = new THREE.Mesh(lightGeo, lightMat);
            light.position.set(Math.cos(angle) * 1.2, 0.8, Math.sin(angle) * 1.2);
            group.add(light);
        }

        // Bottom connector
        const connGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.5, 12);
        const conn = new THREE.Mesh(connGeo, mat.dark);
        conn.position.y = -0.85;
        group.add(conn);

        // Struts
        const strutGeo = new THREE.BoxGeometry(0.1, 1.2, 0.1);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const strut = new THREE.Mesh(strutGeo, mat.frame);
            strut.position.set(Math.cos(angle) * 0.9, 0.2, Math.sin(angle) * 0.9);
            group.add(strut);
        }
    }

    buildAntenna(group, mat) {
        // Dish
        const dishGeo = new THREE.SphereGeometry(1.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.2);
        const dish = new THREE.Mesh(dishGeo, mat.main);
        dish.rotation.x = Math.PI;
        dish.position.y = 1.5;
        group.add(dish);

        // Dish inner surface (reflector)
        const innerDishGeo = new THREE.SphereGeometry(1.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.2);
        const innerDishMat = new THREE.MeshStandardMaterial({
            color: 0x222233,
            metalness: 0.95,
            roughness: 0.05
        });
        const innerDish = new THREE.Mesh(innerDishGeo, innerDishMat);
        innerDish.rotation.x = Math.PI;
        innerDish.position.y = 1.5;
        group.add(innerDish);

        // Feed horn at focal point
        const feedGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
        const feed = new THREE.Mesh(feedGeo, mat.dark);
        feed.position.y = 1.1;
        feed.rotation.x = Math.PI;
        group.add(feed);

        // Support struts for feed
        const strutGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 4);
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const strut = new THREE.Mesh(strutGeo, mat.frame);
            strut.position.set(Math.cos(angle) * 0.5, 1.3, Math.sin(angle) * 0.5);
            strut.rotation.z = Math.cos(angle) * 0.4;
            strut.rotation.x = -Math.sin(angle) * 0.4;
            group.add(strut);
        }

        // Mount/base
        const mountGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.8, 12);
        const mount = new THREE.Mesh(mountGeo, mat.dark);
        mount.position.y = -0.1;
        group.add(mount);

        // Signal indicator light
        const indicatorGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const indicatorMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
        indicator.position.y = 0.9;
        group.add(indicator);
        group.userData.indicator = indicator;
    }

    buildEngine(group, mat) {
        // Main engine housing
        const housingGeo = new THREE.CylinderGeometry(0.8, 1, 2, 16);
        const housing = new THREE.Mesh(housingGeo, mat.main);
        group.add(housing);

        // Nozzle
        const nozzleGeo = new THREE.CylinderGeometry(0.6, 0.95, 1.2, 16, 1, true);
        const nozzleMat = new THREE.MeshStandardMaterial({
            color: 0x333344,
            metalness: 0.9,
            roughness: 0.2,
            side: THREE.DoubleSide
        });
        const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
        nozzle.position.y = -1.5;
        group.add(nozzle);

        // Inner glow
        const glowGeo = new THREE.CylinderGeometry(0.55, 0.85, 1, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.6
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = -1.4;
        group.add(glow);
        group.userData.glow = glow;

        // Exhaust plume
        const plumeGeo = new THREE.ConeGeometry(0.7, 2.5, 16);
        const plumeMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.35
        });
        const plume = new THREE.Mesh(plumeGeo, plumeMat);
        plume.position.y = -3;
        plume.rotation.x = Math.PI;
        group.add(plume);
        group.userData.plume = plume;

        // Fuel pipes
        const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const pipe = new THREE.Mesh(pipeGeo, mat.frame);
            pipe.position.set(Math.cos(angle) * 0.7, -0.2, Math.sin(angle) * 0.7);
            group.add(pipe);
        }

        // Top connector
        const connGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.5, 12);
        const conn = new THREE.Mesh(connGeo, mat.dark);
        conn.position.y = 1.25;
        group.add(conn);
    }

    buildGreenhouse(group, mat) {
        // Glass dome
        const domeGeo = new THREE.SphereGeometry(1.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0xaaffaa,
            metalness: 0.1,
            roughness: 0.1,
            transparent: true,
            opacity: 0.4
        });
        const dome = new THREE.Mesh(domeGeo, glassMat);
        dome.position.y = 0.5;
        group.add(dome);

        // Dome frame
        const frameRingGeo = new THREE.TorusGeometry(1.5, 0.05, 8, 32);
        const frameRing = new THREE.Mesh(frameRingGeo, mat.frame);
        frameRing.position.y = 0.5;
        frameRing.rotation.x = Math.PI / 2;
        group.add(frameRing);

        // Vertical frame struts
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const strutGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4);
            const strut = new THREE.Mesh(strutGeo, mat.frame);
            strut.position.set(
                Math.cos(angle) * 1.45,
                1,
                Math.sin(angle) * 1.45
            );
            strut.rotation.z = -Math.cos(angle) * 0.5;
            strut.rotation.x = Math.sin(angle) * 0.5;
            group.add(strut);
        }

        // Base platform
        const baseGeo = new THREE.CylinderGeometry(1.5, 1.6, 0.6, 24);
        const base = new THREE.Mesh(baseGeo, mat.main);
        base.position.y = 0.2;
        group.add(base);

        // Plants
        const plantMat = new THREE.MeshStandardMaterial({ color: 0x228822 });
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const plantGeo = new THREE.ConeGeometry(0.2, 0.7, 6);
            const plant = new THREE.Mesh(plantGeo, plantMat);
            plant.position.set(Math.cos(angle) * 0.7, 0.85, Math.sin(angle) * 0.7);
            group.add(plant);
        }

        // Center plant
        const centerPlantGeo = new THREE.ConeGeometry(0.25, 1, 6);
        const centerPlant = new THREE.Mesh(centerPlantGeo, plantMat);
        centerPlant.position.y = 1;
        group.add(centerPlant);

        // Grow lights
        const lightGeo = new THREE.BoxGeometry(0.3, 0.08, 0.15);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff88ff });
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const light = new THREE.Mesh(lightGeo, lightMat);
            light.position.set(Math.cos(angle) * 1.1, 1.4, Math.sin(angle) * 1.1);
            light.lookAt(0, 0.8, 0);
            group.add(light);
        }

        // Connection ports
        const portGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.4, 12);
        [[1.8, 0.2, 0], [-1.8, 0.2, 0]].forEach(pos => {
            const port = new THREE.Mesh(portGeo, mat.dark);
            port.position.set(...pos);
            port.rotation.z = Math.PI / 2;
            group.add(port);
        });
    }

    addConnectionPorts(group, ports) {
        // Visual connection indicators (small glowing spheres)
        const portPositions = {
            north: [0, 0, -2],
            south: [0, 0, 2],
            east: [2, 0, 0],
            west: [-2, 0, 0],
            up: [0, 2, 0],
            down: [0, -0.5, 0]
        };

        ports.forEach(port => {
            const pos = portPositions[port];
            if (pos) {
                const indicator = new THREE.Mesh(
                    new THREE.SphereGeometry(0.15, 8, 8),
                    new THREE.MeshBasicMaterial({
                        color: 0x00ff88,
                        transparent: true,
                        opacity: 0.6
                    })
                );
                indicator.position.set(...pos);
                indicator.visible = false;
                indicator.userData.isPortIndicator = true;
                indicator.userData.portDirection = port;
                group.add(indicator);
            }
        });
    }

    // ==================== GHOST MODULE ====================

    createGhostModule() {
        this.ghostModule = this.createModuleMesh(this.selectedModuleType, true);
        this.ghostModule.visible = false;
        this.scene.add(this.ghostModule);
    }

    updateGhostModule() {
        this.scene.remove(this.ghostModule);
        this.ghostModule = this.createModuleMesh(this.selectedModuleType, true);
        this.ghostModule.visible = false;
        this.scene.add(this.ghostModule);
    }

    // ==================== PLACEMENT LOGIC ====================

    getGridPosition() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.groundPlane);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            return {
                x: Math.round(point.x / 2) * 2,
                y: 0,
                z: Math.round(point.z / 2) * 2
            };
        }
        return null;
    }

    canPlaceAt(x, y, z) {
        const key = `${x},${y},${z}`;
        
        // Check if position is occupied
        if (this.grid.has(key)) {
            return false;
        }

        // First module can be placed anywhere
        if (this.modules.length === 0) {
            return true;
        }

        // Check if adjacent to existing module
        const neighbors = [
            [x + 2, y, z], [x - 2, y, z],
            [x, y, z + 2], [x, y, z - 2],
            [x, y + 2, z], [x, y - 2, z]
        ];

        for (const [nx, ny, nz] of neighbors) {
            const nkey = `${nx},${ny},${nz}`;
            if (this.grid.has(nkey)) {
                return true;
            }
        }

        return false;
    }

    updateGhostPosition() {
        if (this.deleteMode) {
            this.ghostModule.visible = false;
            return;
        }

        const pos = this.getGridPosition();
        if (pos) {
            this.ghostModule.position.set(pos.x, pos.y, pos.z);
            this.ghostModule.visible = true;
            
            this.validPlacement = this.canPlaceAt(pos.x, pos.y, pos.z);
            
            // Update ghost opacity based on validity
            this.ghostModule.traverse(child => {
                if (child.material && child.material.opacity !== undefined) {
                    child.material.opacity = this.validPlacement ? 0.6 : 0.2;
                    if (child.material.emissive) {
                        child.material.emissiveIntensity = this.validPlacement ? 0.5 : 0.1;
                    }
                }
            });

            // Update connection hint
            const hint = document.getElementById('connection-hint');
            hint.classList.toggle('active', this.validPlacement && this.modules.length > 0);
        } else {
            this.ghostModule.visible = false;
        }
    }

    placeModule() {
        if (this.deleteMode) return;
        
        const pos = this.getGridPosition();
        if (!pos || !this.canPlaceAt(pos.x, pos.y, pos.z)) return;

        const module = this.createModuleMesh(this.selectedModuleType);
        module.position.set(pos.x, pos.y, pos.z);
        module.userData.gridPos = { x: pos.x, y: pos.y, z: pos.z };

        // Animate placement
        module.scale.set(0.01, 0.01, 0.01);
        this.animateScale(module, 1);

        this.scene.add(module);
        this.modules.push(module);
        this.grid.set(`${pos.x},${pos.y},${pos.z}`, module);

        this.updateStats();
        
        // Hide connection hint
        document.getElementById('connection-hint').classList.remove('active');
    }

    deleteModuleAt(x, y, z) {
        const key = `${x},${y},${z}`;
        const module = this.grid.get(key);
        
        if (module) {
            this.animateScale(module, 0, () => {
                this.scene.remove(module);
                this.modules = this.modules.filter(m => m !== module);
                this.grid.delete(key);
                this.updateStats();
            });
        }
    }

    tryDeleteModule() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const meshes = [];
        this.modules.forEach(m => {
            m.traverse(child => {
                if (child.isMesh) meshes.push(child);
            });
        });

        const intersects = this.raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
            let target = intersects[0].object;
            while (target.parent && !target.userData.type) {
                target = target.parent;
            }
            if (target.userData.gridPos) {
                const { x, y, z } = target.userData.gridPos;
                this.deleteModuleAt(x, y, z);
            }
        }
    }

    animateScale(obj, targetScale, callback) {
        const startScale = obj.scale.x;
        const duration = 300;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Elastic easing
            const eased = targetScale > startScale
                ? 1 - Math.pow(1 - progress, 3)
                : progress * progress * progress;
            
            const scale = startScale + (targetScale - startScale) * eased;
            obj.scale.set(scale, scale, scale);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (callback) {
                callback();
            }
        };
        
        if (targetScale > startScale && startScale < 0.1) {
            obj.scale.set(0.01, 0.01, 0.01);
        }
        animate();
    }

    // ==================== UI ====================

    updateStats() {
        let energy = 0, crew = 0;
        
        this.modules.forEach(m => {
            const config = this.moduleTypes[m.userData.type];
            if (config) {
                energy += config.energy;
                crew += config.crew;
            }
        });

        document.getElementById('stat-modules').textContent = this.modules.length;
        
        const energyEl = document.getElementById('stat-energy');
        energyEl.textContent = (energy >= 0 ? '+' : '') + energy;
        energyEl.className = 'stat-value ' + (energy >= 0 ? 'positive' : 'negative');
        
        document.getElementById('stat-crew').textContent = crew;
    }

    // ==================== CAMERA ====================

    updateCamera() {
        const x = Math.sin(this.cameraOrbit.theta) * Math.cos(this.cameraOrbit.phi) * this.cameraDistance;
        const y = Math.sin(this.cameraOrbit.phi) * this.cameraDistance;
        const z = Math.cos(this.cameraOrbit.theta) * Math.cos(this.cameraOrbit.phi) * this.cameraDistance;
        
        this.camera.position.set(
            this.cameraTarget.x + x,
            this.cameraTarget.y + y,
            this.cameraTarget.z + z
        );
        this.camera.lookAt(this.cameraTarget);
    }

    // ==================== EVENTS ====================

    setupEvents() {
        const canvas = this.renderer.domElement;

        // Touch events
        let touchStart = null;
        let lastTouchTime = 0;
        let lastPinchDist = null;

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                touchStart = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                    time: Date.now()
                };
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1 && touchStart) {
                const dx = e.touches[0].clientX - touchStart.x;
                const dy = e.touches[0].clientY - touchStart.y;
                
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    this.cameraOrbit.theta += dx * 0.005;
                    this.cameraOrbit.phi = Math.max(0.1, Math.min(1.4, this.cameraOrbit.phi + dy * 0.005));
                    this.updateCamera();
                    touchStart.x = e.touches[0].clientX;
                    touchStart.y = e.touches[0].clientY;
                }
                
                this.updateMousePosition(e.touches[0].clientX, e.touches[0].clientY);
                this.updateGhostPosition();
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                if (lastPinchDist !== null) {
                    const delta = lastPinchDist - dist;
                    this.cameraDistance = Math.max(20, Math.min(80, this.cameraDistance + delta * 0.1));
                    this.updateCamera();
                }
                lastPinchDist = dist;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            lastPinchDist = null;

            if (touchStart && e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - touchStart.x;
                const dy = e.changedTouches[0].clientY - touchStart.y;
                const dist = Math.hypot(dx, dy);
                const elapsed = Date.now() - touchStart.time;

                if (dist < 15 && elapsed < 300) {
                    const now = Date.now();
                    this.updateMousePosition(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
                    
                    if (now - lastTouchTime < 300) {
                        // Double tap - delete
                        this.tryDeleteModule();
                    } else {
                        // Single tap
                        if (this.deleteMode) {
                            this.tryDeleteModule();
                        } else {
                            this.placeModule();
                        }
                    }
                    lastTouchTime = now;
                }
            }
            touchStart = null;
        }, { passive: false });

        // Mouse events
        canvas.addEventListener('mousemove', (e) => {
            this.updateMousePosition(e.clientX, e.clientY);
            this.updateGhostPosition();
        });

        canvas.addEventListener('click', (e) => {
            this.updateMousePosition(e.clientX, e.clientY);
            if (this.deleteMode) {
                this.tryDeleteModule();
            } else {
                this.placeModule();
            }
        });

        canvas.addEventListener('dblclick', (e) => {
            this.updateMousePosition(e.clientX, e.clientY);
            this.tryDeleteModule();
        });

        // Module buttons
        document.querySelectorAll('.module-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.module-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedModuleType = btn.dataset.module;
                this.deleteMode = false;
                document.getElementById('btn-delete').classList.remove('active');
                this.updateGhostModule();
            });
        });

        // Control buttons
        document.getElementById('btn-left').addEventListener('click', () => {
            this.cameraOrbit.theta -= 0.3;
            this.updateCamera();
        });
        document.getElementById('btn-right').addEventListener('click', () => {
            this.cameraOrbit.theta += 0.3;
            this.updateCamera();
        });
        document.getElementById('btn-up').addEventListener('click', () => {
            this.cameraOrbit.phi = Math.min(1.4, this.cameraOrbit.phi + 0.15);
            this.updateCamera();
        });
        document.getElementById('btn-down').addEventListener('click', () => {
            this.cameraOrbit.phi = Math.max(0.1, this.cameraOrbit.phi - 0.15);
            this.updateCamera();
        });
        document.getElementById('btn-zoom-in').addEventListener('click', () => {
            this.cameraDistance = Math.max(20, this.cameraDistance - 5);
            this.updateCamera();
        });
        document.getElementById('btn-zoom-out').addEventListener('click', () => {
            this.cameraDistance = Math.min(80, this.cameraDistance + 5);
            this.updateCamera();
        });
        document.getElementById('btn-delete').addEventListener('click', () => {
            this.deleteMode = !this.deleteMode;
            document.getElementById('btn-delete').classList.toggle('active', this.deleteMode);
            this.ghostModule.visible = false;
        });

        // Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    updateMousePosition(x, y) {
        this.mouse.x = (x / window.innerWidth) * 2 - 1;
        this.mouse.y = -(y / window.innerHeight) * 2 + 1;
    }

    // ==================== ANIMATION ====================

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // Rotate stars slowly
        if (this.stars) {
            this.stars.rotation.y += 0.00005;
        }

        // Rotate clouds on Earth
        if (this.clouds) {
            this.clouds.rotation.y += 0.0001;
        }

        // Earth rotation
        if (this.earth) {
            this.earth.rotation.y += 0.00003;
        }

        // Animate modules
        this.modules.forEach((module, i) => {
            // Antenna rotation
            if (module.userData.type === 'antenna') {
                module.children[0].rotation.y = time * 0.3;
            }
            
            // Engine flame flicker
            if (module.userData.type === 'engine') {
                const glow = module.userData.glow;
                const plume = module.userData.plume;
                if (glow) glow.material.opacity = 0.4 + Math.sin(time * 10) * 0.2;
                if (plume) {
                    plume.scale.y = 0.8 + Math.sin(time * 8) * 0.2;
                    plume.material.opacity = 0.25 + Math.sin(time * 12) * 0.1;
                }
            }

            // Indicator blink for antenna
            if (module.userData.indicator) {
                module.userData.indicator.material.opacity = 0.5 + Math.sin(time * 3) * 0.5;
            }
        });

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize
window.addEventListener('load', () => {
    window.game = new SpaceStation();
});
