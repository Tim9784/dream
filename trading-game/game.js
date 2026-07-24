// Trading City - 3D Investment Game
// Enhanced version with collisions, better graphics, persistent saves

class TradingGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Player
        this.player = null;
        this.playerSpeed = 10;
        this.moveDir = { x: 0, z: 0 };
        
        // Buildings & Collisions
        this.buildings = [];
        this.colliders = [];
        this.nearBuilding = null;
        
        // Economy - Load from localStorage
        this.balance = 10000;
        this.portfolio = {};
        this.priceHistory = {};
        this.loadSaveData();
        
        // Assets
        this.assets = {
            crypto: [
                { id: 'btc', name: 'Bitcoin', symbol: 'BTC', price: 45000, color: '#f7931a', icon: '₿', volatility: 0.04 },
                { id: 'eth', name: 'Ethereum', symbol: 'ETH', price: 3200, color: '#627eea', icon: 'Ξ', volatility: 0.035 },
                { id: 'sol', name: 'Solana', symbol: 'SOL', price: 120, color: '#00ffa3', icon: '◎', volatility: 0.05 },
                { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', price: 0.12, color: '#c3a634', icon: 'Ð', volatility: 0.08 }
            ],
            stocks: [
                { id: 'aapl', name: 'Apple', symbol: 'AAPL', price: 175, color: '#555555', icon: '', volatility: 0.015 },
                { id: 'googl', name: 'Google', symbol: 'GOOGL', price: 140, color: '#4285f4', icon: 'G', volatility: 0.018 },
                { id: 'tsla', name: 'Tesla', symbol: 'TSLA', price: 250, color: '#cc0000', icon: 'T', volatility: 0.03 },
                { id: 'amzn', name: 'Amazon', symbol: 'AMZN', price: 180, color: '#ff9900', icon: 'A', volatility: 0.02 }
            ],
            bonds: [
                { id: 'usbond', name: 'US Treasury', symbol: 'T-BOND', price: 98.5, color: '#1a5276', icon: '🇺🇸', volatility: 0.003 },
                { id: 'corpbond', name: 'Corp Bond AAA', symbol: 'CORP-A', price: 102.3, color: '#2e86ab', icon: '🏢', volatility: 0.005 },
                { id: 'munibond', name: 'Municipal', symbol: 'MUNI', price: 100.8, color: '#a23b72', icon: '🏛️', volatility: 0.004 }
            ]
        };

        this.currentAssetType = 'crypto';
        this.selectedAsset = null;
        this.isModalOpen = false;
        this.showingPortfolio = false;

        this.newsItems = [
            "📰 Bitcoin достиг нового максимума! Инвесторы в восторге.",
            "📉 Акции Tesla падают на фоне отчётности.",
            "🚀 Ethereum обновляется — газ подешевел!",
            "💼 Apple представила новый продукт.",
            "🏦 ФРС оставила ставку без изменений.",
            "📊 Рынок облигаций стабилен.",
            "🐕 Dogecoin взлетел после твита Илона Маска!",
            "🌍 Глобальные рынки открылись ростом.",
            "⚡ Solana показывает рекордную скорость транзакций!",
            "📱 Google анонсировал новый AI продукт."
        ];

        this.init();
    }

    // ============== SAVE/LOAD ==============
    
    loadSaveData() {
        try {
            const saved = localStorage.getItem('tradingCity_save');
            if (saved) {
                const data = JSON.parse(saved);
                this.balance = data.balance || 10000;
                this.portfolio = data.portfolio || {};
                console.log('Game loaded!', this.balance, this.portfolio);
            }
        } catch (e) {
            console.log('No save data found');
        }
    }

    saveGame() {
        try {
            const data = {
                balance: this.balance,
                portfolio: this.portfolio
            };
            localStorage.setItem('tradingCity_save', JSON.stringify(data));
        } catch (e) {
            console.log('Save failed');
        }
    }

    // ============== INIT ==============

    init() {
        // Scene
        this.scene = new THREE.Scene();
        
        // Sky gradient
        const skyGeo = new THREE.SphereGeometry(400, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0x89cff0) },
                offset: { value: 20 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);

        this.scene.fog = new THREE.Fog(0x89cff0, 80, 200);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        document.getElementById('game').prepend(this.renderer.domElement);

        this.createLights();
        this.createWorld();
        this.createPlayer();
        this.initPriceHistory();
        this.setupEvents();
        this.startPriceUpdates();
        this.startNews();
        this.updateBalance();

        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 500);

        this.animate();
    }

    createLights() {
        // Ambient
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // Sun
        const sun = new THREE.DirectionalLight(0xfffaed, 1.2);
        sun.position.set(60, 100, 40);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 4096;
        sun.shadow.mapSize.height = 4096;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 400;
        sun.shadow.camera.left = -120;
        sun.shadow.camera.right = 120;
        sun.shadow.camera.top = 120;
        sun.shadow.camera.bottom = -120;
        sun.shadow.bias = -0.0001;
        this.scene.add(sun);

        // Hemisphere
        this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x556633, 0.5));

        // Fill light
        const fill = new THREE.DirectionalLight(0x8888ff, 0.2);
        fill.position.set(-50, 30, -50);
        this.scene.add(fill);
    }

    createWorld() {
        // Ground with texture
        const groundGeo = new THREE.PlaneGeometry(300, 300, 50, 50);
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: 0x4a7c4e,
            roughness: 0.9,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Roads
        this.createRoads();

        // Buildings
        this.createBuildings();

        // Environment
        this.createEnvironment();
    }

    createRoads() {
        const roadMat = new THREE.MeshStandardMaterial({ 
            color: 0x333333, 
            roughness: 0.8 
        });
        const sidewalkMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            roughness: 0.7 
        });

        // Main horizontal road
        const roadH = new THREE.Mesh(new THREE.BoxGeometry(250, 0.1, 14), roadMat);
        roadH.position.y = 0.05;
        roadH.receiveShadow = true;
        this.scene.add(roadH);

        // Main vertical road
        const roadV = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 250), roadMat);
        roadV.position.y = 0.05;
        roadV.receiveShadow = true;
        this.scene.add(roadV);

        // Sidewalks
        const swPositions = [
            [0, 8.5, 125, 3], [0, -8.5, 125, 3],
            [8.5, 0, 3, 125], [-8.5, 0, 3, 125]
        ];
        swPositions.forEach(([x, z, w, d]) => {
            const sw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), sidewalkMat);
            sw.position.set(x, 0.075, z);
            sw.receiveShadow = true;
            this.scene.add(sw);
            
            const sw2 = sw.clone();
            sw2.position.z = -z;
            this.scene.add(sw2);
        });

        // Road markings
        const markingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let i = -110; i <= 110; i += 8) {
            if (Math.abs(i) < 8) continue;
            const marking = new THREE.Mesh(new THREE.BoxGeometry(4, 0.02, 0.4), markingMat);
            marking.position.set(i, 0.11, 0);
            this.scene.add(marking);

            const marking2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 4), markingMat);
            marking2.position.set(0, 0.11, i);
            this.scene.add(marking2);
        }

        // Crosswalks
        const crosswalkMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
        [[-12, 0], [12, 0], [0, -12], [0, 12]].forEach(([x, z]) => {
            for (let i = -5; i <= 5; i += 2.5) {
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(x === 0 ? 1 : 6, 0.02, x === 0 ? 6 : 1), crosswalkMat);
                stripe.position.set(x === 0 ? i : x, 0.11, z === 0 ? i : z);
                this.scene.add(stripe);
            }
        });
    }

    createBuildings() {
        const configs = [
            { name: 'Криптобиржа', type: 'crypto', pos: [-40, 35], size: [24, 30, 22], color: 0xf7931a, roofColor: 0xcc7700 },
            { name: 'Фондовая биржа', type: 'stocks', pos: [40, 35], size: [28, 40, 24], color: 0x2563eb, roofColor: 0x1e40af },
            { name: 'Банк', type: 'bonds', pos: [-40, -40], size: [26, 25, 22], color: 0x1a5276, roofColor: 0x154360 },
            { name: 'Торговый центр', type: 'shop', pos: [40, -40], size: [32, 18, 28], color: 0xec4899, roofColor: 0xbe185d }
        ];

        configs.forEach(config => {
            const building = this.createBuilding(config);
            this.buildings.push(building);
        });
    }

    createBuilding(config) {
        const group = new THREE.Group();
        const [w, h, d] = config.size;

        // Foundation
        const foundationGeo = new THREE.BoxGeometry(w + 2, 1, d + 2);
        const foundationMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 });
        const foundation = new THREE.Mesh(foundationGeo, foundationMat);
        foundation.position.y = 0.5;
        foundation.receiveShadow = true;
        foundation.castShadow = true;
        group.add(foundation);

        // Main building
        const buildingGeo = new THREE.BoxGeometry(w, h, d);
        const buildingMat = new THREE.MeshStandardMaterial({ 
            color: config.color,
            roughness: 0.6,
            metalness: 0.1
        });
        const building = new THREE.Mesh(buildingGeo, buildingMat);
        building.position.y = h / 2 + 1;
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);

        // Roof
        const roofGeo = new THREE.BoxGeometry(w + 1, 2, d + 1);
        const roofMat = new THREE.MeshStandardMaterial({ color: config.roofColor, roughness: 0.5 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = h + 2;
        roof.castShadow = true;
        group.add(roof);

        // AC units on roof
        for (let i = 0; i < 3; i++) {
            const ac = new THREE.Mesh(
                new THREE.BoxGeometry(2, 1.5, 2),
                new THREE.MeshStandardMaterial({ color: 0x666666 })
            );
            ac.position.set(-w/4 + i * w/4, h + 3.75, 0);
            ac.castShadow = true;
            group.add(ac);
        }

        // Windows - detailed
        const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const windowGlassMat = new THREE.MeshStandardMaterial({ 
            color: 0x88ccff,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.7
        });

        const rows = Math.floor(h / 5);
        const cols = Math.floor(w / 5);

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Front windows
                const winFrame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 0.2), windowFrameMat);
                winFrame.position.set(-w/2 + 2.5 + col * 5, 4 + row * 5, d/2 + 0.1);
                group.add(winFrame);

                const winGlass = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 0.1), windowGlassMat);
                winGlass.position.set(-w/2 + 2.5 + col * 5, 4 + row * 5, d/2 + 0.2);
                group.add(winGlass);

                // Back windows
                const winFrame2 = winFrame.clone();
                winFrame2.position.z = -d/2 - 0.1;
                group.add(winFrame2);

                const winGlass2 = winGlass.clone();
                winGlass2.position.z = -d/2 - 0.2;
                group.add(winGlass2);
            }
        }

        // Entrance - detailed
        const entranceFrameMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
        const entranceFrame = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 0.5), entranceFrameMat);
        entranceFrame.position.set(0, 6, d/2 + 0.25);
        group.add(entranceFrame);

        const entranceGlass = new THREE.Mesh(
            new THREE.BoxGeometry(6, 8, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x335566, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.8 })
        );
        entranceGlass.position.set(0, 5, d/2 + 0.5);
        group.add(entranceGlass);

        // Entrance canopy
        const canopy = new THREE.Mesh(
            new THREE.BoxGeometry(10, 0.5, 4),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        canopy.position.set(0, 10.5, d/2 + 2);
        canopy.castShadow = true;
        group.add(canopy);

        // Sign
        const signGeo = new THREE.BoxGeometry(w * 0.7, 3, 0.3);
        const signMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.2
        });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, h - 2, d/2 + 0.3);
        group.add(sign);

        // Pillars at entrance
        const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, 10, 8);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        [-4, 4].forEach(x => {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(x, 5, d/2 + 2);
            pillar.castShadow = true;
            group.add(pillar);
        });

        group.position.set(config.pos[0], 0, config.pos[1]);
        
        // Collision box
        const collider = {
            minX: config.pos[0] - w/2 - 1,
            maxX: config.pos[0] + w/2 + 1,
            minZ: config.pos[1] - d/2 - 1,
            maxZ: config.pos[1] + d/2 + 1
        };
        this.colliders.push(collider);

        // Interaction zone (larger)
        group.userData = { 
            name: config.name, 
            type: config.type,
            interactZone: {
                minX: config.pos[0] - w/2 - 5,
                maxX: config.pos[0] + w/2 + 5,
                minZ: config.pos[1] - d/2 - 5,
                maxZ: config.pos[1] + d/2 + 8 // Extend in front
            }
        };

        this.scene.add(group);
        return group;
    }

    createEnvironment() {
        // Trees
        const treePositions = [
            [-70, 15], [-70, -15], [70, 15], [70, -15],
            [-15, 70], [15, 70], [-15, -70], [15, -70],
            [-60, 60], [60, 60], [-60, -60], [60, -60],
            [-80, 0], [80, 0], [0, 80], [0, -80],
            [-70, 50], [70, 50], [-70, -50], [70, -50]
        ];

        treePositions.forEach(pos => {
            this.createTree(pos[0], pos[1]);
        });

        // Benches
        const benchPositions = [
            [-18, 12, 0], [18, 12, 0], [-18, -12, 0], [18, -12, 0],
            [-12, 18, Math.PI/2], [12, 18, Math.PI/2], [-12, -18, Math.PI/2], [12, -18, Math.PI/2]
        ];

        benchPositions.forEach(([x, z, rot]) => {
            this.createBench(x, z, rot);
        });

        // Lamp posts
        const lampPositions = [
            [-10, 25], [10, 25], [-10, -25], [10, -25],
            [25, 10], [25, -10], [-25, 10], [-25, -10],
            [-10, 55], [10, 55], [-10, -55], [10, -55],
            [55, 10], [55, -10], [-55, 10], [-55, -10]
        ];

        lampPositions.forEach(pos => {
            this.createLamp(pos[0], pos[1]);
        });

        // Cars (parked)
        this.createCar(-25, 5, 0, 0xff0000);
        this.createCar(25, -5, Math.PI, 0x0000ff);
        this.createCar(5, 25, Math.PI/2, 0x00ff00);
        this.createCar(-5, -25, -Math.PI/2, 0xffff00);

        // Fountain at center
        this.createFountain();
    }

    createTree(x, z) {
        const tree = new THREE.Group();

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 5, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2.5;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);

        // Foliage layers
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
        
        const foliage1 = new THREE.Mesh(new THREE.ConeGeometry(3, 4, 8), foliageMat);
        foliage1.position.y = 6;
        foliage1.castShadow = true;
        tree.add(foliage1);

        const foliage2 = new THREE.Mesh(new THREE.ConeGeometry(2.5, 3.5, 8), foliageMat);
        foliage2.position.y = 8.5;
        foliage2.castShadow = true;
        tree.add(foliage2);

        const foliage3 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 8), foliageMat);
        foliage3.position.y = 10.5;
        foliage3.castShadow = true;
        tree.add(foliage3);

        tree.position.set(x, 0, z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        this.scene.add(tree);

        // Small collision
        this.colliders.push({
            minX: x - 0.8,
            maxX: x + 0.8,
            minZ: z - 0.8,
            maxZ: z + 0.8
        });
    }

    createBench(x, z, rotation = 0) {
        const bench = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });

        // Seat planks
        for (let i = -1; i <= 1; i++) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.4), woodMat);
            plank.position.set(0, 0.8, i * 0.35);
            plank.castShadow = true;
            bench.add(plank);
        }

        // Back planks
        for (let i = 0; i < 3; i++) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.3), woodMat);
            plank.position.set(0, 1.2 + i * 0.25, -0.55);
            plank.rotation.x = 0.15;
            plank.castShadow = true;
            bench.add(plank);
        }

        // Legs
        [[-1, 0], [1, 0]].forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.8), metalMat);
            leg.position.set(lx, 0.45, lz);
            leg.castShadow = true;
            bench.add(leg);
        });

        bench.position.set(x, 0, z);
        bench.rotation.y = rotation;
        this.scene.add(bench);

        // Collision
        this.colliders.push({
            minX: x - 1.5,
            maxX: x + 1.5,
            minZ: z - 0.8,
            maxZ: z + 0.8
        });
    }

    createLamp(x, z) {
        const lamp = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.3 });

        // Base
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.5, 8), metalMat);
        base.position.y = 0.25;
        base.castShadow = true;
        lamp.add(base);

        // Pole
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 8), metalMat);
        pole.position.y = 4;
        pole.castShadow = true;
        lamp.add(pole);

        // Arm
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), metalMat);
        arm.position.set(0.75, 7.3, 0);
        lamp.add(arm);

        // Light housing
        const housing = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.4, 0.6, 8),
            metalMat
        );
        housing.position.set(1.4, 7.1, 0);
        lamp.add(housing);

        // Light bulb
        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffcc })
        );
        bulb.position.set(1.4, 6.8, 0);
        lamp.add(bulb);

        // Point light
        const light = new THREE.PointLight(0xffffcc, 0.4, 20);
        light.position.set(1.4, 6.8, 0);
        lamp.add(light);

        lamp.position.set(x, 0, z);
        this.scene.add(lamp);

        // Collision
        this.colliders.push({
            minX: x - 0.5,
            maxX: x + 0.5,
            minZ: z - 0.5,
            maxZ: z + 0.5
        });
    }

    createCar(x, z, rotation, color) {
        const car = new THREE.Group();

        // Body
        const bodyMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.8, roughness: 0.3 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 2), bodyMat);
        body.position.y = 0.9;
        body.castShadow = true;
        car.add(body);

        // Cabin
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.8), bodyMat);
        cabin.position.set(-0.3, 1.8, 0);
        cabin.castShadow = true;
        car.add(cabin);

        // Windows
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.9, roughness: 0.1 });
        const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 1.5), windowMat);
        frontWindow.position.set(0.65, 1.8, 0);
        car.add(frontWindow);

        const backWindow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 1.5), windowMat);
        backWindow.position.set(-1.25, 1.8, 0);
        car.add(backWindow);

        // Wheels
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        [[-1.2, 1], [-1.2, -1], [1.2, 1], [1.2, -1]].forEach(([wx, wz]) => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(wx, 0.4, wz);
            wheel.rotation.x = Math.PI / 2;
            wheel.castShadow = true;
            car.add(wheel);
        });

        // Headlights
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        [-0.6, 0.6].forEach(lz => {
            const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), lightMat);
            headlight.position.set(2, 0.9, lz);
            car.add(headlight);
        });

        car.position.set(x, 0, z);
        car.rotation.y = rotation;
        this.scene.add(car);

        // Collision
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        this.colliders.push({
            minX: x - 2.5,
            maxX: x + 2.5,
            minZ: z - 1.5,
            maxZ: z + 1.5
        });
    }

    createFountain() {
        const fountain = new THREE.Group();

        // Base pool
        const poolGeo = new THREE.CylinderGeometry(5, 5.5, 1, 24);
        const poolMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5 });
        const pool = new THREE.Mesh(poolGeo, poolMat);
        pool.position.y = 0.5;
        pool.castShadow = true;
        pool.receiveShadow = true;
        fountain.add(pool);

        // Water
        const waterGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.8, 24);
        const waterMat = new THREE.MeshStandardMaterial({ 
            color: 0x4488ff, 
            transparent: true, 
            opacity: 0.7,
            metalness: 0.3,
            roughness: 0.2
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.y = 0.6;
        fountain.add(water);

        // Center pillar
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.7, 3, 12),
            new THREE.MeshStandardMaterial({ color: 0x888888 })
        );
        pillar.position.y = 2;
        pillar.castShadow = true;
        fountain.add(pillar);

        // Top bowl
        const bowl = new THREE.Mesh(
            new THREE.CylinderGeometry(1.5, 1, 0.6, 16),
            new THREE.MeshStandardMaterial({ color: 0x777777 })
        );
        bowl.position.y = 3.5;
        bowl.castShadow = true;
        fountain.add(bowl);

        // Water spout
        const spout = new THREE.Mesh(
            new THREE.ConeGeometry(0.3, 1.5, 8),
            new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5 })
        );
        spout.position.y = 4.5;
        fountain.add(spout);

        fountain.position.set(0, 0, 0);
        this.scene.add(fountain);

        // Collision
        this.colliders.push({
            minX: -6,
            maxX: 6,
            minZ: -6,
            maxZ: 6
        });
    }

    createPlayer() {
        const player = new THREE.Group();

        // Legs
        const legMat = new THREE.MeshStandardMaterial({ color: 0x1a365d });
        const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.9, 8), legMat);
        leftLeg.position.set(-0.2, 0.45, 0);
        leftLeg.castShadow = true;
        player.add(leftLeg);
        this.playerLeftLeg = leftLeg;

        const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.9, 8), legMat);
        rightLeg.position.set(0.2, 0.45, 0);
        rightLeg.castShadow = true;
        player.add(rightLeg);
        this.playerRightLeg = rightLeg;

        // Body/Torso
        const torsoMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.8, 8), torsoMat);
        torso.position.y = 1.3;
        torso.castShadow = true;
        player.add(torso);

        // Arms
        const armMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
        const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), armMat);
        leftArm.position.set(-0.45, 1.2, 0);
        leftArm.rotation.z = 0.2;
        leftArm.castShadow = true;
        player.add(leftArm);
        this.playerLeftArm = leftArm;

        const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), armMat);
        rightArm.position.set(0.45, 1.2, 0);
        rightArm.rotation.z = -0.2;
        rightArm.castShadow = true;
        player.add(rightArm);
        this.playerRightArm = rightArm;

        // Head
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), headMat);
        head.position.y = 2;
        head.castShadow = true;
        player.add(head);

        // Hair
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
        hair.position.y = 2.1;
        player.add(hair);

        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        [-0.1, 0.1].forEach(ex => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
            eye.position.set(ex, 2.05, 0.25);
            player.add(eye);
        });

        // Shadow plane
        const shadowGeo = new THREE.CircleGeometry(0.5, 16);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.01;
        player.add(shadow);

        this.player = player;
        this.player.position.set(0, 0, 15);
        this.scene.add(this.player);
    }

    // ============== PRICE SYSTEM ==============

    initPriceHistory() {
        Object.values(this.assets).flat().forEach(asset => {
            this.priceHistory[asset.id] = [];
            let price = asset.price;
            for (let i = 0; i < 50; i++) {
                price = price * (1 + (Math.random() - 0.5) * asset.volatility);
                this.priceHistory[asset.id].push(price);
            }
            this.priceHistory[asset.id].push(asset.price);
        });
    }

    startPriceUpdates() {
        setInterval(() => {
            Object.values(this.assets).flat().forEach(asset => {
                const change = (Math.random() - 0.48) * asset.volatility;
                asset.price = Math.max(0.001, asset.price * (1 + change));
                
                this.priceHistory[asset.id].push(asset.price);
                if (this.priceHistory[asset.id].length > 51) {
                    this.priceHistory[asset.id].shift();
                }
            });

            if (this.isModalOpen && !this.showingPortfolio) {
                if (this.selectedAsset) {
                    this.updateTradePanel();
                } else {
                    this.renderAssetList();
                }
            }

            this.updateBalance();
            this.saveGame();
        }, 2000);
    }

    startNews() {
        let newsIndex = 0;
        const updateNews = () => {
            document.getElementById('news-text').textContent = this.newsItems[newsIndex];
            newsIndex = (newsIndex + 1) % this.newsItems.length;
        };
        updateNews();
        setInterval(updateNews, 6000);
    }

    // ============== EVENTS ==============

    setupEvents() {
        // Joystick
        const joystickZone = document.getElementById('joystick-zone');
        const joystickStick = document.getElementById('joystick-stick');
        let joystickActive = false;
        let joystickCenter = { x: 0, y: 0 };

        const handleJoystickStart = (e) => {
            e.preventDefault();
            joystickActive = true;
            const rect = joystickZone.getBoundingClientRect();
            joystickCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        };

        const handleJoystickMove = (e) => {
            if (!joystickActive) return;
            e.preventDefault();

            const touch = e.touches ? e.touches[0] : e;
            let dx = touch.clientX - joystickCenter.x;
            let dy = touch.clientY - joystickCenter.y;
            
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 45;
            
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }

            joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            
            this.moveDir.x = dx / maxDist;
            this.moveDir.z = dy / maxDist;
        };

        const handleJoystickEnd = () => {
            joystickActive = false;
            joystickStick.style.transform = 'translate(-50%, -50%)';
            this.moveDir.x = 0;
            this.moveDir.z = 0;
        };

        joystickZone.addEventListener('touchstart', handleJoystickStart, { passive: false });
        joystickZone.addEventListener('touchmove', handleJoystickMove, { passive: false });
        joystickZone.addEventListener('touchend', handleJoystickEnd);
        joystickZone.addEventListener('mousedown', handleJoystickStart);
        window.addEventListener('mousemove', (e) => { if (joystickActive) handleJoystickMove(e); });
        window.addEventListener('mouseup', handleJoystickEnd);

        // Keyboard
        const keys = {};
        window.addEventListener('keydown', (e) => {
            keys[e.key.toLowerCase()] = true;
            if (e.key === 'e' || e.key === 'Enter') this.tryInteract();
        });

        window.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
        });

        setInterval(() => {
            if (this.isModalOpen) return;
            this.moveDir.x = 0;
            this.moveDir.z = 0;
            if (keys['w'] || keys['arrowup']) this.moveDir.z = -1;
            if (keys['s'] || keys['arrowdown']) this.moveDir.z = 1;
            if (keys['a'] || keys['arrowleft']) this.moveDir.x = -1;
            if (keys['d'] || keys['arrowright']) this.moveDir.x = 1;
        }, 16);

        // UI buttons
        document.getElementById('interact-btn').addEventListener('click', () => this.tryInteract());
        document.getElementById('portfolio-btn').addEventListener('click', () => this.showPortfolio());
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());

        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentAssetType = tab.dataset.type;
                this.selectedAsset = null;
                document.getElementById('trade-panel').classList.remove('visible');
                this.renderAssetList();
            });
        });

        document.getElementById('back-to-list').addEventListener('click', () => {
            this.selectedAsset = null;
            document.getElementById('trade-panel').classList.remove('visible');
            document.getElementById('asset-selection').style.display = 'block';
        });

        document.getElementById('trade-amount').addEventListener('input', () => this.updateTradeTotal());
        document.getElementById('buy-btn').addEventListener('click', () => this.executeTrade('buy'));
        document.getElementById('sell-btn').addEventListener('click', () => this.executeTrade('sell'));

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // ============== COLLISION ==============

    checkCollision(newX, newZ) {
        const playerRadius = 0.5;
        
        for (const col of this.colliders) {
            if (newX + playerRadius > col.minX && 
                newX - playerRadius < col.maxX &&
                newZ + playerRadius > col.minZ && 
                newZ - playerRadius < col.maxZ) {
                return true;
            }
        }
        return false;
    }

    // ============== TRADING ==============

    tryInteract() {
        if (this.nearBuilding && this.nearBuilding.userData.type !== 'shop') {
            this.openTrading(this.nearBuilding.userData.type);
        }
    }

    openTrading(type) {
        this.isModalOpen = true;
        this.showingPortfolio = false;
        this.currentAssetType = type;
        this.selectedAsset = null;

        document.getElementById('modal').classList.add('visible');
        document.getElementById('modal-title').textContent = this.nearBuilding.userData.name;
        document.getElementById('asset-selection').style.display = 'block';
        document.getElementById('trade-panel').classList.remove('visible');
        document.getElementById('portfolio-panel').classList.remove('visible');

        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.type === type);
        });

        this.renderAssetList();
    }

    showPortfolio() {
        this.isModalOpen = true;
        this.showingPortfolio = true;

        document.getElementById('modal').classList.add('visible');
        document.getElementById('modal-title').textContent = 'Мой портфель';
        document.getElementById('asset-selection').style.display = 'none';
        document.getElementById('trade-panel').classList.remove('visible');
        document.getElementById('portfolio-panel').classList.add('visible');

        this.renderPortfolio();
    }

    closeModal() {
        this.isModalOpen = false;
        document.getElementById('modal').classList.remove('visible');
    }

    renderAssetList() {
        const list = document.getElementById('asset-list');
        const assets = this.assets[this.currentAssetType];
        
        list.innerHTML = assets.map(asset => {
            const history = this.priceHistory[asset.id];
            const prevPrice = history[history.length - 2] || asset.price;
            const change = ((asset.price - prevPrice) / prevPrice) * 100;
            const changeClass = change >= 0 ? 'up' : 'down';
            const changeSign = change >= 0 ? '+' : '';

            return `
                <div class="asset-item" data-id="${asset.id}">
                    <div class="asset-info">
                        <div class="asset-icon" style="background:${asset.color}">${asset.icon}</div>
                        <div>
                            <div class="asset-name">${asset.name}</div>
                            <div class="asset-symbol">${asset.symbol}</div>
                        </div>
                    </div>
                    <div class="asset-price">
                        <div class="asset-current">$${this.formatPrice(asset.price)}</div>
                        <div class="asset-change ${changeClass}">${changeSign}${change.toFixed(2)}%</div>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.asset-item').forEach(item => {
            item.addEventListener('click', () => {
                const assetId = item.dataset.id;
                this.selectedAsset = assets.find(a => a.id === assetId);
                this.showTradePanel();
            });
        });
    }

    showTradePanel() {
        document.getElementById('asset-selection').style.display = 'none';
        document.getElementById('trade-panel').classList.add('visible');
        document.getElementById('trade-amount').value = '1';
        this.updateTradePanel();
    }

    updateTradePanel() {
        if (!this.selectedAsset) return;
        
        document.getElementById('trade-asset-name').textContent = this.selectedAsset.name;
        document.getElementById('trade-asset-price').textContent = '$' + this.formatPrice(this.selectedAsset.price);
        
        this.updateTradeTotal();
        this.drawPriceChart();
        this.updateHoldingInfo();
    }

    updateTradeTotal() {
        if (!this.selectedAsset) return;
        const amount = parseFloat(document.getElementById('trade-amount').value) || 0;
        const total = amount * this.selectedAsset.price;
        document.getElementById('trade-total').textContent = `Итого: $${this.formatPrice(total)}`;
    }

    updateHoldingInfo() {
        const holding = this.portfolio[this.selectedAsset.id];
        const infoEl = document.getElementById('holding-info');
        
        if (holding && holding.amount > 0) {
            const currentValue = holding.amount * this.selectedAsset.price;
            const profit = currentValue - holding.cost;
            const profitPct = (profit / holding.cost) * 100;
            const profitClass = profit >= 0 ? 'color:#4ade80' : 'color:#f87171';
            
            infoEl.innerHTML = `
                <strong>Ваши активы:</strong><br>
                ${holding.amount.toFixed(4)} ${this.selectedAsset.symbol}<br>
                Стоимость: $${this.formatPrice(currentValue)}<br>
                <span style="${profitClass}">Прибыль: ${profit >= 0 ? '+' : ''}$${this.formatPrice(profit)} (${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%)</span>
            `;
        } else {
            infoEl.textContent = 'У вас нет этого актива';
        }
    }

    drawPriceChart() {
        const canvas = document.getElementById('price-chart');
        const ctx = canvas.getContext('2d');
        const history = this.priceHistory[this.selectedAsset.id];
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const min = Math.min(...history) * 0.99;
        const max = Math.max(...history) * 1.01;
        const range = max - min || 1;
        
        // Gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        const isUp = history[history.length - 1] >= history[0];
        gradient.addColorStop(0, isUp ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        
        history.forEach((price, i) => {
            const x = (i / (history.length - 1)) * canvas.width;
            const y = canvas.height - ((price - min) / range) * (canvas.height - 10) - 5;
            ctx.lineTo(x, y);
        });
        
        ctx.lineTo(canvas.width, canvas.height);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line
        ctx.strokeStyle = isUp ? '#4ade80' : '#f87171';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        history.forEach((price, i) => {
            const x = (i / (history.length - 1)) * canvas.width;
            const y = canvas.height - ((price - min) / range) * (canvas.height - 10) - 5;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
    }

    executeTrade(type) {
        const amount = parseFloat(document.getElementById('trade-amount').value);
        if (!amount || amount <= 0) return;

        const total = amount * this.selectedAsset.price;

        if (type === 'buy') {
            if (total > this.balance) {
                alert('Недостаточно средств!');
                return;
            }
            
            this.balance -= total;
            
            if (!this.portfolio[this.selectedAsset.id]) {
                this.portfolio[this.selectedAsset.id] = { 
                    amount: 0, 
                    cost: 0, 
                    symbol: this.selectedAsset.symbol, 
                    name: this.selectedAsset.name 
                };
            }
            this.portfolio[this.selectedAsset.id].amount += amount;
            this.portfolio[this.selectedAsset.id].cost += total;
            
        } else {
            const holding = this.portfolio[this.selectedAsset.id];
            if (!holding || holding.amount < amount) {
                alert('Недостаточно активов для продажи!');
                return;
            }
            
            const costPerUnit = holding.cost / holding.amount;
            holding.amount -= amount;
            holding.cost -= costPerUnit * amount;
            this.balance += total;
            
            if (holding.amount <= 0.0001) {
                delete this.portfolio[this.selectedAsset.id];
            }
        }

        this.updateBalance();
        this.updateHoldingInfo();
        this.saveGame();
    }

    renderPortfolio() {
        const listEl = document.getElementById('holdings-list');
        const holdings = Object.entries(this.portfolio);
        
        let totalValue = this.balance;
        
        let html = `
            <div class="holding-item" style="background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.3);">
                <div class="holding-header">
                    <span class="holding-name">💵 Наличные</span>
                    <span class="holding-value">$${this.formatPrice(this.balance)}</span>
                </div>
            </div>
        `;
        
        holdings.forEach(([id, holding]) => {
            const asset = Object.values(this.assets).flat().find(a => a.id === id);
            if (!asset) return;
            
            const value = holding.amount * asset.price;
            const profit = value - holding.cost;
            const profitPct = holding.cost > 0 ? (profit / holding.cost) * 100 : 0;
            totalValue += value;
            
            html += `
                <div class="holding-item">
                    <div class="holding-header">
                        <span class="holding-name">${holding.name}</span>
                        <span class="holding-value">$${this.formatPrice(value)}</span>
                    </div>
                    <div class="holding-details">
                        <span>${holding.amount.toFixed(4)} ${holding.symbol}</span>
                        <span style="color:${profit >= 0 ? '#4ade80' : '#f87171'}">${profit >= 0 ? '+' : ''}${profitPct.toFixed(2)}%</span>
                    </div>
                </div>
            `;
        });

        if (holdings.length === 0) {
            html += '<div style="color:rgba(255,255,255,0.5);text-align:center;padding:20px;">Инвестиций пока нет</div>';
        }

        document.getElementById('portfolio-value').textContent = '$' + this.formatPrice(totalValue);
        listEl.innerHTML = html;
    }

    updateBalance() {
        document.getElementById('balance').textContent = '$' + this.formatPrice(this.balance);
    }

    formatPrice(price) {
        if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
        if (price >= 1) return price.toFixed(2);
        return price.toFixed(4);
    }

    // ============== UPDATE ==============

    updatePlayer(delta) {
        if (this.isModalOpen) return;

        const isMoving = this.moveDir.x !== 0 || this.moveDir.z !== 0;

        if (isMoving) {
            const moveX = this.moveDir.x * this.playerSpeed * delta;
            const moveZ = this.moveDir.z * this.playerSpeed * delta;

            let newX = this.player.position.x + moveX;
            let newZ = this.player.position.z + moveZ;

            // Collision check - try X and Z separately
            if (!this.checkCollision(newX, this.player.position.z)) {
                this.player.position.x = newX;
            }
            if (!this.checkCollision(this.player.position.x, newZ)) {
                this.player.position.z = newZ;
            }

            // Boundary
            const limit = 120;
            this.player.position.x = Math.max(-limit, Math.min(limit, this.player.position.x));
            this.player.position.z = Math.max(-limit, Math.min(limit, this.player.position.z));

            // Rotation
            this.player.rotation.y = Math.atan2(this.moveDir.x, this.moveDir.z);

            // Walk animation
            const walkSpeed = 12;
            const time = this.clock.getElapsedTime();
            this.playerLeftLeg.rotation.x = Math.sin(time * walkSpeed) * 0.5;
            this.playerRightLeg.rotation.x = -Math.sin(time * walkSpeed) * 0.5;
            this.playerLeftArm.rotation.x = -Math.sin(time * walkSpeed) * 0.3;
            this.playerRightArm.rotation.x = Math.sin(time * walkSpeed) * 0.3;
        } else {
            // Reset pose
            this.playerLeftLeg.rotation.x = 0;
            this.playerRightLeg.rotation.x = 0;
            this.playerLeftArm.rotation.x = 0;
            this.playerRightArm.rotation.x = 0;
        }

        // Check near building
        let near = null;
        this.buildings.forEach(building => {
            const zone = building.userData.interactZone;
            if (this.player.position.x > zone.minX && this.player.position.x < zone.maxX &&
                this.player.position.z > zone.minZ && this.player.position.z < zone.maxZ) {
                near = building;
            }
        });

        this.nearBuilding = near;
        
        const interactBtn = document.getElementById('interact-btn');
        const locationEl = document.getElementById('location');
        
        if (near && near.userData.type !== 'shop') {
            interactBtn.classList.add('visible');
            locationEl.classList.add('visible');
            locationEl.textContent = '📍 ' + near.userData.name;
        } else {
            interactBtn.classList.remove('visible');
            locationEl.classList.remove('visible');
        }

        // Camera follow
        const camOffset = new THREE.Vector3(0, 12, 18);
        const targetPos = this.player.position.clone().add(camOffset);
        this.camera.position.lerp(targetPos, 4 * delta);
        this.camera.lookAt(
            this.player.position.x, 
            this.player.position.y + 1.5, 
            this.player.position.z
        );
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        this.updatePlayer(delta);
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Start
window.addEventListener('load', () => {
    window.game = new TradingGame();
});
