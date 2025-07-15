// server.js - Backend Relay para Google Cloud Text-to-Speech
// Este servidor Node.js actúa como un intermediario para la API de Google Cloud TTS.

import express from 'express';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import cors from 'cors';
import dotenv from 'dotenv'; // Todavía útil para desarrollo local si usas .env

// Cargar variables de entorno desde .env (para desarrollo local)
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configurar CORS
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Middleware para parsear el cuerpo de las solicitudes como JSON
app.use(express.json());

// **** CAMBIO CLAVE: Configurar las credenciales de Google Cloud ****
let client;
try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        // Si la variable de entorno GOOGLE_APPLICATION_CREDENTIALS_JSON existe (en Render.com)
        // parseamos su contenido como un objeto JSON de credenciales.
        console.log('Backend: Usando credenciales de GOOGLE_APPLICATION_CREDENTIALS_JSON.');
        client = new TextToSpeechClient({
            credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        });
    } else {
        // Para desarrollo local, si GOOGLE_APPLICATION_CREDENTIALS apunta a un archivo.
        // O si no hay ninguna variable, intentará cargar las credenciales por defecto.
        console.log('Backend: No se encontró GOOGLE_APPLICATION_CREDENTIALS_JSON. Intentando credenciales por defecto.');
        client = new TextToSpeechClient();
    }
} catch (e) {
    console.error('Backend: Error al inicializar TextToSpeechClient con credenciales:', e);
    // Si hay un error al parsear el JSON, el servidor no debería iniciar.
    process.exit(1); // Salir del proceso Node.js con un código de error.
}
// **** FIN CAMBIO CLAVE ****


// Ruta para la síntesis de texto a voz
app.post('/tts', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: { message: 'El texto es requerido.', details: 'No se proporcionó el parámetro "text" en el cuerpo de la solicitud.' } });
    }

    const request = {
        input: { text: text },
        voice: { languageCode: 'es-ES', name: 'es-ES-Neural2-A' }, 
        audioConfig: { audioEncoding: 'MP3' },
    };

    try {
        const [response] = await client.synthesizeSpeech(request);
        
        res.set('Content-Type', 'audio/mpeg');
        res.send(response.audioContent);
    } catch (error) {
        console.error('Backend: Error al llamar a Google Cloud TTS:', error);
        let errorMessage = 'Error interno del servidor al procesar TTS.';
        if (error.details) {
            errorMessage = error.details;
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
