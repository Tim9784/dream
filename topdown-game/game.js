// Crystal Hunter - 3D Top-Down Game
// Использует Three.js для красивой 3D графики

class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.enemies = [];
        this.crystals = [];
        this.particles = [];
        this.trees = [];
        this.rocks = [];
        this.score = 0;
        this.health = 100;
        this.keys = {};
        this.gameRunning = false;
        this.clock = new THREE.Clock();
        this.worldSize = 100;
        
        this.init();
    }

    init() {
        // Сцена
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 30, 80);

        // Камера (вид сверху под углом)
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 25, 15);
        this.camera.lookAt(0, 0, 0);

        // Рендерер
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Освещение
        this.setupLights();

        // Земля
        this.createGround();

        // События
        this.setupEventListeners();

        // Анимация
        this.animate();
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404080, 0.4);
        this.scene.add(ambientLight);

        // Main directional light (солнце)
        const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        sunLight.position.set(30, 50, 30);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 150;
        sunLight.shadow.camera.left = -50;
        sunLight.shadow.camera.right = 50;
        sunLight.shadow.camera.top = 50;
        sunLight.shadow.camera.bottom = -50;
        this.scene.add(sunLight);

        // Hemisphere light для мягкого освещения
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362d59, 0.5);
        this.scene.add(hemiLight);

        // Point lights для атмосферы
        const pointLight1 = new THREE.PointLight(0x00d4ff, 0.5, 30);
        pointLight1.position.set(-15, 5, -15);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff00ff, 0.5, 30);
        pointLight2.position.set(15, 5, 15);
        this.scene.add(pointLight2);
    }

    createGround() {
        // Основная земля
        const groundGeometry = new THREE.PlaneGeometry(this.worldSize, this.worldSize, 50, 50);
        
        // Добавляем неровности
        const vertices = groundGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i + 2] = Math.sin(vertices[i] * 0.1) * Math.cos(vertices[i + 1] * 0.1) * 0.5;
        }
        groundGeometry.computeVertexNormals();

        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d4a3e,
            roughness: 0.9,
            metalness: 0.1,
        });

        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Декоративная сетка
        const gridHelper = new THREE.GridHelper(this.worldSize, 50, 0x3a5a4a, 0x2a3a3a);
        gridHelper.position.y = 0.01;
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }

    createPlayer() {
        const playerGroup = new THREE.Group();

        // Тело
        const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.7, 1.5, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x00d4ff,
            metalness: 0.6,
            roughness: 0.2,
            emissive: 0x004466,
            emissiveIntensity: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.75;
        body.castShadow = true;
        playerGroup.add(body);

        // Голова
        const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            metalness: 0.8,
            roughness: 0.1,
            emissive: 0x006666,
            emissiveIntensity: 0.5
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.8;
        head.castShadow = true;
        playerGroup.add(head);

        // Глаза (свечение)
        const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.15, 1.85, 0.3);
        playerGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.15, 1.85, 0.3);
        playerGroup.add(rightEye);

        // Подсветка игрока
        const playerLight = new THREE.PointLight(0x00d4ff, 1, 8);
        playerLight.position.y = 1;
        playerGroup.add(playerLight);

        this.player = playerGroup;
        this.player.position.set(0, 0, 0);
        this.scene.add(this.player);
    }

    createEnemy(x, z) {
        const enemyGroup = new THREE.Group();

        // Тело врага (кубическая форма)
        const bodyGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3366,
            metalness: 0.4,
            roughness: 0.3,
            emissive: 0x660022,
            emissiveIntensity: 0.4
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        body.castShadow = true;
        enemyGroup.add(body);

        // Шипы
        const spikeGeometry = new THREE.ConeGeometry(0.2, 0.6, 4);
        const spikeMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0044,
            metalness: 0.7,
            roughness: 0.2
        });

        const positions = [
            [0, 1.6, 0],
            [0.7, 0.8, 0],
            [-0.7, 0.8, 0],
            [0, 0.8, 0.7],
            [0, 0.8, -0.7]
        ];

        positions.forEach(pos => {
            const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
            spike.position.set(pos[0], pos[1], pos[2]);
            if (pos[0] !== 0) spike.rotation.z = pos[0] > 0 ? -Math.PI / 2 : Math.PI / 2;
            if (pos[2] !== 0) spike.rotation.x = pos[2] > 0 ? Math.PI / 2 : -Math.PI / 2;
            spike.castShadow = true;
            enemyGroup.add(spike);
        });

        // Глаза
        const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.25, 1, 0.55);
        enemyGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.25, 1, 0.55);
        enemyGroup.add(rightEye);

        // Свечение врага
        const enemyLight = new THREE.PointLight(0xff3366, 0.5, 5);
        enemyLight.position.y = 1;
        enemyGroup.add(enemyLight);

        enemyGroup.position.set(x, 0, z);
        enemyGroup.userData = {
            speed: 2 + Math.random() * 2,
            direction: new THREE.Vector3()
        };

        this.scene.add(enemyGroup);
        this.enemies.push(enemyGroup);
    }

    createCrystal(x, z) {
        const crystalGroup = new THREE.Group();

        // Основной кристалл
        const crystalGeometry = new THREE.OctahedronGeometry(0.5, 0);
        const crystalMaterial = new THREE.MeshStandardMaterial({
            color: 0xaa00ff,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x5500aa,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.9
        });
        const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
        crystal.position.y = 1;
        crystal.scale.set(1, 1.5, 1);
        crystal.castShadow = true;
        crystalGroup.add(crystal);

        // Внутреннее свечение
        const innerGeometry = new THREE.OctahedronGeometry(0.25, 0);
        const innerMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.8
        });
        const inner = new THREE.Mesh(innerGeometry, innerMaterial);
        inner.position.y = 1;
        crystalGroup.add(inner);

        // Свечение
        const crystalLight = new THREE.PointLight(0xaa00ff, 1, 6);
        crystalLight.position.y = 1;
        crystalGroup.add(crystalLight);

        // Кольцо
        const ringGeometry = new THREE.TorusGeometry(0.7, 0.05, 8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.5
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.y = 0.5;
        ring.rotation.x = Math.PI / 2;
        crystalGroup.add(ring);

        crystalGroup.position.set(x, 0, z);
        crystalGroup.userData = {
            rotationSpeed: 0.5 + Math.random() * 0.5,
            floatOffset: Math.random() * Math.PI * 2
        };

        this.scene.add(crystalGroup);
        this.crystals.push(crystalGroup);
    }

    createTree(x, z) {
        const treeGroup = new THREE.Group();

        // Ствол
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a3728,
            roughness: 0.9
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        // Крона (несколько сфер)
        const foliageMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d5a3e,
            roughness: 0.8
        });

        const foliagePositions = [
            [0, 3.5, 0, 1.5],
            [0.8, 3, 0.5, 1],
            [-0.6, 3.2, -0.4, 1.1],
            [0.3, 4.2, -0.3, 0.9]
        ];

        foliagePositions.forEach(pos => {
            const foliageGeometry = new THREE.SphereGeometry(pos[3], 8, 8);
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliage.position.set(pos[0], pos[1], pos[2]);
            foliage.castShadow = true;
            treeGroup.add(foliage);
        });

        treeGroup.position.set(x, 0, z);
        this.scene.add(treeGroup);
        this.trees.push(treeGroup);
    }

    createRock(x, z) {
        const rockGroup = new THREE.Group();

        const rockGeometry = new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.5, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x555566,
            roughness: 0.9,
            metalness: 0.1
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.y = 0.4;
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.scale.y = 0.6;
        rock.castShadow = true;
        rockGroup.add(rock);

        rockGroup.position.set(x, 0, z);
        this.scene.add(rockGroup);
        this.rocks.push(rockGroup);
    }

    createParticle(x, y, z, color) {
        const geometry = new THREE.SphereGeometry(0.1, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(geometry, material);
        particle.position.set(x, y, z);
        particle.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 5 + 2,
                (Math.random() - 0.5) * 5
            ),
            life: 1
        };
        this.scene.add(particle);
        this.particles.push(particle);
    }

    spawnWorld() {
        // Создаём деревья
        for (let i = 0; i < 30; i++) {
            const x = (Math.random() - 0.5) * (this.worldSize - 10);
            const z = (Math.random() - 0.5) * (this.worldSize - 10);
            if (Math.abs(x) > 5 || Math.abs(z) > 5) {
                this.createTree(x, z);
            }
        }

        // Создаём камни
        for (let i = 0; i < 40; i++) {
            const x = (Math.random() - 0.5) * (this.worldSize - 10);
            const z = (Math.random() - 0.5) * (this.worldSize - 10);
            if (Math.abs(x) > 3 || Math.abs(z) > 3) {
                this.createRock(x, z);
            }
        }

        // Создаём кристаллы
        for (let i = 0; i < 15; i++) {
            const x = (Math.random() - 0.5) * (this.worldSize - 20);
            const z = (Math.random() - 0.5) * (this.worldSize - 20);
            if (Math.abs(x) > 8 || Math.abs(z) > 8) {
                this.createCrystal(x, z);
            }
        }

        // Создаём врагов
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const distance = 20 + Math.random() * 15;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            this.createEnemy(x, z);
        }
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame();
        });
    }

    startGame() {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('ui').classList.remove('hidden');
        document.getElementById('mini-map').classList.remove('hidden');
        document.getElementById('instructions').classList.remove('hidden');

        this.score = 0;
        this.health = 100;
        this.updateUI();

        this.createPlayer();
        this.spawnWorld();

        this.gameRunning = true;
    }

    updatePlayer(delta) {
        if (!this.player || !this.gameRunning) return;

        const speed = 10 * delta;
        const moveDirection = new THREE.Vector3();

        if (this.keys['KeyW'] || this.keys['ArrowUp']) moveDirection.z -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) moveDirection.z += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDirection.x -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDirection.x += 1;

        if (moveDirection.length() > 0) {
            moveDirection.normalize();
            this.player.position.x += moveDirection.x * speed;
            this.player.position.z += moveDirection.z * speed;

            // Поворот игрока в направлении движения
            const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
            this.player.rotation.y = THREE.MathUtils.lerp(
                this.player.rotation.y,
                targetRotation,
                0.2
            );

            // Анимация покачивания
            this.player.children[0].position.y = 0.75 + Math.sin(Date.now() * 0.01) * 0.1;
        }

        // Ограничение мира
        const limit = this.worldSize / 2 - 5;
        this.player.position.x = Math.max(-limit, Math.min(limit, this.player.position.x));
        this.player.position.z = Math.max(-limit, Math.min(limit, this.player.position.z));

        // Камера следует за игроком
        this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.player.position.x, 0.05);
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, this.player.position.z + 15, 0.05);
        this.camera.lookAt(this.player.position.x, 0, this.player.position.z);
    }

    updateEnemies(delta) {
        if (!this.player || !this.gameRunning) return;

        this.enemies.forEach(enemy => {
            // Движение к игроку
            const direction = new THREE.Vector3();
            direction.subVectors(this.player.position, enemy.position);
            direction.y = 0;
            direction.normalize();

            enemy.position.x += direction.x * enemy.userData.speed * delta;
            enemy.position.z += direction.z * enemy.userData.speed * delta;

            // Поворот к игроку
            enemy.rotation.y = Math.atan2(direction.x, direction.z);

            // Анимация
            enemy.children[0].rotation.y += delta * 2;
            enemy.position.y = Math.sin(Date.now() * 0.005) * 0.2;

            // Проверка столкновения с игроком
            const distance = enemy.position.distanceTo(this.player.position);
            if (distance < 1.5) {
                this.takeDamage(20 * delta);
            }
        });
    }

    updateCrystals(delta) {
        if (!this.player || !this.gameRunning) return;

        for (let i = this.crystals.length - 1; i >= 0; i--) {
            const crystal = this.crystals[i];

            // Анимация вращения и парения
            crystal.children[0].rotation.y += crystal.userData.rotationSpeed * delta;
            crystal.children[1].rotation.y -= crystal.userData.rotationSpeed * delta * 2;
            crystal.children[3].rotation.z += delta;

            const floatY = Math.sin(Date.now() * 0.003 + crystal.userData.floatOffset) * 0.3;
            crystal.children[0].position.y = 1 + floatY;
            crystal.children[1].position.y = 1 + floatY;

            // Проверка сбора
            const distance = crystal.position.distanceTo(this.player.position);
            if (distance < 1.5) {
                // Создаём частицы
                for (let j = 0; j < 15; j++) {
                    this.createParticle(
                        crystal.position.x,
                        crystal.position.y + 1,
                        crystal.position.z,
                        0xaa00ff
                    );
                }

                this.scene.remove(crystal);
                this.crystals.splice(i, 1);
                this.score += 10;
                this.updateUI();

                // Спавним новый кристалл
                setTimeout(() => {
                    const x = (Math.random() - 0.5) * (this.worldSize - 20);
                    const z = (Math.random() - 0.5) * (this.worldSize - 20);
                    this.createCrystal(x, z);
                }, 2000);
            }
        }
    }

    updateParticles(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];

            particle.position.add(particle.userData.velocity.clone().multiplyScalar(delta));
            particle.userData.velocity.y -= 10 * delta;
            particle.userData.life -= delta * 2;

            particle.material.opacity = particle.userData.life;
            particle.scale.setScalar(particle.userData.life);

            if (particle.userData.life <= 0) {
                this.scene.remove(particle);
                this.particles.splice(i, 1);
            }
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        this.updateUI();

        if (this.health <= 0) {
            this.gameOver();
        }
    }

    updateUI() {
        document.getElementById('score').textContent = `💎 Кристаллы: ${this.score}`;
        document.getElementById('health-fill').style.width = `${Math.max(0, this.health)}%`;

        // Цвет полоски здоровья
        const healthFill = document.getElementById('health-fill');
        if (this.health > 60) {
            healthFill.style.background = 'linear-gradient(90deg, #44ff44, #66ff66)';
        } else if (this.health > 30) {
            healthFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
        } else {
            healthFill.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
        }
    }

    updateMiniMap() {
        if (!this.player || !this.gameRunning) return;

        const canvas = document.getElementById('mini-map');
        const ctx = canvas.getContext('2d');
        const size = 150;
        canvas.width = size;
        canvas.height = size;

        // Фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, size, size);

        const scale = size / this.worldSize;
        const offsetX = size / 2;
        const offsetY = size / 2;

        // Деревья
        ctx.fillStyle = '#2d5a3e';
        this.trees.forEach(tree => {
            const x = tree.position.x * scale + offsetX;
            const y = tree.position.z * scale + offsetY;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Камни
        ctx.fillStyle = '#555566';
        this.rocks.forEach(rock => {
            const x = rock.position.x * scale + offsetX;
            const y = rock.position.z * scale + offsetY;
            ctx.fillRect(x - 2, y - 2, 4, 4);
        });

        // Кристаллы
        ctx.fillStyle = '#aa00ff';
        this.crystals.forEach(crystal => {
            const x = crystal.position.x * scale + offsetX;
            const y = crystal.position.z * scale + offsetY;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // Враги
        ctx.fillStyle = '#ff3366';
        this.enemies.forEach(enemy => {
            const x = enemy.position.x * scale + offsetX;
            const y = enemy.position.z * scale + offsetY;
            ctx.fillRect(x - 3, y - 3, 6, 6);
        });

        // Игрок
        ctx.fillStyle = '#00d4ff';
        const px = this.player.position.x * scale + offsetX;
        const py = this.player.position.z * scale + offsetY;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();

        // Рамка
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size, size);
    }

    gameOver() {
        this.gameRunning = false;

        // Показываем экран конца игры
        const startScreen = document.getElementById('start-screen');
        startScreen.classList.remove('hidden');
        startScreen.querySelector('h1').textContent = '💀 Игра окончена';
        startScreen.querySelector('p').textContent = `Ваш счёт: ${this.score} кристаллов`;
        startScreen.querySelector('button').textContent = '🔄 Играть снова';

        // Очищаем сцену для новой игры
        this.enemies.forEach(e => this.scene.remove(e));
        this.crystals.forEach(c => this.scene.remove(c));
        this.particles.forEach(p => this.scene.remove(p));
        this.trees.forEach(t => this.scene.remove(t));
        this.rocks.forEach(r => this.scene.remove(r));
        if (this.player) this.scene.remove(this.player);

        this.enemies = [];
        this.crystals = [];
        this.particles = [];
        this.trees = [];
        this.rocks = [];
        this.player = null;

        document.getElementById('ui').classList.add('hidden');
        document.getElementById('mini-map').classList.add('hidden');
        document.getElementById('instructions').classList.add('hidden');
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        if (this.gameRunning) {
            this.updatePlayer(delta);
            this.updateEnemies(delta);
            this.updateCrystals(delta);
            this.updateParticles(delta);
            this.updateMiniMap();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Запуск игры
window.addEventListener('load', () => {
    new Game();
});
