import React, { useState } from 'react';
import { User, Lock, Mail, Sword, Skull, CheckCircle } from 'lucide-react';
// Usamos una imagen online para evitar errores de archivo local por ahora
const bgImage = "https://images.unsplash.com/photo-1518182170546-0766aaef3112?q=80&w=2600&auto=format&fit=crop"; 

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  
  // Nuevo estado para controlar el Modal de Éxito
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

      // ÉXITO
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Guardamos datos para mostrar en el modal y lo activamos
      setUserData(data.user);
      setShowSuccessModal(true);

    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  // Función para cerrar el modal y (en el futuro) ir al juego
  const handleEnterGame = () => {
    setShowSuccessModal(false);
    console.log("Viajando a la selección de raza...");
    // Aquí pondremos la navegación más adelante
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="absolute inset-0 bg-black/70" />

      {/* --- FORMULARIO PRINCIPAL --- */}
      <div className={`relative z-10 w-full max-w-md bg-slate-900/90 border-2 border-amber-700/50 p-8 rounded-lg shadow-[0_0_50px_rgba(180,83,9,0.2)] transition-all duration-500 ${showSuccessModal ? 'blur-sm scale-95' : ''}`}>
        
        <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-amber-500 tracking-widest uppercase font-serif mb-2">
                Path to Valhalla
            </h1>
            <div className="flex justify-center items-center gap-2 text-slate-400">
                <Sword size={16} />
                <span className="text-sm uppercase tracking-wider">
                    {isLogin ? 'Acceso al Reino' : 'Nuevo Juramento'}
                </span>
                <Sword size={16} className="scale-x-[-1]" />
            </div>
        </div>

        {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 text-sm rounded flex items-center gap-2 animate-pulse">
                <Skull size={16} />
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="relative group">
              <User className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={20} />
              <input 
                type="text" 
                name="username"
                placeholder="Nombre del Guerrero" 
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          )}

          <div className="relative group">
            <Mail className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={20} />
            <input 
              type="email" 
              name="email"
              placeholder="Correo Electrónico" 
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-amber-500 transition-colors" size={20} />
            <input 
              type="password" 
              name="password"
              placeholder="Palabra Secreta" 
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-amber-800 to-amber-700 hover:from-amber-700 hover:to-amber-600 text-white font-bold py-3 rounded border border-amber-600 transition-all transform hover:scale-[1.02] shadow-lg uppercase tracking-widest text-sm"
          >
            {isLogin ? 'Entrar al Valhalla' : 'Forjar Destino'}
          </button>
        </form>

        <div className="mt-6 text-center text-slate-400 text-sm">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-amber-500 hover:text-amber-400 font-semibold hover:underline decoration-amber-500/50 underline-offset-4 transition-all"
          >
            {isLogin ? '¿No tienes linaje? Regístrate' : '¿Ya eres un guerrero? Inicia Sesión'}
          </button>
        </div>
      </div>

      {/* --- MODAL DE ÉXITO (NUEVO) --- */}
      {showSuccessModal && userData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500 rounded-lg p-6 shadow-[0_0_60px_rgba(245,158,11,0.3)] transform animate-[fadeIn_0.3s_ease-out]">
            
            <div className="flex justify-center mb-4">
              <div className="bg-amber-500/20 p-3 rounded-full border border-amber-500">
                <CheckCircle className="text-amber-500 w-12 h-12" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center text-white mb-2 uppercase tracking-wide">
              ¡Bienvenido!
            </h2>
            
            <p className="text-center text-slate-400 mb-6">
              El Valhalla abre sus puertas, <span className="text-amber-400 font-bold">{userData.username}</span>.
              <br/>
              <span className="text-xs text-slate-500 mt-2 block">
                Energía: {userData.energy} | Oro: {userData.gold}
              </span>
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