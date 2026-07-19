// Space Station Builder - Enhanced 3D Game

class SpaceStationBuilder {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.modules = [];
        this.selectedModule = 'core';
        this.deleteMode = false;
        this.cameraAngle = 0.5;
        this.cameraPitch = 0.6;
        this.cameraDistance = 35;
        this.gridSize = 24;
        this.ghostModule = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.grid = {};
        this.connectionPoints = [];
        
        this.moduleData = {
            core: { name: 'Ядро', energy: 5, crew: 2, color: 0x4488ff },
            habitat: { name: 'Жилой', energy: -2, crew: 4, color: 0x44aa66 },
            lab: { name: 'Лаборатория', energy: -3, crew: 2, color: 0xeeeeee },
            solar: { name: 'Солн. панель', energy: 12, crew: 0, color: 0x2255aa, attachable: true },
            storage: { name: 'Склад', energy: -1, crew: 0, color: 0xdd8833 },
            dock: { name: 'Док', energy: -2, crew: 1, color: 0xdd4444 },
            antenna: { name: 'Антенна', energy: -1, crew: 0, color: 0xaaaaaa, attachable: true },
            engine: { name: 'Двигатель', energy: -5, crew: 0, color: 0xff6600, attachable: true },
            corridor: { name: 'Коридор', energy: 0, crew: 0, color: 0x667788 },
            greenhouse: { name: 'Теплица', energy: -2, crew: 1, color: 0x33cc55 }
        };

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020510);

        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.updateCamera();

        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            canvas: document.createElement('canvas')
        });
        this.renderer.domElement.id = 'main-canvas';
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').insertBefore(
            this.renderer.domElement,
            document.getElementById('game-container').firstChild
        );

        this.setupLights();
        this.createStars();
        this.createGrid();
        this.createEarth();
        this.setupEvents();
        this.createGhostModule();
        this.animate();
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0x404060, 0.4);
        this.scene.add(ambient);

        const sunLight = new THREE.DirectionalLight(0xffffee, 1.2);
        sunLight.position.set(50, 40, 30);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 150;
        sunLight.shadow.camera.left = -30;
        sunLight.shadow.camera.right = 30;
        sunLight.shadow.camera.top = 30;
        sunLight.shadow.camera.bottom = -30;
        this.scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
        fillLight.position.set(-30, 20, -20);
        this.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xff8844, 0.2);
        rimLight.position.set(0, -20, -40);
        this.scene.add(rimLight);
    }

    createStars() {
        const starsGeometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        
        for (let i = 0; i < 3000; i++) {
            const radius = 200 + Math.random() * 300;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions.push(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.sin(phi) * Math.sin(theta),
                radius * Math.cos(phi)
            );
            
            const brightness = 0.5 + Math.random() * 0.5;
            const tint = Math.random();
            colors.push(
                brightness * (0.8 + tint * 0.2),
                brightness * (0.8 + (1-tint) * 0.2),
                brightness
            );
        }

        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const starsMaterial = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.9
        });
        
        this.stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(this.stars);
    }

    createGrid() {
        const gridHelper = new THREE.GridHelper(this.gridSize, this.gridSize, 0x00aaff, 0x003355);
        gridHelper.material.opacity = 0.25;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        const planeGeometry = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
        const planeMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
        this.groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.name = 'ground';
        this.scene.add(this.groundPlane);
    }

    createEarth() {
        const earthGroup = new THREE.Group();
        
        const earthGeometry = new THREE.SphereGeometry(60, 64, 64);
        const earthMaterial = new THREE.MeshStandardMaterial({
            color: 0x1144aa,
            emissive: 0x0a2255,
            emissiveIntensity: 0.3,
            roughness: 0.8
        });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earthGroup.add(earth);

        const cloudsGeometry = new THREE.SphereGeometry(61, 32, 32);
        const cloudsMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            roughness: 1
        });
        const clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
        earthGroup.add(clouds);
        this.clouds = clouds;

        const atmosphereGeometry = new THREE.SphereGeometry(65, 32, 32);
        const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        earthGroup.add(atmosphere);

        earthGroup.position.set(0, -90, -60);
        this.scene.add(earthGroup);
        this.earth = earthGroup;
    }

    createModuleMesh(type, forPreview = false) {
        const group = new THREE.Group();
        const data = this.moduleData[type];
        
        const mainMat = new THREE.MeshStandardMaterial({
            color: data.color,
            metalness: 0.7,
            roughness: 0.3
        });
        
        const darkMat = new THREE.MeshStandardMaterial({
            color: 0x222233,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x88ffff,
            transparent: true,
            opacity: 0.8
        });

        const detailMat = new THREE.MeshStandardMaterial({
            color: 0x556677,
            metalness: 0.9,
            roughness: 0.2
        });

        switch(type) {
            case 'core':
                this.buildCore(group, mainMat, darkMat, glowMat, detailMat);
                break;
            case 'habitat':
                this.buildHabitat(group, mainMat, darkMat, glowMat);
                break;
            case 'lab':
                this.buildLab(group, mainMat, darkMat, glowMat, detailMat);
                break;
            case 'solar':
                this.buildSolar(group, mainMat, darkMat);
                break;
            case 'storage':
                this.buildStorage(group, mainMat, darkMat, detailMat);
                break;
            case 'dock':
                this.buildDock(group, mainMat, darkMat, glowMat);
                break;
            case 'antenna':
                this.buildAntenna(group, mainMat, darkMat, glowMat);
                break;
            case 'engine':
                this.buildEngine(group, mainMat, darkMat);
                break;
            case 'corridor':
                this.buildCorridor(group, mainMat, darkMat, detailMat);
                break;
            case 'greenhouse':
                this.buildGreenhouse(group, mainMat, glowMat);
                break;
        }

        group.userData.type = type;
        
        if (!forPreview) {
            group.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }

        return group;
    }

    buildCore(group, mainMat, darkMat, glowMat, detailMat) {
        // Main octagonal body
        const bodyGeom = new THREE.CylinderGeometry(1.2, 1.2, 2, 8);
        const body = new THREE.Mesh(bodyGeom, mainMat);
        body.rotation.y = Math.PI / 8;
        group.add(body);

        // End caps
        const capGeom = new THREE.CylinderGeometry(1.0, 1.2, 0.3, 8);
        [-1.15, 1.15].forEach(y => {
            const cap = new THREE.Mesh(capGeom, detailMat);
            cap.position.y = y;
            cap.rotation.y = Math.PI / 8;
            group.add(cap);
        });

        // Connection ports on 4 sides
        const portGeom = new THREE.CylinderGeometry(0.35, 0.4, 0.5, 8);
        [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]].forEach(([x, z]) => {
            const port = new THREE.Mesh(portGeom, darkMat);
            port.position.set(x, 0, z);
            port.rotation.x = z !== 0 ? Math.PI / 2 : 0;
            port.rotation.z = x !== 0 ? Math.PI / 2 : 0;
            group.add(port);
            
            // Glow ring
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.35, 0.04, 8, 16),
                glowMat
            );
            ring.position.set(x * 1.15, 0, z * 1.15);
            ring.rotation.x = z !== 0 ? 0 : Math.PI / 2;
            ring.rotation.y = x !== 0 ? Math.PI / 2 : 0;
            group.add(ring);
        });

        // Top/bottom ports
        [[0, 1.4], [0, -1.4]].forEach(([_, y]) => {
            const port = new THREE.Mesh(portGeom, darkMat);
            port.position.y = y;
            group.add(port);
        });
    }

    buildHabitat(group, mainMat, darkMat, glowMat) {
        // Main cylinder
        const bodyGeom = new THREE.CylinderGeometry(1, 1, 2.5, 16);
        const body = new THREE.Mesh(bodyGeom, mainMat);
        group.add(body);

        // Rounded ends
        const endGeom = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const topEnd = new THREE.Mesh(endGeom, mainMat);
        topEnd.position.y = 1.25;
        group.add(topEnd);
        
        const bottomEnd = new THREE.Mesh(endGeom, mainMat);
        bottomEnd.position.y = -1.25;
        bottomEnd.rotation.x = Math.PI;
        group.add(bottomEnd);

        // Windows (2 rows of 6)
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        for (let row = 0; row < 2; row++) {
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const win = new THREE.Mesh(
                    new THREE.CircleGeometry(0.15, 8),
                    windowMat
                );
                win.position.set(
                    Math.cos(angle) * 1.01,
                    0.5 - row * 1,
                    Math.sin(angle) * 1.01
                );
                win.lookAt(win.position.clone().multiplyScalar(2));
                group.add(win);
            }
        }

        // Side ports
        const portGeom = new THREE.CylinderGeometry(0.3, 0.35, 0.4, 8);
        [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]].forEach(([x, z]) => {
            const port = new THREE.Mesh(portGeom, darkMat);
            port.position.set(x, 0, z);
            port.rotation.x = z !== 0 ? Math.PI / 2 : 0;
            port.rotation.z = x !== 0 ? Math.PI / 2 : 0;
            group.add(port);
        });
    }

    buildLab(group, mainMat, darkMat, glowMat, detailMat) {
        // Spherical main body
        const sphereGeom = new THREE.SphereGeometry(1.2, 16, 16);
        const sphere = new THREE.Mesh(sphereGeom, mainMat);
        group.add(sphere);

        // Equipment ring
        const ringGeom = new THREE.TorusGeometry(1.0, 0.12, 8, 24);
        const ring = new THREE.Mesh(ringGeom, detailMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        // Observation window
        const windowGeom = new THREE.CircleGeometry(0.4, 16);
        const windowMat = new THREE.MeshBasicMaterial({ color: 0x88ccff });
        const window1 = new THREE.Mesh(windowGeom, windowMat);
        window1.position.set(0, 0.5, 1.21);
        window1.lookAt(0, 0.5, 2);
        group.add(window1);

        // Equipment pods
        const podGeom = new THREE.CylinderGeometry(0.25, 0.3, 0.5, 8);
        [[0.9, 0.6], [-0.9, 0.6], [0.9, -0.6], [-0.9, -0.6]].forEach(([x, z]) => {
            const pod = new THREE.Mesh(podGeom, detailMat);
            pod.position.set(x, -0.3, z);
            group.add(pod);
        });

        // Connection ports
        const portGeom = new THREE.CylinderGeometry(0.3, 0.35, 0.4, 8);
        [[1.4, 0], [-1.4, 0]].forEach(([x, z]) => {
            const port = new THREE.Mesh(portGeom, darkMat);
            port.position.set(x, 0, z);
            port.rotation.z = Math.PI / 2;
            group.add(port);
        });
    }

    buildSolar(group, mainMat, darkMat) {
        // Central hub
        const hubGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8);
        const hub = new THREE.Mesh(hubGeom, darkMat);
        hub.rotation.x = Math.PI / 2;
        group.add(hub);

        // Solar panels - large and detailed
        const panelMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a3a,
            metalness: 0.95,
            roughness: 0.05,
            emissive: 0x000022,
            emissiveIntensity: 0.2
        });
        
        const frameMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.8,
            roughness: 0.2
        });

        [-1, 1].forEach(side => {
            // Panel frame
            const frameGroup = new THREE.Group();
            
            // Main panel
            const panel = new THREE.Mesh(
                new THREE.BoxGeometry(2.2, 0.03, 1.4),
                panelMat
            );
            frameGroup.add(panel);
            
            // Frame borders
            const frameGeom = new THREE.BoxGeometry(2.3, 0.06, 0.08);
            [-0.7, 0.7].forEach(z => {
                const frame = new THREE.Mesh(frameGeom, frameMat);
                frame.position.z = z;
                frameGroup.add(frame);
            });
            
            const sideFrameGeom = new THREE.BoxGeometry(0.08, 0.06, 1.4);
            [-1.15, 1.15].forEach(x => {
                const frame = new THREE.Mesh(sideFrameGeom, frameMat);
                frame.position.x = x;
                frameGroup.add(frame);
            });

            // Grid lines on panel
            const lineGeom = new THREE.BoxGeometry(2.2, 0.035, 0.02);
            for (let i = -2; i <= 2; i++) {
                if (i === 0) continue;
                const line = new THREE.Mesh(lineGeom, frameMat);
                line.position.z = i * 0.25;
                frameGroup.add(line);
            }

            // Arm connecting to hub
            const arm = new THREE.Mesh(
                new THREE.BoxGeometry(0.6, 0.08, 0.08),
                frameMat
            );
            arm.position.x = side * -0.8;
            frameGroup.add(arm);

            frameGroup.position.x = side * 1.7;
            group.add(frameGroup);
        });

        // Connection point at bottom
        const connGeom = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 8);
        const conn = new THREE.Mesh(connGeom, darkMat);
        conn.position.y = -0.3;
        group.add(conn);
    }

    buildStorage(group, mainMat, darkMat, detailMat) {
        // Main container
        const containerGeom = new THREE.BoxGeometry(1.8, 1.4, 1.4);
        const container = new THREE.Mesh(containerGeom, mainMat);
        group.add(container);

        // Reinforcement straps
        const strapMat = new THREE.MeshStandardMaterial({ color: 0x664422, metalness: 0.6, roughness: 0.4 });
        const strapGeom = new THREE.BoxGeometry(0.1, 1.42, 1.42);
        [-0.6, 0, 0.6].forEach(x => {
            const strap = new THREE.Mesh(strapGeom, strapMat);
            strap.position.x = x;
            group.add(strap);
        });

        // Handles
        const handleGeom = new THREE.BoxGeometry(0.15, 0.3, 0.1);
        [[0.92, 0.3], [0.92, -0.3], [-0.92, 0.3], [-0.92, -0.3]].forEach(([x, y]) => {
            const handle = new THREE.Mesh(handleGeom, detailMat);
            handle.position.set(x, y, 0);
            group.add(handle);
        });

        // Connection ports
        const portGeom = new THREE.CylinderGeometry(0.25, 0.3, 0.3, 8);
        [[1.05, 0], [-1.05, 0]].forEach(([x, z]) => {
            const port = new THREE.Mesh(portGeom, darkMat);
            port.position.set(x, 0, z);
            port.rotation.z = Math.PI / 2;
            group.add(port);
        });
    }

    buildDock(group, mainMat, darkMat, glowMat) {
        // Docking ring
        const ringGeom = new THREE.TorusGeometry(0.9, 0.2, 12, 24);
        const ring = new THREE.Mesh(ringGeom, mainMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.5;
        group.add(ring);

        // Support structure
        const supportGeom = new THREE.CylinderGeometry(0.7, 0.9, 0.8, 8);
        const support = new THREE.Mesh(supportGeom, darkMat);
        group.add(support);

        // Guide lights
        const lightColors = [0x00ff00, 0xff0000, 0x00ff00, 0xff0000];
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const light = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 8, 8),
                new THREE.MeshBasicMaterial({ color: lightColors[i] })
            );
            light.position.set(
                Math.cos(angle) * 0.9,
                0.5,
                Math.sin(angle) * 0.9
            );
            group.add(light);
        }

        // Inner guidance ring
        const innerRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.5, 0.05, 8, 16),
            glowMat
        );
        innerRing.rotation.x = Math.PI / 2;
        innerRing.position.y = 0.5;
        group.add(innerRing);

        // Bottom connection
        const connGeom = new THREE.CylinderGeometry(0.3, 0.35, 0.4, 8);
        const conn = new THREE.Mesh(connGeom, darkMat);
        conn.position.y = -0.6;
        group.add(conn);
    }

    buildAntenna(group, mainMat, darkMat, glowMat) {
        // Dish
        const dishGeom = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.5);
        const dish = new THREE.Mesh(dishGeom, mainMat);
        dish.rotation.x = Math.PI;
        dish.position.y = 0.8;
        group.add(dish);

        // Dish inner surface
        const innerDish = new THREE.Mesh(
            new THREE.SphereGeometry(0.95, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.5),
            new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.9, roughness: 0.1 })
        );
        innerDish.rotation.x = Math.PI;
        innerDish.position.y = 0.8;
        group.add(innerDish);

        // Feed horn
        const feedGeom = new THREE.ConeGeometry(0.15, 0.5, 8);
        const feed = new THREE.Mesh(feedGeom, darkMat);
        feed.position.y = 0.5;
        feed.rotation.x = Math.PI;
        group.add(feed);

        // Feed support struts
        const strutGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4);
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const strut = new THREE.Mesh(strutGeom, darkMat);
            strut.position.set(
                Math.cos(angle) * 0.4,
                0.6,
                Math.sin(angle) * 0.4
            );
            strut.rotation.x = 0.3;
            strut.rotation.z = -angle + Math.PI / 2;
            group.add(strut);
        }

        // Base/mount
        const baseGeom = new THREE.CylinderGeometry(0.2, 0.3, 0.5, 8);
        const base = new THREE.Mesh(baseGeom, darkMat);
        base.position.y = -0.3;
        group.add(base);

        // Signal indicator
        const indicator = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        indicator.position.set(0, 0.3, 0);
        group.add(indicator);
    }

    buildEngine(group, mainMat, darkMat) {
        // Engine body
        const bodyGeom = new THREE.CylinderGeometry(0.6, 0.8, 1.5, 12);
        const body = new THREE.Mesh(bodyGeom, mainMat);
        group.add(body);

        // Nozzle
        const nozzleGeom = new THREE.CylinderGeometry(0.5, 0.8, 1, 12, 1, true);
        const nozzle = new THREE.Mesh(nozzleGeom, darkMat);
        nozzle.position.y = -1.2;
        group.add(nozzle);

        // Inner nozzle glow
        const glowGeom = new THREE.CylinderGeometry(0.45, 0.7, 0.9, 12);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.7
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        glow.position.y = -1.1;
        group.add(glow);

        // Exhaust plume
        const plumeGeom = new THREE.ConeGeometry(0.6, 2, 12);
        const plumeMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.4
        });
        const plume = new THREE.Mesh(plumeGeom, plumeMat);
        plume.position.y = -2.5;
        plume.rotation.x = Math.PI;
        group.add(plume);

        // Fuel pipes
        const pipeGeom = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6);
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 });
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const pipe = new THREE.Mesh(pipeGeom, pipeMat);
            pipe.position.set(
                Math.cos(angle) * 0.55,
                -0.4,
                Math.sin(angle) * 0.55
            );
            group.add(pipe);
        }

        // Top mount
        const mountGeom = new THREE.CylinderGeometry(0.3, 0.4, 0.4, 8);
        const mount = new THREE.Mesh(mountGeom, darkMat);
        mount.position.y = 0.95;
        group.add(mount);
    }

    buildCorridor(group, mainMat, darkMat, detailMat) {
        // Main tube
        const tubeGeom = new THREE.CylinderGeometry(0.6, 0.6, 2.5, 8);
        const tube = new THREE.Mesh(tubeGeom, mainMat);
        tube.rotation.x = Math.PI / 2;
        group.add(tube);

        // End connectors
        const endGeom = new THREE.CylinderGeometry(0.65, 0.55, 0.3, 8);
        [-1.4, 1.4].forEach(z => {
            const end = new THREE.Mesh(endGeom, detailMat);
            end.position.z = z;
            end.rotation.x = Math.PI / 2;
            group.add(end);
        });

        // Support rings
        const ringGeom = new THREE.TorusGeometry(0.62, 0.05, 8, 16);
        [-0.7, 0, 0.7].forEach(z => {
            const ring = new THREE.Mesh(ringGeom, detailMat);
            ring.position.z = z;
            group.add(ring);
        });

        // Windows
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        [-0.5, 0.5].forEach(z => {
            const win = new THREE.Mesh(
                new THREE.CircleGeometry(0.12, 8),
                windowMat
            );
            win.position.set(0, 0.61, z);
            win.rotation.x = -Math.PI / 2;
            group.add(win);
        });
    }

    buildGreenhouse(group, mainMat, glowMat) {
        // Glass dome
        const domeGeom = new THREE.SphereGeometry(1.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x88ff88,
            transparent: true,
            opacity: 0.4,
            metalness: 0.1,
            roughness: 0.1
        });
        const dome = new THREE.Mesh(domeGeom, glassMat);
        dome.position.y = 0.2;
        group.add(dome);

        // Base
        const baseGeom = new THREE.CylinderGeometry(1.1, 1.2, 0.4, 16);
        const base = new THREE.Mesh(baseGeom, mainMat);
        group.add(base);

        // Plants inside (simple representation)
        const plantMat = new THREE.MeshStandardMaterial({ color: 0x22aa22 });
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const r = 0.5;
            const plant = new THREE.Mesh(
                new THREE.ConeGeometry(0.15, 0.5, 6),
                plantMat
            );
            plant.position.set(
                Math.cos(angle) * r,
                0.45,
                Math.sin(angle) * r
            );
            group.add(plant);
        }

        // Center plant
        const centerPlant = new THREE.Mesh(
            new THREE.ConeGeometry(0.2, 0.7, 6),
            plantMat
        );
        centerPlant.position.y = 0.55;
        group.add(centerPlant);

        // Growth lights
        const lightGeom = new THREE.BoxGeometry(0.1, 0.05, 0.3);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff88ff });
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const light = new THREE.Mesh(lightGeom, lightMat);
            light.position.set(
                Math.cos(angle) * 0.9,
                0.9,
                Math.sin(angle) * 0.9
            );
            light.lookAt(0, 0.5, 0);
            group.add(light);
        }
    }

    createGhostModule() {
        if (this.ghostModule) {
            this.scene.remove(this.ghostModule);
        }
        
        this.ghostModule = this.createModuleMesh(this.selectedModule);
        this.ghostModule.traverse(child => {
            if (child.material) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.4;
            }
        });
        this.ghostModule.visible = false;
        this.scene.add(this.ghostModule);
    }

    updateGhostModule() {
        this.createGhostModule();
    }

    updateCamera() {
        const x = Math.sin(this.cameraAngle) * Math.cos(this.cameraPitch) * this.cameraDistance;
        const y = Math.sin(this.cameraPitch) * this.cameraDistance;
        const z = Math.cos(this.cameraAngle) * Math.cos(this.cameraPitch) * this.cameraDistance;
        this.camera.position.set(x, y, z);
        this.camera.lookAt(0, 0, 0);
    }

    setupEvents() {
        const canvas = this.renderer.domElement;

        canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('click', (e) => this.onClick(e));
        canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

        // Module selection buttons
        document.querySelectorAll('.module-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.module-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedModule = btn.dataset.module;
                this.deleteMode = false;
                document.getElementById('delete-btn').classList.remove('active');
                this.updateGhostModule();
            });
        });

        // Control buttons
        document.getElementById('rotate-left').addEventListener('click', () => {
            this.cameraAngle -= 0.25;
            this.updateCamera();
        });
        document.getElementById('rotate-right').addEventListener('click', () => {
            this.cameraAngle += 0.25;
            this.updateCamera();
        });
        document.getElementById('rotate-up').addEventListener('click', () => {
            this.cameraPitch = Math.min(1.2, this.cameraPitch + 0.15);
            this.updateCamera();
        });
        document.getElementById('rotate-down').addEventListener('click', () => {
            this.cameraPitch = Math.max(0.1, this.cameraPitch - 0.15);
            this.updateCamera();
        });

        document.getElementById('zoom-in').addEventListener('click', () => {
            this.cameraDistance = Math.max(15, this.cameraDistance - 5);
            this.updateCamera();
        });
        document.getElementById('zoom-out').addEventListener('click', () => {
            this.cameraDistance = Math.min(60, this.cameraDistance + 5);
            this.updateCamera();
        });

        document.getElementById('delete-btn').addEventListener('click', () => {
            this.deleteMode = !this.deleteMode;
            document.getElementById('delete-btn').classList.toggle('active', this.deleteMode);
            this.ghostModule.visible = false;
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    lastTouchTime = 0;
    touchStartPos = null;
    lastPinchDist = null;

    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.touchStartPos) {
            const deltaX = e.touches[0].clientX - this.touchStartPos.x;
            const deltaY = e.touches[0].clientY - this.touchStartPos.y;
            
            if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
                this.cameraAngle += deltaX * 0.003;
                this.cameraPitch = Math.max(0.1, Math.min(1.2, this.cameraPitch + deltaY * 0.002));
                this.updateCamera();
                this.touchStartPos.x = e.touches[0].clientX;
                this.touchStartPos.y = e.touches[0].clientY;
            }
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (this.lastPinchDist) {
                const delta = this.lastPinchDist - dist;
                this.cameraDistance = Math.max(15, Math.min(60, this.cameraDistance + delta * 0.15));
                this.updateCamera();
            }
            this.lastPinchDist = dist;
        }

        if (e.touches.length === 1) {
            this.updateMousePosition(e.touches[0].clientX, e.touches[0].clientY);
            this.updateGhostPosition();
        }
    }

    onTouchEnd(e) {
        e.preventDefault();
        this.lastPinchDist = null;

        const now = Date.now();
        const timeDiff = now - this.lastTouchTime;

        if (this.touchStartPos && e.changedTouches.length === 1) {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const moveDistance = Math.hypot(endX - this.touchStartPos.x, endY - this.touchStartPos.y);

            if (moveDistance < 15) {
                this.updateMousePosition(endX, endY);
                
                if (timeDiff < 300) {
                    this.deleteModuleAtPosition();
                } else {
                    if (this.deleteMode) {
                        this.deleteModuleAtPosition();
                    } else {
                        this.placeModule();
                    }
                }
            }
        }

        this.lastTouchTime = now;
        this.touchStartPos = null;
    }

    onMouseMove(e) {
        this.updateMousePosition(e.clientX, e.clientY);
        this.updateGhostPosition();
    }

    onClick(e) {
        this.updateMousePosition(e.clientX, e.clientY);
        if (this.deleteMode) {
            this.deleteModuleAtPosition();
        } else {
            this.placeModule();
        }
    }

    onDoubleClick(e) {
        this.updateMousePosition(e.clientX, e.clientY);
        this.deleteModuleAtPosition();
    }

    updateMousePosition(x, y) {
        this.mouse.x = (x / window.innerWidth) * 2 - 1;
        this.mouse.y = -(y / window.innerHeight) * 2 + 1;
    }

    getGridPosition() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.groundPlane);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const gridX = Math.round(point.x);
            const gridZ = Math.round(point.z);
            
            const limit = this.gridSize / 2 - 1;
            if (Math.abs(gridX) <= limit && Math.abs(gridZ) <= limit) {
                return { x: gridX, z: gridZ };
            }
        }
        return null;
    }

    findAttachmentPoint() {
        // For attachable modules, find nearby modules to attach to
        const data = this.moduleData[this.selectedModule];
        if (!data.attachable) return null;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const meshes = [];
        this.modules.forEach(m => {
            m.traverse(child => {
                if (child.isMesh) meshes.push(child);
            });
        });

        const intersects = this.raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
            const hit = intersects[0];
            const parentModule = this.findParentModule(hit.object);
            if (parentModule) {
                // Calculate attachment position on top or side of the module
                const normal = hit.face.normal.clone();
                normal.transformDirection(hit.object.matrixWorld);
                
                const attachPos = hit.point.clone();
                attachPos.add(normal.multiplyScalar(0.5));
                
                return {
                    position: attachPos,
                    parentModule: parentModule
                };
            }
        }
        return null;
    }

    findParentModule(mesh) {
        let current = mesh;
        while (current) {
            if (current.userData && current.userData.type) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    updateGhostPosition() {
        if (this.deleteMode) {
            this.ghostModule.visible = false;
            return;
        }

        const data = this.moduleData[this.selectedModule];
        
        if (data.attachable) {
            const attachment = this.findAttachmentPoint();
            if (attachment) {
                this.ghostModule.position.copy(attachment.position);
                this.ghostModule.visible = true;
                return;
            }
        }

        const pos = this.getGridPosition();
        if (pos) {
            this.ghostModule.position.set(pos.x, 0, pos.z);
            this.ghostModule.visible = true;
            
            const key = `${pos.x},${pos.z}`;
            const canPlace = !this.grid[key];
            this.ghostModule.traverse(child => {
                if (child.material && child.material.opacity !== undefined) {
                    child.material.opacity = canPlace ? 0.4 : 0.15;
                }
            });
        } else {
            this.ghostModule.visible = false;
        }
    }

    placeModule() {
        const data = this.moduleData[this.selectedModule];
        
        if (data.attachable) {
            const attachment = this.findAttachmentPoint();
            if (attachment) {
                const module = this.createModuleMesh(this.selectedModule);
                module.position.copy(attachment.position);
                
                this.scene.add(module);
                this.modules.push(module);
                this.updateStats();
                this.animateScale(module, 1);
                return;
            }
        }

        const pos = this.getGridPosition();
        if (!pos) return;

        const key = `${pos.x},${pos.z}`;
        if (this.grid[key]) return;

        const module = this.createModuleMesh(this.selectedModule);
        module.position.set(pos.x, 0, pos.z);
        module.userData.gridKey = key;
        
        this.scene.add(module);
        this.modules.push(module);
        this.grid[key] = module;

        this.updateStats();
        this.animateScale(module, 1);
    }

    deleteModuleAtPosition() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const meshes = [];
        this.modules.forEach(m => {
            m.traverse(child => {
                if (child.isMesh) meshes.push(child);
            });
        });

        const intersects = this.raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
            const parentModule = this.findParentModule(intersects[0].object);
            if (parentModule) {
                this.animateScale(parentModule, 0, () => {
                    this.scene.remove(parentModule);
                    this.modules = this.modules.filter(m => m !== parentModule);
                    if (parentModule.userData.gridKey) {
                        delete this.grid[parentModule.userData.gridKey];
                    }
                    this.updateStats();
                });
            }
        }
    }

    animateScale(obj, targetScale, callback) {
        const startScale = obj.scale.x;
        const duration = 250;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = targetScale > startScale 
                ? 1 - Math.pow(1 - progress, 3)
                : progress * progress;
            
            const scale = startScale + (targetScale - startScale) * eased;
            obj.scale.set(scale, scale, scale);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (callback) {
                callback();
            }
        };
        
        if (targetScale > 0) {
            obj.scale.set(0.01, 0.01, 0.01);
        }
        animate();
    }

    updateStats() {
        let totalEnergy = 0;
        let totalCrew = 0;

        this.modules.forEach(module => {
            const data = this.moduleData[module.userData.type];
            if (data) {
                totalEnergy += data.energy;
                totalCrew += data.crew;
            }
        });

        document.getElementById('module-count').textContent = this.modules.length;
        
        const energyEl = document.getElementById('energy');
        energyEl.textContent = (totalEnergy >= 0 ? '+' : '') + totalEnergy;
        energyEl.className = 'value ' + (totalEnergy >= 0 ? 'energy-positive' : 'energy-negative');
        
        document.getElementById('crew').textContent = totalCrew;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = Date.now() * 0.001;

        if (this.stars) {
            this.stars.rotation.y += 0.00005;
        }

        if (this.clouds) {
            this.clouds.rotation.y += 0.0001;
        }

        if (this.earth) {
            this.earth.rotation.y += 0.00003;
        }

        // Animate modules
        this.modules.forEach((module, i) => {
            module.position.y = (module.userData.gridKey ? 0 : module.position.y) + Math.sin(time + i * 0.5) * 0.03;
            
            if (module.userData.type === 'antenna') {
                module.children[0].rotation.y = time * 0.5;
            }
            if (module.userData.type === 'solar') {
                module.rotation.y = Math.sin(time * 0.2) * 0.15;
            }
        });

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('load', () => {
    new SpaceStationBuilder();
});
