import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Proxy for NVIDIA to avoid CORS
  app.post("/api/chat", async (req, res) => {
    const { apiKey, messages, model } = req.body;

    const selectedModel = model || "z-ai/glm5";
    
    // Fallback keys based on model
    const defaultKeys: Record<string, string> = {
      "z-ai/glm5": "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",
      "meta/llama-3.3-70b-instruct": "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"
    };

    const finalApiKey = apiKey || process.env.NVIDIA_API_KEY || defaultKeys[selectedModel] || defaultKeys["z-ai/glm5"];

    try {
      const openai = new OpenAI({
        apiKey: finalApiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
      });

      // Specific config for different models
      const extraBody: any = {};
      if (selectedModel === "z-ai/glm5") {
        extraBody.chat_template_kwargs = { "enable_thinking": true, "clear_thinking": false };
      } else if (selectedModel === "meta/llama-3.3-70b-instruct") {
        // Llama 3.3 70B Instruct specific parameters if any, otherwise leave empty
      }

      const response: any = await openai.chat.completions.create({
        model: selectedModel,
        messages: messages,
        temperature: 1,
        top_p: 1,
        max_tokens: 16384,
        extra_body: extraBody,
        stream: true,
      } as any);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of response) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.end();
    } catch (error: any) {
      console.error("NVIDIA API Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
