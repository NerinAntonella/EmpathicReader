// Usar sintaxis de import/export para módulos ES
import express from 'express';
import fetch from 'node-fetch'; // node-fetch ya es ESM por defecto en v3+

const app = express();
app.use(express.json());

// La API Key de ElevenLabs se lee de una variable de entorno por seguridad.
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Verificar que la API Key esté configurada
if (!ELEVENLABS_API_KEY) {
  console.error('ERROR: La variable de entorno ELEVENLABS_API_KEY no está configurada en el servidor.');
}

app.post('/tts', async (req, res) => {
  console.log('Backend: Recibida solicitud POST en /tts');
  const { text, voiceId } = req.body;

  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ElevenLabs API Key no configurada en el servidor.' });
  }

  if (!text || !voiceId) {
    return res.status(400).json({ error: 'Faltan parámetros: "text" o "voiceId".' });
  }

  try {
    console.log('Backend: Realizando llamada a ElevenLabs...');
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

    if (!response.ok) {
      const errorData = await response.json(); 
      console.error('Backend: Error de ElevenLabs:', errorData);
      return res.status(response.status).json({ 
        error: 'Error de ElevenLabs', 
        details: errorData.detail || 'Error desconocido de ElevenLabs.' 
      });
    }

    const audio = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    // Para usar Buffer en ESM, necesitas importarlo o asegurarte de que esté disponible globalmente
    // En Render, Node.js ya tiene Buffer globalmente, pero para mayor claridad:
    res.send(Buffer.from(audio)); 
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
