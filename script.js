
/* ============================================
   POKÉBÓVEDA - SCRIPT PRINCIPAL
   Catálogo + precios + buscador + carrito
   Pokebot + administración + solicitudes
   ============================================ */

"use strict";

/* ============================================
   CONFIGURACIÓN
   ============================================ */

const API_BASE = "https://api.tcgdex.net/v2/en";

const MAX_CARTAS = 180;
const MAX_COLECCIONES = 15;

const CLAVE_ADMIN = "Pokeboveda2026";
const CLAVE_SOLICITUDES = "solicitudesPokemon";

const CLAVE_CACHE_PRECIOS = "pokeboveda_precios_v1";
const CLAVE_TASA_CAMBIO = "pokeboveda_tasa_usd_cop";

const DURACION_CACHE = 12 * 60 * 60 * 1000;

let todasLasCartas = [];
let listaPokemon = [];
let cargandoCartas = false;
let tasaUSD_COP = null;

/* ============================================
   ELEMENTOS
   ============================================ */

const buscador = document.getElementById("buscarPokemon");
const contenedorCartas = document.getElementById("contenedorCartas");
const formSolicitud = document.getElementById("formSolicitud");

/* ============================================
   UTILIDADES
   ============================================ */

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

async function obtenerDatos(url) {
    const respuesta = await fetch(url);

    if (!respuesta.ok) {
        throw new Error(`Error HTTP ${respuesta.status}`);
    }

    return respuesta.json();
}

function mostrarMensajeCatalogo(mensaje, tipo = "info") {
    if (!contenedorCartas) return;

    contenedorCartas.innerHTML = "";

    const elemento = document.createElement("p");
    elemento.className = `mensaje-catalogo ${tipo}`;
    elemento.textContent = mensaje;

    contenedorCartas.appendChild(elemento);
}

function obtenerSolicitudes() {
    try {
        const datos = JSON.parse(
            localStorage.getItem(CLAVE_SOLICITUDES) || "[]"
        );

        return Array.isArray(datos) ? datos : [];

    } catch (error) {
        console.error("Error leyendo solicitudes:", error);
        return [];
    }
}

function guardarSolicitudes(solicitudes) {
    localStorage.setItem(
        CLAVE_SOLICITUDES,
        JSON.stringify(solicitudes)
    );
}

/* ============================================
   EXCLUIR NEO REVELATION
   ============================================ */

function esNeoRevelation(set) {
    const nombre = normalizarTexto(set?.name);
    const id = normalizarTexto(set?.id);

    return (
        nombre.includes("neo revelation") ||
        id === "neo4" ||
        id.includes("neo-revelation")
    );
}

/* ============================================
   CARGAR TASA USD A COP
   ============================================ */

async function cargarTasaCambio() {
    try {
        const respuesta = await obtenerDatos(
            "https://open.er-api.com/v6/latest/USD"
        );

        if (
            respuesta.result === "success" &&
            Number(respuesta.rates?.COP) > 0
        ) {
            tasaUSD_COP = Number(respuesta.rates.COP);

            localStorage.setItem(
                CLAVE_TASA_CAMBIO,
                JSON.stringify({
                    tasa: tasaUSD_COP,
                    fecha: Date.now()
                })
            );

            window.tasaCambioUSD_COP = tasaUSD_COP;

            console.log(
                "Tasa USD/COP actualizada:",
                tasaUSD_COP
            );

            return tasaUSD_COP;
        }

        throw new Error("La tasa de cambio no está disponible.");

    } catch (error) {
        console.warn("No se pudo actualizar la tasa:", error);

        try {
            const guardada = JSON.parse(
                localStorage.getItem(CLAVE_TASA_CAMBIO) || "null"
            );

            if (
                guardada &&
                Number(guardada.tasa) > 0 &&
                Date.now() - guardada.fecha < 7 * 24 * 60 * 60 * 1000
            ) {
                tasaUSD_COP = Number(guardada.tasa);
                window.tasaCambioUSD_COP = tasaUSD_COP;

                return tasaUSD_COP;
            }

        } catch (errorCache) {
            console.warn("No se pudo leer la tasa guardada:", errorCache);
        }

        tasaUSD_COP = null;
        return null;
    }
}

/* ============================================
   FORMATEAR PRECIOS
   ============================================ */

function formatearUSD(valor) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
}

function formatearCOP(valor) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    }).format(valor);
}

/* ============================================
   CACHÉ DE PRECIOS
   ============================================ */

function obtenerCachePrecios() {
    try {
        const cache = JSON.parse(
            localStorage.getItem(CLAVE_CACHE_PRECIOS) || "{}"
        );

        return cache && typeof cache === "object" ? cache : {};

    } catch (error) {
        console.warn("Error leyendo caché de precios:", error);
        return {};
    }
}

function guardarCachePrecios(cache) {
    try {
        localStorage.setItem(
            CLAVE_CACHE_PRECIOS,
            JSON.stringify(cache)
        );
    } catch (error) {
        console.warn("No se pudo guardar el caché:", error);
    }
}

/* ============================================
   EXTRAER PRECIO DE MERCADO
   ============================================ */

function obtenerPrecioDeVariante(datos) {
    if (!datos || typeof datos !== "object") {
        return null;
    }

    const opciones = [
        datos.marketPrice,
        datos.midPrice,
        datos.lowPrice
    ];

    for (const valor of opciones) {
        const numero = Number(valor);

        if (Number.isFinite(numero) && numero > 0) {
            return {
                usd: numero,
                tipo: valor === datos.marketPrice
                    ? "Precio de mercado"
                    : valor === datos.midPrice
                        ? "Precio medio"
                        : "Precio mínimo"
            };
        }
    }

    return null;
}

function extraerPrecioUSD(detalle) {
    if (!detalle) return null;

    const tcgplayer = detalle.pricing?.tcgplayer;

    if (tcgplayer) {
        const variantes = [
            "holofoil",
            "normal",
            "reverse-holofoil",
            "reverse",
            "1st-edition-holofoil",
            "1st-edition",
            "unlimited-holofoil",
            "unlimited"
        ];

        for (const variante of variantes) {
            const precio = obtenerPrecioDeVariante(
                tcgplayer[variante]
            );

            if (precio) {
                return {
                    usd: precio.usd,
                    tipo: precio.tipo
                };
            }
        }
    }

    if (Array.isArray(detalle.variants_detailed)) {
        for (const variante of detalle.variants_detailed) {
            const datos = variante.pricing?.tcgplayer;

            if (!datos) continue;

            const opciones = [
                datos.marketPrice,
                datos.midPrice,
                datos.lowPrice
            ];

            for (let i = 0; i < opciones.length; i++) {
                const valor = Number(opciones[i]);

                if (Number.isFinite(valor) && valor > 0) {
                    return {
                        usd: valor,
                        tipo: i === 0
                            ? "Precio de mercado"
                            : i === 1
                                ? "Precio medio"
                                : "Precio mínimo"
                    };
                }
            }
        }
    }

    return null;
}

/* ============================================
   OBTENER PRECIO DE UNA CARTA
   ============================================ */

async function obtenerPrecioCarta(carta) {
    const cache = obtenerCachePrecios();
    const guardado = cache[carta.id];

    if (
        guardado &&
        Date.now() - guardado.fechaConsulta < DURACION_CACHE
    ) {
        return guardado.precio || null;
    }

    try {
        const detalle = await obtenerDatos(
            `${API_BASE}/cards/${encodeURIComponent(carta.id)}`
        );

        const precio = extraerPrecioUSD(detalle);

        cache[carta.id] = {
            precio,
            fechaConsulta: Date.now()
        };

        guardarCachePrecios(cache);

        return precio;

    } catch (error) {
        console.warn(
            "No se pudo obtener el precio de:",
            carta.name,
            error
        );

        return null;
    }
}

/* ============================================
   ACTUALIZAR PRECIOS DEL CATÁLOGO
   ============================================ */

async function actualizarPreciosCartas() {
    if (!todasLasCartas.length) return;

    console.log("Consultando precios de las cartas...");

    await cargarTasaCambio();

    const TAMANO_GRUPO = 8;

    for (
        let i = 0;
        i < todasLasCartas.length;
        i += TAMANO_GRUPO
    ) {
        const grupo = todasLasCartas.slice(
            i,
            i + TAMANO_GRUPO
        );

        const resultados = await Promise.all(
            grupo.map(async carta => ({
                id: carta.id,
                precio: await obtenerPrecioCarta(carta)
            }))
        );

        resultados.forEach(resultado => {
            const carta = todasLasCartas.find(
                item => item.id === resultado.id
            );

            if (carta) {
                carta.precioReferencia = resultado.precio;

                carta.precioCOP =
                    resultado.precio && tasaUSD_COP
                        ? resultado.precio.usd * tasaUSD_COP
                        : null;
            }
        });

        listaPokemon = todasLasCartas;
        window.listaPokemon = listaPokemon;

        if (buscador && buscador.value.trim()) {
            buscarPokemon();
        } else {
            mostrarCartas(todasLasCartas);
        }
    }

    if (typeof window.renderCart === "function") {
        window.renderCart();
    }

    console.log("Consulta de precios terminada.");
}

/* ============================================
   MOSTRAR PRECIO EN LA TARJETA
   SIN FUENTE NI FECHA VISIBLES
   ============================================ */

function crearElementoPrecio(carta) {
    const precio = document.createElement("p");

    precio.className = "precio-cop";
    precio.style.whiteSpace = "pre-line";

    const referencia = carta.precioReferencia;

    if (!referencia || !Number(referencia.usd)) {
        precio.textContent = "Precio de referencia no disponible";

        precio.title =
            "Esta carta no tiene un precio de mercado publicado.";

        return precio;
    }

    const lineaUSD = `USD: ${formatearUSD(referencia.usd)}`;

    let lineaCOP = "";

    if (tasaUSD_COP) {
        const valorCOP = referencia.usd * tasaUSD_COP;

        carta.precioCOP = valorCOP;

        lineaCOP = `\nCOP: ${formatearCOP(valorCOP)}`;

    } else {
        lineaCOP = "\nCOP: conversión no disponible";
    }

    precio.textContent = `${lineaUSD}${lineaCOP}`;

    precio.title =
        "Precio orientativo de mercado. Puede variar según " +
        "la condición, edición y acabado de la carta.";

    return precio;
}

/* ============================================
   CARGAR COLECCIONES RECIENTES
   ============================================ */

async function obtenerColecciones() {
    const colecciones = await obtenerDatos(
        `${API_BASE}/sets`
    );

    if (!Array.isArray(colecciones)) {
        throw new Error("La API no devolvió colecciones.");
    }

    return colecciones
        .filter(set => set.id && !esNeoRevelation(set))
        .sort((a, b) =>
            String(b.releaseDate || "").localeCompare(
                String(a.releaseDate || "")
            )
        )
        .slice(0, MAX_COLECCIONES);
}

/* ============================================
   OBTENER CARTAS DE CADA COLECCIÓN
   ============================================ */

async function obtenerCartasColeccion(coleccion) {
    try {
        if (esNeoRevelation(coleccion)) {
            return [];
        }

        const detalle = await obtenerDatos(
            `${API_BASE}/sets/${encodeURIComponent(coleccion.id)}`
        );

        if (!Array.isArray(detalle.cards)) {
            return [];
        }

        return detalle.cards
            .filter(carta => carta.id && carta.image)
            .map(carta => ({
                id: carta.id,
                name: carta.name || "Carta Pokémon",
                image: carta.image,
                setId: coleccion.id,
                setName: detalle.name || coleccion.name || "Colección",
                releaseDate:
                    detalle.releaseDate ||
                    coleccion.releaseDate ||
                    ""
            }))
            .filter(carta =>
                !normalizarTexto(carta.setName).includes(
                    "neo revelation"
                )
            );

    } catch (error) {
        console.warn(
            "No se pudo cargar la colección:",
            coleccion.name,
            error
        );

        return [];
    }
}

/* ============================================
   CARGAR CATÁLOGO
   ============================================ */

async function cargarCartas() {
    if (cargandoCartas || !contenedorCartas) return;

    cargandoCartas = true;

    mostrarMensajeCatalogo("✨ Cargando cartas Pokémon...");

    try {
        const colecciones = await obtenerColecciones();
        const acumuladas = [];

        for (let i = 0; i < colecciones.length; i += 4) {
            const grupo = colecciones.slice(i, i + 4);

            const resultados = await Promise.all(
                grupo.map(obtenerCartasColeccion)
            );

            acumuladas.push(...resultados.flat());
        }

        const unicas = Array.from(
            new Map(
                acumuladas.map(carta => [carta.id, carta])
            ).values()
        );

        unicas.sort((a, b) =>
            String(b.releaseDate || "").localeCompare(
                String(a.releaseDate || "")
            )
        );

        todasLasCartas = unicas.slice(0, MAX_CARTAS);
        listaPokemon = todasLasCartas;

        window.listaPokemon = listaPokemon;

        mostrarCartas(todasLasCartas);

        await actualizarPreciosCartas();

    } catch (error) {
        console.error("Error cargando Pokebóveda:", error);

        mostrarMensajeCatalogo(
            "No pudimos cargar las cartas. Comprueba tu conexión e inténtalo nuevamente.",
            "error"
        );

    } finally {
        cargandoCartas = false;
    }
}

/* ============================================
   CREAR TARJETA
   ============================================ */

function crearTarjeta(carta) {
    const producto = document.createElement("article");
    producto.className = "producto";

    const carta3D = document.createElement("div");
    carta3D.className = "carta-3d";

    const frente = document.createElement("div");
    frente.className = "cara frente";

    const atras = document.createElement("div");
    atras.className = "cara atras";

    /* Imagen principal */

    const imagen = document.createElement("img");

    imagen.className = "carta-real";
    imagen.alt = carta.name;
    imagen.loading = "lazy";
    imagen.decoding = "async";

    const baseImagen = carta.image.replace(/\/+$/, "");

    imagen.src = `${baseImagen}/high.png`;

    imagen.onerror = function () {
        if (!this.dataset.intentoBajo) {
            this.dataset.intentoBajo = "true";
            this.src = `${baseImagen}/low.webp`;
        } else {
            this.onerror = null;
            this.alt = `Imagen no disponible: ${carta.name}`;
        }
    };

    frente.appendChild(imagen);

    /* Reverso */

    const imagenReverso = document.createElement("img");

    // Corregido: la imagen está junto a index.html, no dentro de img/
    imagenReverso.src = "pokemon-back.png";

    imagenReverso.alt = "Reverso de carta Pokémon";
    imagenReverso.className = "carta-real";

    atras.appendChild(imagenReverso);

    carta3D.appendChild(frente);
    carta3D.appendChild(atras);

    /* Información */

    const informacion = document.createElement("div");
    informacion.className = "info-carta";

    const nombre = document.createElement("h3");

    nombre.className = "nombre-carta";
    nombre.textContent = carta.name;

    const coleccion = document.createElement("p");

    coleccion.className = "coleccion-carta";
    coleccion.textContent = carta.setName;

    const precio = crearElementoPrecio(carta);

    informacion.appendChild(nombre);
    informacion.appendChild(coleccion);
    informacion.appendChild(precio);

    /* Botón carrito */

    const botonComprar = document.createElement("button");

    botonComprar.type = "button";
    botonComprar.className = "btn-comprar";
    botonComprar.textContent = "Agregar al carrito 🛒";

    botonComprar.addEventListener("click", function (evento) {
        evento.stopPropagation();

        if (typeof window.addToCart === "function") {
            window.addToCart(carta.id);
        } else {
            console.error("No se encontró la función del carrito.");

            alert(
                "El carrito todavía no está disponible. Recarga la página."
            );
        }
    });

    /* Girar carta al hacer clic */

    carta3D.addEventListener("click", function () {
        carta3D.classList.toggle("volteada");
    });

    /* Girar carta al pasar el mouse */

    producto.addEventListener("mouseenter", function () {
        carta3D.classList.add("volteada");
    });

    producto.addEventListener("mouseleave", function () {
        carta3D.classList.remove("volteada");
    });

    producto.appendChild(carta3D);
    producto.appendChild(informacion);
    producto.appendChild(botonComprar);

    return producto;
}

/* ============================================
   MOSTRAR CARTAS
   ============================================ */

function mostrarCartas(cartas) {
    if (!contenedorCartas) return;

    contenedorCartas.innerHTML = "";

    if (!cartas.length) {
        mostrarMensajeCatalogo(
            "No encontramos cartas con ese nombre. 💗"
        );

        return;
    }

    const fragmento = document.createDocumentFragment();

    cartas.forEach(carta => {
        fragmento.appendChild(crearTarjeta(carta));
    });

    contenedorCartas.appendChild(fragmento);
}

/* ============================================
   BUSCADOR
   ============================================ */

function buscarPokemon() {
    if (!buscador) return;

    const termino = normalizarTexto(buscador.value);

    const filtradas = todasLasCartas.filter(carta => {
        return (
            normalizarTexto(carta.name).includes(termino) ||
            normalizarTexto(carta.setName).includes(termino) ||
            normalizarTexto(carta.id).includes(termino)
        );
    });

    mostrarCartas(filtradas);
}

if (buscador) {
    buscador.addEventListener("input", buscarPokemon);
}

/* ============================================
   FORMULARIO DE SOLICITUDES
   ============================================ */

if (formSolicitud) {
    formSolicitud.addEventListener("submit", function (evento) {
        evento.preventDefault();

        const nombre =
            document.getElementById("nombreCliente")?.value.trim();

        const email =
            document.getElementById("emailCliente")?.value.trim();

        const pokemon =
            document.getElementById("nombrePokemon")?.value.trim();

        const mensaje =
            document.getElementById("mensajeCliente")?.value.trim();

        const mensajeExito =
            document.getElementById("mensajeExito");

        if (!nombre || !email || !pokemon) {
            alert("Por favor, completa los campos obligatorios.");
            return;
        }

        const solicitudes = obtenerSolicitudes();

        solicitudes.push({
            id: Date.now(),
            nombre,
            email,
            pokemon,
            mensaje: mensaje || "",
            fecha: new Date().toLocaleString("es-CO"),
            estado: "Pendiente"
        });

        guardarSolicitudes(solicitudes);

        if (mensajeExito) {
            mensajeExito.textContent =
                `¡Gracias, ${nombre}! Tu solicitud se guardó correctamente. ✨`;

            mensajeExito.style.display = "block";
        }

        formSolicitud.reset();

        setTimeout(() => {
            if (mensajeExito) {
                mensajeExito.style.display = "none";
            }
        }, 5000);
    });
}

/* ============================================
   PANEL DE ADMINISTRACIÓN
   ============================================ */

function crearPanelAdmin() {
    if (document.getElementById("botonAdmin")) return;

    const botonAdmin = document.createElement("button");

    botonAdmin.id = "botonAdmin";
    botonAdmin.type = "button";
    botonAdmin.textContent = "⚙️ Administración";

    botonAdmin.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 9998;
        background: #8e69b5;
        color: white;
        border: none;
        border-radius: 25px;
        padding: 12px 18px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,.2);
    `;

    document.body.appendChild(botonAdmin);

    botonAdmin.addEventListener("click", abrirAdministracion);
}

function abrirAdministracion() {
    const clave = prompt("Introduce la clave de administración:");

    if (clave === null) return;

    if (clave !== CLAVE_ADMIN) {
        alert("Clave incorrecta. Acceso denegado. 🔒");
        return;
    }

    mostrarPanelSolicitudes();
}

function mostrarPanelSolicitudes() {
    let panel = document.getElementById("panelAdministracion");

    if (panel) {
        panel.remove();
    }

    panel = document.createElement("div");
    panel.id = "panelAdministracion";

    panel.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(30, 20, 40, .75);
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 15px;
        box-sizing: border-box;
    `;

    const contenido = document.createElement("div");

    contenido.style.cssText = `
        background: #fff9ff;
        width: 100%;
        max-width: 850px;
        max-height: 90vh;
        overflow-y: auto;
        border-radius: 22px;
        padding: 25px;
        box-sizing: border-box;
        box-shadow: 0 10px 40px rgba(0,0,0,.3);
        color: #4b365a;
    `;

    const encabezado = document.createElement("div");

    encabezado.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 20px;
    `;

    const titulo = document.createElement("h2");

    titulo.textContent = "💗 Panel de administración";
    titulo.style.margin = "0";

    const cerrar = document.createElement("button");

    cerrar.textContent = "✖ Cerrar";
    cerrar.type = "button";

    cerrar.style.cssText = `
        background: #e9d8f5;
        color: #563b70;
        border: none;
        border-radius: 12px;
        padding: 10px 15px;
        cursor: pointer;
        font-weight: bold;
    `;

    cerrar.addEventListener("click", () => panel.remove());

    encabezado.appendChild(titulo);
    encabezado.appendChild(cerrar);

    const descripcion = document.createElement("p");

    descripcion.textContent =
        "Aquí puedes revisar las solicitudes enviadas desde este navegador.";

    const lista = document.createElement("div");
    lista.id = "listaSolicitudesAdmin";

    contenido.appendChild(encabezado);
    contenido.appendChild(descripcion);
    contenido.appendChild(lista);

    panel.appendChild(contenido);
    document.body.appendChild(panel);

    renderizarSolicitudesAdmin();
}

function renderizarSolicitudesAdmin() {
    const lista = document.getElementById("listaSolicitudesAdmin");

    if (!lista) return;

    lista.innerHTML = "";

    const solicitudes = obtenerSolicitudes();

    if (solicitudes.length === 0) {
        const vacio = document.createElement("p");

        vacio.textContent =
            "Todavía no hay solicitudes recibidas. 🌸";

        vacio.style.cssText = `
            text-align: center;
            padding: 30px;
            background: #f5eafa;
            border-radius: 15px;
        `;

        lista.appendChild(vacio);
        return;
    }

    const contador = document.createElement("h3");

    contador.textContent =
        `📩 Solicitudes recibidas: ${solicitudes.length}`;

    lista.appendChild(contador);

    solicitudes.slice().reverse().forEach(solicitud => {
        const tarjeta = document.createElement("article");

        tarjeta.style.cssText = `
            background: white;
            border: 1px solid #eadcf3;
            border-radius: 15px;
            padding: 16px;
            margin-bottom: 14px;
            box-shadow: 0 3px 10px rgba(80,40,100,.08);
        `;

        const nombre = document.createElement("h3");
        nombre.textContent = `👤 ${solicitud.nombre}`;

        const correo = document.createElement("p");
        correo.textContent = `✉️ ${solicitud.email}`;

        const pokemon = document.createElement("p");
        pokemon.textContent =
            `🎴 Carta solicitada: ${solicitud.pokemon}`;

        const mensaje = document.createElement("p");
        mensaje.textContent =
            `💬 Mensaje: ${solicitud.mensaje || "Sin mensaje adicional"}`;

        const fecha = document.createElement("small");
        fecha.textContent =
            `📅 ${solicitud.fecha || "Fecha no disponible"}`;

        const estado = document.createElement("p");
        estado.textContent =
            `Estado: ${solicitud.estado || "Pendiente"}`;

        const acciones = document.createElement("div");

        acciones.style.cssText = `
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 12px;
        `;

        const responder = document.createElement("a");

        responder.textContent = "Responder por correo";

        responder.href =
            `mailto:${encodeURIComponent(solicitud.email)}?subject=` +
            encodeURIComponent("Tu solicitud en Pokebóveda");

        responder.style.cssText = `
            background: #e9d8f5;
            color: #563b70;
            padding: 9px 12px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: bold;
            font-size: 13px;
        `;

        const eliminar = document.createElement("button");

        eliminar.textContent = "🗑️ Eliminar";
        eliminar.type = "button";

        eliminar.style.cssText = `
            background: #ffe0e8;
            color: #a33d60;
            border: none;
            padding: 9px 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: bold;
        `;

        eliminar.addEventListener("click", () => {
            if (!confirm("¿Quieres eliminar esta solicitud?")) return;

            const actualizadas = obtenerSolicitudes().filter(
                item => item.id !== solicitud.id
            );

            guardarSolicitudes(actualizadas);
            renderizarSolicitudesAdmin();
        });

        acciones.appendChild(responder);
        acciones.appendChild(eliminar);

        tarjeta.appendChild(nombre);
        tarjeta.appendChild(correo);
        tarjeta.appendChild(pokemon);
        tarjeta.appendChild(mensaje);
        tarjeta.appendChild(fecha);
        tarjeta.appendChild(estado);
        tarjeta.appendChild(acciones);

        lista.appendChild(tarjeta);
    });
}

/* ============================================
   CHATBOT POKEBOT
   ============================================ */

const btnChatbot = document.getElementById("btnChatbot");
const ventanaChat = document.getElementById("ventanaChat");
const btnCerrarChat = document.getElementById("btnCerrarChat");
const btnEnviarChat = document.getElementById("btnEnviarChat");
const inputChat = document.getElementById("inputChat");
const chatMensajes = document.getElementById("chatMensajes");

function abrirChat() {
    if (!ventanaChat) return;

    ventanaChat.style.display = "flex";
}

function cerrarChat() {
    if (!ventanaChat) return;

    ventanaChat.style.display = "none";
}

function agregarMensaje(texto, remitente) {
    if (!chatMensajes) return;

    const mensaje = document.createElement("div");

    mensaje.className = `mensaje ${remitente}`;
    mensaje.textContent = texto;

    chatMensajes.appendChild(mensaje);
    chatMensajes.scrollTop = chatMensajes.scrollHeight;
}

function obtenerRespuestaBot(texto) {
    const mensaje = normalizarTexto(texto);

    if (
        mensaje.includes("hola") ||
        mensaje.includes("buenas") ||
        mensaje.includes("hey")
    ) {
        return "¡Holaaa! 🌸 Soy Pokebot, tu asesor Pokémon. ¿Buscas cartas para jugar o para coleccionar?";
    }

    if (
        mensaje.includes("jugar") ||
        mensaje.includes("mazo") ||
        mensaje.includes("torneo") ||
        mensaje.includes("competitivo")
    ) {
        return "⚔️ ¡Qué emoción! Para jugar podemos ayudarte a encontrar cartas útiles para tu mazo. ¿Qué tipo de Pokémon te gusta?";
    }

    if (
        mensaje.includes("coleccionar") ||
        mensaje.includes("rara") ||
        mensaje.includes("arte") ||
        mensaje.includes("bonita")
    ) {
        return "💎 ¡Entonces eres de los nuestros! Busca ilustraciones especiales, cartas raras y tus Pokémon favoritos.";
    }

    if (
        mensaje.includes("precio") ||
        mensaje.includes("cuanto") ||
        mensaje.includes("costo")
    ) {
        return "💗 Los precios mostrados son referencias de mercado en USD y su conversión aproximada a COP. Pueden variar según la condición y edición de la carta.";
    }

    if (
        mensaje.includes("pedido") ||
        mensaje.includes("compra") ||
        mensaje.includes("carrito")
    ) {
        return "🛒 Puedes agregar las cartas que te interesen al carrito y luego enviar tu consulta por WhatsApp.";
    }

    if (
        mensaje.includes("fuego") ||
        mensaje.includes("charizard")
    ) {
        return "🔥 ¡El tipo Fuego es increíble! Charizard es uno de los favoritos de muchos coleccionistas.";
    }

    if (
        mensaje.includes("agua") ||
        mensaje.includes("blastoise") ||
        mensaje.includes("greninja")
    ) {
        return "💧 ¡Los Pokémon de tipo Agua tienen cartas preciosas! Blastoise y Greninja son excelentes opciones.";
    }

    if (mensaje.includes("gracias")) {
        return "¡Con muchísimo gusto, entrenador! 💗";
    }

    return "¡Qué interesante! ✨ Cuéntame un poquito más. Estoy aquí para ayudarte a explorar Pokebóveda.";
}

function procesarMensajeUsuario() {
    if (!inputChat) return;

    const texto = inputChat.value.trim();

    if (!texto) return;

    agregarMensaje(texto, "usuario");

    inputChat.value = "";

    setTimeout(() => {
        const respuesta = obtenerRespuestaBot(texto);
        agregarMensaje(respuesta, "bot");
    }, 500);
}

if (btnChatbot) {
    btnChatbot.addEventListener("click", abrirChat);
}

if (btnCerrarChat) {
    btnCerrarChat.addEventListener("click", cerrarChat);
}

if (btnEnviarChat) {
    btnEnviarChat.addEventListener("click", procesarMensajeUsuario);
}

if (inputChat) {
    inputChat.addEventListener("keydown", function (evento) {
        if (evento.key === "Enter") {
            procesarMensajeUsuario();
        }
    });
}

/* ============================================
   INICIAR PÁGINA
   ============================================ */

crearPanelAdmin();
cargarCartas();


/* ==================================
   MOVIMIENTO DE LOS BOTONES FLOTANTES
================================== */

document.addEventListener("DOMContentLoaded", function () {

    let ultimaPosicion = window.scrollY;

    const botonSubir = document.querySelector(".btn-subir");

    window.addEventListener("scroll", function () {

        const posicionActual = window.scrollY;

        // Detectar si estamos en la parte superior
        if (posicionActual <= 50) {
            document.body.classList.remove("scroll-down");

            if (botonSubir) {
                botonSubir.classList.remove("visible");
            }

        } else {

            // Mostrar el botón de subir
            if (botonSubir) {
                botonSubir.classList.add("visible");
            }

            // Si bajas, ocultar el texto del carrito
            if (posicionActual > ultimaPosicion + 3) {
                document.body.classList.add("scroll-down");
            }

            // Si subes, mostrar nuevamente el texto
            if (posicionActual < ultimaPosicion - 3) {
                document.body.classList.remove("scroll-down");
            }
        }

        ultimaPosicion = posicionActual;

    });

});