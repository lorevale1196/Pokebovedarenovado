
// ==========================================
// POKEBÓVEDA - PANEL DE ADMINISTRACIÓN
// ==========================================

// Credenciales originales de prueba.
// IMPORTANTE: no son una protección segura para producción.
const USUARIO_CORRECTO = "admin";
const PASSWORD_CORRECTA = "1234";

// ELEMENTOS DEL DOM
const formLogin = document.getElementById("formLogin");
const errorLogin = document.getElementById("errorLogin");
const seccionLogin = document.getElementById("seccionLogin");
const seccionPanel = document.getElementById("seccionPanel");
const listaSolicitudes = document.getElementById("listaSolicitudes");
const btnCerrarSesion = document.getElementById("btnCerrarSesion");

// ==========================================
// INICIAR SESIÓN
// ==========================================

if (formLogin) {

    formLogin.addEventListener("submit", event => {

        event.preventDefault();

        const usuario = document.getElementById("usuario").value.trim();
        const password = document.getElementById("password").value;

        if (
            usuario === USUARIO_CORRECTO &&
            password === PASSWORD_CORRECTA
        ) {

            sessionStorage.setItem("adminAutenticado", "true");

            if (errorLogin) {
                errorLogin.style.display = "none";
            }

            mostrarPanel();

        } else {

            if (errorLogin) {

                errorLogin.textContent =
                    "Usuario o contraseña incorrectos ❌";

                errorLogin.style.display = "block";

            }

        }

    });

}

// ==========================================
// MOSTRAR PANEL
// ==========================================

function mostrarPanel() {

    if (seccionLogin) {
        seccionLogin.style.display = "none";
    }

    if (seccionPanel) {
        seccionPanel.style.display = "block";
    }

    cargarSolicitudes();

}

// ==========================================
// OBTENER SOLICITUDES
// ==========================================

function obtenerSolicitudes() {

    try {

        const datos = localStorage.getItem("solicitudesPokemon");

        if (!datos) return [];

        const solicitudes = JSON.parse(datos);

        return Array.isArray(solicitudes) ? solicitudes : [];

    } catch (error) {

        console.error("Error leyendo solicitudes:", error);

        return [];

    }

}

// ==========================================
// MOSTRAR SOLICITUDES
// ==========================================

function cargarSolicitudes() {

    if (!listaSolicitudes) return;

    const solicitudes = obtenerSolicitudes();

    listaSolicitudes.innerHTML = "";

    if (solicitudes.length === 0) {

        const mensaje = document.createElement("p");

        mensaje.textContent =
            "No hay solicitudes registradas aún. ✨";

        mensaje.style.cssText =
            "font-size:18px;color:#8e7dbe;";

        listaSolicitudes.appendChild(mensaje);

        return;

    }

    solicitudes.forEach((solicitud, index) => {

        const tarjeta = document.createElement("div");

        tarjeta.classList.add("tarjeta-solicitud");

        const titulo = document.createElement("h3");
        titulo.textContent =
            `📩 Solicitud de: ${solicitud.nombre || "Sin nombre"}`;

        const correo = document.createElement("p");
        correo.textContent =
            `Correo: ${solicitud.email || "No indicado"}`;

        const pokemon = document.createElement("p");
        pokemon.textContent =
            `Pokémon deseado: ${solicitud.pokemon || "No indicado"}`;

        const detalles = document.createElement("p");
        detalles.textContent =
            `Detalles: ${solicitud.mensaje || "Sin detalles"}`;

        const fecha = document.createElement("small");
        fecha.textContent =
            `📅 Fecha: ${solicitud.fecha || "No disponible"}`;

        const botonEliminar = document.createElement("button");

        botonEliminar.classList.add("btn-eliminar");
        botonEliminar.textContent = "Eliminar 🗑️";

        botonEliminar.addEventListener("click", () => {

            eliminarSolicitud(index);

        });

        tarjeta.append(
            titulo,
            correo,
            pokemon,
            detalles,
            fecha,
            botonEliminar
        );

        listaSolicitudes.appendChild(tarjeta);

    });

}

// ==========================================
// ELIMINAR SOLICITUD
// ==========================================

function eliminarSolicitud(index) {

    const solicitudes = obtenerSolicitudes();

    if (index < 0 || index >= solicitudes.length) return;

    const confirmar = confirm(
        "¿Estás segura de que quieres eliminar esta solicitud?"
    );

    if (!confirmar) return;

    solicitudes.splice(index, 1);

    try {

        localStorage.setItem(
            "solicitudesPokemon",
            JSON.stringify(solicitudes)
        );

        cargarSolicitudes();

    } catch (error) {

        console.error("No se pudo eliminar la solicitud:", error);

        alert("No se pudo actualizar la lista.");

    }

}

// ==========================================
// CERRAR SESIÓN
// ==========================================

if (btnCerrarSesion) {

    btnCerrarSesion.addEventListener("click", () => {

        sessionStorage.removeItem("adminAutenticado");

        if (seccionPanel) {
            seccionPanel.style.display = "none";
        }

        if (seccionLogin) {
            seccionLogin.style.display = "block";
        }

        if (formLogin) {
            formLogin.reset();
        }

    });

}

// ==========================================
// RECORDAR SESIÓN ACTIVA
// ==========================================

if (sessionStorage.getItem("adminAutenticado") === "true") {

    mostrarPanel();

}
