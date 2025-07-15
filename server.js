// server.js - Backend Relay para Google Cloud Text-to-Speech
// Este servidor Node.js actúa como un intermediario para la API de Google Cloud TTS.

import express from 'express';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import cors from 'cors';
import dotenv from 'dotenv';

// Cargar variables de entorno desde .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configurar CORS para permitir solicitudes desde tu extensión de Chrome
// Esto es crucial para la seguridad y para que el navegador permita la comunicación.
app.use(cors({
    origin: '*', // Permite cualquier origen. En producción, deberías restringirlo a la URL de tu extensión.
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Middleware para parsear el cuerpo de las solicitudes como JSON
app.use(express.json());

// Inicializa el cliente de Google Cloud Text-to-Speech
// Asegúrate de que GOOGLE_APPLICATION_CREDENTIALS esté configurado en tu entorno
// o que la clave de la API esté disponible de otra forma segura.
// Para Render.com, la variable de entorno GOOGLE_APPLICATION_CREDENTIALS
// debe apuntar al archivo JSON de tu clave de servicio.
const client = new TextToSpeechClient();

// Ruta para la síntesis de texto a voz
app.post('/tts', async (req, res) => {
    const { text } = req.body;

    // Validación básica
    if (!text) {
        return res.status(400).json({ error: { message: 'El texto es requerido.', details: 'No se proporcionó el parámetro "text" en el cuerpo de la solicitud.' } });
    }

    // Configuración de la solicitud a la API de Google Cloud TTS
    const request = {
        input: { text: text },
        // **** CAMBIO CLAVE AQUÍ: Voz más natural (Neural2) ****
        voice: { languageCode: 'es-ES', name: 'es-ES-Neural2-A' }, // Voz femenina natural de España
        // Si prefieres una voz masculina natural de España, usa:
        // voice: { languageCode: 'es-ES', name: 'es-ES-Neural2-B' }, 
        // Si quieres probar una voz de EE. UU. (también muy natural):
        // voice: { languageCode: 'es-US', name: 'es-US-Neural2-A' }, // Voz femenina natural de EE. UU.
        // voice: { languageCode: 'es-US', name: 'es-US-Neural2-B' }, // Voz masculina natural de EE. UU.
        
        audioConfig: { audioEncoding: 'MP3' },
    };

    try {
        // Realiza la llamada a la API de Google Cloud TTS
        const [response] = await client.synthesizeSpeech(request);
        
        // El audioContent es un Buffer, lo enviamos directamente como audio/mpeg
        res.set('Content-Type', 'audio/mpeg');
        res.send(response.audioContent);
    } catch (error) {
        console.error('Backend: Error al llamar a Google Cloud TTS:', error);
        // Manejo de errores más detallado para el cliente
        let errorMessage = 'Error interno del servidor al procesar TTS.';
        if (error.details) {
            errorMessage = error.details; // Google Cloud a menudo proporciona detalles en 'error.details'
        } else if (error.message) {
            errorMessage = error.message;
        }
        res.status(500).json({ error: { message: errorMessage, details: error.stack } });
    }
});

// Ruta de prueba simple para verificar que el servidor está funcionando
app.get('/', (req, res) => {
    res.status(200).send('El servidor de relay de TTS está funcionando.');
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Backend TTS relay escuchando en el puerto ${port}`);
});
