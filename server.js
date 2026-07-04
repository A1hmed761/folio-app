import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up Multer to store uploaded PDFs directly in memory buffer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Global variable to persist document state for this basic setup
let currentFileBuffer = null;
let currentMimeType = '';

// 1. Upload Route
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  // Keep the file in memory to reference during chat queries
  currentFileBuffer = req.file.buffer;
  currentMimeType = req.file.mimetype;

  console.log(`Successfully indexed: ${req.file.originalname}`);
  res.json({ message: 'Document loaded successfully into memory.' });
});

// 2. Chat Query Route
app.post('/api/chat', async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  if (!currentFileBuffer) {
    return res.status(400).json({ error: 'Please upload a source document first.' });
  }

  try {
    // Convert memory buffer to the inlineData format Gemini expects
    const pdfPart = {
      inlineData: {
        data: currentFileBuffer.toString('base64'),
        mimeType: currentMimeType
      }
    };

    // Call Gemini 2.5 Flash, passing both the document block and user query
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        pdfPart,
        { text: `You are the Folio AI assistant. Answer the following question based ONLY on the attached document: ${question}` }
      ],
    });

    res.json({ answer: response.text });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Error generating response from AI.' });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Folio backend spinning at http://localhost:${port}`);
});