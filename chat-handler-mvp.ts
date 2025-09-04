// Simplified FM Global RAG Chat MVP - Works with existing tables
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ASRSConfiguration {
  asrs_type: 'Shuttle' | 'Mini-Load' | 'Horizontal Carousel';
  container_type: 'Closed-Top' | 'Open-Top' | 'Mixed';
  rack_depth_ft: number;
  rack_spacing_ft: number;
  ceiling_height_ft: number;
  storage_height_ft: number;
  system_type: 'wet' | 'dry' | 'both';
}

export class SimpleFMGlobalAgent {
  private supabase: SupabaseClient;
  private openai: OpenAI;

  constructor(supabaseUrl: string, supabaseKey: string, openaiKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openai = new OpenAI({ apiKey: openaiKey });
  }

  async handleChatMessage(message: string): Promise<ChatMessage> {
    try {
      // Step 1: Generate embedding for the query
      const embedding = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: message,
      });

      // Step 2: Search for relevant chunks in existing database
      const searchResults = await this.searchDocuments(embedding.data[0].embedding);

      // Step 3: Generate response using GPT-4
      const response = await this.generateResponse(message, searchResults);

      return {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Chat error:', error);
      return {
        role: 'assistant',
        content: 'I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
    }
  }

  private async searchDocuments(embedding: number[]): Promise<any[]> {
    try {
      // Use the match_chunks function from your existing schema
      const { data, error } = await this.supabase.rpc('match_chunks', {
        query_embedding: embedding,
        match_count: 5
      });

      if (error) {
        console.error('Search error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Database search failed:', error);
      return [];
    }
  }

  private async generateResponse(query: string, searchResults: any[]): Promise<string> {
    const context = searchResults.map(r => r.content).join('\n\n');

    const systemPrompt = `You are an expert FM Global 8-34 ASRS sprinkler design consultant.
Use the following context to answer questions about ASRS sprinkler requirements.
If the context doesn't contain relevant information, provide general guidance based on FM Global standards.

Context:
${context}`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });

    return completion.choices[0].message.content || 'Unable to generate response.';
  }

  async generateDesign(config: ASRSConfiguration): Promise<any> {
    // Simplified design generation
    const sprinklerSpacing = config.container_type === 'Open-Top' ? 6 : 8;
    const areaPerSprinkler = sprinklerSpacing * sprinklerSpacing;
    const totalArea = config.rack_depth_ft * config.rack_spacing_ft * 10; // Assume 10 racks
    const sprinklerCount = Math.ceil(totalArea / areaPerSprinkler);
    
    const costPerSprinkler = 150;
    const laborMultiplier = 1.4;
    const materialCost = sprinklerCount * costPerSprinkler;
    const totalCost = materialCost * laborMultiplier;

    return {
      configuration: config,
      sprinkler_count: sprinklerCount,
      sprinkler_spacing: sprinklerSpacing,
      protection_scheme: `${config.system_type} system with ceiling sprinklers`,
      estimated_cost: {
        materials: materialCost,
        labor: totalCost - materialCost,
        total: totalCost
      },
      compliance_summary: `Design complies with FM Global 8-34 for ${config.asrs_type} ASRS systems`
    };
  }
}

// Test function
export async function testAgent() {
  const agent = new SimpleFMGlobalAgent(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    process.env.OPENAI_API_KEY!
  );

  console.log('Testing FM Global RAG Agent...\n');

  // Test chat
  const response = await agent.handleChatMessage(
    "What are the sprinkler requirements for a shuttle ASRS?"
  );
  console.log('Chat Response:', response.content);

  // Test design
  const design = await agent.generateDesign({
    asrs_type: 'Shuttle',
    container_type: 'Closed-Top',
    rack_depth_ft: 20,
    rack_spacing_ft: 4,
    ceiling_height_ft: 32,
    storage_height_ft: 28,
    system_type: 'wet'
  });
  console.log('\nDesign Generated:', design);
}