export const logError = (module, context, error) => {
    const errorMsg = `[ERROR EN ${module}] - Contexto: ${context} - Detalle: ${error.message || error}`;
    console.error(errorMsg);
    
    // Mostramos el error en la interfaz si estamos en el contenedor principal
    const container = document.getElementById('tab-content-container');
    if (container) {
        container.innerHTML = `
            <div style="background: #2d1b1b; color: #ff6b6b; padding: 20px; border: 1px solid #ff6b6b; border-radius: 8px; margin: 20px;">
                <h3 style="margin-top:0;">⚠️ Error de Sistema</h3>
                <p><strong>Origen:</strong> ${module}</p>
                <p><strong>Detalle:</strong> ${error.message || error}</p>
                <p style="font-size: 0.8em; opacity: 0.7;">Revisa la consola (F12) para más información técnica.</p>
            </div>
        `;
    }
};