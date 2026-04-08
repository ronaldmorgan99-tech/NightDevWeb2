import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router';

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 60;

type ApiErrorPayload = {
  error?: string;
  code?: string;
  retryable?: boolean;
};

export default function VeoStudioPage() {
  const { user } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProviderDown, setIsProviderDown] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [operationName, setOperationName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return <Navigate to="/login" />;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!image) return;
    setIsGenerating(true);
    setIsProviderDown(false);
    setError(null);
    setVideoUrl(null);
    setOperationName(null);
    setStatus('Initializing generation...');

    try {
      const res = await fetch('/api/media/animate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: image, prompt })
      });

      const data = await res.json() as ApiErrorPayload & { operationName?: string };
      if (!res.ok || data.error) {
        const normalizedError = normalizeMediaError(data, res.status);
        setIsProviderDown(normalizedError.isProviderOutage);
        throw new Error(normalizedError.message);
      }
      
      const operationName = data.operationName;
      if (!operationName) throw new Error('No operation name returned');
      setOperationName(operationName);

      setStatus('Generating video... This may take a few minutes.');

      for (let pollAttempt = 0; pollAttempt < MAX_POLL_ATTEMPTS; pollAttempt += 1) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        const pollRes = await fetch(`/api/media/poll?operationName=${encodeURIComponent(operationName)}`);
        const pollData = await pollRes.json() as ApiErrorPayload & { done?: boolean; uri?: string };

        if (!pollRes.ok || pollData.error) {
          const normalizedError = normalizeMediaError(pollData, pollRes.status);
          setIsProviderDown(normalizedError.isProviderOutage);
          throw new Error(normalizedError.message);
        }

        if (pollData.done && pollData.uri) {
          setVideoUrl(pollData.uri);
          setStatus('Generation complete!');
          setIsGenerating(false);
          return;
        }

        if (pollData.done && !pollData.uri) {
          throw new Error('Generation completed without video output. Please retry.');
        }
      }

      throw new Error('Generation timed out. Please retry with a shorter prompt.');

    } catch (err: any) {
      setError(err.message || 'Failed to generate video');
      setIsGenerating(false);
      setStatus('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Veo Studio</h1>
        <p className="text-zinc-400">Animate your images with Google's Veo video generation model.</p>
        <p className="text-xs text-zinc-500 mt-2">If provider capacity is limited, Studio will pause generation and show retry guidance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div 
            className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 text-center hover:border-indigo-500/50 transition-colors cursor-pointer bg-zinc-900/50"
            onClick={() => fileInputRef.current?.click()}
          >
            {image ? (
              <img src={image} alt="Upload preview" className="max-h-64 mx-auto rounded-lg object-contain" />
            ) : (
              <div className="py-12">
                <div className="text-zinc-400 mb-2">Click to upload an image</div>
                <div className="text-xs text-zinc-600">JPEG or PNG</div>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/jpeg, image/png"
              onChange={handleImageUpload}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Animation Prompt (Required)</label>
            <textarea 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe how you want the image to animate..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none"
            />
          </div>

          <button 
            onClick={handleGenerate}
            disabled={!image || !prompt.trim() || isGenerating || isProviderDown}
            className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Animate Image'}
          </button>
          
          {isProviderDown && (
            <div className="text-amber-300 text-sm bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
              Studio provider is degraded right now. Please retry in a few minutes or contact support if this persists.
            </div>
          )}
          {error && <div className="text-red-400 text-sm bg-red-500/10 p-4 rounded-xl border border-red-500/20">{error}</div>}
          {status && <div className="text-indigo-400 text-sm bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20">{status}</div>}
          {operationName && <div className="text-zinc-500 text-xs">Operation ID: {operationName}</div>}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px]">
          {videoUrl ? (
            <div className="w-full space-y-4">
              <h3 className="text-lg font-medium text-white mb-4">Generated Video</h3>
              <video 
                src={videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full rounded-xl shadow-2xl"
              />
              <p className="text-xs text-zinc-500 text-center">
                Note: To play this video, you may need to append the API key to the request headers, or use a proxy.
              </p>
            </div>
          ) : (
            <div className="text-zinc-600 text-center">
              <div className="mb-2">Your generated video will appear here.</div>
              <div className="text-sm">Aspect Ratio: 16:9 • Resolution: 720p</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function normalizeMediaError(payload: ApiErrorPayload, statusCode: number) {
  const code = payload.code || '';
  const message = payload.error || 'Studio is currently unavailable.';
  const isProviderOutage = statusCode === 503
    || code === 'MEDIA_PROVIDER_UNAVAILABLE'
    || code === 'MEDIA_PROVIDER_FAILURE';

  if (code === 'MEDIA_QUOTA_EXCEEDED') {
    return {
      message: 'You reached the hourly Studio quota. Please wait and try again.',
      isProviderOutage: false
    };
  }

  if (code === 'MEDIA_POLL_RATE_LIMITED' || code === 'MEDIA_POLL_BUDGET_EXCEEDED') {
    return {
      message: 'Polling guardrail triggered. Please restart generation and wait longer between retries.',
      isProviderOutage: false
    };
  }

  return { message, isProviderOutage };
}
