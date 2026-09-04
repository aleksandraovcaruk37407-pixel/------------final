 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
  import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
  import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "AIzaSyDGsjB5bhSL2keL0xTIOJib3ZB9HEqGyMs",
    authDomain: "auto-atelier-1486d.firebaseapp.com",
    databaseURL: "https://auto-atelier-1486d-default-rtdb.firebaseio.com",
    projectId: "auto-atelier-1486d",
    storageBucket: "auto-atelier-1486d.firebasestorage.app",
    messagingSenderId: "893898887206",
    appId: "1:893898887206:web:9f9e760e953fcd780556e7",
    measurementId: "G-ZWQH7LFT1M"
  };

  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);

  window.db = getDatabase(app);
  window.auth = getAuth(app);
  window.fbRef = ref;
  window.fbSet = set;
  window.get = get;
  window.child = child;

  signInAnonymously(window.auth)
    .then(() => {
      console.log("Подключено к Firebase!");
      
      // Автоматическая загрузка данных из Realtime Database при старте
      get(child(ref(window.db), 'atelier_data')).then((snapshot) => {
        if (snapshot.exists()) {
          window.updateCloudData(snapshot.val());
          console.log("Данные синхронизированы из облака!");
        }
      }).catch(err => console.error("Ошибка загрузки:", err));
    })
    .catch(err => console.error("Ошибка авторизации:", err));
