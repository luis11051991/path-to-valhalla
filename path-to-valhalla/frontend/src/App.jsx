import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import RaceSelection from './components/RaceSelection';

function App() {
  const [user, setUser] = useState(null);
  const [hasRace, setHasRace] = useState(false);

  // Al cargar, revisamos si hay sesión guardada
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      // Aquí validamos si el usuario ya tiene raza (por ahora simulamos que NO para ver la pantalla)
      // En el futuro, el backend nos dirá: parsedUser.race_selected = true/false
      if (parsedUser.race && parsedUser.race !== 'human') { 
         // NOTA: Como la DB pone 'human' por defecto, necesitaremos una flag extra 
         // o asumir que si es nivel 1 y exp 0, debe confirmar raza.
         // Por ahora, lo forzamos a false para que veas tu nueva pantalla.
         setHasRace(false); 
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setHasRace(false); // Al loguear, vamos a selección de raza
  };

  const handleRaceSelect = (raceData) => {
    console.log("Raza guardada:", raceData);
    setHasRace(true); // ¡Listo! Iríamos al juego principal
    // Aquí haríamos un fetch al backend para guardar la raza en la DB
  };

  return (
    <div className="w-full h-full font-sans text-slate-100">
      {!user ? (
        // Si no hay usuario, mostramos Login
        // Pasamos una función para saber cuando logueó exitosamente
        <Auth onLoginSuccess={handleLoginSuccess} /> 
      ) : !hasRace ? (
        // Si hay usuario pero no ha confirmado raza, mostramos Selección
        <RaceSelection onRaceSelect={handleRaceSelect} />
      ) : (
        // Si ya tiene todo, mostramos el JUEGO (Dashboard)
        <div className="flex items-center justify-center h-screen bg-slate-900">
          <h1 className="text-4xl text-amber-500">BIENVENIDO AL JUEGO {user.username}</h1>
        </div>
      )}
    </div>
  );
}

export default App;