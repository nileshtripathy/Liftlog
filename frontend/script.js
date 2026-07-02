/* ==========================================================
   LiftLog Pro
   Setup + DOM + API + Utilities
========================================================== */

/* ------------------------------
   Backend URL
------------------------------ */

const BACKEND_URL = "http://localhost:3000";

/* ------------------------------
   Global State
------------------------------ */

let workouts = [];

let editingWorkoutId = null;

/* ------------------------------
   DOM Elements
------------------------------ */

const workoutForm = document.getElementById("workoutForm");

const workoutList = document.getElementById("workoutList");

const loading = document.getElementById("loading");

const errorState = document.getElementById("error");

const emptyState = document.getElementById("emptyState");

const refreshBtn = document.getElementById("refreshBtn");

const retryBtn = document.getElementById("retryBtn");

const searchInput = document.getElementById("searchWorkout");

const themeToggle = document.getElementById("themeToggle");

const scrollToFormBtn = document.getElementById("scrollToForm");

const emptyAddBtn = document.getElementById("emptyAddBtn");

/* Dashboard */

const totalWorkouts = document.getElementById("totalWorkouts");

const totalWeight = document.getElementById("totalWeight");

const todayWorkout = document.getElementById("todayWorkout");

const streak = document.getElementById("streak");

/* Modal */

const editModal = document.getElementById("editModal");

const editForm = document.getElementById("editForm");

const closeModalBtn = document.getElementById("closeModal");

const cancelEditBtn = document.getElementById("cancelEdit");

/* Toast */

const toast = document.getElementById("toast");

const toastTitle = document.getElementById("toastTitle");

const toastMessage = document.getElementById("toastMessage");


/* ==========================================================
   Loading
========================================================== */

function showLoading(){

    loading.classList.remove("hidden");

}

function hideLoading(){

    loading.classList.add("hidden");

}


/* ==========================================================
   Error
========================================================== */

function showError(){

    errorState.classList.remove("hidden");

}

function hideError(){

    errorState.classList.add("hidden");

}


/* ==========================================================
   Empty State
========================================================== */

function showEmpty(){

    emptyState.classList.remove("hidden");

}

function hideEmpty(){

    emptyState.classList.add("hidden");

}


/* ==========================================================
   Toast
========================================================== */

let toastTimeout;

function showToast(title,message){

    toastTitle.textContent = title;

    toastMessage.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(()=>{

        toast.classList.remove("show");

    },3000);

}


/* ==========================================================
   Dark Mode
========================================================== */

const savedTheme = localStorage.getItem("theme");

if(savedTheme==="dark"){

    document.body.classList.add("dark");

    themeToggle.innerHTML =
        '<i class="fa-solid fa-sun"></i>';

}

themeToggle.addEventListener("click",()=>{

    document.body.classList.toggle("dark");

    const dark =
        document.body.classList.contains("dark");

    if(dark){

        localStorage.setItem("theme","dark");

        themeToggle.innerHTML =
        '<i class="fa-solid fa-sun"></i>';

    }

    else{

        localStorage.setItem("theme","light");

        themeToggle.innerHTML =
        '<i class="fa-solid fa-moon"></i>';

    }

});


/* ==========================================================
   Scroll to Form
========================================================== */

scrollToFormBtn.addEventListener("click",()=>{

    document
        .getElementById("addWorkoutSection")
        .scrollIntoView({

            behavior:"smooth"

        });

});

if(emptyAddBtn){

    emptyAddBtn.addEventListener("click",()=>{

        document
        .getElementById("addWorkoutSection")
        .scrollIntoView({

            behavior:"smooth"

        });

    });

}


/* ==========================================================
   Utilities
========================================================== */

function formatDate(date){

    return new Date(date).toLocaleDateString(

        "en-IN",

        {

            day:"numeric",

            month:"short",

            year:"numeric"

        }

    );

}


function todayString(){

    return new Date()

        .toISOString()

        .split("T")[0];

}


/* ==========================================================
   Generic API Helper
========================================================== */

async function api(endpoint,options={}){

    const response = await fetch(

        `${BACKEND_URL}${endpoint}`,

        {

            headers:{

                "Content-Type":"application/json"

            },

            ...options

        }

    );

    if(!response.ok){

        throw new Error("Request Failed");

    }

    if(response.status===204){

        return null;

    }

    return await response.json();

}

/* ==========================================================
   LOAD WORKOUTS
========================================================== */

async function loadWorkouts(){

    showLoading();
    hideError();

    try{

        workouts = await api("/workouts");

        hideLoading();

        updateDashboard();

        renderWorkouts(workouts);

    }

    catch(error){

        console.error(error);

        hideLoading();

        showError();

    }

}


/* ==========================================================
   DASHBOARD STATISTICS
========================================================== */

function updateDashboard(){

    totalWorkouts.textContent = workouts.length;

    const weight = workouts.reduce((sum,workout)=>{

        return sum + (Number(workout.weight) * Number(workout.reps));

    },0);

    totalWeight.textContent = `${weight} kg`;

    const today = todayString();

    const todayCount = workouts.filter(workout=>{

        return workout.date===today;

    }).length;

    todayWorkout.textContent = todayCount;

    streak.textContent = calculateStreak()+" Days";

}


function calculateStreak(){

    if(workouts.length===0) return 0;

    const uniqueDates = [

        ...new Set(

            workouts.map(workout=>workout.date)

        )

    ].sort().reverse();

    let streakCount = 0;

    let current = new Date();

    while(true){

        const date = current.toISOString().split("T")[0];

        if(uniqueDates.includes(date)){

            streakCount++;

            current.setDate(current.getDate()-1);

        }

        else{

            break;

        }

    }

    return streakCount;

}


/* ==========================================================
   RENDER WORKOUTS
========================================================== */

function renderWorkouts(data){

    workoutList.innerHTML="";

    if(data.length===0){

        showEmpty();

        return;

    }

    hideEmpty();

    data.forEach(workout=>{

        const card = document.createElement("div");

        card.className="workout-card";

        card.innerHTML=`

        <div class="workout-header">

            <div>

                <h3>

                    🏋 ${workout.exercise}

                </h3>

                <span>

                    Logged Workout

                </span>

            </div>

            <div class="workout-badge">

                ${workout.weight} kg

            </div>

        </div>

        <div class="workout-body">

            <div class="info">

                <i class="fa-solid fa-weight-hanging"></i>

                <span>Weight</span>

                <strong>${workout.weight} kg</strong>

            </div>

            <div class="info">

                <i class="fa-solid fa-repeat"></i>

                <span>Reps</span>

                <strong>${workout.reps}</strong>

            </div>

            <div class="info">

                <i class="fa-solid fa-calendar"></i>

                <span>Date</span>

                <strong>${formatDate(workout.date)}</strong>

            </div>

        </div>

        <div class="card-footer">

            <button

                class="edit-btn"

                onclick="openEditModal(${workout.id})"

            >

                <i class="fa-solid fa-pen"></i>

                Edit

            </button>

            <button

                class="delete-btn"

                onclick="deleteWorkout(${workout.id})"

            >

                <i class="fa-solid fa-trash"></i>

                Delete

            </button>

        </div>

        `;

        workoutList.appendChild(card);

    });

}


/* ==========================================================
   CREATE WORKOUT
========================================================== */

workoutForm.addEventListener("submit",async(event)=>{

    event.preventDefault();

    const newWorkout={

        exercise:

            document
            .getElementById("exercise")
            .value
            .trim(),

        weight:

            Number(
                document
                .getElementById("weight")
                .value
            ),

        reps:

            Number(
                document
                .getElementById("reps")
                .value
            ),

        date:

            document
            .getElementById("date")
            .value

    };

    try{

        await api("/workouts",{

            method:"POST",

            body:JSON.stringify(newWorkout)

        });

        workoutForm.reset();

        showToast(

            "Workout Added",

            `${newWorkout.exercise} saved successfully.`

        );

        loadWorkouts();

    }

    catch(error){

        console.error(error);

        showToast(

            "Error",

            "Unable to add workout."

        );

    }

});


/* ==========================================================
   DELETE WORKOUT
========================================================== */

async function deleteWorkout(id){

    const confirmed = confirm(

        "Delete this workout?"

    );

    if(!confirmed) return;

    try{

        await api(`/workouts/${id}`,{

            method:"DELETE"

        });

        showToast(

            "Workout Deleted",

            "Entry removed successfully."

        );

        loadWorkouts();

    }

    catch(error){

        console.error(error);

        showToast(

            "Error",

            "Delete failed."

        );

    }

}


/* ==========================================================
   REFRESH BUTTON
========================================================== */

refreshBtn.addEventListener("click",loadWorkouts);

retryBtn.addEventListener("click",loadWorkouts);

/* ==========================================================
   EDIT MODAL
========================================================== */

function openEditModal(id){

    const workout = workouts.find(w => w.id === id);

    if(!workout) return;

    editingWorkoutId = id;

    document.getElementById("editExercise").value = workout.exercise;
    document.getElementById("editWeight").value = workout.weight;
    document.getElementById("editReps").value = workout.reps;
    document.getElementById("editDate").value = workout.date;

    editModal.classList.remove("hidden");
    editModal.classList.add("show");

}

function closeModal(){

    editModal.classList.remove("show");

    setTimeout(()=>{

        editModal.classList.add("hidden");

    },250);

}

closeModalBtn.addEventListener("click",closeModal);

cancelEditBtn.addEventListener("click",closeModal);

window.addEventListener("click",(event)=>{

    if(event.target.classList.contains("modal-overlay")){

        closeModal();

    }

});


/* ==========================================================
   UPDATE WORKOUT
========================================================== */

editForm.addEventListener("submit",async(event)=>{

    event.preventDefault();

    const updatedWorkout={

        exercise:
            document.getElementById("editExercise").value.trim(),

        weight:
            Number(document.getElementById("editWeight").value),

        reps:
            Number(document.getElementById("editReps").value),

        date:
            document.getElementById("editDate").value

    };

    try{

        await api(`/workouts/${editingWorkoutId}`,{

            method:"PUT",

            body:JSON.stringify(updatedWorkout)

        });

        closeModal();

        showToast(

            "Workout Updated",

            `${updatedWorkout.exercise} updated successfully.`

        );

        loadWorkouts();

    }

    catch(error){

        console.error(error);

        showToast(

            "Error",

            "Unable to update workout."

        );

    }

});


/* ==========================================================
   LIVE SEARCH
========================================================== */

searchInput.addEventListener("input",(event)=>{

    const value = event.target.value
        .trim()
        .toLowerCase();

    if(value===""){

        renderWorkouts(workouts);

        return;

    }

    const filtered = workouts.filter(workout=>{

        return workout.exercise
            .toLowerCase()
            .includes(value);

    });

    renderWorkouts(filtered);

});


/* ==========================================================
   KEYBOARD SHORTCUTS
========================================================== */

document.addEventListener("keydown",(event)=>{

    if(event.key==="Escape"){

        closeModal();

    }

});


/* ==========================================================
   PAGE INITIALIZATION
========================================================== */

window.addEventListener("DOMContentLoaded",()=>{

    document.getElementById("date").value = todayString();

    loadWorkouts();

});
