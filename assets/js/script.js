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

const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImg");


let currentType = "";
let stream = null;


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

    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video,0,0);

    const image = canvas.toDataURL("image/jpeg",0.8);

    const now = new Date();

    const dateStr = now.toISOString().split("T")[0];

    try{

        // RECUPERATION DES POINTAGES
        const snapshot = await getDocs(collection(db,"pointages"));

        let pointages = [];

        snapshot.forEach(docSnap => {

            const data = docSnap.data();

            // seulement cet opérateur
            if(data.name === operator.value){

                pointages.push(data);
            }
        });

        // TRI PAR DATE
        pointages.sort((a,b)=>b.timestamp-a.timestamp);

        // DERNIER POINTAGE
        const lastPointage = pointages[0];

        // REGLES METIER

        // Double arrivée interdite
        if(
            currentType === "arrivee" &&
            lastPointage &&
            lastPointage.type === "arrivee"
        ){

            alert("Cet opérateur est déjà en arrivée.");

            stopCamera();

            return;
        }

        // Double départ interdit
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

        stopCamera();

        updateTable();

    }catch(err){

        console.error(err);

        alert("Erreur enregistrement");
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
