import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  // Eliminamos el preload() por completo. Cero imágenes de internet.

  create() {
    const stats = window.gameStats || { vidaMax: 100, velocidad: 200, disparo: 500, color: 0xffffff };

    this.playerLevel = 1;
    this.playerXp = 0;
    this.xpNeeded = 5;
    this.oroRecolectado = 0;
    this.gameTime = 0;
    this.isBossFase = false; 

    this.playerHp = stats.vidaMax; 
    this.playerSpeed = stats.velocidad;
    this.shootDelay = Math.max(50, stats.disparo);
    this.playerColor = stats.color; 
    this.isInvulnerable = false;

    // 1. FONDO PROCEDURAL (Generado por código, sin imágenes externas)
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

    // 2. JUGADOR (Cuadrado puro)
    this.player = this.add.rectangle(400, 300, 40, 40, this.playerColor);
    this.physics.add.existing(this.player);
    this.cameras.main.startFollow(this.player);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');

    // GRUPOS
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.scenery = this.physics.add.staticGroup();
    this.gems = this.physics.add.group(); 
    this.coins = this.physics.add.group(); 

    // UI
    this.uiText = this.add.text(20, 20, `HP: ${this.playerHp} | NIVEL: ${this.playerLevel} | ORO: 0`, {
      fontSize: '20px', fill: '#ffffff', fontStyle: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 10, y: 5 }
    });
    this.uiText.setScrollFactor(0).setDepth(10);

    // Movimos el X a 780 (casi al borde derecho) y cambiamos el setOrigin a (1, 0)
    // para que se alinee perfectamente hacia la derecha.
    this.timeText = this.add.text(780, 20, '00:00', {
      fontSize: '32px', 
      fill: '#ffffff', 
      fontStyle: 'bold', 
      backgroundColor: 'rgba(0,0,0,0.8)', 
      padding: { x: 15, y: 5 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);

    // COLISIONES
    this.physics.add.collider(this.player, this.scenery);
    this.physics.add.collider(this.enemies, this.scenery);
    // Sin colisión entre enemigos para salvar la memoria

    this.physics.add.overlap(this.player, this.gems, this.collectGem, null, this);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this); 
    this.physics.add.overlap(this.projectiles, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.takeDamage, null, this);

    // TEMPORIZADORES
    this.time.addEvent({ delay: 1000, callback: this.updateTimer, callbackScope: this, loop: true });
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

    // VALIDACIÓN DE SEGURIDAD EXTREMA
    this.enemies.getChildren().forEach((enemy) => {
      if (enemy && enemy.active && enemy.body) {
        if (enemy.isBoss) {
          this.physics.moveToObject(enemy, this.player, 150);
        } else {
          this.physics.moveToObject(enemy, this.player, 100);
        }
      }
    });

    this.scenery.getChildren().forEach((item) => {
      if (item && item.active) {
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) > 1000) {
          item.destroy();
        }
      }
    });
  }

  updateTimer() {
    this.gameTime++;
    const minutos = Math.floor(this.gameTime / 60).toString().padStart(2, '0');
    const segundos = (this.gameTime % 60).toString().padStart(2, '0');
    this.timeText.setText(`${minutos}:${segundos}`);

    if (this.gameTime === 60 && !this.isBossFase) {
      this.isBossFase = true;
      this.enemySpawner.destroy(); 
      this.spawnBoss();
    }
  }

  spawnBoss() {
    this.cameras.main.flash(500, 255, 0, 0);
    this.timeText.setText('¡JEFE DETECTADO!').setColor('#ff0000');

    const boss = this.add.rectangle(this.player.x, this.player.y - 600, 100, 100, 0x800080);
    this.physics.add.existing(boss);
    
    boss.isBoss = true;
    boss.hp = 1000; 
    this.enemies.add(boss);
  }

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
    
    this.time.delayedCall(2000, () => { 
      if (projectile && projectile.active) {
        projectile.destroy(); 
      }
    });
  }

  hitEnemy(projectile, enemy) {
    if (projectile && projectile.active) projectile.destroy();

    if (enemy && enemy.active) {
      if (enemy.isBoss) {
        enemy.hp -= 20; 
        enemy.setFillStyle(0xffffff); 
        this.time.delayedCall(100, () => { if (enemy && enemy.active) enemy.setFillStyle(0x800080); }); 

        if (enemy.hp <= 0) {
          this.cameras.main.flash(1000, 255, 255, 0);
          this.oroRecolectado += 500; 
          enemy.destroy();
          this.scene.pause();
          window.dispatchEvent(new CustomEvent('gameOver', { detail: { oro: this.oroRecolectado, victoria: true } }));
        }
      } else {
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

  collectGem(player, gem) { 
    if (gem && gem.active) {
      gem.destroy(); 
      this.playerXp++; 
      if (this.playerXp >= this.xpNeeded) this.levelUp(); 
    }
  }

  collectCoin(player, coin) { 
    if (coin && coin.active) {
      coin.destroy(); 
      this.oroRecolectado += 10; 
      this.updateUI(); 
    }
  }

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

  takeDamage(player, enemy) {
    if (this.isInvulnerable) return;

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
      this.player.setFillStyle(this.playerColor); 
    });
  }

  updateUI() {
    this.uiText.setText(`HP: ${this.playerHp} | NIVEL: ${this.playerLevel} | ORO: ${this.oroRecolectado}`);
  }
}