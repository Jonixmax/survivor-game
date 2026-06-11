import Phaser from 'phaser';

/**
 * Escena principal del juego (Main Game Loop).
 * Se encarga de gestionar el estado del jugador, la generación de enemigos, 
 * físicas, colisiones y el sistema de progresión básica (experiencia y niveles).
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  /**
   * Ciclo de vida: Inicialización de la escena.
   * Crea todos los objetos, grupos, UI y eventos temporales.
   */
  create() {
    // --- ESTADO INICIAL ---
    // Carga estadísticas guardadas o usa valores por defecto
    const stats = window.gameStats || { vidaMax: 100, velocidad: 200, disparo: 500, color: 0xffffff };

    this.playerLevel = 1;
    this.playerXp = 0;
    this.xpNeeded = 5;
    this.oroRecolectado = 0;
    this.gameTime = 0;
    this.isBossFase = false; 

    // Atributos del jugador
    this.playerHp = stats.vidaMax; 
    this.playerSpeed = stats.velocidad;
    this.shootDelay = Math.max(50, stats.disparo);
    this.playerColor = stats.color; 
    this.isInvulnerable = false; // Control de "I-frames" (tiempos de invulnerabilidad)

    // --- RECURSOS VISUALES (Procedurales) ---
    // Generación dinámica de la textura del suelo para evitar cargar imágenes externas
    const graphics = this.add.graphics();
    graphics.fillStyle(0x228B22, 1);
    graphics.fillRect(0, 0, 50, 50);
    graphics.lineStyle(1, 0x006400, 1);
    graphics.strokeRect(0, 0, 50, 50);
    graphics.generateTexture('grass', 50, 50);
    graphics.destroy();

    // Fondo infinito (TileSprite)
    this.ground = this.add.tileSprite(400, 300, 800, 600, 'grass');
    this.ground.setScrollFactor(0); 
    this.ground.setDepth(-1);

    // --- ENTIDADES PRINCIPALES ---
    // Jugador (Rectángulo básico)
    this.player = this.add.rectangle(400, 300, 40, 40, this.playerColor);
    this.physics.add.existing(this.player);
    this.cameras.main.startFollow(this.player);

    // Controles
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');

    // --- GRUPOS DE FÍSICAS ---
    // Agrupamos entidades para optimizar la validación de colisiones
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.scenery = this.physics.add.staticGroup(); // staticGroup: objetos inamovibles (rocas, muros)
    this.gems = this.physics.add.group(); 
    this.coins = this.physics.add.group(); 

    // --- INTERFAZ DE USUARIO (UI) ---
    this.uiText = this.add.text(20, 20, `HP: ${this.playerHp} | NIVEL: ${this.playerLevel} | ORO: 0`, {
      fontSize: '20px', fill: '#ffffff', fontStyle: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 10, y: 5 }
    });
    this.uiText.setScrollFactor(0).setDepth(10); // setScrollFactor(0) la fija a la pantalla de la cámara

    this.timeText = this.add.text(780, 20, '00:00', {
      fontSize: '32px', fill: '#ffffff', fontStyle: 'bold', backgroundColor: 'rgba(0,0,0,0.8)', padding: { x: 15, y: 5 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);

    // --- COLISIONES Y SOLAPAMIENTOS ---
    this.physics.add.collider(this.player, this.scenery);
    this.physics.add.collider(this.enemies, this.scenery);
    // Nota: La colisión entre enemigos está desactivada intencionalmente para mejorar el rendimiento

    // Overlaps no impiden el movimiento físicamente, pero disparan una función (callback)
    this.physics.add.overlap(this.player, this.gems, this.collectGem, null, this);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this); 
    this.physics.add.overlap(this.projectiles, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.takeDamage, null, this);

    // --- EVENTOS DE TIEMPO (Spawners y Lógica) ---
    this.time.addEvent({ delay: 1000, callback: this.updateTimer, callbackScope: this, loop: true });
    this.enemySpawner = this.time.addEvent({ delay: 1000, callback: this.spawnEnemy, callbackScope: this, loop: true });
    this.time.addEvent({ delay: 1200, callback: this.generateScenery, callbackScope: this, loop: true });
    
    // Disparo automático
    this.attackEvent = this.time.addEvent({ delay: this.shootDelay, callback: this.shootTowardsMouse, callbackScope: this, loop: true });
  }

  /**
   * Bucle principal de juego (se ejecuta a ~60 FPS).
   * Maneja el movimiento manual, seguimiento de IA y limpieza de memoria.
   */
  update() {
    // 1. Movimiento del jugador
    this.player.body.setVelocity(0);
    if (this.cursors.left.isDown || this.keys.A.isDown) this.player.body.setVelocityX(-this.playerSpeed);
    else if (this.cursors.right.isDown || this.keys.D.isDown) this.player.body.setVelocityX(this.playerSpeed);

    if (this.cursors.up.isDown || this.keys.W.isDown) this.player.body.setVelocityY(-this.playerSpeed);
    else if (this.cursors.down.isDown || this.keys.S.isDown) this.player.body.setVelocityY(this.playerSpeed);

    // 2. Efecto de fondo infinito desplazando la textura
    this.ground.tilePositionX = this.cameras.main.scrollX;
    this.ground.tilePositionY = this.cameras.main.scrollY;

    // 3. IA Básica: Los enemigos persiguen al jugador
    this.enemies.getChildren().forEach((enemy) => {
      // Validar si el enemigo y su cuerpo físico siguen activos antes de moverlos
      if (enemy && enemy.active && enemy.body) {
        if (enemy.isBoss) {
          this.physics.moveToObject(enemy, this.player, 150); // Jefe más rápido
        } else {
          this.physics.moveToObject(enemy, this.player, 100);
        }
      }
    });

    // 4. Limpieza de memoria (Garbage Collection visual)
    // Destruye obstáculos que queden demasiado lejos del jugador
    this.scenery.getChildren().forEach((item) => {
      if (item && item.active) {
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) > 1000) {
          item.destroy();
        }
      }
    });
  }

  /**
   * Actualiza el reloj del juego cada segundo y dispara eventos especiales por tiempo.
   */
  updateTimer() {
    this.gameTime++;
    const minutos = Math.floor(this.gameTime / 60).toString().padStart(2, '0');
    const segundos = (this.gameTime % 60).toString().padStart(2, '0');
    this.timeText.setText(`${minutos}:${segundos}`);

    // Evento: Al minuto 1 aparece el jefe
    if (this.gameTime === 60 && !this.isBossFase) {
      this.isBossFase = true;
      this.enemySpawner.destroy(); // Detiene spawn de enemigos regulares
      this.spawnBoss();
    }
  }

  /**
   * Invoca al jefe de la fase con animaciones de alerta en cámara.
   */
  spawnBoss() {
    // Alerta visual
    this.cameras.main.flash(500, 255, 0, 0);
    this.timeText.setText('¡JEFE DETECTADO!').setColor('#ff0000');

    // Crear jefe (cuadrado gigante) por encima del jugador
    const boss = this.add.rectangle(this.player.x, this.player.y - 600, 100, 100, 0x800080);
    this.physics.add.existing(boss);
    
    boss.isBoss = true;
    boss.hp = 1000; 
    this.enemies.add(boss);
  }

  /**
   * Genera un enemigo común en un radio aleatorio fuera de la vista de la cámara.
   */
  spawnEnemy() {
    const radius = 600; // Distancia de spawn (fuera de la pantalla)
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    
    // Calcula la posición circular alrededor del jugador (Trigonometría básica)
    const enemyX = this.player.x + Math.cos(angle) * radius;
    const enemyY = this.player.y + Math.sin(angle) * radius;

    const enemy = this.add.rectangle(enemyX, enemyY, 25, 25, 0x00ff00);
    this.physics.add.existing(enemy);
    this.enemies.add(enemy);
  }

  /**
   * Genera un obstáculo estático en un radio lejano.
   */
  generateScenery() {
    const radius = Phaser.Math.Between(500, 700); 
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const mapObject = this.add.rectangle(this.player.x + Math.cos(angle) * radius, this.player.y + Math.sin(angle) * radius, 50, 50, 0x808080);
    
    this.physics.add.existing(mapObject, true); // El parámetro `true` indica que es un cuerpo estático
    this.scenery.add(mapObject);
  }

  /**
   * Lógica de disparo automático. 
   * Calcula el ángulo hacia la posición del cursor (mouse) y lanza un proyectil hacia allí.
   */
  shootTowardsMouse() {
    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    
    const projectile = this.add.rectangle(this.player.x, this.player.y, 10, 10, 0xffff00);
    this.physics.add.existing(projectile);
    this.projectiles.add(projectile);
    
    const speed = 500;
    projectile.body.setVelocityX(Math.cos(angle) * speed);
    projectile.body.setVelocityY(Math.sin(angle) * speed);
    
    // Auto-destrucción del proyectil a los 2 segundos para evitar fugas de memoria (Memory Leaks)
    this.time.delayedCall(2000, () => { 
      if (projectile && projectile.active) {
        projectile.destroy(); 
      }
    });
  }

  /**
   * Evento de impacto o colisión (Overlap) entre un proyectil y un enemigo.
   * Maneja el daño, la destrucción y la aparición de recompensas (loot).
   */
  hitEnemy(projectile, enemy) {
    if (projectile && projectile.active) projectile.destroy();

    if (enemy && enemy.active) {
      if (enemy.isBoss) {
        // Lógica de daño exclusiva del Jefe
        enemy.hp -= 20; 
        enemy.setFillStyle(0xffffff); // Flash de daño (color blanco)
        this.time.delayedCall(100, () => { if (enemy && enemy.active) enemy.setFillStyle(0x800080); }); 

        // Condición de victoria: Muerte del Jefe
        if (enemy.hp <= 0) {
          this.cameras.main.flash(1000, 255, 255, 0); // Flash dorado brillante en la pantalla
          this.oroRecolectado += 500; 
          enemy.destroy();
          this.scene.pause(); // Congelamos Phaser
          // Despachamos evento al DOM para que la interfaz de React muestre la pantalla de victoria
          window.dispatchEvent(new CustomEvent('gameOver', { detail: { oro: this.oroRecolectado, victoria: true } }));
        }
      } else {
        // Enemigos comunes mueren de 1 golpe
        // Sistema de recompensas: 20% probabilidad de soltar moneda, 80% gema de experiencia
        if (Phaser.Math.Between(1, 100) <= 20) {
          const coin = this.add.rectangle(enemy.x, enemy.y, 10, 10, 0xffd700);
          this.physics.add.existing(coin);
          this.coins.add(coin);
        } else {
          const gem = this.add.rectangle(enemy.x, enemy.y, 12, 12, 0x00ffff);
          this.physics.add.existing(gem);
          this.gems.add(gem);
        }
        enemy.destroy();
      }
    }
  }

  /**
   * Recoge una gema de experiencia y la acumula en la barra del jugador.
   */
  collectGem(player, gem) { 
    if (gem && gem.active) {
      gem.destroy(); 
      this.playerXp++; 
      if (this.playerXp >= this.xpNeeded) this.levelUp(); 
    }
  }

  /**
   * Recoge una moneda de oro y la suma al monedero de esta partida.
   */
  collectCoin(player, coin) { 
    if (coin && coin.active) {
      coin.destroy(); 
      this.oroRecolectado += 10; 
      this.updateUI(); 
    }
  }

  /**
   * Lógica de subida de nivel.
   * Pausa el motor físico y notifica a React para abrir la UI de cartas/tienda.
   */
  levelUp() {
    this.playerLevel++;
    this.playerXp = 0;
    this.xpNeeded = Math.floor(this.xpNeeded * 1.5); // Escala la dificultad de exp de forma exponencial
    this.updateUI();
    
    this.scene.pause(); 
    window.dispatchEvent(new CustomEvent('abrirTienda')); 
  }

  /**
   * Reanuda el juego tras subir de nivel o comprar en la tienda.
   * @param {string} upgradeType - El identificador de la mejora comprada (ej: 'fireRate' o 'speed')
   */
  resumeGame(upgradeType) {
    if (upgradeType === 'fireRate') {
      this.shootDelay = Math.max(100, this.shootDelay - 70); // Mejora con un límite estricto (Cap) de 100ms
      this.attackEvent.destroy();
      // Re-creamos el ciclo temporizado (Timer) de ataque con el nuevo valor de cadencia
      this.attackEvent = this.time.addEvent({ delay: this.shootDelay, callback: this.shootTowardsMouse, callbackScope: this, loop: true });
    } else if (upgradeType === 'speed') {
      this.playerSpeed += 40;
    }
    this.scene.resume(); // Descongela el motor de Phaser
  }

  /**
   * Función invocada cuando un enemigo logra tocar (Overlap) al jugador.
   */
  takeDamage(player, enemy) {
    // Si estamos en medio de un I-Frame (invencibles por haber recibido daño reciente), ignoramos el impacto
    if (this.isInvulnerable) return;

    // Calcular la cantidad de daño
    const danyo = enemy.isBoss ? 50 : 20;
    this.playerHp -= danyo;
    this.updateUI();

    // Condición de derrota
    if (this.playerHp <= 0) {
      this.scene.pause();
      window.dispatchEvent(new CustomEvent('gameOver', { detail: { oro: this.oroRecolectado, victoria: false } }));
      return;
    }

    // Activar I-Frames temporalmente
    this.isInvulnerable = true;
    this.player.setFillStyle(0xffffff); // Feedback visual: pintar al jugador de blanco
    
    this.time.delayedCall(1000, () => {
      this.isInvulnerable = false;
      this.player.setFillStyle(this.playerColor); // Restaurar el color normal del personaje
    });
  }

  /**
   * Refresca los textos superpuestos en la pantalla (Health, Nivel, Oro).
   */
  updateUI() {
    this.uiText.setText(`HP: ${this.playerHp} | NIVEL: ${this.playerLevel} | ORO: ${this.oroRecolectado}`);
  }
}
