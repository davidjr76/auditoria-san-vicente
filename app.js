const API_URL = "https://script.google.com/macros/s/AKfycbyRHcQnQIpcG4OvYDAHkhmKXV8BFbcFbIZr1hcnu9PnAiIjeFEipb7EHMLbcnxMSzDN/exec";

document.addEventListener('DOMContentLoaded', () => {
    // Configurar nombre del auditor
    let auditorGuardado = localStorage.getItem('auditor_nombre');
    if (!auditorGuardado) {
        let nombre = prompt("Ingresa tu nombre (Auditor):", "Auditor 1");
        if (nombre) localStorage.setItem('auditor_nombre', nombre);
        auditorGuardado = nombre;
    }

    // Autocompletar fechas y nombres en todos los formularios
    let hoy = new Date().toISOString().split('T')[0];
    document.querySelectorAll('.fecha-auto').forEach(el => el.value = hoy);
    document.querySelectorAll('.auditor-auto').forEach(el => el.value = auditorGuardado);
    document.querySelectorAll('.fecha-incidencia').forEach(el => el.value = hoy);

    actualizarContador();
    actualizarDashboard();
    verificarConexion();
    configurarBotonesGPS();
});

// 1. CONFIGURAR BOTONES DE GPS
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

// 2. GUARDAR CUALQUIER FORMULARIO
const formularios = document.querySelectorAll('.form-auditoria');
formularios.forEach(form => {
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);
        const nuevoElemento = {};
        formData.forEach((value, key) => { nuevoElemento[key] = value; });
        
        // IDs únicos y fecha de guardado real
        nuevoElemento.id_local = Date.now();
        nuevoElemento.fecha_sistema = new Date().toISOString();

        let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
        pendientes.push(nuevoElemento);
        localStorage.setItem('pendientesGPON', JSON.stringify(pendientes));

        alert(`¡${nuevoElemento.Tipo_Elemento} guardado localmente!`);
        this.reset();
        
        // Restaurar valores por defecto tras reset
        let hoy = new Date().toISOString().split('T')[0];
        this.querySelectorAll('.fecha-auto').forEach(el => el.value = hoy);
        this.querySelectorAll('.auditor-auto').forEach(el => el.value = localStorage.getItem('auditor_nombre'));
        this.querySelectorAll('.fecha-incidencia').forEach(el => el.value = hoy);

        actualizarContador();
        actualizarDashboard();
    });
});

// 3. ACTUALIZAR DASHBOARD
function actualizarContador() {
    let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    document.getElementById('contadorPendientes').innerText = pendientes.length;
}

function actualizarDashboard() {
    let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    let counts = { Poste: 0, NAP: 0, Empalme: 0 };
    pendientes.forEach(item => {
        if (counts[item.Tipo_Elemento] !== undefined) counts[item.Tipo_Elemento]++;
    });
    document.getElementById('dash-pendientes-total').innerText = pendientes.length;
    document.getElementById('pend-postes').innerText = counts.Poste;
    document.getElementById('pend-naps').innerText = counts.NAP;
    document.getElementById('pend-empalmes').innerText = counts.Empalme;
}

// 4. SINCRONIZAR CON GOOGLE SHEETS
async function sincronizarDatos() {
    let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    if (pendientes.length === 0) return alert("No hay datos nuevos para sincronizar.");
    if (!navigator.onLine) return alert("No hay internet.");

    const btn = document.querySelector('.btn-info');
    const btnDash = document.querySelector('button[onclick="sincronizarDatos()"]');
    btn.innerText = "⏳ Sincronizando...";
    if(btnDash) btnDash.innerText = "⏳ Sincronizando...";
    btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            redirect: 'follow', // <-- AÑADE ESTA LÍNEA
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(pendientes)
        });

        if (response.ok) {
            alert("¡Sincronización exitosa con el Excel!");
            localStorage.removeItem('pendientesGPON');
            actualizarContador();
            actualizarDashboard();
            document.getElementById('sync-status').innerText = "Última sinc: " + new Date().toLocaleTimeString();
            obtenerResumenNube(); 
        } else {
            alert("Error del servidor. Verifica los permisos en Apps Script.");
        }
    } catch (error) {
        alert("Error de red al sincronizar.");
    } finally {
        btn.innerText = "🔄 Sincronizar";
        if(btnDash) btnDash.innerText = "🔄 Sincronizar Todo";
        btn.disabled = false;
    }
}

// 5. OBTENER TOTALES DE LA NUBE
async function obtenerResumenNube() {
    if (!navigator.onLine) return alert("Necesitas internet para ver los totales.");
    const btn = document.querySelector('button[onclick="obtenerResumenNube()"]');
    btn.innerText = "⏳ Cargando...";
    btn.disabled = true;

    try {
        const response = await fetch(API_URL); 
        const data = await response.json();
        if (data.status === "success") {
            document.getElementById('total-postes').innerText = data.totales.postes;
            document.getElementById('total-naps').innerText = data.totales.naps;
            document.getElementById('total-empalmes').innerText = data.totales.empalmes;
        }
    } catch (error) {
        alert("Error al leer totales.");
    } finally {
        btn.innerText = "☁️ Actualizar Totales de Google Sheets";
        btn.disabled = false;
    }
}

function verificarConexion() {
    const badge = document.getElementById('statusConexion');
    if(navigator.onLine) { badge.innerText = "Online"; badge.className = "badge bg-success"; }
    else { badge.innerText = "Offline"; badge.className = "badge bg-danger"; }
}
window.addEventListener('online', verificarConexion);
window.addEventListener('offline', verificarConexion);
