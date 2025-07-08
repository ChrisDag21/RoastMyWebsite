// Import dependencies
import dotenv from "dotenv";
import captureWebsite from "capture-website";
import express from "express";
import OpenAI from "openai";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import validator from "validator";
import ipaddr from "ipaddr.js";
import { URL } from "url";
import dns from "dns";

// Load environment variables
dotenv.config({ path: "./keys.env" });

// Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

// Constants for API access
const openAiKey = process.env.OPENAI_API_KEY;
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

async function isPublicUrl(urlToTest) {
  try {
    const { hostname } = new URL(urlToTest);
    const { address } = await dns.promises.lookup(hostname);
    const addr = ipaddr.parse(address);
    return (
      addr.range() !== "unspecified" &&
      addr.range() !== "loopback" &&
      !addr.isPrivate()
    );
  } catch (error) {
    return false; // Hostname couldn't be resolved
  }
}

function validURL(str) {
  // Use validator.js to check if the URL is valid
  return validator.isURL(str, {
    require_protocol: true,
    protocols: ["http", "https"],
    require_valid_protocol: true,
  });
}

// analyzeImage function (unchanged)
async function analyzeImage(base64Image) {
  try {
    const prompt =
      "You are a witty and sarcastic web design expert. Analyze the provided website screenshot and return your analysis in the specified JSON format. Your roast should be funny but your advice must be genuinely helpful.";

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
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
          strict: true, // Ensure strict adherence to the schema
        },
      },
    });

    const analysisResult = response.choices[0].message.content;
    return analysisResult;
  } catch (error) {
    console.error(
      "Failed to analyze screenshot with OpenAI Vision:",
      error.message
    );
    throw new Error("Failed to analyze screenshot with OpenAI Vision.");
  }
}

// In your backend's main file

async function getScreenshot(url) {
  try {
    const base64Image = await captureWebsite.base64(url, {
      fullPage: true,
      disableAnimations: true,
      timeout: 30,

      launchOptions: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });
    return base64Image;
  } catch (error) {
    console.error("Error making capture-website call:", error.message);
    throw new Error("Failed to capture screenshot with capture-website.");
  }
}

app.get("/", (req, res) => {
  res.status(200).json({ status: "ok" });
});
// --- MODIFIED: The route now only returns the JSON analysis ---
app.post("/screenshot", limiter, async (req, res) => {
  console.log("Received request with body:", req.body);
  const { url } = req.body; // Only URL is needed now

  if (!url || typeof url !== "string" || url.length > 2048 || !validURL(url)) {
    return res.status(400).json(
      !url
        ? { error: "URL is required." }
        : {
            error:
              "Invalid URL format. A valid URL (including http:// or https://) is required.",
          }
    );
  }

  const isPublic = await isPublicUrl(url);
  if (!isPublic) {
    return res.status(400).json({
      error: "The provided URL is not publicly accessible or is a private IP.",
    });
  }

  // --- Email validation commented out ---
  // const { email } = req.body;
  // if (!email || !validEmail(email)) {
  //   return res.status(400).json(!email ? { error: "Email is required." } : { error: "Invalid email format." });
  // }

  try {
    const base64Image = await getScreenshot(url);
    console.log("Image captured successfully.");

    const analysisResult = await analyzeImage(base64Image);

    // --- All email sending logic is commented out ---
    /*
    const { roast, constructiveAdvice, overallScore, designEra, trustworthinessScore, colorPaletteAnalysis } = analysisResult;
    const ctaText = `...`;
    const emailBody = `...`;
    const mailOptions = { ... };
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    */

    const analysisObject = JSON.parse(analysisResult);

    const finalResponse = {
      analysis: analysisObject,
      screenshot: base64Image,
    };

    const consoleResponse = {
      url,

      analysis: analysisObject,
    };

    console.log("Final response object created:", consoleResponse);

    // Directly return the analysis JSON object.
    res.json(finalResponse);
  } catch (error) {
    console.error("Error processing request:", error.message);
    if (
      error.message.includes("website address does not seem to exist") ||
      error.message.includes("website took too long to load") ||
      error.message.includes("Could not capture a screenshot")
    ) {
      return res.status(400).json({ error: error.message });
    }
    res
      .status(500)
      .json({ error: "An unexpected error occurred. Please try again later." });
  }
});

// Start the server (unchanged)
app.listen(port, "0.0.0.0", () =>
  console.log(`Server is listening on port:${port}`)
);
