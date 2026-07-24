// Trading City - 3D Investment Game

class TradingGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Player
        this.player = null;
        this.playerSpeed = 8;
        this.moveDir = { x: 0, z: 0 };
        
        // Buildings
        this.buildings = [];
        this.nearBuilding = null;
        
        // Economy
        this.balance = 10000;
        this.portfolio = {};
        this.priceHistory = {};
        
        // Assets
        this.assets = {
            crypto: [
                { id: 'btc', name: 'Bitcoin', symbol: 'BTC', price: 45000, color: '#f7931a', icon: '₿' },
                { id: 'eth', name: 'Ethereum', symbol: 'ETH', price: 3200, color: '#627eea', icon: 'Ξ' },
                { id: 'sol', name: 'Solana', symbol: 'SOL', price: 120, color: '#00ffa3', icon: '◎' },
                { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', price: 0.12, color: '#c3a634', icon: 'Ð' }
            ],
            stocks: [
                { id: 'aapl', name: 'Apple', symbol: 'AAPL', price: 175, color: '#555555', icon: '' },
                { id: 'googl', name: 'Google', symbol: 'GOOGL', price: 140, color: '#4285f4', icon: 'G' },
                { id: 'tsla', name: 'Tesla', symbol: 'TSLA', price: 250, color: '#cc0000', icon: 'T' },
                { id: 'amzn', name: 'Amazon', symbol: 'AMZN', price: 180, color: '#ff9900', icon: 'A' }
            ],
            bonds: [
                { id: 'usbond', name: 'US Treasury', symbol: 'T-BOND', price: 98.5, color: '#1a5276', icon: '🇺🇸' },
                { id: 'corpbond', name: 'Corp Bond AAA', symbol: 'CORP-A', price: 102.3, color: '#2e86ab', icon: '🏢' },
                { id: 'munibond', name: 'Municipal', symbol: 'MUNI', price: 100.8, color: '#a23b72', icon: '🏛️' }
            ]
        };

        // Current view
        this.currentAssetType = 'crypto';
        this.selectedAsset = null;
        this.isModalOpen = false;
        this.showingPortfolio = false;

        // News
        this.newsItems = [
            "📰 Bitcoin достиг нового максимума! Инвесторы в восторге.",
            "📉 Акции Tesla падают на фоне отчётности.",
            "🚀 Ethereum обновляется — газ подешевел!",
            "💼 Apple представила новый продукт.",
            "🏦 ФРС оставила ставку без изменений.",
            "📊 Рынок облигаций стабилен.",
            "🐕 Dogecoin взлетел после твита Илона Маска!",
            "🌍 Глобальные рынки открылись ростом."
        ];

        this.init();
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
        this.createWorld();
        this.createPlayer();
        this.initPriceHistory();
        this.setupEvents();
        this.startPriceUpdates();
        this.startNews();

        // Hide loading
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 500);

        this.animate();
    }

    createLights() {
        // Ambient
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

        // Sun
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 300;
        sun.shadow.camera.left = -100;
        sun.shadow.camera.right = 100;
        sun.shadow.camera.top = 100;
        sun.shadow.camera.bottom = -100;
        this.scene.add(sun);

        // Hemisphere
        this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.4));
    }

    createWorld() {
        // Ground
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d5c3d, roughness: 0.9 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Roads
        this.createRoads();

        // Buildings
        this.createBuildings();

        // Decorations
        this.createDecorations();
    }

    createRoads() {
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
        
        // Main roads
        const roadH = new THREE.Mesh(new THREE.PlaneGeometry(200, 12), roadMat);
        roadH.rotation.x = -Math.PI / 2;
        roadH.position.y = 0.01;
        this.scene.add(roadH);

        const roadV = new THREE.Mesh(new THREE.PlaneGeometry(12, 200), roadMat);
        roadV.rotation.x = -Math.PI / 2;
        roadV.position.y = 0.01;
        this.scene.add(roadV);

        // Road markings
        const markingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let i = -90; i <= 90; i += 10) {
            const marking = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), markingMat);
            marking.rotation.x = -Math.PI / 2;
            marking.position.set(i, 0.02, 0);
            this.scene.add(marking);

            const marking2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), markingMat);
            marking2.rotation.x = -Math.PI / 2;
            marking2.position.set(0, 0.02, i);
            this.scene.add(marking2);
        }
    }

    createBuildings() {
        const buildingConfigs = [
            { name: 'Криптобиржа', type: 'crypto', pos: [-30, 25], size: [20, 25, 20], color: 0xf7931a, icon: '🪙' },
            { name: 'Фондовая биржа', type: 'stocks', pos: [30, 25], size: [25, 35, 20], color: 0x2563eb, icon: '📈' },
            { name: 'Банк', type: 'bonds', pos: [-30, -30], size: [22, 20, 18], color: 0x1a5276, icon: '🏦' },
            { name: 'Торговый центр', type: 'shop', pos: [30, -30], size: [30, 15, 25], color: 0xec4899, icon: '🛒' }
        ];

        buildingConfigs.forEach(config => {
            const building = this.createBuilding(config);
            this.buildings.push(building);
        });
    }

    createBuilding(config) {
        const group = new THREE.Group();
        const [w, h, d] = config.size;

        // Main building
        const buildingGeo = new THREE.BoxGeometry(w, h, d);
        const buildingMat = new THREE.MeshStandardMaterial({ 
            color: config.color,
            roughness: 0.7,
            metalness: 0.1
        });
        const building = new THREE.Mesh(buildingGeo, buildingMat);
        building.position.y = h / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);

        // Windows
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xaaddff });
        const windowRows = Math.floor(h / 5);
        const windowCols = Math.floor(w / 4);
        
        for (let row = 0; row < windowRows; row++) {
            for (let col = 0; col < windowCols; col++) {
                const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), windowMat);
                win.position.set(
                    -w/2 + 2 + col * 4,
                    3 + row * 5,
                    d/2 + 0.01
                );
                group.add(win);

                const win2 = win.clone();
                win2.position.z = -d/2 - 0.01;
                win2.rotation.y = Math.PI;
                group.add(win2);
            }
        }

        // Entrance
        const entranceMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const entrance = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 1), entranceMat);
        entrance.position.set(0, 4, d/2 + 0.5);
        group.add(entrance);

        // Sign
        const signGeo = new THREE.BoxGeometry(w * 0.8, 3, 0.5);
        const signMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, h - 1, d/2 + 0.5);
        group.add(sign);

        // Roof details
        const roofGeo = new THREE.BoxGeometry(w - 2, 2, d - 2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = h + 1;
        roof.castShadow = true;
        group.add(roof);

        group.position.set(config.pos[0], 0, config.pos[1]);
        group.userData = { 
            name: config.name, 
            type: config.type,
            icon: config.icon,
            bounds: { 
                minX: config.pos[0] - w/2 - 3, 
                maxX: config.pos[0] + w/2 + 3,
                minZ: config.pos[1] - d/2 - 3, 
                maxZ: config.pos[1] + d/2 + 3
            }
        };

        this.scene.add(group);
        return group;
    }

    createDecorations() {
        // Trees
        const treePositions = [
            [-60, 10], [-60, -10], [60, 10], [60, -10],
            [-10, 60], [10, 60], [-10, -60], [10, -60],
            [-50, 50], [50, 50], [-50, -50], [50, -50]
        ];

        treePositions.forEach(pos => {
            this.createTree(pos[0], pos[1]);
        });

        // Benches
        const benchPositions = [
            [-15, 8], [15, 8], [-15, -8], [15, -8]
        ];

        benchPositions.forEach(pos => {
            this.createBench(pos[0], pos[1]);
        });

        // Lamp posts
        const lampPositions = [
            [-8, 20], [8, 20], [-8, -20], [8, -20],
            [20, 8], [20, -8], [-20, 8], [-20, -8]
        ];

        lampPositions.forEach(pos => {
            this.createLamp(pos[0], pos[1]);
        });
    }

    createTree(x, z) {
        const tree = new THREE.Group();

        // Trunk
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.7, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0x4a3728 })
        );
        trunk.position.y = 2;
        trunk.castShadow = true;
        tree.add(trunk);

        // Foliage
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
        const foliage1 = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), foliageMat);
        foliage1.position.y = 6;
        foliage1.castShadow = true;
        tree.add(foliage1);

        const foliage2 = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 8), foliageMat);
        foliage2.position.set(1, 7.5, 0.5);
        foliage2.castShadow = true;
        tree.add(foliage2);

        tree.position.set(x, 0, z);
        this.scene.add(tree);
    }

    createBench(x, z) {
        const bench = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });

        // Seat
        const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1), woodMat);
        seat.position.y = 0.8;
        bench.add(seat);

        // Back
        const back = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.15), woodMat);
        back.position.set(0, 1.4, -0.4);
        back.rotation.x = 0.1;
        bench.add(back);

        // Legs
        [[-1.2, 0.4, 0], [1.2, 0.4, 0]].forEach(pos => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 0.8), metalMat);
            leg.position.set(...pos);
            bench.add(leg);
        });

        bench.position.set(x, 0, z);
        bench.castShadow = true;
        this.scene.add(bench);
    }

    createLamp(x, z) {
        const lamp = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });

        // Pole
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 8), metalMat);
        pole.position.y = 3;
        lamp.add(pole);

        // Light fixture
        const fixture = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), 
            new THREE.MeshBasicMaterial({ color: 0xffffcc }));
        fixture.position.y = 6.3;
        lamp.add(fixture);

        // Point light
        const light = new THREE.PointLight(0xffffcc, 0.5, 15);
        light.position.y = 6.3;
        lamp.add(light);

        lamp.position.set(x, 0, z);
        this.scene.add(lamp);
    }

    createPlayer() {
        const player = new THREE.Group();

        // Body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.5, 1.5, 8),
            new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
        );
        body.position.y = 1.25;
        body.castShadow = true;
        player.add(body);

        // Head
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0xffdbac })
        );
        head.position.y = 2.2;
        head.castShadow = true;
        player.add(head);

        // Hair
        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.38, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x4a3728 })
        );
        hair.position.y = 2.35;
        player.add(hair);

        this.player = player;
        this.player.position.set(0, 0, 0);
        this.scene.add(this.player);
    }

    initPriceHistory() {
        Object.values(this.assets).flat().forEach(asset => {
            this.priceHistory[asset.id] = [];
            let price = asset.price;
            for (let i = 0; i < 50; i++) {
                price = price * (1 + (Math.random() - 0.5) * 0.02);
                this.priceHistory[asset.id].push(price);
            }
            this.priceHistory[asset.id].push(asset.price);
        });
    }

    startPriceUpdates() {
        setInterval(() => {
            Object.values(this.assets).flat().forEach(asset => {
                // Random price change
                const volatility = asset.symbol.includes('BTC') || asset.symbol.includes('DOGE') ? 0.03 : 0.01;
                const change = (Math.random() - 0.48) * volatility;
                asset.price = Math.max(0.01, asset.price * (1 + change));
                
                // Update history
                this.priceHistory[asset.id].push(asset.price);
                if (this.priceHistory[asset.id].length > 51) {
                    this.priceHistory[asset.id].shift();
                }
            });

            // Update UI if modal is open
            if (this.isModalOpen && !this.showingPortfolio) {
                if (this.selectedAsset) {
                    this.updateTradePanel();
                } else {
                    this.renderAssetList();
                }
            }

            this.updateBalance();
        }, 2000);
    }

    startNews() {
        let newsIndex = 0;
        const updateNews = () => {
            document.getElementById('news-text').textContent = this.newsItems[newsIndex];
            newsIndex = (newsIndex + 1) % this.newsItems.length;
        };
        updateNews();
        setInterval(updateNews, 8000);
    }

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
            const maxDist = 40;
            
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
        window.addEventListener('mousemove', handleJoystickMove);
        window.addEventListener('mouseup', handleJoystickEnd);

        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (this.isModalOpen) return;
            if (e.key === 'w' || e.key === 'ArrowUp') this.moveDir.z = -1;
            if (e.key === 's' || e.key === 'ArrowDown') this.moveDir.z = 1;
            if (e.key === 'a' || e.key === 'ArrowLeft') this.moveDir.x = -1;
            if (e.key === 'd' || e.key === 'ArrowRight') this.moveDir.x = 1;
            if (e.key === 'e' || e.key === 'Enter') this.tryInteract();
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'w' || e.key === 'ArrowUp' || e.key === 's' || e.key === 'ArrowDown') this.moveDir.z = 0;
            if (e.key === 'a' || e.key === 'ArrowLeft' || e.key === 'd' || e.key === 'ArrowRight') this.moveDir.x = 0;
        });

        // Interact button
        document.getElementById('interact-btn').addEventListener('click', () => this.tryInteract());

        // Portfolio button
        document.getElementById('portfolio-btn').addEventListener('click', () => this.showPortfolio());

        // Close modal
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

        // Back to list
        document.getElementById('back-to-list').addEventListener('click', () => {
            this.selectedAsset = null;
            document.getElementById('trade-panel').classList.remove('visible');
            document.getElementById('asset-selection').style.display = 'block';
        });

        // Trade amount change
        document.getElementById('trade-amount').addEventListener('input', () => this.updateTradeTotal());

        // Buy/Sell
        document.getElementById('buy-btn').addEventListener('click', () => this.executeTrade('buy'));
        document.getElementById('sell-btn').addEventListener('click', () => this.executeTrade('sell'));

        // Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

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

        // Update tabs
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

        // Add click handlers
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
                У вас: ${holding.amount.toFixed(4)} ${this.selectedAsset.symbol}<br>
                Стоимость: $${this.formatPrice(currentValue)}<br>
                <span style="${profitClass}">Прибыль: ${profit >= 0 ? '+' : ''}$${this.formatPrice(profit)} (${profitPct.toFixed(2)}%)</span>
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
        
        const min = Math.min(...history);
        const max = Math.max(...history);
        const range = max - min || 1;
        
        ctx.strokeStyle = history[history.length - 1] >= history[0] ? '#4ade80' : '#f87171';
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
                this.portfolio[this.selectedAsset.id] = { amount: 0, cost: 0, symbol: this.selectedAsset.symbol, name: this.selectedAsset.name };
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
    }

    renderPortfolio() {
        const listEl = document.getElementById('holdings-list');
        const holdings = Object.entries(this.portfolio);
        
        let totalValue = this.balance;
        
        let html = '';
        holdings.forEach(([id, holding]) => {
            const asset = Object.values(this.assets).flat().find(a => a.id === id);
            if (!asset) return;
            
            const value = holding.amount * asset.price;
            const profit = value - holding.cost;
            const profitPct = (profit / holding.cost) * 100;
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
            html = '<div style="color:rgba(255,255,255,0.5);text-align:center;padding:30px;">Портфель пуст. Купите активы на биржах!</div>';
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

    updatePlayer(delta) {
        if (this.isModalOpen) return;

        // Movement
        if (this.moveDir.x !== 0 || this.moveDir.z !== 0) {
            const moveX = this.moveDir.x * this.playerSpeed * delta;
            const moveZ = this.moveDir.z * this.playerSpeed * delta;

            const newX = this.player.position.x + moveX;
            const newZ = this.player.position.z + moveZ;

            // Boundary check
            const limit = 90;
            this.player.position.x = Math.max(-limit, Math.min(limit, newX));
            this.player.position.z = Math.max(-limit, Math.min(limit, newZ));

            // Rotation
            if (this.moveDir.x !== 0 || this.moveDir.z !== 0) {
                this.player.rotation.y = Math.atan2(this.moveDir.x, this.moveDir.z);
            }
        }

        // Check near building
        let near = null;
        this.buildings.forEach(building => {
            const bounds = building.userData.bounds;
            if (this.player.position.x > bounds.minX && this.player.position.x < bounds.maxX &&
                this.player.position.z > bounds.minZ && this.player.position.z < bounds.maxZ) {
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
        const camOffset = new THREE.Vector3(0, 15, 20);
        const targetPos = this.player.position.clone().add(camOffset);
        this.camera.position.lerp(targetPos, 5 * delta);
        this.camera.lookAt(this.player.position.x, 2, this.player.position.z);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        this.updatePlayer(delta);
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Start game
window.addEventListener('load', () => {
    window.game = new TradingGame();
});
