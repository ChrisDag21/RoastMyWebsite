// Import dependencies
import dotenv from "dotenv";
import captureWebsite from "capture-website";
import express from "express";
import OpenAI from "openai";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import validator from "validator";
import crypto from "crypto";
import sharp from "sharp";

// Load environment variables
dotenv.config({ path: "./keys.env" });

import { supabase } from "./supabaseClient.mjs";

// Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

// Constants for API access
const openAiKey = process.env.OPENAI_API_KEY;
const apiFlashKey = process.env.APIFLASH_API_KEY;
// const emailUser = process.env.EMAIL_USER; // Email functionality commented out
// const emailPass = process.env.EMAIL_PASS; // Email functionality commented out

// Setup OpenAI API
const openai = new OpenAI({
  apiKey: openAiKey,
});

// --- Email functionality commented out for testing ---
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: { user: emailUser, pass: emailPass },
// });

app.set("trust proxy", 1);

// Middleware
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: [
      "https://roast-my-website-frontend.vercel.app",
      "https://uxcourt.com",
      "https://www.uxcourt.com",
      "http://localhost:3000", // Local development
    ],
  })
);
app.use(express.json());

// Get the IP whitelist from environment variables
const whitelist = (process.env.RATE_LIMIT_WHITELIST || "")
  .split(",")
  .map((ip) => ip.trim());

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Are you trying to bankrupt me? Slow down!",
  },
  skip: (req) => {
    const clientIp = req.ip;
    return whitelist.includes(clientIp);
  },
});

// JSON Schema for the OpenAI response (unchanged)
const roastSchema = {
  type: "object",
  properties: {
    theVerdict: {
      type: "integer",
      minimum: 1,
      maximum: 100,
      description:
        "The final judgment score, from 1 (design felon) to 100 (design saint). This is the main score.",
    },
    mayhemMeter: {
      type: "integer",
      minimum: 1,
      maximum: 10,
      description:
        "A rating from 1 (Zen Garden) to 10 (Dumpster Fire) measuring the visual chaos and disorganization.",
    },
    culpritProfile: {
      type: "string",
      description:
        "A creative 'criminal profile' for the website's design personality, like 'The Color-Blind Kleptomaniac' or 'The Font Fugitive'.",
    },
    openingStatement: {
      type: "string",
      description:
        "The prosecution's opening statement: a single, sharp sentence that presents the most egregious design crime.",
    },
    caseFiles: {
      type: "string",
      description:
        "The full evidence log. 2-3 paragraphs of witty, sarcastic, and detailed testimony against the site's design, layout, and user experience. At least 250-300 words long.",
    },
    spiritAnimal: {
      type: "string",
      description:
        "Assign a metaphorical 'spirit animal' that represents the website's design. Be creative and funny, e.g., 'A Confused Platypus in a Font Factory'.",
    },
    rehabilitationProgram: {
      type: "object",
      description:
        "A structured, actionable plan to fix the site's problems. Don't just stick with design issues, include content, usability, and lead conversion improvements too.",
      properties: {
        priorityOneDirective: {
          type: "string",
          description:
            "The most critical, non-negotiable fix. This should be a short paragraph summarizing the main problems.",
        },
        correctiveActions: {
          type: "array",
          description:
            "A list of at least 4 longer-term improvements to guide the design back to health. That might include design, content, usability, and lead conversion improvements.",
          items: {
            type: "object",
            properties: {
              theOffense: {
                type: "string",
                description:
                  "A simple description of the specific 'crime' committed, like 'Illegible text over a busy background'.",
              },
              theRemedy: {
                type: "string",
                description:
                  "The specific 'remedy' or solution to atone for the offense.",
              },
            },
            required: ["theOffense", "theRemedy"],
            additionalProperties: false,
          },
        },
      },
      required: ["priorityOneDirective", "correctiveActions"],
      additionalProperties: false,
    },
  },
  required: [
    "theVerdict",
    "mayhemMeter",
    "culpritProfile",
    "openingStatement",
    "caseFiles",
    "spiritAnimal",
    "rehabilitationProgram",
  ],
  additionalProperties: false,
};

// Utility functions (unchanged)
// function validURL(str) {
//   try {
//     new URL(str);
//     return true;
//   } catch (error) {
//     return false;
//   }
// }

function validURL(str) {
  // Use validator.js to check if the URL is valid
  return validator.isURL(str, {
    require_protocol: true,
    protocols: ["http", "https"],
    require_valid_protocol: true,
  });
}

// analyzeImage function
async function analyzeImage(base64Image) {
  try {
    const prompt =
      "You are a witty and sarcastic web design expert. Analyze the provided website screenshot and return your analysis in the specified JSON format. Your roast should be funny but your advice must be genuinely helpful.";

    const response = await openai.chat.completions.create({
      model: "gpt-4.1", // Keeping your model name to see the specific error it returns
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${base64Image}` },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "RoastAnalysis",
          schema: roastSchema,
          strict: true,
        },
      },
    });

    const analysisResult = response.choices[0].message.content;
    return analysisResult;
  } catch (error) {
    // --- ENHANCED ERROR LOGGING ---
    console.error("\n--- FULL OPENAI API ERROR LOG ---");

    // The openai-node library provides detailed error objects.
    // This will print the HTTP status and the exact error body from OpenAI.
    if (error.response) {
      console.error("STATUS:", error.response.status);
      console.error("DATA:", JSON.stringify(error.response.data, null, 2));
      console.error("HEADERS:", error.response.headers);
    } else {
      // For non-API errors (e.g., network issues)
      console.error("An unexpected error occurred:", error.message);
    }

    console.error("--- END OF ERROR LOG ---\n");
    // --- END OF ENHANCED LOGGING ---

    throw new Error(
      "Failed to analyze screenshot with OpenAI Vision. See server logs for full details."
    );
  }
}

async function getScreenshotFromAPI(targetUrl) {
  if (!apiFlashKey) {
    throw new Error("APIFlash API key is not configured.");
  }

  console.log("Requesting screenshot from APIFlash...");

  const apiUrl = `https://api.apiflash.com/v1/urltoimage
?access_key=${apiFlashKey}
&url=${encodeURIComponent(targetUrl)}
&format=webp
&width=1280
&full_page=true
&quality=80
&scroll_page=true
&no_cookie_banners=true
&no_ads=true`;

  const response = await fetch(apiUrl);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("APIFlash Error:", errorText);
    throw new Error("Failed to capture screenshot via APIFlash.");
  }

  // APIFlash returns the image directly, so we get its buffer
  const imageBuffer = await response.arrayBuffer();
  return Buffer.from(imageBuffer);
}

app.get("/", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/roasts", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("roasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching roasts:", error.message);
    res.status(500).json({ error: "Failed to fetch roasts." });
  }
});

app.get("/roasts/:id", async (req, res) => {
  const { id } = req.params;

  // Validate that the provided ID is a valid UUID format
  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: "Invalid roast ID format." });
  }

  try {
    const { data, error } = await supabase
      .from("roasts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching single roast:", error.message);
      return res.status(404).json({ error: "Roast not found." });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error processing request:", error.message);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
});

app.get("/roasts/mine/:visitorId", async (req, res) => {
  const { visitorId } = req.params;
  if (!visitorId || !validator.isUUID(visitorId)) {
    return res.status(400).json({ error: "Invalid visitor ID format." });
  }

  try {
    const { data, error } = await supabase
      .from("roasts")
      .select("*")
      .eq("visitor_id", visitorId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching visitor roasts:", error.message);
      return res
        .status(404)
        .json({ error: "No roasts found for this visitor." });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error processing request:", error.message);
    res.status(500).json({ error: "Failed to fetch visitor roasts." });
  }
});

app.post("/roast", limiter, async (req, res) => {
  console.log("Received public roast request for:", req.body.url);
  const { url, visitorId } = req.body; // Only the URL is needed now

  // 1. Validate Input
  if (!url || !validURL(url)) {
    return res.status(400).json({ error: "A valid URL is required." });
  }

  try {
    // 2. Get Screenshot
    const screenshotBuffer = await getScreenshotFromAPI(url);
    console.log("Screenshot captured.");

    console.log(
      `Original screenshot size: ${(
        screenshotBuffer.length /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    const compressedImageBuffer = await sharp(screenshotBuffer)
      .resize({ width: 1280 })
      .webp({ quality: 80 })
      .toBuffer();
    console.log(
      `Compressed screenshot size: ${(
        compressedImageBuffer.length /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    // 3. Perform Concurrent Operations (Upload + Analysis)
    const uniqueId = crypto.randomUUID(); // Create a unique identifier for the roast
    console.log(
      "Starting parallel tasks: Uploading to Supabase and Analyzing with OpenAI..."
    );

    const base64Image = compressedImageBuffer.toString("base64");

    const [uploadResult, analysisResult] = await Promise.all([
      // Task 1: Upload screenshot to a public path
      supabase.storage
        .from("screenshots")
        .upload(`public/${uniqueId}.webp`, compressedImageBuffer, {
          contentType: "image/webp",
          cacheControl: "3600",
        }),
      // Task 2: Get roast analysis from OpenAI
      analyzeImage(base64Image),
    ]);

    // 4. Process Results
    const { data: uploadData, error: uploadError } = uploadResult;
    if (uploadError) throw uploadError;
    console.log("Screenshot uploaded to Supabase.");

    const {
      data: { publicUrl },
    } = supabase.storage.from("screenshots").getPublicUrl(uploadData.path);
    const analysisObject = JSON.parse(analysisResult);
    console.log("AI analysis complete.");

    // 5. Save Everything to the Database (without a user_id)
    const { data: insertData, error: insertError } = await supabase
      .from("roasts")
      .insert({
        id: uniqueId,
        url: url,
        roast_json: analysisObject,
        screenshot_url: publicUrl,
        visitor_id: visitorId || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    console.log("Roast saved to database. Sending response.");

    res.status(200).json(insertData);
  } catch (error) {
    console.error("Error processing request:", error.message);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
});

app.listen(port, "0.0.0.0", () =>
  console.log(`Server is listening on port:${port}`)
);
