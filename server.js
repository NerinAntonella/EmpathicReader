const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();
app.use(express.json());

// La API Key de ElevenLabs se lee de una variable de entorno por seguridad.
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Verificar que la API Key esté configurada
if (!ELEVENLABS_API_KEY) {
  console.error('ERROR: La variable de entorno ELEVENLABS_API_KEY no está configurada en el servidor.');
  // Si la API Key no está configurada, el servidor devolverá un error 500 para las peticiones TTS.
}

app.post('/tts', async (req, res) => {
  const { text, voiceId } = req.body;

  if (!ELEVENLABS_API_KEY) {
    // Devolver un error si la API Key no está configurada
    return res.status(500).json({ error: 'ElevenLabs API Key no configurada en el servidor.' });
  }

  if (!text || !voiceId) {
    // Devolver un error si faltan parámetros en la solicitud
    return res.status(400).json({ error: 'Faltan parámetros: "text" o "voiceId".' });
  }

  try {
    // Llamada a ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    });

    // Manejo de errores de ElevenLabs
    if (!response.ok) {
      // Si ElevenLabs devuelve un error (ej. 401 Unauthorized, 402 Payment Required, 400 Bad Request),
      // leer el mensaje de error de ElevenLabs (generalmente en formato JSON)
      const errorData = await response.json(); 
      console.error('Error de ElevenLabs:', errorData);
      // Devolver el error de ElevenLabs a la extensión con el mismo código de estado que ElevenLabs envió
      return res.status(response.status).json({ 
        error: 'Error de ElevenLabs', 
        details: errorData.detail || 'Error desconocido de ElevenLabs.' 
      });
    }

    // Si la respuesta de ElevenLabs es OK, entonces es audio
    const audio = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg'); // Establecer el tipo de contenido como audio MPEG
    res.send(Buffer.from(audio)); // Enviar el buffer de audio

  } catch (error) {
    // Capturar cualquier otro error que ocurra durante la petición o procesamiento
    console.error('Error en el backend-relay al procesar TTS:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud de TTS.' });
  }
});

app.listen(3001, () => {
  console.log('Relay backend corriendo en http://localhost:3001');
});
