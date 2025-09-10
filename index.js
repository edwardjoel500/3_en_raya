// Importar Firebase con tu configuración
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  serverTimestamp, 
  runTransaction 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAOp_ljtC94ZMbAIgQ2X2YvyDOmJ3GZwkE",
  authDomain: "juego-mesa-cloud-ecc93.firebaseapp.com",
  projectId: "juego-mesa-cloud-ecc93",
  storageBucket: "juego-mesa-cloud-ecc93.firebasestorage.app",
  messagingSenderId: "1004317687180",
  appId: "1:1004317687180:web:926eb336f302e45712aaa9",
  measurementId: "G-4JZZ6ZHXLG"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referencias a elementos de la UI
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnRegister = document.getElementById("btnRegister");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const authMessage = document.getElementById("authMessage");
const userInfo = document.getElementById("userInfo");
const userEmailSpan = document.getElementById("userEmail");

const btnCrearPartida = document.getElementById("btnCrearPartida");
const btnUnirsePartida = document.getElementById("btnUnirsePartida");
const codigoPartidaInput = document.getElementById("codigoPartida");
const gameMessage = document.getElementById("gameMessage");
const infoPartida = document.getElementById("infoPartida");
const pidSpan = document.getElementById("pid");
const pestadoSpan = document.getElementById("pestado");
const pturnoSpan = document.getElementById("pturno");
const pxSpan = document.getElementById("px");
const poSpan = document.getElementById("po");
const pganadorSpan = document.getElementById("pganador");

// Estado local
let partidaRef = null;
let unsubPartida = null;

// Helper para mostrar mensajes
function showMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `message ${type}`;
  setTimeout(() => {
    element.textContent = "";
    element.className = "message";
  }, 5000);
}

// Helper para verificar si hay un usuario autenticado
function requireUser() {
  if (!auth.currentUser) {
    showMessage(gameMessage, "⚠ Debes iniciar sesión para realizar esta acción.", "error");
    return false;
  }
  return true;
}

// Autenticación - Registrar usuario
btnRegister.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  
  if (!email || !password) {
    showMessage(authMessage, "⚠ Por favor, completa todos los campos.", "error");
    return;
  }
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Guardar información adicional del usuario en Firestore
    await setDoc(doc(db, "usuarios", userCredential.user.uid), {
      email: userCredential.user.email,
      fechaRegistro: serverTimestamp()
    });
    
    showMessage(authMessage, "✅ Usuario registrado con éxito.", "success");
  } catch (error) {
    showMessage(authMessage, `❌ Error: ${error.message}`, "error");
  }
});

// Autenticación - Iniciar sesión
btnLogin.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  
  if (!email || !password) {
    showMessage(authMessage, "⚠ Por favor, completa todos los campos.", "error");
    return;
  }
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage(authMessage, "✅ Sesión iniciada con éxito.", "success");
  } catch (error) {
    showMessage(authMessage, `❌ Error: ${error.message}`, "error");
  }
});

// Autenticación - Cerrar sesión
btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showMessage(authMessage, "👋 Sesión cerrada.", "success");
  } catch (error) {
    showMessage(authMessage, `❌ Error: ${error.message}`, "error");
  }
});

// Crear una nueva partida
btnCrearPartida.addEventListener("click", async () => {
  if (!requireUser()) return;
  
  try {
    const user = auth.currentUser;
    const docRef = await addDoc(collection(db, "partidas"), {
      creadoEn: serverTimestamp(),
      estado: "waiting",
      turno: "X",
      tablero: ["", "", "", "", "", "", "", "", ""],
      jugadores: {
        X: { uid: user.uid, email: user.email },
        O: { uid: null, email: null }
      },
      ganador: null
    });

    showMessage(gameMessage, `🆕 Partida creada. ID: ${docRef.id} (compártelo para que otros se unan)`, "success");
    activarPartida(docRef.id);
  } catch (error) {
    showMessage(gameMessage, `❌ Error: ${error.message}`, "error");
  }
});

// Unirse a una partida existente
btnUnirsePartida.addEventListener("click", async () => {
  if (!requireUser()) return;
  
  const id = codigoPartidaInput.value.trim();
  if (!id) {
    showMessage(gameMessage, "⚠ Ingresa un ID de partida válido.", "error");
    return;
  }

  try {
    const partidaDoc = doc(db, "partidas", id);
    
    await runTransaction(db, async (transaction) => {
      const partidaSnapshot = await transaction.get(partidaDoc);
      
      if (!partidaSnapshot.exists()) {
        throw new Error("La partida no existe.");
      }
      
      const partidaData = partidaSnapshot.data();
      
      if (partidaData.estado !== "waiting") {
        throw new Error("La partida no está esperando jugadores.");
      }
      
      if (partidaData.jugadores.O.uid) {
        throw new Error("La partida ya tiene jugador O.");
      }
      
      // Actualizar la partida con el nuevo jugador
      transaction.update(partidaDoc, {
        "jugadores.O": { 
          uid: auth.currentUser.uid, 
          email: auth.currentUser.email 
        },
        estado: "playing"
      });
    });
    
    showMessage(gameMessage, "✅ Te has unido a la partida como O.", "success");
    activarPartida(id);
  } catch (error) {
    showMessage(gameMessage, `❌ Error: ${error.message}`, "error");
  }
});

// Activar la escucha de una partida
function activarPartida(id) {
  // Dejar de escuchar la partida anterior si existe
  if (unsubPartida) {
    unsubPartida();
  }
  
  partidaRef = doc(db, "partidas", id);
  
  // Escuchar cambios en la partida en tiempo real
  unsubPartida = onSnapshot(partidaRef, (snapshot) => {
    if (!snapshot.exists()) {
      infoPartida.style.display = "none";
      showMessage(gameMessage, "⚠ La partida ha sido eliminada.", "error");
      return;
    }
    
    const partida = snapshot.data();
    infoPartida.style.display = "block";
    
    // Actualizar la UI con la información de la partida
    pidSpan.textContent = snapshot.id;
    
    // Estado de la partida
    pestadoSpan.textContent = partida.estado;
    pestadoSpan.className = `status-badge status-${partida.estado}`;
    
    // Turno actual
    pturnoSpan.textContent = partida.turno;
    
    // Jugadores
    if (partida.jugadores.X.uid) {
      const esTu = auth.currentUser && auth.currentUser.uid === partida.jugadores.X.uid;
      pxSpan.textContent = `${partida.jugadores.X.email}${esTu ? " (Tú)" : ""}`;
      pxSpan.className = esTu ? "player-you" : "";
    }
    
    if (partida.jugadores.O && partida.jugadores.O.uid) {
      const esTu = auth.currentUser && auth.currentUser.uid === partida.jugadores.O.uid;
      poSpan.textContent = `${partida.jugadores.O.email}${esTu ? " (Tú)" : ""}`;
      poSpan.className = esTu ? "player-you" : "";
    }
    
    // Ganador
    pganadorSpan.textContent = partida.ganador || "—";
  }, (error) => {
    showMessage(gameMessage, `❌ Error al escuchar la partida: ${error.message}`, "error");
  });
}

// Observador de estado de autenticación
onAuthStateChanged(auth, (user) => {
  if (user) {
    userInfo.style.display = "block";
    userEmailSpan.textContent = user.email;
    emailInput.value = "";
    passwordInput.value = "";
  } else {
    userInfo.style.display = "none";
    
    // Dejar de escuchar la partida si el usuario cierra sesión
    if (unsubPartida) {
      unsubPartida();
      unsubPartida = null;
    }
    infoPartida.style.display = "none";
  }
});