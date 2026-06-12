import React, { useState } from 'react';
import { User, Lock, Mail, Sword, Skull, CheckCircle } from 'lucide-react';
import { apiUrl } from '../constants/api';
import { signInWithGoogle, signOutFirebase } from '../lib/firebase';
import { LogIn } from 'lucide-react';

// IMAGENES
import loginBg from '../assets/backgrounds/fondo_login_1.png';
import registerBg from '../assets/backgrounds/fondo_registro_1.png';

// Recibimos la prop 'onLoginSuccess' desde App.jsx para notificar el exito
const Auth = ({ onLoginSuccess }) => {
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
    const endpoint = isLogin ? apiUrl('/api/login') : apiUrl('/api/register');

    // Creamos un objeto 'payload' donde forzamos el email a minusculas.
    const payload = {
      ...formData,
      email: formData.email.toLowerCase()
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error desconocido');
      }

      // Guardamos en LocalStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Guardamos datos para el modal
      setUserData(data.user);
      setShowSuccessModal(true);

      // Esperamos 2 segundos y notificamos a App.jsx
      setTimeout(() => {
        if (onLoginSuccess) onLoginSuccess(data.user, !isLogin);
      }, 2000);

    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  // Esta funcion permite saltar la espera si el usuario hace clic en el boton del modal
  const handleEnterGame = () => {
    setShowSuccessModal(false);
    // Pasamos los mismos datos: usuario y si fue registro (!isLogin)
    if (onLoginSuccess && userData) onLoginSuccess(userData, !isLogin);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-black">

      {/* IMAGEN DE REGISTRO (Fondo) */}
      <img
        src={registerBg}
        alt="Fondo Registro"
        className={bsolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out }
      />

      {/* IMAGEN DE LOGIN (Frente) */}
      <img
        src={loginBg}
        alt="Fondo Login"
        className={bsolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out }
      />

      {/* Overlay Oscuro */}
      <div className="absolute inset-0 bg-black/30 transition-colors duration-700 pointer-events-none" />

      {/* Cuadro Flotante del Formulario */}
      <div className={
          relative z-10 w-full max-w-md 
          bg-slate-900/60 backdrop-blur-md 
          border-2 border-amber-500/50 
          p-8 rounded-lg 
          shadow-[0_0_60px_rgba(180,83,9,0.3)] 
          transition-all duration-500 
          animate-float  
          
      }>

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
          {/* Animacion de entrada para el nombre (Solo en registro) */}
          <div className={	ransition-all duration-500 ease-in-out overflow-hidden }>
            <div className="relative group">
              <User className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={20} />
              <input
                type="text"
                name="username"
                placeholder="Nombre del Guerrero"
                onChange={handleChange}
                className="w-full bg-black/40 border border-slate-600 rounded py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="relative group">
            <Mail className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={20} />
            <input
              type="email"
              name="email"
              placeholder="Correo Electronico"
              onChange={handleChange}
              className="w-full bg-black/40 border border-slate-600 rounded py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-500"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={20} />
            <input
              type="password"
              name="password"
              placeholder="Palabra Secreta"
              onChange={handleChange}
              className="w-full bg-black/40 border border-slate-600 rounded py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-700/90 to-amber-600/90 hover:from-amber-600 hover:to-amber-500 text-white font-bold py-3 rounded border border-amber-500/50 transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg uppercase tracking-widest text-sm"
          >
            {isLogin ? 'Entrar al Valhalla' : 'Forjar Destino'}
          </button>

          {/* Divider */}
          <div className="relative flex items-center my-6">
            <div className="flex-grow border-t border-slate-700" />
            <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase tracking-widest">o con Google</span>
            <div className="flex-grow border-t border-slate-700" />
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={async () => {
              try {
                const result = await signInWithGoogle();
                setShowSuccessModal(true);
                setUserData(result.backendUser);
                setTimeout(() => {
                  if (onLoginSuccess) onLoginSuccess(result.backendUser, false);
                }, 1500);
              } catch (err) {
                setError('Error con Google: ' + err.message);
              }
            }}
            className="w-full bg-slate-800/80 hover:bg-slate-700 text-white font-semibold py-3 rounded border border-slate-600 transition-all flex items-center justify-center gap-3 shadow-md"
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.483,8c-6.958,0-12.6-5.645-12.6-12.6s5.642-12.6,12.6-12.6c3.089,0,5.933,1.127,8.136,3.009l5.983-5.983C35.255,7.465,29.853,5.333,24,5.333c-10.542,0-19.108,8.567-19.108,19.108S13.458,43.549,24,43.549s19.108-8.567,19.108-19.108C43.108,21.423,43.611,20.083z"/>
              <path fill="#FF3D34" d="M6.306,14.691l6.571,4.819C14.655,10.389,18.962,7.333,24,7.333c5.455,0,10.42,2.13,14.136,5.765l-6.024,5.983C30.219,17.202,27.302,16,24,16c-5.862,0-10.909,3.389-13.121,8.368L6.306,14.691z"/>
              <path fill="#4CAF50" d="M24,43.549c10.276,0,19.021-7.815,19.021-19.108c0-1.573-0.153-3.114-0.44-4.628l-0.006,0.003l-6.658,6.239C34.626,32.778,29.729,36,24,36c-5.551,0-10.387-3.182-12.967-7.892l-6.489,4.95C8.232,35.483,15.418,43.549,24,43.549z"/>
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.959,2.717-2.606,5.117-4.746,6.962l6.658,6.239C39.524,38.13,42,32.406,42,26.441c0-0.771-0.085-1.524-0.235-2.248L43.611,20.083z"/>
            </svg>
            {isLogin ? 'Continuar con Google' : 'Registrarse con Google'}
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
              <div className="bg-amber-500/20 p-3 rounded-full border border-amber-500 animate-pulse">
                <CheckCircle className="text-amber-500 w-12 h-12" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-white mb-2 uppercase tracking-wide">
              Bienvenido!
            </h2>
            <p className="text-center text-slate-300 mb-6">
              El Valhalla abre sus puertas, <span className="text-amber-400 font-bold">{userData.username}</span>.
            </p>
            <button
              onClick={handleEnterGame}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded uppercase tracking-widest transition-colors shadow-lg border border-amber-400 hover:shadow-amber-500/50"
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

