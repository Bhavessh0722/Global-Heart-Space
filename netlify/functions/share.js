/* =========================================================
   Netlify Function: /api/share
   GET  -> { posts: [...] }
   POST -> { post: {...} }
   In-memory store (resets on cold start). For persistence,
   connect Netlify Blobs, Fauna, Supabase, or Airtable.
   ========================================================= */

let posts = [
  {
    id: 'seed-1',
    message:
      "I'm 47 and I still haven't told anyone I cry alone in my car before going home. It feels good to finally say it somewhere.",
    mood: 'sad',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    hearts: 12,
  },
  {
    id: 'seed-2',
    message:
      "I dream of leaving everything behind and starting over in another country. I've never told my family. It's the only thought that keeps me going.",
    mood: 'hopeful',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    hearts: 27,
  },
  {
    id: 'seed-3',
    message:
      "I'm surrounded by people and I still feel invisible. If you're reading this and feel the same — you are not alone.",
    mood: 'lost',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    hearts: 41,
  },
];

const BAD_WORDS = [
  // Very small safety blocklist — expand or swap for an API.
  'kill myself', 'suicide', 'terrorist', 'child porn',
];

function containsHarmful(text) {
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ posts: posts.slice(0, 60) }),
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const { message = '', mood = '' } = JSON.parse(event.body || '{}');
      const trimmed = String(message).trim();

      if (trimmed.length < 20 || trimmed.length > 1500) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Message must be 20–1500 characters.' }),
        };
      }
      if (containsHarmful(trimmed)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'This message cannot be shared here. If you are in crisis, please contact a helpline.',
          }),
        };
      }

      const post = {
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        message: trimmed,
        mood: ['sad', 'angry', 'hopeful', 'lost', 'grateful'].includes(mood) ? mood : '',
        timestamp: new Date().toISOString(),
        hearts: 0,
      };

      posts.unshift(post);
      posts = posts.slice(0, 200);

      return { statusCode: 200, headers, body: JSON.stringify({ post }) };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Could not save your message.' }),
      };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
}