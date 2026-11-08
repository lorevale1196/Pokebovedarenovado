
/* ============================================
POKEBÓVEDA - SISTEMA DE CARRITO
   ============================================ */

"use strict";

const CART_STORAGE_KEY = "pokeboveda_carrito";
const WHATSAPP_NUMERO = "573245427319";

let cart = cargarCarrito();

/* ============================================
CARGAR Y GUARDAR CARRITO
   ============================================ */

function cargarCarrito() {
    try {
        const guardado = localStorage.getItem(CART_STORAGE_KEY);
        const datos = guardado ? JSON.parse(guardado) : [];

        return Array.isArray(datos)
            ? datos.filter(item => item && item.id !== undefined)
            : [];

    } catch (error) {
        console.error("Error al cargar el carrito:", error);
        return [];
    }
}

function guardarCarrito() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

/* ============================================
   BUSCAR PRODUCTO O CARTA
   ============================================ */

function buscarProducto(id) {
    let producto = null;

    // Productos antiguos de data.js.
    if (typeof products !== "undefined" && Array.isArray(products)) {
        producto = products.find(
            item => String(item.id) === String(id)
        );
    }

    // Cartas actualizadas de TCGdex.
    if (!producto && Array.isArray(window.listaPokemon)) {
        producto = window.listaPokemon.find(
            item => String(item.id) === String(id)
        );
    }

    return producto || null;
}

/* ============================================
   OBTENER PRECIO
   ============================================ */

function obtenerPrecio(producto) {
    if (!producto) return null;

    // Precios de las cartas de data.js
    if (producto.price !== undefined && producto.price !== null) {
        const precio = Number(producto.price);

        if (Number.isFinite(precio)) {
            return precio;
        }
    }

    // Precios de las cartas cargadas desde TCGDex
    if (producto.precioCOP !== undefined && producto.precioCOP !== null) {
        const precio = Number(producto.precioCOP);

        if (Number.isFinite(precio)) {
            return precio;
        }
    }

    // Compatibilidad con otros productos
    if (producto.priceCOP !== undefined && producto.priceCOP !== null) {
        const precio = Number(
            String(producto.priceCOP).replace(/[^\d]/g, "")
        );

        if (Number.isFinite(precio)) {
            return precio;
        }
    }

    return null;
}

function mostrarPrecio(producto) {
    const precioCOP = obtenerPrecio(producto);

    if (precioCOP === null) {
        return "Precio por consultar";
    }

    const tasa = window.tasaCambioUSD_COP;

    const precioUSD = tasa
        ? precioCOP / tasa
        : null;

    const cop = typeof formatearCOP === "function"
        ? formatearCOP(precioCOP)
        : "$" + precioCOP.toLocaleString("es-CO");

    const usd = precioUSD !== null
        ? (typeof formatearUSD === "function"
            ? formatearUSD(precioUSD)
            : "$" + precioUSD.toFixed(2))
        : "No disponible";

return `COP: ${cop}\nUSD: ${usd}`;
}

/* ============================================
   AGREGAR AL CARRITO
   ============================================ */

function addToCart(id) {
    const producto = buscarProducto(id);

    if (!producto) {
        console.error("No se encontró la carta:", id);
        return;
    }

    const itemExistente = cart.find(
        item => String(item.id) === String(id)
    );

    if (itemExistente) {
        itemExistente.cantidad++;
    } else {
        cart.push({
            id: id,
            cantidad: 1
        });
    }

    guardarCarrito();
    renderCart();
    mostrarMensajeCarrito();
}

/* ============================================
   CAMBIAR CANTIDAD
   ============================================ */

function changeQty(id, delta) {
    const item = cart.find(
        producto => String(producto.id) === String(id)
    );

    if (!item) return;

    item.cantidad += Number(delta);

    if (item.cantidad <= 0) {
        removeFromCart(id);
        return;
    }

    guardarCarrito();
    renderCart();
}

/* ============================================
   ELIMINAR PRODUCTO
   ============================================ */

function removeFromCart(id) {
    cart = cart.filter(
        item => String(item.id) !== String(id)
    );

    guardarCarrito();
    renderCart();
}

/* ============================================
   CALCULAR TOTAL
   ============================================ */

function calcularTotal() {
    return cart.reduce((total, item) => {
        const producto = buscarProducto(item.id);

        if (!producto) return total;

        const precio = obtenerPrecio(producto);

        if (precio === null) return total;

        return total + precio * item.cantidad;

    }, 0);
}

/* ============================================
   CONTAR PRODUCTOS
   ============================================ */

function contarItems() {
    return cart.reduce(
        (total, item) => total + Number(item.cantidad || 0),
        0
    );
}

/* ============================================
   ESCAPAR TEXTO HTML
   ============================================ */

function escaparHTML(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, caracter => {
        const entidades = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entidades[caracter];
    });
}

/* ============================================
   OBTENER IMAGEN DEL PRODUCTO
   ============================================ */

function obtenerImagenCarrito(producto) {
    if (!producto || !producto.image) {
        return "img/pokemon-back.png";
    }

    const imagen = String(producto.image);

    // Las imágenes de TCGdex necesitan su tamaño.
    if (imagen.includes("assets.tcgdex.net") &&
        !/\.(png|webp|jpg|jpeg)$/i.test(imagen)) {
        return `${imagen.replace(/\/+$/, "")}/low.webp`;
    }

    return imagen;
}

/* ============================================
   MOSTRAR CARRITO
   ============================================ */

function renderCart() {
    const lista = document.getElementById("listaCarrito");
    const contador = document.getElementById("cantidadCarrito");
    const totalElemento = document.getElementById("totalCarrito");

    if (contador) {
        contador.textContent = contarItems();
    }

if (totalElemento) {
    totalElemento.textContent = mostrarPrecio({
        price: calcularTotal()
    });
}
    if (!lista) return;

    if (cart.length === 0) {
        lista.innerHTML = `
            <p class="carritoVacio">
                Tu carrito está vacío 🛒
            </p>
        `;
        return;
    }

    const contenido = cart.map(item => {
        const producto = buscarProducto(item.id);

        if (!producto) {
            return "";
        }

        const nombre = escaparHTML(producto.name || "Carta Pokémon");
        const imagen = escaparHTML(obtenerImagenCarrito(producto));
        const precio = escaparHTML(mostrarPrecio(producto));
        const id = escaparHTML(item.id);

        return `
            <div class="productoCarrito">

                <img
                    src="${imagen}"
                    alt="${nombre}"
                    class="miniaturaCarrito"
                    loading="lazy"
                >

                <div class="infoCarrito">

                    <span class="nombreCarrito">
                        ${nombre}
                    </span>

                    <span class="precioCarrito">
                        ${precio}
                    </span>

                    <div class="cantidadControles">

                        <button
                            type="button"
                            onclick="changeQty('${id}', -1)"
                            aria-label="Disminuir cantidad"
                        >
                            −
                        </button>

                        <span>${Number(item.cantidad)}</span>

                        <button
                            type="button"
                            onclick="changeQty('${id}', 1)"
                            aria-label="Aumentar cantidad"
                        >
                            +
                        </button>

                    </div>

                </div>

                <button
                    type="button"
                    class="eliminarProducto"
                    onclick="removeFromCart('${id}')"
                    aria-label="Eliminar producto"
                >
                    ✕
                </button>

            </div>
        `;
    }).join("");

    lista.innerHTML = contenido || `
        <p class="carritoVacio">
            No hay productos disponibles en el carrito.
        </p>
    `;
}

/* ============================================
   ABRIR CARRITO
   ============================================ */

function abrirCarrito() {
    const panel = document.getElementById("panelCarrito");
    const overlay = document.getElementById("overlayCarrito");

    if (panel) {
        panel.classList.add("activo", "open");
    }

    if (overlay) {
        overlay.classList.add("activo", "open");
    }

    renderCart();
}

/* ============================================
   CERRAR CARRITO
   ============================================ */

function cerrarCarrito() {
    const panel = document.getElementById("panelCarrito");
    const overlay = document.getElementById("overlayCarrito");

    if (panel) {
        panel.classList.remove("activo", "open");
    }

    if (overlay) {
        overlay.classList.remove("activo", "open");
    }
}

/* ============================================
   MENSAJE DE PRODUCTO AGREGADO
   ============================================ */

function mostrarMensajeCarrito() {
    const mensaje = document.getElementById("mensajeCarrito");

    if (!mensaje) return;

    mensaje.textContent = "💗 ¡Carta agregada al carrito!";
    mensaje.style.display = "block";

    setTimeout(() => {
        mensaje.style.display = "none";
    }, 2000);
}

/* ============================================
   FINALIZAR COMPRA POR WHATSAPP
   ============================================ */

function finalizarCompra() {
    if (cart.length === 0) {
        alert(
            "Tu carrito está vacío. Agrega alguna carta antes de continuar 🛒"
        );
        return;
    }

    let mensaje =
        "¡Hola! 👋 Quiero consultar este pedido en Pokebóveda:\n\n";

    let hayPreciosPendientes = false;

    cart.forEach(item => {
        const producto = buscarProducto(item.id);

        if (!producto) return;

        const precio = obtenerPrecio(producto);
        const nombre = producto.name || "Carta Pokémon";

        if (precio === null) {
            hayPreciosPendientes = true;

            mensaje +=
                `• ${nombre} x${item.cantidad} — Precio por confirmar\n`;

        } else {
            const subtotal = precio * item.cantidad;

            const precioTexto = typeof formatPrice === "function"
                ? formatPrice(subtotal)
                : "$" + subtotal.toLocaleString("es-CO");

            mensaje +=
                `• ${nombre} x${item.cantidad} — ${precioTexto}\n`;
        }
    });

    mensaje += "\n";

    if (hayPreciosPendientes) {
        mensaje +=
            "Algunas cartas tienen precio pendiente de confirmar.\n";
    }

    mensaje +=
        `Total de productos con precio definido: ${typeof formatPrice === "function" ? formatPrice(calcularTotal()) : "$" + calcularTotal().toLocaleString("es-CO")}`;

    const url =
        `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;

    window.open(url, "_blank");
}

/* ============================================
   INICIALIZAR CARRITO
   ============================================ */

document.addEventListener("DOMContentLoaded", function () {
    const overlay = document.getElementById("overlayCarrito");

    if (overlay) {
        overlay.addEventListener("click", cerrarCarrito);
    }

    renderCart();
});

/* ============================================
   FUNCIONES DISPONIBLES PARA EL HTML
   ============================================ */

window.addToCart = addToCart;
window.changeQty = changeQty;
window.removeFromCart = removeFromCart;
window.abrirCarrito = abrirCarrito;
window.cerrarCarrito = cerrarCarrito;
window.finalizarCompra = finalizarCompra;
window.renderCart = renderCart;
