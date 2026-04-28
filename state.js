// state.js
export const state = {
  data: [], // Datos cargados desde Supabase
  user: null, // Información del usuario actual (si hay login)
};

// Funciones para actualizar el estado
export function setData(newData) {
  state.data = newData;
}

export function setUser(user) {
  state.user = user;
}
