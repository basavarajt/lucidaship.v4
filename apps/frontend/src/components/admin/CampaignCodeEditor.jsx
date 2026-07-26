import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import Editor from '@monaco-editor/react';

export default function CampaignCodeEditor({ onCampaignCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [previewText, setPreviewText] = useState('');
  
  const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
.container { max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; }
.hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px 20px; text-align: center; color: white; }
.hero h1 { font-size: 36px; margin-bottom: 10px; font-weight: 700; }
.hero p { font-size: 16px; opacity: 0.95; }
.content { padding: 40px 20px; }
.content h2 { font-size: 24px; margin-bottom: 15px; color: #333; }
.content p { color: #666; line-height: 1.6; margin-bottom: 15px; }
.features { list-style: none; margin: 20px 0; }
.features li { padding: 10px 0; border-bottom: 1px solid #eee; color: #555; }
.features li:before { content: "✓ "; color: #667eea; font-weight: bold; margin-right: 8px; }
</style>
</head>
<body>
<div class="container">
  <div class="hero">
    <h1>Your Campaign Title</h1>
    <p>Your campaign subtitle goes here</p>
  </div>
  <div class="content">
    <h2>What's Inside?</h2>
    <p>Add your compelling message here.</p>
    <ul class="features">
      <li>Feature 1</li>
      <li>Feature 2</li>
      <li>Feature 3</li>
    </ul>
  </div>
</div>
</body>
</html>`;

  const [htmlCode, setHtmlCode] = useState(DEFAULT_TEMPLATE);
  const [preview, setPreview] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const handleCreateCampaign = async () => {
    if (!name || !htmlCode) {
      alert('Name and HTML template are required');
      return;
    }

    setLoading(true);

    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch(`${apiUrl}/api/admin/campaigns/create-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          preview_text: previewText,
          html_template: htmlCode,
          tags: []
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to create campaign');
      }

      const data = await res.json();
      setShareUrl(data.share_url);
      alert('Campaign created successfully!');
      
      if (onCampaignCreated) onCampaignCreated();
      
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-sm">
      {/* Form Section */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4">Campaign Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1">Campaign Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q1 Product Launch"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief internal description"
                rows={2}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1">Preview Text</label>
              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Shown in email clients"
                maxLength={150}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500/50"
              />
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <button 
                onClick={() => setPreview(!preview)}
                className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-colors"
              >
                {preview ? 'Hide Live Preview' : 'Show Live Preview'}
              </button>

              <button 
                onClick={handleCreateCampaign}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Creating...' : 'Create Link Campaign'}
              </button>
            </div>
          </div>
        </div>

        {shareUrl && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
            <h2 className="text-green-400 font-medium mb-2">Success! Share Campaign</h2>
            <p className="text-gray-400 text-xs mb-4">Share this link on LinkedIn to collect emails.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs overflow-hidden"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  alert('Link copied to clipboard!');
                }}
                className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg font-medium transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor Section */}
      <div className={preview ? 'lg:col-span-4' : 'lg:col-span-9'}>
        <div className="bg-black border border-white/10 rounded-xl overflow-hidden h-[700px] flex flex-col">
          <div className="bg-white/5 border-b border-white/10 px-4 py-2 flex items-center justify-between">
            <h2 className="text-gray-300 font-mono text-xs">HTML Editor</h2>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              defaultLanguage="html"
              value={htmlCode}
              onChange={(value) => setHtmlCode(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                wordWrap: 'on',
                fontSize: 14,
                padding: { top: 16 }
              }}
            />
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {preview && (
        <div className="lg:col-span-5">
          <div className="bg-white border border-white/10 rounded-xl overflow-hidden h-[700px] flex flex-col">
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 text-black">
              <h2 className="font-mono text-xs">Live Rendering</h2>
            </div>
            <div className="flex-1 bg-white">
              <iframe
                title="preview"
                srcDoc={htmlCode}
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
