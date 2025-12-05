import React, { useState } from 'react';
import { User, Lock, Mail, Sword, Skull, CheckCircle } from 'lucide-react';

// IMÁGENES
import loginBg from '../assets/backgrounds/fondo_login_1.png';
import registerBg from '../assets/backgrounds/fondo_registro_1.png'; 

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [userData, setUserData] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? 'http://localhost:3000/api/login' : 'http://localhost:3000/api/register';
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error desconocido');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setUserData(data.user);
      setShowSuccessModal(true);

    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleEnterGame = () => {
    setShowSuccessModal(false);
    console.log("Viajando a la selección de raza...");
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-black">
      
      {/* --- EL TRUCO DEL CROSS-FADE --- 
          Renderizamos AMBAS imágenes. Usamos 'opacity-100' o 'opacity-0' para mostrar una u otra.
          'duration-1000' hace que el cambio tarde 1 segundo, creando el efecto suave.
      */}
      
      {/* IMAGEN DE REGISTRO (Fondo) */}
      <img 
        src={registerBg} 
        alt="Fondo Registro"
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out ${!isLogin ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* IMAGEN DE LOGIN (Frente) */}
      <img 
        src={loginBg} 
        alt="Fondo Login"
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out ${isLogin ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* --- CAPA 2: OSCURECIMIENTO (Overlay) --- */}
      <div className="absolute inset-0 bg-black/30 transition-colors duration-700 pointer-events-none" />

      {/* --- CAPA 3: CONTENIDO --- */}
      <div className={`relative z-10 w-full max-w-md bg-slate-900/60 backdrop-blur-md border-2 border-amber-700/50 p-8 rounded-lg shadow-[0_0_50px_rgba(180,83,9,0.2)] transition-all duration-500 ${showSuccessModal ? 'blur-sm scale-95' : ''}`}>
        
        <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-amber-500 tracking-widest uppercase font-serif mb-2 drop-shadow-md">
                Path to Valhalla
            </h1>
            <div className="flex justify-center items-center gap-2 text-slate-300">
                <Sword size={16} />
                <span className="text-sm uppercase tracking-wider font-semibold">
                    {isLogin ? 'Acceso al Reino' : 'Nuevo Juramento'}
                </span>
                <Sword size={16} className="scale-x-[-1]" />
            </div>
        </div>

        {error && (
            <div className="mb-4 p-3 bg-red-900/60 border border-red-500 text-red-100 text-sm rounded flex items-center gap-2 animate-pulse">
                <Skull size={16} />
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* El campo Nombre tiene una animación para aparecer/desaparecer suavemente también */}
          <div className={`transition-all duration-500 ease-in-out overflow-hidden ${!isLogin ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
             <div className="relative group">
                <User className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  name="username"
                  placeholder="Nombre del Guerrero" 
                  onChange={handleChange}
                  className="w-full bg-black/40 border border-slate-600 rounded py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-500"
                />
              </div>
          </div>

          <div className="relative group">
            <Mail className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={20} />
            <input 
              type="email" 
              name="email"
              placeholder="Correo Electrónico" 
              onChange={handleChange}
              className="w-full bg-black/40 border border-slate-600 rounded py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-500"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={20} />
            <input 
              type="password" 
              name="password"
              placeholder="Palabra Secreta" 
              onChange={handleChange}
              className="w-full bg-black/40 border border-slate-600 rounded py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors placeholder:text-slate-500"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-amber-700/90 to-amber-600/90 hover:from-amber-600 hover:to-amber-500 text-white font-bold py-3 rounded border border-amber-500/50 transition-all transform hover:scale-[1.02] shadow-lg uppercase tracking-widest text-sm"
          >
            {isLogin ? 'Entrar al Valhalla' : 'Forjar Destino'}
          </button>
        </form>

        <div className="mt-6 text-center text-slate-300 text-sm">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-amber-400 hover:text-amber-300 font-semibold hover:underline decoration-amber-500/50 underline-offset-4 transition-all"
          >
            {isLogin ? '¿No tienes linaje? Regístrate' : '¿Ya eres un guerrero? Inicia Sesión'}
          </button>
        </div>
      </div>

      {showSuccessModal && userData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900/90 border-2 border-amber-500 rounded-lg p-6 shadow-[0_0_60px_rgba(245,158,11,0.4)] transform animate-[fadeIn_0.3s_ease-out]">
            <div className="flex justify-center mb-4">
              <div className="bg-amber-500/20 p-3 rounded-full border border-amber-500">
                <CheckCircle className="text-amber-500 w-12 h-12" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-white mb-2 uppercase tracking-wide">
              ¡Bienvenido!
            </h2>
            <p className="text-center text-slate-300 mb-6">
              El Valhalla abre sus puertas, <span className="text-amber-400 font-bold">{userData.username}</span>.
            </p>
            <button 
              onClick={handleEnterGame}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded uppercase tracking-widest transition-colors shadow-lg border border-amber-400"
            >
              Comenzar Aventura
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;