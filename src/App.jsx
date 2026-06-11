import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import GameScene from './GameScene';

// NUESTRO CATÁLOGO DE CAMPEONES
const CAMPEONES = [
  { 
    id: 'artillero', nombre: 'El Artillero', color: '#0088ff', hexColor: 0x0088ff, 
    bonoVida: -20, bonoVelocidad: 50, bonoDisparo: -150, 
    desc: 'Frágil pero letal. Comienza con gran velocidad de movimiento y ráfagas rápidas.' 
  },
  { 
    id: 'tanque', nombre: 'El Coloso', color: '#ff8800', hexColor: 0xff8800, 
    bonoVida: 100, bonoVelocidad: -30, bonoDisparo: 50, 
    desc: 'Lento y de disparos pesados, pero puede resistir muchísimo castigo de la horda.' 
  }
];

function App() {
  const gameRef = useRef(null);
  
  const [pantalla, setPantalla] = useState('MENU'); 
  const [tiendaAbierta, setTiendaAbierta] = useState(false);
  const [gameInstance, setGameInstance] = useState(null);
  
  // Resultados de la partida
  const [resultadoPartida, setResultadoPartida] = useState({ oro: 0, victoria: false });

  // Meta-progresión
  const [oroTotal, setOroTotal] = useState(() => parseInt(localStorage.getItem('oroTotal')) || 0);
  const [statsBase, setStatsBase] = useState(() => {
    const guardado = localStorage.getItem('statsBase');
    return guardado ? JSON.parse(guardado) : { vidaMax: 100, velocidad: 200, disparo: 500 };
  });

  // ¡NUEVO! Estado para el campeón seleccionado
  const [campeonSeleccionado, setCampeonSeleccionado] = useState(CAMPEONES[0]);

  useEffect(() => { localStorage.setItem('oroTotal', oroTotal); }, [oroTotal]);
  useEffect(() => { localStorage.setItem('statsBase', JSON.stringify(statsBase)); }, [statsBase]);

  const empezarPartida = () => {
    // ¡Fusionamos las estadísticas permanentes con los bonos del campeón!
    window.gameStats = {
      vidaMax: statsBase.vidaMax + campeonSeleccionado.bonoVida,
      velocidad: statsBase.velocidad + campeonSeleccionado.bonoVelocidad,
      disparo: statsBase.disparo + campeonSeleccionado.bonoDisparo,
      color: campeonSeleccionado.hexColor
    };
    setPantalla('JUGANDO');
  };

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
        setResultadoPartida({ oro: e.detail.oro, victoria: e.detail.victoria });
        setOroTotal(prev => prev + e.detail.oro); 
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

  const comprarMejoraBase = (tipo, costo) => {
    if (oroTotal >= costo) {
      setOroTotal(oroTotal - costo);
      setStatsBase(prev => {
        if (tipo === 'vida') return { ...prev, vidaMax: prev.vidaMax + 20 };
        if (tipo === 'disparo') return { ...prev, disparo: prev.disparo - 50 };
        return prev;
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px', color: 'white', fontFamily: 'sans-serif' }}>
      
      {pantalla === 'MENU' && (
        <div style={{ backgroundColor: '#111', padding: '30px', borderRadius: '12px', width: '700px', textAlign: 'center', border: '2px solid #333' }}>
          <h1 style={{ color: '#00ffff', fontSize: '42px', margin: '0 0 10px 0' }}>SURVIVOR SWARM</h1>
          <h2 style={{ color: '#ffd700', marginBottom: '20px' }}>💰 Oro Total: {oroTotal}</h2>
          
          {/* SECCIÓN DE MEJORAS PERMANENTES */}
          <div style={{ backgroundColor: '#222', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'left' }}>
            <h3 style={{ marginTop: 0, color: '#aaa' }}>Laboratorio (Mejoras Globales)</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>❤️ Salud Máx Base ({statsBase.vidaMax})</span>
              <button onClick={() => comprarMejoraBase('vida', 50)} disabled={oroTotal < 50}>Mejorar (50 Oro)</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>🔫 Cadencia Base ({statsBase.disparo}ms)</span>
              <button onClick={() => comprarMejoraBase('disparo', 100)} disabled={oroTotal < 100}>Mejorar (100 Oro)</button>
            </div>
          </div>

          {/* ¡NUEVO! SELECTOR DE CAMPEONES */}
          <h3 style={{ color: '#aaa', textAlign: 'left' }}>Selecciona tu Campeón:</h3>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
            {CAMPEONES.map(camp => (
              <div 
                key={camp.id} 
                onClick={() => setCampeonSeleccionado(camp)}
                style={{ 
                  flex: 1, padding: '15px', borderRadius: '8px', cursor: 'pointer',
                  border: campeonSeleccionado.id === camp.id ? `3px solid ${camp.color}` : '3px solid #333',
                  backgroundColor: campeonSeleccionado.id === camp.id ? '#2a2a2a' : '#1a1a1a',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '40px', height: '40px', backgroundColor: camp.color, margin: '0 auto 10px auto', borderRadius: '4px' }}></div>
                <h3 style={{ margin: '0 0 10px 0', color: camp.color }}>{camp.nombre}</h3>
                <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>{camp.desc}</p>
                <hr style={{ borderColor: '#444' }}/>
                <p style={{ fontSize: '12px', color: '#aaa', margin: 0 }}>
                  HP: {statsBase.vidaMax + camp.bonoVida} | Vel: {statsBase.velocidad + camp.bonoVelocidad}
                </p>
              </div>
            ))}
          </div>

          <button onClick={empezarPartida} style={{ padding: '20px 60px', fontSize: '24px', backgroundColor: campeonSeleccionado.color, color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', textShadow: '1px 1px 2px #000' }}>
            DESPLEGAR
          </button>
        </div>
      )}

      {pantalla === 'JUGANDO' && (
        <div style={{ position: 'relative' }}>
          <div ref={gameRef} style={{ border: `4px solid ${campeonSeleccionado.color}`, borderRadius: '8px', overflow: 'hidden' }}></div>

          {tiendaAbierta && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2 style={{ color: '#00ffff' }}>¡MEJORA TÁCTICA DISPONIBLE!</h2>
              <div style={{ display: 'flex', gap: '20px' }}>
                <button onClick={() => { setTiendaAbierta(false); gameInstance.scene.keys.GameScene.resumeGame('fireRate'); }} style={{ padding: '20px', backgroundColor: '#222', color: 'yellow', border: '2px solid yellow', cursor: 'pointer' }}>
                  🔫 + Cadencia de Fuego
                </button>
                <button onClick={() => { setTiendaAbierta(false); gameInstance.scene.keys.GameScene.resumeGame('speed'); }} style={{ padding: '20px', backgroundColor: '#222', color: '#00ff00', border: '2px solid #00ff00', cursor: 'pointer' }}>
                  👟 + Velocidad de Movimiento
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANTALLA DE RESULTADOS MEJORADA (Muestra Victoria o Derrota) */}
      {pantalla === 'GAMEOVER' && (
        <div style={{ backgroundColor: resultadoPartida.victoria ? '#003300' : '#4a0000', padding: '50px', borderRadius: '12px', textAlign: 'center', border: `4px solid ${resultadoPartida.victoria ? '#00ff00' : 'red'}` }}>
          <h1 style={{ fontSize: '48px', margin: '0 0 10px 0', color: resultadoPartida.victoria ? '#00ff00' : '#ff0000' }}>
            {resultadoPartida.victoria ? '¡MISIÓN CUMPLIDA!' : 'HAS CAÍDO'}
          </h1>
          {resultadoPartida.victoria && <p style={{ fontSize: '20px', color: '#ccc' }}>El jefe ha sido eliminado. La zona está asegurada.</p>}
          <h2 style={{ color: '#ffd700', marginTop: '30px' }}>Oro Obtenido: +{resultadoPartida.oro}</h2>
          
          <button onClick={() => setPantalla('MENU')} style={{ marginTop: '30px', padding: '15px 30px', fontSize: '20px', cursor: 'pointer', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
            Volver a la Base
          </button>
        </div>
      )}
    </div>
  );
}

export default App;