// Space Station Builder - 3D Game with Touch Controls

class SpaceStationBuilder {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.modules = [];
        this.stars = [];
        this.selectedModule = 'core';
        this.deleteMode = false;
        this.cameraAngle = 0;
        this.cameraDistance = 30;
        this.cameraHeight = 20;
        this.gridSize = 20;
        this.ghostModule = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.grid = {};
        
        this.moduleStats = {
            core: { energy: 5, crew: 2 },
            solar: { energy: 10, crew: 0 },
            habitat: { energy: -2, crew: 4 },
            lab: { energy: -3, crew: 2 },
            storage: { energy: -1, crew: 0 },
            dock: { energy: -2, crew: 1 },
            antenna: { energy: -1, crew: 0 },
            engine: { energy: -5, crew: 0 }
        };

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000510);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.updateCamera();

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Lights
        this.setupLights();

        // Stars background
        this.createStars();

        // Grid helper
        this.createGrid();

        // Earth in background
        this.createEarth();

        // Events
        this.setupEvents();

        // Ghost module for preview
        this.createGhostModule();

        // Animation
        this.animate();
    }

    setupLights() {
        // Ambient
        const ambient = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambient);

        // Sun light
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(50, 30, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.scene.add(sunLight);

        // Blue rim light
        const rimLight = new THREE.DirectionalLight(0x0066ff, 0.3);
        rimLight.position.set(-30, -10, -30);
        this.scene.add(rimLight);

        // Point lights for atmosphere
        const pointLight1 = new THREE.PointLight(0x00ffff, 0.5, 50);
        pointLight1.position.set(10, 10, 10);
        this.scene.add(pointLight1);
    }

    createStars() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.5,
            transparent: true
        });

        const positions = [];
        for (let i = 0; i < 2000; i++) {
            positions.push(
                (Math.random() - 0.5) * 500,
                (Math.random() - 0.5) * 500,
                (Math.random() - 0.5) * 500
            );
        }

        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);
        this.stars = stars;
    }

    createGrid() {
        // Visual grid
        const gridHelper = new THREE.GridHelper(this.gridSize, this.gridSize, 0x00ffff, 0x004444);
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        // Invisible plane for raycasting
        const planeGeometry = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
        const planeMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            side: THREE.DoubleSide
        });
        this.groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.name = 'ground';
        this.scene.add(this.groundPlane);
    }

    createEarth() {
        const earthGeometry = new THREE.SphereGeometry(50, 32, 32);
        const earthMaterial = new THREE.MeshStandardMaterial({
            color: 0x2244aa,
            emissive: 0x112244,
            emissiveIntensity: 0.2
        });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.position.set(0, -80, -50);
        this.scene.add(earth);

        // Atmosphere glow
        const glowGeometry = new THREE.SphereGeometry(52, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(earth.position);
        this.scene.add(glow);
    }

    createGhostModule() {
        this.ghostModule = this.createModuleMesh(this.selectedModule);
        this.ghostModule.traverse(child => {
            if (child.material) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.5;
            }
        });
        this.ghostModule.visible = false;
        this.scene.add(this.ghostModule);
    }

    createModuleMesh(type) {
        const group = new THREE.Group();
        
        const materials = {
            core: new THREE.MeshStandardMaterial({ color: 0x4488ff, metalness: 0.8, roughness: 0.2 }),
            solar: new THREE.MeshStandardMaterial({ color: 0x2244aa, metalness: 0.9, roughness: 0.1 }),
            habitat: new THREE.MeshStandardMaterial({ color: 0x88ff88, metalness: 0.6, roughness: 0.3 }),
            lab: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.2 }),
            storage: new THREE.MeshStandardMaterial({ color: 0xffaa44, metalness: 0.5, roughness: 0.4 }),
            dock: new THREE.MeshStandardMaterial({ color: 0xff4444, metalness: 0.7, roughness: 0.3 }),
            antenna: new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 }),
            engine: new THREE.MeshStandardMaterial({ color: 0xff6600, metalness: 0.8, roughness: 0.2 })
        };

        const mat = materials[type] || materials.core;

        switch(type) {
            case 'core':
                // Main cylinder
                const coreBody = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.8, 0.8, 1.5, 8),
                    mat
                );
                coreBody.rotation.x = Math.PI / 2;
                coreBody.castShadow = true;
                group.add(coreBody);
                
                // Connection ports
                const portGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 6);
                [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].forEach(pos => {
                    const port = new THREE.Mesh(portGeom, mat);
                    port.position.set(pos[0] * 0.9, pos[1], pos[2] * 0.9);
                    port.rotation.z = Math.PI / 2;
                    if (pos[2] !== 0) port.rotation.y = Math.PI / 2;
                    group.add(port);
                });
                break;

            case 'solar':
                // Panel support
                const support = new THREE.Mesh(
                    new THREE.BoxGeometry(0.2, 0.2, 1.8),
                    mat
                );
                support.castShadow = true;
                group.add(support);
                
                // Solar panels
                const panelMat = new THREE.MeshStandardMaterial({
                    color: 0x1a1a44,
                    metalness: 0.9,
                    roughness: 0.1,
                    emissive: 0x000033,
                    emissiveIntensity: 0.3
                });
                [-1, 1].forEach(side => {
                    const panel = new THREE.Mesh(
                        new THREE.BoxGeometry(1.5, 0.05, 1.5),
                        panelMat
                    );
                    panel.position.x = side * 0.85;
                    panel.castShadow = true;
                    group.add(panel);
                });
                break;

            case 'habitat':
                // Main module
                const habBody = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.7, 0.7, 2, 8),
                    mat
                );
                habBody.rotation.x = Math.PI / 2;
                habBody.castShadow = true;
                group.add(habBody);
                
                // Windows
                const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
                for (let i = 0; i < 4; i++) {
                    const win = new THREE.Mesh(
                        new THREE.CircleGeometry(0.15, 8),
                        windowMat
                    );
                    win.position.set(
                        Math.cos(i * Math.PI / 2) * 0.71,
                        0,
                        Math.sin(i * Math.PI / 2) * 0.71
                    );
                    win.lookAt(win.position.clone().multiplyScalar(2));
                    group.add(win);
                }
                break;

            case 'lab':
                // Spherical lab
                const labSphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.8, 16, 16),
                    mat
                );
                labSphere.castShadow = true;
                group.add(labSphere);
                
                // Equipment
                const equipMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, emissive: 0x0044aa, emissiveIntensity: 0.5 });
                const equip = new THREE.Mesh(
                    new THREE.TorusGeometry(0.5, 0.1, 8, 16),
                    equipMat
                );
                equip.rotation.x = Math.PI / 2;
                group.add(equip);
                break;

            case 'storage':
                // Cargo container
                const cargo = new THREE.Mesh(
                    new THREE.BoxGeometry(1.5, 1, 1),
                    mat
                );
                cargo.castShadow = true;
                group.add(cargo);
                
                // Details
                const detailMat = new THREE.MeshStandardMaterial({ color: 0x886633 });
                [[-0.5, 0], [0.5, 0]].forEach(pos => {
                    const detail = new THREE.Mesh(
                        new THREE.BoxGeometry(0.4, 1.02, 0.1),
                        detailMat
                    );
                    detail.position.set(pos[0], 0, 0.5);
                    group.add(detail);
                });
                break;

            case 'dock':
                // Docking port
                const dockRing = new THREE.Mesh(
                    new THREE.TorusGeometry(0.6, 0.15, 8, 16),
                    mat
                );
                dockRing.rotation.x = Math.PI / 2;
                dockRing.castShadow = true;
                group.add(dockRing);
                
                // Support structure
                const dockSupport = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.4, 0.6, 0.8, 8),
                    mat
                );
                dockSupport.position.y = -0.4;
                dockSupport.castShadow = true;
                group.add(dockSupport);
                
                // Lights
                const lightMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                for (let i = 0; i < 4; i++) {
                    const light = new THREE.Mesh(
                        new THREE.SphereGeometry(0.08, 8, 8),
                        lightMat
                    );
                    light.position.set(
                        Math.cos(i * Math.PI / 2) * 0.6,
                        0,
                        Math.sin(i * Math.PI / 2) * 0.6
                    );
                    group.add(light);
                }
                break;

            case 'antenna':
                // Dish
                const dish = new THREE.Mesh(
                    new THREE.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
                    mat
                );
                dish.rotation.x = Math.PI;
                dish.position.y = 0.5;
                dish.castShadow = true;
                group.add(dish);
                
                // Support
                const antSupport = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.1, 0.15, 1, 6),
                    mat
                );
                antSupport.position.y = -0.2;
                group.add(antSupport);
                
                // Feed
                const feed = new THREE.Mesh(
                    new THREE.ConeGeometry(0.1, 0.4, 6),
                    new THREE.MeshBasicMaterial({ color: 0xff0000 })
                );
                feed.position.y = 0.3;
                feed.rotation.x = Math.PI;
                group.add(feed);
                break;

            case 'engine':
                // Engine body
                const engBody = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.5, 0.7, 1.2, 8),
                    mat
                );
                engBody.castShadow = true;
                group.add(engBody);
                
                // Nozzle
                const nozzle = new THREE.Mesh(
                    new THREE.ConeGeometry(0.6, 0.8, 8, 1, true),
                    new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9 })
                );
                nozzle.position.y = -0.9;
                nozzle.rotation.x = Math.PI;
                group.add(nozzle);
                
                // Glow
                const glowMat = new THREE.MeshBasicMaterial({
                    color: 0xff4400,
                    transparent: true,
                    opacity: 0.6
                });
                const glow = new THREE.Mesh(
                    new THREE.ConeGeometry(0.4, 1.5, 8),
                    glowMat
                );
                glow.position.y = -1.8;
                glow.rotation.x = Math.PI;
                group.add(glow);
                break;
        }

        group.userData.type = type;
        return group;
    }

    updateCamera() {
        const x = Math.sin(this.cameraAngle) * this.cameraDistance;
        const z = Math.cos(this.cameraAngle) * this.cameraDistance;
        this.camera.position.set(x, this.cameraHeight, z);
        this.camera.lookAt(0, 0, 0);
    }

    setupEvents() {
        // Touch events
        const canvas = this.renderer.domElement;

        canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

        // Mouse events (for testing on desktop)
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('click', (e) => this.onClick(e));
        canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

        // Module selection
        document.querySelectorAll('.module-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.module-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedModule = btn.dataset.module;
                this.updateGhostModule();
            });
        });

        // Rotate buttons
        document.getElementById('rotate-left').addEventListener('click', () => {
            this.cameraAngle -= 0.3;
            this.updateCamera();
        });

        document.getElementById('rotate-right').addEventListener('click', () => {
            this.cameraAngle += 0.3;
            this.updateCamera();
        });

        // Delete button
        document.getElementById('delete-btn').addEventListener('click', () => {
            this.deleteMode = !this.deleteMode;
            document.getElementById('delete-btn').classList.toggle('active', this.deleteMode);
        });

        // Zoom buttons
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.cameraDistance = Math.max(15, this.cameraDistance - 5);
            this.cameraHeight = Math.max(10, this.cameraHeight - 3);
            this.updateCamera();
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.cameraDistance = Math.min(60, this.cameraDistance + 5);
            this.cameraHeight = Math.min(40, this.cameraHeight + 3);
            this.updateCamera();
        });

        // Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    lastTouchTime = 0;
    touchStartPos = null;

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
            if (Math.abs(deltaX) > 30) {
                this.cameraAngle += deltaX * 0.002;
                this.updateCamera();
                this.touchStartPos.x = e.touches[0].clientX;
            }
        } else if (e.touches.length === 2) {
            // Pinch zoom
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (this.lastPinchDist) {
                const delta = this.lastPinchDist - dist;
                this.cameraDistance = Math.max(15, Math.min(60, this.cameraDistance + delta * 0.1));
                this.cameraHeight = Math.max(10, Math.min(40, this.cameraHeight + delta * 0.05));
                this.updateCamera();
            }
            this.lastPinchDist = dist;
        }

        // Update ghost position
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

            if (moveDistance < 20) {
                this.updateMousePosition(endX, endY);
                
                if (timeDiff < 300) {
                    // Double tap - delete
                    this.deleteModuleAtPosition();
                } else {
                    // Single tap - place
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

    onMouseDown(e) {
        // For desktop dragging
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
            
            // Check bounds
            const limit = this.gridSize / 2 - 1;
            if (Math.abs(gridX) <= limit && Math.abs(gridZ) <= limit) {
                return { x: gridX, z: gridZ };
            }
        }
        return null;
    }

    updateGhostPosition() {
        const pos = this.getGridPosition();
        if (pos && !this.deleteMode) {
            this.ghostModule.position.set(pos.x, 0, pos.z);
            this.ghostModule.visible = true;
            
            // Color based on availability
            const key = `${pos.x},${pos.z}`;
            const canPlace = !this.grid[key];
            this.ghostModule.traverse(child => {
                if (child.material) {
                    child.material.opacity = canPlace ? 0.5 : 0.2;
                }
            });
        } else {
            this.ghostModule.visible = false;
        }
    }

    updateGhostModule() {
        this.scene.remove(this.ghostModule);
        this.ghostModule = this.createModuleMesh(this.selectedModule);
        this.ghostModule.traverse(child => {
            if (child.material) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.5;
            }
        });
        this.ghostModule.visible = false;
        this.scene.add(this.ghostModule);
    }

    placeModule() {
        const pos = this.getGridPosition();
        if (!pos) return;

        const key = `${pos.x},${pos.z}`;
        if (this.grid[key]) return; // Already occupied

        const module = this.createModuleMesh(this.selectedModule);
        module.position.set(pos.x, 0, pos.z);
        module.userData.gridKey = key;
        
        this.scene.add(module);
        this.modules.push(module);
        this.grid[key] = module;

        this.updateStats();

        // Animation
        module.scale.set(0, 0, 0);
        this.animateScale(module, 1);
    }

    deleteModuleAtPosition() {
        const pos = this.getGridPosition();
        if (!pos) return;

        const key = `${pos.x},${pos.z}`;
        const module = this.grid[key];
        
        if (module) {
            this.animateScale(module, 0, () => {
                this.scene.remove(module);
                this.modules = this.modules.filter(m => m !== module);
                delete this.grid[key];
                this.updateStats();
            });
        }
    }

    animateScale(obj, targetScale, callback) {
        const startScale = obj.scale.x;
        const duration = 200;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            const scale = startScale + (targetScale - startScale) * eased;
            obj.scale.set(scale, scale, scale);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (callback) {
                callback();
            }
        };
        animate();
    }

    updateStats() {
        let totalEnergy = 0;
        let totalCrew = 0;

        this.modules.forEach(module => {
            const stats = this.moduleStats[module.userData.type];
            if (stats) {
                totalEnergy += stats.energy;
                totalCrew += stats.crew;
            }
        });

        document.getElementById('module-count').textContent = this.modules.length;
        document.getElementById('energy').textContent = totalEnergy;
        document.getElementById('crew').textContent = totalCrew;

        // Color energy display
        const energyEl = document.getElementById('energy');
        energyEl.style.color = totalEnergy >= 0 ? '#0f0' : '#f44';
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Rotate stars slowly
        if (this.stars) {
            this.stars.rotation.y += 0.0001;
        }

        // Animate modules
        this.modules.forEach((module, i) => {
            // Gentle floating
            module.position.y = Math.sin(Date.now() * 0.001 + i) * 0.05;
            
            // Solar panels rotation
            if (module.userData.type === 'solar') {
                module.rotation.y = Math.sin(Date.now() * 0.0005) * 0.2;
            }
            
            // Antenna rotation
            if (module.userData.type === 'antenna') {
                module.rotation.y += 0.01;
            }
        });

        this.renderer.render(this.scene, this.camera);
    }
}

// Start
window.addEventListener('load', () => {
    new SpaceStationBuilder();
});
