import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const stats = window.gameStats || { vidaMax: 100, velocidad: 200, disparo: 500 };

    this.playerLevel = 1;
    this.playerXp = 0;
    this.xpNeeded = 5;
    this.oroRecolectado = 0;
    
    // VARIABLES DE TIEMPO Y FASES
    this.gameTime = 0; // Segundos transcurridos
    this.isBossFase = false; // ¿Ya apareció el jefe?

    this.playerHp = stats.vidaMax; 
    this.playerSpeed = stats.velocidad;
    this.shootDelay = stats.disparo;
    this.isInvulnerable = false;

    // Escenario
    const graphics = this.add.graphics();
    graphics.fillStyle(0x228B22, 1);
    graphics.fillRect(0, 0, 50, 50);
    graphics.lineStyle(1, 0x006400, 1);
    graphics.strokeRect(0, 0, 50, 50);
    graphics.generateTexture('grass', 50, 50);
    graphics.destroy();

    this.ground = this.add.tileSprite(400, 300, 800, 600, 'grass');
    this.ground.setScrollFactor(0); 
    this.ground.setDepth(-1);

    this.player = this.add.rectangle(400, 300, 40, 40, 0xff0000);
    this.physics.add.existing(this.player);
    this.cameras.main.startFollow(this.player);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');

    // Grupos
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.scenery = this.physics.add.staticGroup();
    this.gems = this.physics.add.group(); 
    this.coins = this.physics.add.group(); 

    // UI Actualizada (Añadimos el Reloj en el centro)
    this.uiText = this.add.text(20, 20, `HP: ${this.playerHp} | NIVEL: ${this.playerLevel} | ORO: 0`, {
      fontSize: '20px', fill: '#ffffff', fontStyle: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 10, y: 5 }
    });
    this.uiText.setScrollFactor(0);
    this.uiText.setDepth(10);

    this.timeText = this.add.text(400, 30, '00:00', {
      fontSize: '32px', fill: '#ffffff', fontStyle: 'bold', backgroundColor: 'rgba(0,0,0,0.8)', padding: { x: 15, y: 5 }
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    // Colisiones
    this.physics.add.collider(this.player, this.scenery);
    this.physics.add.collider(this.enemies, this.scenery);
    this.physics.add.collider(this.enemies, this.enemies);

    this.physics.add.overlap(this.player, this.gems, this.collectGem, null, this);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this); 
    this.physics.add.overlap(this.projectiles, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.takeDamage, null, this);

    // TEMPORIZADORES
    // Reloj Maestro (1 segundo)
    this.time.addEvent({ delay: 1000, callback: this.updateTimer, callbackScope: this, loop: true });
    
    // Spawn normal de enemigos (guardamos la referencia para poder detenerlo)
    this.enemySpawner = this.time.addEvent({ delay: 1000, callback: this.spawnEnemy, callbackScope: this, loop: true });
    this.time.addEvent({ delay: 1200, callback: this.generateScenery, callbackScope: this, loop: true });
    
    this.attackEvent = this.time.addEvent({
      delay: this.shootDelay, callback: this.shootTowardsMouse, callbackScope: this, loop: true
    });
  }

  update() {
    this.player.body.setVelocity(0);
    if (this.cursors.left.isDown || this.keys.A.isDown) this.player.body.setVelocityX(-this.playerSpeed);
    else if (this.cursors.right.isDown || this.keys.D.isDown) this.player.body.setVelocityX(this.playerSpeed);

    if (this.cursors.up.isDown || this.keys.W.isDown) this.player.body.setVelocityY(-this.playerSpeed);
    else if (this.cursors.down.isDown || this.keys.S.isDown) this.player.body.setVelocityY(this.playerSpeed);

    this.ground.tilePositionX = this.cameras.main.scrollX;
    this.ground.tilePositionY = this.cameras.main.scrollY;

    // Persecución inteligente (el Jefe se mueve distinto)
    this.enemies.getChildren().forEach((enemy) => {
      if (enemy.isBoss) {
        this.physics.moveToObject(enemy, this.player, 150); // El jefe es más rápido
      } else {
        this.physics.moveToObject(enemy, this.player, 100);
      }
    });

    this.scenery.getChildren().forEach((item) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) > 1000) item.destroy();
    });
  }

  // --- LÓGICA DE TIEMPO Y JEFE ---
  updateTimer() {
    this.gameTime++;
    const minutos = Math.floor(this.gameTime / 60).toString().padStart(2, '0');
    const segundos = (this.gameTime % 60).toString().padStart(2, '0');
    this.timeText.setText(`${minutos}:${segundos}`);

    // ¡Minuto 1: Llega el Jefe!
    if (this.gameTime === 60 && !this.isBossFase) {
      this.isBossFase = true;
      this.enemySpawner.destroy(); // Detenemos la aparición de enemigos pequeños
      this.spawnBoss();
    }
  }

  spawnBoss() {
    // Alerta visual
    this.cameras.main.flash(500, 255, 0, 0);
    this.timeText.setText('¡JEFE DETECTADO!');
    this.timeText.setColor('#ff0000');

    // Creamos al jefe: más grande y en otra posición
    const boss = this.add.rectangle(this.player.x, this.player.y - 600, 100, 100, 0x800080); // Cuadrado morado gigante
    this.physics.add.existing(boss);
    
    // Propiedades especiales
    boss.isBoss = true;
    boss.hp = 1000; // ¡Tiene mucha vida!
    
    this.enemies.add(boss);
  }

  // --- LÓGICA DE COMBATE ACTUALIZADA ---
  hitEnemy(projectile, enemy) {
    projectile.destroy();

    // Si es el jefe, le restamos vida en lugar de destruirlo al instante
    if (enemy.isBoss) {
      enemy.hp -= 20; // Nuestro daño base
      
      // Parpadeo de daño del jefe
      enemy.setFillStyle(0xffffff);
      this.time.delayedCall(100, () => { if (enemy.active) enemy.setFillStyle(0x800080); });

      if (enemy.hp <= 0) {
        // ¡Mataste al jefe! Suelta una mega recompensa y ganas la partida
        this.cameras.main.flash(1000, 255, 255, 0);
        this.oroRecolectado += 500; // Gran premio
        enemy.destroy();
        
        // Finalizar el juego con victoria
        this.scene.pause();
        window.dispatchEvent(new CustomEvent('gameOver', { detail: { oro: this.oroRecolectado, victoria: true } }));
      }
    } else {
      // Enemigo normal
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

  takeDamage(player, enemy) {
    if (this.isInvulnerable) return;

    // El jefe pega mucho más duro
    const danyo = enemy.isBoss ? 50 : 20;
    this.playerHp -= danyo;
    this.updateUI();

    if (this.playerHp <= 0) {
      this.scene.pause();
      window.dispatchEvent(new CustomEvent('gameOver', { detail: { oro: this.oroRecolectado, victoria: false } }));
      return;
    }

    this.isInvulnerable = true;
    this.player.setFillStyle(0xffffff);
    this.time.delayedCall(1000, () => {
      this.isInvulnerable = false;
      this.player.setFillStyle(0xff0000);
    });
  }

  // --- MÉTODOS ANTERIORES SIN CAMBIOS ---
  spawnEnemy() {
    const radius = 600;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const enemy = this.add.rectangle(this.player.x + Math.cos(angle) * radius, this.player.y + Math.sin(angle) * radius, 25, 25, 0x00ff00);
    this.physics.add.existing(enemy);
    this.enemies.add(enemy);
  }

  generateScenery() {
    const radius = Phaser.Math.Between(500, 700); 
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const mapObject = this.add.rectangle(this.player.x + Math.cos(angle) * radius, this.player.y + Math.sin(angle) * radius, 50, 50, 0x808080);
    this.physics.add.existing(mapObject, true);
    this.scenery.add(mapObject);
  }

  shootTowardsMouse() {
    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    const projectile = this.add.rectangle(this.player.x, this.player.y, 10, 10, 0xffff00);
    this.physics.add.existing(projectile);
    this.projectiles.add(projectile);
    const speed = 500;
    projectile.body.setVelocityX(Math.cos(angle) * speed);
    projectile.body.setVelocityY(Math.sin(angle) * speed);
    this.time.delayedCall(2000, () => { if (projectile.active) projectile.destroy(); });
  }

  collectGem(player, gem) { gem.destroy(); this.playerXp++; if (this.playerXp >= this.xpNeeded) this.levelUp(); }
  collectCoin(player, coin) { coin.destroy(); this.oroRecolectado += 10; this.updateUI(); }

  levelUp() {
    this.playerLevel++;
    this.playerXp = 0;
    this.xpNeeded = Math.floor(this.xpNeeded * 1.5);
    this.updateUI();
    this.scene.pause(); 
    window.dispatchEvent(new CustomEvent('abrirTienda')); 
  }

  resumeGame(upgradeType) {
    if (upgradeType === 'fireRate') {
      this.shootDelay = Math.max(100, this.shootDelay - 70);
      this.attackEvent.destroy();
      this.attackEvent = this.time.addEvent({ delay: this.shootDelay, callback: this.shootTowardsMouse, callbackScope: this, loop: true });
    } else if (upgradeType === 'speed') {
      this.playerSpeed += 40;
    }
    this.scene.resume();
  }

  updateUI() {
    this.uiText.setText(`HP: ${this.playerHp} | NIVEL: ${this.playerLevel} | ORO: ${this.oroRecolectado}`);
  }
}