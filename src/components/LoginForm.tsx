import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Eye, EyeOff, User as UserIcon, Lock } from 'lucide-react';

// Мемоизированные компоненты для фигур
const PinIcon = React.memo(({ color, size }: { color: string; size: number }) => (
  <div 
    className="w-full h-full relative flex items-center justify-center"
    style={{ color, width: size, height: size }}
  >
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor"
      className="w-full h-full"
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  </div>
));

const TriangleShape = React.memo(({ color, size }: { color: string; size: number }) => (
  <div 
    className="w-full h-full"
    style={{ 
      backgroundColor: color,
      clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
      width: size,
      height: size
    }}
  />
));

const SquareShape = React.memo(({ color, size }: { color: string; size: number }) => (
  <div 
    className="w-full h-full"
    style={{ 
      backgroundColor: color,
      borderRadius: '10%',
      width: size,
      height: size
    }}
  />
));

const CircleShape = React.memo(({ color, size }: { color: string; size: number }) => (
  <div 
    className="w-full h-full rounded-full"
    style={{ 
      backgroundColor: color,
      width: size,
      height: size
    }}
  />
));

// Мемоизированный компонент фигуры
const Shape = React.memo(({ shape, finalColor }: { shape: any; finalColor: string }) => {
  const style = {
    left: `${shape.x}%`,
    top: `${shape.y}%`,
    width: `${shape.size}px`,
    height: `${shape.size}px`,
    transform: `rotate(${shape.rotation}deg)`,
    opacity: shape.opacity,
    animation: `flyRandom ${shape.speed}s linear infinite`,
    animationDelay: `${Math.random() * 2}s`,
    '--direction': `${shape.direction}deg`
  } as React.CSSProperties;

  return (
    <div className="absolute" style={style}>
      {shape.type === 0 && <PinIcon color={finalColor} size={shape.size} />}
      {shape.type === 1 && <TriangleShape color={finalColor} size={shape.size} />}
      {shape.type === 2 && <SquareShape color={finalColor} size={shape.size} />}
      {shape.type === 3 && <CircleShape color={finalColor} size={shape.size} />}
    </div>
  );
});

const LoginForm: React.FC = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [redShapes, setRedShapes] = useState<Set<string>>(new Set());
  const [lightGrayShapes, setLightGrayShapes] = useState<Set<string>>(new Set());
  const { state, dispatch } = useAppContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  // Оптимизированная генерация фигур с мемоизацией
  const generateShapes = useCallback((layer: number, count: number) => {
    const shapes = [];
    const baseSize = 20;
    const opacity = 0.3 + (layer * 0.1);
    const usedPositions = new Set<string>();
    
    for (let i = 0; i < count; i++) {
      let x, y, attempts = 0;
      const minDistance = 60;
      
      do {
        x = Math.random() * 100;
        y = Math.random() * 100;
        attempts++;
      } while (
        attempts < 50 && 
        Array.from(usedPositions).some(pos => {
          const [px, py] = pos.split(',').map(Number);
          const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
          return distance < minDistance;
        })
      );
      
      usedPositions.add(`${x},${y}`);
      
      const speed = 3 + Math.random() * 8;
      const direction = Math.random() * 360;
      const isRed = Math.random() < 0.02;
      const size = baseSize * (0.5 + Math.random() * 1.5);
      const rotation = Math.random() * 360;
      const shapeType = Math.floor(Math.random() * 4);
      
      shapes.push({
        id: `${layer}-${i}`,
        type: shapeType,
        x,
        y,
        size,
        rotation,
        speed,
        opacity,
        direction,
        color: isRed ? '#8B0000' : `rgba(128, 128, 128, ${opacity})`,
        isRed
      });
    }
    return shapes;
  }, []);

  // Мемоизированные слои
  const layers = useMemo(() => [
    { level: 1, count: 15, blur: '8px' },
    { level: 2, count: 20, blur: '6px' },
    { level: 3, count: 25, blur: '4px' },
    { level: 4, count: 30, blur: '2px' },
    { level: 5, count: 35, blur: '1px' }
  ], []);

  // Мемоизированные фигуры для каждого слоя
  const layerShapes = useMemo(() => {
    return layers.map(layer => generateShapes(layer.level, layer.count));
  }, [layers, generateShapes]);

  // Оптимизированный параллакс с requestAnimationFrame
  useEffect(() => {
    let mouseX = 0;
    let mouseY = 0;
    let isAnimating = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      mouseX = e.clientX - centerX;
      mouseY = e.clientY - centerY;
      
      if (!isAnimating) {
        isAnimating = true;
        animationFrameRef.current = requestAnimationFrame(updateParallax);
      }
    };

    const updateParallax = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const maxOffset = 60;
      const offsetX = (mouseX / rect.width) * maxOffset;
      const offsetY = (mouseY / rect.height) * maxOffset;

      const layers = containerRef.current.querySelectorAll('.parallax-layer');
      layers.forEach((layer, index) => {
        const speed = (index + 1) * 0.3;
        const x = offsetX * speed;
        const y = offsetY * speed;
        (layer as HTMLElement).style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
      
      isAnimating = false;
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove, { passive: true });
      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, []);

  // Оптимизированные обработчики с useCallback
  const handleLoginChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newLogin = e.target.value;
    const oldLogin = login;
    setLogin(newLogin);
    
    if (newLogin.length > oldLogin.length) {
      setRedShapes(prev => {
        const newSet = new Set(prev);
        const allShapes = layerShapes.flat();
        const shapesToColor = Math.ceil(allShapes.length * 0.05);
        for (let i = 0; i < shapesToColor; i++) {
          const randomShape = allShapes[Math.floor(Math.random() * allShapes.length)];
          newSet.add(randomShape.id);
        }
        return newSet;
      });
    }
    
    if (newLogin.length < oldLogin.length) {
      setLightGrayShapes(prev => {
        const newSet = new Set(prev);
        const allShapes = layerShapes.flat();
        const shapesToColor = Math.ceil(allShapes.length * 0.15);
        for (let i = 0; i < shapesToColor; i++) {
          const randomShape = allShapes[Math.floor(Math.random() * allShapes.length)];
          newSet.add(randomShape.id);
        }
        return newSet;
      });
    }
  }, [login, layerShapes]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    const oldPassword = password;
    setPassword(newPassword);
    
    if (newPassword.length > oldPassword.length) {
      setRedShapes(prev => {
        const newSet = new Set(prev);
        const allShapes = layerShapes.flat();
        const shapesToColor = Math.ceil(allShapes.length * 0.05);
        for (let i = 0; i < shapesToColor; i++) {
          const randomShape = allShapes[Math.floor(Math.random() * allShapes.length)];
          newSet.add(randomShape.id);
        }
        return newSet;
      });
    }
    
    if (newPassword.length < oldPassword.length) {
      setLightGrayShapes(prev => {
        const newSet = new Set(prev);
        const allShapes = layerShapes.flat();
        const shapesToColor = Math.ceil(allShapes.length * 0.15);
        for (let i = 0; i < shapesToColor; i++) {
          const randomShape = allShapes[Math.floor(Math.random() * allShapes.length)];
          newSet.add(randomShape.id);
        }
        return newSet;
      });
    }
  }, [password, layerShapes]);

  const handleLogin = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = state.users.find(u => 
      u.login === login && u.password === password
    );

    if (user) {
      dispatch({ type: 'SET_USER', payload: user });
    } else {
      setError('Invalid login or password');
    }
  }, [login, password, state.users, dispatch]);

  return (
    <div 
      ref={containerRef}
      className="relative min-h-screen overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #2C2C2C 0%, #1A1A1A 50%, #0F0F0F 100%)'
      }}
    >
      {/* Слои с движущимися фигурами */}
      {layers.map((layer, layerIndex) => (
        <div
          key={layer.level}
          className="parallax-layer absolute inset-0"
          style={{
            filter: `blur(${layer.blur})`,
            transform: 'translateZ(0)',
            willChange: 'transform'
          }}
        >
          {layerShapes[layerIndex]?.map((shape) => {
            const isRed = redShapes.has(shape.id) || shape.isRed;
            const isLightGray = lightGrayShapes.has(shape.id);
            
            let finalColor = shape.color;
            if (isRed) {
              finalColor = '#DC143C';
            } else if (isLightGray) {
              finalColor = '#D3D3D3';
            }
            
            return (
              <Shape
                key={shape.id}
                shape={shape}
                finalColor={finalColor}
              />
            );
          })}
        </div>
      ))}

      {/* Матовое стекло эффект */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%),
            radial-gradient(circle at 70% 80%, rgba(255,255,255,0.08) 0%, transparent 50%),
            linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)
          `,
          backdropFilter: 'blur(3px)',
          filter: 'contrast(1.1) brightness(0.8) saturate(0.5)'
        }}
      />

      {/* Контент */}
      <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
        <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-white drop-shadow-lg">
            Вход в систему NTruck
          </h2>
              <p className="mt-2 text-center text-sm text-white/80 drop-shadow-md">
            Система управления складскими перемещениями
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
                <div className="bg-red-500/20 border border-red-400/30 rounded-md p-3 backdrop-blur-sm">
                  <p className="text-red-100 text-sm">{error}</p>
            </div>
          )}

          <div>
                <label htmlFor="login" className="block text-sm font-medium text-white/90 drop-shadow-md">
              Login
            </label>
            <div className="mt-1 relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                id="login"
                type="text"
                value={login}
                    onChange={handleLoginChange}
                    className="w-full px-10 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200"
                placeholder="Enter your login"
                required
              />
            </div>
          </div>

          <div>
                <label htmlFor="password" className="block text-sm font-medium text-white/90 drop-shadow-md">
              Password
            </label>
            <div className="mt-1 relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                    onChange={handlePasswordChange}
                    className="w-full px-10 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white/80 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={!login || !password}
                  className="group relative w-full py-3 px-4 bg-gradient-to-r from-blue-600/80 to-purple-600/80 backdrop-blur-sm border border-white/30 rounded-lg text-white font-medium hover:from-blue-500/90 hover:to-purple-500/90 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
            >
              Sign In
            </button>
          </div>
        </form>
          </div>
        </div>
      </div>

      {/* Оптимизированные CSS анимации */}
      <style jsx>{`
        @keyframes flyRandom {
          0% {
            transform: translateX(0) translateY(0) rotate(var(--direction));
          }
          25% {
            transform: translateX(25px) translateY(-25px) rotate(calc(var(--direction) + 90deg));
          }
          50% {
            transform: translateX(0) translateY(-50px) rotate(calc(var(--direction) + 180deg));
          }
          75% {
            transform: translateX(-25px) translateY(-25px) rotate(calc(var(--direction) + 270deg));
          }
          100% {
            transform: translateX(0) translateY(0) rotate(calc(var(--direction) + 360deg));
          }
        }
        
        .parallax-layer {
          transform: translateZ(0);
          backface-visibility: hidden;
          perspective: 1000px;
        }
        
        .parallax-layer * {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
};

export default LoginForm;