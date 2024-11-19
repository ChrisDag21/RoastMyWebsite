// Import dependencies
import dotenv from "dotenv";
import captureWebsite from "capture-website";
import express from "express";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import validator from "validator";

// Load environment variables
dotenv.config({ path: "./keys.env" });

// Initialize Express app
const app = express();
const port = 3001;

// Constants for API access
const openAiKey = process.env.OPENAI_API_KEY;
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

// Setup OpenAI API
const openai = new OpenAI({
  baseURL: "https://api.openai.com/v1",
  apiKey: openAiKey,
});

// Setup nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: emailUser, pass: emailPass },
});

// Middleware to handle JSON payloads
app.use(express.json());

// Utility functions
function validURL(str) {
  try {
    new URL(str);
    return true;
  } catch (error) {
    return false;
  }
}

function validEmail(email) {
  return validator.isEmail(email);
}

async function getScreenshot(url) {
  try {
    const base64Image = await captureWebsite.base64(url, {
      fullPage: true,
      disableAnimations: true,
    });
    return base64Image;
  } catch (error) {
    console.error("Error making capture-website call:", error.message);
    throw new Error("Failed to capture screenshot with capture-website.");
  }
}

async function analyzeImage(base64Image) {
  try {
    const prompt =
      "You're a brutally honest, witty, and humorously sarcastic website critique expert. You've come across a website that needs some serious improvements, and you're going to deliver a spicy roast — but you're also professional enough to provide some helpful advice afterward. Here's what I need from you: 1. Roast the website's design, color scheme, typography, and overall user experience. Be as funny and sarcastic as possible, but keep it constructive. 2. After the roast, provide actual, useful advice on how the website can improve in each of the areas you roasted.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
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

// Route to handle screenshot requests
app.post("/screenshot", async (req, res) => {
  console.log("Received request with body:", req.body);
  const { url, email } = req.body;

  if (!url || !validURL(url)) {
    return res
      .status(400)
      .json(
        !url
          ? { error: "URL is required in the request body." }
          : { error: "Invalid URL format. Please provide a valid URL." }
      );
  }

  if (!email || !validEmail(email)) {
    return res
      .status(400)
      .json(
        !email
          ? { error: "Email is required in the request body." }
          : { error: "Invalid email format. Please provide a valid email." }
      );
  }

  try {
    const base64Image = await getScreenshot(url);
    console.log("Image captured successfully");
    const analysisResult = await analyzeImage(base64Image);
    console.log("Analysis:", analysisResult);

    const ctaText = `
  
  ---

  **P.S.**: Want to see your website with a fresh new look? Reply here to get a free redesigned homepage mockup for your business! 
  Also, feel free to check out some of my work at https://www.revivenrevamp.com/.

  Cheers,  
  Chris
  Revive & Revamp
  
  `;

    const emailBody = `${analysisResult}\n${ctaText}`;

    const mailOptions = {
      from: emailUser,
      to: email,
      subject: "Website Analysis",
      text: emailBody,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    res.json({
      analysis: analysisResult,
      emailStatus: "Email sent successfully",
      info: info.response,
    });
  } catch (error) {
    console.error("Error processing request:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);
