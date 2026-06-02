import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set limits to handle base64 images from camera capture
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Initialize Gemini API client securely
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Endpoints go here FIRST
  app.post("/api/gemini/identify-cake", async (req, res) => {
    try {
      const { image, items } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on this server." });
      }

      // Base64 image extraction
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let mimeType = "image/png";
      let base64Data = image;

      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      }

      // Build listing of current catalog for matching
      const catalogDescription = items
        .map((it: any) => `- ID: "${it.id}", Name: "${it.name}", Category: "${it.category}"`)
        .join("\n");

      const prompt = `You are an expert AI pastry chef. Analyze the visually provided image of a cake, cheesecake, or pastry.
Choose the best matching item from the catalog.

Our catalog items:
${catalogDescription}

Instructions:
1. Examine structural style, colors, icing decoration, size, shape, and unique elements.
2. If there is a highly confident match (over 70% confidence) in the catalog (e.g. matching Chocolate Truffle, Pineapple, Red Velvet, Black Forest, Blueberry, Lotus Biscoff, etc., as well as the correct mass 1/2 Kg, 1 Kg, or Pastry), return that matched item's ID in "matchedItemId" and set "isConfident" to true.
3. If no clear match is present or you are uncertain, set "matchedItemId" to empty string (""), "isConfident" to false, and suggest a clean professional product name in "suggestedName" (e.g., 'Nutella Blue Berry Pastry') and recommend an appropriate category in "suggestedCategory" (either 'Classic Cakes', 'Exotic Cakes', 'Cheese Cakes', 'Pastries', or 'Savouries & Snacks').
4. Include a very concise English description of what you saw in "reasoning" (e.g. 'Identified a round cake with black glaze and chocolate swirls, matching Chocolate Truffle Cake 1/2 Kg').`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchedItemId: {
                type: Type.STRING,
                description: "The exact matching item ID from our catalog. Return empty string if not strong or unknown match.",
              },
              isConfident: {
                type: Type.BOOLEAN,
                description: "True if a correct item is matched confidently; false otherwise.",
              },
              suggestedName: {
                type: Type.STRING,
                description: "Suggested name if no exact match exists.",
              },
              suggestedCategory: {
                type: Type.STRING,
                description: "Suggested category ('Classic Cakes', 'Exotic Cakes', 'Cheese Cakes', 'Pastries', 'Savouries & Snacks') if no exact match exists.",
              },
              reasoning: {
                type: Type.STRING,
                description: "Short sentence explaining what features are seen on the cake.",
              }
            },
            required: ["isConfident", "reasoning"]
          }
        }
      });

      const responseText = response.text || "{}";
      const resultObj = JSON.parse(responseText.trim());
      res.json(resultObj);
    } catch (err: any) {
      console.error("Gemini cake identification failed:", err);
      res.status(500).json({ error: err.message || "Failed to identify cake" });
    }
  });

  app.post("/api/gemini/identify-bulk-cakes", async (req, res) => {
    try {
      const { image, items } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on this server." });
      }

      // Base64 image extraction
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let mimeType = "image/png";
      let base64Data = image;

      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      }

      // Build listing of current catalog for matching
      const catalogDescription = items
        .map((it: any) => `- ID: "${it.id}", Name: "${it.name}", Category: "${it.category}"`)
        .join("\n");

      const prompt = `You are an expert AI pastry chef. Analyze the provided image of a tray, crate, or collection of cakes.
Identify *all* cakes visible. Count how many of each cake are present of the following specific designs:
- **Red cake with white crumb sides and standard red top**: This is "Red Velvet Cake (1/2 Kg - Serve 4-6)" (ID in catalog typically "95").
- **White frosted cake decorated with multi-colored rainbow sprinkles**: This is "Vanilla Cake (1/2 Kg - Serve 4-6)" (ID in catalog typically "97").
- **Full dark/shiny chocolate glazed cake with golden sprinkles or shapes on top**: This is "Chocolate Truffle Cake (1/2 Kg)" (ID in catalog typically "85").
- **Lavender/Blue/Purple frosting with a dark blueberry/purple pond/pool in the center**: This is "Blueberry Cake (1/2 Kg - Serve 4-6)" (ID in catalog typically "81").
- **Dark chocolate flakes on top with white cream dollops and red cherries**: This is "Black Forest Cake (1/2 Kg - Serve 4-6)" (ID in catalog typically "79").
- **White frosted cake with a glossy yellow pineapple pond/pool or pineapple bits in the center**: This is "Classic Pineapple Cake (1/2 Kg - Serve 4-6)" (ID in catalog typically "87").

Our actual catalog items list:
${catalogDescription}

Instructions:
1. Carefully scan the image and find all cakes. Even if some cakes look similar, use the visual cues above to distinguish them perfectly.
2. For each distinct type of cake visible in the image, count the quantity accurately.
3. Match it to the correct Item ID from the provided catalog. (Always prefer the 1/2 Kg variants in the catalog if available for those types, e.g., ID 95 for Red Velvet 1/2 Kg, ID 85 for Chocolate Truffle 1/2 Kg, ID 81 for Blueberry 1/2 Kg, ID 79 for Black Forest 1/2 Kg, ID 87 for Classic Pineapple 1/2 Kg, ID 97 for Vanilla 1/2 Kg).
4. Return a structured JSON of detected cakes with their matchedItemId, matchedItemName, quantity, and brief visual reasoning.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedCakes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    matchedItemId: {
                      type: Type.STRING,
                      description: "The Item ID from our catalog matching the cake description. Use empty string if no confidence.",
                    },
                    matchedItemName: {
                      type: Type.STRING,
                      description: "Official name from the matched catalog item.",
                    },
                    quantity: {
                      type: Type.INTEGER,
                      description: "Quantity of this cake observed in the tray/image.",
                    },
                    reasoning: {
                      type: Type.STRING,
                      description: "Short sentence describing the visual traits noticed (e.g. 'Red velvet with red top', 'Full chocolate glaze with gold stars').",
                    }
                  },
                  required: ["matchedItemId", "matchedItemName", "quantity", "reasoning"]
                }
              }
            },
            required: ["detectedCakes"]
          }
        }
      });

      const responseText = response.text || "{}";
      const resultObj = JSON.parse(responseText.trim());
      res.json(resultObj);
    } catch (err: any) {
      console.error("Gemini bulk cake identification failed:", err);
      res.status(500).json({ error: err.message || "Failed to identify bulk cakes" });
    }
  });

  // Helper function for smart server-side fallback parsing when Gemini is busy, rate-limited, or unavailable
  function fallbackParseLines(lines: string[], catalogItems: any[]) {
    // Helper: Fast edit (Levenshtein) distance for typo matching
    const getEditDistance = (a: string, b: string): number => {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix: number[][] = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        matrix[i] = [i];
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              matrix[i][j - 1] + 1,     // insertion
              matrix[i - 1][j] + 1      // deletion
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };

    // Helper: Heavy-duty normalization for bakery and weight items (e.g. 500 Grm -> 1/2 Kg)
    const getNormalizedMatchingName = (name: string): string => {
      let s = name.toLowerCase();
      // Normalize weights so they align standard catalog weights
      s = s.replace(/\b500\s*(?:grm|gm|g|gram|grams)\b/gi, ' 1/2 kg ');
      s = s.replace(/\b(?:half|0\.5)\s*(?:kg|kilo|kilogram|kilograms)\b/gi, ' 1/2 kg ');
      s = s.replace(/\b1\s*(?:kg|kilo|kilogram|kilograms)\b/gi, ' 1 kg ');
      s = s.replace(/\b1\s*\/\s*2\s*kg\b/gi, ' 1/2 kg ');
      
      // Remove serving info descriptors e.g., (serve 4-6) or with nested braces
      s = s.replace(/\bserve\s*\d+[-to\s]+\d+\b/gi, '');
      
      // Strip out empty parentheses
      s = s.replace(/\(\s*\)/g, '');
      
      // Keep only alphanumeric characters and spaces
      return s.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    };

    return lines.map(line => {
      // Clean leading and trailing punctuation (especially trailing commas, semicolons, dashes)
      const trimmedLine = line.trim().replace(/^[,\s;_\-]+|[,\s;_\-]+$/g, '').trim();
      
      let namePart = trimmedLine;
      let amount = 1;
      let isNumericMatch = false;

      // Match trailing quantities (e.g. "Vanilla Cake - 4")
      const trailingMatch = trimmedLine.match(/^(.*?)\s*[:\-=\s]\s*(\d+)$/) || trimmedLine.match(/^(.*?)\s*(\d+)$/);
      // Match leading quantities (e.g. "4 Vanilla Cake")
      const leadingMatch = trimmedLine.match(/^\s*(\d+)\s*(?:x|X|[:\-=\s])\s*(.*)$/) || trimmedLine.match(/^\s*(\d+)\s+(.*)$/);

      if (trailingMatch) {
        namePart = trailingMatch[1].trim();
        amount = parseInt(trailingMatch[2], 10);
        isNumericMatch = true;
      } else if (leadingMatch) {
         amount = parseInt(leadingMatch[1], 10);
         namePart = leadingMatch[2].trim();
         isNumericMatch = true;
      } else {
        // Fallback: extract any digit group to guess the number of units
        const generalMatch = trimmedLine.match(/\d+/);
        amount = generalMatch ? parseInt(generalMatch[0], 10) : 1;
        namePart = trimmedLine.replace(/\d+/g, '').trim();
      }

      // Trim inner separators
      namePart = namePart.replace(/^[:\-=\s\(\)]+|[:\-=\s\(\)]+$/g, '').trim();

      if (!namePart) {
         return { matchedItemId: "", originalText: line, amount, isMatched: false };
      }

      const normUser = getNormalizedMatchingName(namePart);
      const userTokens = normUser.split(' ').filter(t => t.length > 0);

      if (userTokens.length === 0) {
        return { matchedItemId: "", originalText: line, amount, isMatched: false };
      }

      let bestItem: any = null;
      let highestScore = 0;

      for (const item of catalogItems) {
        const normItem = getNormalizedMatchingName(item.name);

        // Match EXACT normalized name immediately
        if (normUser === normItem) {
          bestItem = item;
          highestScore = 1.0;
          break;
        }

        const itemTokens = normItem.split(' ').filter(t => t.length > 0);
        if (itemTokens.length === 0) continue;

        let matches = 0;

        userTokens.forEach(uToken => {
          if (itemTokens.includes(uToken)) {
            matches += 1.0;
            return;
          }

          for (const iToken of itemTokens) {
            // Check prefix containment (e.g. "customise" vs "custom")
            if (uToken.startsWith(iToken) && iToken.length >= 4) {
              matches += 0.85;
              break;
            }
            if (iToken.startsWith(uToken) && uToken.length >= 4) {
              matches += 0.85;
              break;
            }
            // Check substring overlaps
            if (uToken.includes(iToken) && iToken.length >= 3) {
              matches += 0.75;
              break;
            }
            if (iToken.includes(uToken) && uToken.length >= 3) {
              matches += 0.75;
              break;
            }
            // Check small typo edit distance
            const dist = getEditDistance(uToken, iToken);
            if (dist === 1 && Math.max(uToken.length, iToken.length) >= 4) {
              matches += 0.75;
              break;
            }
          }
        });

        // Compute similarity metrics
        const tokenUnionSize = new Set([...userTokens, ...itemTokens]).size;
        const jaccardTokenScore = matches / tokenUnionSize;
        const userCoverage = matches / userTokens.length;

        let score = (userCoverage * 0.6) + (jaccardTokenScore * 0.4);

        // Boost if the starting term aligns (highly indicative of category or main flavor match)
        if (itemTokens[0] && userTokens[0]) {
          if (itemTokens[0] === userTokens[0] || itemTokens[0].startsWith(userTokens[0]) || userTokens[0].startsWith(itemTokens[0])) {
            score += 0.12;
          }
        }

        // Weight match checking (critically important for cake weight variants)
        const hasWeightUser = normUser.includes('1/2 kg') || normUser.includes('1 kg');
        const hasWeightItem = normItem.includes('1/2 kg') || normItem.includes('1 kg');

        if (hasWeightUser && hasWeightItem) {
          const match12 = normUser.includes('1/2 kg') && normItem.includes('1/2 kg');
          const match1 = normUser.includes('1 kg') && normItem.includes('1 kg');
          if (match12 || match1) {
            score += 0.35; // Major weight group alignment boost
          } else {
            score -= 0.6;  // Heavy penalty for different weight variant
          }
        } else if (hasWeightUser && !hasWeightItem) {
          score -= 0.25;
        } else if (!hasWeightUser && hasWeightItem) {
          score -= 0.15;
        }

        // Give a tiny boost for specific brand fits like "farm house" vs "farmhouse"
        if (normUser.replace(/\s+/g, '') === normItem.replace(/\s+/g, '')) {
          score += 0.25;
        }

        if (score > highestScore) {
          highestScore = score;
          bestItem = item;
        }
      }

      const isConfidenceHigh = highestScore >= 0.32;
      return {
        matchedItemId: isConfidenceHigh && bestItem ? bestItem.id : "",
        originalText: line,
        amount: amount,
        isMatched: isConfidenceHigh && !!bestItem
      };
    });
  }

  // Helper function for moving average production prediction when Gemini fails or is rate-limited
  function fallbackPredictProduction(items: any[], historyContext: any[]) {
    return items.map(item => {
      let totalSold = 0;
      let count = 0;
      
      if (Array.isArray(historyContext)) {
        historyContext.forEach(day => {
          if (day && day.records && day.records[item.id]) {
            const sold = Number(day.records[item.id].sold || 0);
            totalSold += sold;
            count++;
          }
        });
      }

      const avgSold = count > 0 ? Math.round(totalSold / count) : 0;
      const suggested = Math.max(5, Math.ceil(avgSold * 1.15));

      return {
        itemId: item.id.toString(),
        suggested: suggested,
        reason: count > 0 
          ? `Based on historical sales average of ${avgSold} units with a 15% safety buffer (Smart offline moving average).`
          : `Default safe stock recommendation for ${item.name} guided by optimal daily bakery quotas.`
      };
    });
  }

  app.post("/api/gemini/parse-bulk", async (req, res) => {
    try {
      const { lines, items } = req.body;
      if (!lines || !Array.isArray(lines)) {
        return res.status(400).json({ error: "Invalid lines provided" });
      }

      const activeItems = items || [];
      const catalogInfo = activeItems.map((i: any) => `${i.id}: ${i.name}`).join('\n');

      const deepseekKey = process.env.DEEPSEEK_API_KEY || "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";

      const systemInstructionText = `You are the Inventory Extractor for "Broomies" bakery management system.
Map user-entered text lines to official inventory Catalog IDs and numeric quantities.

CATALOG ITEMS:
${catalogInfo}

INSTRUCTIONS:
1. For each user-entered line, extract BOTH the item description and the positive integer quantity. If no number is explicitly seen, default to 1.
2. Search the CATALOG for the correct matching item. Match intelligently, handling abbreviations, typos, and minor naming differences. Align weights (e.g., 500g is 1/2 kg, 1kg is 1 kg).
3. If you find a matching item, set "matchedItemId" to its Catalog ID (e.g., "43" or "1") and "isMatched" to true.
4. If there is absolutely no confident match, set "matchedItemId" to "" and "isMatched" to false.
5. Return ONLY a valid JSON array matching the original lines. Do NOT write any conversational text, no markdown block wrappers, just return a raw JSON array.

Each element of the JSON array MUST have exactly these fields:
- "originalText": exact text of the input line processed
- "matchedItemId": ID of matched catalog item or ""
- "amount": numeric quantity/amount parsed
- "isMatched": boolean`;

      const batchSize = 25;
      const batches: string[][] = [];
      for (let i = 0; i < lines.length; i += batchSize) {
        batches.push(lines.slice(i, i + batchSize));
      }

      const promises = batches.map(async (batchLines) => {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${deepseekKey}`,
              "HTTP-Referer": "https://ai.studio/build",
              "X-Title": "Broomies Console"
            },
            body: JSON.stringify({
              model: "deepseek/deepseek-chat",
              messages: [
                { role: "system", content: systemInstructionText },
                { role: "user", content: `Process these lines now:\n\n${batchLines.join('\n')}` }
              ],
              temperature: 0.1
            })
          });

          if (!response.ok) {
            throw new Error(`OpenRouter responded with status code ${response.status}`);
          }

          const rawData: any = await response.json();
          let responseText = rawData?.choices?.[0]?.message?.content || '[]';
          
          // Clean possible markdown code formatting if present
          responseText = responseText.trim();
          if (responseText.startsWith('```json')) {
            responseText = responseText.substring(7);
          } else if (responseText.startsWith('```')) {
            responseText = responseText.substring(3);
          }
          if (responseText.endsWith('```')) {
            responseText = responseText.substring(0, responseText.length - 3);
          }
          responseText = responseText.trim();

          return JSON.parse(responseText);
        } catch (error) {
          console.error("DeepSeek parse batch failed, mapping to fallback unmatched lines:", error);
          return fallbackParseLines(batchLines, activeItems);
        }
      });

      const results = await Promise.all(promises);
      const flatResults = results.flat();
      res.json(flatResults);
    } catch (err: any) {
      console.error("DeepSeek bulk parse master failed, mapping everything to local fallback parser:", err);
      const fallbackResults = fallbackParseLines(req.body.lines || [], req.body.items || []);
      res.json(fallbackResults);
    }
  });

  app.post("/api/gemini/predict-production", async (req, res) => {
    const { predictionDate, items, historyContext } = req.body;
    const activeItems = items || [];

    if (!predictionDate || !items) {
      return res.status(400).json({ error: "Missing required prediction fields" });
    }

    // Fallback if API Key is not configured
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not configured. Running fallback predictor.");
      const fallbackPreds = fallbackPredictProduction(activeItems, historyContext || []);
      return res.json(fallbackPreds);
    }

    try {
      const prompt = `
        Analyze bakery sales history and predict production for ${predictionDate}.
        Items: ${activeItems.map((i: any) => `${i.id}: ${i.name}`).join(', ')}
        History: ${JSON.stringify(historyContext)}
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                itemId: { type: Type.STRING },
                suggested: { type: Type.NUMBER },
                reason: { type: Type.STRING }
              },
              required: ["itemId", "suggested", "reason"]
            }
          }
        }
      });

      const text = result.text || '[]';
      res.json(JSON.parse(text.trim()));
    } catch (err: any) {
      console.error("Prediction failed, running smart offline moving average predictor:", err);
      const fallbackPreds = fallbackPredictProduction(activeItems, historyContext || []);
      res.json(fallbackPreds);
    }
  });

  // Setup Vite development middleware OR serve built static assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Broomies fullstack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
