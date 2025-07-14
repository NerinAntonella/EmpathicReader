import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// La API Key de Google Cloud TTS se lee de una variable de entorno.
// Asegúrate de configurar GOOGLE_TTS_API_KEY en Render.com
const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY;

// Verificar que la API Key esté configurada
if (!GOOGLE_TTS_API_KEY) {
  console.error('ERROR: La variable de entorno GOOGLE_TTS_API_KEY no está configurada en el servidor.');
}

app.post('/tts', async (req, res) => {
  console.log('Backend: Recibida solicitud POST en /tts');
  const { text } = req.body; // Google TTS no usa un 'voiceId' de ElevenLabs, sino un 'voice' object.

  if (!GOOGLE_TTS_API_KEY) {
    return res.status(500).json({ error: 'Google TTS API Key no configurada en el servidor.' });
  }

  if (!text) {
    return res.status(400).json({ error: 'Faltan parámetros: "text".' });
  }

  try {
    console.log('Backend: Realizando llamada a Google Cloud Text-to-Speech...');

    // Configuración de la solicitud para Google Cloud TTS
    const googleTTSResponse = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text: text },
        // Configuración de la voz en español (Argentina si es posible, o general)
        // Puedes explorar más voces en la documentación de Google Cloud TTS
        // 'es-AR-Standard-A' es una opción para español de Argentina (si está disponible en tu nivel de servicio)
        // 'es-ES-Standard-A' o 'es-ES-Wavenet-A' son voces estándar en español
        voice: { languageCode: 'es-ES', name: 'es-AR-Standard-A' }, 
        audioConfig: { audioEncoding: 'MP3' },
      }),
    });

    if (!googleTTSResponse.ok) {
      const errorData = await googleTTSResponse.json(); 
      console.error('Backend: Error de Google Cloud TTS:', errorData);
      return res.status(googleTTSResponse.status).json({ 
        error: 'Error de Google Cloud TTS', 
        details: errorData.error.message || 'Error desconocido de Google TTS.' 
      });
    }

    const responseData = await googleTTSResponse.json();
    if (!responseData.audioContent) {
        console.error('Backend: No se recibió contenido de audio de Google TTS.');
        return res.status(500).json({ error: 'No se recibió contenido de audio de Google TTS.' });
    }

    // El audio de Google TTS viene en base64, necesitamos decodificarlo
    const audioBuffer = Buffer.from(responseData.audioContent, 'base64');
    
    res.set('Content-Type', 'audio/mpeg'); // Establecer el tipo de contenido como audio MPEG
    res.send(audioBuffer); // Enviar el buffer de audio
    console.log('Backend: Audio enviado con éxito.');

  } catch (error) {
    console.error('Backend: Error interno del servidor al procesar TTS:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud de TTS.' });
  }
});

const PORT = process.env.PORT || 3001; 
app.listen(PORT, () => {
  console.log(`Relay backend corriendo en el puerto ${PORT}`);
});
