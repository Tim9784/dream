// Life Simulator - Full Featured Game
// Trading, apartment life, NPCs, interactions

class LifeSimulator {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Player
        this.player = null;
        this.playerSpeed = 8;
        this.moveDir = { x: 0, z: 0 };
        this.cameraAngle = 0;
        this.cameraPitch = 0.4;
        this.cameraDistance = 15;
        
        // World state
        this.isInside = false;
        this.currentRoom = null;
        this.buildings = [];
        this.colliders = [];
        this.interactables = [];
        this.npcs = [];
        this.nearObject = null;
        
        // Player stats
        this.stats = {
            energy: 100,
            hunger: 100,
            happiness: 80
        };
        
        // Time
        this.gameTime = 8 * 60; // Minutes from midnight
        this.timeSpeed = 1; // 1 real second = 1 game minute
        
        // Economy
        this.balance = 10000;
        this.portfolio = {};
        this.priceHistory = {};
        this.loadSave();
        
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
                { id: 'corpbond', name: 'Corp Bond', symbol: 'CORP', price: 102.3, color: '#2e86ab', icon: '🏢', volatility: 0.005 }
            ]
        };

        this.currentAssetType = 'crypto';
        this.selectedAsset = null;
        this.isModalOpen = false;
        this.isMenuOpen = false;

        this.init();
    }

    loadSave() {
        try {
            const saved = localStorage.getItem('lifeSim_save');
            if (saved) {
                const data = JSON.parse(saved);
                this.balance = data.balance || 10000;
                this.portfolio = data.portfolio || {};
                this.stats = data.stats || { energy: 100, hunger: 100, happiness: 80 };
            }
        } catch (e) {}
    }

    saveGame() {
        try {
            localStorage.setItem('lifeSim_save', JSON.stringify({
                balance: this.balance,
                portfolio: this.portfolio,
                stats: this.stats
            }));
        } catch (e) {}
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 50, 150);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game').prepend(this.renderer.domElement);

        this.createLights();
        this.createOutdoorWorld();
        this.createApartment();
        this.createPlayer();
        this.createNPCs();
        this.initPrices();
        this.setupEvents();
        this.startSystems();

        // Hide loading when first frame renders
        this.renderer.render(this.scene, this.camera);
        document.getElementById('loading').classList.add('hidden');

        this.animate();
    }

    createLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
        this.sunLight.position.set(50, 80, 30);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 200;
        this.sunLight.shadow.camera.left = -60;
        this.sunLight.shadow.camera.right = 60;
        this.sunLight.shadow.camera.top = 60;
        this.sunLight.shadow.camera.bottom = -60;
        this.scene.add(this.sunLight);

        this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.4));
    }

    // ==================== OUTDOOR WORLD ====================

    createOutdoorWorld() {
        // Ground
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshStandardMaterial({ color: 0x4a7c4e, roughness: 0.9 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Roads
        this.createRoads();

        // Buildings
        this.createBuilding('Жилой дом', 'home', [-30, -25], [18, 20, 18], 0x8b7355);
        this.createBuilding('Магазин', 'shop', [30, -25], [16, 12, 14], 0x22c55e);
        this.createBuilding('Кафе', 'cafe', [30, 25], [14, 10, 12], 0xf59e0b);
        this.createBuilding('Парк', 'park', [-30, 25], [20, 2, 20], 0x16a34a);

        // Decorations
        this.createTrees();
        this.createStreetObjects();
    }

    createRoads() {
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
        
        const roadH = new THREE.Mesh(new THREE.BoxGeometry(200, 0.1, 12), roadMat);
        roadH.position.y = 0.05;
        roadH.receiveShadow = true;
        this.scene.add(roadH);

        const roadV = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 200), roadMat);
        roadV.position.y = 0.05;
        roadV.receiveShadow = true;
        this.scene.add(roadV);

        // Markings
        const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let i = -90; i <= 90; i += 8) {
            if (Math.abs(i) < 8) continue;
            const m1 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.02, 0.3), markMat);
            m1.position.set(i, 0.11, 0);
            this.scene.add(m1);
            const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 4), markMat);
            m2.position.set(0, 0.11, i);
            this.scene.add(m2);
        }
    }

    createBuilding(name, type, pos, size, color) {
        const group = new THREE.Group();
        const [w, h, d] = size;

        // Main structure
        const building = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
        );
        building.position.y = h / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);

        // Roof
        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(w + 1, 1, d + 1),
            new THREE.MeshStandardMaterial({ color: 0x444444 })
        );
        roof.position.y = h + 0.5;
        roof.castShadow = true;
        group.add(roof);

        // Windows
        if (type !== 'park') {
            const winMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, emissive: 0x224466, emissiveIntensity: 0.2 });
            const rows = Math.floor(h / 5);
            const cols = Math.floor(w / 4);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 0.1), winMat);
                    win.position.set(-w/2 + 2 + c * 4, 3 + r * 5, d/2 + 0.05);
                    group.add(win);
                }
            }
        }

        // Entrance
        const entrance = new THREE.Mesh(
            new THREE.BoxGeometry(4, 6, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        entrance.position.set(0, 3, d/2 + 0.25);
        group.add(entrance);

        // Sign
        const sign = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.6, 2, 0.2),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        sign.position.set(0, h - 2, d/2 + 0.2);
        group.add(sign);

        group.position.set(pos[0], 0, pos[1]);
        this.scene.add(group);

        // Collision
        this.colliders.push({
            minX: pos[0] - w/2 - 0.5,
            maxX: pos[0] + w/2 + 0.5,
            minZ: pos[1] - d/2 - 0.5,
            maxZ: pos[1] + d/2 + 0.5,
            isBuilding: true
        });

        // Interactable entrance
        const interactable = {
            name, type,
            position: new THREE.Vector3(pos[0], 0, pos[1] + d/2 + 2),
            radius: 4,
            actions: this.getActionsForType(type)
        };
        this.interactables.push(interactable);
        this.buildings.push({ group, config: { name, type, pos, size } });
    }

    getActionsForType(type) {
        switch(type) {
            case 'home': return [{ name: '🚪 Войти в квартиру', action: 'enterHome' }];
            case 'shop': return [
                { name: '🍎 Купить еду ($20)', action: 'buyFood', cost: 20 },
                { name: '☕ Купить кофе ($5)', action: 'buyCoffee', cost: 5 }
            ];
            case 'cafe': return [
                { name: '🍕 Поесть ($30)', action: 'eatMeal', cost: 30 },
                { name: '🍺 Выпить ($15)', action: 'drink', cost: 15 }
            ];
            case 'park': return [
                { name: '🚶 Прогуляться', action: 'walk' },
                { name: '🧘 Медитация', action: 'meditate' }
            ];
            default: return [];
        }
    }

    createTrees() {
        const positions = [
            [-50, 10], [-50, -10], [50, 10], [50, -10],
            [-60, 40], [60, 40], [-60, -40], [60, -40],
            [-15, 50], [15, 50], [-15, -50], [15, -50]
        ];
        
        positions.forEach(([x, z]) => {
            const tree = new THREE.Group();
            
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.3, 0.5, 4, 8),
                new THREE.MeshStandardMaterial({ color: 0x4a3728 })
            );
            trunk.position.y = 2;
            trunk.castShadow = true;
            tree.add(trunk);

            const foliage = new THREE.Mesh(
                new THREE.SphereGeometry(2.5, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0x228b22 })
            );
            foliage.position.y = 5.5;
            foliage.castShadow = true;
            tree.add(foliage);

            tree.position.set(x, 0, z);
            this.scene.add(tree);

            this.colliders.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 });
        });
    }

    createStreetObjects() {
        // Benches
        [[-12, 15], [12, 15], [-12, -15], [12, -15]].forEach(([x, z]) => {
            const bench = new THREE.Group();
            const seat = new THREE.Mesh(
                new THREE.BoxGeometry(2.5, 0.15, 0.8),
                new THREE.MeshStandardMaterial({ color: 0x8b4513 })
            );
            seat.position.y = 0.6;
            seat.castShadow = true;
            bench.add(seat);

            const back = new THREE.Mesh(
                new THREE.BoxGeometry(2.5, 0.8, 0.1),
                new THREE.MeshStandardMaterial({ color: 0x8b4513 })
            );
            back.position.set(0, 1, -0.35);
            bench.add(back);

            bench.position.set(x, 0, z);
            this.scene.add(bench);

            this.interactables.push({
                name: 'Скамейка',
                type: 'bench',
                position: new THREE.Vector3(x, 0, z),
                radius: 2,
                actions: [{ name: '🪑 Сесть отдохнуть', action: 'sitBench' }]
            });
        });

        // Lamp posts
        [[-8, 25], [8, 25], [-8, -25], [8, -25]].forEach(([x, z]) => {
            const lamp = new THREE.Group();
            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1, 0.15, 6, 8),
                new THREE.MeshStandardMaterial({ color: 0x222222 })
            );
            pole.position.y = 3;
            lamp.add(pole);

            const light = new THREE.Mesh(
                new THREE.SphereGeometry(0.4, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xffffcc })
            );
            light.position.y = 6.2;
            lamp.add(light);

            const pl = new THREE.PointLight(0xffffcc, 0.3, 15);
            pl.position.y = 6;
            lamp.add(pl);

            lamp.position.set(x, 0, z);
            this.scene.add(lamp);
        });

        // Trash cans
        [[15, 8], [-15, 8], [15, -8], [-15, -8]].forEach(([x, z]) => {
            const can = new THREE.Mesh(
                new THREE.CylinderGeometry(0.4, 0.35, 1, 8),
                new THREE.MeshStandardMaterial({ color: 0x2e7d32 })
            );
            can.position.set(x, 0.5, z);
            can.castShadow = true;
            this.scene.add(can);
        });

        // Vending machine
        const vending = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 2.5, 1),
            new THREE.MeshStandardMaterial({ color: 0x1565c0 })
        );
        vending.position.set(20, 1.25, -8);
        vending.castShadow = true;
        this.scene.add(vending);

        this.interactables.push({
            name: 'Автомат',
            type: 'vending',
            position: new THREE.Vector3(20, 0, -8),
            radius: 2,
            actions: [
                { name: '🥤 Купить напиток ($3)', action: 'buyDrink', cost: 3 },
                { name: '🍫 Купить снэк ($2)', action: 'buySnack', cost: 2 }
            ]
        });
    }

    // ==================== APARTMENT ====================

    createApartment() {
        this.apartmentGroup = new THREE.Group();
        this.apartmentGroup.visible = false;

        // Floor
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(15, 12),
            new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.apartmentGroup.add(floor);

        // Walls
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.9 });
        
        // Back wall
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(15, 4, 0.2), wallMat);
        backWall.position.set(0, 2, -6);
        this.apartmentGroup.add(backWall);

        // Side walls
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 12), wallMat);
        leftWall.position.set(-7.5, 2, 0);
        this.apartmentGroup.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 12), wallMat);
        rightWall.position.set(7.5, 2, 0);
        this.apartmentGroup.add(rightWall);

        // Ceiling
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(15, 12),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 4;
        this.apartmentGroup.add(ceiling);

        // Ceiling light
        const ceilingLight = new THREE.PointLight(0xffffee, 0.8, 15);
        ceilingLight.position.set(0, 3.5, 0);
        this.apartmentGroup.add(ceilingLight);

        // Furniture
        this.createFurniture();

        this.scene.add(this.apartmentGroup);

        // Apartment colliders
        this.apartmentColliders = [
            { minX: -7.6, maxX: -7.4, minZ: -6, maxZ: 6 }, // left wall
            { minX: 7.4, maxX: 7.6, minZ: -6, maxZ: 6 },   // right wall
            { minX: -7.5, maxX: 7.5, minZ: -6.1, maxZ: -5.9 }, // back wall
        ];
    }

    createFurniture() {
        // Bed
        const bed = new THREE.Group();
        const mattress = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 0.4, 4),
            new THREE.MeshStandardMaterial({ color: 0x4a90d9 })
        );
        mattress.position.y = 0.5;
        bed.add(mattress);
        
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(2.7, 0.3, 4.2),
            new THREE.MeshStandardMaterial({ color: 0x5d4037 })
        );
        frame.position.y = 0.15;
        bed.add(frame);

        const pillow = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.2, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        pillow.position.set(0, 0.8, -1.5);
        bed.add(pillow);

        const headboard = new THREE.Mesh(
            new THREE.BoxGeometry(2.7, 1.2, 0.15),
            new THREE.MeshStandardMaterial({ color: 0x5d4037 })
        );
        headboard.position.set(0, 1, -2);
        bed.add(headboard);

        bed.position.set(-5, 0, -3);
        this.apartmentGroup.add(bed);
        this.apartmentColliders.push({ minX: -6.5, maxX: -3.5, minZ: -5.5, maxZ: -1 });
        
        this.interactables.push({
            name: 'Кровать', type: 'bed', indoor: true,
            position: new THREE.Vector3(-5, 0, -3), radius: 2,
            actions: [
                { name: '😴 Поспать (8 часов)', action: 'sleep8' },
                { name: '💤 Вздремнуть (2 часа)', action: 'sleep2' }
            ]
        });

        // Desk with computer
        const desk = new THREE.Group();
        const deskTop = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 0.1, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x5d4037 })
        );
        deskTop.position.y = 1;
        desk.add(deskTop);

        const deskLegs = new THREE.Mesh(
            new THREE.BoxGeometry(2.3, 1, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x5d4037 })
        );
        deskLegs.position.set(0, 0.5, -0.5);
        desk.add(deskLegs);

        // Computer monitor
        const monitor = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.8, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        monitor.position.set(0, 1.5, -0.3);
        desk.add(monitor);

        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(1.1, 0.7, 0.02),
            new THREE.MeshBasicMaterial({ color: 0x1a1a2e })
        );
        screen.position.set(0, 1.5, -0.24);
        desk.add(screen);

        const stand = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.4, 0.15),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        stand.position.set(0, 1.2, -0.3);
        desk.add(stand);

        // Keyboard
        const keyboard = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.05, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        keyboard.position.set(0, 1.08, 0.2);
        desk.add(keyboard);

        // Chair
        const chairSeat = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.1, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x1565c0 })
        );
        chairSeat.position.set(0, 0.7, 1);
        desk.add(chairSeat);

        const chairBack = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.8, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x1565c0 })
        );
        chairBack.position.set(0, 1.1, 1.35);
        desk.add(chairBack);

        desk.position.set(5, 0, -4);
        this.apartmentGroup.add(desk);
        this.apartmentColliders.push({ minX: 3.5, maxX: 6.5, minZ: -5.5, maxZ: -3 });

        this.interactables.push({
            name: 'Компьютер', type: 'computer', indoor: true,
            position: new THREE.Vector3(5, 0, -3), radius: 2,
            actions: [
                { name: '💹 Торговля на бирже', action: 'trade' },
                { name: '📊 Посмотреть портфель', action: 'portfolio' },
                { name: '🎮 Поиграть в игры', action: 'playGames' }
            ]
        });

        // TV
        const tv = new THREE.Group();
        const tvScreen = new THREE.Mesh(
            new THREE.BoxGeometry(2, 1.2, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        tvScreen.position.y = 1.5;
        tv.add(tvScreen);

        const tvDisplay = new THREE.Mesh(
            new THREE.BoxGeometry(1.9, 1.1, 0.02),
            new THREE.MeshBasicMaterial({ color: 0x222244 })
        );
        tvDisplay.position.set(0, 1.5, 0.06);
        tv.add(tvDisplay);

        const tvStand = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.8, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x3e2723 })
        );
        tvStand.position.y = 0.4;
        tv.add(tvStand);

        tv.position.set(0, 0, -5.5);
        this.apartmentGroup.add(tv);

        this.interactables.push({
            name: 'Телевизор', type: 'tv', indoor: true,
            position: new THREE.Vector3(0, 0, -4.5), radius: 2,
            actions: [
                { name: '📺 Смотреть новости', action: 'watchNews' },
                { name: '🎬 Смотреть фильм', action: 'watchMovie' }
            ]
        });

        // Couch
        const couch = new THREE.Group();
        const couchSeat = new THREE.Mesh(
            new THREE.BoxGeometry(3, 0.5, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x7b1fa2 })
        );
        couchSeat.position.y = 0.4;
        couch.add(couchSeat);

        const couchBack = new THREE.Mesh(
            new THREE.BoxGeometry(3, 0.8, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x7b1fa2 })
        );
        couchBack.position.set(0, 0.8, -0.45);
        couch.add(couchBack);

        const armL = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.6, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x7b1fa2 })
        );
        armL.position.set(-1.35, 0.5, 0);
        couch.add(armL);

        const armR = armL.clone();
        armR.position.x = 1.35;
        couch.add(armR);

        couch.position.set(0, 0, -2);
        this.apartmentGroup.add(couch);
        this.apartmentColliders.push({ minX: -1.8, maxX: 1.8, minZ: -3, maxZ: -1 });

        this.interactables.push({
            name: 'Диван', type: 'couch', indoor: true,
            position: new THREE.Vector3(0, 0, -1), radius: 2,
            actions: [{ name: '🛋️ Отдохнуть на диване', action: 'restCouch' }]
        });

        // Fridge
        const fridge = new THREE.Mesh(
            new THREE.BoxGeometry(1, 2.2, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee })
        );
        fridge.position.set(-6.5, 1.1, 3);
        this.apartmentGroup.add(fridge);
        this.apartmentColliders.push({ minX: -7.2, maxX: -5.8, minZ: 2.5, maxZ: 3.5 });

        this.interactables.push({
            name: 'Холодильник', type: 'fridge', indoor: true,
            position: new THREE.Vector3(-6.5, 0, 4), radius: 1.5,
            actions: [
                { name: '🍎 Поесть', action: 'eatFromFridge' },
                { name: '🥤 Выпить воды', action: 'drinkWater' }
            ]
        });

        // Kitchen counter
        const counter = new THREE.Mesh(
            new THREE.BoxGeometry(3, 1, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x5d4037 })
        );
        counter.position.set(-5, 0.5, 5);
        this.apartmentGroup.add(counter);

        // Exit door
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 2.5, 0.15),
            new THREE.MeshStandardMaterial({ color: 0x5d4037 })
        );
        door.position.set(0, 1.25, 5.9);
        this.apartmentGroup.add(door);

        this.interactables.push({
            name: 'Дверь', type: 'door', indoor: true,
            position: new THREE.Vector3(0, 0, 5), radius: 2,
            actions: [{ name: '🚪 Выйти на улицу', action: 'exitHome' }]
        });
    }

    // ==================== NPCs ====================

    createNPCs() {
        const npcData = [
            { color: 0xff6b6b, path: [[20, 20], [20, -20], [-20, -20], [-20, 20]] },
            { color: 0x4ecdc4, path: [[-25, 0], [25, 0]] },
            { color: 0xffe66d, path: [[0, 30], [0, -30]] },
            { color: 0x95e1d3, path: [[40, 40], [-40, 40], [-40, -40], [40, -40]] },
        ];

        npcData.forEach((data, i) => {
            const npc = this.createNPCModel(data.color);
            npc.position.set(data.path[0][0], 0, data.path[0][1]);
            this.scene.add(npc);

            this.npcs.push({
                mesh: npc,
                path: data.path,
                pathIndex: 0,
                speed: 2 + Math.random() * 2,
                waiting: 0
            });
        });
    }

    createNPCModel(color) {
        const npc = new THREE.Group();

        // Body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.35, 1, 8),
            new THREE.MeshStandardMaterial({ color })
        );
        body.position.y = 1;
        body.castShadow = true;
        npc.add(body);

        // Head
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0xffdbac })
        );
        head.position.y = 1.75;
        head.castShadow = true;
        npc.add(head);

        // Legs
        const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), legMat);
        leftLeg.position.set(-0.15, 0.3, 0);
        npc.add(leftLeg);
        npc.userData.leftLeg = leftLeg;

        const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), legMat);
        rightLeg.position.set(0.15, 0.3, 0);
        npc.add(rightLeg);
        npc.userData.rightLeg = rightLeg;

        return npc;
    }

    updateNPCs(delta) {
        this.npcs.forEach(npc => {
            if (npc.waiting > 0) {
                npc.waiting -= delta;
                return;
            }

            const target = npc.path[npc.pathIndex];
            const dx = target[0] - npc.mesh.position.x;
            const dz = target[1] - npc.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 0.5) {
                npc.pathIndex = (npc.pathIndex + 1) % npc.path.length;
                npc.waiting = 1 + Math.random() * 2;
            } else {
                const moveX = (dx / dist) * npc.speed * delta;
                const moveZ = (dz / dist) * npc.speed * delta;
                npc.mesh.position.x += moveX;
                npc.mesh.position.z += moveZ;
                npc.mesh.rotation.y = Math.atan2(dx, dz);

                // Walk animation
                const time = this.clock.getElapsedTime();
                npc.mesh.userData.leftLeg.rotation.x = Math.sin(time * 8) * 0.4;
                npc.mesh.userData.rightLeg.rotation.x = -Math.sin(time * 8) * 0.4;
            }
        });
    }

    // ==================== PLAYER ====================

    createPlayer() {
        this.player = new THREE.Group();

        // Body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.35, 1, 8),
            new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
        );
        body.position.y = 1;
        body.castShadow = true;
        this.player.add(body);

        // Head
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0xffdbac })
        );
        head.position.y = 1.8;
        head.castShadow = true;
        this.player.add(head);

        // Hair
        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x4a3728 })
        );
        hair.position.y = 1.9;
        this.player.add(hair);

        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        [-0.08, 0.08].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMat);
            eye.position.set(x, 1.85, 0.22);
            this.player.add(eye);
        });

        // Legs
        const legMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5a });
        this.playerLeftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), legMat);
        this.playerLeftLeg.position.set(-0.15, 0.3, 0);
        this.player.add(this.playerLeftLeg);

        this.playerRightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), legMat);
        this.playerRightLeg.position.set(0.15, 0.3, 0);
        this.player.add(this.playerRightLeg);

        // Arms
        const armMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
        this.playerLeftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), armMat);
        this.playerLeftArm.position.set(-0.4, 1, 0);
        this.player.add(this.playerLeftArm);

        this.playerRightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), armMat);
        this.playerRightArm.position.set(0.4, 1, 0);
        this.player.add(this.playerRightArm);

        this.player.position.set(0, 0, 15);
        this.scene.add(this.player);
    }

    // ==================== SYSTEMS ====================

    initPrices() {
        Object.values(this.assets).flat().forEach(asset => {
            this.priceHistory[asset.id] = [];
            let price = asset.price;
            for (let i = 0; i < 50; i++) {
                price *= (1 + (Math.random() - 0.5) * asset.volatility);
                this.priceHistory[asset.id].push(price);
            }
            this.priceHistory[asset.id].push(asset.price);
        });
    }

    startSystems() {
        // Price updates
        setInterval(() => {
            Object.values(this.assets).flat().forEach(asset => {
                asset.price *= (1 + (Math.random() - 0.48) * asset.volatility);
                this.priceHistory[asset.id].push(asset.price);
                if (this.priceHistory[asset.id].length > 51) this.priceHistory[asset.id].shift();
            });
            if (this.isModalOpen) this.updateTradeUI();
            this.saveGame();
        }, 3000);

        // Stats decay
        setInterval(() => {
            this.stats.energy = Math.max(0, this.stats.energy - 0.5);
            this.stats.hunger = Math.max(0, this.stats.hunger - 0.3);
            this.stats.happiness = Math.max(0, this.stats.happiness - 0.1);
            this.updateStatsUI();
            this.saveGame();
        }, 5000);

        // Time
        setInterval(() => {
            this.gameTime = (this.gameTime + 1) % (24 * 60);
            this.updateTimeUI();
        }, 1000);

        this.updateStatsUI();
        this.updateBalanceUI();
        this.updateTimeUI();
    }

    updateStatsUI() {
        document.getElementById('energy-bar').style.width = this.stats.energy + '%';
        document.getElementById('hunger-bar').style.width = this.stats.hunger + '%';
        document.getElementById('happiness-bar').style.width = this.stats.happiness + '%';
    }

    updateBalanceUI() {
        document.getElementById('balance-display').textContent = '$' + this.balance.toLocaleString();
    }

    updateTimeUI() {
        const hours = Math.floor(this.gameTime / 60);
        const mins = this.gameTime % 60;
        const emoji = hours >= 6 && hours < 20 ? '🌅' : '🌙';
        document.getElementById('time-display').textContent = `${emoji} ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    showMessage(text) {
        const msg = document.getElementById('message');
        msg.textContent = text;
        msg.classList.remove('visible');
        void msg.offsetWidth;
        msg.classList.add('visible');
        setTimeout(() => msg.classList.remove('visible'), 2000);
    }

    // ==================== EVENTS ====================

    setupEvents() {
        // Joystick
        const joystickZone = document.getElementById('joystick-zone');
        const joystickStick = document.getElementById('joystick-stick');
        let joystickActive = false;
        let joystickCenter = { x: 0, y: 0 };

        const startJoystick = (e) => {
            e.preventDefault();
            joystickActive = true;
            const rect = joystickZone.getBoundingClientRect();
            joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        };

        const moveJoystick = (e) => {
            if (!joystickActive) return;
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            let dx = touch.clientX - joystickCenter.x;
            let dy = touch.clientY - joystickCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 45;
            if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
            joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            this.moveDir.x = dx / maxDist;
            this.moveDir.z = dy / maxDist;
        };

        const endJoystick = () => {
            joystickActive = false;
            joystickStick.style.transform = 'translate(-50%, -50%)';
            this.moveDir.x = 0;
            this.moveDir.z = 0;
        };

        joystickZone.addEventListener('touchstart', startJoystick, { passive: false });
        joystickZone.addEventListener('touchmove', moveJoystick, { passive: false });
        joystickZone.addEventListener('touchend', endJoystick);
        joystickZone.addEventListener('mousedown', startJoystick);
        window.addEventListener('mousemove', (e) => { if (joystickActive) moveJoystick(e); });
        window.addEventListener('mouseup', endJoystick);

        // Camera rotation
        const cameraZone = document.getElementById('camera-zone');
        let cameraActive = false;
        let cameraStart = { x: 0, y: 0 };

        cameraZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            cameraActive = true;
            cameraStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: false });

        cameraZone.addEventListener('touchmove', (e) => {
            if (!cameraActive) return;
            e.preventDefault();
            const dx = e.touches[0].clientX - cameraStart.x;
            this.cameraAngle -= dx * 0.01;
            cameraStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: false });

        cameraZone.addEventListener('touchend', () => { cameraActive = false; });

        // Keyboard
        const keys = {};
        window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key === 'e') this.interact(); });
        window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

        setInterval(() => {
            if (this.isModalOpen || this.isMenuOpen) return;
            this.moveDir.x = 0; this.moveDir.z = 0;
            if (keys['w'] || keys['arrowup']) this.moveDir.z = -1;
            if (keys['s'] || keys['arrowdown']) this.moveDir.z = 1;
            if (keys['a'] || keys['arrowleft']) this.moveDir.x = -1;
            if (keys['d'] || keys['arrowright']) this.moveDir.x = 1;
            if (keys['q']) this.cameraAngle += 0.03;
            if (keys['e']) this.cameraAngle -= 0.03;
        }, 16);

        // Interact button
        document.getElementById('interact-btn').addEventListener('click', () => this.interact());

        // Close menus
        document.getElementById('close-interact-menu').addEventListener('click', () => this.closeInteractMenu());
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());

        // Trade UI
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

    interact() {
        if (!this.nearObject) return;
        this.showInteractMenu(this.nearObject);
    }

    showInteractMenu(obj) {
        this.isMenuOpen = true;
        document.getElementById('interact-menu-title').textContent = obj.name;
        
        const optionsDiv = document.getElementById('interact-menu-options');
        optionsDiv.innerHTML = '';
        
        obj.actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'menu-option';
            btn.textContent = action.name;
            if (action.cost && action.cost > this.balance) btn.disabled = true;
            btn.addEventListener('click', () => this.executeAction(action));
            optionsDiv.appendChild(btn);
        });

        document.getElementById('interact-menu').classList.add('visible');
    }

    closeInteractMenu() {
        this.isMenuOpen = false;
        document.getElementById('interact-menu').classList.remove('visible');
    }

    executeAction(action) {
        this.closeInteractMenu();

        if (action.cost && action.cost > this.balance) {
            this.showMessage('❌ Недостаточно денег!');
            return;
        }
        if (action.cost) this.balance -= action.cost;

        switch(action.action) {
            case 'enterHome':
                this.enterApartment();
                break;
            case 'exitHome':
                this.exitApartment();
                break;
            case 'sleep8':
                this.stats.energy = 100;
                this.gameTime = (this.gameTime + 480) % (24 * 60);
                this.showMessage('😴 Вы выспались!');
                break;
            case 'sleep2':
                this.stats.energy = Math.min(100, this.stats.energy + 40);
                this.gameTime = (this.gameTime + 120) % (24 * 60);
                this.showMessage('💤 Вы вздремнули');
                break;
            case 'trade':
                this.openTrading();
                break;
            case 'portfolio':
                this.openPortfolio();
                break;
            case 'playGames':
                this.stats.happiness = Math.min(100, this.stats.happiness + 15);
                this.stats.energy = Math.max(0, this.stats.energy - 10);
                this.gameTime = (this.gameTime + 60) % (24 * 60);
                this.showMessage('🎮 Вы поиграли в игры!');
                break;
            case 'watchNews':
            case 'watchMovie':
                this.stats.happiness = Math.min(100, this.stats.happiness + 10);
                this.stats.energy = Math.max(0, this.stats.energy - 5);
                this.gameTime = (this.gameTime + 30) % (24 * 60);
                this.showMessage('📺 Вы посмотрели ТВ');
                break;
            case 'restCouch':
                this.stats.energy = Math.min(100, this.stats.energy + 15);
                this.stats.happiness = Math.min(100, this.stats.happiness + 5);
                this.showMessage('🛋️ Вы отдохнули');
                break;
            case 'eatFromFridge':
                this.stats.hunger = Math.min(100, this.stats.hunger + 30);
                this.showMessage('🍎 Вы поели');
                break;
            case 'drinkWater':
                this.stats.hunger = Math.min(100, this.stats.hunger + 10);
                this.showMessage('💧 Освежились!');
                break;
            case 'buyFood':
                this.stats.hunger = Math.min(100, this.stats.hunger + 40);
                this.showMessage('🍎 Купили еду!');
                break;
            case 'buyCoffee':
                this.stats.energy = Math.min(100, this.stats.energy + 20);
                this.showMessage('☕ Выпили кофе!');
                break;
            case 'eatMeal':
                this.stats.hunger = 100;
                this.stats.happiness = Math.min(100, this.stats.happiness + 10);
                this.showMessage('🍕 Вкусно поели!');
                break;
            case 'drink':
                this.stats.happiness = Math.min(100, this.stats.happiness + 15);
                this.showMessage('🍺 Расслабились!');
                break;
            case 'walk':
                this.stats.happiness = Math.min(100, this.stats.happiness + 10);
                this.stats.energy = Math.max(0, this.stats.energy - 5);
                this.showMessage('🚶 Приятная прогулка!');
                break;
            case 'meditate':
                this.stats.happiness = Math.min(100, this.stats.happiness + 20);
                this.stats.energy = Math.min(100, this.stats.energy + 10);
                this.showMessage('🧘 Медитация помогла!');
                break;
            case 'sitBench':
                this.stats.energy = Math.min(100, this.stats.energy + 10);
                this.showMessage('🪑 Посидели, отдохнули');
                break;
            case 'buyDrink':
                this.stats.hunger = Math.min(100, this.stats.hunger + 15);
                this.showMessage('🥤 Купили напиток');
                break;
            case 'buySnack':
                this.stats.hunger = Math.min(100, this.stats.hunger + 10);
                this.showMessage('🍫 Купили снэк');
                break;
        }

        this.updateStatsUI();
        this.updateBalanceUI();
        this.updateTimeUI();
        this.saveGame();
    }

    enterApartment() {
        this.isInside = true;
        this.apartmentGroup.visible = true;
        this.player.position.set(0, 0, 3);
        
        // Hide outdoor
        this.buildings.forEach(b => b.group.visible = false);
        this.npcs.forEach(n => n.mesh.visible = false);
        
        this.showMessage('🏠 Вы дома');
    }

    exitApartment() {
        this.isInside = false;
        this.apartmentGroup.visible = false;
        this.player.position.set(-30, 0, -5);
        
        // Show outdoor
        this.buildings.forEach(b => b.group.visible = true);
        this.npcs.forEach(n => n.mesh.visible = true);
        
        this.showMessage('🚪 Вышли на улицу');
    }

    // ==================== TRADING ====================

    openTrading() {
        this.isModalOpen = true;
        document.getElementById('modal').classList.add('visible');
        document.getElementById('modal-title').textContent = '💹 Биржа';
        document.getElementById('asset-selection').style.display = 'block';
        document.getElementById('trade-panel').classList.remove('visible');
        document.getElementById('portfolio-panel').classList.remove('visible');
        this.renderAssetList();
    }

    openPortfolio() {
        this.isModalOpen = true;
        document.getElementById('modal').classList.add('visible');
        document.getElementById('modal-title').textContent = '📊 Портфель';
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
            const prev = history[history.length - 2] || asset.price;
            const change = ((asset.price - prev) / prev) * 100;
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
                        <div class="asset-change ${change >= 0 ? 'up' : 'down'}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</div>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.asset-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedAsset = assets.find(a => a.id === item.dataset.id);
                this.showTradePanel();
            });
        });
    }

    showTradePanel() {
        document.getElementById('asset-selection').style.display = 'none';
        document.getElementById('trade-panel').classList.add('visible');
        document.getElementById('trade-amount').value = '1';
        this.updateTradeUI();
    }

    updateTradeUI() {
        if (!this.selectedAsset) return;
        document.getElementById('trade-asset-name').textContent = this.selectedAsset.name;
        document.getElementById('trade-asset-price').textContent = '$' + this.formatPrice(this.selectedAsset.price);
        this.updateTradeTotal();
        this.drawChart();
        this.updateHoldingInfo();
    }

    updateTradeTotal() {
        if (!this.selectedAsset) return;
        const amount = parseFloat(document.getElementById('trade-amount').value) || 0;
        document.getElementById('trade-total').textContent = `Итого: $${this.formatPrice(amount * this.selectedAsset.price)}`;
    }

    updateHoldingInfo() {
        const h = this.portfolio[this.selectedAsset.id];
        const el = document.getElementById('holding-info');
        if (h && h.amount > 0) {
            const val = h.amount * this.selectedAsset.price;
            const profit = val - h.cost;
            el.innerHTML = `<strong>У вас:</strong> ${h.amount.toFixed(4)} ${this.selectedAsset.symbol}<br>
                Стоимость: $${this.formatPrice(val)}<br>
                <span style="color:${profit >= 0 ? '#4ade80' : '#f87171'}">
                    ${profit >= 0 ? '+' : ''}$${this.formatPrice(profit)}
                </span>`;
        } else {
            el.textContent = 'У вас нет этого актива';
        }
    }

    drawChart() {
        const canvas = document.getElementById('price-chart');
        const ctx = canvas.getContext('2d');
        const history = this.priceHistory[this.selectedAsset.id];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const min = Math.min(...history) * 0.99;
        const max = Math.max(...history) * 1.01;
        const range = max - min || 1;
        const isUp = history[history.length - 1] >= history[0];
        
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, isUp ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)');
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        history.forEach((p, i) => {
            ctx.lineTo((i / (history.length - 1)) * canvas.width, canvas.height - ((p - min) / range) * (canvas.height - 10) - 5);
        });
        ctx.lineTo(canvas.width, canvas.height);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.strokeStyle = isUp ? '#4ade80' : '#f87171';
        ctx.lineWidth = 2;
        ctx.beginPath();
        history.forEach((p, i) => {
            const x = (i / (history.length - 1)) * canvas.width;
            const y = canvas.height - ((p - min) / range) * (canvas.height - 10) - 5;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    executeTrade(type) {
        const amount = parseFloat(document.getElementById('trade-amount').value);
        if (!amount || amount <= 0) return;
        const total = amount * this.selectedAsset.price;

        if (type === 'buy') {
            if (total > this.balance) { alert('Недостаточно средств!'); return; }
            this.balance -= total;
            if (!this.portfolio[this.selectedAsset.id]) {
                this.portfolio[this.selectedAsset.id] = { amount: 0, cost: 0, symbol: this.selectedAsset.symbol, name: this.selectedAsset.name };
            }
            this.portfolio[this.selectedAsset.id].amount += amount;
            this.portfolio[this.selectedAsset.id].cost += total;
            this.showMessage('✅ Куплено!');
        } else {
            const h = this.portfolio[this.selectedAsset.id];
            if (!h || h.amount < amount) { alert('Недостаточно активов!'); return; }
            const costPer = h.cost / h.amount;
            h.amount -= amount;
            h.cost -= costPer * amount;
            this.balance += total;
            if (h.amount <= 0.0001) delete this.portfolio[this.selectedAsset.id];
            this.showMessage('✅ Продано!');
        }

        this.updateBalanceUI();
        this.updateHoldingInfo();
        this.saveGame();
    }

    renderPortfolio() {
        let total = this.balance;
        let html = `<div class="holding-item" style="background:rgba(59,130,246,0.2)">
            <div class="holding-header"><span class="holding-name">💵 Наличные</span><span class="holding-value">$${this.formatPrice(this.balance)}</span></div>
        </div>`;

        Object.entries(this.portfolio).forEach(([id, h]) => {
            const asset = Object.values(this.assets).flat().find(a => a.id === id);
            if (!asset) return;
            const val = h.amount * asset.price;
            const profit = val - h.cost;
            total += val;
            html += `<div class="holding-item">
                <div class="holding-header"><span class="holding-name">${h.name}</span><span class="holding-value">$${this.formatPrice(val)}</span></div>
                <div class="holding-details"><span>${h.amount.toFixed(4)} ${h.symbol}</span><span style="color:${profit >= 0 ? '#4ade80' : '#f87171'}">${profit >= 0 ? '+' : ''}${((profit / h.cost) * 100).toFixed(2)}%</span></div>
            </div>`;
        });

        document.getElementById('portfolio-value').textContent = '$' + this.formatPrice(total);
        document.getElementById('holdings-list').innerHTML = html;
    }

    formatPrice(p) {
        if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
        if (p >= 1) return p.toFixed(2);
        return p.toFixed(4);
    }

    // ==================== UPDATE ====================

    checkCollision(newX, newZ) {
        const r = 0.5;
        const colliders = this.isInside ? this.apartmentColliders : this.colliders;
        for (const c of colliders) {
            if (newX + r > c.minX && newX - r < c.maxX && newZ + r > c.minZ && newZ - r < c.maxZ) return true;
        }
        return false;
    }

    updatePlayer(delta) {
        if (this.isModalOpen || this.isMenuOpen) return;

        const isMoving = this.moveDir.x !== 0 || this.moveDir.z !== 0;

        if (isMoving) {
            // Rotate movement by camera angle
            const cos = Math.cos(this.cameraAngle);
            const sin = Math.sin(this.cameraAngle);
            const rotX = this.moveDir.x * cos - this.moveDir.z * sin;
            const rotZ = this.moveDir.x * sin + this.moveDir.z * cos;

            const moveX = rotX * this.playerSpeed * delta;
            const moveZ = rotZ * this.playerSpeed * delta;

            if (!this.checkCollision(this.player.position.x + moveX, this.player.position.z)) {
                this.player.position.x += moveX;
            }
            if (!this.checkCollision(this.player.position.x, this.player.position.z + moveZ)) {
                this.player.position.z += moveZ;
            }

            // Boundaries
            if (this.isInside) {
                this.player.position.x = Math.max(-7, Math.min(7, this.player.position.x));
                this.player.position.z = Math.max(-5.5, Math.min(5.5, this.player.position.z));
            } else {
                this.player.position.x = Math.max(-90, Math.min(90, this.player.position.x));
                this.player.position.z = Math.max(-90, Math.min(90, this.player.position.z));
            }

            this.player.rotation.y = Math.atan2(rotX, rotZ);

            // Walk animation
            const t = this.clock.getElapsedTime();
            this.playerLeftLeg.rotation.x = Math.sin(t * 10) * 0.5;
            this.playerRightLeg.rotation.x = -Math.sin(t * 10) * 0.5;
            this.playerLeftArm.rotation.x = -Math.sin(t * 10) * 0.3;
            this.playerRightArm.rotation.x = Math.sin(t * 10) * 0.3;
        } else {
            this.playerLeftLeg.rotation.x = 0;
            this.playerRightLeg.rotation.x = 0;
            this.playerLeftArm.rotation.x = 0;
            this.playerRightArm.rotation.x = 0;
        }

        // Find nearby interactable
        const relevantObjects = this.interactables.filter(i => this.isInside ? i.indoor : !i.indoor);
        let nearest = null;
        let nearestDist = Infinity;

        relevantObjects.forEach(obj => {
            const dist = this.player.position.distanceTo(obj.position);
            if (dist < obj.radius && dist < nearestDist) {
                nearest = obj;
                nearestDist = dist;
            }
        });

        this.nearObject = nearest;
        const btn = document.getElementById('interact-btn');
        const loc = document.getElementById('location-display');
        
        if (nearest) {
            btn.classList.add('visible');
            btn.textContent = nearest.name;
            loc.classList.add('visible');
            loc.textContent = '📍 ' + nearest.name;
        } else {
            btn.classList.remove('visible');
            loc.classList.remove('visible');
        }

        // Camera
        const camX = this.player.position.x + Math.sin(this.cameraAngle) * this.cameraDistance;
        const camZ = this.player.position.z + Math.cos(this.cameraAngle) * this.cameraDistance;
        const camY = this.player.position.y + this.cameraDistance * this.cameraPitch;
        
        this.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 5 * delta);
        this.camera.lookAt(this.player.position.x, this.player.position.y + 1.5, this.player.position.z);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        this.updatePlayer(delta);
        if (!this.isInside) this.updateNPCs(delta);

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('load', () => { window.game = new LifeSimulator(); });
