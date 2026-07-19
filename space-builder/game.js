// Space Station Builder - Perfect Connection System
// Modules snap together port-to-port

class SpaceStation {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Camera
        this.camAngle = 0.7;
        this.camPitch = 0.5;
        this.camDist = 50;
        this.camTarget = new THREE.Vector3(0, 0, 0);
        
        // Interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedType = 'core';
        this.deleteMode = false;
        
        // Station
        this.modules = [];
        this.openPorts = []; // Available connection points
        this.ghostModule = null;
        this.snapTarget = null; // Port we're snapping to
        
        // Module configs - all use same unit size for perfect alignment
        this.configs = {
            core: {
                name: 'Ядро',
                energy: 10,
                crew: 2,
                ports: [
                    { dir: 'px', pos: [1.5, 0, 0], rot: [0, 0, -Math.PI/2] },
                    { dir: 'nx', pos: [-1.5, 0, 0], rot: [0, 0, Math.PI/2] },
                    { dir: 'pz', pos: [0, 0, 1.5], rot: [Math.PI/2, 0, 0] },
                    { dir: 'nz', pos: [0, 0, -1.5], rot: [-Math.PI/2, 0, 0] },
                    { dir: 'py', pos: [0, 1.5, 0], rot: [0, 0, 0] },
                    { dir: 'ny', pos: [0, -1.5, 0], rot: [Math.PI, 0, 0] }
                ]
            },
            corridor: {
                name: 'Коридор',
                energy: 0,
                crew: 0,
                ports: [
                    { dir: 'pz', pos: [0, 0, 1.5], rot: [Math.PI/2, 0, 0] },
                    { dir: 'nz', pos: [0, 0, -1.5], rot: [-Math.PI/2, 0, 0] }
                ]
            },
            habitat: {
                name: 'Жилой',
                energy: -3,
                crew: 6,
                ports: [
                    { dir: 'px', pos: [1.5, 0, 0], rot: [0, 0, -Math.PI/2] },
                    { dir: 'nx', pos: [-1.5, 0, 0], rot: [0, 0, Math.PI/2] },
                    { dir: 'pz', pos: [0, 0, 1.5], rot: [Math.PI/2, 0, 0] },
                    { dir: 'nz', pos: [0, 0, -1.5], rot: [-Math.PI/2, 0, 0] }
                ]
            },
            lab: {
                name: 'Лаборатория',
                energy: -5,
                crew: 3,
                ports: [
                    { dir: 'px', pos: [1.5, 0, 0], rot: [0, 0, -Math.PI/2] },
                    { dir: 'nx', pos: [-1.5, 0, 0], rot: [0, 0, Math.PI/2] }
                ]
            },
            solar: {
                name: 'Солн. панель',
                energy: 15,
                crew: 0,
                ports: [
                    { dir: 'ny', pos: [0, -0.3, 0], rot: [Math.PI, 0, 0] }
                ]
            },
            storage: {
                name: 'Склад',
                energy: -1,
                crew: 0,
                ports: [
                    { dir: 'pz', pos: [0, 0, 1.5], rot: [Math.PI/2, 0, 0] },
                    { dir: 'nz', pos: [0, 0, -1.5], rot: [-Math.PI/2, 0, 0] }
                ]
            },
            dock: {
                name: 'Док',
                energy: -2,
                crew: 1,
                ports: [
                    { dir: 'ny', pos: [0, -1, 0], rot: [Math.PI, 0, 0] },
                    { dir: 'py', pos: [0, 1, 0], rot: [0, 0, 0] }
                ]
            },
            antenna: {
                name: 'Антенна',
                energy: -2,
                crew: 0,
                ports: [
                    { dir: 'ny', pos: [0, -0.5, 0], rot: [Math.PI, 0, 0] }
                ]
            },
            engine: {
                name: 'Двигатель',
                energy: -8,
                crew: 0,
                ports: [
                    { dir: 'py', pos: [0, 1.2, 0], rot: [0, 0, 0] }
                ]
            },
            greenhouse: {
                name: 'Теплица',
                energy: -2,
                crew: 1,
                ports: [
                    { dir: 'px', pos: [1.5, 0, 0], rot: [0, 0, -Math.PI/2] },
                    { dir: 'nx', pos: [-1.5, 0, 0], rot: [0, 0, Math.PI/2] }
                ]
            }
        };

        // Opposite directions for port matching
        this.opposites = {
            'px': 'nx', 'nx': 'px',
            'py': 'ny', 'ny': 'py',
            'pz': 'nz', 'nz': 'pz'
        };

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020408);

        // Camera
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.updateCamera();

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').prepend(this.renderer.domElement);

        this.createLights();
        this.createSpace();
        this.createGhost();
        this.setupEvents();
        
        // Place initial core
        this.placeInitialCore();
        
        this.animate();
        
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 300);
    }

    createLights() {
        // Ambient
        this.scene.add(new THREE.AmbientLight(0x334466, 0.5));

        // Sun
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(40, 30, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 200;
        sun.shadow.camera.left = -50;
        sun.shadow.camera.right = 50;
        sun.shadow.camera.top = 50;
        sun.shadow.camera.bottom = -50;
        this.scene.add(sun);

        // Fill
        const fill = new THREE.DirectionalLight(0x4488ff, 0.4);
        fill.position.set(-20, -10, -20);
        this.scene.add(fill);
    }

    createSpace() {
        // Stars
        const starsGeo = new THREE.BufferGeometry();
        const starPos = [];
        for (let i = 0; i < 4000; i++) {
            const r = 500 + Math.random() * 500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            starPos.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );
        }
        starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5 }));
        this.scene.add(stars);
        this.stars = stars;

        // Earth
        const earthGeo = new THREE.SphereGeometry(100, 64, 64);
        const earthMat = new THREE.MeshStandardMaterial({
            color: 0x2244aa,
            emissive: 0x112233,
            roughness: 0.8
        });
        const earth = new THREE.Mesh(earthGeo, earthMat);
        earth.position.set(0, -150, -100);
        this.scene.add(earth);

        // Atmosphere
        const atmosGeo = new THREE.SphereGeometry(105, 32, 32);
        const atmosMat = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });
        const atmos = new THREE.Mesh(atmosGeo, atmosMat);
        atmos.position.copy(earth.position);
        this.scene.add(atmos);
    }

    // ===================== MODULE BUILDING =====================

    createModule(type, isGhost = false) {
        const group = new THREE.Group();
        const config = this.configs[type];
        group.userData = { type, config };

        const opacity = isGhost ? 0.5 : 1;
        
        // Materials
        const colors = {
            core: 0x4488ff,
            corridor: 0x778899,
            habitat: 0x44bb66,
            lab: 0xddddee,
            solar: 0x223366,
            storage: 0xee8833,
            dock: 0xee4444,
            antenna: 0x999999,
            engine: 0xffaa22,
            greenhouse: 0x55dd77
        };

        const mainMat = new THREE.MeshStandardMaterial({
            color: colors[type],
            metalness: 0.6,
            roughness: 0.4,
            transparent: isGhost,
            opacity
        });

        const darkMat = new THREE.MeshStandardMaterial({
            color: 0x222233,
            metalness: 0.8,
            roughness: 0.2,
            transparent: isGhost,
            opacity
        });

        const accentMat = new THREE.MeshStandardMaterial({
            color: 0x00ddff,
            emissive: 0x00aaff,
            emissiveIntensity: 0.5,
            metalness: 0.9,
            roughness: 0.1,
            transparent: isGhost,
            opacity
        });

        const glassMat = new THREE.MeshStandardMaterial({
            color: 0xffffaa,
            emissive: 0xffff66,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: isGhost ? 0.3 : 0.7
        });

        // Build based on type
        switch(type) {
            case 'core':
                this.buildCore(group, mainMat, darkMat, accentMat, glassMat);
                break;
            case 'corridor':
                this.buildCorridor(group, mainMat, darkMat, glassMat);
                break;
            case 'habitat':
                this.buildHabitat(group, mainMat, darkMat, glassMat);
                break;
            case 'lab':
                this.buildLab(group, mainMat, darkMat, accentMat, glassMat);
                break;
            case 'solar':
                this.buildSolar(group, mainMat, darkMat);
                break;
            case 'storage':
                this.buildStorage(group, mainMat, darkMat);
                break;
            case 'dock':
                this.buildDock(group, mainMat, darkMat, accentMat);
                break;
            case 'antenna':
                this.buildAntenna(group, mainMat, darkMat, accentMat);
                break;
            case 'engine':
                this.buildEngine(group, mainMat, darkMat);
                break;
            case 'greenhouse':
                this.buildGreenhouse(group, mainMat, darkMat, glassMat);
                break;
        }

        // Add connection port visuals
        if (!isGhost) {
            config.ports.forEach(port => {
                // Port ring
                const ringGeo = new THREE.TorusGeometry(0.35, 0.05, 8, 16);
                const ring = new THREE.Mesh(ringGeo, accentMat.clone());
                ring.position.set(...port.pos);
                ring.rotation.set(...port.rot);
                group.add(ring);

                // Port cylinder
                const cylGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.3, 16);
                const cyl = new THREE.Mesh(cylGeo, darkMat.clone());
                cyl.position.set(...port.pos);
                cyl.rotation.set(...port.rot);
                group.add(cyl);
            });
        }

        // Shadows
        if (!isGhost) {
            group.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });
        }

        return group;
    }

    buildCore(group, main, dark, accent, glass) {
        // Octagonal body
        const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.4, 8), main);
        body.rotation.y = Math.PI / 8;
        group.add(body);

        // End caps
        const capGeo = new THREE.CylinderGeometry(1, 1.2, 0.3, 8);
        [-1.35, 1.35].forEach(y => {
            const cap = new THREE.Mesh(capGeo, dark);
            cap.position.y = y;
            cap.rotation.y = Math.PI / 8;
            group.add(cap);
        });

        // Windows
        const winGeo = new THREE.CircleGeometry(0.18, 12);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
            const win = new THREE.Mesh(winGeo, glass);
            win.position.set(Math.cos(a) * 1.21, 0.4, Math.sin(a) * 1.21);
            win.lookAt(Math.cos(a) * 2, 0.4, Math.sin(a) * 2);
            group.add(win);
        }
    }

    buildCorridor(group, main, dark, glass) {
        // Tube
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 16), main);
        tube.rotation.x = Math.PI / 2;
        group.add(tube);

        // Rings
        const ringGeo = new THREE.TorusGeometry(0.72, 0.06, 8, 16);
        [-0.8, 0, 0.8].forEach(z => {
            const ring = new THREE.Mesh(ringGeo, dark);
            ring.position.z = z;
            group.add(ring);
        });

        // Windows
        const winGeo = new THREE.PlaneGeometry(0.25, 0.4);
        [-0.5, 0.5].forEach(z => {
            const win = new THREE.Mesh(winGeo, glass);
            win.position.set(0, 0.71, z);
            win.rotation.x = -Math.PI / 2;
            group.add(win);
        });
    }

    buildHabitat(group, main, dark, glass) {
        // Main body
        const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.4, 20), main);
        group.add(body);

        // Dome top
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(1.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
            main
        );
        dome.position.y = 1.2;
        group.add(dome);

        // Dome bottom
        const domeB = dome.clone();
        domeB.position.y = -1.2;
        domeB.rotation.x = Math.PI;
        group.add(domeB);

        // Windows - 2 rows
        const winGeo = new THREE.CircleGeometry(0.15, 10);
        for (let row = 0; row < 2; row++) {
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2;
                const win = new THREE.Mesh(winGeo, glass);
                win.position.set(Math.cos(a) * 1.21, 0.6 - row * 1.2, Math.sin(a) * 1.21);
                win.lookAt(Math.cos(a) * 2, 0.6 - row * 1.2, Math.sin(a) * 2);
                group.add(win);
            }
        }

        // Bands
        const bandGeo = new THREE.TorusGeometry(1.22, 0.04, 8, 24);
        [-0.5, 0.5].forEach(y => {
            const band = new THREE.Mesh(bandGeo, dark);
            band.position.y = y;
            band.rotation.x = Math.PI / 2;
            group.add(band);
        });
    }

    buildLab(group, main, dark, accent, glass) {
        // Sphere body
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 24), main);
        group.add(sphere);

        // Equipment ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.1, 8, 24), dark);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        // Big window
        const winGeo = new THREE.CircleGeometry(0.45, 20);
        const win = new THREE.Mesh(winGeo, glass);
        win.position.set(0, 0.5, 1.25);
        win.lookAt(0, 0.5, 2);
        group.add(win);

        // Equipment pods
        const podGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.4, 8);
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const pod = new THREE.Mesh(podGeo, accent);
            pod.position.set(Math.cos(a) * 1, -0.8, Math.sin(a) * 1);
            group.add(pod);
        }
    }

    buildSolar(group, main, dark) {
        // Center hub
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.4, 8), dark);
        group.add(hub);

        // Panel material
        const panelMat = new THREE.MeshStandardMaterial({
            color: 0x0a0a1a,
            metalness: 0.95,
            roughness: 0.05
        });

        const frameMat = new THREE.MeshStandardMaterial({
            color: 0x888899,
            metalness: 0.7,
            roughness: 0.3
        });

        // Two panels
        [-1, 1].forEach(side => {
            const panelGrp = new THREE.Group();

            // Panel
            const panel = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.04, 1.2), panelMat);
            panelGrp.add(panel);

            // Frame
            const frameH = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.06), frameMat);
            frameH.position.z = 0.6;
            panelGrp.add(frameH);
            const frameH2 = frameH.clone();
            frameH2.position.z = -0.6;
            panelGrp.add(frameH2);

            const frameV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.2), frameMat);
            frameV.position.x = 1.3;
            panelGrp.add(frameV);
            const frameV2 = frameV.clone();
            frameV2.position.x = -1.3;
            panelGrp.add(frameV2);

            // Grid
            for (let i = -2; i <= 2; i++) {
                const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 1.2), frameMat);
                line.position.x = i * 0.5;
                panelGrp.add(line);
            }

            // Arm
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), frameMat);
            arm.position.x = side * -0.95;
            panelGrp.add(arm);

            panelGrp.position.x = side * 1.85;
            group.add(panelGrp);
        });
    }

    buildStorage(group, main, dark) {
        // Container
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 2.4), main);
        group.add(box);

        // Straps
        const strapGeo = new THREE.BoxGeometry(0.1, 1.42, 2.42);
        [-0.5, 0, 0.5].forEach(x => {
            const strap = new THREE.Mesh(strapGeo, dark);
            strap.position.x = x;
            group.add(strap);
        });

        // Labels
        const labelMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
        const labelGeo = new THREE.BoxGeometry(0.4, 0.12, 2.42);
        [0.4, -0.4].forEach(y => {
            const label = new THREE.Mesh(labelGeo, labelMat);
            label.position.y = y;
            group.add(label);
        });
    }

    buildDock(group, main, dark, accent) {
        // Docking ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 12, 24), main);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.6;
        group.add(ring);

        // Inner ring
        const inner = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 16), accent);
        inner.rotation.x = Math.PI / 2;
        inner.position.y = 0.6;
        group.add(inner);

        // Support
        const support = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1, 12), dark);
        support.position.y = -0.1;
        group.add(support);

        // Guide lights
        const colors = [0x00ff00, 0xff0000, 0x00ff00, 0xff0000];
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const light = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 8, 8),
                new THREE.MeshBasicMaterial({ color: colors[i] })
            );
            light.position.set(Math.cos(a) * 1, 0.6, Math.sin(a) * 1);
            group.add(light);
        }
    }

    buildAntenna(group, main, dark, accent) {
        // Dish
        const dish = new THREE.Mesh(
            new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.5),
            main
        );
        dish.rotation.x = Math.PI;
        dish.position.y = 1.2;
        group.add(dish);

        // Inner dish
        const innerMat = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.95, roughness: 0.05 });
        const inner = new THREE.Mesh(
            new THREE.SphereGeometry(0.95, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.5),
            innerMat
        );
        inner.rotation.x = Math.PI;
        inner.position.y = 1.2;
        group.add(inner);

        // Feed
        const feed = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), dark);
        feed.position.y = 0.85;
        feed.rotation.x = Math.PI;
        group.add(feed);

        // Struts
        const strutGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4);
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const strut = new THREE.Mesh(strutGeo, dark);
            strut.position.set(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4);
            strut.rotation.z = Math.cos(a) * 0.4;
            strut.rotation.x = -Math.sin(a) * 0.4;
            group.add(strut);
        }

        // Mount
        const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.6, 10), dark);
        mount.position.y = 0.1;
        group.add(mount);

        // Indicator
        const indicator = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        indicator.position.y = 0.6;
        group.add(indicator);
        group.userData.indicator = indicator;
    }

    buildEngine(group, main, dark) {
        // Housing
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.8, 12), main);
        group.add(housing);

        // Nozzle
        const nozzle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.85, 1, 12, 1, true),
            new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide })
        );
        nozzle.position.y = -1.3;
        group.add(nozzle);

        // Glow
        const glow = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.75, 0.8, 12),
            new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.6 })
        );
        glow.position.y = -1.2;
        group.add(glow);
        group.userData.glow = glow;

        // Plume
        const plume = new THREE.Mesh(
            new THREE.ConeGeometry(0.6, 2, 12),
            new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.35 })
        );
        plume.position.y = -2.6;
        plume.rotation.x = Math.PI;
        group.add(plume);
        group.userData.plume = plume;

        // Pipes
        const pipeGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6);
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const pipe = new THREE.Mesh(pipeGeo, dark);
            pipe.position.set(Math.cos(a) * 0.6, -0.2, Math.sin(a) * 0.6);
            group.add(pipe);
        }

        // Top mount
        const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.4, 10), dark);
        mount.position.y = 1.1;
        group.add(mount);
    }

    buildGreenhouse(group, main, dark, glass) {
        // Glass dome
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(1.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({
                color: 0xaaffaa,
                transparent: true,
                opacity: 0.4,
                metalness: 0.1,
                roughness: 0.1
            })
        );
        dome.position.y = 0.4;
        group.add(dome);

        // Frame
        const frameRing = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.04, 8, 24), dark);
        frameRing.position.y = 0.4;
        frameRing.rotation.x = Math.PI / 2;
        group.add(frameRing);

        // Struts
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 4), dark);
            strut.position.set(Math.cos(a) * 1.25, 0.9, Math.sin(a) * 1.25);
            strut.rotation.z = -Math.cos(a) * 0.5;
            strut.rotation.x = Math.sin(a) * 0.5;
            group.add(strut);
        }

        // Base
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.5, 20), main);
        base.position.y = 0.15;
        group.add(base);

        // Plants
        const plantMat = new THREE.MeshStandardMaterial({ color: 0x228822 });
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const plant = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 5), plantMat);
            plant.position.set(Math.cos(a) * 0.6, 0.7, Math.sin(a) * 0.6);
            group.add(plant);
        }
        const center = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 5), plantMat);
        center.position.y = 0.8;
        group.add(center);

        // Grow lights
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff88ff });
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const light = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.12), lightMat);
            light.position.set(Math.cos(a) * 0.95, 1.2, Math.sin(a) * 0.95);
            light.lookAt(0, 0.7, 0);
            group.add(light);
        }
    }

    // ===================== PLACEMENT SYSTEM =====================

    createGhost() {
        this.ghostModule = this.createModule(this.selectedType, true);
        this.ghostModule.visible = false;
        this.scene.add(this.ghostModule);
    }

    updateGhost() {
        this.scene.remove(this.ghostModule);
        this.ghostModule = this.createModule(this.selectedType, true);
        this.ghostModule.visible = false;
        this.scene.add(this.ghostModule);
    }

    placeInitialCore() {
        const module = this.createModule('core');
        module.position.set(0, 0, 0);
        module.userData.id = Date.now();
        this.scene.add(module);
        this.modules.push(module);
        this.updateOpenPorts();
        this.updateStats();
    }

    updateOpenPorts() {
        this.openPorts = [];
        
        this.modules.forEach(mod => {
            const config = mod.userData.config;
            config.ports.forEach(port => {
                // Calculate world position of port
                const worldPos = new THREE.Vector3(...port.pos);
                worldPos.applyMatrix4(mod.matrixWorld);
                
                // Check if this port is connected
                const connected = this.isPortConnected(worldPos, port.dir);
                
                if (!connected) {
                    this.openPorts.push({
                        module: mod,
                        port: port,
                        worldPos: worldPos,
                        dir: port.dir
                    });
                }
            });
        });
    }

    isPortConnected(worldPos, dir) {
        // Check if another module's port is at this position with opposite direction
        for (const mod of this.modules) {
            const config = mod.userData.config;
            for (const port of config.ports) {
                const otherPos = new THREE.Vector3(...port.pos);
                otherPos.applyMatrix4(mod.matrixWorld);
                
                if (otherPos.distanceTo(worldPos) < 0.5 && port.dir === this.opposites[dir]) {
                    return true;
                }
            }
        }
        return false;
    }

    findSnapTarget() {
        // Find closest open port to snap to
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        let bestDist = 5; // Max snap distance
        let bestTarget = null;
        
        const newConfig = this.configs[this.selectedType];
        
        this.openPorts.forEach(openPort => {
            // For each open port, check if new module can connect
            newConfig.ports.forEach(newPort => {
                // Check if directions are compatible (opposite)
                if (newPort.dir === this.opposites[openPort.dir]) {
                    // Calculate where new module would be positioned
                    const newModulePos = openPort.worldPos.clone();
                    const offset = new THREE.Vector3(...newPort.pos);
                    newModulePos.sub(offset);
                    
                    // Distance from camera ray to this position
                    const closest = new THREE.Vector3();
                    this.raycaster.ray.closestPointToPoint(newModulePos, closest);
                    const dist = closest.distanceTo(newModulePos);
                    
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestTarget = {
                            openPort: openPort,
                            newPort: newPort,
                            position: newModulePos
                        };
                    }
                }
            });
        });
        
        return bestTarget;
    }

    updateGhostPosition() {
        if (this.deleteMode) {
            this.ghostModule.visible = false;
            document.getElementById('connection-hint').classList.remove('active');
            return;
        }

        this.snapTarget = this.findSnapTarget();
        
        if (this.snapTarget) {
            this.ghostModule.position.copy(this.snapTarget.position);
            this.ghostModule.visible = true;
            
            // Green tint for valid placement
            this.ghostModule.traverse(c => {
                if (c.material && c.material.opacity !== undefined) {
                    c.material.opacity = 0.6;
                }
            });
            
            document.getElementById('connection-hint').classList.add('active');
        } else {
            this.ghostModule.visible = false;
            document.getElementById('connection-hint').classList.remove('active');
        }
    }

    placeModule() {
        if (this.deleteMode || !this.snapTarget) return;
        
        const module = this.createModule(this.selectedType);
        module.position.copy(this.snapTarget.position);
        module.userData.id = Date.now();
        
        // Animate
        module.scale.set(0.01, 0.01, 0.01);
        this.animateScale(module, 1);
        
        this.scene.add(module);
        this.modules.push(module);
        
        // Create connector between ports
        this.createConnector(
            this.snapTarget.openPort.worldPos,
            this.snapTarget.newPort,
            module
        );
        
        this.updateOpenPorts();
        this.updateStats();
        
        document.getElementById('connection-hint').classList.remove('active');
    }

    createConnector(portPos, newPort, newModule) {
        // Visual connector tube between modules
        const newPortWorld = new THREE.Vector3(...newPort.pos);
        newPortWorld.applyMatrix4(newModule.matrixWorld);
        
        const mid = portPos.clone().add(newPortWorld).multiplyScalar(0.5);
        const length = portPos.distanceTo(newPortWorld);
        
        if (length > 0.1) {
            const connGeo = new THREE.CylinderGeometry(0.25, 0.25, length, 12);
            const connMat = new THREE.MeshStandardMaterial({
                color: 0x556677,
                metalness: 0.7,
                roughness: 0.3
            });
            const conn = new THREE.Mesh(connGeo, connMat);
            conn.position.copy(mid);
            conn.lookAt(portPos);
            conn.rotation.x += Math.PI / 2;
            conn.castShadow = true;
            conn.receiveShadow = true;
            conn.userData.isConnector = true;
            this.scene.add(conn);
        }
    }

    tryDelete() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Don't delete if only one module
        if (this.modules.length <= 1) return;
        
        const meshes = [];
        this.modules.forEach(m => m.traverse(c => { if (c.isMesh) meshes.push(c); }));
        
        const hits = this.raycaster.intersectObjects(meshes);
        if (hits.length > 0) {
            let target = hits[0].object;
            while (target.parent && !target.userData.type) target = target.parent;
            
            if (target.userData.type) {
                // Don't delete if it would disconnect station
                // For simplicity, just delete
                this.animateScale(target, 0, () => {
                    this.scene.remove(target);
                    this.modules = this.modules.filter(m => m !== target);
                    this.updateOpenPorts();
                    this.updateStats();
                });
            }
        }
    }

    animateScale(obj, target, callback) {
        const start = obj.scale.x;
        const duration = 250;
        const startTime = Date.now();
        
        const anim = () => {
            const t = Math.min((Date.now() - startTime) / duration, 1);
            const ease = target > start ? 1 - Math.pow(1 - t, 3) : t * t * t;
            const s = start + (target - start) * ease;
            obj.scale.set(s, s, s);
            if (t < 1) requestAnimationFrame(anim);
            else if (callback) callback();
        };
        
        if (target > start) obj.scale.set(0.01, 0.01, 0.01);
        anim();
    }

    // ===================== UI =====================

    updateStats() {
        let energy = 0, crew = 0;
        this.modules.forEach(m => {
            const c = this.configs[m.userData.type];
            energy += c.energy;
            crew += c.crew;
        });
        
        document.getElementById('stat-modules').textContent = this.modules.length;
        
        const el = document.getElementById('stat-energy');
        el.textContent = (energy >= 0 ? '+' : '') + energy;
        el.className = 'stat-value ' + (energy >= 0 ? 'positive' : 'negative');
        
        document.getElementById('stat-crew').textContent = crew;
    }

    // ===================== CAMERA =====================

    updateCamera() {
        const x = Math.sin(this.camAngle) * Math.cos(this.camPitch) * this.camDist;
        const y = Math.sin(this.camPitch) * this.camDist;
        const z = Math.cos(this.camAngle) * Math.cos(this.camPitch) * this.camDist;
        this.camera.position.set(x, y, z).add(this.camTarget);
        this.camera.lookAt(this.camTarget);
    }

    // ===================== EVENTS =====================

    setupEvents() {
        const canvas = this.renderer.domElement;
        let touch = null, lastTap = 0, pinch = null;

        canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            if (e.touches.length === 1) {
                touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            if (e.touches.length === 1 && touch) {
                const dx = e.touches[0].clientX - touch.x;
                const dy = e.touches[0].clientY - touch.y;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    this.camAngle += dx * 0.006;
                    this.camPitch = Math.max(0.1, Math.min(1.4, this.camPitch + dy * 0.006));
                    this.updateCamera();
                    touch.x = e.touches[0].clientX;
                    touch.y = e.touches[0].clientY;
                }
                this.updateMouse(e.touches[0].clientX, e.touches[0].clientY);
                this.updateGhostPosition();
            } else if (e.touches.length === 2) {
                const d = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                if (pinch !== null) {
                    this.camDist = Math.max(25, Math.min(100, this.camDist + (pinch - d) * 0.15));
                    this.updateCamera();
                }
                pinch = d;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', e => {
            e.preventDefault();
            pinch = null;
            if (touch && e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - touch.x;
                const dy = e.changedTouches[0].clientY - touch.y;
                if (Math.hypot(dx, dy) < 15 && Date.now() - touch.t < 300) {
                    const now = Date.now();
                    this.updateMouse(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
                    if (now - lastTap < 300) {
                        this.tryDelete();
                    } else {
                        this.deleteMode ? this.tryDelete() : this.placeModule();
                    }
                    lastTap = now;
                }
            }
            touch = null;
        }, { passive: false });

        canvas.addEventListener('mousemove', e => {
            this.updateMouse(e.clientX, e.clientY);
            this.updateGhostPosition();
        });

        canvas.addEventListener('click', e => {
            this.updateMouse(e.clientX, e.clientY);
            this.deleteMode ? this.tryDelete() : this.placeModule();
        });

        canvas.addEventListener('dblclick', e => {
            this.updateMouse(e.clientX, e.clientY);
            this.tryDelete();
        });

        // Module buttons
        document.querySelectorAll('.module-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                document.querySelectorAll('.module-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedType = btn.dataset.module;
                this.deleteMode = false;
                document.getElementById('btn-delete').classList.remove('active');
                this.updateGhost();
            });
        });

        // Controls
        document.getElementById('btn-left').onclick = () => { this.camAngle -= 0.3; this.updateCamera(); };
        document.getElementById('btn-right').onclick = () => { this.camAngle += 0.3; this.updateCamera(); };
        document.getElementById('btn-up').onclick = () => { this.camPitch = Math.min(1.4, this.camPitch + 0.15); this.updateCamera(); };
        document.getElementById('btn-down').onclick = () => { this.camPitch = Math.max(0.1, this.camPitch - 0.15); this.updateCamera(); };
        document.getElementById('btn-zoom-in').onclick = () => { this.camDist = Math.max(25, this.camDist - 5); this.updateCamera(); };
        document.getElementById('btn-zoom-out').onclick = () => { this.camDist = Math.min(100, this.camDist + 5); this.updateCamera(); };
        document.getElementById('btn-delete').onclick = () => {
            this.deleteMode = !this.deleteMode;
            document.getElementById('btn-delete').classList.toggle('active', this.deleteMode);
            this.ghostModule.visible = false;
        };

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    updateMouse(x, y) {
        this.mouse.x = (x / window.innerWidth) * 2 - 1;
        this.mouse.y = -(y / window.innerHeight) * 2 + 1;
    }

    // ===================== ANIMATION =====================

    animate() {
        requestAnimationFrame(() => this.animate());
        const t = this.clock.getElapsedTime();

        if (this.stars) this.stars.rotation.y += 0.00003;

        this.modules.forEach(m => {
            if (m.userData.type === 'antenna' && m.children[0]) {
                m.children[0].rotation.y = t * 0.5;
            }
            if (m.userData.type === 'engine') {
                if (m.userData.glow) m.userData.glow.material.opacity = 0.4 + Math.sin(t * 10) * 0.2;
                if (m.userData.plume) {
                    m.userData.plume.scale.y = 0.8 + Math.sin(t * 8) * 0.2;
                    m.userData.plume.material.opacity = 0.25 + Math.sin(t * 12) * 0.1;
                }
            }
        });

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('load', () => { window.game = new SpaceStation(); });
