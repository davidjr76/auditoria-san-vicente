const API_URL = "https://script.google.com/macros/s/AKfycbyRHcQnQIpcG4OvYDAHkhmKXV8BFbcFbIZr1hcnu9PnAiIjeFEipb7EHMLbcnxMSzDN/exec";

// ==========================================
// BASE DE DATOS DE LISTAS
// ==========================================
const CATALOGOS = {
    sectores_base: [], // <--- AQUÍ ESTABA EL ERROR: Lo he dejado vacío para que no salgan los SECTOR-01 al 10
    tiposCaja: ["Aerea", "Subterranea", "Fachada", "Armario", "Mufa", "ODF"],
    colores: ["Azul", "Naranja", "Verde", "Marron", "Gris", "Blanco", "Rojo", "Negro", "Amarillo", "Violeta", "Rosa", "Aqua"],
    buffers: ["AZUL", "NARANJA", "VERDE", "MARRON", "GRIS", "BLANCO", "ROJO", "NEGRO", "AMARILLO", "VIOLETA", "ROSA", "AQUA"]
};

// Sectores personalizados agregados desde el celular
let sectoresCustom = JSON.parse(localStorage.getItem('sectores_custom')) || [];

document.addEventListener('DOMContentLoaded', () => {
    cargarListasDinamicas();
    renderizarListaSectores();

    let auditorGuardado = localStorage.getItem('auditor_nombre');
    if (!auditorGuardado) {
        let nombre = prompt("Ingresa tu nombre (Auditor):", "Auditor 1");
        if (nombre) localStorage.setItem('auditor_nombre', nombre);
        auditorGuardado = nombre;
    }

    let hoy = new Date().toISOString().split('T')[0];
    document.querySelectorAll('.fecha-auto').forEach(el => el.value = hoy);
    document.querySelectorAll('.auditor-auto').forEach(el => el.value = auditorGuardado);
    document.querySelectorAll('.fecha-incidencia').forEach(el => el.value = hoy);

    actualizarContador();
    actualizarDashboard();
    verificarConexion();
    configurarBotonesGPS();
});

// 1. FUNCIÓN PARA AGREGAR UN NUEVO SECTOR
function agregarNuevoSector() {
    let input = document.getElementById('nuevo-sector-input');
    let nuevoSector = input.value.trim().toUpperCase();

    if (nuevoSector === "") return alert("Escribe un nombre para el sector.");
    
    if (sectoresCustom.includes(nuevoSector)) {
        return alert("Este sector ya existe en tu lista.");
    }

    // Guardar en la memoria del celular
    sectoresCustom.push(nuevoSector);
    localStorage.setItem('sectores_custom', JSON.stringify(sectoresCustom));
    
    // Actualizar la vista
    input.value = "";
    cargarListasDinamicas();
    renderizarListaSectores();
    
    // Auto-sincronizar si hay internet
    if (navigator.onLine) {
        sincronizarDatos(true); // El 'true' significa que es una sincronización silenciosa
    }
}

// 2. FUNCIÓN PARA BORRAR TODOS LOS SECTORES LOCALES
function borrarTodosLosSectores() {
    if(confirm("¿Estás seguro de que quieres borrar todos los sectores de la lista del celular? (No se borrarán del Excel)")) {
        sectoresCustom = [];
        localStorage.removeItem('sectores_custom');
        cargarListasDinamicas();
        renderizarListaSectores();
        alert("Lista limpia. Ahora puedes agregar los sectores reales.");
    }
}

// 3. MOSTRAR LA LISTA DE SECTORES EN LA PESTAÑA
function renderizarListaSectores() {
    let ul = document.getElementById('lista-sectores');
    if(!ul) return;
    ul.innerHTML = "";
    
    let todos = [...new Set([...CATALOGOS.sectores_base, ...sectoresCustom])];
    
    if (todos.length === 0) {
        ul.innerHTML = '<li class="list-group-item text-muted text-center">No hay sectores. Agrega uno arriba.</li>';
        return;
    }

    todos.forEach(sector => {
        ul.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">
            ${sector}
        </li>`;
    });
}

// 4. FUNCIÓN MÁGICA: Llena los <select>
function cargarListasDinamicas() {
    let todosLosSectores = [...new Set([...CATALOGOS.sectores_base, ...sectoresCustom])];

    const selectsSector = document.querySelectorAll('select[name="SECTOR"]');
    selectsSector.forEach(select => {
        let valorActual = select.value;
        select.innerHTML = '<option value="">Seleccione...</option>'; 
        todosLosSectores.forEach(sector => {
            select.innerHTML += `<option value="${sector}">${sector}</option>`;
        });
        select.value = valorActual;
    });

    // (El resto de listas de colores, buffers y tipos de caja se mantienen igual)
    const selectsTipoCaja = document.querySelectorAll('select[name="Tipo_Caja"]');
    selectsTipoCaja.forEach(select => {
        let valorActual = select.value;
        select.innerHTML = '<option value="">Seleccione...</option>';
        CATALOGOS.tiposCaja.forEach(caja => { select.innerHTML += `<option value="${caja}">${caja}</option>`; });
        select.value = valorActual;
    });

    const selectsColor = document.querySelectorAll('select[name="Color_Origen"], select[name="Color_Destino"]');
    selectsColor.forEach(select => {
        let valorActual = select.value;
        select.innerHTML = '<option value="">Seleccione...</option>';
        CATALOGOS.colores.forEach(color => { select.innerHTML += `<option value="${color}">${color}</option>`; });
        select.value = valorActual;
    });

    const selectsBuffer = document.querySelectorAll('select[name="Buffer_Origen"], select[name="Buffer_Destino"]');
    selectsBuffer.forEach(select => {
        let valorActual = select.value;
        select.innerHTML = '<option value="">Seleccione...</option>';
        CATALOGOS.buffers.forEach(buffer => { select.innerHTML += `<option value="${buffer}">${buffer}</option>`; });
        select.value = valorActual;
    });
}

// 5. CONFIGURAR BOTONES DE GPS
function configurarBotonesGPS() {
    const botonesGPS = document.querySelectorAll('.btn-gps');
    botonesGPS.forEach(btn => {
        btn.addEventListener('click', function() {
            const form = this.closest('form');
            if (navigator.geolocation) {
                this.innerText = "⏳ Buscando...";
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        form.querySelector('.gps-lat').value = position.coords.latitude.toFixed(6);
                        form.querySelector('.gps-lon').value = position.coords.longitude.toFixed(6);
                        this.innerText = "✅ GPS Capturado";
                        setTimeout(() => { this.innerText = "📍 Capturar GPS"; }, 2000);
                    },
                    (error) => {
                        alert("Error al obtener GPS: " + error.message);
                        this.innerText = "📍 Capturar GPS";
                    }
                );
            } else {
                alert("Tu celular no soporta GPS.");
            }
        });
    });
}

// 6. GUARDAR CUALQUIER FORMULARIO
const formularios = document.querySelectorAll('.form-auditoria');
formularios.forEach(form => {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const nuevoElemento = {};
        formData.forEach((value, key) => { nuevoElemento[key] = value; });
        nuevoElemento.id_local = Date.now();
        nuevoElemento.fecha_sistema = new Date().toISOString();

        let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
        pendientes.push(nuevoElemento);
        localStorage.setItem('pendientesGPON', JSON.stringify(pendientes));

        alert(`¡${nuevoElemento.Tipo_Elemento} guardado localmente!`);
        this.reset();
        
        let hoy = new Date().toISOString().split('T')[0];
        this.querySelectorAll('.fecha-auto').forEach(el => el.value = hoy);
        this.querySelectorAll('.auditor-auto').forEach(el => el.value = localStorage.getItem('auditor_nombre'));
        this.querySelectorAll('.fecha-incidencia').forEach(el => el.value = hoy);

        actualizarContador();
        actualizarDashboard();
    });
});

// 7. ACTUALIZAR DASHBOARD
function actualizarContador() {
    let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    document.getElementById('contadorPendientes').innerText = pendientes.length;
}

function actualizarDashboard() {
    let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    let counts = { Poste: 0, NAP: 0, Empalme: 0 };
    pendientes.forEach(item => { if (counts[item.Tipo_Elemento] !== undefined) counts[item.Tipo_Elemento]++; });
    document.getElementById('dash-pendientes-total').innerText = pendientes.length;
    document.getElementById('pend-postes').innerText = counts.Poste;
    document.getElementById('pend-naps').innerText = counts.NAP;
    document.getElementById('pend-empalmes').innerText = counts.Empalme;
}

// 8. SINCRONIZAR CON GOOGLE SHEETS
async function sincronizarDatos(silencioso = false) {
    let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    let sectoresPendientes = sectoresCustom.map(sec => ({ Tipo_Elemento: "Sector", SECTOR: sec }));

    let todoParaEnviar = [...pendientes, ...sectoresPendientes];

    if (todoParaEnviar.length === 0) {
        if(!silencioso) alert("No hay datos nuevos para sincronizar.");
        return;
    }
    if (!navigator.onLine) {
        if(!silencioso) alert("No hay internet.");
        return;
    }

    const btn = document.querySelector('.btn-info');
    const btnDash = document.querySelector('button[onclick="sincronizarDatos()"]');
    if(!silencioso) {
        btn.innerText = "⏳ Sincronizando...";
        if(btnDash) btnDash.innerText = "⏳ Sincronizando...";
        btn.disabled = true;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(todoParaEnviar)
        });

        if (response.ok) {
            if(!silencioso) alert("¡Sincronización exitosa con el Excel!");
            localStorage.removeItem('pendientesGPON');
            actualizarContador();
            actualizarDashboard();
            if(document.getElementById('sync-status')) {
                document.getElementById('sync-status').innerText = "Última sinc: " + new Date().toLocaleTimeString();
            }
            obtenerResumenNube(); 
        } else {
            if(!silencioso) alert("Error del servidor. Revisa los permisos en Apps Script.");
        }
    } catch (error) {
        if(!silencioso) alert("Error de red al sincronizar.");
    } finally {
        if(!silencioso) {
            btn.innerText = "🔄 Sincronizar";
            if(btnDash) btnDash.innerText = "🔄 Sincronizar Todo";
            btn.disabled = false;
        }
    }
}

// 9. OBTENER TOTALES DE LA NUBE
async function obtenerResumenNube() {
    if (!navigator.onLine) return;
    const btn = document.querySelector('button[onclick="obtenerResumenNube()"]');
    if(btn) { btn.innerText = "⏳ Cargando..."; btn.disabled = true; }

    try {
        const response = await fetch(API_URL); 
        const data = await response.json();
        if (data.status === "success") {
            document.getElementById('total-postes').innerText = data.totales.postes;
            document.getElementById('total-naps').innerText = data.totales.naps;
            document.getElementById('total-empalmes').innerText = data.totales.empalmes;
        }
    } catch (error) {
        console.error(error);
    } finally {
        if(btn) { btn.innerText = "☁️ Actualizar Totales de Google Sheets"; btn.disabled = false; }
    }
}

function verificarConexion() {
    const badge = document.getElementById('statusConexion');
    if(navigator.onLine) { badge.innerText = "Online"; badge.className = "badge bg-success"; }
    else { badge.innerText = "Offline"; badge.className = "badge bg-danger"; }
}
window.addEventListener('online', verificarConexion);
window.addEventListener('offline', verificarConexion);
