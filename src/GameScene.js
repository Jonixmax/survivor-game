import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    // IMÁGENES
    this.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.image('enemy', 'https://labs.phaser.io/assets/sprites/space-baddie.png');
    this.load.image('boss', 'https://labs.phaser.io/assets/sprites/slime.png');
    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullet.png');
    this.load.image('gem', 'https://labs.phaser.io/assets/sprites/diamond.png');
    this.load.image('coin', 'https://labs.phaser.io/assets/sprites/coin.png');
    this.load.image('rock', 'https://labs.phaser.io/assets/sprites/block.png');
    this.load.image('grass', 'https://labs.phaser.io/assets/textures/grass.png');

    // AUDIOS (¡NUEVO!)
    this.load.audio('shoot', 'https://labs.phaser.io/assets/audio/SoundEffects/blaster.wav');
    this.load.audio('hit', 'https://labs.phaser.io/assets/audio/SoundEffects/squit.wav');
    this.load.audio('pickup', 'https://labs.phaser.io/assets/audio/SoundEffects/key.wav');
    this.load.audio('hurt', 'https://labs.phaser.io/assets/audio/SoundEffects/player_hit.wav');
  }

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

    // Fondo
    this.ground = this.add.tileSprite(400, 300, 800, 600, 'grass');
    this.ground.setScrollFactor(0); 
    this.ground.setDepth(-1);
    this.ground.setTint(0x555555); 

    // Jugador
    this.player = this.physics.add.sprite(400, 300, 'player');
    this.player.setTint(this.playerColor); 
    this.cameras.main.startFollow(this.player);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');

    // Grupos
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

    this.timeText = this.add.text(400, 30, '00:00', {
      fontSize: '32px', fill: '#ffffff', fontStyle: 'bold', backgroundColor: 'rgba(0,0,0,0.8)', padding: { x: 15, y: 5 }
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10);

    // Colisiones
    this.physics.add.collider(this.player, this.scenery);
    this.physics.add.collider(this.enemies, this.scenery);
    // this.physics.add.collider(this.enemies, this.enemies);

    this.physics.add.overlap(this.player, this.gems, this.collectGem, null, this);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this); 
    this.physics.add.overlap(this.projectiles, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.takeDamage, null, this);

    // Temporizadores
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

    this.enemies.getChildren().forEach((enemy) => {
      if (enemy.isBoss) {
        this.physics.moveToObject(enemy, this.player, 150);
      } else {
        this.physics.moveToObject(enemy, this.player, 100);
      }
    });

    this.scenery.getChildren().forEach((item) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) > 1000) item.destroy();
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

    const boss = this.physics.add.sprite(this.player.x, this.player.y - 600, 'boss');
    boss.setScale(3);
    boss.setTint(0xff00ff); 
    
    boss.isBoss = true;
    boss.hp = 1000; 
    this.enemies.add(boss);
  }

  spawnEnemy() {
    const radius = 600;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const enemy = this.physics.add.sprite(this.player.x + Math.cos(angle) * radius, this.player.y + Math.sin(angle) * radius, 'enemy');
    enemy.setScale(1.5); 
    this.enemies.add(enemy);
  }

  generateScenery() {
    const radius = Phaser.Math.Between(500, 700); 
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const mapObject = this.physics.add.sprite(this.player.x + Math.cos(angle) * radius, this.player.y + Math.sin(angle) * radius, 'rock');
    this.scenery.add(mapObject);
    mapObject.body.setImmovable(true);
  }

  shootTowardsMouse() {
    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    
    // SONIDO: Disparo láser (volumen muy bajito para no molestar)
    // this.sound.play('shoot', { volume: 0.1 });

    const projectile = this.physics.add.sprite(this.player.x, this.player.y, 'bullet');
    projectile.setRotation(angle);
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
    projectile.destroy();

    // SONIDO: Impacto contra enemigo
    this.sound.play('hit', { volume: 0.2 });

    if (enemy.isBoss) {
      enemy.hp -= 20; 
      enemy.setTint(0xffffff); 
      this.time.delayedCall(100, () => { if (enemy.active) enemy.setTint(0xff00ff); }); 

      if (enemy.hp <= 0) {
        this.cameras.main.flash(1000, 255, 255, 0);
        this.oroRecolectado += 500; 
        enemy.destroy();
        this.scene.pause();
        window.dispatchEvent(new CustomEvent('gameOver', { detail: { oro: this.oroRecolectado, victoria: true } }));
      }
    } else {
      if (Phaser.Math.Between(1, 100) <= 20) {
        const coin = this.physics.add.sprite(enemy.x, enemy.y, 'coin');
        coin.setScale(0.8);
        this.coins.add(coin);
      } else {
        const gem = this.physics.add.sprite(enemy.x, enemy.y, 'gem');
        gem.setScale(0.6);
        this.gems.add(gem);
      }
      enemy.destroy();
    }
  }

  collectGem(player, gem) { 
    gem.destroy(); 
    // SONIDO: Recoger XP
    this.sound.play('pickup', { volume: 0.4 });
    
    this.playerXp++; 
    if (this.playerXp >= this.xpNeeded) this.levelUp(); 
  }

  collectCoin(player, coin) { 
    coin.destroy(); 
    // SONIDO: Recoger Moneda (mismo sonido, ligeramente distinto tono si quisieras)
    this.sound.play('pickup', { volume: 0.5 });
    
    this.oroRecolectado += 10; 
    this.updateUI(); 
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

    // SONIDO: El jugador recibe daño
    this.sound.play('hurt', { volume: 0.6 });

    const danyo = enemy.isBoss ? 50 : 20;
    this.playerHp -= danyo;
    this.updateUI();

    if (this.playerHp <= 0) {
      this.scene.pause();
      window.dispatchEvent(new CustomEvent('gameOver', { detail: { oro: this.oroRecolectado, victoria: false } }));
      return;
    }

    this.isInvulnerable = true;
    this.player.setTint(0xff0000); 
    
    this.time.delayedCall(1000, () => {
      this.isInvulnerable = false;
      this.player.setTint(this.playerColor); 
    });
  }

  updateUI() {
    this.uiText.setText(`HP: ${this.playerHp} | NIVEL: ${this.playerLevel} | ORO: ${this.oroRecolectado}`);
  }
}