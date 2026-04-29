/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ShoppingCart, Coins, Palette, Trophy, Car as CarIcon, PlayCircle, X } from 'lucide-react';
import { CARS, COLORS, COLOR_PRICE, RAINBOW_PRICE, CarType, Coin } from './types';

// Constants for physics
const FRICTION = 0.98;
const GRIP_FACTOR = 0.5; // How much the car resists sideways sliding
const TURN_SPEED = 0.05;

export default function App() {
  // Game State
  const [coins, setCoins] = useState<number>(0);
  const [ownedCars, setOwnedCars] = useState<string[]>(['starter']);
  const [ownedColors, setOwnedColors] = useState<string[]>(['#ffffff']);
  const [equippedCarId, setEquippedCarId] = useState<string>('starter');
  const [currentColor, setCurrentColor] = useState<string>('#ffffff');
  const [isRainbowActive, setIsRainbowActive] = useState<boolean>(false);
  const [ownedRainbow, setOwnedRainbow] = useState<boolean>(false);
  const [gameActive, setGameActive] = useState<boolean>(false);
  const [showShop, setShowShop] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'cars' | 'colors'>('cars');
  
  // Refs for physics and game loop
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const carPosRef = useRef({ x: 0, y: 0, angle: 0, velX: 0, velY: 0 });
  const keysRef = useRef<Record<string, boolean>>({});
  const coinsRef = useRef<Coin[]>([]);
  const trailRef = useRef<{x: number, y: number, vx: number, vy: number, alpha: number, size: number}[]>([]);
  const distanceRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const driftRef = useRef<number>(0); // Current drift intensity for visual effects

  // Screen size tracking
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const equippedCar = CARS.find(c => c.id === equippedCarId) || CARS[0];

  // Initialize car position
  useEffect(() => {
    carPosRef.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      angle: 0,
      velX: 0,
      velY: 0
    };
  }, []);

  // Resizing handler
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Coin Spawner
  useEffect(() => {
    if (!gameActive) return;

    const spawnCoin = (isSuper = false) => {
      const newCoin: Coin = {
        id: Math.random().toString(36).substr(2, 9),
        x: Math.random() * (window.innerWidth - 100) + 50,
        y: Math.random() * (window.innerHeight - 100) + 50,
        createdAt: Date.now(),
        isSuper
      };
      coinsRef.current = [...coinsRef.current, newCoin];
    };

    // Initial coin
    spawnCoin();
    
    // Regular Coins every 15 seconds
    const coinInterval = setInterval(() => spawnCoin(false), 15000);
    
    // Super Coins every 1 minute
    const superCoinInterval = setInterval(() => spawnCoin(true), 60000);

    return () => {
      clearInterval(coinInterval);
      clearInterval(superCoinInterval);
    };
  }, [gameActive]);

  // Rainbow Color Cycler
  useEffect(() => {
    if (!isRainbowActive) return;

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % COLORS.length;
      setCurrentColor(COLORS[index]);
    }, 3000);

    return () => clearInterval(interval);
  }, [isRainbowActive]);

  // Game Loop
  const update = useCallback((time: number) => {
    if (!gameActive) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const car = carPosRef.current;
    const stats = equippedCar;

    // Movement Logic
    if (keysRef.current['w'] || keysRef.current['arrowup']) {
      car.velX += Math.cos(car.angle) * stats.accel;
      car.velY += Math.sin(car.angle) * stats.accel;
    }
    if (keysRef.current['s'] || keysRef.current['arrowdown']) {
      car.velX -= Math.cos(car.angle) * (stats.accel * 0.5);
      car.velY -= Math.sin(car.angle) * (stats.accel * 0.5);
    }

    // Steering
    // Steering only works if we're moving
    const speed = Math.sqrt(car.velX * car.velX + car.velY * car.velY);
    if (speed > 0.1) {
      const turnDir = (keysRef.current['a'] || keysRef.current['arrowleft']) ? -1 : 
                      (keysRef.current['d'] || keysRef.current['arrowright']) ? 1 : 0;
      
      // Turn more effectively when moving slower, but less when stopped
      car.angle += turnDir * TURN_SPEED * (speed / stats.speed + 0.2);
    }

    // Drift Physics (Improved)
    const forwardX = Math.cos(car.angle);
    const forwardY = Math.sin(car.angle);
    
    // Dot product for forward velocity
    const fwdMag = car.velX * forwardX + car.velY * forwardY;
    
    // Shift key acts as handbrake (reduces grip)
    const isShift = keysRef.current['shift'];
    const gripBase = stats.drift; // Actually grip factor (lower = more drift)
    const grip = isShift ? gripBase * 0.4 : gripBase;

    // Apply grip: lerp current velocity towards forward heading
    car.velX = car.velX * (1 - grip) + (forwardX * fwdMag) * grip;
    car.velY = car.velY * (1 - grip) + (forwardY * fwdMag) * grip;

    // Apply Friction (slightly less friction when moving fast to maintain drift)
    const driftSpeedFactor = isShift ? 0.99 : FRICTION;
    car.velX *= driftSpeedFactor;
    car.velY *= driftSpeedFactor;

    // Update Position
    car.x += car.velX;
    car.y += car.velY;

    // Track Distance (Earn 10 coins per "mile" - 2000 pixels)
    const distStep = Math.sqrt(car.velX * car.velX + car.velY * car.velY);
    distanceRef.current += distStep;
    if (distanceRef.current >= 2000) {
      setCoins(c => c + 10);
      distanceRef.current = 0;
    }

    // Boundary Check
    if (car.x < 0) car.x = dimensions.width;
    if (car.x > dimensions.width) car.x = 0;
    if (car.y < 0) car.y = dimensions.height;
    if (car.y > dimensions.height) car.y = 0;

    // Trail/Smoke logic
    const isDrifting = Math.abs(fwdMag - speed) > 0.4;
    const isTurning = (keysRef.current['a'] || keysRef.current['arrowleft'] || keysRef.current['d'] || keysRef.current['arrowright']) && speed > 2;
    
    if (speed > 0.5 && (isDrifting || isTurning || isShift)) {
      // Emit smoke from rear wheel positions
      const wheelOffsets = [
        { lx: -15, ly: -10 },
        { lx: -15, ly: 10 }
      ];

      const particleCount = isShift ? 4 : 2;

      wheelOffsets.forEach(offset => {
        for (let i = 0; i < particleCount; i++) {
          // Transform local wheel point to global coordinates
          const gx = car.x + offset.lx * Math.cos(car.angle) - offset.ly * Math.sin(car.angle);
          const gy = car.y + offset.lx * Math.sin(car.angle) + offset.ly * Math.cos(car.angle);

          trailRef.current.push({ 
            x: gx + (Math.random() - 0.5) * 5, 
            y: gy + (Math.random() - 0.5) * 5,
            vx: (Math.random() - 0.5) * (isShift ? 2 : 1),
            vy: (Math.random() - 0.5) * (isShift ? 2 : 1),
            alpha: isShift ? 0.6 : 0.4,
            size: (isShift ? 8 : 5) + Math.random() * 5
          });
        }
      });
    }
    
    // Update and draw smoke particles
    trailRef.current = trailRef.current.map(p => ({ 
      ...p, 
      x: p.x + p.vx,
      y: p.y + p.vy,
      alpha: p.alpha - 0.008,
      size: p.size + 0.5
    })).filter(p => p.alpha > 0);
    
    trailRef.current.forEach(p => {
      ctx.fillStyle = `rgba(200, 200, 200, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Collision with coins
    const remainingCoins = coinsRef.current.filter(coin => {
      const dist = Math.sqrt(Math.pow(car.x - coin.x, 2) + Math.pow(car.y - coin.y, 2));
      if (dist < 40) {
        setCoins(c => c + (coin.isSuper ? 50 : 1));
        return false;
      }
      return true;
    });
    coinsRef.current = remainingCoins;

    // Draw - Arena
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    
    // Background Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 0; i < dimensions.width; i += 50) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, dimensions.height); ctx.stroke();
    }
    for (let j = 0; j < dimensions.height; j += 50) {
      ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(dimensions.width, j); ctx.stroke();
    }

    // Draw Coins
    coinsRef.current.forEach(coin => {
      if (coin.isSuper) {
        // Super Coin (Purple/Gold glow)
        ctx.fillStyle = '#a855f7';
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#d946ef';
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 18, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Regular Coin
        ctx.fillStyle = '#facc15';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#facc15';
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    });

    // Draw Car
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Car Body
    ctx.fillStyle = currentColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-20, -12, 40, 24, 4);
    ctx.fill();
    ctx.stroke();

    // Windshield
    ctx.fillStyle = '#333';
    ctx.fillRect(5, -10, 8, 20);

    // Headlights
    ctx.fillStyle = '#fff';
    ctx.fillRect(15, -10, 5, 4);
    ctx.fillRect(15, 6, 5, 4);

    ctx.restore();

    requestRef.current = requestAnimationFrame(update);
  }, [gameActive, dimensions, equippedCar, currentColor]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  // Shop Functions
  const buyCar = (car: CarType) => {
    if (coins >= car.price && !ownedCars.includes(car.id)) {
      setCoins(c => c - car.price);
      setOwnedCars(prev => [...prev, car.id]);
    }
  };

  const buyColor = (color: string) => {
    if (coins >= COLOR_PRICE && !ownedColors.includes(color)) {
      setCoins(c => c - COLOR_PRICE);
      setOwnedColors(prev => [...prev, color]);
    }
  };

  const buyRainbow = () => {
    if (coins >= RAINBOW_PRICE && !ownedRainbow) {
      setCoins(c => c - RAINBOW_PRICE);
      setOwnedRainbow(true);
    }
  };

  return (
    <div className="relative w-full h-screen bg-neutral-950 overflow-hidden font-sans text-white border-8 border-neutral-900">
      {/* Game Arena */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0 z-0 bg-neutral-950"
      />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* HUD Header */}
      <header className="absolute top-8 left-8 right-8 z-10 flex justify-between items-end">
        <div className="leading-none">
          <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none text-yellow-400 drop-shadow-[0_4px_0_rgba(0,0,0,1)]">
            DRIFT<br/>ARENA
          </h1>
          <p className="text-[10px] tracking-[0.4em] uppercase font-bold mt-2 opacity-40">Street Legends Syndicate</p>
        </div>

        <div className="flex flex-col items-end gap-4 bg-black/40 backdrop-blur-xl p-6 rounded-2xl border-4 border-neutral-800 shadow-2xl">
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest opacity-50 mb-1 font-black">Coins Collected</p>
            <div className="flex items-center justify-end gap-3">
              <span className="w-4 h-4 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.5)]"></span>
              <span className="text-5xl md:text-6xl font-black text-white font-mono">{coins}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setShowShop(true)}
            className="group flex items-center gap-3 bg-neutral-800 hover:bg-yellow-400 text-yellow-400 hover:text-black px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all border-b-4 border-black/20"
          >
            <ShoppingCart className="w-5 h-5" />
            Garage Market
          </button>
        </div>
      </header>

      {/* Status Indicators */}
      <div className="absolute bottom-8 right-8 z-10 bg-neutral-900/80 backdrop-blur p-4 rounded-xl border-2 border-neutral-800 max-w-[200px]">
        <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1 font-black">Current Vehicle</p>
        <p className="text-lg font-black text-white uppercase italic tracking-tight">{equippedCar.name}</p>
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= (equippedCar.speed / 2) ? 'bg-yellow-400' : 'bg-neutral-800'}`} />
          ))}
        </div>
      </div>

      {/* Start Screen */}
      <AnimatePresence>
        {!gameActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-950/90 backdrop-blur-xl"
          >
            <div className="max-w-2xl w-full p-12 text-center border-x-4 border-yellow-400/20 bg-neutral-900 shadow-[0_0_100px_rgba(0,0,0,1)]">
              <div className="inline-block px-4 py-1 bg-yellow-400 text-black text-[10px] uppercase font-black tracking-[0.3em] mb-6">
                Underground Access Only
              </div>
              <h2 className="text-9xl font-black mb-8 tracking-tighter uppercase italic leading-none text-white overflow-visible whitespace-nowrap">
                DRIFT<span className="text-yellow-400">.</span>KING
              </h2>
              <div className="grid grid-cols-2 gap-8 mb-12 text-left">
                <div className="p-6 bg-neutral-800 rounded-2xl border border-white/5">
                  <p className="text-xs uppercase tracking-widest text-yellow-400 font-black mb-2">Controls</p>
                  <p className="text-sm font-bold opacity-60">W/A/S/D — Steering</p>
                  <p className="text-sm font-bold opacity-60">Shift — Hard Drift</p>
                </div>
                <div className="p-6 bg-neutral-800 rounded-2xl border border-white/5">
                  <p className="text-xs uppercase tracking-widest text-yellow-400 font-black mb-2">Objective</p>
                  <p className="text-sm font-bold opacity-60">Collect Coins</p>
                  <p className="text-sm font-bold opacity-60">Upgrade Vehicle</p>
                </div>
              </div>
              <button 
                onClick={() => setGameActive(true)}
                className="w-full bg-yellow-400 text-black font-black py-6 text-2xl rounded-lg hover:bg-white transition-all flex items-center justify-center gap-4 group uppercase italic tracking-tight shadow-[0_10px_30px_rgba(250,204,21,0.2)] hover:shadow-[0_10px_40px_rgba(250,204,21,0.4)]"
              >
                Enter the Arena
                <PlayCircle className="w-8 h-8 group-hover:scale-125 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop Modal */}
      <AnimatePresence>
        {showShop && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-neutral-950 w-full max-w-5xl h-[85vh] rounded-[2rem] overflow-hidden border-8 border-neutral-900 flex flex-col shadow-[0_50px_200px_rgba(0,0,0,1)]"
            >
              {/* Header */}
              <div className="p-10 border-b-2 border-neutral-800 flex items-end justify-between">
                <div>
                  <h2 className="text-7xl font-black uppercase italic tracking-tighter text-white leading-none">Garage<span className="text-yellow-400"> Market</span></h2>
                  <p className="text-xs tracking-[0.4em] uppercase font-bold mt-4 opacity-40">Performance Parts & Custom Coatings</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex bg-neutral-900 rounded-xl p-2 border-2 border-neutral-800">
                    <button 
                      onClick={() => setActiveTab('cars')}
                      className={`px-8 py-3 rounded-lg text-xs font-black tracking-widest uppercase transition-all ${activeTab === 'cars' ? 'bg-yellow-400 text-black' : 'text-white/40 hover:text-white'}`}
                    >
                      Fleet
                    </button>
                    <button 
                      onClick={() => setActiveTab('colors')}
                      className={`px-8 py-3 rounded-lg text-xs font-black tracking-widest uppercase transition-all ${activeTab === 'colors' ? 'bg-yellow-400 text-black' : 'text-white/40 hover:text-white'}`}
                    >
                      Paints
                    </button>
                  </div>
                  <button onClick={() => setShowShop(false)} className="p-4 bg-neutral-800 hover:bg-red-600 rounded-xl transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-10 bg-neutral-900/30">
                {activeTab === 'cars' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {CARS.map(car => (
                      <div 
                        key={car.id}
                        className={`group relative p-8 rounded-3xl border-4 transition-all ${equippedCarId === car.id ? 'bg-yellow-400/5 border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.1)]' : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'}`}
                      >
                        <div className="flex justify-between items-start mb-8">
                          <div>
                            <span className="text-[10px] uppercase tracking-widest font-black text-yellow-400 mb-2 block">
                              {car.price === 0 ? 'Starter Vehicle' : `Tier ${car.price < 1000 ? '1' : 'Elite'}`}
                            </span>
                            <h3 className="text-4xl font-black italic uppercase tracking-tighter">{car.name}</h3>
                          </div>
                          <span className="text-7xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">{car.image}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6 mb-8">
                          <StatBar label="Velocity" value={car.speed} max={10} />
                          <StatBar label="Response" value={car.accel * 50} max={10} />
                        </div>

                        {ownedCars.includes(car.id) ? (
                          <button 
                            disabled={equippedCarId === car.id}
                            onClick={() => setEquippedCarId(car.id)}
                            className={`w-full py-5 rounded-xl font-black uppercase italic tracking-widest text-lg transition-all ${equippedCarId === car.id ? 'bg-yellow-400 text-black' : 'bg-white text-black hover:bg-yellow-400'}`}
                          >
                            {equippedCarId === car.id ? 'Selected' : 'Equip Unit'}
                          </button>
                        ) : (
                          <button 
                            onClick={() => buyCar(car)}
                            disabled={coins < car.price}
                            className="w-full py-5 rounded-xl font-black uppercase italic tracking-widest text-lg transition-all bg-neutral-800 text-yellow-400 border-b-4 border-black hover:bg-yellow-400 hover:text-black disabled:opacity-20"
                          >
                            Purchase — {car.price}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-12">
                    <div className="bg-neutral-800 p-8 rounded-3xl border-b-4 border-black border-r-4 border-black/50">
                      <div className="flex items-center gap-6">
                        <div className="p-4 bg-yellow-400 rounded-2xl">
                          <Palette className="text-black w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-2xl font-black uppercase italic tracking-tight">Custom Paint Shop</p>
                          <p className="text-xs text-white/40 uppercase tracking-widest font-black">All coating units listed at 10 tokens</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-6">
                      {/* Rainbow Button */}
                      <button
                        onClick={() => ownedRainbow ? setIsRainbowActive(!isRainbowActive) : buyRainbow()}
                        className={`aspect-square rounded-3xl border-8 transition-all relative overflow-hidden group flex items-center justify-center ${isRainbowActive ? 'border-yellow-400 scale-110' : 'border-neutral-800'}`}
                        style={{ background: 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)' }}
                      >
                        {!ownedRainbow && (
                          <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-black text-yellow-400">{RAINBOW_PRICE}</span>
                          </div>
                        )}
                        <span className="text-[10px] font-black text-white mix-blend-difference">RAINBOW</span>
                      </button>

                      {COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => {
                            if (ownedColors.includes(color)) {
                              setCurrentColor(color);
                              setIsRainbowActive(false);
                            } else {
                              buyColor(color);
                            }
                          }}
                          className={`aspect-square rounded-3xl border-8 transition-all relative overflow-hidden group ${currentColor === color && !isRainbowActive ? 'border-yellow-400 scale-110 shadow-[0_0_30px_rgba(250,204,21,0.4)]' : 'border-neutral-800 hover:border-neutral-700'}`}
                          style={{ backgroundColor: color }}
                        >
                          {!ownedColors.includes(color) && (
                            <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Coins className="w-5 h-5 text-yellow-400" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    
                    <div className="p-12 rounded-[2rem] bg-black/40 border-4 border-neutral-800 flex flex-col items-center justify-center relative shadow-inner">
                      <div className="absolute top-0 left-0 w-full h-[1px] bg-white/5" />
                      <div 
                        className="w-48 h-24 rounded-2xl border-4 border-white/20 relative mb-6 shadow-2xl"
                        style={{ backgroundColor: currentColor }}
                      >
                        <div className="absolute top-4 right-4 w-6 h-6 bg-white/20 rounded-full" />
                        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-black/10" />
                      </div>
                      <p className="text-xs font-black opacity-30 uppercase tracking-[0.4em]">Color Preview Matrix</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 bg-neutral-900 border-t-2 border-neutral-800 px-10 flex justify-between items-center text-[10px] uppercase font-bold tracking-[0.2em] opacity-30">
                <span>Ref: 0x902-DRIFT</span>
                <span>System Status: Online</span>
                <span>Encrypted Transaction Secure</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Controls (Optional, only visible on touch) */}
      <div className="md:hidden absolute bottom-8 left-8 right-8 z-10 flex justify-between">
        <div className="flex gap-2">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-all">←</div>
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-all">→</div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-all">↑</div>
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-all">↓</div>
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, value, max }: { label: string, value: number, max: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] uppercase font-black tracking-[0.2em] text-white/40">
        <span>{label}</span>
        <span className="text-yellow-400">{Math.round(value)}</span>
      </div>
      <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(value / max) * 100}%` }}
          className="h-full bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)]"
        />
      </div>
    </div>
  );
}
