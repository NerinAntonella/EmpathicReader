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

// **** CAMBIO CLAVE: Inicializar el cliente con la API Key directamente ****
let client;
try {
    if (process.env.GOOGLE_TTS_API_KEY) {
        console.log('Backend: Usando GOOGLE_TTS_API_KEY para autenticación.');
        client = new TextToSpeechClient({
            key: process.env.GOOGLE_TTS_API_KEY // Pasa la API Key directamente
        });
    } else {
        console.error('Backend: GOOGLE_TTS_API_KEY no encontrada en las variables de entorno.');
        // Si no hay API Key, el cliente no se puede inicializar correctamente.
        // Esto causará un error si se intenta usar sin credenciales.
        client = new TextToSpeechClient(); // Intentará cargar credenciales por defecto, lo que fallará.
        throw new Error('GOOGLE_TTS_API_KEY no configurada. No se puede autenticar con Google Cloud TTS.');
    }
} catch (e) {
    console.error('Backend: Error al inicializar TextToSpeechClient:', e);
    // Si hay un error al inicializar el cliente, salir del proceso.
    process.exit(1); 
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
        // Realiza la llamada a la API de Google Cloud TTS
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
