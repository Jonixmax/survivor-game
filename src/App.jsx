import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import GameScene from './GameScene';

function App() {
  const gameRef = useRef(null);
  
  // ESTADOS DE LA APLICACIÓN
  const [pantalla, setPantalla] = useState('MENU'); // 'MENU', 'JUGANDO', 'GAMEOVER'
  const [tiendaAbierta, setTiendaAbierta] = useState(false);
  const [gameInstance, setGameInstance] = useState(null);
  const [oroObtenidoEnPartida, setOroObtenidoEnPartida] = useState(0);

  // META-PROGRESIÓN (Se lee del localStorage, o se crea si no existe)
  const [oroTotal, setOroTotal] = useState(() => parseInt(localStorage.getItem('oroTotal')) || 0);
  const [statsBase, setStatsBase] = useState(() => {
    const guardado = localStorage.getItem('statsBase');
    return guardado ? JSON.parse(guardado) : { vidaMax: 100, velocidad: 200, disparo: 500 };
  });

  // Guardar en LocalStorage cada vez que el oro o las stats cambian
  useEffect(() => { localStorage.setItem('oroTotal', oroTotal); }, [oroTotal]);
  useEffect(() => { localStorage.setItem('statsBase', JSON.stringify(statsBase)); }, [statsBase]);

  // INICIAR EL JUEGO
  const empezarPartida = () => {
    // Le pasamos las stats al motor globalmente
    window.gameStats = statsBase;
    setPantalla('JUGANDO');
  };

  // CONTROL DEL CANVAS DE PHASER
  useEffect(() => {
    if (pantalla === 'JUGANDO' && !gameInstance) {
      const config = {
        type: Phaser.AUTO, width: 800, height: 600, parent: gameRef.current,
        physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
        scene: [GameScene],
      };
      
      const game = new Phaser.Game(config);
      setGameInstance(game);

      const handleAbrirTienda = () => setTiendaAbierta(true);
      const handleGameOver = (e) => {
        // Recibimos el oro de la partida
        const oroGanado = e.detail.oro;
        setOroObtenidoEnPartida(oroGanado);
        setOroTotal(prev => prev + oroGanado); // Lo sumamos al banco permanente
        setPantalla('GAMEOVER');
      };

      window.addEventListener('abrirTienda', handleAbrirTienda);
      window.addEventListener('gameOver', handleGameOver);

      return () => {
        window.removeEventListener('abrirTienda', handleAbrirTienda);
        window.removeEventListener('gameOver', handleGameOver);
        game.destroy(true);
        setGameInstance(null);
      };
    }
  }, [pantalla]);

  // FUNCIONES DE LA TIENDA DEL MENÚ PRINCIPAL
  const comprarMejoraBase = (tipo, costo) => {
    if (oroTotal >= costo) {
      setOroTotal(oroTotal - costo);
      setStatsBase(prev => {
        if (tipo === 'vida') return { ...prev, vidaMax: prev.vidaMax + 20 };
        if (tipo === 'disparo') return { ...prev, disparo: prev.disparo - 50 }; // Menor delay = más rápido
        return prev;
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* PANTALLA 1: MENÚ PRINCIPAL Y META-PROGRESIÓN */}
      {pantalla === 'MENU' && (
        <div style={{ backgroundColor: '#111', padding: '40px', borderRadius: '12px', width: '600px', textAlign: 'center', border: '2px solid #333' }}>
          <h1 style={{ color: '#00ffff', fontSize: '48px', margin: '0 0 10px 0' }}>SURVIVOR SWARM</h1>
          <h2 style={{ color: '#ffd700', marginBottom: '30px' }}>💰 Oro Total: {oroTotal}</h2>
          
          <div style={{ backgroundColor: '#222', padding: '20px', borderRadius: '8px', marginBottom: '30px', textAlign: 'left' }}>
            <h3 style={{ marginTop: 0 }}>Mejoras Base Permanentes</h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
              <span>❤️ Salud Máx ({statsBase.vidaMax})</span>
              <button onClick={() => comprarMejoraBase('vida', 50)} disabled={oroTotal < 50} style={{ padding: '8px 15px', cursor: oroTotal >= 50 ? 'pointer' : 'not-allowed' }}>
                Mejorar (50 Oro)
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔫 Cadencia Inicial ({statsBase.disparo}ms)</span>
              <button onClick={() => comprarMejoraBase('disparo', 100)} disabled={oroTotal < 100} style={{ padding: '8px 15px', cursor: oroTotal >= 100 ? 'pointer' : 'not-allowed' }}>
                Mejorar (100 Oro)
              </button>
            </div>
          </div>

          <button onClick={empezarPartida} style={{ padding: '20px 40px', fontSize: '24px', backgroundColor: '#00ff00', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            INICIAR PARTIDA
          </button>
        </div>
      )}

      {/* PANTALLA 2: EL JUEGO ACTIVO */}
      {pantalla === 'JUGANDO' && (
        <div style={{ position: 'relative' }}>
          <div ref={gameRef} style={{ border: '4px solid #333', borderRadius: '8px', overflow: 'hidden' }}></div>

          {tiendaAbierta && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2 style={{ color: '#00ffff' }}>¡NIVEL ALCANZADO!</h2>
              <div style={{ display: 'flex', gap: '20px' }}>
                <button onClick={() => { setTiendaAbierta(false); gameInstance.scene.keys.GameScene.resumeGame('fireRate'); }} style={{ padding: '20px', backgroundColor: '#222', color: 'yellow', border: '2px solid yellow', cursor: 'pointer' }}>
                  🔫 Cadencia Temporal
                </button>
                <button onClick={() => { setTiendaAbierta(false); gameInstance.scene.keys.GameScene.resumeGame('speed'); }} style={{ padding: '20px', backgroundColor: '#222', color: '#00ff00', border: '2px solid #00ff00', cursor: 'pointer' }}>
                  👟 Velocidad Temporal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANTALLA 3: GAME OVER Y RESULTADOS */}
      {pantalla === 'GAMEOVER' && (
        <div style={{ backgroundColor: '#4a0000', padding: '50px', borderRadius: '12px', textAlign: 'center', border: '4px solid red' }}>
          <h1 style={{ fontSize: '48px', margin: '0 0 20px 0' }}>HAS CAÍDO</h1>
          <h2 style={{ color: '#ffd700' }}>Oro Recolectado: +{oroObtenidoEnPartida}</h2>
          <button onClick={() => setPantalla('MENU')} style={{ marginTop: '30px', padding: '15px 30px', fontSize: '20px', cursor: 'pointer' }}>
            Volver a la Base
          </button>
        </div>
      )}
    </div>
  );
}

export default App;