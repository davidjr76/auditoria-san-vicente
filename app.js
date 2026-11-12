const API_URL = "https://script.google.com/macros/s/AKfycbyRHcQnQIpcG4OvYDAHkhmKXV8BFbcFbIZr1hcnu9PnAiIjeFEipb7EHMLbcnxMSzDN/exec";

document.addEventListener('DOMContentLoaded', () => {
    actualizarContador();
    verificarConexion();
    configurarBotonesGPS();
});

// 1. CONFIGURAR BOTONES DE GPS PARA CADA FORMULARIO
function configurarBotonesGPS() {
    const botonesGPS = document.querySelectorAll('.btn-gps');
    botonesGPS.forEach(btn => {
        btn.addEventListener('click', function() {
            const form = this.closest('form'); // Encuentra el formulario al que pertenece
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

// 2. GUARDAR CUALQUIER FORMULARIO ENVIADO
const formularios = document.querySelectorAll('.form-auditoria');
formularios.forEach(form => {
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Recopilar todos los datos del formulario actual
        const formData = new FormData(this);
        const nuevoElemento = {};
        formData.forEach((value, key) => { nuevoElemento[key] = value; });
        
        // Agregar ID único y fecha
        nuevoElemento.id_local = Date.now();
        nuevoElemento.fecha = new Date().toISOString();

        // Guardar en la memoria del celular (LocalStorage)
        let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
        pendientes.push(nuevoElemento);
        localStorage.setItem('pendientesGPON', JSON.stringify(pendientes));

        alert(`¡${nuevoElemento.Tipo_Elemento} guardado con éxito!`);
        this.reset();
        actualizarContador();
    });
});

// 3. ACTUALIZAR CONTADOR
function actualizarContador() {
    let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    document.getElementById('contadorPendientes').innerText = pendientes.length;
}

// 4. SINCRONIZAR CON GOOGLE SHEETS (Enviar todo)
async function sincronizarDatos() {
    let pendientes = JSON.parse(localStorage.getItem('pendientesGPON')) || [];
    
    if (pendientes.length === 0) {
        alert("No hay datos nuevos para sincronizar.");
        return;
    }

    if (!navigator.onLine) {
        alert("No hay internet. Conéctate a Wi-Fi o datos para sincronizar.");
        return;
    }

    // Cambiamos el estado del botón para que el usuario sepa que está cargando
    const btn = document.querySelector('.btn-info');
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Sincronizando...";
    btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            // AQUÍ ESTÁ EL TRUCO: Usar text/plain evita el bloqueo del navegador (CORS)
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify(pendientes)
        });

        if (response.ok) {
            alert("¡Sincronización exitosa con Google Sheets!");
            localStorage.removeItem('pendientesGPON'); // Limpiar memoria
            actualizarContador();
        } else {
            alert("El servidor de Google rechazó los datos. Revisa los permisos en Apps Script.");
        }
    } catch (error) {
        console.error(error);
        alert("Error de red al sincronizar. Revisa tu conexión a internet o la URL del script.");
    } finally {
        // Restauramos el botón
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
}

// Control de estado de red
function verificarConexion() {
    const badge = document.getElementById('statusConexion');
    if(navigator.onLine) {
        badge.innerText = "Online";
        badge.className = "badge bg-success";
    } else {
        badge.innerText = "Offline";
        badge.className = "badge bg-danger";
    }
}
window.addEventListener('online', verificarConexion);
window.addEventListener('offline', verificarConexion);
