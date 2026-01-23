
import { GoogleGenAI } from "@google/genai";

// Safely access process.env
const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : '';
const geminiApiKey = (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) ? process.env.GEMINI_API_KEY : '';

// Use either API_KEY or GEMINI_API_KEY
const validApiKey = apiKey || geminiApiKey;

let ai: GoogleGenAI | null = null;
let apiKeyValid = false;

// Only initialize if we have a valid-looking API key (not empty)
if (validApiKey && validApiKey.trim().length > 0) {
  try {
    ai = new GoogleGenAI({ apiKey: validApiKey });
    apiKeyValid = true;
  } catch (error) {
    // API key is invalid, don't initialize
    apiKeyValid = false;
  }
}

export const getMotivationalQuote = async (): Promise<string> => {
  // Return default quote immediately if API key is not configured or invalid
  if (!apiKeyValid || !ai || !validApiKey) {
    return "Success is not final, failure is not fatal: it is the courage to continue that counts.";
  }
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Give me a short, unique, highly motivating quote for an employee to start their day. Max 20 words.",
    });
    return response.text || "Keep pushing forward!";
  } catch (e: any) {
    // If we get an API key error, mark it as invalid to prevent future calls
    if (e?.error?.code === 400 && e?.error?.message?.includes('API key')) {
      apiKeyValid = false;
      // Log only once
      if (!(window as any).__geminiKeyInvalidLogged) {
        (window as any).__geminiKeyInvalidLogged = true;
      }
      return "Believe you can and you're halfway there.";
    }
    // For other errors, log once but don't spam
    if (!(window as any).__geminiErrorLogged) {
      console.warn("Gemini API unavailable. Using default quote.");
      (window as any).__geminiErrorLogged = true;
    }
    return "Believe you can and you're halfway there.";
  }
};

export const getTaskAssistance = async (taskDescription: string): Promise<string> => {
  // Return default message immediately if API key is not configured or invalid
  if (!apiKeyValid || !ai || !validApiKey) {
    return "AI Assistance unavailable. Please configure a valid Gemini API key in your environment variables.";
  }

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `I have a task: "${taskDescription}". Give me 3 bullet points on how to approach this effectively.`,
    });
    return response.text || "Break it down into smaller steps.";
  } catch (e: any) {
    // If we get an API key error, mark it as invalid to prevent future calls
    if (e?.error?.code === 400 && e?.error?.message?.includes('API key')) {
      apiKeyValid = false;
      return "AI Assistance unavailable. Please configure a valid Gemini API key.";
    }
    // For other errors, log once but don't spam
    if (!(window as any).__geminiErrorLogged) {
      console.warn("Gemini API unavailable.");
      (window as any).__geminiErrorLogged = true;
    }
    return "Error generating assistance. Please try again later.";
  }
};
