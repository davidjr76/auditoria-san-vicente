const API_URL = "https://script.google.com/macros/s/AKfycbyRHcQnQIpcG4OvYDAHkhmKXV8BFbcFbIZr1hcnu9PnAiIjeFEipb7EHMLbcnxMSzDN/exec";

const CATALOGOS = {
    tiposCaja: ["Aerea", "Subterranea", "Fachada", "Armario", "Mufa", "ODF"],
    colores: ["Azul", "Naranja", "Verde", "Marron", "Gris", "Blanco", "Rojo", "Negro", "Amarillo", "Violeta", "Rosa", "Aqua"],
    buffers: ["AZUL", "NARANJA", "VERDE", "MARRON", "GRIS", "BLANCO", "ROJO", "NEGRO", "AMARILLO", "VIOLETA", "ROSA", "AQUA"]
};

// Variables de estado
let sectoresCustom = JSON.parse(localStorage.getItem('sectores_custom')) || [];
let sectoresPendientes = JSON.parse(localStorage.getItem('sectores_pendientes')) || []; // Para nuevos
let sectoresEditados = JSON.parse(localStorage.getItem('sectores_editados')) || []; // Para cambios de nombre {viejo, nuevo}
let sectoresEliminados = JSON.parse(localStorage.getItem('sectores_eliminados')) || []; // Para borrar en Excel
let sectorEditando = null; // Guarda el nombre original si estamos editando

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

// ==========================================
// GESTIÓN DE SECTORES
// ==========================================

function guardarSector() {
    let input = document.getElementById('nuevo-sector-input');
    let nombreSector = input.value.trim().toUpperCase();

    if (nombreSector === "") return alert("Escribe un nombre para el sector.");

    if (sectorEditando) {
        // ESTAMOS EDITANDO
        if (nombreSector !== sectorEditando && sectoresCustom.includes(nombreSector)) {
            return alert("Ya existe otro sector con ese nombre.");
        }
        
        // Actualizar en la lista local
        let index = sectoresCustom.indexOf(sectorEditando);
        sectoresCustom[index] = nombreSector;
        
        // Registrar en la cola de edición para el Excel
        sectoresEditados.push({ viejo: sectorEditando, nuevo: nombreSector });
        
        cancelarEdicion(); // Restaurar el formulario
    } else {
        // ESTAMOS CREANDO
        if (sectoresCustom.includes(nombreSector)) return alert("Este sector ya existe.");

        sectoresCustom.push(nombreSector);
        sectoresPendientes.push(nombreSector); // Agregar a la cola de nuevos
        input.value = "";
    }

    guardarEnMemoria();
    renderizarListaSectores();
    cargarListasDinamicas();
    actualizarContador();
    actualizarDashboard();
}

function prepararEdicion(sector) {
    sectorEditando = sector;
    document.getElementById('nuevo-sector-input').value = sector;
    document.getElementById('titulo-form-sector').innerText = "Editar Sector";
    document.getElementById('btn-accion-sector').innerText = "Guardar Cambios";
    document.getElementById('btn-accion-sector').className = "btn btn-success";
    document.getElementById('btn-cancelar-edicion').style.display = "block";
    document.getElementById('nuevo-sector-input').focus();
}

function cancelarEdicion() {
    sectorEditando = null;
    document.getElementById('nuevo-sector-input').value = "";
    document.getElementById('titulo-form-sector').innerText = "Agregar Nuevo Sector";
    document.getElementById('btn-accion-sector').innerText = "Agregar";
    document.getElementById('btn-accion-sector').className = "btn btn-primary";
    document.getElementById('btn-cancelar-edicion').style.display = "none";
}

function eliminarSector(sector) {
    if(confirm(`¿Seguro que deseas eliminar el sector "${sector}"?\n\nAl sincronizar, también se borrará del Excel.`)) {
        // Borrar de la lista local
        sectoresCustom = sectoresCustom.filter(s => s !== sector);
        
        // Si estaba pendiente de crearse, lo sacamos de la cola
        sectoresPendientes = sectoresPendientes.filter(s => s !== sector);
        
        // Agregar a la cola de eliminación para Excel
        sectoresEliminados.push(sector);

        guardarEnMemoria();
        renderizarListaSectores();
        cargarListasDinamicas();
        actualizarContador();
        actualizarDashboard();
    }
}

function guardarEnMemoria() {
    localStorage.setItem('sectores_custom', JSON.stringify(sectoresCustom));
    localStorage.setItem('sectores_pendientes', JSON.stringify(sectoresPendientes));
    localStorage.setItem('sectores_editados', JSON.stringify(sectoresEditados));
    localStorage.setItem('sectores_eliminados', JSON.stringify(sectoresEliminados));
}

function renderizarListaSectores() {
    let ul = document.getElementById('lista-sectores');
    if(!ul) return;
    ul.innerHTML = "";
    
    if (sectoresCustom.length === 0) {
        ul.innerHTML = '<li class="list-group-item text-muted text-center py-4">No hay sectores agregados.</li>';
        return;
    }

    sectoresCustom.forEach(sector => {
        let esPendiente = sectoresPendientes.includes(sector);
        let badge = esPendiente ? '<span class="badge bg-warning text-dark ms-2">Nuevo</span>' : '';
        
        ul.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>${sector} ${badge}</div>
                <div>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="prepararEdicion('${sector}')">✏️</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarSector('${sector}')">🗑️</button>
                </div>
            </li>
        `;
    });
}

// ==========================================
// RESTO DE LA APP (Listas, GPS, Guardar, Sincronizar)
// ==========================================

function cargarListasDinamicas() {
    let todosLosSectores = [...sectoresCustom];

    document.querySelectorAll('select[name="SECTOR"]').forEach(select => {
        let valorActual = select.value;
        select.innerHTML = '<option value="">Seleccione...</option>'; 
        todosLosSectores.forEach(sector => {
            select.innerHTML += `<option value="${sector}">${sector}</option>`;
        });
        if (todosLosSectores.includes(valorActual)) select.value = valorActual;
    });

    document.querySelectorAll('select[name="Tipo_Caja"]').forEach(select => {
        let v = select.value; select.innerHTML = '<option value="">Seleccione...</option>';
        CATALOGOS.tiposCaja.forEach(c => { select.innerHTML += `<option value="${c}">${c}</option>`; }); select.value = v;
    });
    document.querySelectorAll('select[name="Color_Origen"], select[name="Color_Destino"]').forEach(select => {
        let v = select.value; select.innerHTML = '<option value="">Seleccione...</option>';
        CATALOGOS.colores.forEach(c => { select.innerHTML += `<option value="${c}">${c}</option>`; }); select.value = v;
    });
    document.querySelectorAll('select[name="Buffer_Origen"], select[name="Buffer_Destino"]').forEach(select => {
        let v = select.value; select.innerHTML = '<option value="">Seleccione...</option>';
        CATALOGOS.buffers.forEach(b => { select.innerHTML += `<option value="${b}">${b}</option>`; }); select.value = v;
    });
}

function configurarBotonesGPS() {
    document.querySelectorAll('.btn-gps').forEach(btn => {
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
                    (error) => { alert("Error GPS: " + error.message); this.innerText = "📍 Capturar GPS"; }
                );
            }
        });
    });
}

document.querySelectorAll('.form-auditoria').forEach(form => {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const nuevoElemento = {};
        formData.forEach((value, key) => { nuevoElemento[key] = value; });
        nuevoElemento.id_local = Date.now();

        let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
        pendientes.push(nuevoElemento);
        localStorage.setItem('pendientesGPON', JSON.stringify(pendientes));

        alert(`¡${nuevoElemento.Tipo_Elemento} guardado!`);
        this.reset();
        
        let hoy = new Date().toISOString().split('T')[0];
        this.querySelectorAll('.fecha-auto').forEach(el => el.value = hoy);
        this.querySelectorAll('.auditor-auto').forEach(el => el.value = localStorage.getItem('auditor_nombre'));
        this.querySelectorAll('.fecha-incidencia').forEach(el => el.value = hoy);

        actualizarContador();
        actualizarDashboard();
    });
});

function actualizarContador() {
    let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    let total = pendientes.length + sectoresPendientes.length + sectoresEditados.length + sectoresEliminados.length; 
    document.getElementById('contadorPendientes').innerText = total;
}

function actualizarDashboard() {
    let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    let counts = { Poste: 0, NAP: 0, Empalme: 0 };
    pendientes.forEach(item => { if (counts[item.Tipo_Elemento] !== undefined) counts[item.Tipo_Elemento]++; });
    
    let total = pendientes.length + sectoresPendientes.length + sectoresEditados.length + sectoresEliminados.length;
    document.getElementById('dash-pendientes-total').innerText = total;
    document.getElementById('pend-postes').innerText = counts.Poste;
    document.getElementById('pend-naps').innerText = counts.NAP;
    document.getElementById('pend-empalmes').innerText = counts.Empalme;
}

async function sincronizarDatos(silencioso = false) {
    let pendientesForm = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    
    // Preparamos los paquetes para enviar
    let paqueteSectoresNuevos = sectoresPendientes.map(sec => ({ Tipo_Elemento: "Sector", Accion: "Crear", SECTOR: sec }));
    let paqueteSectoresEditados = sectoresEditados.map(sec => ({ Tipo_Elemento: "Sector", Accion: "Editar", SECTOR_VIEJO: sec.viejo, SECTOR_NUEVO: sec.nuevo }));
    let paqueteSectoresEliminados = sectoresEliminados.map(sec => ({ Tipo_Elemento: "Sector", Accion: "Eliminar", SECTOR: sec }));

    let todoParaEnviar = [...pendientesForm, ...paqueteSectoresNuevos, ...paqueteSectoresEditados, ...paqueteSectoresEliminados];

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

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`Código ${response.status}: ${txt.substring(0, 100)}`);
        }

        const jsonRespuesta = await response.json();
        
        if (jsonRespuesta.status === "success") {
            if(!silencioso) alert("¡Sincronización exitosa con el Excel!");
            
            // Limpiar TODAS las colas
            localStorage.removeItem('pendientesGPON');
            sectoresPendientes = [];
            sectoresEditados = [];
            sectoresEliminados = [];
            guardarEnMemoria();
            
            renderizarListaSectores();
            actualizarContador();
            actualizarDashboard();
            
            if(document.getElementById('sync-status')) {
                document.getElementById('sync-status').innerText = "Última sinc: " + new Date().toLocaleTimeString();
            }
            obtenerResumenNube(); 
        } else {
            throw new Error(`Google dice: ${jsonRespuesta.message}`);
        }

    } catch (error) {
        alert("❌ ERROR AL SINCRONIZAR:\n\n" + error.message + "\n\nRevisa los permisos en Apps Script.");
    } finally {
        if(!silencioso) {
            btn.innerText = "🔄 Sincronizar";
            if(btnDash) btnDash.innerText = "🔄 Sincronizar Todo";
            btn.disabled = false;
        }
    }
}

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
