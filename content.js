// content.js - Versión: 2025-07-15_V_FINAL_CONFIRM
// Este script interactúa con el contenido de la página web y reproduce el audio.
console.log('content.js: Script inyectado en la página. Versión: 2025-07-15_V_FINAL_CONFIRM');

let audioPlayer = null; // Elemento de audio para la reproducción.
let backgroundPort = null; // Puerto de comunicación con background.js.

// Conectarse a background.js automáticamente al inyectarse.
backgroundPort = chrome.runtime.connect({ name: "tts_port_from_content_script" });

// Configura el listener para mensajes que vienen de background.js a través de este puerto.
backgroundPort.onMessage.addListener((message) => {
    console.log('content.js: Mensaje recibido en Port desde background.js:', message.action || message.status);

    // Recibir el mensaje para iniciar procesamiento.
    if (message.action === 'startContentProcessing') {
        console.log('content.js: Mensaje "startContentProcessing" recibido desde background.js (Port). Iniciando análisis de página.');
        
        // Mostrar indicador de carga al iniciar el procesamiento.
        showLoadingIndicator('Analizando página y preparando audio...');

        const pageTitle = document.title;
        console.log('content.js: Título de la página:', pageTitle);

        const sections = [];
        const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        const structuralTags = ['nav', 'main', 'article', 'section', 'footer'];

        headingTags.forEach(tag => {
            document.querySelectorAll(tag).forEach(element => {
                if (element.textContent.trim() !== '') {
                    sections.push({ type: tag, text: element.textContent.trim(), id: element.id || null });
                }
            });
        });

        structuralTags.forEach(tag => {
            document.querySelectorAll(tag).forEach(element => {
                const elementText = element.textContent.trim();
                if (elementText !== '' && !sections.some(s => s.id === element.id && s.text.startsWith(elementText.substring(0, 50)))) {
                     sections.push({ type: tag, text: elementText, id: element.id || null });
                }
            });
        });

        console.log('content.js: Secciones identificadas:', sections);

        const pageContentToSpeak = pageTitle + ". " +
            (sections && sections.length > 0 ?
             sections.map(s => s.text).join(". ") :
             "No se encontraron secciones principales en la página.");

        console.log('content.js: Solicitando audio a background.js para el texto a través del Port:', pageContentToSpeak.substring(0, 200) + '...');

        // Envía la solicitud de audio a background.js a través del puerto.
        backgroundPort.postMessage({ 
            action: 'requestAudioForText', 
            textToSpeak: pageContentToSpeak
        });
    }

    // Recibir el audio final (base64) de background.js.
    else if (message.status === 'audio_ready') {
        console.log('content.js: Audio Data (base64) recibido de background.js a través del Port.');
        const base64Audio = message.audioData;

        // Ocultar indicador de carga al recibir el audio.
        removeLoadingIndicator();

        if (base64Audio) {
            fetch(base64Audio)
                .then(response => response.blob())
                .then(audioBlob => {
                    console.log('content.js: Base64 convertido a Blob. Intentando reproducir.');
                    playAudioFromBlob(audioBlob);
                })
                .catch(error => {
                    console.error('content.js: Error al convertir base64 a Blob o al reproducir:', error);
                    const fallbackText = 'Error al procesar audio. Revisa la consola.';
                    const utterance = new SpeechSynthesisUtterance(fallbackText);
                    utterance.lang = 'es-ES';
                    speechSynthesis.speak(utterance);
                });
        } else {
            console.error('content.js: No se recibió una cadena base64 de audio válida.');
            const fallbackText = 'No se pudo obtener el audio. Revisa la consola para más detalles.';
            const utterance = new SpeechSynthesisUtterance(fallbackText);
            utterance.lang = 'es-ES';
            speechSynthesis.speak(utterance);
        }
    } 
    // Recibir errores de background.js.
    else if (message.status === 'error') {
        console.error('content.js: Error recibido de background.js a través del Port:', message.message);
        // Ocultar indicador de carga y mostrar mensaje de error.
        removeLoadingIndicator();
        showErrorMessage(`Error: ${message.message}`);
        const fallbackText = `Error del servicio de voz: ${message.message}. Revisa la consola.`;
        const utterance = new SpeechSynthesisUtterance(fallbackText);
        utterance.lang = 'es-ES';
        speechSynthesis.speak(utterance);
    }
});

// Maneja la desconexión del puerto.
backgroundPort.onDisconnect.addListener(() => {
    console.log('content.js: Puerto a background.js desconectado.');
    backgroundPort = null;
    removeAudioControls();
    removePlayButton();
    // Ocultar indicador de carga si el puerto se desconecta.
    removeLoadingIndicator();
});

// Enviar mensaje de "ready" a background.js una vez que el content script esté listo.
if (backgroundPort) {
    console.log('content.js: Enviando mensaje "content_ready" a background.js.');
    backgroundPort.postMessage({ action: 'content_ready' });
} else {
    console.error('content.js: No se pudo establecer la conexión con background.js al inicio.');
}

// Listener para el mensaje 'speakText' (fallback de Web Speech API).
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'speakText') {
        console.log('content.js: Mensaje "speakText" recibido (fallback):', request.text);
        
        const utterance = new SpeechSynthesisUtterance(request.text);
        utterance.lang = 'es-ES';
        utterance.volume = 1;
        utterance.rate = 1;
        utterance.pitch = 1;

        speechSynthesis.speak(utterance);

        utterance.onend = () => {
            console.log('content.js: Reproducción de texto (fallback) finalizada.');
            sendResponse({ status: 'speech_ended' });
        };
        utterance.onerror = (e) => {
            console.error('content.js: Error en Web Speech API (fallback):', e);
            sendResponse({ status: 'speech_error', error: e.message });
        };

        return true;
    }
});


function playAudioFromBlob(audioBlob) {
    console.log('content.js: Intentando reproducir audio desde Blob.');

    if (!audioBlob) {
        console.error('content.js: Blob de audio inválido para reproducción.');
        return;
    }

    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.remove();
        audioPlayer = null;
    }
    removeAudioControls();
    removePlayButton();
    removeLoadingIndicator(); // Asegurarse de que el loader se quite al intentar reproducir.

    const audioUrl = URL.createObjectURL(audioBlob);
    console.log('content.js: URL de audio creada:', audioUrl);

    audioPlayer = new Audio(audioUrl);
    audioPlayer.volume = 1.0;

    audioPlayer.onended = () => {
        console.log('content.js: Reproducción de audio finalizada.');
        URL.revokeObjectURL(audioUrl);
        audioPlayer = null;
        removeAudioControls();
    };

    audioPlayer.onerror = (e) => {
        console.error('content.js: Error al reproducir audio:', e);
        URL.revokeObjectURL(audioUrl);
        audioPlayer = null;
        removeAudioControls();
    };

    audioPlayer.play().then(() => {
        console.log('content.js: Audio reproduciéndose correctamente.');
        showAudioControls();
    }).catch(e => {
        console.error('content.js: Error al intentar reproducir audio (autoplay policy?):', e);
        if (e.name === "NotAllowedError" || e.name === "AbortError") {
            console.warn('content.js: Reproducción automática bloqueada. Mostrando botón de reproducción manual.');
            showPlayButton(audioUrl);
        }
        URL.revokeObjectURL(audioUrl);
        audioPlayer = null;
    });
}

function showAudioControls() {
    removeAudioControls();

    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'tts-audio-controls';
    controlsDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        padding: 15px;
        background: rgba(51, 51, 51, 0.9);
        color: white;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        display: flex;
        gap: 10px;
        align-items: center;
        font-family: 'Inter', sans-serif;
    `;

    controlsDiv.innerHTML = `
        <span style="font-size: 16px; font-weight: bold;">🔊 Asistente:</span>
        <button id="tts-pause-btn" style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 18px; transition: background 0.2s;">⏸️</button>
        <button id="tts-stop-btn" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 18px; transition: background 0.2s;">⏹️</button>
        <button id="tts-close-btn" style="background: #6c757d; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 18px; transition: background 0.2s;">✖️</button>
    `;
    
    document.body.appendChild(controlsDiv);

    const pauseBtn = controlsDiv.querySelector('#tts-pause-btn');
    const stopBtn = controlsDiv.querySelector('#tts-stop-btn');
    const closeBtn = controlsDiv.querySelector('#tts-close-btn');

    pauseBtn.onclick = () => {
        if (audioPlayer) {
            if (audioPlayer.paused) {
                audioPlayer.play();
                pauseBtn.textContent = '⏸️';
            } else {
                audioPlayer.pause();
                pauseBtn.textContent = '▶️';
            }
        }
    };

    stopBtn.onclick = () => {
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            removeAudioControls();
        }
    };

    closeBtn.onclick = () => {
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            audioPlayer = null;
        }
        removeAudioControls();
    };
}

function removeAudioControls() {
    const controls = document.getElementById('tts-audio-controls');
    if (controls) {
        controls.remove();
    }
}

function showPlayButton(audioURL) {
    removePlayButton();

    const playButton = document.createElement('button');
    playButton.id = 'playAssistantAudioButton';
    playButton.textContent = '▶️ Escuchar Asistente';
    playButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        padding: 12px 20px;
        background: linear-gradient(145deg, #4CAF50, #45a049);
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-size: 16px;
        font-weight: bold;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        transition: transform 0.2s ease-in-out, background 0.2s ease-in-out;
    `;

    playButton.onmouseover = () => {
        playButton.style.transform = 'scale(1.05)';
        playButton.style.background = 'linear-gradient(145deg, #45a049, #3b8e3f)';
    };
    playButton.onmouseout = () => {
        playButton.style.transform = 'scale(1)';
        playButton.style.background = 'linear-gradient(145deg, #4CAF50, #45a049)';
    };

    playButton.onclick = () => {
        const audio = new Audio(audioURL); 
        audio.play().then(() => {
            console.log('Audio manual reproduciéndose correctamente.');
            removePlayButton();
            audioPlayer = audio;
            showAudioControls();
        }).catch(error => {
            console.error('Error al reproducir audio manualmente:', error);
        });
    };

    document.body.appendChild(playButton);
}

function removePlayButton() {
    const button = document.getElementById('playAssistantAudioButton');
    if (button) {
        button.remove();
    }
}
