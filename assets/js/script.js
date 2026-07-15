import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// FIREBASE CONFIG
const firebaseConfig = {

    apiKey: "AIzaSyBLUb2x7siUdDBC41DYebd9iTtByRQaWPE",

    authDomain: "badgeuse-airliquide.firebaseapp.com",

    projectId: "badgeuse-airliquide",

    storageBucket: "badgeuse-airliquide.firebasestorage.app",

    messagingSenderId: "201287681665",

    appId: "1:201287681665:web:c7fc578071625eefdeef80"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);


// ELEMENTS
const operator = document.getElementById("operator");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const snapBtn = document.getElementById("snapBtn");
const tableBody = document.getElementById("tableBody");
const managerView = document.getElementById("managerView");
const deleteAllBtn = document.getElementById("deleteAllBtn");

const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImg");

// MANAGER DEJA CONNECTE
const managerLogged =
    sessionStorage.getItem("manager") === "true";


// DETECTION TABLETTE ANDROID
const isAndroid =
    /Android/i.test(navigator.userAgent);

const isTablet =
    window.innerWidth >= 800;

const isAuthorizedDevice =
    isAndroid && isTablet;


// SI PAS TABLETTE ET PAS MANAGER
if(!isAuthorizedDevice && !managerLogged){

    // CACHE TOUT
    document.body.innerHTML = `
        <div style="
            height:100vh;
            display:flex;
            justify-content:center;
            align-items:center;
            flex-direction:column;
            font-family:Arial;
            padding:20px;
            text-align:center;
        ">

            <h2>
                Accès badgeuse interdit
            </h2>

            <button id="managerAccessBtn"
            style="
                padding:15px 25px;
                border:none;
                border-radius:8px;
                background:#1e293b;
                color:white;
                font-size:18px;
                margin-top:20px;
            ">
                Accès manager
            </button>

        </div>
    `;

    // BOUTON MANAGER
    document
    .getElementById("managerAccessBtn")
    .addEventListener("click",()=>{

        const code = prompt("Code manager");

        if(code === "1731"){

            sessionStorage.setItem("manager","true");

            location.reload();

        }else{

            alert("Code incorrect");
        }
    });

    throw new Error("Accès bloqué");
}


let currentType = "";
let stream = null;
let isSaving = false;


// CAMERA
window.startCamera = async function(type){

    currentType = type;

    try{

        stream = await navigator.mediaDevices.getUserMedia({
    video:{
        facingMode: {
            ideal: "environment"
        }
    }
});

        video.srcObject = stream;

        video.hidden = false;

        snapBtn.hidden = false;

    }catch(err){

        alert("Impossible d'accéder à la caméra");

        console.error(err);
    }
};


// PHOTO + FIRESTORE
window.takePhoto = async function(){

    // BLOQUE LES DOUBLE CLICS
    if(isSaving) return;

    isSaving = true;

    snapBtn.disabled = true;

    snapBtn.innerText = "Enregistrement...";

    try{

        const ctx = canvas.getContext("2d");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video,0,0);

        const image = canvas.toDataURL("image/jpeg",0.8);

        const now = new Date();

        const dateStr = now.toISOString().split("T")[0];

        // RECUPERATION DES POINTAGES
        const snapshot = await getDocs(collection(db,"pointages"));

        let pointages = [];

        snapshot.forEach(docSnap => {

            const data = docSnap.data();

            if(data.name === operator.value){

                pointages.push(data);
            }
        });

        // TRI
        pointages.sort((a,b)=>b.timestamp-a.timestamp);

        // DERNIER POINTAGE
        const lastPointage = pointages[0];

        // DOUBLE ARRIVEE INTERDITE
        if(
            currentType === "arrivee" &&
            lastPointage &&
            lastPointage.type === "arrivee"
        ){

            alert("Cet opérateur est déjà en arrivée.");

            stopCamera();

            return;
        }

        // DEPART SANS ARRIVEE INTERDIT
        if(
            currentType === "depart" &&
            (
                !lastPointage ||
                lastPointage.type === "depart"
            )
        ){

            alert("Impossible de faire un départ sans arrivée.");

            stopCamera();

            return;
        }

        // FERME LA CAMERA IMMEDIATEMENT
        stopCamera();

        // ENREGISTREMENT
        await addDoc(collection(db,"pointages"),{

            name: operator.value,

            type: currentType,

            image: image,

            time: now.toLocaleTimeString(),

            date: dateStr,

            timestamp: Date.now()
        });

        alert("Pointage enregistré");

        updateTable();

    }catch(err){

        console.error(err);

        alert("Erreur enregistrement");

    }finally{

        isSaving = false;

        snapBtn.disabled = false;

        snapBtn.innerText = "📸 Prendre la photo";
    }
};


// STOP CAMERA
function stopCamera(){

    if(stream){

        stream.getTracks().forEach(track => track.stop());
    }

    video.hidden = true;

    snapBtn.hidden = true;
}


// TABLE
async function updateTable() {

    tableBody.innerHTML = "";

    const snapshot = await getDocs(collection(db, "pointages"));

    let pointages = [];

    snapshot.forEach(docSnap => {

        pointages.push({
            id: docSnap.id,
            ...docSnap.data()
        });
    });

    pointages.sort((a, b) => a.timestamp - b.timestamp);

    let lignes = [];

    pointages.forEach(p => {

        if (p.type === "arrivee") {

            lignes.push({
                name: p.name,
                date: p.date,
                arrivee: p,
                depart: null
            });

        } else if (p.type === "depart") {

            let ligne = [...lignes]
                .reverse()
                .find(l =>
                    l.name === p.name &&
                    l.depart === null
                );

            if (ligne) {
                ligne.depart = p;
            }
        }
    });

    lignes.reverse().forEach(r => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
        <td>
            ${r.name}<br>
            ${r.date}
        </td>

        <td>
            ${
                r.arrivee ?
                `<img src="${r.arrivee.image}"
                onclick="openImage('${r.arrivee.image}')">
                <br>
                ${r.arrivee.time}`
                : ""
            }
        </td>

        <td>
            ${
                r.depart ?
                `<img src="${r.depart.image}"
                onclick="openImage('${r.depart.image}')">
                <br>
                ${r.depart.time}`
                : "⏳ En cours"
            }
        </td>

        <td>
            ${calculerDuree(r.arrivee, r.depart)}
        </td>

        <td>
            <button onclick="deleteEntry(
                '${r.arrivee?.id || ""}',
                '${r.depart?.id || ""}'
            )">
            ❌
            </button>
        </td>
        `;

        tableBody.appendChild(tr);
    });
}


// DUREE
function calculerDuree(arrivee,depart){

    if(!arrivee || !depart){

        return "⏳ En cours";
    }

    const diff = depart.timestamp - arrivee.timestamp;

    const heures = Math.floor(diff / (1000*60*60));

    const minutes = Math.floor(
        (diff % (1000*60*60)) / (1000*60)
    );

    return `${heures}h ${minutes}min`;
}


// DELETE
window.deleteEntry = async function(arriveeId,departId){

    if(!confirm("Supprimer cette ligne ?")) return;

    try{

        if(arriveeId){

            await deleteDoc(doc(db,"pointages",arriveeId));
        }

        if(departId){

            await deleteDoc(doc(db,"pointages",departId));
        }

        updateTable();

    }catch(err){

        console.error(err);

        alert("Erreur suppression");
    }
};

window.deleteOldEntries = async function () {

    const texte = prompt(
        'Tapez "SUPPRIMER" pour effacer les pointages de plus de 7 jours.'
    );

    if (texte !== "SUPPRIMER") {
        alert("Suppression annulée.");
        return;
    }

    try {

        const snapshot = await getDocs(collection(db, "pointages"));

        // Date limite : il y a 7 jours
        const limite = Date.now() - (7 * 24 * 60 * 60 * 1000);

        const promises = [];

        snapshot.forEach((docSnap) => {

            const data = docSnap.data();

            if (data.timestamp <= limite) {
                promises.push(
                    deleteDoc(doc(db, "pointages", docSnap.id))
                );
            }

        });

        await Promise.all(promises);

        alert("Les pointages de plus de 7 jours ont été supprimés.");

        updateTable();

    } catch (err) {

        console.error(err);

        alert("Erreur lors de la suppression.");
    }
};


// MANAGER
window.unlockManager = function(){

    if(managerView.style.display === "block"){

        managerView.style.display = "none";

        return;
    }

    const code = prompt("Code manager");

    if(code === "1731"){

        managerView.style.display = "block";

        updateTable();

    }else{

        alert("Code incorrect");
    }
};


// IMAGE MODAL
window.openImage = function(src){

    modal.style.display = "flex";

    modalImg.src = src;
};

modal.onclick = function(){

    modal.style.display = "none";
};

document
    .getElementById("deleteAllBtn")
    .addEventListener("click", window.deleteAllEntries);
