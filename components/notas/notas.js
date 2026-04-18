import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

// --- SISTEMA DE ETIQUETADO SEMÁNTICO LOCAL (NLP Básico) ---
// Categoriza automáticamente las notas según las palabras clave que detecta
const semanticTags = [
    { name: '🛒 Compras', keywords: ['comprar', 'mercado', 'precio', 'tienda', 'pago', 'factura', 'supermercado'] },
    { name: '💼 Trabajo', keywords: ['jefe', 'reunión', 'proyecto', 'oficina', 'cliente', 'reporte', 'trabajo'] },
    { name: '💡 Ideas', keywords: ['idea', 'pensar', 'inventar', 'quizás', 'proyecto', 'crear', 'imaginación'] },
    { name: '📚 Estudio', keywords: ['tarea', 'examen', 'leer', 'aprender', 'curso', 'universidad', 'libro'] },
    { name: '💻 Código', keywords: ['script', 'html', 'javascript', 'bug', 'error', 'programar', 'función', '```'] }
];

function analyzeSemantics(text) {
    const textLower = text.toLowerCase();
    let tagsFound = [];
    semanticTags.forEach(category => {
        const hasKeyword = category.keywords.some(kw => textLower.includes(kw));
        if (hasKeyword) tagsFound.push(category.name);
    });
    return tagsFound;
}

// --- MOTOR DE AUTO-MARKDOWN (Zero Cost) ---
// Convierte texto crudo en HTML visual al instante
function parseMarkdown(text) {
    let html = text
        // Bloques de código (Snippet Vault)
        .replace(/```([\s\S]*?)```/g, '<div class="md-code-block">$1</div>')
        // Código en línea
        .replace(/`([^`]+)`/g, '<span class="md-code-inline">$1</span>')
        // Títulos
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h3>$1</h3>')
        .replace(/^# (.*$)/gim, '<h3 style="color:var(--note-accent); font-size:1.4em;">$1</h3>')
        // Negritas
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        // Listas
        .replace(/^\- (.*$)/gim, '• $1<br>')
        // Saltos de línea
        .replace(/\n/g, '<br>');
    return `<div class="md-content">${html}</div>`;
}

// --- GESTIÓN CRUD DE NOTAS ---
window.saveNote = () => {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    
    if (!title && !content) return alert('La nota está vacía.');

    if (!state.notes) state.notes = [];
    
    const newNote = {
        id: Date.now(),
        title: title || 'Sin Título',
        content: content,
        date: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        tags: analyzeSemantics(title + " " + content)
    };

    state.notes.unshift(newNote); // Añadir al inicio
    
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    
    recordActivity(); saveDataToCloud(); window.renderNotes(); updateMindGraph();
};

window.renderNotes = () => {
    const grid = document.getElementById('notesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!state.notes || state.notes.length === 0) {
        grid.innerHTML = '<div style="color: #8b949e; width: 100%; text-align: center; grid-column: 1 / -1; padding: 40px;">No hay notas. Escribe algo arriba para comenzar.</div>';
        return;
    }

    state.notes.forEach((note, index) => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.onclick = () => openNoteModal(index);

        // Header (Título y Fecha)
        const header = document.createElement('div');
        header.style.marginBottom = '10px';
        header.innerHTML = `
            <div style="font-weight:bold; color:white; font-size:1.1em; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${note.title}</div>
            <div style="font-size:0.75em; color:#8b949e;">${note.date}</div>
        `;

        // Contenido parseado por el motor Markdown
        const body = document.createElement('div');
        body.style.flexGrow = '1';
        body.style.overflow = 'hidden';
        body.style.maskImage = 'linear-gradient(to bottom, black 50%, transparent 100%)';
        body.style.webkitMaskImage = '-webkit-linear-gradient(top, black 50%, transparent 100%)';
        body.innerHTML = parseMarkdown(note.content);

        // Footer (Etiquetas Semánticas)
        const footer = document.createElement('div');
        footer.style.marginTop = '15px';
        
        let tagsHtml = '';
        if(note.tags && note.tags.length > 0) {
            note.tags.forEach(t => tagsHtml += `<span class="tag-chip">${t}</span>`);
        } else {
            tagsHtml = `<span class="tag-chip" style="color:#8b949e; border-color:transparent; background:rgba(255,255,255,0.05);">📝 Nota</span>`;
        }
        footer.innerHTML = tagsHtml;

        card.append(header, body, footer);
        grid.appendChild(card);
    });

    handleTimeCapsule();
};

// --- MODAL DE EDICIÓN ---
let currentEditIndex = null;
window.openNoteModal = (index) => {
    currentEditIndex = index;
    const note = state.notes[index];
    document.getElementById('editNoteTitle').value = note.title;
    document.getElementById('editNoteContent').value = note.content;
    document.getElementById('noteModal').style.display = 'flex';
};

window.closeNoteModal = () => { document.getElementById('noteModal').style.display = 'none'; currentEditIndex = null; };

window.updateNote = () => {
    if (currentEditIndex === null) return;
    const title = document.getElementById('editNoteTitle').value.trim();
    const content = document.getElementById('editNoteContent').value.trim();
    
    state.notes[currentEditIndex].title = title || 'Sin Título';
    state.notes[currentEditIndex].content = content;
    state.notes[currentEditIndex].tags = analyzeSemantics(title + " " + content);
    
    recordActivity(); saveDataToCloud(); window.renderNotes(); updateMindGraph(); closeNoteModal();
};

window.deleteNote = () => {
    if (currentEditIndex === null) return;
    if(confirm('¿Eliminar esta nota para siempre?')) {
        state.notes.splice(currentEditIndex, 1);
        recordActivity(); saveDataToCloud(); window.renderNotes(); updateMindGraph(); closeNoteModal();
    }
};

// --- WIDGET: CÁPSULA DEL TIEMPO (Serendipity Feature) ---
function handleTimeCapsule() {
    const capsule = document.getElementById('timeCapsule');
    if (!state.notes || state.notes.length < 3) {
        capsule.style.display = 'none';
        return;
    }
    
    // Solo mostrar aleatoriamente (ej: 40% de las veces al cargar la app)
    if(Math.random() > 0.6) {
        capsule.style.display = 'block';
        // Elegir una nota aleatoria que no sea de las 2 más recientes
        const randIndex = Math.floor(Math.random() * (state.notes.length - 2)) + 2;
        const oldNote = state.notes[randIndex];
        
        let preview = oldNote.content.substring(0, 100).replace(/\n/g, ' ');
        if(preview.length === 100) preview += '...';
        
        document.getElementById('tcContent').innerHTML = `<strong>${oldNote.title}</strong>: "${preview}"`;
        
        capsule.onclick = () => window.openNoteModal(randIndex);
    } else {
        capsule.style.display = 'none';
    }
}

// --- WIDGET: RED NEURONAL 3D (Mind Graph) ---
let graphAnimFrame;
let isGraphActive = false;

function updateMindGraph() {
    const canvas = document.getElementById('mindGraph');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    const numNodes = state.notes ? Math.max(state.notes.length, 5) : 5;
    document.getElementById('graphStats').innerText = `${state.notes ? state.notes.length : 0} nodos | Sistema Activo`;

    let particles = [];
    for(let i=0; i < Math.min(numNodes, 40); i++) { // Límite de 40 nodos para performance
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5, // Velocidad súper lenta y zen
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 1
        });
    }

    function animate() {
        if(!isGraphActive) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Actualizar y dibujar partículas
        for(let i=0; i < particles.length; i++) {
            let p = particles[i];
            p.x += p.vx; p.y += p.vy;
            
            // Rebote en bordes
            if(p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if(p.y < 0 || p.y > canvas.height) p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(88, 166, 255, 0.8)';
            ctx.fill();

            // Dibujar líneas neuronales
            for(let j=i+1; j < particles.length; j++) {
                let p2 = particles[j];
                let dist = Math.sqrt(Math.pow(p.x - p2.x, 2) + Math.pow(p.y - p2.y, 2));
                
                if(dist < 100) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    // Opacidad basada en la cercanía
                    ctx.strokeStyle = `rgba(88, 166, 255, ${1 - dist/100})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        graphAnimFrame = requestAnimationFrame(animate);
    }
    
    if(graphAnimFrame) cancelAnimationFrame(graphAnimFrame);
    isGraphActive = true;
    animate();
}

export function init() {
    window.renderNotes();
    updateMindGraph();
}

// Apagar el canvas cuando el usuario cambia de pestaña para no consumir batería
window.addEventListener('stateChanged', () => { 
    if(!document.getElementById('view-notas')) { 
        isGraphActive = false; 
        if(graphAnimFrame) cancelAnimationFrame(graphAnimFrame);
    } else {
        init();
    }
});
